import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${baseUrl}/api/v1/ingest/file`, {
      method: 'POST',
      headers: {
        ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
      },
      // Pass the formData directly, which lets fetch set the proper boundary and content-type
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(`Backend Error: ${response.statusText} - ${errorText}`, { status: response.status });
    }

    const result = await response.json();
    return Response.json(result);

  } catch (error: any) {
    console.error('Ingest File API Error:', error);
    return new Response(error.message || 'Internal Server Error', { status: 500 });
  }
}
