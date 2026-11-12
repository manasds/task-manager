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
    dot: 'var(--cal-build-dot)',
    fill: 'var(--cal-build-fill)',
    fillSoft: 'var(--cal-build-soft)',
    border: 'var(--cal-build-border)',
    text: CATEGORIES.build.textColor,
    textMuted: 'var(--cal-build-muted)',
  },
  learn: {
    label: CATEGORIES.learn.label,
    dot: 'var(--cal-learn-dot)',
    fill: 'var(--cal-learn-fill)',
    fillSoft: 'var(--cal-learn-soft)',
    border: 'var(--cal-learn-border)',
    text: CATEGORIES.learn.textColor,
    textMuted: 'var(--cal-learn-muted)',
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

/** Grid geometry, on the app's shared 07:00–23:00 timeline. */
export const GRID_START_HOUR = TIMELINE_START_MINUTES / 60;
export const GRID_END_HOUR = TIMELINE_END_MINUTES / 60;

/** Time runs left to right: one row per day, cards stacked in lanes inside a row. */
export const HOUR_WIDTH = 136;
export const MIN_CARD_WIDTH = 24;
export const LANE_HEIGHT = 48;
export const SNAP_MINUTES = 30;
export const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;
export const GRID_WIDTH = (GRID_MINUTES / 60) * HOUR_WIDTH;

/** Monday-start weeks for every date-fns week call in the calendar. */
export const WEEK_OPTIONS = { weekStartsOn: 1 } as const;
