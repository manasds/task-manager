import { CloudUser, DocumentRecord, FlushPayload } from '../types/document';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`) as Error & {
      status: number;
      payload: unknown;
    };
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

export function fetchMe(): Promise<{ user: CloudUser | null }> {
  return request('/api/me');
}


export function fetchDocument(): Promise<{ record: DocumentRecord | null }> {
  return request('/api/document');
}

export function putDocument(payload: FlushPayload): Promise<{ record: DocumentRecord }> {
  return request('/api/document', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function putDocumentBeacon(payload: FlushPayload): Promise<boolean> {
  const body = JSON.stringify(payload);
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    return navigator.sendBeacon('/api/document', blob);
  }
  try {
    await fetch('/api/document', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
    return true;
  } catch {
    return false;
  }
}
