import { bearerToken } from '../utils/extensionAuth';
import { userIdForExtensionToken } from './extensionTokens';
import { getSessionUser } from './session';

/**
 * Who sent a request: the browser extension, by its key in the Authorization header,
 * or the signed-in web app, by its session cookie. Null for neither.
 */
export async function getRequestUserId(request: Request): Promise<string | null> {
  const token = bearerToken(request.headers.get('authorization'));

  if (token) return userIdForExtensionToken(token);

  return (await getSessionUser())?.id ?? null;
}
