import assert from 'node:assert/strict';
import test from 'node:test';
import { STARTER_ACTIVITY_ID } from './localDocument';
import { countGuestTasks, guestAtLimit, shouldNudgeGuest } from './guestLimits';

function tasks(n: number, withStarter = false): { id: string }[] {
  const list = Array.from({ length: n }, (_, i) => ({ id: `t${i}` }));

  return withStarter ? [{ id: STARTER_ACTIVITY_ID }, ...list] : list;
}

test('the starter task is not counted', () => {
  assert.equal(countGuestTasks(tasks(2, true)), 2);
});

test('nudge shows from 3 tasks until the limit, unless dismissed', () => {
  assert.equal(shouldNudgeGuest(tasks(2, true), false), false);
  assert.equal(shouldNudgeGuest(tasks(3), false), true);
  assert.equal(shouldNudgeGuest(tasks(5), false), true);
  assert.equal(shouldNudgeGuest(tasks(4), true), false);
  assert.equal(shouldNudgeGuest(tasks(6), false), false);
});

test('the wall starts at 6 tasks', () => {
  assert.equal(guestAtLimit(tasks(5, true)), false);
  assert.equal(guestAtLimit(tasks(6)), true);
});
