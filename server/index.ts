import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { migrate } from './db.js';
import {
  allowAuthAttempt,
  clearSessionCookie,
  createSession,
  createUser,
  destroySession,
  normalizeEmail,
  readSessionToken,
  requireUser,
  setSessionCookie,
  userFromToken,
  validateCredentials,
  verifyUser,
} from './auth.js';
import { getDocument, saveDocument } from './documents.js';
import { isValidDocument } from '../src/utils/syncPolicy.ts';

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  try {
    const user = await userFromToken(readSessionToken(req));
    if (!user) {
      res.json({ user: null });
      return;
    }
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not read session' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    if (!allowAuthAttempt(req.ip || 'unknown')) {
      res.status(429).json({ error: 'Too many attempts. Try again later.' });
      return;
    }
    const email = normalizeEmail(String(req.body?.email || ''));
    const password = String(req.body?.password || '');
    const invalid = validateCredentials(email, password);
    if (invalid) {
      res.status(400).json({ error: invalid });
      return;
    }
    const user = await createUser(email, password);
    const token = await createSession(user.id);
    setSessionCookie(res, token);
    res.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') {
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Could not create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!allowAuthAttempt(req.ip || 'unknown')) {
      res.status(429).json({ error: 'Too many attempts. Try again later.' });
      return;
    }
    const email = normalizeEmail(String(req.body?.email || ''));
    const password = String(req.body?.password || '');
    const user = await verifyUser(email, password);
    if (!user) {
      res.status(401).json({ error: 'Email or password is incorrect' });
      return;
    }
    const token = await createSession(user.id);
    setSessionCookie(res, token);
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not sign in' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    await destroySession(readSessionToken(req));
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not sign out' });
  }
});

app.get('/api/document', async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const record = await getDocument(user.id);
    res.json({ record });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load document' });
  }
});

app.put('/api/document', async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const document = req.body?.document;
    const baseRevision = Number(req.body?.baseRevision);
    if (!isValidDocument(document) || !Number.isFinite(baseRevision) || baseRevision < 0) {
      res.status(400).json({ error: 'Invalid document payload' });
      return;
    }
    const result = await saveDocument(user.id, document, baseRevision);
    if (!result.ok) {
      res.status(409).json({ error: 'Revision conflict', record: result.conflict });
      return;
    }
    res.json({ record: result.record });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not save document' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, '../dist');
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

async function start() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  await migrate();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OrbitTask API listening on ${PORT}`);
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun || process.env.ORBITTASK_START_SERVER === '1') {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { app, start };
