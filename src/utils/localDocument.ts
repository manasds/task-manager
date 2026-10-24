import { Activity } from '../types/activity';
import { PersistedDocument } from '../types/document';
import { getTodayDateString } from './dates';
import { emptyDocument, emptySyncMeta, isValidDocument, isValidSyncMeta, SyncMeta } from './syncPolicy';

const DOC_KEY_PREFIX = 'orbittask_doc_v2_';
const SYNC_KEY_PREFIX = 'orbittask_sync_v3_';

/** Storage scope for work done while signed out. */
export const GUEST_SCOPE = 'guest';

/** The one task a brand-new browser starts with. Not copied into an account unless edited. */
export const STARTER_ACTIVITY_ID = 'starter-task';

function starterActivity(): Activity {
  return {
    id: STARTER_ACTIVITY_ID,
    title: 'Plan your first focus session',
    description:
      'Drag this card across the board, start a focus timer, or log time you already worked. Delete it when you are ready.',
    category: 'build',
    priority: 'medium',
    status: 'backlog',
    estimatedMinutes: 25,
    actualMinutes: 0,
    date: getTodayDateString(),
    subtasks: [],
    tags: [],
    createdAt: new Date().toISOString(),
  };
}

/** Per-user sync bookkeeping. Survives reloads so unconfirmed edits are pushed later. */
export function loadSyncMeta(userId: string): SyncMeta {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`${SYNC_KEY_PREFIX}${userId}`) ?? 'null');

    if (isValidSyncMeta(parsed)) return parsed;
  } catch {
    // Corrupt entry: start bookkeeping over.
  }

  return emptySyncMeta();
}

export function saveSyncMeta(userId: string, meta: SyncMeta): void {
  localStorage.setItem(`${SYNC_KEY_PREFIX}${userId}`, JSON.stringify(meta));
}

export function loadLocalDocument(scope: string): PersistedDocument {
  const raw = localStorage.getItem(`${DOC_KEY_PREFIX}${scope}`);

  if (raw === null) {
    const doc = emptyDocument();

    return scope === GUEST_SCOPE ? { ...doc, activities: [starterActivity()] } : doc;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (isValidDocument(parsed)) return parsed;
  } catch {
    // Corrupt entry: fall back to an empty board.
  }

  return emptyDocument();
}

export function saveLocalDocument(scope: string, document: PersistedDocument): void {
  localStorage.setItem(`${DOC_KEY_PREFIX}${scope}`, JSON.stringify(document));
}
