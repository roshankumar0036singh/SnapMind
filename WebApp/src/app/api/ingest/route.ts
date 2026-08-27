import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    // Force streaming mode to prevent Cloudflare 524 timeouts
    body.stream = true;

    const response = await fetch(`${baseUrl}/api/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(`Backend Error: ${response.statusText} - ${errorText}`, { status: response.status });
    }

    // Return the response stream directly to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'application/x-ndjson',
      }
    });

  } catch (error: any) {
    console.error('Ingest API Error:', error);
    return new Response(error.message || 'Internal Server Error', { status: 500 });
  }
}
