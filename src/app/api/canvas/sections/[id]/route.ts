import { NextResponse } from 'next/server';
import { deleteSection, saveSection } from '@/lib/canvas';
import { LimitError } from '@/lib/limits';
import { getCookieUserId } from '@/lib/requestUser';
import { canvasSectionSchema } from '@/types/canvas';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ id: string }>;
}

/** PUT /api/canvas/sections/:id with the whole section: create it or replace what is saved. */
export async function PUT(request: Request, { params }: Context) {
  try {
    const userId = await getCookieUserId(request);

    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const section = canvasSectionSchema.safeParse(await request.json().catch(() => null));

    if (!section.success || section.data.id !== (await params).id) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
    }

    await saveSection(userId, section.data);

    return NextResponse.json({ section: section.data });
  } catch (error) {
    if (error instanceof LimitError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error(error);

    return NextResponse.json({ error: 'Could not save the section' }, { status: 500 });
  }
}

/** DELETE /api/canvas/sections/:id removes the section and the tiles in it. */
export async function DELETE(request: Request, { params }: Context) {
  try {
    const userId = await getCookieUserId(request);

    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    await deleteSection(userId, (await params).id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not delete the section' }, { status: 500 });
  }
}
