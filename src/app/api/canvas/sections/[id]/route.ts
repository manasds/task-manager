import { NextResponse } from 'next/server';
import { deleteSection, saveSection } from '@/lib/canvas';
import { ensureMigrated } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { canvasSectionSchema } from '@/types/canvas';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ id: string }>;
}

/** PUT /api/canvas/sections/:id with the whole section: create it or replace what is saved. */
export async function PUT(request: Request, { params }: Context) {
  try {
    await ensureMigrated();
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const section = canvasSectionSchema.safeParse(await request.json().catch(() => null));

    if (!section.success || section.data.id !== (await params).id) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
    }

    await saveSection(user.id, section.data);

    return NextResponse.json({ section: section.data });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not save the section' }, { status: 500 });
  }
}

/** DELETE /api/canvas/sections/:id removes the section and the tiles in it. */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    await ensureMigrated();
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    await deleteSection(user.id, (await params).id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not delete the section' }, { status: 500 });
  }
}
