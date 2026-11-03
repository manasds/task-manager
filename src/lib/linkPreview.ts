import { z } from 'zod';
import type { LinkPreview } from '../types/canvas';

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

/** Thrown when Microlink's daily allowance is used up. */
export class PreviewLimitError extends Error {}

/** The page's title and preview image, looked up through Microlink. Either may be missing. */
export async function lookupPreview(url: string): Promise<LinkPreview> {
  const response = await fetch(microlinkRequest(url));

  if (response.status === 429) throw new PreviewLimitError('Too many previews today');
  const body = microlinkSchema.safeParse(await response.json().catch(() => null));

  if (!response.ok || !body.success || body.data.status !== 'success') return { title: null, image: null };
  const title = body.data.data?.title?.trim().slice(0, 300) || null;
  const image = urlSchema.safeParse(body.data.data?.image?.url);

  return { title, image: image.success ? image.data : null };
}
