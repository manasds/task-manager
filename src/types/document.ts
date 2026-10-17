import { Activity } from './activity';

export const DOCUMENT_SCHEMA_VERSION = 2;

export type SavedTab = 'board' | 'planner' | 'analytics';

export interface AppSettings {
  muted: boolean;
  lastTab: SavedTab;
  selectedDate?: string;
}

export interface FocusTimerSnapshot {
  activityId: string;
  secondsElapsed: number;
  isRunning: boolean;
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
