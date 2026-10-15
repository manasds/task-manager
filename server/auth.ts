import { betterAuth } from 'better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { pool } from './db.js';

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
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          prompt: 'select_account',
        },
      }
    : {},
});

export async function sessionUser(req: Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? undefined,
  };
}

export async function requireUser(req: Request, res: Response) {
  const user = await sessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Sign in required' });
    return null;
  }
  return user;
}

export async function insertTestUser(email: string) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, now(), now())`,
    [id, email.split('@')[0], email]
  );
  return { id, email };
}
