import { Activity, ActivityStatus, WorkSession } from '../types/activity';

/** A task moved to `status`. Moving it to the status it already has changes nothing, so a Done task keeps its finish time. */
export function moveToStatus(activity: Activity, status: ActivityStatus, nowIso: string): Activity {
  if (activity.status === status) return activity;

  return {
    ...activity,
    status,
    completedAt: status === 'completed' ? nowIso : undefined,
    updatedAt: nowIso,
  };
}

/** Whether saving `next` over `previous` is what finishes the task. */
export function finishesTask(previous: Activity | undefined, next: Activity): boolean {
  return previous !== undefined && previous.status !== 'completed' && next.status === 'completed';
}

function mergeSessions(snapshot: Activity, edited: Activity, latest: Activity): WorkSession[] {
  const before = new Set((snapshot.workSessions ?? []).map((s) => s.id));
  const kept = new Set((edited.workSessions ?? []).map((s) => s.id));
  const added = (edited.workSessions ?? []).filter((s) => !before.has(s.id));
  const remaining = (latest.workSessions ?? []).filter((s) => !before.has(s.id) || kept.has(s.id));

  return [...remaining, ...added].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/**
 * Apply an edit form's result to the task as it is now. The form opened on `snapshot`, so a field it
 * left alone takes the value from `latest`, which may have changed since (for example on another device).
 */
export function mergeTaskEdit(snapshot: Activity, edited: Activity, latest: Activity): Activity {
  const pick = <K extends keyof Activity>(field: K): Activity[K] =>
    JSON.stringify(edited[field]) === JSON.stringify(snapshot[field]) ? latest[field] : edited[field];

  // A finish time only makes sense with the status it came with, so these two move together.
  const statusSource = edited.status === snapshot.status ? latest : edited;

  return {
    ...latest,
    title: pick('title'),
    description: pick('description'),
    category: pick('category'),
    priority: pick('priority'),
    estimatedMinutes: pick('estimatedMinutes'),
    scheduledTime: pick('scheduledTime'),
    date: pick('date'),
    deadline: pick('deadline'),
    subtasks: pick('subtasks'),
    status: statusSource.status,
    completedAt: statusSource.completedAt,
    actualMinutes: Math.max(0, latest.actualMinutes + edited.actualMinutes - snapshot.actualMinutes),
    workSessions: mergeSessions(snapshot, edited, latest),
  };
}
