export class ApiError extends Error {
  constructor(
    public errorCode: string,
    message: string,
  ) {
    super(message);
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function headers(json = false) {
  const next = new Headers();
  if (json) next.set('Content-Type', 'application/json');
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('aijewel.accessToken');
    if (token) next.set('Authorization', `Bearer ${token}`);
  }
  return next;
}

async function refresh(): Promise<boolean> {
  const refreshToken = sessionStorage.getItem('aijewel.refreshToken');
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) return false;
  const body = await response.json();
  sessionStorage.setItem('aijewel.accessToken', body.data.accessToken);
  sessionStorage.setItem('aijewel.refreshToken', body.data.refreshToken);
  return true;
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }, retry = true): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: headers(init?.json !== undefined),
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (response.status === 401 && retry && !path.startsWith('/api/auth/login')) {
    const ok = await refresh();
    if (ok) return api<T>(path, init, false);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) throw new ApiError('REQUEST_FAILED', response.statusText);
    return (await response.text()) as T;
  }
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new ApiError(body.errorCode ?? 'REQUEST_FAILED', body.message ?? 'Request failed');
  }
  return body.data as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, { headers: headers() });
  if (!response.ok) throw new ApiError('REQUEST_FAILED', 'Could not load file');
  return response.blob();
}

export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { method: 'POST', headers: headers(), body: form });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new ApiError(body.errorCode ?? 'REQUEST_FAILED', body.message ?? 'Request failed');
  }
  return body.data as T;
}

export function subscribeWhatsApp(
  onEvent: (event: { type?: string; conversationId?: string; messageId?: string; status?: string }) => void,
  signal: AbortSignal,
) {
  const run = async () => {
    while (!signal.aborted) {
      try {
        const reconnect = await readEventStream('/api/whatsapp/stream', onEvent, signal);
        if (!reconnect) return;
      } catch {
        // The next loop reconnects after a short pause.
      }
      if (signal.aborted) return;
      await wait(3000, signal);
    }
  };
  void run();
}

async function readEventStream(
  path: string,
  onEvent: (event: { type?: string; conversationId?: string; messageId?: string; status?: string }) => void,
  signal: AbortSignal,
): Promise<boolean> {
  const response = await fetch(`${API_URL}${path}`, { headers: headers(), signal });
  if (response.status === 401) {
    const refreshed = await refresh();
    if (refreshed) return readEventStream(path, onEvent, signal);
    return false;
  }
  if (response.status === 403) return false;
  if (!response.ok || !response.body) throw new Error('stream failed');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) return !signal.aborted;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const data = part
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n');
      if (!data) continue;
      try {
        onEvent(JSON.parse(data) as { type?: string; conversationId?: string });
      } catch {
        // Ignore a partial or non-JSON event.
      }
    }
  }
  return false;
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export { API_URL };
