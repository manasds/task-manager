import type { ActivityPriority } from '@/types/activity';

/** Calendar "types" double as the sidebar's "My calendars" list. */
export type CalendarType = 'build' | 'learn' | 'focus' | 'personal' | 'social' | 'reminder';

export type CalendarPriority = ActivityPriority;

/** Planned = put on the calendar ahead of time. Logged = a focus session that already happened. */
export type CalendarItemKind = 'planned' | 'logged';

export type CalendarViewMode = 'day' | 'week' | 'month';

export interface ChecklistProgress {
  done: number;
  total: number;
}

export interface CalendarItem {
  id: string;
  title: string;
  type: CalendarType;
  priority: CalendarPriority;
  kind: CalendarItemKind;
  start: Date;
  end: Date;
  location?: string;
  notes?: string;
  checklist?: ChecklistProgress;
}

/** Not on the grid yet. Dropping one onto a slot turns it into a planned CalendarItem. */
export interface UnscheduledItem {
  id: string;
  title: string;
  type: CalendarType;
  priority: CalendarPriority;
  durationMinutes: number;
  notes?: string;
  checklist?: ChecklistProgress;
}

export interface CalendarFilters {
  types: Record<CalendarType, boolean>;
  priorities: Record<CalendarPriority, boolean>;
}

/** Attached to every @dnd-kit draggable as `data`. Grid cards use id `grid:<id>`, tray items `tray:<id>`. */
export type DragPayload =
  | { source: 'grid'; item: CalendarItem }
  | { source: 'tray'; item: UnscheduledItem };
