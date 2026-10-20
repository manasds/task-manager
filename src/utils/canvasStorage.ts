export type CanvasKind = 'youtube' | 'blog' | 'article' | 'podcast' | 'other';
export type CanvasStatus = 'active' | 'done';

export interface CanvasTile {
  id: string;
  url: string;
  title: string;
  kind: CanvasKind;
  status: CanvasStatus;
  note: string;
  createdAt: string;
}

export const CANVAS_STORAGE_KEY = 'orbittask_canvas_v1';

const KINDS: CanvasKind[] = ['youtube', 'blog', 'article', 'podcast', 'other'];

function isTile(value: unknown): value is CanvasTile {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.url === 'string' &&
    typeof v.title === 'string' &&
    typeof v.kind === 'string' &&
    KINDS.includes(v.kind as CanvasKind) &&
    (v.status === 'active' || v.status === 'done') &&
    typeof v.note === 'string' &&
    typeof v.createdAt === 'string'
  );
}

export function loadCanvasTiles(): CanvasTile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CANVAS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTile);
  } catch {
    return [];
  }
}

export function saveCanvasTiles(tiles: CanvasTile[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(tiles));
  } catch {
    // storage unavailable or full; ignore
  }
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
