import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { pool } from './db';

function appOrigin(): string {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

const origin = appOrigin();

export const auth = betterAuth({
  baseURL: origin,
  secret: process.env.BETTER_AUTH_SECRET || 'orbittask-dev-secret-change-me',
  database: pool,
  trustedOrigins: [origin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            prompt: 'select_account',
          },
        }
      : {},
  plugins: [nextCookies()],
});

export async function insertTestUser(email: string) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, now(), now())`,
    [id, email.split('@')[0], email]
  );
  return { id, email };
}
