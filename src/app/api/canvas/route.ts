import { NextResponse } from 'next/server';
import { listSections, listTiles } from '@/lib/canvas';
import { ensureMigrated } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

/** GET /api/canvas: this user's tiles in display order, and the section boxes they sit in. */
export async function GET() {
  try {
    await ensureMigrated();
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const [tiles, sections] = await Promise.all([listTiles(user.id), listSections(user.id)]);

    return NextResponse.json({ tiles, sections });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not load the canvas' }, { status: 500 });
  }
}
