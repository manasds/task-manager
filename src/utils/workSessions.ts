import { Activity, WorkSession } from '../types/activity';

export const TIMELINE_HOURS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00', '22:00',
];

export const TIMELINE_START_MINUTES = 7 * 60;
export const TIMELINE_END_MINUTES = 23 * 60;
export const TIMELINE_SPAN_MINUTES = TIMELINE_END_MINUTES - TIMELINE_START_MINUTES;

const MIN_BLOCK_MINUTES = 20;

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

export function minutesFromDayStart(d: Date, dayStart: Date): number {
  return (d.getTime() - dayStart.getTime()) / 60_000;
}

export interface SessionBlockStyle {
  top: number;
  height: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

export function sessionBlockStyleForDate(
  session: WorkSession,
  date: string,
  rowHeightPx: number
): SessionBlockStyle | null {
  const clipped = clipSessionToDate(session, date);
  if (!clipped) return null;

  const dayStart = parseLocalDate(date);
  const gridHeight = TIMELINE_HOURS.length * rowHeightPx;
  const rawStartMin = minutesFromDayStart(clipped.start, dayStart);
  const rawEndMin = minutesFromDayStart(clipped.end, dayStart);

  let clippedStart = rawStartMin < TIMELINE_START_MINUTES;
  let clippedEnd = rawEndMin > TIMELINE_END_MINUTES;

  let displayStartMin = Math.max(rawStartMin, TIMELINE_START_MINUTES);
  let displayEndMin = Math.min(rawEndMin, TIMELINE_END_MINUTES);

  if (displayEndMin <= displayStartMin) {
    if (rawEndMin <= TIMELINE_START_MINUTES) {
      displayStartMin = TIMELINE_START_MINUTES;
      displayEndMin = TIMELINE_START_MINUTES + MIN_BLOCK_MINUTES;
      clippedStart = true;
      clippedEnd = true;
    } else {
      displayEndMin = TIMELINE_END_MINUTES;
      displayStartMin = TIMELINE_END_MINUTES - MIN_BLOCK_MINUTES;
      clippedStart = true;
      clippedEnd = true;
    }
  }

  const top =
    ((displayStartMin - TIMELINE_START_MINUTES) / TIMELINE_SPAN_MINUTES) * gridHeight;
  const height = Math.max(
    ((displayEndMin - displayStartMin) / TIMELINE_SPAN_MINUTES) * gridHeight,
    20
  );

  return { top, height, clippedStart, clippedEnd };
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
  const buckets = new Array<number>(24).fill(0);
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

export interface TimelineBlock {
  session: WorkSession;
  activity: Activity;
  /** Minutes from local midnight, clipped to the date. */
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
}

export interface DayTimeline {
  blocks: TimelineBlock[];
  startHour: number;
  endHour: number;
}

const MIN_TIMELINE_HOURS = 3;

/**
 * Sessions on a date, with side-by-side lanes for overlaps and an hour range
 * that fits the work actually logged (08:00-18:00 when there is none).
 * `minVisualMinutes` is how much time a block occupies on screen at minimum,
 * so short blocks drawn taller than their duration still get their own lane.
 */
export function layoutDayTimeline(
  activities: Activity[],
  date: string,
  minVisualMinutes = 0
): DayTimeline {
  const dayStart = parseLocalDate(date);
  const blocks: TimelineBlock[] = [];
  for (const activity of activities) {
    for (const session of activity.workSessions ?? []) {
      const clipped = clipSessionToDate(session, date);
      if (!clipped) continue;
      blocks.push({
        session,
        activity,
        startMin: minutesFromDayStart(clipped.start, dayStart),
        endMin: minutesFromDayStart(clipped.end, dayStart),
        lane: 0,
        lanes: 1,
      });
    }
  }
  if (blocks.length === 0) return { blocks, startHour: 8, endHour: 18 };

  blocks.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const visualEnd = (b: TimelineBlock) => Math.max(b.endMin, b.startMin + minVisualMinutes);

  let cluster: TimelineBlock[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const closeCluster = () => {
    for (const block of cluster) block.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const block of blocks) {
    if (block.startMin >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((end) => end <= block.startMin);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = visualEnd(block);
    block.lane = lane;
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, visualEnd(block));
  }
  closeCluster();

  let startHour = Math.floor(Math.min(...blocks.map((b) => b.startMin)) / 60);
  let endHour = Math.ceil(Math.max(...blocks.map(visualEnd)) / 60);
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, Math.max(endHour, startHour + 1));
  if (endHour - startHour < MIN_TIMELINE_HOURS) {
    const extra = MIN_TIMELINE_HOURS - (endHour - startHour);
    startHour = Math.max(0, startHour - Math.floor(extra / 2));
    endHour = Math.min(24, startHour + MIN_TIMELINE_HOURS);
    startHour = Math.max(0, endHour - MIN_TIMELINE_HOURS);
  }
  return { blocks, startHour, endHour };
}

export interface TimelineAxis {
  /** Pixel offset of each hour boundary from startHour to endHour inclusive. */
  hourTops: number[];
  height: number;
  /** Pixel offset for minutes from local midnight. */
  toPx: (minutes: number) => number;
}

/** Hours with work get tall rows so blocks show their real span; empty hours collapse to a slim gap. */
export function buildTimelineAxis(
  { blocks, startHour, endHour }: DayTimeline,
  activeRowPx: number,
  emptyRowPx: number
): TimelineAxis {
  const rowHeights: number[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    const from = hour * 60;
    const to = from + 60;
    const busy = blocks.some((b) => b.startMin < to && Math.max(b.endMin, b.startMin + 1) > from);
    rowHeights.push(busy ? activeRowPx : emptyRowPx);
  }
  const hourTops = [0];
  for (const h of rowHeights) hourTops.push(hourTops[hourTops.length - 1] + h);
  const height = hourTops[hourTops.length - 1];

  const toPx = (minutes: number) => {
    const offset = minutes / 60 - startHour;
    const row = Math.min(Math.max(Math.floor(offset), 0), rowHeights.length - 1);
    return Math.min(height, Math.max(0, hourTops[row] + (offset - row) * rowHeights[row]));
  };
  return { hourTops, height, toPx };
}
