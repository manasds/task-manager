import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tabToOpen } from './document';

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
