'use client';

import React, { useEffect } from 'react';
import { CloudUpload } from 'lucide-react';
import { GUEST_TASK_LIMIT } from '../utils/guestLimits';

function taskWord(count: number): string {
  return `${count} ${count === 1 ? 'task' : 'tasks'}`;
}

/** Centered sign-in dialog over a dimmed page. Escape, the backdrop and "Not now" all close it. */
function GuestSignInDialog({
  title,
  children,
  onSignIn,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onSignIn: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-sign-in-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-sm w-full pop-shadow border border-slate-200 p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
      >
        <div className="size-10 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center">
          <CloudUpload className="w-5 h-5" />
        </div>
        <h3 id="guest-sign-in-title" className="mt-4 text-base font-bold text-slate-900">
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{children}</p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Not now
          </button>
          <button
            type="button"
            autoFocus
            onClick={onSignIn}
            className="h-10 px-4 btn-ink text-sm font-medium rounded-xl"
          >
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown once a guest has a few tasks. "Not now" keeps it closed on this browser. */
export function GuestSignInNudge({
  taskCount,
  onSignIn,
  onDismiss,
}: {
  taskCount: number;
  onSignIn: () => void;
  onDismiss: () => void;
}) {
  return (
    <GuestSignInDialog title="Keep your tasks safe" onSignIn={onSignIn} onClose={onDismiss}>
      Your {taskWord(taskCount)} are saved only in this browser. Sign in to back them up and use them on any device.
      Guest boards hold up to {GUEST_TASK_LIMIT} tasks.
    </GuestSignInDialog>
  );
}

/** Shown instead of the new-task window once a guest board is full. */
export function GuestTaskLimitModal({
  taskCount,
  onSignIn,
  onClose,
}: {
  taskCount: number;
  onSignIn: () => void;
  onClose: () => void;
}) {
  return (
    <GuestSignInDialog title="Sign in to add more tasks" onSignIn={onSignIn} onClose={onClose}>
      Guest boards hold up to {GUEST_TASK_LIMIT} tasks. Sign in to keep adding them. Your {taskWord(taskCount)} move to
      your account and sync across your devices.
    </GuestSignInDialog>
  );
}
