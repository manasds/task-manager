import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Activity } from '../../types/activity';
import {
  addableTo,
  addToDay,
  calendarItems,
  canRemoveFromDay,
  moveToSlot,
  showsPlannedOn,
  unscheduledOn,
} from './activities';

const TODAY = '2026-10-23';

function activity(partial: Partial<Activity> & Pick<Activity, 'id'>): Activity {
  return {
    title: partial.id,
    category: 'build',
    priority: 'medium',
    status: 'backlog',
    estimatedMinutes: 60,
    actualMinutes: 0,
    date: TODAY,
    subtasks: [],
    tags: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    ...partial,
  };
}

describe('showsPlannedOn', () => {
  it('shows an open carried-over task on its start day and today, not every day between', () => {
    const a = activity({ id: 'a', date: '2026-10-20', scheduledTime: '09:00' });
    assert.equal(showsPlannedOn(a, '2026-10-20', TODAY), true);
    assert.equal(showsPlannedOn(a, '2026-10-21', TODAY), false);
    assert.equal(showsPlannedOn(a, TODAY, TODAY), true);
    assert.equal(showsPlannedOn(a, '2026-10-24', TODAY), false);
  });

  it('shows extra planned days and skips parked or untimed tasks', () => {
    const a = activity({ id: 'a', scheduledTime: '09:00', plannedDates: ['2026-10-25'] });
    assert.equal(showsPlannedOn(a, '2026-10-25', TODAY), true);
    assert.equal(showsPlannedOn({ ...a, status: 'parked' }, TODAY, TODAY), false);
    assert.equal(showsPlannedOn({ ...a, scheduledTime: undefined }, TODAY, TODAY), false);
  });

  it('does not carry a finished task to today', () => {
    const a = activity({
      id: 'a',
      date: '2026-10-20',
      scheduledTime: '09:00',
      status: 'completed',
      completedAt: new Date(2026, 9, 20, 12).toISOString(),
    });

    assert.equal(showsPlannedOn(a, '2026-10-20', TODAY), true);
    assert.equal(showsPlannedOn(a, TODAY, TODAY), false);
  });
});

describe('calendarItems', () => {
  it('builds planned blocks from scheduledTime + estimate and logged blocks from sessions', () => {
    const start = new Date(2026, 9, 23, 14, 0);
    const end = new Date(2026, 9, 23, 14, 50);

    const a = activity({
      id: 'a',
      scheduledTime: '10:30',
      estimatedMinutes: 0,
      subtasks: [
        { id: 's1', title: 'x', completed: true },
        { id: 's2', title: 'y', completed: false },
      ],
      workSessions: [{ id: 'w1', activityId: 'a', start: start.toISOString(), end: end.toISOString(), minutes: 50 }],
    });

    const items = calendarItems([a], ['2026-10-22', TODAY], TODAY);
    assert.equal(items.length, 2);
    const planned = items.find((i) => i.kind === 'planned');
    const logged = items.find((i) => i.kind === 'logged');
    assert.equal(planned?.start.getHours(), 10);
    assert.equal(planned?.start.getMinutes(), 30);
    assert.equal(planned && (planned.end.getTime() - planned.start.getTime()) / 60_000, 30);
    assert.deepEqual(planned?.checklist, { done: 1, total: 2 });
    assert.equal(logged?.start.getTime(), start.getTime());
    assert.equal(logged?.id, `w1@${TODAY}`);
  });
});

describe('queue and adding', () => {
  it('lists untimed tasks on the day as the unscheduled queue', () => {
    const a = activity({ id: 'a' });
    const b = activity({ id: 'b', scheduledTime: '09:00' });
    const later = activity({ id: 'c', date: '2026-10-30' });
    assert.deepEqual(unscheduledOn([a, b, later], TODAY).map((i) => i.id), ['a']);
    assert.deepEqual(addableTo([a, b, later], TODAY, TODAY).map((i) => i.id), ['c']);
  });

  it('offers an open timed task for a later day it is not drawn on, then draws it there', () => {
    const a = activity({ id: 'a', date: '2026-10-19', scheduledTime: '09:00' });
    assert.deepEqual(addableTo([a], '2026-10-24', TODAY).map((i) => i.id), ['a']);
    assert.deepEqual(addableTo([a], TODAY, TODAY), []);
    assert.equal(showsPlannedOn(addToDay(a, '2026-10-24'), '2026-10-24', TODAY), true);
  });

  it('adds a day once and only removes extra planned days', () => {
    const a = activity({ id: 'a', date: '2026-10-20' });
    const added = addToDay(addToDay(a, '2026-10-25'), '2026-10-25');
    assert.deepEqual(added.plannedDates, ['2026-10-25']);
    assert.equal(addToDay(a, '2026-10-20'), a);
    assert.equal(canRemoveFromDay(added, '2026-10-25', TODAY), true);
    assert.equal(canRemoveFromDay(added, '2026-10-20', TODAY), false);
    assert.equal(canRemoveFromDay(addToDay(a, TODAY), TODAY, TODAY), false);
  });
});

describe('moveToSlot', () => {
  it('only changes the time within the same day', () => {
    const a = activity({ id: 'a', scheduledTime: '09:00' });
    const { activity: next, note } = moveToSlot(a, TODAY, TODAY, '15:30', TODAY);
    assert.equal(next.scheduledTime, '15:30');
    assert.equal(next.date, TODAY);
    assert.equal(next.plannedDates, undefined);
    assert.equal(note, undefined);
  });

  it('moves the start date when dragged off its start day', () => {
    const a = activity({ id: 'a', date: '2026-10-25', scheduledTime: '09:00' });
    const { activity: next, note } = moveToSlot(a, '2026-10-25', '2026-10-27', '11:00', TODAY);
    assert.equal(next.date, '2026-10-27');
    assert.equal(showsPlannedOn(next, '2026-10-25', TODAY), false);
    assert.equal(showsPlannedOn(next, '2026-10-27', TODAY), true);
    assert.equal(note, undefined);
  });

  it('moves an extra planned day instead of copying it', () => {
    const a = activity({ id: 'a', date: '2026-10-20', status: 'completed', completedAt: new Date(2026, 9, 26).toISOString(), scheduledTime: '09:00', plannedDates: ['2026-10-25'] });
    const { activity: next } = moveToSlot(a, '2026-10-25', '2026-10-26', '09:00', TODAY);
    assert.deepEqual(next.plannedDates, ['2026-10-26']);
    assert.equal(next.date, '2026-10-20');
  });

  it('keeps a carried-over open task on today and says so', () => {
    const a = activity({ id: 'a', date: '2026-10-20', scheduledTime: '09:00' });
    const { activity: next, note } = moveToSlot(a, TODAY, '2026-10-24', '09:00', TODAY);
    assert.equal(next.date, '2026-10-20');
    assert.deepEqual(next.plannedDates, ['2026-10-24']);
    assert.equal(showsPlannedOn(next, TODAY, TODAY), true);
    assert.match(note ?? '', /stay on today/);
  });

  it('moves a queued task off its start day like a block', () => {
    const a = activity({ id: 'a' });
    const { activity: next, note } = moveToSlot(a, TODAY, '2026-10-24', '13:00', TODAY);
    assert.equal(next.date, '2026-10-24');
    assert.equal(showsPlannedOn(next, TODAY, TODAY), false);
    assert.equal(note, undefined);
  });

  it('plans a carried-over queued task on the drop day without touching its start date', () => {
    const a = activity({ id: 'a', date: '2026-10-20' });
    const { activity: next } = moveToSlot(a, TODAY, '2026-10-24', '13:00', TODAY);
    assert.equal(next.date, '2026-10-20');
    assert.equal(next.scheduledTime, '13:00');
    assert.equal(showsPlannedOn(next, '2026-10-24', TODAY), true);
  });
});

describe('layoutDay', () => {
  it('puts short back-to-back blocks in separate lanes so their drawn cards do not cover each other', async () => {
    const { layoutDay } = await import('./layout');

    const item = (id: string, h: number, m: number, minutes: number) => {
      const start = new Date(2026, 9, 23, h, m);

      return {
        id,
        activityId: id,
        day: TODAY,
        title: id,
        type: 'build' as const,
        priority: 'medium' as const,
        kind: 'logged' as const,
        start,
        end: new Date(start.getTime() + minutes * 60_000),
        completed: false,
      };
    };

    const laid = layoutDay([item('a', 10, 0, 10), item('b', 10, 10, 10), item('c', 12, 0, 60)]);
    const byId = Object.fromEntries(laid.map((p) => [p.item.id, p]));
    assert.equal(byId.a.columns, 2);
    assert.notEqual(byId.a.column, byId.b.column);
    assert.equal(byId.c.columns, 1);
    // Before 07:00 is pinned to the top without overlapping a 07:00 block's lane.
    const early = layoutDay([item('x', 5, 0, 60), item('y', 7, 0, 60)]);
    const ex = Object.fromEntries(early.map((p) => [p.item.id, p]));
    assert.equal(ex.x.top, 0);
    assert.notEqual(ex.x.column, ex.y.column);
  });
});
