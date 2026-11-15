import { NextResponse } from 'next/server';
import { deleteTile, saveTile } from '@/lib/canvas';
import { LimitError } from '@/lib/limits';
import { getCookieUserId } from '@/lib/requestUser';
import { canvasTileSchema } from '@/types/canvas';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ id: string }>;
}

/** PUT /api/canvas/:id with the whole tile: create it or replace what is saved. */
export async function PUT(request: Request, { params }: Context) {
  try {
    const userId = await getCookieUserId(request);

    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const tile = canvasTileSchema.safeParse(await request.json().catch(() => null));

    if (!tile.success || tile.data.id !== (await params).id) {
      return NextResponse.json({ error: 'Invalid tile' }, { status: 400 });
    }

    await saveTile(userId, tile.data);

    return NextResponse.json({ tile: tile.data });
  } catch (error) {
    if (error instanceof LimitError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error(error);

    return NextResponse.json({ error: 'Could not save the tile' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const userId = await getCookieUserId(request);

    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    await deleteTile(userId, (await params).id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not delete the tile' }, { status: 500 });
  }
}
