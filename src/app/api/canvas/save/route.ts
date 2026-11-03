import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { lastPositionInSection, listSections, saveSection, saveTile } from '@/lib/canvas';
import { ensureMigrated } from '@/lib/db';
import { lookupPreview } from '@/lib/linkPreview';
import { getRequestUserId } from '@/lib/requestUser';
import { saveLinkSchema, type CanvasSection, type CanvasTile, type LinkPreview } from '@/types/canvas';
import { detectKind, getDomain, positionBetween } from '@/utils/canvas';

export const runtime = 'nodejs';

/** A preview that could not be fetched leaves the image unset, so the canvas tries again later. */
async function previewOrNothing(url: string): Promise<LinkPreview | null> {
  try {
    return await lookupPreview(url);
  } catch {
    return null;
  }
}

/**
 * POST /api/canvas/save with { url, title?, note?, sectionId?, image? }: add a link to the end of a section.
 * Used by the browser extension; the server places the link and fills in what was left out.
 */
export async function POST(request: Request) {
  try {
    await ensureMigrated();
    const userId = await getRequestUserId(request);

    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = saveLinkSchema.safeParse(await request.json().catch(() => null));

    if (!body.success) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
    }

    const { url, title, note, sectionId, image } = body.data;
    const sections = await listSections(userId);
    let section: CanvasSection | undefined = sections.find(s => s.id === sectionId) ?? sections[0];

    if (!section) {
      section = { id: randomUUID(), name: 'Links', x: 0, y: 0, cols: 3, createdAt: new Date().toISOString() };
      await saveSection(userId, section);
    }

    const preview = title && image ? null : await previewOrNothing(url);

    const tile: CanvasTile = {
      id: randomUUID(),
      url,
      title: title || preview?.title || getDomain(url) || url,
      kind: detectKind(url),
      status: 'active',
      note: note ?? '',
      position: positionBetween((await lastPositionInSection(userId, section.id)) ?? undefined, undefined),
      createdAt: new Date().toISOString(),
      sectionId: section.id,
      x: null,
      y: null,
      image: image ?? (preview ? (preview.image ?? '') : null),
    };

    await saveTile(userId, tile);

    return NextResponse.json({ tile, section: { id: section.id, name: section.name } });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not save the link' }, { status: 500 });
  }
}
