import { Activity } from '../types/activity';
import { DOCUMENT_SCHEMA_VERSION, PersistedDocument } from '../types/document';

/** Safety net: mobile and crashed tabs often skip pagehide. */
export const SAFETY_FLUSH_MS = 60_000;

export function shouldFlushOnSessionEnd(
  pageHidden: boolean,
  dirty: boolean,
  inFlight: boolean
): boolean {
  return pageHidden && dirty && !inFlight;
}

export function shouldSafetyFlush(
  nowMs: number,
  lastAttemptMs: number,
  dirty: boolean,
  inFlight: boolean
): boolean {
  if (!dirty || inFlight) return false;
  return nowMs - lastAttemptMs >= SAFETY_FLUSH_MS;
}

export function emptyDocument(nowIso = new Date().toISOString()): PersistedDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    dailyGoalMinutes: 360,
    settings: { muted: false, lastTab: 'board' },
    activities: [],
    deletedIds: [],
    timer: null,
    updatedAt: nowIso,
  };
}

export function isLikelyDemoDocument(doc: PersistedDocument): boolean {
  if (doc.activities.length === 0) return false;
  return doc.activities.every(
    (a) => a.id.startsWith('act-') || a.id.startsWith('act-hist-')
  );
}

function activityTimestamp(activity: Activity): number {
  const raw = activity.updatedAt || activity.completedAt || activity.createdAt;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Merge two session snapshots. Newer activity wins per id.
 * IDs listed in either deletedIds stay deleted so a stale device
 * cannot resurrect a completed delete after a later flush.
 */
export function mergeDocuments(
  local: PersistedDocument,
  server: PersistedDocument
): PersistedDocument {
  const deleted = new Set([...local.deletedIds, ...server.deletedIds]);
  const byId = new Map<string, Activity>();

  for (const activity of server.activities) {
    if (!deleted.has(activity.id)) byId.set(activity.id, activity);
  }

  for (const activity of local.activities) {
    if (deleted.has(activity.id)) continue;
    const existing = byId.get(activity.id);
    if (!existing || activityTimestamp(activity) >= activityTimestamp(existing)) {
      byId.set(activity.id, activity);
    }
  }

  const localNewer = Date.parse(local.updatedAt) >= Date.parse(server.updatedAt);
  const newer = localNewer ? local : server;

  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    dailyGoalMinutes: newer.dailyGoalMinutes,
    settings: newer.settings,
    activities: Array.from(byId.values()),
    deletedIds: Array.from(deleted),
    timer: newer.timer,
    updatedAt: new Date().toISOString(),
  };
}

export function isValidDocument(value: unknown): value is PersistedDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as PersistedDocument;
  return (
    typeof doc.schemaVersion === 'number' &&
    typeof doc.dailyGoalMinutes === 'number' &&
    Array.isArray(doc.activities) &&
    Array.isArray(doc.deletedIds) &&
    !!doc.settings &&
    typeof doc.updatedAt === 'string'
  );
}
