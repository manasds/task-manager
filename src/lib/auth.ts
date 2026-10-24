import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { pool } from './db';

// Better Auth reads BETTER_AUTH_SECRET from the environment. Without one it falls back
// to a public default, so refuse to run that way in production.
if (process.env.NODE_ENV === 'production' && !process.env.BETTER_AUTH_SECRET) {
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
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      prompt: 'select_account',
    },
  },
  plugins: [nextCookies()],
});
