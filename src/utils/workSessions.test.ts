import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Activity } from '../types/activity';
import {
  buildTimelineAxis,
  focusMinutesByHour,
  layoutDayTimeline,
  localDateString,
  loggedMinutesOnDate,
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

describe('day timeline layout', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m);

  it('puts overlapping sessions in separate lanes', () => {
    const acts = [
      activity({ id: 'a', workSessions: [session('s1', at(9), at(10), 60)] }),
      activity({ id: 'b', workSessions: [session('s2', at(9, 30), at(10, 30), 60)] }),
      activity({ id: 'c', workSessions: [session('s3', at(12), at(12, 30), 30)] }),
    ];
    const { blocks } = layoutDayTimeline(acts, '2026-10-15');
    const byId = Object.fromEntries(blocks.map((b) => [b.session.id, b]));
    assert.equal(byId.s1.lanes, 2);
    assert.equal(byId.s2.lanes, 2);
    assert.notEqual(byId.s1.lane, byId.s2.lane);
    assert.equal(byId.s3.lanes, 1);
  });

  it('fits the hour range to logged work, including early mornings', () => {
    const acts = [activity({ id: 'a', workSessions: [session('s1', at(5, 15), at(6), 45)] })];
    const { startHour, endHour } = layoutDayTimeline(acts, '2026-10-15');
    assert.equal(startHour, 4);
    assert.equal(endHour, 7);
  });

  it('keeps a short session in a tight window around it', () => {
    const acts = [activity({ id: 'a', workSessions: [session('s1', at(15, 30), at(15, 32), 2)] })];
    const { startHour, endHour } = layoutDayTimeline(acts, '2026-10-15');
    assert.deepEqual([startHour, endHour], [14, 17]);
  });

  it('defaults to a working-day range when nothing is logged', () => {
    const { blocks, startHour, endHour } = layoutDayTimeline([], '2026-10-15');
    assert.equal(blocks.length, 0);
    assert.deepEqual([startHour, endHour], [8, 18]);
  });
});

describe('adaptive timeline axis', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m);

  it('gives busy hours tall rows and empty hours slim gaps', () => {
    const acts = [activity({ id: 'a', workSessions: [session('s1', at(15, 30), at(15, 32), 2)] })];
    const timeline = layoutDayTimeline(acts, '2026-10-15');
    const axis = buildTimelineAxis(timeline, 120, 28);
    assert.deepEqual([timeline.startHour, timeline.endHour], [14, 17]);
    assert.deepEqual(axis.hourTops, [0, 28, 148, 176]);
    assert.equal(axis.toPx(15 * 60 + 30), 88);
  });

  it('gives short blocks drawn at minimum height their own lane', () => {
    const acts = [
      activity({ id: 'a', workSessions: [session('s1', at(9, 0), at(9, 5), 5)] }),
      activity({ id: 'b', workSessions: [session('s2', at(9, 10), at(9, 20), 10)] }),
    ];
    const plain = layoutDayTimeline(acts, '2026-10-15');
    assert.equal(plain.blocks[0].lanes, 1);
    const padded = layoutDayTimeline(acts, '2026-10-15', 25);
    assert.equal(padded.blocks[0].lanes, 2);
  });
});
