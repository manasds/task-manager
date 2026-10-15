import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Activity } from '../types/activity';
import {
  localDateString,
  parseLocalDate,
  sessionBlockStyleForDate,
  sessionDate,
  sessionMinutesOnDate,
  sessionOnLocalDate,
  taskStatsForDate,
} from './workSessions';

function session(
  id: string,
  start: Date,
  end: Date,
  minutes: number
) {
  return {
    id,
    activityId: 'a1',
    start: start.toISOString(),
    end: end.toISOString(),
    minutes,
  };
}

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

describe('local session dates', () => {
  it('sessionDate uses the local calendar date, not the UTC date prefix', () => {
    const localTwoAm = new Date(2026, 9, 15, 2, 0, 0);
    assert.equal(localDateString(localTwoAm), '2026-10-15');

    const utcPrefix = localTwoAm.toISOString().split('T')[0];
    assert.notEqual(utcPrefix, '2026-10-15');

    const ws = session('s1', localTwoAm, new Date(2026, 9, 15, 3, 0, 0), 60);
    assert.equal(sessionDate(ws), '2026-10-15');
  });
});

describe('session block layout', () => {
  it('clips cross-midnight sessions to each local day with positive height', () => {
    const day1 = '2026-10-15';
    const day2 = '2026-10-16';
    const ws = session(
      's-midnight',
      new Date(2026, 9, 15, 23, 0, 0),
      new Date(2026, 9, 16, 1, 0, 0),
      120
    );

    assert.equal(sessionOnLocalDate(ws, day1), true);
    assert.equal(sessionOnLocalDate(ws, day2), true);
    assert.equal(sessionMinutesOnDate(ws, day1), 60);
    assert.equal(sessionMinutesOnDate(ws, day2), 60);

    const blockDay1 = sessionBlockStyleForDate(ws, day1, 48);
    const blockDay2 = sessionBlockStyleForDate(ws, day2, 48);

    assert.ok(blockDay1);
    assert.ok(blockDay2);
    assert.ok(blockDay1!.height > 0);
    assert.ok(blockDay2!.height > 0);
    assert.ok(blockDay1!.top >= 0);
    assert.ok(blockDay2!.top >= 0);
    assert.equal(blockDay1!.clippedEnd, true);
    assert.equal(blockDay2!.clippedStart, true);
  });

  it('shows early-morning work pinned inside the grid with clip flags', () => {
    const date = '2026-10-15';
    const ws = session(
      's-early',
      new Date(2026, 9, 15, 2, 0, 0),
      new Date(2026, 9, 15, 3, 30, 0),
      90
    );

    const block = sessionBlockStyleForDate(ws, date, 48);
    assert.ok(block);
    assert.ok(block!.height > 0);
    assert.ok(block!.top >= 0);
    assert.equal(block!.clippedStart, true);
    assert.equal(block!.clippedEnd, true);
  });

  it('shows late-night work pinned inside the grid with clip flags', () => {
    const date = '2026-10-15';
    const ws = session(
      's-late',
      new Date(2026, 9, 15, 23, 30, 0),
      new Date(2026, 9, 16, 0, 15, 0),
      45
    );

    const block = sessionBlockStyleForDate(ws, date, 48);
    assert.ok(block);
    assert.ok(block!.height > 0);
    assert.equal(block!.clippedEnd, true);
  });
});

describe('task stats untimed minutes', () => {
  it('counts untimed minutes only on activity.date, not on session days', () => {
    const scheduledDate = '2026-10-14';
    const sessionDay = '2026-10-15';
    const act = activity({
      id: 'a1',
      date: scheduledDate,
      actualMinutes: 100,
      workSessions: [
        session(
          's1',
          new Date(2026, 9, 15, 10, 0, 0),
          new Date(2026, 9, 15, 11, 0, 0),
          60
        ),
      ],
    });

    const onScheduledDay = taskStatsForDate([act], scheduledDate);
    assert.equal(onScheduledDay.length, 1);
    assert.equal(onScheduledDay[0].untimedMinutes, 40);
    assert.equal(onScheduledDay[0].timedMinutes, 0);

    const onSessionDay = taskStatsForDate([act], sessionDay);
    assert.equal(onSessionDay.length, 1);
    assert.equal(onSessionDay[0].untimedMinutes, 0);
    assert.equal(onSessionDay[0].timedMinutes, 60);
  });
});
