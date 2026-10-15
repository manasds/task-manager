import React, { useState } from 'react';

interface AuthPanelProps {
  onSubmit: (mode: 'signin' | 'signup', email: string, password: string) => Promise<void>;
  compact?: boolean;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({ onSubmit, compact = false }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSubmit(mode, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not authenticate');
    } finally {
      setBusy(false);
    }
  };

  const fieldClass = compact
    ? 'h-9 w-36 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400'
    : 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm';

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-3'}
    >
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={fieldClass}
      />
      <input
        type="password"
        required
        minLength={8}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        placeholder={compact ? 'Password' : 'Password (8+ characters)'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={fieldClass}
      />
      {error && <p className="text-[11px] text-rose-600 w-full">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-60"
      >
        {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
        className="text-[11px] text-slate-500 hover:text-slate-800"
      >
        {mode === 'signup' ? 'Have an account?' : 'New here?'}
      </button>
    </form>
  );
};
