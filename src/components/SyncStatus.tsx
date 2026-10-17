import React from 'react';
import { Cloud, CloudOff, Loader2, Check } from 'lucide-react';
import { CloudUser, FlushReason } from '../types/document';
import { SyncPhase } from '../hooks/useSessionPersistence';

interface SyncStatusProps {
  user: CloudUser | null;
  phase: SyncPhase;
  lastError: string | null;
  lastFlushReason: FlushReason | null;
  lastSyncedAt: string | null;
  onFlush: () => void;
  onSignOut: () => void;
  /** Icon and a short status only. Account actions live elsewhere. */
  compact?: boolean;
}

function shortPhaseLabel(phase: SyncPhase): string {
  if (phase === 'dirty') return 'Saving';
  if (phase === 'flushing') return 'Syncing';
  if (phase === 'synced') return 'Synced';
  if (phase === 'offline') return 'Offline';
  if (phase === 'error') return 'Paused';
  return 'Signed in';
}

function phaseLabel(phase: SyncPhase, user: CloudUser | null): string {
  if (!user) return 'On this device only';
  if (phase === 'dirty') return 'Saved here · syncing shortly';
  if (phase === 'flushing') return 'Syncing…';
  if (phase === 'synced') return 'Synced to your account';
  if (phase === 'offline') return 'Offline · queued on this device';
  if (phase === 'error') return 'Cloud sync paused';
  return 'Signed in';
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  user,
  phase,
  lastError,
  lastFlushReason,
  lastSyncedAt,
  onFlush,
  onSignOut,
  compact = false,
}) => {
  const Icon =
    phase === 'flushing' ? Loader2 : !user || phase === 'offline' || phase === 'error' ? CloudOff : phase === 'synced' ? Check : Cloud;

  const syncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const statusTitle =
    lastError ||
    (lastFlushReason
      ? `Last sync: ${lastFlushReason}`
      : 'Edits save on this device and sync a moment later.');

  if (compact) {
    if (!user) return null;
    return (
      <div
        className="flex items-center gap-1.5 text-[11px] text-slate-500 whitespace-nowrap"
        title={statusTitle}
      >
        <Icon className={`w-3.5 h-3.5 shrink-0 ${phase === 'flushing' ? 'animate-spin' : ''}`} />
        <span>
          {shortPhaseLabel(phase)}
          {syncedLabel && phase === 'synced' ? ` ${syncedLabel}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="hidden md:flex items-center gap-1.5 max-w-55 text-[11px] text-slate-500"
        title={statusTitle}
      >
        <Icon className={`w-3.5 h-3.5 shrink-0 ${phase === 'flushing' ? 'animate-spin' : ''}`} />
        <span className="truncate">
          {phaseLabel(phase, user)}
          {user && syncedLabel && phase === 'synced' ? ` · ${syncedLabel}` : ''}
        </span>
      </div>
      {user ? (
        <div className="flex items-center gap-1">
          <span className="hidden lg:inline text-[11px] text-slate-400 truncate max-w-35">{user.email}</span>
          {phase === 'dirty' && (
            <button
              type="button"
              onClick={onFlush}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 px-1.5 py-1 rounded-lg"
            >
              Sync now
            </button>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="text-[11px] text-slate-500 hover:text-slate-800 px-1.5 py-1 rounded-lg"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
};
