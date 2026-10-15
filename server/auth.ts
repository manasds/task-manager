import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { pool } from './db.js';

const SESSION_COOKIE = 'ot_session';
const SESSION_DAYS = 30;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function cookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email';
  if (password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

function rateLimit(key: string, max = 8): boolean {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  current.count += 1;
  return current.count <= max;
}

export async function createUser(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query<{ id: string; email: string }>(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, passwordHash]
  );
  return result.rows[0];
}

export async function verifyUser(email: string, password: string) {
  const result = await pool.query<{ id: string; email: string; password_hash: string }>(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, email: user.email };
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hashToken(token), expires]
  );
  return token;
}

export async function userFromToken(token: string | undefined) {
  if (!token) return null;
  const result = await pool.query<{ id: string; email: string }>(
    `SELECT u.id, u.email
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );
  return result.rows[0] ?? null;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

export function readSessionToken(req: Request): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const parts = raw.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function setSessionCookie(res: Response, token: string): void {
  const opts = cookieOptions();
  const cookie = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${opts.path}`,
    `Max-Age=${Math.floor(opts.maxAge / 1000)}`,
    'HttpOnly',
    `SameSite=${opts.sameSite}`,
  ];
  if (opts.secure) cookie.push('Secure');
  res.setHeader('Set-Cookie', cookie.join('; '));
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  );
}

export function allowAuthAttempt(ip: string): boolean {
  return rateLimit(ip);
}

export async function requireUser(req: Request, res: Response) {
  const user = await userFromToken(readSessionToken(req));
  if (!user) {
    res.status(401).json({ error: 'Sign in required' });
    return null;
  }
  return user;
}
