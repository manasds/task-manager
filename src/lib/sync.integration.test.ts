import 'dotenv/config';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Activity } from '../types/activity';

function activity(id: string, title: string): Activity {
  return {
    id,
    title,
    category: 'deep_work',
    priority: 'medium',
    status: 'backlog',
    estimatedMinutes: 30,
    actualMinutes: 0,
    date: '2026-10-15',
    subtasks: [],
    tags: [],
    createdAt: '2026-10-15T10:00:00.000Z',
  };
}

describe('postgres per-task sync', () => {
  it('pushes rows, pulls by cursor, and resolves concurrent edits by timestamp', async (t) => {
    const { configuredDatabaseUrl, migrate, pool } = await import('./db');
    if (!configuredDatabaseUrl()) {
      t.skip('DATABASE_URL not set');
      return;
    }
    const { insertTestUser } = await import('./auth');
    const { pullChanges, pushChanges } = await import('./sync');

    try {
      await migrate();
    } catch (error) {
      t.skip(`Postgres unavailable: ${(error as Error).message}`);
      return;
    }
    const user = await insertTestUser(`sync-test-${Date.now()}@example.com`);

    try {
      const first = await pushChanges(user.id, {
        changes: [
          { id: 'a', data: activity('a', 'A1'), updatedAt: '2026-10-15T10:00:00.000Z', baseSeq: 0 },
          { id: 'b', data: activity('b', 'B1'), updatedAt: '2026-10-15T10:00:00.000Z', baseSeq: 0 },
        ],
        goal: { dailyGoalMinutes: 240, updatedAt: '2026-10-15T10:00:00.000Z', baseSeq: 0 },
      });
      assert.deepEqual(first.applied.map((r) => r.seq), [1, 2]);
      assert.deepEqual(first.goalApplied, { seq: 3 });

      const all = await pullChanges(user.id, 0);
      assert.equal(all.rows.length, 2);
      assert.equal(all.goal?.dailyGoalMinutes, 240);
      assert.equal(all.cursor, 3);

      // Device 2 edits `a` after seeing seq 1.
      await pushChanges(user.id, {
        changes: [{ id: 'a', data: activity('a', 'A2'), updatedAt: '2026-10-15T11:00:00.000Z', baseSeq: 1 }],
      });

      // Device 1 still has baseSeq 1 and an older edit: it loses.
      const stale = await pushChanges(user.id, {
        changes: [{ id: 'a', data: activity('a', 'A-stale'), updatedAt: '2026-10-15T10:30:00.000Z', baseSeq: 1 }],
      });
      assert.equal(stale.applied.length, 0);
      assert.equal(stale.rejected[0].data?.title, 'A2');

      // A delete from a device that saw the latest seq applies regardless of clocks.
      const deleted = await pushChanges(user.id, {
        changes: [{ id: 'b', data: null, updatedAt: '2026-10-15T09:00:00.000Z', baseSeq: 2 }],
      });
      assert.equal(deleted.applied.length, 1);

      const since = await pullChanges(user.id, all.cursor);
      assert.deepEqual(
        since.rows.map((r) => [r.id, r.data?.title ?? null]),
        [['a', 'A2'], ['b', null]]
      );
      assert.equal(since.goal, null);
    } finally {
      await pool.query('DELETE FROM "user" WHERE id = $1', [user.id]);
    }
  });
});
