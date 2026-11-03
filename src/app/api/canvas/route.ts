import { NextResponse } from 'next/server';
import { listSections, listTiles } from '@/lib/canvas';
import { ensureMigrated } from '@/lib/db';
import { getRequestUserId } from '@/lib/requestUser';

export const runtime = 'nodejs';

/** GET /api/canvas: this user's tiles in display order, and the section boxes they sit in. The extension reads sections here too. */
export async function GET(request: Request) {
  try {
    await ensureMigrated();
    const userId = await getRequestUserId(request);

    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const [tiles, sections] = await Promise.all([listTiles(userId), listSections(userId)]);

    return NextResponse.json({ tiles, sections });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not load the canvas' }, { status: 500 });
  }
}
