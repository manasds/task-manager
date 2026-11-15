import { z } from 'zod';
import { pool } from './db';
import { LimitError, MAX_TASKS_PER_USER } from './limits';
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

/** A pull reads the sync state and a page of rows together; either side is null when missing. */
interface DbPullRow {
  seq: string | null;
  daily_goal_minutes: number | null;
  goal_updated_at: Date | null;
  goal_seq: string | null;
  id: string | null;
  data: Activity | null;
  client_updated_at: Date | null;
  server_seq: string | null;
}

/**
 * Everything that changed for this user after `since`. One statement, so the rows and the
 * sync state come from one snapshot and the pull is a single round trip.
 */
export async function pullChanges(userId: string, since: number): Promise<PullResponse> {
  const result = await pool.query<DbPullRow>(
    `SELECT s.seq, s.daily_goal_minutes, s.goal_updated_at, s.goal_seq,
            a.id, a.data, a.client_updated_at, a.server_seq
     FROM (SELECT $1::text AS user_id) u
     LEFT JOIN user_sync_state s ON s.user_id = u.user_id
     LEFT JOIN LATERAL (
       SELECT id, data, client_updated_at, server_seq
       FROM activities
       WHERE user_id = u.user_id AND server_seq > $2
       ORDER BY server_seq
       LIMIT $3
     ) a ON true
     ORDER BY a.server_seq`,
    [userId, since, PULL_PAGE_SIZE + 1]
  );

  const rows = result.rows.flatMap((row) =>
    row.id !== null && row.client_updated_at !== null && row.server_seq !== null
      ? [toRow({ id: row.id, data: row.data, client_updated_at: row.client_updated_at, server_seq: row.server_seq })]
      : []
  );

  // The outer select always yields a row, which carries the state when the user has one.
  const first = result.rows[0];

  const stateRow: DbSyncState | null =
    first && first.seq !== null
      ? {
          seq: first.seq,
          daily_goal_minutes: first.daily_goal_minutes,
          goal_updated_at: first.goal_updated_at,
          goal_seq: first.goal_seq ?? '0',
        }
      : null;

  const hasMore = rows.length > PULL_PAGE_SIZE;
  const page = rows.slice(0, PULL_PAGE_SIZE);
  const goal = stateRow && Number(stateRow.goal_seq) > since ? toGoal(stateRow) : null;

  let cursor = since;

  if (hasMore) {
    cursor = page[page.length - 1].seq;
  } else if (stateRow) {
    cursor = Math.max(since, Number(stateRow.seq));
  }

  return { rows: page, goal, cursor, hasMore };
}

interface DbExistingRow {
  /** The user's live (not deleted) tasks before this push. */
  live: number;
  id: string | null;
  data: Activity | null;
  client_updated_at: Date | null;
  server_seq: string | null;
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

    // Creates the state row on a first push and locks it either way, so a user's pushes run
    // one at a time and their seqs commit in order. A waiting push gets the committed state.
    const stateResult = await client.query<DbSyncState>(
      `INSERT INTO user_sync_state (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING seq, daily_goal_minutes, goal_updated_at, goal_seq`,
      [userId]
    );

    const state = stateResult.rows[0];
    const startSeq = Number(state.seq);
    let seq = startSeq;

    const response: PushResponse = { applied: [], rejected: [], goalApplied: null, goalRejected: null };

    const ids = request.changes.map((c) => c.id);

    // A separate statement from the lock above, so it sees what the push before this one wrote.
    const existing = await client.query<DbExistingRow>(
      `SELECT n.live, a.id, a.data, a.client_updated_at, a.server_seq
       FROM (SELECT count(*)::int AS live FROM activities WHERE user_id = $1 AND data IS NOT NULL) n
       LEFT JOIN activities a ON a.user_id = $1 AND a.id = ANY($2::text[])`,
      [userId, ids]
    );

    const live = existing.rows[0]?.live ?? 0;

    const currentById = new Map(
      existing.rows.flatMap((row): [string, DbActivityRow][] =>
        row.id !== null && row.client_updated_at !== null && row.server_seq !== null
          ? [[row.id, { id: row.id, data: row.data, client_updated_at: row.client_updated_at, server_seq: row.server_seq }]]
          : []
      )
    );

    /** How many live tasks this push adds: creates minus deletes. */
    let liveDelta = 0;

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

      if (change.data !== null && !current?.data) liveDelta += 1;

      if (change.data === null && current?.data) liveDelta -= 1;

      winnerIds.push(change.id);
      winnerData.push(change.data === null ? null : JSON.stringify(change.data));
      winnerUpdatedAt.push(change.updatedAt);
      winnerSeqs.push(seq);
      response.applied.push({ id: change.id, seq });
    }

    // Deletes in the same push count against the creates, so clearing old tasks makes room.
    if (liveDelta > 0 && live + liveDelta > MAX_TASKS_PER_USER) {
      throw new LimitError(
        `Your account is at its limit of ${MAX_TASKS_PER_USER.toLocaleString('en-US')} tasks. Delete some tasks to keep syncing.`
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

    // Every applied task or goal took a seq, so an unchanged seq means there is nothing to write.
    // Postgres runs a writing CTE to completion even though nothing reads it.
    if (seq !== startSeq) {
      await client.query(
        `WITH written AS (
           INSERT INTO activities (user_id, id, data, client_updated_at, server_seq)
           SELECT $1, w.id, w.data, w.client_updated_at, w.server_seq
           FROM unnest($2::text[], $3::jsonb[], $4::timestamptz[], $5::bigint[])
             AS w(id, data, client_updated_at, server_seq)
           ON CONFLICT (user_id, id) DO UPDATE
             SET data = EXCLUDED.data,
                 client_updated_at = EXCLUDED.client_updated_at,
                 server_seq = EXCLUDED.server_seq
         )
         UPDATE user_sync_state
         SET seq = $6, daily_goal_minutes = $7, goal_updated_at = $8, goal_seq = $9
         WHERE user_id = $1`,
        [userId, winnerIds, winnerData, winnerUpdatedAt, winnerSeqs, seq, goalMinutes, goalUpdatedAt, goalSeq]
      );
    }

    await client.query('COMMIT');

    return response;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Postgres can't read every date string Date.parse can, so it is passed on as a plain ISO timestamp. */
const isoTimestampSchema = z
  .string()
  .max(64)
  .refine((value) => {
    const year = new Date(value).getUTCFullYear();

    return year >= 1970 && year <= 9999;
  })
  .transform((value) => new Date(value).toISOString());

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
