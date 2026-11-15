import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';
import type { Activity } from '../types/activity';
import type { CanvasSection, CanvasTile } from '../types/canvas';

// Writes and deletes throwaway users, so it never runs against DATABASE_URL by accident.
// The modules are imported after DATABASE_URL points at the test database.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

function activity(id: string): Activity {
  return {
    id,
    title: id,
    category: 'build',
    priority: 'medium',
    status: 'backlog',
    estimatedMinutes: 30,
    actualMinutes: 0,
    date: '2026-10-15',
    subtasks: [],
    createdAt: '2026-10-15T10:00:00.000Z',
  };
}

function tile(id: string): CanvasTile {
  return {
    id,
    url: 'https://example.com/',
    title: id,
    kind: 'article',
    status: 'active',
    note: '',
    position: 1,
    createdAt: '2026-10-15T10:00:00.000Z',
    sectionId: null,
    x: 0,
    y: 0,
    image: null,
  };
}

function section(id: string): CanvasSection {
  return { id, name: id, x: 0, y: 0, cols: 3, createdAt: '2026-10-15T10:00:00.000Z' };
}

/** A fresh user in the test database, or null (and the test skipped) when there is none. */
async function testUser(t: TestContext): Promise<string | null> {
  if (!process.env.TEST_DATABASE_URL) {
    t.skip('TEST_DATABASE_URL not set');

    return null;
  }

  const { ensureMigrated, pool } = await import('./db');

  try {
    await ensureMigrated();
  } catch (error) {
    t.skip(`Postgres unavailable: ${error instanceof Error ? error.message : String(error)}`);

    return null;
  }

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, 'limits-test', $2, true, now(), now())`,
    [id, `limits-test-${id}@example.com`]
  );
  t.after(() => pool.query('DELETE FROM "user" WHERE id = $1', [id]));

  return id;
}

describe('sync timestamps', () => {
  it('passes any readable date on as ISO, and refuses ones Postgres could not store', async () => {
    const { pushRequestSchema } = await import('./sync');

    const parse = (updatedAt: string) =>
      pushRequestSchema.safeParse({ changes: [{ id: 'a', data: null, updatedAt, baseSeq: 0 }] });

    const read = parse('Sun, 15 Nov 2026 10:00:00 GMT');
    assert.equal(read.success && read.data.changes[0].updatedAt, '2026-11-15T10:00:00.000Z');
    assert.equal(parse('not a date').success, false);
    assert.equal(parse('+020000-01-01T00:00:00.000Z').success, false);
  });
});

describe('postgres per-account caps', () => {
  it('pulls nothing for a user who never pushed', async (t) => {
    const userId = await testUser(t);

    if (!userId) return;
    const { pullChanges } = await import('./sync');

    assert.deepEqual(await pullChanges(userId, 0), { rows: [], goal: null, cursor: 0, hasMore: false });
  });

  it('refuses a push past the task cap, and counts deletes in the same push', async (t) => {
    const userId = await testUser(t);

    if (!userId) return;
    const { pool } = await import('./db');
    const { LimitError, MAX_TASKS_PER_USER } = await import('./limits');
    const { pullChanges, pushChanges } = await import('./sync');

    // One below the cap, plus a deleted task that doesn't count.
    await pool.query(
      `INSERT INTO activities (user_id, id, data, client_updated_at, server_seq)
       SELECT $1, 'seed-' || g, jsonb_build_object('id', 'seed-' || g, 'title', 'seed', 'status', 'backlog'), now(), g
       FROM generate_series(1, $2::int) g`,
      [userId, MAX_TASKS_PER_USER - 1]
    );
    await pool.query(
      `INSERT INTO activities (user_id, id, data, client_updated_at, server_seq) VALUES ($1, 'gone', NULL, now(), $2)`,
      [userId, MAX_TASKS_PER_USER]
    );
    await pool.query('INSERT INTO user_sync_state (user_id, seq) VALUES ($1, $2)', [userId, MAX_TASKS_PER_USER]);

    const at = '2026-10-15T10:00:00.000Z';

    await assert.rejects(
      pushChanges(userId, {
        changes: [
          { id: 'new-1', data: activity('new-1'), updatedAt: at, baseSeq: 0 },
          { id: 'new-2', data: activity('new-2'), updatedAt: at, baseSeq: 0 },
        ],
      }),
      LimitError
    );

    // The refused push wrote nothing.
    assert.equal((await pullChanges(userId, MAX_TASKS_PER_USER)).rows.length, 0);

    const fits = await pushChanges(userId, {
      changes: [
        { id: 'new-1', data: activity('new-1'), updatedAt: at, baseSeq: 0 },
        { id: 'new-2', data: activity('new-2'), updatedAt: at, baseSeq: 0 },
        { id: 'seed-1', data: null, updatedAt: at, baseSeq: 1 },
      ],
    });

    assert.equal(fits.applied.length, 3);

    // Editing a task at the cap is still fine.
    const edit = await pushChanges(userId, {
      changes: [
        { id: 'new-1', data: { ...activity('new-1'), title: 'edited' }, updatedAt: at, baseSeq: fits.applied[0].seq },
      ],
    });

    assert.equal(edit.applied.length, 1);
  });

  it('refuses a new tile or section past the canvas caps, but still saves edits', async (t) => {
    const userId = await testUser(t);

    if (!userId) return;
    const { pool } = await import('./db');
    const { listSections, listTiles, saveSection, saveTile } = await import('./canvas');
    const { LimitError, MAX_CANVAS_SECTIONS_PER_USER, MAX_CANVAS_TILES_PER_USER } = await import('./limits');

    await pool.query(
      `INSERT INTO canvas_tiles (user_id, id, url, title, kind, status, position)
       SELECT $1, 'seed-' || g, 'https://example.com/', 'seed', 'article', 'active', g FROM generate_series(1, $2::int) g`,
      [userId, MAX_CANVAS_TILES_PER_USER - 1]
    );

    await saveTile(userId, tile('last'));
    await assert.rejects(saveTile(userId, tile('one-too-many')), LimitError);
    await saveTile(userId, { ...tile('last'), title: 'edited', x: 5 });

    const tiles = await listTiles(userId);
    assert.equal(tiles.length, MAX_CANVAS_TILES_PER_USER);
    assert.deepEqual(
      tiles.flatMap((saved) => (saved.id === 'last' ? [[saved.title, saved.x]] : [])),
      [['edited', 5]]
    );

    for (let i = 0; i < MAX_CANVAS_SECTIONS_PER_USER; i += 1) await saveSection(userId, section(`s${i}`));
    await assert.rejects(saveSection(userId, section('one-too-many')), LimitError);
    await saveSection(userId, { ...section('s0'), name: 'renamed' });

    const sections = await listSections(userId);
    assert.equal(sections.length, MAX_CANVAS_SECTIONS_PER_USER);
    assert.equal(sections.find((saved) => saved.id === 's0')?.name, 'renamed');
  });

  it('keeps the newest extension keys and only records use once an hour', async (t) => {
    const userId = await testUser(t);

    if (!userId) return;
    const { pool } = await import('./db');
    const { MAX_EXTENSION_KEYS_PER_USER } = await import('./limits');
    const { createExtensionToken, userIdForExtensionToken } = await import('./extensionTokens');

    const tokens: string[] = [];

    for (let i = 0; i <= MAX_EXTENSION_KEYS_PER_USER; i += 1) {
      tokens.push(await createExtensionToken(userId, 'ahhkdlkaolkopiadpagcjpdddejcdafh'));
      // created_at orders the keys, so give each its own moment.
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const count = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM extension_tokens WHERE user_id = $1', [userId]);
    assert.equal(count.rows[0].n, MAX_EXTENSION_KEYS_PER_USER);
    assert.equal(await userIdForExtensionToken(tokens[0]), null);
    assert.equal(await userIdForExtensionToken(tokens[1]), userId);

    const lastUsed = async () =>
      (await pool.query<{ at: Date }>(
        'SELECT last_used_at AS at FROM extension_tokens WHERE user_id = $1 AND last_used_at IS NOT NULL',
        [userId]
      )).rows[0].at.getTime();

    const first = await lastUsed();
    await userIdForExtensionToken(tokens[1]);
    assert.equal(await lastUsed(), first);

    await pool.query(
      `UPDATE extension_tokens SET last_used_at = now() - interval '2 hours' WHERE user_id = $1 AND last_used_at IS NOT NULL`,
      [userId]
    );
    const stale = await lastUsed();
    await userIdForExtensionToken(tokens[1]);
    assert.ok((await lastUsed()) > stale);
  });
});
