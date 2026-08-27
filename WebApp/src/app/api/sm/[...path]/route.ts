import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Catch-all proxy from the browser to the SnapMind FastAPI backend.
 *
 *   /api/sm/<backend path>  ->  ${NEXT_PUBLIC_API_URL}/api/v1/<backend path>
 *
 * Why a proxy at all: the Supabase access token is attached here, server-side,
 * from the session cookie. That also lets `EventSource` reach authenticated
 * streaming endpoints, which it could not do with an Authorization header.
 *
 * BYOK provider keys (x-gemini-key & friends) belong to the user and are
 * forwarded verbatim from the client request.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Client headers that may pass through to the backend. */
const FORWARD_HEADERS = [
  'x-gemini-key',
  'x-mistral-key',
  'x-firecrawl-key',
  'x-lingodev-key',
  'x-groq-key',
  'x-api-key',
  'accept',
  'content-type',
];

/** Backend response headers worth preserving (streams, downloads). */
const EXPOSE_HEADERS = ['content-type', 'content-disposition', 'cache-control', 'content-length'];

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function backendTarget(req: NextRequest): string {
  // Read from pathname rather than the route params so percent-encoding in
  // path segments (source URLs used as ids) survives untouched.
  const rest = req.nextUrl.pathname.replace(/^\/api\/sm\/?/, '');
  return `${BASE_URL}/api/v1/${rest}${req.nextUrl.search}`;
}

async function proxy(req: NextRequest): Promise<Response> {
  const target = backendTarget(req);

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
      // The backend also accepts this when infrastructure proxies claim
      // Authorization for themselves (see backend/security.py).
      headers.set('x-supabase-auth', session.access_token);
    }
  } catch (err) {
    console.error('[sm-proxy] session lookup failed:', err);
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  let body: BodyInit | undefined;
  if (hasBody) {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      // Re-derive the multipart body so the boundary matches the new request.
      headers.delete('content-type');
      body = await req.formData();
    } else {
      const raw = await req.text();
      body = raw.length ? raw : undefined;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      // Streaming responses must not be buffered by an intermediate cache.
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch (err) {
    console.error(`[sm-proxy] ${method} ${target} failed:`, err);
    return Response.json(
      {
        detail:
          err instanceof Error && /fetch failed|ECONNREFUSED/i.test(err.message)
            ? `Cannot reach the SnapMind backend at ${BASE_URL}. Is it running?`
            : (err as Error)?.message || 'Upstream request failed',
      },
      { status: 502 },
    );
  }

  const out = new Headers();
  for (const name of EXPOSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  if (out.get('content-type')?.includes('text/event-stream')) {
    out.set('cache-control', 'no-cache, no-transform');
    out.set('connection', 'keep-alive');
    out.delete('content-length');
  }

  // Pass the body through as a stream so NDJSON/SSE arrive incrementally.
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
