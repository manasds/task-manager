import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/session';
import type { LinkPreview } from '@/types/canvas';

export const runtime = 'nodejs';

const urlSchema = z.url({ protocol: /^https?$/ }).max(2048);

const microlinkSchema = z.object({
  status: z.string(),
  data: z
    .object({
      title: z.string().nullish(),
      image: z.object({ url: z.string().nullish() }).nullish(),
    })
    .nullish(),
});

/** Microlink's free tier needs no key; MICROLINK_API_KEY switches to the paid endpoint and its higher limits. */
function microlinkRequest(url: string): Request {
  const key = process.env.MICROLINK_API_KEY;
  const base = key ? 'https://pro.microlink.io' : 'https://api.microlink.io';

  return new Request(`${base}/?url=${encodeURIComponent(url)}`, {
    headers: key ? { 'x-api-key': key } : {},
    signal: AbortSignal.timeout(8000),
  });
}

/** GET /api/canvas/preview?url=…: the page's title and preview image, looked up through Microlink. */
export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const url = urlSchema.safeParse(new URL(request.url).searchParams.get('url'));

  if (!url.success) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }

  try {
    const response = await fetch(microlinkRequest(url.data));

    if (response.status === 429) {
      return NextResponse.json({ error: 'Too many previews today' }, { status: 429 });
    }

    const body = microlinkSchema.safeParse(await response.json().catch(() => null));

    if (!response.ok || !body.success || body.data.status !== 'success') {
      return NextResponse.json({ title: null, image: null } satisfies LinkPreview);
    }

    const title = body.data.data?.title?.trim().slice(0, 300) || null;
    const image = urlSchema.safeParse(body.data.data?.image?.url);

    return NextResponse.json({ title, image: image.success ? image.data : null } satisfies LinkPreview);
  } catch (error) {
    console.error(error);

    return NextResponse.json({ error: 'Could not look up the link' }, { status: 502 });
  }
}
