import { Activity } from './activity';

/** One task row as the server stores it. `data` is null for a delete. */
export interface ActivityRow {
  id: string;
  data: Activity | null;
  updatedAt: string;
  seq: number;
}

export interface GoalRow {
  dailyGoalMinutes: number;
  updatedAt: string;
  seq: number;
}

export interface PullResponse {
  rows: ActivityRow[];
  goal: GoalRow | null;
  /** Highest seq included. Pass it back as `since` on the next pull. */
  cursor: number;
  hasMore: boolean;
}

/**
 * A local edit. `baseSeq` is the server seq this device last saw for the task.
 * If nobody else wrote since, the edit applies; otherwise the newer updatedAt wins.
 */
export interface ActivityChange {
  id: string;
  data: Activity | null;
  updatedAt: string;
  baseSeq: number;
}

export interface GoalChange {
  dailyGoalMinutes: number;
  updatedAt: string;
  baseSeq: number;
}

export interface PushRequest {
  changes: ActivityChange[];
  goal?: GoalChange;
}

export interface PushResponse {
  applied: { id: string; seq: number }[];
  /** Server copies that beat the pushed edit. The client adopts them. */
  rejected: ActivityRow[];
  goalApplied: { seq: number } | null;
  goalRejected: GoalRow | null;
}

export const MAX_CHANGES_PER_PUSH = 200;
export const PULL_PAGE_SIZE = 500;
