import { Activity } from './activity';

export const DOCUMENT_SCHEMA_VERSION = 2;

export type SavedTab = 'board' | 'types' | 'calendar' | 'analytics';

const SAVED_TABS: readonly string[] = ['board', 'types', 'calendar', 'analytics'] satisfies readonly SavedTab[];

/**
 * The tab to open for a saved `lastTab`. The old Planner and Activity tabs became the Calendar;
 * anything else unknown (e.g. saved by a newer version) opens the board.
 */
export function tabToOpen(saved: unknown): SavedTab {
  if (saved === 'planner' || saved === 'activity') return 'calendar';
  return typeof saved === 'string' && SAVED_TABS.includes(saved) ? (saved as SavedTab) : 'board';
}

export interface AppSettings {
  muted: boolean;
  lastTab: SavedTab;
  selectedDate?: string;
}

export interface FocusTimerSnapshot {
  activityId: string;
  /** Seconds banked before the current running stretch. */
  secondsElapsed: number;
  isRunning: boolean;
  /** When the current running stretch began (ISO), so a reload keeps counting. */
  startedAt?: string;
}

export interface PersistedDocument {
  schemaVersion: number;
  dailyGoalMinutes: number;
  settings: AppSettings;
  activities: Activity[];
  timer: FocusTimerSnapshot | null;
  updatedAt: string;
}

export interface CloudUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
}
