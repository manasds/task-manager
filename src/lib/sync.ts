import { z } from 'zod';
import { pool } from './db';
import { storedActivitySchema, type Activity } from '../types/activity';
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

    // Winning rows, written together below. Ids are unique per push, so one upsert is safe.
    const winnerIds: string[] = [];
    const winnerData: (string | null)[] = [];
    const winnerUpdatedAt: string[] = [];
    const winnerSeqs: number[] = [];

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

      winnerIds.push(change.id);
      winnerData.push(change.data === null ? null : JSON.stringify(change.data));
      winnerUpdatedAt.push(change.updatedAt);
      winnerSeqs.push(seq);
      response.applied.push({ id: change.id, seq });
    }

    if (winnerIds.length > 0) {
      await client.query(
        `INSERT INTO activities (user_id, id, data, client_updated_at, server_seq)
         SELECT $1, w.id, w.data, w.client_updated_at, w.server_seq
         FROM unnest($2::text[], $3::jsonb[], $4::timestamptz[], $5::bigint[])
           AS w(id, data, client_updated_at, server_seq)
         ON CONFLICT (user_id, id) DO UPDATE
           SET data = EXCLUDED.data,
               client_updated_at = EXCLUDED.client_updated_at,
               server_seq = EXCLUDED.server_seq`,
        [userId, winnerIds, winnerData, winnerUpdatedAt, winnerSeqs]
      );
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

const isoTimestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

const seqSchema = z.int().nonnegative();

const activityChangeSchema = z
  .object({
    id: z.string().min(1).max(200),
    data: storedActivitySchema
      .refine((activity) => JSON.stringify(activity).length <= MAX_ACTIVITY_BYTES)
      .nullable(),
    updatedAt: isoTimestampSchema,
    baseSeq: seqSchema,
  })
  .refine((change) => change.data === null || change.data.id === change.id) satisfies z.ZodType<ActivityChange>;

const goalChangeSchema = z.object({
  dailyGoalMinutes: z.int().positive(),
  updatedAt: isoTimestampSchema,
  baseSeq: seqSchema,
}) satisfies z.ZodType<GoalChange>;

/** A push body from a client. Each task appears at most once. */
export const pushRequestSchema = z
  .object({
    changes: z
      .array(activityChangeSchema)
      .max(MAX_CHANGES_PER_PUSH)
      .refine((changes) => new Set(changes.map((change) => change.id)).size === changes.length),
    goal: goalChangeSchema.nullish(),
  })
  .transform(({ changes, goal }): PushRequest => (goal ? { changes, goal } : { changes }));
