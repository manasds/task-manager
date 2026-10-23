/** Build: actually making things. Learn: taking things in. Light reading lives on the Canvas. */
export type ActivityCategory = 'build' | 'learn';

export type ActivityPriority = 'urgent' | 'high' | 'medium' | 'low';

export type ActivityStatus = 'backlog' | 'in_progress' | 'completed';

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
  /** Set aside for later: off the Progress board, calendar and daily stats. */
  parked?: boolean;
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

export const STATUS_COLUMNS: { id: ActivityStatus; title: string; shortTitle: string; hint: string }[] = [
  { id: 'backlog', title: 'To do', shortTitle: 'To do', hint: 'Not started yet' },
  { id: 'in_progress', title: 'Doing', shortTitle: 'Doing', hint: 'Being worked on' },
  { id: 'completed', title: 'Done', shortTitle: 'Done', hint: 'Finished' },
];

export const PRIORITY_CONFIG: Record<ActivityPriority, { label: string; dotColor: string; textColor: string }> = {
  urgent: { label: 'Urgent', dotColor: '#dc2626', textColor: 'text-rose-700' },
  high: { label: 'High', dotColor: '#ea580c', textColor: 'text-amber-700' },
  medium: { label: 'Medium', dotColor: '#2563eb', textColor: 'text-blue-700' },
  low: { label: 'Low', dotColor: '#64748b', textColor: 'text-slate-600' },
};

/**
 * Bring a task saved by an older version up to date: the six old categories become Build
 * or Learn, and the old Review column becomes Doing. Returns the same object if nothing changed.
 */
export function normalizeActivity(activity: Activity): Activity {
  const raw = activity as Omit<Activity, 'category' | 'status'> & { category: string; status: string };
  const category: ActivityCategory = raw.category === 'learn' || raw.category === 'learning' ? 'learn' : 'build';
  const status: ActivityStatus = raw.status === 'review' ? 'in_progress' : (raw.status as ActivityStatus);
  if (category === raw.category && status === raw.status) return activity;
  return { ...activity, category, status };
}

/** Goals in use, most used first. */
export function goalNames(activities: Activity[]): string[] {
  const counts = new Map<string, number>();
  for (const a of activities) if (a.goal) counts.set(a.goal, (counts.get(a.goal) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
}
