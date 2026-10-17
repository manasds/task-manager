import { Activity } from './activity';

export const DOCUMENT_SCHEMA_VERSION = 2;

export type SavedTab = 'board' | 'planner' | 'activity' | 'analytics';

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
  deletedIds: string[];
  timer: FocusTimerSnapshot | null;
  updatedAt: string;
}

export interface CloudUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

export type FlushReason =
  | 'edit'
  | 'focus'
  | 'session_end'
  | 'safety_interval'
  | 'explicit'
  | 'online'
  | 'sign_in';
