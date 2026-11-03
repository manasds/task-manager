// Settings, sign-in and the Tasky API, shared by the popup and the background worker.

export const DEFAULT_BASE = 'https://tasky.manasbuilds.me';

/** Addresses the manifest already grants; any other Tasky address asks for permission first. */
export const BUILT_IN_BASES = [DEFAULT_BASE, 'http://localhost:3000'];

/** The extension's saved settings: Tasky's address, its key (once signed in) and the last section used. */
export async function getSettings() {
  const s = await chrome.storage.local.get(['base', 'token', 'lastSection']);

  return { base: s.base || DEFAULT_BASE, token: s.token || null, lastSection: s.lastSection || null };
}

export function setSettings(patch) {
  return chrome.storage.local.set(patch);
}

/** Tasky no longer accepts the key (or there is none): sign in again. */
export class SignedOutError extends Error {
  constructor() {
    super('Sign in to Tasky to save links.');
  }
}

/** Call Tasky's API with the extension's key. */
export async function api(path, init = {}) {
  const { base, token } = await getSettings();

  if (!token) throw new SignedOutError();

  const response = await fetch(base + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    await chrome.storage.local.remove('token');
    throw new SignedOutError();
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) throw new Error(body?.error || `Tasky answered ${response.status}`);

  return body;
}

/**
 * Sign in with Google through Tasky. The browser opens Tasky's connect page in a sign-in window; once you
 * confirm, Tasky sends the window to this extension's own address with a key, and the window closes.
 */
export async function signIn() {
  const { base } = await getSettings();
  const redirect = chrome.identity.getRedirectURL();

  const finalUrl = await chrome.identity.launchWebAuthFlow({
    url: `${base}/extension/connect?redirect=${encodeURIComponent(redirect)}`,
    interactive: true,
  });

  const params = new URLSearchParams(new URL(finalUrl).hash.slice(1));
  const token = params.get('token');

  if (!token) throw new Error(params.get('error') === 'cancelled' ? 'Sign-in cancelled.' : 'Sign-in did not finish.');
  await setSettings({ token });
}

/** Stop this key working on Tasky, then forget it here. */
export async function signOut() {
  try {
    await api('/api/extension/token', { method: 'DELETE' });
  } catch {
    // Already revoked or offline; forgetting it here is what matters.
  }

  await chrome.storage.local.remove('token');
}

export async function listSections() {
  const { sections } = await api('/api/canvas');

  return sections;
}

/** Save { url, title?, note?, sectionId?, image? }. Returns { tile, section }. */
export async function saveLink(link) {
  const saved = await api('/api/canvas/save', { method: 'POST', body: JSON.stringify(link) });
  await setSettings({ lastSection: saved.section.id });

  return saved;
}

export function canSave(url) {
  return /^https?:\/\//i.test(url || '');
}
