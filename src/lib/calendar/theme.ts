import type { CalendarPriority, CalendarType } from './types';

export interface CalendarTypeTheme {
  label: string;
  /** Solid swatch for dots and checkboxes. */
  dot: string;
  /** Pastel fill for planned cards. */
  fill: string;
  /** Lighter fill for logged cards. */
  fillSoft: string;
  /** Border for logged (dashed) and selected cards. */
  border: string;
  /** Title text: a darker shade of the same hue. */
  text: string;
  /** Time / secondary text. */
  textMuted: string;
}

/** Pastels tuned to the Daymark reference. Hex values so they work in inline styles too. */
export const CALENDAR_TYPES: Record<CalendarType, CalendarTypeTheme> = {
  build: {
    label: 'Build',
    dot: '#7eb2ec',
    fill: '#cfe3fb',
    fillSoft: '#eaf3fd',
    border: '#8db9ea',
    text: '#24466e',
    textMuted: '#4f6f95',
  },
  learn: {
    label: 'Learn',
    dot: '#b18ae9',
    fill: '#e2d5fb',
    fillSoft: '#f2ecfd',
    border: '#b99be6',
    text: '#4d2f86',
    textMuted: '#715a9f',
  },
  focus: {
    label: 'Focus time',
    dot: '#6fcba2',
    fill: '#c8eedc',
    fillSoft: '#e6f7ef',
    border: '#86cfae',
    text: '#22603f',
    textMuted: '#4a7f64',
  },
  personal: {
    label: 'Personal',
    dot: '#f0a387',
    fill: '#fddacc',
    fillSoft: '#feeee7',
    border: '#efab92',
    text: '#7f3f28',
    textMuted: '#9b6450',
  },
  social: {
    label: 'Social',
    dot: '#ec8fb6',
    fill: '#fbd3e3',
    fillSoft: '#fdebf2',
    border: '#eba0c0',
    text: '#82284f',
    textMuted: '#9c5574',
  },
  reminder: {
    label: 'Reminders',
    dot: '#e8c35c',
    fill: '#fde9a8',
    fillSoft: '#fef5d6',
    border: '#6b5310',
    text: '#5f4708',
    textMuted: '#7f6a35',
  },
};

export const CALENDAR_TYPE_ORDER: CalendarType[] = ['build', 'learn', 'focus', 'personal', 'social', 'reminder'];

export const PRIORITY_ORDER: CalendarPriority[] = ['urgent', 'high', 'medium', 'low'];

export const PRIORITY_LABELS: Record<CalendarPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Grid geometry shared by the week grid, drop snapping and the current-time line. */
export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 23;
export const HOUR_HEIGHT = 64;
export const MIN_CARD_HEIGHT = 24;
export const SNAP_MINUTES = 30;
