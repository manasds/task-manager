import { Activity, WorkSession } from '../types/activity';
import { FocusTimerSnapshot } from '../types/document';

export const TIMELINE_START_MINUTES = 7 * 60;
export const TIMELINE_END_MINUTES = 23 * 60;

/** Local calendar date YYYY-MM-DD (matches getTodayDateString). */
export function localDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** Midnight at the start of a local calendar date. */
export function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function createWorkSession(activityId: string, minutes: number): WorkSession {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);

  return {
    id: crypto.randomUUID(),
    activityId,
    start: start.toISOString(),
    end: end.toISOString(),
    minutes,
  };
}

/** A session logged by hand: `minutes` of work starting at local `date` + `time` ('HH:MM'). */
export function createManualSession(
  activityId: string,
  date: string,
  time: string,
  minutes: number
): WorkSession {
  const [hours, mins] = time.split(':').map(Number);
  const start = parseLocalDate(date);
  start.setHours(hours || 0, mins || 0, 0, 0);
  const end = new Date(start.getTime() + minutes * 60 * 1000);

  return {
    id: crypto.randomUUID(),
    activityId,
    start: start.toISOString(),
    end: end.toISOString(),
    minutes,
  };
}

export function sessionDate(session: WorkSession): string {
  return localDateString(new Date(session.start));
}

export function sessionEndDate(session: WorkSession): string {
  return localDateString(new Date(session.end));
}

export function sessionOnLocalDate(session: WorkSession, date: string): boolean {
  const startDate = sessionDate(session);
  const endDate = sessionEndDate(session);

  return startDate === date || endDate === date;
}

export function clipSessionToDate(
  session: WorkSession,
  date: string
): { start: Date; end: Date } | null {
  const dayStart = parseLocalDate(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const sessionStart = new Date(session.start);
  const sessionEnd = new Date(session.end);
  const visibleStart = new Date(Math.max(sessionStart.getTime(), dayStart.getTime()));
  const visibleEnd = new Date(Math.min(sessionEnd.getTime(), dayEnd.getTime()));

  if (visibleEnd.getTime() <= visibleStart.getTime()) return null;

  return { start: visibleStart, end: visibleEnd };
}

export function sessionsOnDate(activity: Activity, date: string): WorkSession[] {
  return (activity.workSessions ?? []).filter((s) => sessionOnLocalDate(s, date));
}

export function sessionMinutesOnDate(session: WorkSession, date: string): number {
  const clipped = clipSessionToDate(session, date);

  if (!clipped) return 0;

  return Math.round((clipped.end.getTime() - clipped.start.getTime()) / 60_000);
}

export function totalSessionMinutes(sessions: WorkSession[]): number {
  return sessions.reduce((sum, s) => sum + s.minutes, 0);
}

export function timedMinutesOnDate(sessions: WorkSession[], date: string): number {
  return sessions.reduce((sum, s) => sum + sessionMinutesOnDate(s, date), 0);
}

export function allSessionMinutes(activity: Activity): number {
  return totalSessionMinutes(activity.workSessions ?? []);
}

export function untimedMinutes(activity: Activity): number {
  return Math.max(0, (activity.actualMinutes || 0) - allSessionMinutes(activity));
}

/** Logged minutes per local day (newest first), from timed sessions only. */
export function minutesByDay(activity: Pick<Activity, 'workSessions'>): { date: string; minutes: number }[] {
  const byDay = new Map<string, number>();

  for (const s of activity.workSessions ?? []) {
    const day = sessionDate(s);
    byDay.set(day, (byDay.get(day) ?? 0) + s.minutes);
  }

  return [...byDay.entries()]
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Whether a task belongs on `date`: any day it was planned for, plus from its start day onward
 * while unfinished (up to the day it was completed once done). Parked tasks belong nowhere.
 */
export function isActivityOnDate(activity: Activity, date: string): boolean {
  if (activity.status === 'parked') return false;

  if (activity.plannedDates?.includes(date)) return true;

  if (date < activity.date) return false;

  if (activity.status !== 'completed') return true;

  const completedDay = activity.completedAt
    ? localDateString(new Date(activity.completedAt))
    : activity.date;

  // Finished before its own date (done early): it still belongs on that date.
  return date <= completedDay || date === activity.date;
}

export interface TaskDayStats {
  activity: Activity;
  timedMinutes: number;
  untimedMinutes: number;
  totalMinutes: number;
}

export function taskStatsForDate(activities: Activity[], date: string): TaskDayStats[] {
  const stats: TaskDayStats[] = [];

  for (const activity of activities) {
    const daySessions = sessionsOnDate(activity, date);
    const timedMinutes = timedMinutesOnDate(daySessions, date);
    const untimed = activity.date === date ? untimedMinutes(activity) : 0;
    const totalMinutes = timedMinutes + untimed;

    if (totalMinutes > 0) {
      stats.push({ activity, timedMinutes, untimedMinutes: untimed, totalMinutes });
    }
  }

  return stats.sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function minutesFromDayStart(d: Date, dayStart: Date): number {
  return (d.getTime() - dayStart.getTime()) / 60_000;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h === 0) return `${m}m`;

  if (m === 0) return `${h}h`;

  return `${h}h ${m}m`;
}

/** Minutes logged on a local date: timed sessions plus untimed minutes on the task's own date. */
export function loggedMinutesOnDate(activities: Activity[], date: string): number {
  return taskStatsForDate(activities, date).reduce((sum, t) => sum + t.totalMinutes, 0);
}

/** Timed minutes per local hour of day (index 0-23), summed across the given dates. */
export function focusMinutesByHour(activities: Activity[], dates: string[]): number[] {
  const buckets = Array.from({ length: 24 }, () => 0);

  for (const date of dates) {
    const dayStart = parseLocalDate(date);

    for (const activity of activities) {
      for (const session of activity.workSessions ?? []) {
        const clipped = clipSessionToDate(session, date);

        if (!clipped) continue;
        let cursor = minutesFromDayStart(clipped.start, dayStart);
        const end = minutesFromDayStart(clipped.end, dayStart);

        while (cursor < end) {
          const hour = Math.min(23, Math.floor(cursor / 60));
          const next = hour === 23 ? end : Math.min(end, (hour + 1) * 60);
          buckets[hour] += next - cursor;
          cursor = next;
        }
      }
    }
  }

  return buckets.map((m) => Math.round(m));
}

/** Total seconds on a focus timer, including the stretch running right now. */
export function timerElapsedSeconds(timer: FocusTimerSnapshot, nowMs = Date.now()): number {
  if (!timer.isRunning || !timer.startedAt) return timer.secondsElapsed;
  const running = Math.max(0, Math.floor((nowMs - Date.parse(timer.startedAt)) / 1000));

  return timer.secondsElapsed + running;
}
