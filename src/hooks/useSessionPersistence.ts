import { useCallback, useEffect, useRef, useState } from 'react';
import { signInWithGoogle, signOutGoogle } from '../auth/client';
import { fetchDocument, fetchMe, putDocument, putDocumentBeacon } from '../api/client';
import { CloudUser, FlushReason, PersistedDocument } from '../types/document';
import {
  guestScope,
  loadLocalDirty,
  loadLocalDocument,
  loadLocalRevision,
  saveLocalDirty,
  saveLocalDocument,
  saveLocalRevision,
} from '../utils/localDocument';
import {
  emptyDocument,
  isLikelyDemoDocument,
  mergeDocuments,
  resolveBootDocument,
  SAFETY_FLUSH_MS,
  shouldFlushOnSessionEnd,
  shouldSafetyFlush,
} from '../utils/syncPolicy';

export type SyncPhase = 'idle' | 'dirty' | 'flushing' | 'synced' | 'offline' | 'error';

interface PersistenceState {
  user: CloudUser | null;
  authReady: boolean;
  revision: number;
  dirty: boolean;
  phase: SyncPhase;
  lastError: string | null;
  lastFlushReason: FlushReason | null;
  lastSyncedAt: string | null;
  /** Bumps when the hook replaced the document with a server merge the UI has not seen. */
  remoteVersion: number;
}

export function useSessionPersistence() {
  const [state, setState] = useState<PersistenceState>({
    user: null,
    authReady: false,
    revision: 0,
    dirty: false,
    phase: 'idle',
    lastError: null,
    lastFlushReason: null,
    lastSyncedAt: null,
    remoteVersion: 0,
  });

  const documentRef = useRef<PersistedDocument>(emptyDocument());
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastAttemptRef = useRef(0);
  const userRef = useRef<CloudUser | null>(null);

  const scopeFor = (user: CloudUser | null) => user?.id ?? guestScope();

  const persistLocal = useCallback((document: PersistedDocument, markDirty: boolean) => {
    documentRef.current = document;
    const scope = scopeFor(userRef.current);
    try {
      saveLocalDocument(scope, document);
    } catch {
      setState((prev) => ({
        ...prev,
        lastError: 'This device could not save locally (storage full?)',
        phase: 'error',
      }));
      return;
    }
    if (markDirty && userRef.current) {
      dirtyRef.current = true;
      saveLocalDirty(userRef.current.id, true);
      setState((prev) => ({ ...prev, dirty: true, phase: 'dirty', lastError: null }));
    }
  }, []);

  const flush = useCallback(async (reason: FlushReason, useBeacon = false) => {
    const user = userRef.current;
    if (!user || !dirtyRef.current || inFlightRef.current) return false;

    inFlightRef.current = true;
    lastAttemptRef.current = Date.now();
    setState((prev) => ({ ...prev, phase: 'flushing', lastFlushReason: reason }));

    const payload = {
      document: documentRef.current,
      baseRevision: revisionRef.current,
    };

    if (useBeacon) {
      const queued = await putDocumentBeacon(payload);
      inFlightRef.current = false;
      // Do not clear dirty: beacon cannot confirm the new revision.
      // A later explicit/safety flush reconciles if the tab survives.
      if (queued) {
        setState((prev) => ({
          ...prev,
          phase: 'dirty',
          lastFlushReason: reason,
          lastError: null,
        }));
      }
      return queued;
    }

    try {
      const { record } = await putDocument(payload);
      revisionRef.current = record.revision;
      saveLocalRevision(user.id, record.revision);
      inFlightRef.current = false;
      if (documentRef.current !== payload.document) {
        setState((prev) => ({
          ...prev,
          revision: record.revision,
          lastSyncedAt: record.updatedAt,
          lastError: null,
          lastFlushReason: reason,
        }));
        return flush(reason);
      }
      saveLocalDocument(user.id, record.document);
      documentRef.current = record.document;
      dirtyRef.current = false;
      saveLocalDirty(user.id, false);
      setState((prev) => ({
        ...prev,
        revision: record.revision,
        dirty: false,
        phase: 'synced',
        lastSyncedAt: record.updatedAt,
        lastError: null,
        lastFlushReason: reason,
      }));
      return true;
    } catch (error) {
      const err = error as Error & { status?: number; payload?: { record?: { document: PersistedDocument; revision: number } } };
      if (err.status === 409 && err.payload?.record) {
        const merged = mergeDocuments(documentRef.current, err.payload.record.document);
        documentRef.current = merged;
        revisionRef.current = err.payload.record.revision;
        saveLocalDocument(user.id, merged);
        saveLocalRevision(user.id, err.payload.record.revision);
        dirtyRef.current = true;
        inFlightRef.current = false;
        setState((prev) => ({
          ...prev,
          revision: err.payload!.record!.revision,
          dirty: true,
          phase: 'dirty',
          lastError: 'Merged changes from another device, syncing again',
          remoteVersion: prev.remoteVersion + 1,
        }));
        return flush('explicit');
      }
      inFlightRef.current = false;
      setState((prev) => ({
        ...prev,
        phase: navigator.onLine ? 'error' : 'offline',
        lastError: err.message || 'Cloud save failed. Work is still on this device.',
      }));
      return false;
    }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const { user } = await fetchMe();
      userRef.current = user;
      if (!user) {
        const guest = loadLocalDocument(guestScope());
        documentRef.current = guest;
        setState((prev) => ({ ...prev, user: null, authReady: true, phase: 'idle' }));
        return guest;
      }

      const local = loadLocalDocument(user.id);
      const localRevision = loadLocalRevision(user.id);
      const { record } = await fetchDocument();

      if (!record) {
        const guest = loadLocalDocument(guestScope());
        const promote =
          guest.activities.length > 0 && !isLikelyDemoDocument(guest) ? guest : emptyDocument();
        documentRef.current = promote.activities.length ? promote : local;
        revisionRef.current = 0;
        saveLocalDocument(user.id, documentRef.current);
        if (documentRef.current.activities.length > 0) {
          dirtyRef.current = true;
          setState((prev) => ({
            ...prev,
            user,
            authReady: true,
            revision: 0,
            dirty: true,
            phase: 'dirty',
            lastError: null,
            lastFlushReason: null,
            lastSyncedAt: null,
          }));
          await flush('sign_in_promote');
        } else {
          setState((prev) => ({
            ...prev,
            user,
            authReady: true,
            revision: 0,
            dirty: false,
            phase: 'synced',
            lastError: null,
            lastFlushReason: null,
            lastSyncedAt: null,
          }));
        }
        return documentRef.current;
      }

      const resolved = resolveBootDocument(local, localRevision, loadLocalDirty(user.id), record);
      documentRef.current = resolved.document;
      revisionRef.current = record.revision;
      dirtyRef.current = resolved.dirty;
      saveLocalDocument(user.id, resolved.document);
      saveLocalRevision(user.id, record.revision);
      setState((prev) => ({
        ...prev,
        user,
        authReady: true,
        revision: record.revision,
        dirty: resolved.dirty,
        phase: resolved.dirty ? 'dirty' : 'synced',
        lastError: null,
        lastFlushReason: null,
        lastSyncedAt: record.updatedAt,
      }));
      if (resolved.dirty) await flush('sign_in_promote');
      return documentRef.current;
    } catch {
      const fallbackUser = userRef.current;
      const local = loadLocalDocument(scopeFor(fallbackUser));
      documentRef.current = local;
      setState((prev) => ({
        ...prev,
        user: fallbackUser,
        authReady: true,
        phase: 'offline',
        lastError: 'Working offline from this device',
      }));
      return local;
    }
  }, [flush]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onHidden = () => {
      if (
        shouldFlushOnSessionEnd(
          document.visibilityState === 'hidden',
          dirtyRef.current,
          inFlightRef.current
        )
      ) {
        void flush('session_end', true);
      }
    };
    const onPageHide = () => {
      if (dirtyRef.current && userRef.current) {
        void flush('session_end', true);
      }
    };
    const onOnline = () => {
      if (dirtyRef.current) void flush('online');
    };

    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);

    const interval = window.setInterval(() => {
      if (
        shouldSafetyFlush(Date.now(), lastAttemptRef.current, dirtyRef.current, inFlightRef.current)
      ) {
        void flush('safety_interval');
      }
    }, SAFETY_FLUSH_MS);

    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, [flush]);

  const startGoogleSignIn = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const logout = useCallback(async () => {
    if (dirtyRef.current) {
      await flush('explicit');
    }
    await signOutGoogle();
    userRef.current = null;
    dirtyRef.current = false;
    revisionRef.current = 0;
    const guest = loadLocalDocument(guestScope());
    documentRef.current = guest;
    setState((prev) => ({
      ...prev,
      user: null,
      authReady: true,
      revision: 0,
      dirty: false,
      phase: 'idle',
      lastError: null,
      lastFlushReason: null,
      lastSyncedAt: null,
    }));
    return guest;
  }, [flush]);

  return {
    ...state,
    currentDocument: () => documentRef.current,
    persistLocal,
    flush,
    startGoogleSignIn,
    logout,
    bootstrap,
  };
}
