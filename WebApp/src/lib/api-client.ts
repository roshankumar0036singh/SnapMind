import { createClient } from '@/utils/supabase/client';
import type { ProviderKeys, StreamEvent } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ----------------------------- provider keys ------------------------------ */

export const PROVIDER_KEYS_STORAGE = 'snapmind.providerKeys';

const PROVIDER_HEADER: Record<keyof ProviderKeys, string> = {
  gemini: 'x-gemini-key',
  mistral: 'x-mistral-key',
  firecrawl: 'x-firecrawl-key',
  lingodev: 'x-lingodev-key',
  groq: 'x-groq-key',
};

export function readProviderKeys(): ProviderKeys {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PROVIDER_KEYS_STORAGE);
    return raw ? (JSON.parse(raw) as ProviderKeys) : {};
  } catch {
    return {};
  }
}

export function writeProviderKeys(keys: ProviderKeys) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROVIDER_KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    /* quota or private mode — non-fatal */
  }
}

/** BYOK headers for the current user, injected on every proxied request. */
function providerHeaders(): Record<string, string> {
  const keys = readProviderKeys();
  const out: Record<string, string> = {};
  for (const [k, header] of Object.entries(PROVIDER_HEADER) as [keyof ProviderKeys, string][]) {
    const v = keys[k];
    if (v) out[header] = v;
  }
  return out;
}

/* --------------------------------- routing -------------------------------- */

/**
 * All backend traffic goes through the Next BFF at /api/sm/*, which attaches the
 * Supabase bearer token server-side. `path` is the backend path *without* the
 * /api/v1 prefix — e.g. 'sites', 'search/chat/stream', 'bookmarks/123'.
 */
export function smUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>) {
  const clean = path.replace(/^\/+/, '').replace(/^api\/v1\//, '');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const suffix = qs.toString();
  return `/api/sm/${clean}${suffix ? `?${suffix}` : ''}`;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = res.statusText || 'Request failed';
  let detail: unknown;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const json = JSON.parse(text);
      detail = json;
      message = json.detail || json.message || json.error || message;
      if (typeof message !== 'string') message = JSON.stringify(message);
    } catch {
      message = text.slice(0, 500);
    }
  }
  return new ApiError(res.status, message, detail);
}

type ReqOptions = {
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

async function json<T>(path: string, init: RequestInit, opts: ReqOptions = {}): Promise<T> {
  const res = await fetch(smUrl(path, opts.query), {
    ...init,
    signal: opts.signal,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...providerHeaders(),
      ...opts.headers,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export const api = {
  get: <T>(path: string, opts?: ReqOptions) => json<T>(path, { method: 'GET' }, opts),

  post: <T>(path: string, body?: unknown, opts?: ReqOptions) =>
    json<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }, opts),

  put: <T>(path: string, body?: unknown, opts?: ReqOptions) =>
    json<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }, opts),

  /** Partial update — used by PATCH chat/sessions/{id} (rename). */
  patch: <T>(path: string, body?: unknown, opts?: ReqOptions) =>
    json<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }, opts),

  del: <T>(path: string, opts?: ReqOptions) => json<T>(path, { method: 'DELETE' }, opts),

  /** Multipart upload — used by POST ingest/file. */
  form: <T>(path: string, form: FormData, opts?: ReqOptions) =>
    json<T>(path, { method: 'POST', body: form }, opts),

  /** Fetch a binary payload (DOCX report, JSON export). */
  async blob(path: string, body?: unknown, opts?: ReqOptions & { method?: string }): Promise<Blob> {
    const res = await fetch(smUrl(path, opts?.query), {
      method: opts?.method ?? (body === undefined ? 'GET' : 'POST'),
      signal: opts?.signal,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...providerHeaders(),
        ...opts?.headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw await parseError(res);
    return res.blob();
  },
};

/* -------------------------------- streaming ------------------------------- */

/**
 * POST a request and consume an NDJSON response line-by-line.
 *
 * The chat stream emits one JSON object per line: token | answer | thought |
 * retrieved_blocks | metadata | system_message. Other routes emit their own
 * unions — hence the type parameter, which defaults to the chat shape.
 */
export async function streamNDJSON<E = StreamEvent>(
  path: string,
  body: unknown,
  onEvent: (event: E) => void,
  opts: ReqOptions = {},
): Promise<void> {
  const res = await fetch(smUrl(path, opts.query), {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson, text/event-stream',
      ...providerHeaders(),
      ...opts.headers,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw await parseError(res);
  if (!res.body) throw new ApiError(500, 'Response had no body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flush = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    // Tolerate SSE-style framing, which the backend uses for its media type.
    const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
    if (!payload || payload === '[DONE]') return;

    // Parse and dispatch are separated deliberately: a partial or keepalive line
    // is expected and ignored, but an error thrown by the *handler* is a bug in
    // the caller and must propagate rather than disappear into this catch.
    let event: E;
    try {
      event = JSON.parse(payload) as E;
    } catch {
      return;
    }
    onEvent(event);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) flush(line);
    }
    buffer += decoder.decode();
    flush(buffer);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Subscribe to a server-sent-events endpoint (ingestion progress).
 * EventSource carries cookies, and the BFF turns those into a bearer token,
 * so no header plumbing is needed here.
 * Returns an unsubscribe function.
 */
export function subscribeSSE(
  path: string,
  handlers: {
    onMessage: (data: unknown) => void;
    onError?: (err: unknown) => void;
    onOpen?: () => void;
  },
  query?: Record<string, string | number | boolean | undefined | null>,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const source = new EventSource(smUrl(path, query));

  source.onopen = () => handlers.onOpen?.();
  source.onmessage = (evt) => {
    if (!evt.data || evt.data === '[DONE]') return;
    try {
      handlers.onMessage(JSON.parse(evt.data));
    } catch {
      handlers.onMessage(evt.data);
    }
  };
  source.onerror = (err) => {
    handlers.onError?.(err);
    source.close();
  };

  return () => source.close();
}

/* ------------------------------- legacy path ------------------------------ */

/**
 * Direct-to-backend fetch, kept for the pages written before the BFF existed.
 * Prefer `api.*` / `streamNDJSON` for new code.
 * @deprecated
 */
export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);

  const response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
  if (!response.ok) throw await parseError(response);
  return response.json();
}
