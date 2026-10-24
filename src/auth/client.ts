import { createAuthClient } from 'better-auth/react';

// Same-origin: the client talks to /api/auth on whatever host served the page.
const authClient = createAuthClient();

/** Redirects to Google. Better Auth reports failures in `error` instead of throwing. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });

  if (error) throw new Error(error.message || 'Google sign-in failed');
}

export async function signOut(): Promise<void> {
  const { error } = await authClient.signOut();

  if (error) throw new Error(error.message || 'Sign out failed');
}

/** The signed-in user's id, or null for a guest. */
export async function getSessionUserId(): Promise<string | null> {
  const { data, error } = await authClient.getSession();

  if (error) throw new Error(error.message || 'Could not read session');

  return data?.user?.id ?? null;
}
