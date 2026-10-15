import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin,
});

export function signInWithGoogle(): Promise<unknown> {
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: '/',
  });
}

export function signOutGoogle(): Promise<unknown> {
  return authClient.signOut();
}
