export type ActivityCategory =
  | 'deep_work'
  | 'health_fitness'
  | 'creative'
  | 'admin_meetings'
  | 'learning'
  | 'personal';

export type ActivityPriority = 'urgent' | 'high' | 'medium' | 'low';

export type ActivityStatus = 'backlog' | 'in_progress' | 'review' | 'completed';

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
  date: string; // 'YYYY-MM-DD'
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
  deep_work: {
    id: 'deep_work',
    label: 'Deep Work',
    color: '#4f46e5', // indigo-600
    lightBg: '#eef2ff',
    borderColor: '#c7d2fe',
    textColor: '#3730a3',
  },
  health_fitness: {
    id: 'health_fitness',
    label: 'Health & Fitness',
    color: '#059669', // emerald-600
    lightBg: '#ecfdf5',
    borderColor: '#a7f3d0',
    textColor: '#065f46',
  },
  creative: {
    id: 'creative',
    label: 'Creative & Design',
    color: '#d97706', // amber-600
    lightBg: '#fffbeb',
    borderColor: '#fde68a',
    textColor: '#92400e',
  },
  admin_meetings: {
    id: 'admin_meetings',
    label: 'Admin & Meetings',
    color: '#0284c7', // sky-600
    lightBg: '#f0f9ff',
    borderColor: '#bae6fd',
    textColor: '#075985',
  },
  learning: {
    id: 'learning',
    label: 'Learning & Growth',
    color: '#7c3aed', // violet-600
    lightBg: '#f5f3ff',
    borderColor: '#ddd6fe',
    textColor: '#5b21b6',
  },
  personal: {
    id: 'personal',
    label: 'Personal & Habits',
    color: '#e11d48', // rose-600
    lightBg: '#fff1f2',
    borderColor: '#fecdd3',
    textColor: '#9f1239',
  },
};

export const STATUS_COLUMNS: { id: ActivityStatus; title: string; shortTitle: string; hint: string }[] = [
  { id: 'backlog', title: 'Planned & Queued', shortTitle: 'Planned', hint: 'Ready to be prioritized' },
  { id: 'in_progress', title: 'In Progress', shortTitle: 'Doing', hint: 'Currently actively focused' },
  { id: 'review', title: 'Review / Verify', shortTitle: 'Review', hint: 'Almost ready or verifying results' },
  { id: 'completed', title: 'Completed', shortTitle: 'Done', hint: 'Finished & logged' },
];

export const PRIORITY_CONFIG: Record<ActivityPriority, { label: string; dotColor: string; textColor: string }> = {
  urgent: { label: 'Urgent', dotColor: '#dc2626', textColor: 'text-rose-700' },
  high: { label: 'High', dotColor: '#ea580c', textColor: 'text-amber-700' },
  medium: { label: 'Medium', dotColor: '#2563eb', textColor: 'text-blue-700' },
  low: { label: 'Low', dotColor: '#64748b', textColor: 'text-slate-600' },
};
