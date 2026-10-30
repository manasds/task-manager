import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { pool } from './db';

// Better Auth reads BETTER_AUTH_SECRET from the environment. Without one it falls back
// to a public default, so refuse to run that way in production. `next build` imports this
// module to collect page data and needs no secret, so the check waits for the server.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

if (process.env.NODE_ENV === 'production' && !isBuild && !process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET must be set in production.');
}

// `next dev` serves on localhost and stores the port it bound in PORT. Everywhere else,
// BETTER_AUTH_URL is the public origin that Google redirects back to.
const baseURL =
  process.env.NODE_ENV === 'development'
    ? `http://localhost:${process.env.PORT ?? 3000}`
    : process.env.BETTER_AUTH_URL;

export const auth = betterAuth({
  baseURL,
  database: pool,
  onAPIError: { errorURL: '/auth/error' },
  // Signed session cookie lets getSession skip Postgres for up to 5 minutes.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      prompt: 'select_account',
    },
  },
  plugins: [nextCookies()],
});
