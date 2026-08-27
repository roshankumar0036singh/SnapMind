import { NextRequest } from 'next/server';
import { getMostRecentUserMessage } from '@/lib/utils';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 300; // Browser research can take a while

export async function POST(req: NextRequest) {
  try {
    const { messages, workspace_id } = await req.json();
    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 404 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    // Call our FastAPI backend's browser research endpoint
    const backendResponse = await fetch(`${baseUrl}/api/v1/research/research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
      },
      body: JSON.stringify({
        query: userMessage.content,
        session_id: 'browser-session', 
        workspace_id: workspace_id || null,
        output_lang: 'English'
      })
    });

    if (!backendResponse.ok) {
      return new Response(`Backend Error: ${backendResponse.statusText}`, { status: backendResponse.status });
    }

    const result = await backendResponse.json();
    const answer = result.answer || "No answer returned.";

    // Convert the single JSON response into a Vercel AI SDK data stream
    // Format: 0:"text chunk"\n
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(answer)}\n`));
        
        // Also send citations if available
        if (result.citations && result.citations.length > 0) {
          controller.enqueue(new TextEncoder().encode(`2:${JSON.stringify([{ blocks: result.citations }])}\n`));
        }
        
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-vercel-ai-data-stream': 'v1'
      }
    });

  } catch (error) {
    console.error('Browser API Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
