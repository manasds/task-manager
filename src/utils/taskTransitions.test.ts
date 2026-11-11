import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Activity, WorkSession } from '../types/activity';
import { finishesTask, mergeTaskEdit, moveToStatus } from './taskTransitions';

const NOW = '2026-11-07T12:00:00.000Z';

function task(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'a',
    title: 'Write',
    category: 'build',
    priority: 'medium',
    status: 'backlog',
    estimatedMinutes: 30,
    actualMinutes: 0,
    date: '2026-11-07',
    subtasks: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function session(id: string, start: string, minutes = 10): WorkSession {
  return { id, activityId: 'a', start, end: start, minutes };
}

test('moving to the same status keeps the finish time', () => {
  const done = task({ status: 'completed', completedAt: '2026-11-01T09:00:00.000Z' });
  assert.equal(moveToStatus(done, 'completed', NOW), done);
});

test('moving to Done stamps the finish time and moving away clears it', () => {
  const done = moveToStatus(task(), 'completed', NOW);
  assert.equal(done.completedAt, NOW);
  assert.equal(moveToStatus(done, 'in_progress', NOW).completedAt, undefined);
});

test('only the move into Done finishes a task', () => {
  const done = task({ status: 'completed' });
  assert.equal(finishesTask(task(), done), true);
  assert.equal(finishesTask(done, done), false);
  assert.equal(finishesTask(undefined, done), false);
});

test('a field the form left alone keeps the newer value', () => {
  const snapshot = task({ title: 'Old' });
  const latest = task({ title: 'From other device' });
  const edited = task({ title: 'Old', priority: 'urgent' });
  const merged = mergeTaskEdit(snapshot, edited, latest);
  assert.equal(merged.title, 'From other device');
  assert.equal(merged.priority, 'urgent');
});

test('a field the form changed wins over the newer value', () => {
  const merged = mergeTaskEdit(task({ title: 'Old' }), task({ title: 'Mine' }), task({ title: 'Theirs' }));
  assert.equal(merged.title, 'Mine');
});

test('time logged elsewhere survives, and form changes to sessions still apply', () => {
  const kept = session('kept', '2026-11-07T08:00:00.000Z');
  const dropped = session('dropped', '2026-11-07T09:00:00.000Z');
  const remote = session('remote', '2026-11-07T10:00:00.000Z');
  const added = session('added', '2026-11-07T11:00:00.000Z');
  const snapshot = task({ workSessions: [kept, dropped], actualMinutes: 20 });
  const edited = task({ workSessions: [kept, added], actualMinutes: 20 });
  const latest = task({ workSessions: [kept, dropped, remote], actualMinutes: 30 });
  const merged = mergeTaskEdit(snapshot, edited, latest);
  assert.deepEqual(merged.workSessions?.map((s) => s.id), ['kept', 'remote', 'added']);
  assert.equal(merged.actualMinutes, 30);
});

test('status and finish time always come from the same side', () => {
  const remoteDone = task({ status: 'completed', completedAt: NOW });
  const untouched = mergeTaskEdit(task(), task({ title: 'Mine' }), remoteDone);
  assert.equal(untouched.status, 'completed');
  assert.equal(untouched.completedAt, NOW);
  const changed = mergeTaskEdit(task(), task({ status: 'parked' }), remoteDone);
  assert.equal(changed.status, 'parked');
  assert.equal(changed.completedAt, undefined);
});
