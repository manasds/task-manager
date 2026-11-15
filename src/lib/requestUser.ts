import { bearerToken } from '../utils/extensionAuth';
import { isSameSiteRequest, requestHost } from '../utils/requestOrigin';
import { userIdForExtensionToken } from './extensionTokens';
import { getSessionUser } from './session';

/**
 * The signed-in web app's user, by the session cookie. Null when signed out, and for a write
 * sent from another site, so a page elsewhere can't change data through the user's browser.
 */
export async function getCookieUserId(request: Request): Promise<string | null> {
  const origin = request.headers.get('origin');

  if (!isSameSiteRequest(request.method, origin, requestHost(request.headers))) {
    console.warn(`Blocked a cross-site ${request.method} to ${new URL(request.url).pathname} from ${origin}`);

    return null;
  }

  return (await getSessionUser())?.id ?? null;
}

/**
 * Who sent a request: the browser extension, by its key in the Authorization header,
 * or the signed-in web app, by its session cookie. Null for neither.
 */
export async function getRequestUserId(request: Request): Promise<string | null> {
  const token = bearerToken(request.headers.get('authorization'));

  if (token) return userIdForExtensionToken(token);

  return getCookieUserId(request);
}
