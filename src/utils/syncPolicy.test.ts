import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Activity } from '../types/activity';
import { PersistedDocument } from '../types/document';
import { PullResponse } from '../types/sync';
import {
  applyPull,
  applyPushResult,
  buildPush,
  diffActivities,
  emptyDocument,
  emptySyncMeta,
  hasPending,
  recordLocalEdits,
  seedPendingFromLocal,
  shouldSafetyFlush,
  BACKGROUND_SYNC_INTERVAL_MS,
  SyncMeta,
} from './syncPolicy';

function activity(partial: Partial<Activity> & Pick<Activity, 'id'>): Activity {
  return {
    title: partial.title || partial.id,
    category: 'build',
    priority: 'medium',
    status: 'backlog',
    estimatedMinutes: 30,
    actualMinutes: 0,
    date: '2026-10-15',
    subtasks: [],
    tags: [],
    createdAt: '2026-10-15T10:00:00.000Z',
    ...partial,
  };
}

function doc(overrides: Partial<PersistedDocument>): PersistedDocument {
  return { ...emptyDocument('2026-10-15T12:00:00.000Z'), ...overrides };
}

function meta(overrides: Partial<SyncMeta>): SyncMeta {
  return { ...emptySyncMeta(), initialized: true, ...overrides };
}

function pull(rows: PullResponse['rows'], cursor: number, goal: PullResponse['goal'] = null): PullResponse {
  return { rows, goal, cursor, hasMore: false };
}

describe('safety interval', () => {
  it('fires only after the interval and when wanted', () => {
    assert.equal(shouldSafetyFlush(60_000, 0, true, false), true);
    assert.equal(shouldSafetyFlush(BACKGROUND_SYNC_INTERVAL_MS - 1, 0, true, false), false);
    assert.equal(shouldSafetyFlush(120_000, 0, false, false), false);
    assert.equal(shouldSafetyFlush(120_000, 0, true, true), false);
  });
});

describe('local edit tracking', () => {
  it('reports added, edited and removed tasks but not untouched ones', () => {
    const same = activity({ id: 'same' });
    const prev = [same, activity({ id: 'edit' }), activity({ id: 'gone' })];
    const next = [same, activity({ id: 'edit', title: 'Edited' }), activity({ id: 'new' })];
    assert.deepEqual(diffActivities(prev, next).sort(), ['edit', 'gone', 'new']);
  });

  it('ignores a copy with identical content', () => {
    const a = activity({ id: 'a' });
    assert.deepEqual(diffActivities([a], [{ ...a }]), []);
  });

  it('does not sync UI-only settings', () => {
    const prev = doc({});
    const next = doc({ settings: { muted: true, lastTab: 'analytics', selectedDate: '2026-10-01' } });
    const m = meta({});
    assert.equal(recordLocalEdits(m, prev, next), m);
  });

  it('gives each quick edit a strictly newer marker', () => {
    const now = '2026-10-15T12:00:00.000Z';
    const first = recordLocalEdits(meta({}), doc({}), doc({ activities: [activity({ id: 'a' })] }), now);

    const second = recordLocalEdits(
      first,
      doc({ activities: [activity({ id: 'a' })] }),
      doc({ activities: [activity({ id: 'a', title: 'again' })] }),
      now
    );

    assert.ok(Date.parse(second.pending.a.at) > Date.parse(first.pending.a.at));
  });

  it('pushes deletes as null data with the last seen seq', () => {
    const m = meta({ seqs: { gone: 7 }, pending: { gone: { at: '2026-10-15T12:00:00.000Z' } } });
    const push = buildPush(doc({}), m);
    assert.deepEqual(push?.changes, [
      { id: 'gone', data: null, updatedAt: '2026-10-15T12:00:00.000Z', baseSeq: 7 },
    ]);
  });
});

describe('push results', () => {
  it('clears confirmed edits but keeps ones made while the push was in flight', () => {
    const a = activity({ id: 'a' });
    const b = activity({ id: 'b' });
    const local = doc({ activities: [a, b] });

    const before = meta({
      pending: { a: { at: '2026-10-15T12:00:00.000Z' }, b: { at: '2026-10-15T12:00:00.000Z' } },
    });

    const sent = buildPush(local, before)!;
    const during = { ...before, pending: { ...before.pending, b: { at: '2026-10-15T12:00:01.000Z' } } };

    const result = applyPushResult(local, during, sent, {
      applied: [{ id: 'a', seq: 3 }, { id: 'b', seq: 4 }],
      rejected: [],
      goalApplied: null,
      goalRejected: null,
    });

    assert.deepEqual(Object.keys(result.meta.pending), ['b']);
    assert.equal(result.meta.seqs.a, 3);
    assert.equal(result.meta.seqs.b, 4);
  });

  it('adopts the server copy when the push loses', () => {
    const local = doc({ activities: [activity({ id: 'a', title: 'Mine' })] });
    const m = meta({ pending: { a: { at: '2026-10-15T11:00:00.000Z' } } });
    const sent = buildPush(local, m)!;
    const server = activity({ id: 'a', title: 'Theirs' });

    const result = applyPushResult(local, m, sent, {
      applied: [],
      rejected: [{ id: 'a', data: server, updatedAt: '2026-10-15T11:30:00.000Z', seq: 9 }],
      goalApplied: null,
      goalRejected: null,
    });

    assert.equal(result.doc.activities[0].title, 'Theirs');
    assert.equal(hasPending(result.meta), false);
    assert.equal(result.meta.seqs.a, 9);
  });
});

describe('pull', () => {
  it('applies remote upserts and deletes and advances the cursor', () => {
    const local = doc({ activities: [activity({ id: 'old' }), activity({ id: 'removed' })] });
    const incoming = activity({ id: 'new' });

    const result = applyPull(
      local,
      meta({ cursor: 2, seqs: { removed: 1 } }),
      pull(
        [
          { id: 'new', data: incoming, updatedAt: '2026-10-15T12:00:00.000Z', seq: 3 },
          { id: 'removed', data: null, updatedAt: '2026-10-15T12:00:00.000Z', seq: 4 },
        ],
        4
      )
    );

    assert.deepEqual(result.doc.activities.map((a) => a.id).sort(), ['new', 'old']);
    assert.deepEqual(result.update.deletes, ['removed']);
    assert.equal(result.meta.cursor, 4);
    assert.equal(result.meta.seqs.removed, undefined);
  });

  it('keeps a newer local edit and its old baseSeq so the server compares timestamps', () => {
    const local = doc({ activities: [activity({ id: 'a', title: 'Mine' })] });
    const m = meta({ seqs: { a: 1 }, pending: { a: { at: '2026-10-15T12:00:00.000Z' } } });

    const result = applyPull(
      local,
      m,
      pull([{ id: 'a', data: activity({ id: 'a', title: 'Theirs' }), updatedAt: '2026-10-15T11:00:00.000Z', seq: 5 }], 5)
    );

    assert.equal(result.doc.activities[0].title, 'Mine');
    assert.equal(result.meta.seqs.a, 1);
    assert.ok(result.meta.pending.a);
  });

  it('drops a local edit that a newer remote edit beat', () => {
    const local = doc({ activities: [activity({ id: 'a', title: 'Mine' })] });
    const m = meta({ pending: { a: { at: '2026-10-15T11:00:00.000Z' } } });

    const result = applyPull(
      local,
      m,
      pull([{ id: 'a', data: activity({ id: 'a', title: 'Theirs' }), updatedAt: '2026-10-15T12:00:00.000Z', seq: 5 }], 5)
    );

    assert.equal(result.doc.activities[0].title, 'Theirs');
    assert.equal(hasPending(result.meta), false);
  });

  it('treats its own tab-close beacon coming back as confirmed', () => {
    const mine = activity({ id: 'a', title: 'Mine' });
    const local = doc({ activities: [mine] });
    const m = meta({ pending: { a: { at: '2026-10-15T12:00:00.000Z' } } });
    const result = applyPull(local, m, pull([{ id: 'a', data: mine, updatedAt: '2026-10-15T12:00:00.000Z', seq: 6 }], 6));
    assert.equal(hasPending(result.meta), false);
    assert.equal(result.meta.seqs.a, 6);
    assert.equal(result.doc, local);
  });

  it('takes a newer remote daily goal', () => {
    const result = applyPull(
      doc({ dailyGoalMinutes: 360 }),
      meta({}),
      pull([], 2, { dailyGoalMinutes: 240, updatedAt: '2026-10-15T12:00:00.000Z', seq: 2 })
    );

    assert.equal(result.doc.dailyGoalMinutes, 240);
    assert.equal(result.update.dailyGoalMinutes, 240);
  });
});

describe('first sync on a device', () => {
  it('merges local tasks with the server copy by timestamp', () => {
    const local = doc({
      activities: [
        activity({ id: 'local-newer', title: 'Local', updatedAt: '2026-10-15T13:00:00.000Z' }),
        activity({ id: 'server-newer', title: 'Local', updatedAt: '2026-10-15T09:00:00.000Z' }),
        activity({ id: 'only-local', updatedAt: '2026-10-15T09:00:00.000Z' }),
      ],
    });

    const seeded = seedPendingFromLocal(local, meta({}));

    const result = applyPull(
      local,
      seeded,
      pull(
        [
          { id: 'local-newer', data: activity({ id: 'local-newer', title: 'Server' }), updatedAt: '2026-10-15T12:00:00.000Z', seq: 1 },
          { id: 'server-newer', data: activity({ id: 'server-newer', title: 'Server' }), updatedAt: '2026-10-15T12:00:00.000Z', seq: 2 },
          { id: 'only-server', data: activity({ id: 'only-server' }), updatedAt: '2026-10-15T12:00:00.000Z', seq: 3 },
        ],
        3
      )
    );

    const byId = new Map(result.doc.activities.map((a) => [a.id, a.title]));
    assert.equal(byId.get('local-newer'), 'Local');
    assert.equal(byId.get('server-newer'), 'Server');
    assert.ok(byId.has('only-local'));
    assert.ok(byId.has('only-server'));
    assert.deepEqual(Object.keys(result.meta.pending).sort(), ['local-newer', 'only-local']);
  });
});
