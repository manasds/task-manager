import type { ActivityCategory, ActivityPriority } from '@/types/activity';

/** Same as an activity's category. */
export type CalendarType = ActivityCategory;

export type CalendarPriority = ActivityPriority;

/** Planned = an activity's scheduled block. Logged = one of its work sessions. */
export type CalendarItemKind = 'planned' | 'logged';

export type CalendarViewMode = 'day' | 'week';

export interface ChecklistProgress {
  done: number;
  total: number;
}

/** One block on the grid, derived from an activity. Never stored. */
export interface CalendarItem {
  /** `<activityId>@<day>` for planned blocks, `<sessionId>@<day>` for logged ones. */
  id: string;
  activityId: string;
  /** 'YYYY-MM-DD' of the column it is drawn in. */
  day: string;
  title: string;
  type: CalendarType;
  priority: CalendarPriority;
  kind: CalendarItemKind;
  start: Date;
  end: Date;
  completed: boolean;
  notes?: string;
  checklist?: ChecklistProgress;
}

/** An activity on the selected day with no time yet (the Planner's unscheduled queue). */
export interface UnscheduledItem {
  /** The activity id. */
  id: string;
  title: string;
  type: CalendarType;
  priority: CalendarPriority;
  durationMinutes: number;
  completed: boolean;
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
