import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Activity } from '../types/activity';
import { PersistedDocument } from '../types/document';
import {
  emptyDocument,
  isLikelyDemoDocument,
  mergeDocuments,
  resolveBootDocument,
  shouldFlushOnSessionEnd,
  shouldSafetyFlush,
  SAFETY_FLUSH_MS,
} from './syncPolicy';

function activity(partial: Partial<Activity> & Pick<Activity, 'id'>): Activity {
  return {
    title: partial.title || partial.id,
    category: 'deep_work',
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

describe('session flush policy', () => {
  it('does not flush while the tab is visible or clean', () => {
    assert.equal(shouldFlushOnSessionEnd(false, true, false), false);
    assert.equal(shouldFlushOnSessionEnd(true, false, false), false);
    assert.equal(shouldFlushOnSessionEnd(true, true, true), false);
  });

  it('flushes a dirty document when the session ends', () => {
    assert.equal(shouldFlushOnSessionEnd(true, true, false), true);
  });

  it('safety-flushes only after the interval while dirty', () => {
    assert.equal(shouldSafetyFlush(60_000, 0, true, false), true);
    assert.equal(shouldSafetyFlush(SAFETY_FLUSH_MS - 1, 0, true, false), false);
    assert.equal(shouldSafetyFlush(120_000, 0, false, false), false);
    assert.equal(shouldSafetyFlush(120_000, 0, true, true), false);
  });
});

describe('document merge', () => {
  it('keeps the newer activity and honors deletes from either side', () => {
    const local = doc({
      updatedAt: '2026-10-15T13:00:00.000Z',
      dailyGoalMinutes: 240,
      deletedIds: ['gone'],
      activities: [
        activity({ id: 'a', title: 'Local newer', updatedAt: '2026-10-15T13:00:00.000Z' }),
        activity({ id: 'b', title: 'Only local', updatedAt: '2026-10-15T12:30:00.000Z' }),
        activity({ id: 'gone', title: 'Should drop' }),
      ],
    });
    const server = doc({
      updatedAt: '2026-10-15T12:00:00.000Z',
      dailyGoalMinutes: 360,
      deletedIds: [],
      activities: [
        activity({ id: 'a', title: 'Server older', updatedAt: '2026-10-15T11:00:00.000Z' }),
        activity({ id: 'c', title: 'Only server', updatedAt: '2026-10-15T11:30:00.000Z' }),
        activity({ id: 'gone', title: 'Server still has it' }),
      ],
    });

    const merged = mergeDocuments(local, server);
    const titles = merged.activities.map((a) => a.title).sort();
    assert.deepEqual(titles, ['Local newer', 'Only local', 'Only server']);
    assert.equal(merged.deletedIds.includes('gone'), true);
    assert.equal(merged.dailyGoalMinutes, 240);
  });

  it('treats seeded act-* boards as demo data', () => {
    const demo = doc({
      activities: [activity({ id: 'act-1' }), activity({ id: 'act-hist-2' })],
    });
    assert.equal(isLikelyDemoDocument(demo), true);
    assert.equal(isLikelyDemoDocument(emptyDocument()), false);
  });
});

describe('boot document resolution', () => {
  const server = {
    revision: 5,
    document: doc({
      activities: [activity({ id: 'beaconed', updatedAt: '2026-10-15T11:00:00.000Z' })],
    }),
  };

  it('keeps edits made after a beacon whose new revision was never seen', () => {
    const local = doc({
      activities: [
        activity({ id: 'beaconed', updatedAt: '2026-10-15T11:00:00.000Z' }),
        activity({ id: 'after-beacon', updatedAt: '2026-10-15T11:05:00.000Z' }),
      ],
    });
    const resolved = resolveBootDocument(local, 4, true, server);
    assert.equal(resolved.dirty, true);
    assert.deepEqual(resolved.document.activities.map((a) => a.id).sort(), ['after-beacon', 'beaconed']);
  });

  it('re-flushes unconfirmed edits even when the revision still matches', () => {
    const local = doc({ activities: [activity({ id: 'offline-edit' })] });
    const resolved = resolveBootDocument(local, 5, true, server);
    assert.equal(resolved.dirty, true);
    assert.equal(resolved.document, local);
  });

  it('takes the server copy when local is clean and behind', () => {
    const local = doc({ activities: [activity({ id: 'old' })] });
    const resolved = resolveBootDocument(local, 3, false, server);
    assert.equal(resolved.dirty, false);
    assert.equal(resolved.document, server.document);
  });
});
