import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Activity, goalNames, normalizeActivity } from './activity';

const task = (overrides: Record<string, unknown>) =>
  ({ id: 'a', title: 'A', category: 'build', status: 'backlog', ...overrides }) as unknown as Activity;

describe('normalizeActivity', () => {
  it('maps the old categories to Build and Learn', () => {
    assert.equal(normalizeActivity(task({ category: 'learning' })).category, 'learn');
    for (const old of ['deep_work', 'health_fitness', 'creative', 'admin_meetings', 'personal']) {
      assert.equal(normalizeActivity(task({ category: old })).category, 'build');
    }
  });

  it('moves the old Review column to Doing', () => {
    assert.equal(normalizeActivity(task({ status: 'review' })).status, 'in_progress');
  });

  it('returns the same object when nothing changes', () => {
    const current = task({ category: 'learn', status: 'completed' });
    assert.equal(normalizeActivity(current), current);
  });
});

describe('goalNames', () => {
  it('lists each goal once, most used first', () => {
    const tasks = [task({ goal: 'b' }), task({ goal: 'a' }), task({ goal: 'a' }), task({})];
    assert.deepEqual(goalNames(tasks), ['a', 'b']);
  });
});
