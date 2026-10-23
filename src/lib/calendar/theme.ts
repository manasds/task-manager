import { CATEGORIES } from '@/types/activity';
import { TIMELINE_END_MINUTES, TIMELINE_START_MINUTES } from '@/utils/workSessions';
import type { CalendarPriority, CalendarType } from './types';

export interface CalendarTypeTheme {
  label: string;
  /** Solid swatch for dots and checkboxes. */
  dot: string;
  /** Pastel fill for planned cards. */
  fill: string;
  /** Lighter fill for logged cards. */
  fillSoft: string;
  /** Border for logged (dashed) cards. */
  border: string;
  /** Title text: a darker shade of the same hue. */
  text: string;
  /** Time / secondary text. */
  textMuted: string;
}

/** Pastels built on the app's category colours (indigo for Build, violet for Learn). */
export const CALENDAR_TYPES: Record<CalendarType, CalendarTypeTheme> = {
  build: {
    label: CATEGORIES.build.label,
    dot: '#818cf8',
    fill: '#e0e7ff',
    fillSoft: CATEGORIES.build.lightBg,
    border: '#a5b4fc',
    text: CATEGORIES.build.textColor,
    textMuted: '#5b61a8',
  },
  learn: {
    label: CATEGORIES.learn.label,
    dot: '#a78bfa',
    fill: '#ede9fe',
    fillSoft: CATEGORIES.learn.lightBg,
    border: '#c4b5fd',
    text: CATEGORIES.learn.textColor,
    textMuted: '#7a5aa8',
  },
};

export const CALENDAR_TYPE_ORDER: CalendarType[] = ['build', 'learn'];

export const PRIORITY_ORDER: CalendarPriority[] = ['urgent', 'high', 'medium', 'low'];

export const PRIORITY_LABELS: Record<CalendarPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Grid geometry. Hours match the Planner/Activity timeline so the views line up. */
export const GRID_START_HOUR = TIMELINE_START_MINUTES / 60;
export const GRID_END_HOUR = TIMELINE_END_MINUTES / 60;
export const HOUR_HEIGHT = 64;
export const MIN_CARD_HEIGHT = 24;
export const SNAP_MINUTES = 30;
export const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;
export const GRID_HEIGHT = (GRID_MINUTES / 60) * HOUR_HEIGHT;

/** Monday-start weeks for every date-fns week call in the calendar. */
export const WEEK_OPTIONS = { weekStartsOn: 1 } as const;
