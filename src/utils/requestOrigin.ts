/** Methods that change data. Browsers send an Origin header with every one of them. */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Whether a request signed only by the session cookie may act for the user: a read, or a write
 * the browser says came from this same host. This blocks another site (including another
 * subdomain, which SameSite=Lax lets through) from making a signed-in user's browser change
 * their data. A missing Origin is a client that is not a browser, and can't carry the user's
 * cookie unless it already has it. This is the check Next.js uses for server actions.
 */
export function isSameSiteRequest(method: string, origin: string | null, host: string | null): boolean {
  if (!WRITE_METHODS.has(method.toUpperCase())) return true;

  if (origin === null) return true;

  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    // Includes `Origin: null`, which a sandboxed frame or a no-referrer page sends.
    return false;
  }
}

/** The host the browser addressed. Vercel and other proxies pass it on in X-Forwarded-Host. */
export function requestHost(headers: Headers): string | null {
  return headers.get('x-forwarded-host')?.split(',')[0].trim() || headers.get('host');
}
