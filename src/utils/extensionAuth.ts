/** Every extension key starts with this, so a key is easy to recognise in a request or a leak scan. */
export const EXTENSION_TOKEN_PREFIX = 'tsk_';

/** The Tasky Saver extension, pinned by the `key` in extension/manifest.json. */
export const BUILT_IN_EXTENSION_IDS = ['ahhkdlkaolkopiadpagcjpdddejcdafh'];

/** Built-in ids plus any in a comma-separated list, such as a Chrome Web Store id. */
export function allowedExtensionIds(extra: string | undefined): Set<string> {
  const ids = new Set(BUILT_IN_EXTENSION_IDS);

  for (const id of (extra ?? '').split(',')) {
    const trimmed = id.trim();

    if (/^[a-p]{32}$/.test(trimmed)) ids.add(trimmed);
  }

  return ids;
}

/**
 * The extension a sign-in redirect belongs to, or null when the redirect is anything else.
 * Chrome-family browsers send an extension's sign-in result to https://<extension id>.chromiumapp.org/.
 */
export function redirectExtensionId(redirect: string, allowed: Set<string>): string | null {
  let url: URL;

  try {
    url = new URL(redirect);
  } catch {
    return null;
  }

  const match = /^([a-p]{32})\.chromiumapp\.org$/.exec(url.hostname);

  if (url.protocol !== 'https:' || url.port || url.username || url.password || !match) return null;

  return allowed.has(match[1]) ? match[1] : null;
}

/** The key in an `Authorization: Bearer tsk_…` header, or null. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');

  return match && match[1].startsWith(EXTENSION_TOKEN_PREFIX) ? match[1] : null;
}
