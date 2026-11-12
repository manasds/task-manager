// Shared by the root layout (server) and useTheme (client), so it must not import React hooks.
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'tasky-theme';

export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Runs before first paint (inlined in the root layout) so a dark page never flashes light.
 * Keep it in sync with readPreference/applyTheme in useTheme.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&matchMedia('${DARK_QUERY}').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;
