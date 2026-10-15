import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { migrate } from './db.js';
import { auth, requireUser, sessionUser } from './auth.js';
import { getDocument, saveDocument } from './documents.js';
import { isValidDocument } from '../src/utils/syncPolicy.ts';

const app = express();
const PORT = Number(process.env.PORT || 3001);

// Better Auth must read the raw body. Do not mount express.json() first.
app.all('/api/auth/*', toNodeHandler(auth));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  try {
    const user = await sessionUser(req);
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not read session' });
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
  if (!process.env.BETTER_AUTH_SECRET) {
    console.warn('BETTER_AUTH_SECRET is unset; using a development default');
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are unset; Google sign-in will fail');
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
