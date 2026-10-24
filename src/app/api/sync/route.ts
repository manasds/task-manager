import { NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { pullChanges, pushChanges, pushRequestSchema } from '@/lib/sync';

export const runtime = 'nodejs';

/** Pull: GET /api/sync?since=<cursor> */
export async function GET(request: Request) {
  try {
    await ensureMigrated();
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const since = Number(new URL(request.url).searchParams.get('since') ?? 0);

    if (!Number.isSafeInteger(since) || since < 0) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    }

    return NextResponse.json(await pullChanges(user.id, since));
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not load changes' }, { status: 500 });
  }
}

/** Push. POST so sendBeacon can use it when the tab closes. */
export async function POST(request: Request) {
  try {
    await ensureMigrated();
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const push = pushRequestSchema.safeParse(await request.json().catch(() => null));

    if (!push.success) {
      return NextResponse.json({ error: 'Invalid sync payload' }, { status: 400 });
    }

    return NextResponse.json(await pushChanges(user.id, push.data));
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not save changes' }, { status: 500 });
  }
}
