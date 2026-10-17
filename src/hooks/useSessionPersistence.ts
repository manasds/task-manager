import { useCallback, useEffect, useRef, useState } from 'react';
import { signInWithGoogle, signOutGoogle } from '../auth/client';
import { fetchMe, pullChanges, pushChanges, pushChangesBeacon } from '../api/client';
import { CloudUser, FlushReason, PersistedDocument } from '../types/document';
import {
  guestScope,
  loadLocalDocument,
  loadSyncMeta,
  saveLocalDocument,
  saveSyncMeta,
} from '../utils/localDocument';
import {
  applyPull,
  applyPushResult,
  buildPush,
  emptyDocument,
  emptySyncMeta,
  hasPending,
  isEmptyRemoteUpdate,
  isLikelyDemoDocument,
  recordLocalEdits,
  RemoteUpdate,
  SAFETY_FLUSH_MS,
  seedPendingFromLocal,
  shouldSafetyFlush,
  SYNC_DEBOUNCE_MS,
  SyncMeta,
} from '../utils/syncPolicy';

export type SyncPhase = 'idle' | 'dirty' | 'flushing' | 'synced' | 'offline' | 'error';

/** Local-only mode. Flip to true to resume /api/me and /api/sync. */
const CLOUD_SYNC_ENABLED = false;

/** Lets a signed-in user keep working on their own data when the app opens offline. */
const LAST_USER_KEY = 'orbittask_last_user';
/** Upper bound on push batches per sync so a busy editor cannot pin the loop. */
const MAX_PUSH_BATCHES = 20;

function loadLastUser(): CloudUser | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    return raw ? (JSON.parse(raw) as CloudUser) : null;
  } catch {
    return null;
  }
}

function saveLastUser(user: CloudUser | null) {
  try {
    if (user) localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // storage full or blocked; offline sign-in memory is best effort
  }
}

interface PersistenceState {
  user: CloudUser | null;
  authReady: boolean;
  dirty: boolean;
  phase: SyncPhase;
  lastError: string | null;
  lastFlushReason: FlushReason | null;
  lastSyncedAt: string | null;
}

/**
 * Local-first persistence with per-task cloud sync. Edits save to this device at
 * once, push about 1.5s later, and other devices' changes are pulled when the tab
 * regains focus, comes back online, or once a minute while visible.
 * `onRemoteUpdate` receives server changes so the UI can merge them into its state.
 */
export function useSessionPersistence(onRemoteUpdate: (update: RemoteUpdate) => void) {
  const [state, setState] = useState<PersistenceState>({
    user: null,
    authReady: false,
    dirty: false,
    phase: 'idle',
    lastError: null,
    lastFlushReason: null,
    lastSyncedAt: null,
  });

  const documentRef = useRef<PersistedDocument>(emptyDocument());
  const metaRef = useRef<SyncMeta>(emptySyncMeta());
  const userRef = useRef<CloudUser | null>(null);
  const inFlightRef = useRef(false);
  const rerunRef = useRef<FlushReason | null>(null);
  const lastAttemptRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const onRemoteRef = useRef(onRemoteUpdate);
  onRemoteRef.current = onRemoteUpdate;

  const scopeFor = (user: CloudUser | null) => user?.id ?? guestScope();

  const saveMeta = (meta: SyncMeta) => {
    metaRef.current = meta;
    if (userRef.current) saveSyncMeta(userRef.current.id, meta);
  };

  /** Store a sync result and hand any server changes to the UI in the same tick. */
  const commit = (step: { doc: PersistedDocument; meta: SyncMeta; update: RemoteUpdate }) => {
    const user = userRef.current;
    if (!user) return;
    documentRef.current = step.doc;
    saveLocalDocument(user.id, step.doc);
    saveMeta(step.meta);
    if (!isEmptyRemoteUpdate(step.update)) onRemoteRef.current(step.update);
  };

  const sync = useCallback(async (reason: FlushReason): Promise<boolean> => {
    if (!CLOUD_SYNC_ENABLED) return false;
    const user = userRef.current;
    if (!user) return false;
    if (inFlightRef.current) {
      rerunRef.current = reason;
      return false;
    }
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    inFlightRef.current = true;
    lastAttemptRef.current = Date.now();
    setState((prev) => ({ ...prev, phase: 'flushing', lastFlushReason: reason }));

    let ok = false;
    try {
      for (let batch = 0; batch < MAX_PUSH_BATCHES; batch += 1) {
        const push = buildPush(documentRef.current, metaRef.current);
        if (!push) break;
        const result = await pushChanges(push);
        if (userRef.current?.id !== user.id) return false;
        commit(applyPushResult(documentRef.current, metaRef.current, push, result));
      }

      for (;;) {
        const pull = await pullChanges(metaRef.current.cursor);
        if (userRef.current?.id !== user.id) return false;
        commit(applyPull(documentRef.current, metaRef.current, pull));
        if (!pull.hasMore) break;
      }

      const dirty = hasPending(metaRef.current);
      setState((prev) => ({
        ...prev,
        dirty,
        phase: dirty ? 'dirty' : 'synced',
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      }));
      ok = true;
    } catch (error) {
      const err = error as Error & { status?: number };
      const message =
        err.status === 401
          ? 'Your session expired. Sign in again to sync.'
          : err.message || 'Cloud sync failed. Work is still on this device.';
      setState((prev) => ({
        ...prev,
        dirty: hasPending(metaRef.current),
        phase: navigator.onLine ? 'error' : 'offline',
        lastError: navigator.onLine ? message : 'Offline · changes are saved on this device',
      }));
    } finally {
      inFlightRef.current = false;
    }

    const rerun = rerunRef.current;
    rerunRef.current = null;
    if (rerun && ok) void sync(rerun);
    return ok;
  }, []);

  const persistLocal = useCallback(
    (document: PersistedDocument, markDirty: boolean) => {
      const previous = documentRef.current;
      documentRef.current = document;
      const user = userRef.current;
      try {
        saveLocalDocument(scopeFor(user), document);
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
      setState((prev) => ({
        ...prev,
        dirty: true,
        phase: prev.phase === 'flushing' ? prev.phase : 'dirty',
      }));
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void sync('edit');
      }, SYNC_DEBOUNCE_MS);
    },
    [sync]
  );

  /** Tab is closing or hiding: best-effort push without waiting for an answer. */
  const beaconPush = useCallback(() => {
    if (!CLOUD_SYNC_ENABLED) return;
    if (!userRef.current) return;
    const push = buildPush(documentRef.current, metaRef.current);
    if (push) pushChangesBeacon(push);
  }, []);

  const bootstrap = useCallback(async () => {
    let user: CloudUser | null;
    let online = true;
    if (!CLOUD_SYNC_ENABLED) {
      user = loadLastUser();
      online = false;
    } else {
      try {
        user = (await fetchMe()).user;
        saveLastUser(user);
      } catch {
        online = false;
        user = loadLastUser();
      }
    }
    userRef.current = user;

    if (!user) {
      const guest = loadLocalDocument(guestScope());
      documentRef.current = guest;
      setState((prev) => ({
        ...prev,
        user: null,
        authReady: true,
        phase: online ? 'idle' : 'offline',
      }));
      return guest;
    }

    let local = loadLocalDocument(user.id);
    let meta = loadSyncMeta(user.id);
    if (!meta.initialized) {
      if (local.activities.length === 0) {
        const guest = loadLocalDocument(guestScope());
        if (guest.activities.length > 0 && !isLikelyDemoDocument(guest)) {
          local = {
            ...local,
            activities: guest.activities,
            dailyGoalMinutes: guest.dailyGoalMinutes,
            updatedAt: guest.updatedAt,
          };
        }
      }
      meta = { ...seedPendingFromLocal(local, emptySyncMeta()), initialized: true };
    }

    documentRef.current = local;
    saveLocalDocument(user.id, local);
    saveMeta(meta);
    const dirty = hasPending(meta);
    setState((prev) => ({
      ...prev,
      user,
      authReady: true,
      dirty,
      phase: online ? (dirty ? 'dirty' : 'idle') : 'offline',
      lastError: online ? null : 'Offline · changes are saved on this device',
    }));
    if (online) void sync('sign_in');
    return local;
  }, [sync]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (hasPending(metaRef.current)) beaconPush();
      } else {
        void sync('focus');
      }
    };
    const onPageHide = () => {
      if (hasPending(metaRef.current)) beaconPush();
    };
    const onOnline = () => {
      void sync('online');
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);

    const interval = window.setInterval(() => {
      const wanted = hasPending(metaRef.current) || document.visibilityState === 'visible';
      if (shouldSafetyFlush(Date.now(), lastAttemptRef.current, wanted, inFlightRef.current)) {
        void sync('safety_interval');
      }
    }, SAFETY_FLUSH_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [sync, beaconPush]);

  const startGoogleSignIn = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const logout = useCallback(async () => {
    if (hasPending(metaRef.current)) {
      await sync('explicit');
    }
    await signOutGoogle();
    saveLastUser(null);
    userRef.current = null;
    metaRef.current = emptySyncMeta();
    const guest = loadLocalDocument(guestScope());
    documentRef.current = guest;
    setState((prev) => ({
      ...prev,
      user: null,
      authReady: true,
      dirty: false,
      phase: 'idle',
      lastError: null,
      lastFlushReason: null,
      lastSyncedAt: null,
    }));
    return guest;
  }, [sync]);

  return {
    ...state,
    currentDocument: () => documentRef.current,
    persistLocal,
    flush: sync,
    startGoogleSignIn,
    logout,
    bootstrap,
  };
}
