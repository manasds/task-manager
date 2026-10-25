import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tabToOpen } from './document';
import { isValidDocument } from '../utils/syncPolicy';

describe('persisted document compatibility', () => {
  it('accepts saved documents that still carry the removed muted setting', () => {
    const legacy = {
      schemaVersion: 2,
      dailyGoalMinutes: 360,
      settings: { muted: true, lastTab: 'board' },
      activities: [],
      updatedAt: '2026-10-15T12:00:00.000Z',
    };

    assert.equal(isValidDocument(legacy), true);
  });
});

describe('tabToOpen', () => {
  it('opens the Calendar for the removed Planner and Activity tabs', () => {
    assert.equal(tabToOpen('planner'), 'calendar');
    assert.equal(tabToOpen('activity'), 'calendar');
  });

  it('keeps known tabs and falls back to the board for anything else', () => {
    assert.equal(tabToOpen('calendar'), 'calendar');
    assert.equal(tabToOpen('analytics'), 'analytics');
    assert.equal(tabToOpen('something-new'), 'board');
    assert.equal(tabToOpen(undefined), 'board');
  });
});
