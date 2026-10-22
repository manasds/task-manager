import { NextResponse } from 'next/server';
import { deleteTile, parseTile, saveTile } from '@/lib/canvas';
import { ensureMigrated } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ id: string }>;
}

/** PUT /api/canvas/:id with the whole tile: create it or replace what is saved. */
export async function PUT(request: Request, { params }: Context) {
  try {
    await ensureMigrated();
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const tile = parseTile(await request.json().catch(() => null), (await params).id);
    if (!tile) {
      return NextResponse.json({ error: 'Invalid tile' }, { status: 400 });
    }
    await saveTile(user.id, tile);
    return NextResponse.json({ tile });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not save the tile' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    await ensureMigrated();
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    await deleteTile(user.id, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not delete the tile' }, { status: 500 });
  }
}
