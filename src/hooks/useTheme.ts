'use client';

import { useCallback, useEffect, useState } from 'react';
import { DARK_QUERY, THEME_STORAGE_KEY, type ThemePreference } from '../lib/theme';

export type { ThemePreference };

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);

    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage can be blocked; fall back to the system setting.
  }

  return 'system';
}

function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia(DARK_QUERY).matches);

  document.documentElement.classList.toggle('dark', dark);
}

/** Light, dark, or follow the device. Stored per device. */
export function useTheme() {
  // Only read in the browser; the switch that shows this value renders after hydration (inside a closed menu).
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window === 'undefined' ? 'system' : readPreference()
  );

  useEffect(() => {
    applyTheme(preference);

    if (preference !== 'system') return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme('system');

    media.addEventListener('change', onChange);

    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not persisted, but still applied for this visit.
    }

    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
