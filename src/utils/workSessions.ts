import { Activity, WorkSession } from '../types/activity';

export const TIMELINE_HOURS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00', '22:00',
];

export const TIMELINE_START_MINUTES = 7 * 60;
export const TIMELINE_END_MINUTES = 23 * 60;
export const TIMELINE_SPAN_MINUTES = TIMELINE_END_MINUTES - TIMELINE_START_MINUTES;

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

export function sessionDate(session: WorkSession): string {
  return session.start.split('T')[0];
}

export function sessionsOnDate(activity: Activity, date: string): WorkSession[] {
  return (activity.workSessions ?? []).filter((s) => sessionDate(s) === date);
}

export function totalSessionMinutes(sessions: WorkSession[]): number {
  return sessions.reduce((sum, s) => sum + s.minutes, 0);
}

export function allSessionMinutes(activity: Activity): number {
  return totalSessionMinutes(activity.workSessions ?? []);
}

export function untimedMinutes(activity: Activity): number {
  return Math.max(0, (activity.actualMinutes || 0) - allSessionMinutes(activity));
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
    const timedMinutes = totalSessionMinutes(daySessions);
    const untimed =
      activity.date === date || daySessions.length > 0 ? untimedMinutes(activity) : 0;
    const totalMinutes = timedMinutes + untimed;

    if (totalMinutes > 0) {
      stats.push({ activity, timedMinutes, untimedMinutes: untimed, totalMinutes });
    }
  }

  return stats.sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function mergeWorkSessions(
  local?: WorkSession[],
  server?: WorkSession[]
): WorkSession[] {
  const byId = new Map<string, WorkSession>();
  for (const session of server ?? []) byId.set(session.id, session);
  for (const session of local ?? []) byId.set(session.id, session);
  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start)
  );
}

export function minutesFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function sessionBlockStyle(
  session: WorkSession,
  rowHeightPx: number
): { top: number; height: number } {
  const startMin = minutesFromMidnight(session.start);
  const endMin = minutesFromMidnight(session.end);
  const top = ((startMin - TIMELINE_START_MINUTES) / TIMELINE_SPAN_MINUTES) * rowHeightPx * TIMELINE_HOURS.length;
  const height = Math.max(
    ((endMin - startMin) / TIMELINE_SPAN_MINUTES) * rowHeightPx * TIMELINE_HOURS.length,
    20
  );
  return { top, height };
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
