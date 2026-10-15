import 'dotenv/config';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyDocument } from '../src/utils/syncPolicy.ts';

describe('postgres document writes', () => {
  it('rejects a stale revision so session flushes cannot silently clobber', async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip('DATABASE_URL not set');
      return;
    }

    const { migrate, pool } = await import('./db.ts');
    const { createUser } = await import('./auth.ts');
    const { saveDocument, getDocument } = await import('./documents.ts');

    try {
      await migrate();
    } catch (error) {
      t.skip(`Postgres unavailable: ${(error as Error).message}`);
      return;
    }
    const email = `flush-test-${Date.now()}@example.com`;
    const user = await createUser(email, 'password123');
    const first = emptyDocument();
    first.activities = [];
    first.updatedAt = '2026-10-15T10:00:00.000Z';

    const created = await saveDocument(user.id, first, 0);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const stale = { ...first, dailyGoalMinutes: 99, updatedAt: '2026-10-15T11:00:00.000Z' };
    const conflict = await saveDocument(user.id, stale, 0);
    assert.equal(conflict.ok, false);

    const next = { ...first, dailyGoalMinutes: 180, updatedAt: '2026-10-15T12:00:00.000Z' };
    const saved = await saveDocument(user.id, next, created.record.revision);
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.record.document.dailyGoalMinutes, 180);

    const loaded = await getDocument(user.id);
    assert.equal(loaded?.revision, saved.record.revision);

    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
  });
});
