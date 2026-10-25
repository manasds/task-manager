import { z } from 'zod';
import { Activity } from './activity';

export const DOCUMENT_SCHEMA_VERSION = 2;

export type SavedTab = 'board' | 'types' | 'calendar' | 'analytics';

const SAVED_TABS: readonly SavedTab[] = ['board', 'types', 'calendar', 'analytics'];

/**
 * The tab to open for a saved `lastTab`. The old Planner and Activity tabs became the Calendar;
 * anything else unknown (e.g. saved by a newer version) opens the board.
 */
export function tabToOpen(saved: string | undefined): SavedTab {
  if (saved === 'planner' || saved === 'activity') return 'calendar';

  return SAVED_TABS.find((tab) => tab === saved) ?? 'board';
}

export interface AppSettings {
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

const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined);

export const cloudUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: optionalText,
  image: optionalText,
});

export type CloudUser = z.infer<typeof cloudUserSchema>;
