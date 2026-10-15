import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';
import { ensureMigrated } from '@/lib/db';

const handlers = toNextJsHandler(auth);

async function withSchema(request: Request, method: 'GET' | 'POST') {
  await ensureMigrated();
  return handlers[method](request);
}

export async function GET(request: Request) {
  return withSchema(request, 'GET');
}

export async function POST(request: Request) {
  return withSchema(request, 'POST');
}
