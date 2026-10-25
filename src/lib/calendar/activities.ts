import { addMinutes, differenceInMinutes, format } from 'date-fns';
import type { Activity } from '@/types/activity';
import { clipSessionToDate, isActivityOnDate, parseLocalDate } from '@/utils/workSessions';
import type { CalendarItem, ChecklistProgress, UnscheduledItem } from './types';

/** Block length for a task with no estimate. */
const DEFAULT_BLOCK_MINUTES = 30;

export function blockMinutes(activity: Activity): number {
  return activity.estimatedMinutes > 0 ? activity.estimatedMinutes : DEFAULT_BLOCK_MINUTES;
}

function checklistOf(activity: Activity): ChecklistProgress | undefined {
  if (activity.subtasks.length === 0) return undefined;

  return { done: activity.subtasks.filter((s) => s.completed).length, total: activity.subtasks.length };
}

/** Local `day` ('YYYY-MM-DD') at `time` ('HH:MM'). */
export function timeOnDay(day: string, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = parseLocalDate(day);
  date.setHours(hours || 0, minutes || 0, 0, 0);

  return date;
}

export function toTimeString(date: Date): string {
  return format(date, 'HH:mm');
}

function dayLabel(day: string): string {
  return format(parseLocalDate(day), 'EEE d');
}

/** Put on `day` on purpose: its start day or one of its extra planned days. */
function explicitlyOn(activity: Activity, day: string): boolean {
  return activity.date === day || !!activity.plannedDates?.includes(day);
}

const isOpen = (activity: Activity) => activity.status !== 'completed';

/**
 * Whether its scheduled block is drawn on `day`. An open task is not repeated on every later
 * day: it shows where it was planned, plus today while it is open.
 */
export function showsPlannedOn(activity: Activity, day: string, today: string): boolean {
  if (!activity.scheduledTime || !isActivityOnDate(activity, day)) return false;

  return explicitlyOn(activity, day) || (day === today && isOpen(activity));
}

/** Planned blocks and logged sessions for the given days. */
export function calendarItems(activities: Activity[], days: string[], today: string): CalendarItem[] {
  const items: CalendarItem[] = [];

  for (const activity of activities) {
    const base = {
      activityId: activity.id,
      title: activity.title,
      type: activity.category,
      priority: activity.priority,
      completed: activity.status === 'completed',
      notes: activity.description || undefined,
      checklist: checklistOf(activity),
    };

    for (const day of days) {
      if (activity.scheduledTime && showsPlannedOn(activity, day, today)) {
        const start = timeOnDay(day, activity.scheduledTime);
        items.push({
          ...base,
          id: `${activity.id}@${day}`,
          day,
          kind: 'planned',
          start,
          end: addMinutes(start, blockMinutes(activity)),
        });
      }

      // Logged work happened whatever the task's state, so parked tasks still show it.
      for (const session of activity.workSessions ?? []) {
        const clipped = clipSessionToDate(session, day);

        if (!clipped) continue;
        items.push({ ...base, id: `${session.id}@${day}`, day, kind: 'logged', start: clipped.start, end: clipped.end });
      }
    }
  }

  return items;
}

/** Largest break between two sessions that still reads as one sitting. */
const MERGE_GAP_MINUTES = 15;

/**
 * Join back-to-back logged sessions of one task into a single block, as long as the break is
 * short and nothing from another task sits in it. The block keeps the minutes actually worked.
 */
export function mergeLoggedRuns(items: CalendarItem[]): CalendarItem[] {
  const logged = items
    .filter((item) => item.kind === 'logged')
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: CalendarItem[] = [];

  for (const item of logged) {
    const run = merged.findLast((m) => m.activityId === item.activityId && m.day === item.day);
    const gapEnd = item.start;

    const blocked =
      !run ||
      differenceInMinutes(gapEnd, run.end) > MERGE_GAP_MINUTES ||
      items.some(
        (other) =>
          other.day === item.day && other.activityId !== item.activityId && other.start < gapEnd && other.end > run.end,
      );

    if (!run || blocked) {
      merged.push({ ...item });
      continue;
    }

    run.sessions = (run.sessions ?? 1) + 1;
    run.minutes = (run.minutes ?? differenceInMinutes(run.end, run.start)) + differenceInMinutes(item.end, item.start);

    if (item.end > run.end) run.end = item.end;
  }

  return [...items.filter((item) => item.kind !== 'logged'), ...merged];
}

/** Tasks on `day` with no time yet: the unscheduled queue. */
export function unscheduledOn(activities: Activity[], day: string): UnscheduledItem[] {
  return activities.flatMap((a) =>
    !a.scheduledTime && isActivityOnDate(a, day)
      ? [
          {
            id: a.id,
            title: a.title,
            type: a.category,
            priority: a.priority,
            durationMinutes: blockMinutes(a),
            completed: a.status === 'completed',
            notes: a.description || undefined,
            checklist: checklistOf(a),
          },
        ]
      : [],
  );
}

/** Whether the calendar shows it on `day`: as a block if it has a time, else in that day's queue. */
function visibleOn(activity: Activity, day: string, today: string): boolean {
  return activity.scheduledTime ? showsPlannedOn(activity, day, today) : isActivityOnDate(activity, day);
}

/** Open tasks not shown on `day` yet, that could be added to it. */
export function addableTo(activities: Activity[], day: string, today: string): Activity[] {
  return activities.filter((a) => a.status !== 'parked' && isOpen(a) && !visibleOn(a, day, today));
}

/** Also planned on `day`, so the task shows there in the calendar too. */
export function addToDay(activity: Activity, day: string): Activity {
  if (explicitlyOn(activity, day)) return activity;

  return { ...activity, plannedDates: [...(activity.plannedDates ?? []), day] };
}

/** On `day` only as an extra planned day, so taking it off leaves its start day alone. */
export function canRemoveFromDay(activity: Activity, day: string, today: string): boolean {
  if (activity.date === day || !activity.plannedDates?.includes(day)) return false;

  // An open task stays on today regardless, so removing it there would do nothing visible.
  return !(day === today && isOpen(activity));
}

export function removeFromDay(activity: Activity, day: string): Activity {
  return { ...activity, plannedDates: activity.plannedDates?.filter((d) => d !== day) };
}

/** Clear the time: it goes back to the unscheduled queue on every day it is on. */
export function unschedule(activity: Activity): Activity {
  return { ...activity, scheduledTime: undefined };
}

export interface MoveResult {
  activity: Activity;
  /** Set when the outcome needs explaining, e.g. it also stays on the day it came from. */
  note?: string;
}

/**
 * Drop an activity on `targetDay` at `time` ('HH:MM'), dragged from its block or queue on `sourceDay`.
 * Grid blocks and queue items follow the same rules.
 * Moving off its start day moves the start date; moving off an extra planned day moves that day.
 * The time is shared by every day the task is on, because an activity has one scheduled time.
 */
export function moveToSlot(
  activity: Activity,
  sourceDay: string,
  targetDay: string,
  time: string,
  today: string,
): MoveResult {
  let next: Activity = { ...activity, scheduledTime: time };

  if (sourceDay !== targetDay) {
    if (activity.date === sourceDay) {
      next = { ...next, date: targetDay, plannedDates: next.plannedDates?.filter((d) => d !== targetDay) };
    } else if (activity.plannedDates?.includes(sourceDay)) {
      next = removeFromDay(next, sourceDay);
    }
  }

  // Make sure it is drawn where it was dropped.
  if (!showsPlannedOn(next, targetDay, today)) next = addToDay(next, targetDay);

  const note =
    sourceDay !== targetDay && showsPlannedOn(next, sourceDay, today)
      ? sourceDay === today
        ? `Added to ${dayLabel(targetDay)} · open tasks also stay on today until done`
        : `Added to ${dayLabel(targetDay)} · it's still planned on ${dayLabel(sourceDay)}`
      : undefined;

  return { activity: next, note };
}
