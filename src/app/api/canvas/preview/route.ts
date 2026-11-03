import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureMigrated } from '@/lib/db';
import { PreviewLimitError, lookupPreview } from '@/lib/linkPreview';
import { getRequestUserId } from '@/lib/requestUser';

export const runtime = 'nodejs';

const urlSchema = z.url({ protocol: /^https?$/ }).max(2048);

/** GET /api/canvas/preview?url=…: the page's title and preview image, looked up through Microlink. */
export async function GET(request: Request) {
  await ensureMigrated();
  const userId = await getRequestUserId(request);

  if (!userId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const url = urlSchema.safeParse(new URL(request.url).searchParams.get('url'));

  if (!url.success) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }

  try {
    return NextResponse.json(await lookupPreview(url.data));
  } catch (error) {
    if (error instanceof PreviewLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    console.error(error);

    return NextResponse.json({ error: 'Could not look up the link' }, { status: 502 });
  }
}
