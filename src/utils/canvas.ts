import type { CanvasKind } from '../types/canvas';

/** Position for a tile between two neighbours; either may be missing at an end of the list. */
export function positionBetween(before?: number, after?: number): number {
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (before !== undefined) return before + 1;
  if (after !== undefined) return after - 1;
  return 0;
}

function parseUrl(url: string): URL | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

export function getDomain(url: string): string {
  const u = parseUrl(url);
  return u ? u.hostname.replace(/^www\./, '') : '';
}

export function detectKind(url: string): CanvasKind {
  const u = parseUrl(url);
  if (!u) return 'other';
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  if (
    host === 'medium.com' ||
    host.endsWith('.medium.com') ||
    host.includes('substack') ||
    host === 'dev.to' ||
    host.includes('blog') ||
    u.pathname.toLowerCase().includes('blog')
  ) {
    return 'blog';
  }
  return 'article';
}

export function getYouTubeId(url: string): string | null {
  const u = parseUrl(url);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const valid = (id: string | null | undefined) => (id && /^[\w-]{6,}$/.test(id) ? id : null);
  if (host === 'youtu.be') return valid(u.pathname.split('/')[1]);
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const v = u.searchParams.get('v');
    if (v) return valid(v);
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
    if (m) return valid(m[1]);
  }
  return null;
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
