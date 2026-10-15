import { DOCUMENT_SCHEMA_VERSION, PersistedDocument } from '../types/document';
import { emptyDocument, isValidDocument } from './syncPolicy';
import { loadActivities, loadDailyGoalMinutes, STORAGE_KEY, GOAL_STORAGE_KEY } from './storage';

const DOC_KEY_PREFIX = 'orbittask_doc_v2_';
const REVISION_KEY_PREFIX = 'orbittask_revision_v2_';

export function guestScope(): string {
  return 'guest';
}

export function documentKey(scope: string): string {
  return `${DOC_KEY_PREFIX}${scope}`;
}

export function revisionKey(scope: string): string {
  return `${REVISION_KEY_PREFIX}${scope}`;
}

export function loadLocalRevision(scope: string): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(revisionKey(scope));
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function saveLocalRevision(scope: string, revision: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(revisionKey(scope), String(revision));
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
