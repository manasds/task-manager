import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Activity } from '../types/activity';
import {
  createManualSession,
  timerElapsedSeconds,
  focusMinutesByHour,
  isActivityOnDate,
  localDateString,
  loggedMinutesOnDate,
  minutesByDay,
  sessionDate,
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

describe('real day stats', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m);

  it('counts logged minutes by the day the work happened', () => {
    const acts = [
      activity({
        id: 'a',
        date: '2026-10-14',
        actualMinutes: 50,
        workSessions: [session('s1', at(9), at(9, 50), 50)],
      }),
      activity({ id: 'b', actualMinutes: 15 }),
    ];
    assert.equal(loggedMinutesOnDate(acts, '2026-10-15'), 65);
    assert.equal(loggedMinutesOnDate(acts, '2026-10-14'), 0);
  });

  it('splits session minutes across local hours', () => {
    const acts = [
      activity({ id: 'a', workSessions: [session('s1', at(9, 30), at(11, 0), 90)] }),
    ];
    const byHour = focusMinutesByHour(acts, ['2026-10-15']);
    assert.equal(byHour[9], 30);
    assert.equal(byHour[10], 60);
    assert.equal(byHour.reduce((a, b) => a + b, 0), 90);
  });
});

describe('focus timer elapsed time', () => {
  it('adds the running stretch to banked seconds', () => {
    const startedAt = '2026-10-15T10:00:00.000Z';
    const now = Date.parse('2026-10-15T10:02:30.000Z');
    assert.equal(timerElapsedSeconds({ activityId: 'a', secondsElapsed: 60, isRunning: true, startedAt }, now), 210);
    assert.equal(timerElapsedSeconds({ activityId: 'a', secondsElapsed: 60, isRunning: false }, now), 60);
  });
});

describe('manual time entries', () => {
  it('counts a hand-logged session on its local date like a timer session', () => {
    const ws = createManualSession('a', '2026-10-15', '14:30', 15);
    assert.equal(ws.start, new Date(2026, 9, 15, 14, 30).toISOString());
    assert.equal(ws.end, new Date(2026, 9, 15, 14, 45).toISOString());
    assert.equal(sessionDate(ws), '2026-10-15');

    const acts = [activity({ id: 'a', date: '2026-10-10', actualMinutes: 15, workSessions: [ws] })];
    assert.equal(loggedMinutesOnDate(acts, '2026-10-15'), 15);
    assert.equal(loggedMinutesOnDate(acts, '2026-10-10'), 0);
    assert.equal(focusMinutesByHour(acts, ['2026-10-15'])[14], 15);
  });
});

describe('isActivityOnDate', () => {
  const base = {
    id: 'a1',
    date: '2026-10-13',
    status: 'in_progress',
    actualMinutes: 0,
  } as Activity;

  it('is false before the task date', () => {
    assert.equal(isActivityOnDate(base, '2026-10-12'), false);
  });

  it('carries unfinished tasks onto later and future days', () => {
    assert.equal(isActivityOnDate(base, '2026-10-13'), true);
    assert.equal(isActivityOnDate(base, '2026-10-20'), true);
    assert.equal(isActivityOnDate(base, '2027-01-01'), true);
  });

  it('stops at the completion day once completed', () => {
    const done = { ...base, status: 'completed', completedAt: new Date(2026, 9, 15, 12).toISOString() } as Activity;
    assert.equal(isActivityOnDate(done, '2026-10-14'), true);
    assert.equal(isActivityOnDate(done, '2026-10-15'), true);
    assert.equal(isActivityOnDate(done, '2026-10-16'), false);
  });

  it('also shows on extra planned days, even before its start', () => {
    const planned = { ...base, plannedDates: ['2026-10-10'] } as Activity;
    assert.equal(isActivityOnDate(planned, '2026-10-10'), true);
    assert.equal(isActivityOnDate(planned, '2026-10-11'), false);
  });

  it('is on no day while parked', () => {
    const parked = { ...base, status: 'parked', plannedDates: ['2026-10-13'] } as Activity;
    assert.equal(isActivityOnDate(parked, '2026-10-13'), false);
    assert.equal(isActivityOnDate(parked, '2026-10-20'), false);
  });

  it('falls back to its own date when completed without completedAt', () => {
    const done = { ...base, status: 'completed' } as Activity;
    assert.equal(isActivityOnDate(done, '2026-10-13'), true);
    assert.equal(isActivityOnDate(done, '2026-10-14'), false);
  });
});

describe('minutesByDay', () => {
  it('sums session minutes per local day, newest first', () => {
    const at = (d: number, h: number) => new Date(2026, 9, d, h);
    const activity = {
      workSessions: [
        session('s1', at(13, 9), at(13, 10), 60),
        session('s2', at(15, 9), at(15, 9), 30),
        session('s3', at(15, 14), at(15, 14), 40),
      ],
    } as Activity;
    assert.deepEqual(minutesByDay(activity), [
      { date: '2026-10-15', minutes: 70 },
      { date: '2026-10-13', minutes: 60 },
    ]);
    assert.deepEqual(minutesByDay({} as Activity), []);
  });
});
