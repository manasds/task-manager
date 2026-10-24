import { z } from 'zod';
import { CanvasTile } from '../types/canvas';
import { PullResponse, PushRequest, PushResponse } from '../types/sync';

/** The server answered with an error status. A fetch that never reached it throws a plain TypeError. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const errorBodySchema = z.object({ error: z.string().min(1) });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = errorBodySchema.safeParse(body);

    throw new ApiError(parsed.success ? parsed.data.error : `Request failed (${response.status})`, response.status);
  }

  // SAFETY: these paths are this app's own API routes, whose handlers return T on success.
  return body as T;
}

export function pullChanges(since: number): Promise<PullResponse> {
  return request(`/api/sync?since=${since}`);
}

export function pushChanges(payload: PushRequest): Promise<PushResponse> {
  return request('/api/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchCanvas(): Promise<{ tiles: CanvasTile[] }> {
  return request('/api/canvas');
}

export function saveCanvasTile(tile: CanvasTile): Promise<{ tile: CanvasTile }> {
  return request(`/api/canvas/${encodeURIComponent(tile.id)}`, { method: 'PUT', body: JSON.stringify(tile) });
}

export function deleteCanvasTile(id: string): Promise<{ ok: true }> {
  return request(`/api/canvas/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Browsers cap keepalive/beacon bodies at 64 KiB in flight. */
const BEACON_LIMIT_BYTES = 60_000;

/** Best-effort push while the tab closes. The response is never seen. */
export function pushChangesBeacon(payload: PushRequest): boolean {
  const body = JSON.stringify(payload);

  if (new Blob([body]).size > BEACON_LIMIT_BYTES) return false;

  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    return navigator.sendBeacon('/api/sync', new Blob([body], { type: 'application/json' }));
  }

  void fetch('/api/sync', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});

  return true;
}
