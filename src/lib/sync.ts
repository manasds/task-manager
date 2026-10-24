import { pool } from './db';
import type { Activity } from '../types/activity';
import {
  ActivityChange,
  ActivityRow,
  GoalChange,
  GoalRow,
  MAX_CHANGES_PER_PUSH,
  PULL_PAGE_SIZE,
  PullResponse,
  PushRequest,
  PushResponse,
} from '../types/sync';

const MAX_ACTIVITY_BYTES = 64_000;

interface DbActivityRow {
  id: string;
  data: Activity | null;
  client_updated_at: Date;
  server_seq: string;
}

interface DbSyncState {
  seq: string;
  daily_goal_minutes: number | null;
  goal_updated_at: Date | null;
  goal_seq: string;
}

function toRow(row: DbActivityRow): ActivityRow {
  return {
    id: row.id,
    data: row.data,
    updatedAt: row.client_updated_at.toISOString(),
    seq: Number(row.server_seq),
  };
}

function toGoal(state: DbSyncState): GoalRow | null {
  if (state.daily_goal_minutes === null || !state.goal_updated_at) return null;

  return {
    dailyGoalMinutes: state.daily_goal_minutes,
    updatedAt: state.goal_updated_at.toISOString(),
    seq: Number(state.goal_seq),
  };
}

/** Everything that changed for this user after `since`, from one consistent snapshot. */
export async function pullChanges(userId: string, since: number): Promise<PullResponse> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    const rows = await client.query<DbActivityRow>(
      `SELECT id, data, client_updated_at, server_seq
       FROM activities
       WHERE user_id = $1 AND server_seq > $2
       ORDER BY server_seq
       LIMIT $3`,
      [userId, since, PULL_PAGE_SIZE + 1]
    );

    const state = await client.query<DbSyncState>(
      'SELECT seq, daily_goal_minutes, goal_updated_at, goal_seq FROM user_sync_state WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');

    const hasMore = rows.rows.length > PULL_PAGE_SIZE;
    const page = rows.rows.slice(0, PULL_PAGE_SIZE).map(toRow);
    const stateRow = state.rows[0];
    const goal = stateRow && Number(stateRow.goal_seq) > since ? toGoal(stateRow) : null;

    let cursor = since;

    if (hasMore) {
      cursor = page[page.length - 1].seq;
    } else if (stateRow) {
      cursor = Math.max(since, Number(stateRow.seq));
    }

    return { rows: page, goal, cursor, hasMore };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Edit wins when nobody else wrote since the device last saw the row, or when it is newer. */
function editWins(baseSeq: number, updatedAt: string, current: { seq: number; updatedAt: Date } | null) {
  if (!current) return true;

  if (current.seq <= baseSeq) return true;

  return Date.parse(updatedAt) >= current.updatedAt.getTime();
}

export async function pushChanges(userId: string, request: PushRequest): Promise<PushResponse> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO user_sync_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );

    // Row lock serializes pushes per user so seqs commit in order.
    const stateResult = await client.query<DbSyncState>(
      'SELECT seq, daily_goal_minutes, goal_updated_at, goal_seq FROM user_sync_state WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    const state = stateResult.rows[0];
    let seq = Number(state.seq);

    const response: PushResponse = { applied: [], rejected: [], goalApplied: null, goalRejected: null };

    const ids = request.changes.map((c) => c.id);

    const existing = await client.query<DbActivityRow>(
      `SELECT id, data, client_updated_at, server_seq
       FROM activities WHERE user_id = $1 AND id = ANY($2::text[])`,
      [userId, ids]
    );

    const currentById = new Map(existing.rows.map((row) => [row.id, row]));

    for (const change of request.changes) {
      const current = currentById.get(change.id);

      const wins = editWins(
        change.baseSeq,
        change.updatedAt,
        current ? { seq: Number(current.server_seq), updatedAt: current.client_updated_at } : null
      );

      if (!wins) {
        response.rejected.push(toRow(current!));
        continue;
      }

      seq += 1;

      const written = await client.query<DbActivityRow>(
        `INSERT INTO activities (user_id, id, data, client_updated_at, server_seq)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, id) DO UPDATE
           SET data = EXCLUDED.data,
               client_updated_at = EXCLUDED.client_updated_at,
               server_seq = EXCLUDED.server_seq
         RETURNING id, data, client_updated_at, server_seq`,
        [userId, change.id, change.data, change.updatedAt, seq]
      );

      currentById.set(change.id, written.rows[0]);
      response.applied.push({ id: change.id, seq });
    }

    let goalMinutes = state.daily_goal_minutes;
    let goalUpdatedAt = state.goal_updated_at;
    let goalSeq = Number(state.goal_seq);

    if (request.goal) {
      const currentGoal =
        goalUpdatedAt && goalMinutes !== null ? { seq: goalSeq, updatedAt: goalUpdatedAt } : null;

      if (editWins(request.goal.baseSeq, request.goal.updatedAt, currentGoal)) {
        seq += 1;
        goalMinutes = request.goal.dailyGoalMinutes;
        goalUpdatedAt = new Date(request.goal.updatedAt);
        goalSeq = seq;
        response.goalApplied = { seq };
      } else {
        response.goalRejected = toGoal(state);
      }
    }

    await client.query(
      `UPDATE user_sync_state
       SET seq = $2, daily_goal_minutes = $3, goal_updated_at = $4, goal_seq = $5
       WHERE user_id = $1`,
      [userId, seq, goalMinutes, goalUpdatedAt, goalSeq]
    );
    await client.query('COMMIT');

    return response;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isSeq(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseChange(value: unknown): ActivityChange | null {
  if (!value || typeof value !== 'object') return null;
  const change = value as ActivityChange;

  if (typeof change.id !== 'string' || change.id.length === 0 || change.id.length > 200) return null;

  if (!isIsoTimestamp(change.updatedAt) || !isSeq(change.baseSeq)) return null;

  if (change.data !== null) {
    const data = change.data as Activity;

    if (!data || typeof data !== 'object' || data.id !== change.id) return null;

    if (typeof data.title !== 'string' || typeof data.status !== 'string') return null;

    if (JSON.stringify(data).length > MAX_ACTIVITY_BYTES) return null;
  }

  return { id: change.id, data: change.data, updatedAt: change.updatedAt, baseSeq: change.baseSeq };
}

function parseGoal(value: unknown): GoalChange | null {
  if (!value || typeof value !== 'object') return null;
  const goal = value as GoalChange;

  if (!Number.isInteger(goal.dailyGoalMinutes) || goal.dailyGoalMinutes <= 0) return null;

  if (!isIsoTimestamp(goal.updatedAt) || !isSeq(goal.baseSeq)) return null;

  return { dailyGoalMinutes: goal.dailyGoalMinutes, updatedAt: goal.updatedAt, baseSeq: goal.baseSeq };
}

export function parsePushRequest(body: unknown): PushRequest | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as { changes?: unknown; goal?: unknown };

  if (!Array.isArray(raw.changes) || raw.changes.length > MAX_CHANGES_PER_PUSH) return null;
  const changes: ActivityChange[] = [];
  const seen = new Set<string>();

  for (const item of raw.changes) {
    const change = parseChange(item);

    if (!change || seen.has(change.id)) return null;
    seen.add(change.id);
    changes.push(change);
  }

  if (raw.goal === undefined || raw.goal === null) return { changes };
  const goal = parseGoal(raw.goal);

  return goal ? { changes, goal } : null;
}
