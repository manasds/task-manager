import { z } from 'zod';

/** Build: actually making things. Learn: taking things in. Light reading lives on the Canvas. */
export const activityCategorySchema = z.enum(['build', 'learn']);

export type ActivityCategory = z.infer<typeof activityCategorySchema>;

export const activityPrioritySchema = z.enum(['urgent', 'high', 'medium', 'low']);

export type ActivityPriority = z.infer<typeof activityPrioritySchema>;

/** 'parked': set aside for later, kept off the calendar and daily stats. */
export const activityStatusSchema = z.enum(['backlog', 'in_progress', 'completed', 'parked']);

export type ActivityStatus = z.infer<typeof activityStatusSchema>;

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface WorkSession {
  id: string;
  activityId: string;
  start: string;
  end: string;
  minutes: number;
}

export interface Activity {
  id: string;
  title: string;
  description?: string;
  category: ActivityCategory;
  priority: ActivityPriority;
  status: ActivityStatus;
  estimatedMinutes: number;
  actualMinutes: number;
  scheduledTime?: string; // 'HH:MM' 24h format
  /** Start day ('YYYY-MM-DD'). An unfinished task also shows on every later day. */
  date: string;
  /** Extra days it was put on in the calendar. */
  plannedDates?: string[];
  /** 'YYYY-MM-DD'. */
  deadline?: string;
  goal?: string;
  subtasks: Subtask[];
  tags: string[];
  notes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
  workSessions?: WorkSession[];
}

export interface CategoryMeta {
  id: ActivityCategory;
  label: string;
  color: string;
  lightBg: string;
  borderColor: string;
  textColor: string;
}

export const CATEGORIES: Record<ActivityCategory, CategoryMeta> = {
  build: {
    id: 'build',
    label: 'Build',
    color: '#4f46e5', // indigo-600
    lightBg: '#eef2ff',
    borderColor: '#c7d2fe',
    textColor: '#3730a3',
  },
  learn: {
    id: 'learn',
    label: 'Learn',
    color: '#7c3aed', // violet-600
    lightBg: '#f5f3ff',
    borderColor: '#ddd6fe',
    textColor: '#5b21b6',
  },
};

export const STATUS_COLUMNS: { id: ActivityStatus; title: string; shortTitle: string }[] = [
  { id: 'backlog', title: 'To do', shortTitle: 'To do' },
  { id: 'in_progress', title: 'Doing', shortTitle: 'Doing' },
  { id: 'completed', title: 'Done', shortTitle: 'Done' },
  { id: 'parked', title: 'Parking', shortTitle: 'Parked' },
];

export const PRIORITY_CONFIG: Record<ActivityPriority, { label: string; dotColor: string; textColor: string }> = {
  urgent: { label: 'Urgent', dotColor: '#dc2626', textColor: 'text-rose-700' },
  high: { label: 'High', dotColor: '#ea580c', textColor: 'text-amber-700' },
  medium: { label: 'Medium', dotColor: '#2563eb', textColor: 'text-blue-700' },
  low: { label: 'Low', dotColor: '#64748b', textColor: 'text-slate-600' },
};

/** A task as an older version may have saved it. */
export type StoredActivity = Omit<Activity, 'category' | 'status'> & {
  category: string;
  status: string;
  parked?: boolean;
};

function isCurrent(activity: StoredActivity): activity is Activity {
  return (
    activityCategorySchema.safeParse(activity.category).success &&
    activityStatusSchema.safeParse(activity.status).success &&
    !('parked' in activity)
  );
}

/**
 * Bring a task saved by an older version up to date: the six old categories become Build
 * or Learn, the old Review column becomes Doing, and the old `parked` flag becomes the
 * Parking status. Returns the same object if nothing changed.
 */
export function normalizeActivity(activity: StoredActivity): Activity {
  if (isCurrent(activity)) return activity;
  const { parked, ...rest } = activity;

  const category: ActivityCategory = rest.category === 'learn' || rest.category === 'learning' ? 'learn' : 'build';

  const known = activityStatusSchema.safeParse(rest.status);

  const status: ActivityStatus = parked
    ? 'parked'
    : rest.status === 'review'
      ? 'in_progress'
      : known.success
        ? known.data
        : 'backlog';

  return { ...rest, category, status };
}

/**
 * A task from storage, an import or another device. Only the fields every saved version has
 * are checked; the rest is kept as saved and brought up to date by normalizeActivity.
 */
export const storedActivitySchema = z
  .looseObject({ id: z.string(), title: z.string(), status: z.string() })
  .transform(
    // SAFETY: every saved version of a task has id, title and status; normalizeActivity repairs the fields that changed shape.
    (record) => normalizeActivity(record as StoredActivity),
  );

/** Goals in use, most used first. */
export function goalNames(activities: Activity[]): string[] {
  const counts = new Map<string, number>();

  for (const a of activities) if (a.goal) counts.set(a.goal, (counts.get(a.goal) ?? 0) + 1);

  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
}
