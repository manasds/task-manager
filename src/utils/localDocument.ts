import { DOCUMENT_SCHEMA_VERSION, PersistedDocument } from '../types/document';
import { emptyDocument, emptySyncMeta, isValidDocument, isValidSyncMeta, SyncMeta } from './syncPolicy';
import { loadActivities, loadDailyGoalMinutes, STORAGE_KEY, GOAL_STORAGE_KEY } from './storage';

const DOC_KEY_PREFIX = 'orbittask_doc_v2_';
const SYNC_KEY_PREFIX = 'orbittask_sync_v3_';

export function guestScope(): string {
  return 'guest';
}

export function documentKey(scope: string): string {
  return `${DOC_KEY_PREFIX}${scope}`;
}

/** Per-user sync bookkeeping. Survives reloads so unconfirmed edits are pushed later. */
export function loadSyncMeta(userId: string): SyncMeta {
  if (typeof window === 'undefined') return emptySyncMeta();
  try {
    const raw = localStorage.getItem(`${SYNC_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidSyncMeta(parsed)) return parsed;
    }
  } catch {
    // fall through
  }
  return emptySyncMeta();
}

export function saveSyncMeta(userId: string, meta: SyncMeta): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${SYNC_KEY_PREFIX}${userId}`, JSON.stringify(meta));
}

export function loadLocalDocument(scope: string): PersistedDocument {
  if (typeof window === 'undefined') return emptyDocument();
  try {
    const raw = localStorage.getItem(documentKey(scope));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidDocument(parsed)) return parsed;
    }

    if (scope === guestScope()) {
      const legacyActivities = loadActivities();
      if (legacyActivities.length > 0) {
        return {
          ...emptyDocument(),
          schemaVersion: DOCUMENT_SCHEMA_VERSION,
          dailyGoalMinutes: loadDailyGoalMinutes(),
          activities: legacyActivities,
          updatedAt: new Date().toISOString(),
        };
      }
    }
  } catch {
    // fall through
  }
  return emptyDocument();
}

export function saveLocalDocument(scope: string, document: PersistedDocument): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(documentKey(scope), JSON.stringify(document));
    if (scope === guestScope()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(document.activities));
      localStorage.setItem(GOAL_STORAGE_KEY, String(document.dailyGoalMinutes));
    }
  } catch (error) {
    throw error;
  }
}

export { STORAGE_KEY, GOAL_STORAGE_KEY };
