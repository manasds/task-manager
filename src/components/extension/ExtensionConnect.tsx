'use client';

import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { getSessionEmail, signInWithGoogle } from '@/auth/client';

type State =
  | { phase: 'loading' }
  | { phase: 'bad-link' }
  | { phase: 'signed-out' }
  | { phase: 'confirm'; email: string }
  | { phase: 'connecting'; email: string }
  | { phase: 'failed'; message: string };

const tokenResponseSchema = z.object({ token: z.string().startsWith('tsk_') });

/** Where the extension's sign-in window must end: its own https://<id>.chromiumapp.org/ address. */
function readRedirect(): string | null {
  const redirect = new URLSearchParams(window.location.search).get('redirect');

  return redirect && /^https:\/\/[a-p]{32}\.chromiumapp\.org\//.test(redirect) ? redirect : null;
}

/**
 * Opened by the Tasky Saver extension in its sign-in window. Signs in with Google if needed, asks before
 * connecting, then returns a key to the extension in the address it closes the window on.
 */
export default function ExtensionConnect() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    void (async () => {
      if (!readRedirect()) return setState({ phase: 'bad-link' });

      try {
        const email = await getSessionEmail();
        setState(email ? { phase: 'confirm', email } : { phase: 'signed-out' });
      } catch {
        setState({ phase: 'failed', message: 'Could not check your sign-in. Close this window and try again.' });
      }
    })();
  }, []);

  const finish = (hash: string) => {
    const redirect = readRedirect();

    if (redirect) window.location.replace(`${redirect}#${hash}`);
  };

  const connect = async (email: string) => {
    setState({ phase: 'connecting', email });

    try {
      const response = await fetch('/api/extension/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect: readRedirect() }),
      });

      const body = tokenResponseSchema.safeParse(await response.json().catch(() => null));

      if (!response.ok || !body.success) throw new Error('not connected');
      finish(`token=${encodeURIComponent(body.data.token)}`);
    } catch {
      setState({ phase: 'failed', message: 'Could not connect the extension. Close this window and try again.' });
    }
  };

  const signIn = () => {
    signInWithGoogle(window.location.pathname + window.location.search).catch(() =>
      setState({ phase: 'failed', message: 'Could not start Google sign-in.' })
    );
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 text-slate-800">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Connect Tasky Saver</h1>

        {state.phase === 'loading' && <p className="mt-2 text-sm text-slate-500">Checking your sign-in…</p>}

        {state.phase === 'bad-link' && (
          <p className="mt-2 text-sm text-slate-600">Open this page from the Tasky Saver extension&apos;s Sign in button.</p>
        )}

        {state.phase === 'signed-out' && (
          <>
            <p className="mt-2 text-sm text-slate-600">Sign in to let the extension save links to your canvas.</p>
            <button
              type="button"
              onClick={signIn}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Continue with Google
            </button>
          </>
        )}

        {(state.phase === 'confirm' || state.phase === 'connecting') && (
          <>
            <p className="mt-2 text-sm text-slate-600">
              The extension will be able to add links to the canvas of <span className="font-semibold text-slate-900">{state.email}</span>. You
              can disconnect it from the extension at any time.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => finish('error=cancelled')}
                disabled={state.phase === 'connecting'}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void connect(state.email)}
                disabled={state.phase === 'connecting'}
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {state.phase === 'connecting' ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </>
        )}

        {state.phase === 'failed' && <p className="mt-2 text-sm text-red-600">{state.message}</p>}
      </div>
    </main>
  );
}
