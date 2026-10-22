import { NextResponse } from 'next/server';
import { listTiles } from '@/lib/canvas';
import { ensureMigrated } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

/** GET /api/canvas: this user's tiles in display order. */
export async function GET() {
  try {
    await ensureMigrated();
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ tiles: await listTiles(user.id) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not load the canvas' }, { status: 500 });
  }
}
