import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { signInWithGoogle, signOut } from '../auth/client';
import { pullChanges, pushChanges, pushChangesBeacon } from '../api/client';
import { CloudUser, PersistedDocument } from '../types/document';
import {
  GUEST_SCOPE,
  loadLocalDocument,
  loadSyncMeta,
  saveLocalDocument,
  saveSyncMeta,
  STARTER_ACTIVITY_ID,
} from '../utils/localDocument';
import {
  applyPull,
  applyPushResult,
  BACKGROUND_SYNC_INTERVAL_MS,
  buildPush,
  emptyDocument,
  emptySyncMeta,
  hasPending,
  isEmptyRemoteUpdate,
  recordLocalEdits,
  RemoteUpdate,
  seedPendingFromLocal,
  shouldSafetyFlush,
  SYNC_DELAY_AFTER_EDIT_MS,
  SyncMeta,
} from '../utils/syncPolicy';

export type SyncPhase = 'idle' | 'dirty' | 'flushing' | 'synced' | 'offline' | 'error';

/** Lets a signed-in user keep working on their own data when the app opens offline. */
const LAST_USER_KEY = 'orbittask_last_user';
/** Upper bound on push batches per sync so a busy editor cannot pin the loop. */
const MAX_PUSH_BATCHES = 20;
const OFFLINE_MESSAGE = 'Offline · changes are saved on this device';

function loadLastUser(): CloudUser | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    return raw ? (JSON.parse(raw) as CloudUser) : null;
  } catch {
    return null;
  }
}

function saveLastUser(user: CloudUser | null) {
  if (user) localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(LAST_USER_KEY);
}

/** A thrown fetch with no HTTP status never reached the server. */
function isNetworkFailure(error: unknown): boolean {
  return !navigator.onLine || typeof (error as { status?: unknown }).status !== 'number';
}

interface PersistenceState {
  user: CloudUser | null;
  authReady: boolean;
  phase: SyncPhase;
  lastError: string | null;
  lastSyncedAt: string | null;
}

/**
 * Local-first persistence with per-task cloud sync. Edits save to this device at once
 * and sync SYNC_DELAY_AFTER_EDIT_MS after the last edit. Other devices' changes are
 * pulled on sign-in, when the tab regains focus or comes back online, and every
 * BACKGROUND_SYNC_INTERVAL_MS while the tab is visible.
 * `onRemoteUpdate` receives server changes so the UI can merge them into its state.
 */
export function useSessionPersistence(
  onRemoteUpdate: (update: RemoteUpdate) => void,
  { initialUser, sessionError = false }: { initialUser: CloudUser | null; sessionError?: boolean }
) {
  const [state, setState] = useState<PersistenceState>({
    user: initialUser,
    authReady: false,
    phase: 'idle',
    lastError: null,
    lastSyncedAt: null,
  });

  const documentRef = useRef<PersistedDocument>(emptyDocument());
  const metaRef = useRef<SyncMeta>(emptySyncMeta());
  const userRef = useRef<CloudUser | null>(initialUser);
  /** The server's session read for this mount; later prop changes don't re-run setup. */
  const initialSessionRef = useRef({ initialUser, sessionError });
  const inFlightRef = useRef(false);
  const rerunRef = useRef(false);
  const lastAttemptRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const onRemoteRef = useRef(onRemoteUpdate);
  useLayoutEffect(() => {
    onRemoteRef.current = onRemoteUpdate;
  });

  const currentDocument = useCallback(() => documentRef.current, []);

  const saveMeta = useCallback((meta: SyncMeta) => {
    metaRef.current = meta;
    if (userRef.current) saveSyncMeta(userRef.current.id, meta);
  }, []);

  /** Store a sync result and hand any server changes to the UI in the same tick. */
  const commit = useCallback(
    (user: CloudUser, step: { doc: PersistedDocument; meta: SyncMeta; update: RemoteUpdate }) => {
      documentRef.current = step.doc;
      saveLocalDocument(user.id, step.doc);
      saveMeta(step.meta);
      if (!isEmptyRemoteUpdate(step.update)) onRemoteRef.current(step.update);
    },
    [saveMeta]
  );

  /** One push-then-pull pass. Returns false if the user changed mid-flight. */
  const syncOnce = useCallback(
    async (user: CloudUser): Promise<boolean> => {
      for (let batch = 0; batch < MAX_PUSH_BATCHES; batch += 1) {
        const push = buildPush(documentRef.current, metaRef.current);
        if (!push) break;
        const result = await pushChanges(push);
        if (userRef.current?.id !== user.id) return false;
        commit(user, applyPushResult(documentRef.current, metaRef.current, push, result));
      }
      for (;;) {
        const pull = await pullChanges(metaRef.current.cursor);
        if (userRef.current?.id !== user.id) return false;
        commit(user, applyPull(documentRef.current, metaRef.current, pull));
        if (!pull.hasMore) return true;
      }
    },
    [commit]
  );

  const sync = useCallback(async (): Promise<boolean> => {
    const user = userRef.current;
    if (!user) return false;
    if (inFlightRef.current) {
      rerunRef.current = true;
      return false;
    }
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    inFlightRef.current = true;
    lastAttemptRef.current = Date.now();
    setState((prev) => ({ ...prev, phase: 'flushing' }));
    try {
      let ok: boolean;
      do {
        rerunRef.current = false;
        ok = await syncOnce(user);
      } while (ok && rerunRef.current);
      if (!ok) return false;

      setState((prev) => ({
        ...prev,
        phase: hasPending(metaRef.current) ? 'dirty' : 'synced',
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      }));
      return true;
    } catch (error) {
      const offline = isNetworkFailure(error);
      const status = (error as { status?: number }).status;
      setState((prev) => ({
        ...prev,
        phase: offline ? 'offline' : 'error',
        lastError: offline
          ? OFFLINE_MESSAGE
          : status === 401
            ? 'Your session expired. Sign in again to sync.'
            : (error as Error).message || 'Cloud sync failed. Work is still on this device.',
      }));
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [syncOnce]);

  const persistLocal = useCallback(
    (document: PersistedDocument, markDirty: boolean) => {
      const previous = documentRef.current;
      documentRef.current = document;
      const user = userRef.current;
      try {
        saveLocalDocument(user?.id ?? GUEST_SCOPE, document);
      } catch {
        setState((prev) => ({
          ...prev,
          lastError: 'This device could not save locally (storage full?)',
          phase: 'error',
        }));
        return;
      }
      if (!markDirty || !user) return;

      const meta = recordLocalEdits(metaRef.current, previous, document);
      if (meta === metaRef.current) return;
      saveMeta(meta);
      setState((prev) => ({ ...prev, phase: prev.phase === 'flushing' ? prev.phase : 'dirty' }));
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void sync();
      }, SYNC_DELAY_AFTER_EDIT_MS);
    },
    [saveMeta, sync]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let user: CloudUser | null;
      let phase: SyncPhase = 'idle';
      let lastError: string | null = null;
      const { initialUser, sessionError } = initialSessionRef.current;
      if (sessionError || (!initialUser && !navigator.onLine)) {
        // Keep the last signed-in user's board usable until the server is reachable.
        user = loadLastUser();
        const offline = !navigator.onLine;
        phase = offline ? 'offline' : 'error';
        lastError = offline ? OFFLINE_MESSAGE : 'Could not reach the sync server. Work is saved on this device.';
      } else {
        user = initialUser;
        saveLastUser(user);
      }
      if (cancelled) return;
      userRef.current = user;

      if (!user) {
        documentRef.current = loadLocalDocument(GUEST_SCOPE);
        setState((prev) => ({ ...prev, user: null, authReady: true, phase, lastError }));
        return;
      }

      let local = loadLocalDocument(user.id);
      let meta = loadSyncMeta(user.id);
      if (!meta.initialized) {
        // First sign-in on this device: bring along real guest work, not the untouched starter task.
        if (local.activities.length === 0) {
          const guest = loadLocalDocument(GUEST_SCOPE);
          const adopted = guest.activities.filter((a) => a.id !== STARTER_ACTIVITY_ID || a.updatedAt);
          if (adopted.length > 0) {
            local = { ...local, activities: adopted, dailyGoalMinutes: guest.dailyGoalMinutes };
          }
        }
        meta = { ...seedPendingFromLocal(local, emptySyncMeta()), initialized: true };
      }

      documentRef.current = local;
      saveLocalDocument(user.id, local);
      saveMeta(meta);
      if (phase === 'idle' && hasPending(meta)) phase = 'dirty';
      setState((prev) => ({ ...prev, user, authReady: true, phase, lastError }));
      if (!lastError) void sync();
    })();
    return () => {
      cancelled = true;
    };
  }, [saveMeta, sync]);

  useEffect(() => {
    /** Tab is closing or hiding: best-effort push without waiting for an answer. */
    const beaconPush = () => {
      if (!userRef.current) return;
      const push = buildPush(documentRef.current, metaRef.current);
      if (push) pushChangesBeacon(push);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') beaconPush();
      else void sync();
    };
    const onOnline = () => {
      void sync();
    };
    const onOffline = () => {
      if (!userRef.current) return;
      setState((prev) => ({ ...prev, phase: 'offline', lastError: OFFLINE_MESSAGE }));
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', beaconPush);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const interval = window.setInterval(() => {
      const wanted = hasPending(metaRef.current) || document.visibilityState === 'visible';
      if (shouldSafetyFlush(Date.now(), lastAttemptRef.current, wanted, inFlightRef.current)) {
        void sync();
      }
    }, BACKGROUND_SYNC_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', beaconPush);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(interval);
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [sync]);

  /** Push pending edits, end the session, and forget the user. The caller reloads the page. */
  const logout = useCallback(async () => {
    if (hasPending(metaRef.current)) await sync();
    await signOut();
    saveLastUser(null);
  }, [sync]);

  return {
    ...state,
    currentDocument,
    persistLocal,
    retrySync: sync,
    signIn: signInWithGoogle,
    logout,
  };
}
