import { z } from 'zod';
import { Activity } from '../types/activity';
import { DOCUMENT_SCHEMA_VERSION, PersistedDocument } from '../types/document';
import {
  ActivityRow,
  MAX_CHANGES_PER_PUSH,
  PullResponse,
  PushRequest,
  PushResponse,
} from '../types/sync';

// Sync timing. Change these two values to tune how often the app talks to the server.

/**
 * Wait this long after the last edit, then sync once. Every new edit restarts the wait,
 * so a burst of edits becomes one sync. There is no sync while nothing changes.
 */
export const SYNC_DELAY_AFTER_EDIT_MS = 1_500;

/** While the tab is visible, pull other devices' changes (and retry failed pushes) this often. */
export const BACKGROUND_SYNC_INTERVAL_MS = 60_000;

/** A local edit not yet confirmed by the server. `at` is unique and increasing per task. */
export interface PendingEdit {
  at: string;
}

/** Per-user sync bookkeeping kept next to the local document. */
export interface SyncMeta {
  initialized: boolean;
  /** Last pulled server seq. */
  cursor: number;
  /** Server seq last seen per live task, sent back as baseSeq. */
  seqs: Record<string, number>;
  pending: Record<string, PendingEdit>;
  goalSeq: number;
  goalPending: PendingEdit | null;
}

export function emptySyncMeta(): SyncMeta {
  return { initialized: false, cursor: 0, seqs: {}, pending: {}, goalSeq: 0, goalPending: null };
}

export function hasPending(meta: SyncMeta): boolean {
  return meta.goalPending !== null || Object.keys(meta.pending).length > 0;
}

export function shouldSafetyFlush(
  nowMs: number,
  lastAttemptMs: number,
  dirty: boolean,
  inFlight: boolean
): boolean {
  if (!dirty || inFlight) return false;

  return nowMs - lastAttemptMs >= BACKGROUND_SYNC_INTERVAL_MS;
}

export function emptyDocument(nowIso = new Date().toISOString()): PersistedDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    dailyGoalMinutes: 360,
    settings: { lastTab: 'board' },
    activities: [],
    timer: null,
    updatedAt: nowIso,
  };
}

export function activityTimestamp(activity: Activity): string {
  return activity.updatedAt || activity.completedAt || activity.createdAt;
}

/** Strictly after `previous` so two quick edits never share a marker. */
function nextEditMarker(nowIso: string, previous?: PendingEdit | null): PendingEdit {
  if (!previous) return { at: nowIso };
  const prevMs = Date.parse(previous.at);
  const nowMs = Date.parse(nowIso);

  return { at: new Date(Math.max(nowMs, prevMs + 1)).toISOString() };
}

/** Task ids added, edited or removed between two local snapshots. */
export function diffActivities(prev: Activity[], next: Activity[]): string[] {
  const before = new Map(prev.map((a) => [a.id, a]));
  const changed: string[] = [];

  for (const activity of next) {
    const old = before.get(activity.id);
    before.delete(activity.id);

    if (old === activity) continue;

    if (old && JSON.stringify(old) === JSON.stringify(activity)) continue;
    changed.push(activity.id);
  }

  for (const id of before.keys()) changed.push(id);

  return changed;
}

/** Record local edits. UI-only settings (tab, date) never sync. */
export function recordLocalEdits(
  meta: SyncMeta,
  prev: PersistedDocument,
  next: PersistedDocument,
  nowIso = new Date().toISOString()
): SyncMeta {
  const changed = diffActivities(prev.activities, next.activities);
  const goalChanged = prev.dailyGoalMinutes !== next.dailyGoalMinutes;

  if (changed.length === 0 && !goalChanged) return meta;

  const pending = { ...meta.pending };

  for (const id of changed) pending[id] = nextEditMarker(nowIso, pending[id]);

  return {
    ...meta,
    pending,
    goalPending: goalChanged ? nextEditMarker(nowIso, meta.goalPending) : meta.goalPending,
  };
}

/** First sync on this device: every local task is a candidate edit at its own timestamp. */
export function seedPendingFromLocal(doc: PersistedDocument, meta: SyncMeta): SyncMeta {
  const pending: Record<string, PendingEdit> = {};

  for (const activity of doc.activities) pending[activity.id] = { at: activityTimestamp(activity) };
  const goalPending = doc.dailyGoalMinutes !== emptyDocument().dailyGoalMinutes ? { at: doc.updatedAt } : null;

  return { ...meta, pending, goalPending };
}

/** Next push batch, or null when there is nothing to send. */
export function buildPush(doc: PersistedDocument, meta: SyncMeta): PushRequest | null {
  const byId = new Map(doc.activities.map((a) => [a.id, a]));

  const changes = Object.entries(meta.pending)
    .slice(0, MAX_CHANGES_PER_PUSH)
    .map(([id, edit]) => ({
      id,
      data: byId.get(id) ?? null,
      updatedAt: edit.at,
      baseSeq: meta.seqs[id] ?? 0,
    }));

  const goal = meta.goalPending
    ? { dailyGoalMinutes: doc.dailyGoalMinutes, updatedAt: meta.goalPending.at, baseSeq: meta.goalSeq }
    : undefined;

  if (changes.length === 0 && !goal) return null;

  return goal ? { changes, goal } : { changes };
}

export interface RemoteUpdate {
  upserts: Activity[];
  deletes: string[];
  dailyGoalMinutes?: number;
}

export function isEmptyRemoteUpdate(update: RemoteUpdate): boolean {
  return update.upserts.length === 0 && update.deletes.length === 0 && update.dailyGoalMinutes === undefined;
}

/** Apply a remote update to a list of tasks. Same function for the hook and the UI state. */
export function applyRemoteActivities(activities: Activity[], update: RemoteUpdate): Activity[] {
  if (update.upserts.length === 0 && update.deletes.length === 0) return activities;
  const removed = new Set(update.deletes);
  const upserts = new Map(update.upserts.map((a) => [a.id, a]));
  const next: Activity[] = [];

  for (const activity of activities) {
    if (removed.has(activity.id)) continue;
    const replacement = upserts.get(activity.id);

    if (replacement) {
      next.push(replacement);
      upserts.delete(activity.id);
    } else {
      next.push(activity);
    }
  }

  return [...upserts.values(), ...next];
}

interface SyncStep {
  doc: PersistedDocument;
  meta: SyncMeta;
  update: RemoteUpdate;
}

function adoptRow(meta: SyncMeta, update: RemoteUpdate, row: ActivityRow) {
  if (row.data) {
    update.upserts.push(row.data);
    meta.seqs[row.id] = row.seq;
  } else {
    update.deletes.push(row.id);
    delete meta.seqs[row.id];
  }

  delete meta.pending[row.id];
}

function finish(doc: PersistedDocument, meta: SyncMeta, update: RemoteUpdate): SyncStep {
  const activities = applyRemoteActivities(doc.activities, update);
  const dailyGoalMinutes = update.dailyGoalMinutes ?? doc.dailyGoalMinutes;

  if (activities === doc.activities && dailyGoalMinutes === doc.dailyGoalMinutes) {
    return { doc, meta, update };
  }

  return { doc: { ...doc, activities, dailyGoalMinutes }, meta, update };
}

/**
 * Merge a pull page. A task with a pending local edit keeps the local copy unless
 * the server copy is newer. An exact timestamp match is this device's own write
 * coming back (for example a tab-close beacon), so it counts as confirmed.
 */
export function applyPull(doc: PersistedDocument, current: SyncMeta, pull: PullResponse): SyncStep {
  const meta: SyncMeta = {
    ...current,
    seqs: { ...current.seqs },
    pending: { ...current.pending },
    cursor: pull.cursor,
  };

  const update: RemoteUpdate = { upserts: [], deletes: [] };

  for (const row of pull.rows) {
    const edit = meta.pending[row.id];

    if (edit) {
      const serverMs = Date.parse(row.updatedAt);
      const localMs = Date.parse(edit.at);

      if (serverMs < localMs) continue;

      if (serverMs === localMs) {
        if (row.data) meta.seqs[row.id] = row.seq;
        else delete meta.seqs[row.id];
        delete meta.pending[row.id];
        continue;
      }
    }

    adoptRow(meta, update, row);
  }

  if (pull.goal) {
    const goalEdit = meta.goalPending;
    const serverMs = Date.parse(pull.goal.updatedAt);

    if (!goalEdit || serverMs >= Date.parse(goalEdit.at)) {
      if (!goalEdit || serverMs > Date.parse(goalEdit.at)) {
        update.dailyGoalMinutes = pull.goal.dailyGoalMinutes;
      }

      meta.goalSeq = pull.goal.seq;
      meta.goalPending = null;
    }
  }

  return finish(doc, meta, update);
}

/**
 * Settle a push. An edit made after the batch was built keeps its newer marker
 * and stays pending, so it goes out in the next push.
 */
export function applyPushResult(
  doc: PersistedDocument,
  current: SyncMeta,
  sent: PushRequest,
  result: PushResponse
): SyncStep {
  const meta: SyncMeta = { ...current, seqs: { ...current.seqs }, pending: { ...current.pending } };
  const update: RemoteUpdate = { upserts: [], deletes: [] };
  const sentAt = new Map(sent.changes.map((c) => [c.id, c]));

  for (const { id, seq } of result.applied) {
    const change = sentAt.get(id);

    if (change?.data) meta.seqs[id] = seq;
    else delete meta.seqs[id];

    if (change && meta.pending[id]?.at === change.updatedAt) delete meta.pending[id];
  }

  for (const row of result.rejected) {
    const change = sentAt.get(row.id);

    if (change && meta.pending[row.id]?.at === change.updatedAt) {
      adoptRow(meta, update, row);
    } else {
      meta.seqs[row.id] = row.seq;
    }
  }

  const goalSentAt = sent.goal?.updatedAt;
  const goalUnchanged = goalSentAt !== undefined && meta.goalPending?.at === goalSentAt;

  if (result.goalApplied) {
    meta.goalSeq = result.goalApplied.seq;

    if (goalUnchanged) meta.goalPending = null;
  }

  if (result.goalRejected) {
    meta.goalSeq = result.goalRejected.seq;

    if (goalUnchanged) {
      meta.goalPending = null;
      update.dailyGoalMinutes = result.goalRejected.dailyGoalMinutes;
    }
  }

  return finish(doc, meta, update);
}

const savedDocumentSchema = z.looseObject({
  schemaVersion: z.number(),
  dailyGoalMinutes: z.number(),
  activities: z.array(z.unknown()),
  settings: z.looseObject({}),
  updatedAt: z.string(),
});

const savedSyncMetaSchema = z.looseObject({
  initialized: z.boolean(),
  cursor: z.number(),
  seqs: z.looseObject({}),
  pending: z.looseObject({}),
  goalSeq: z.number(),
});

export function isValidDocument(value: unknown): value is PersistedDocument {
  return savedDocumentSchema.safeParse(value).success;
}

export function isValidSyncMeta(value: unknown): value is SyncMeta {
  return savedSyncMetaSchema.safeParse(value).success;
}
