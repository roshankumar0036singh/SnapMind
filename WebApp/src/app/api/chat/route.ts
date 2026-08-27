import { NextRequest } from 'next/server';
import { getMostRecentUserMessage } from '@/lib/utils';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 50;

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
    
    // Call our FastAPI backend
    const backendResponse = await fetch(`${baseUrl}/api/v1/search/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
      },
      body: JSON.stringify({
        query: userMessage.content,
        history: messages.slice(0, -1),
        session_id: 'default', // TODO: manage chat sessions properly
        workspace_id: workspace_id || null,
        output_lang: 'English'
      })
    });

    if (!backendResponse.ok) {
      return new Response(`Backend Error: ${backendResponse.statusText}`, { status: backendResponse.status });
    }

    if (!backendResponse.body) {
      return new Response('No body in backend response', { status: 500 });
    }

    let buffer = '';
    // Transform FastAPI ndjson stream to Vercel AI DataStream format
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        buffer += new TextDecoder().decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'token' && data.text) {
              // Vercel AI SDK format for text chunk: 0:"<text>"
              controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(data.text)}\n`));
            } else if (data.type === 'retrieved_blocks') {
              // Vercel AI SDK format for data/annotations: 2:[{"blocks":...}]
              // We'll pass sources down to the client
              controller.enqueue(new TextEncoder().encode(`2:${JSON.stringify([data])}\n`));
            } else if (data.type === 'system_message') {
              // We can stream this as text, or send as a data block
              controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(`\n> ${data.content}\n\n`)}\n`));
            }
          } catch (e) {
            console.error('Failed to parse line:', line);
          }
        }
      }
    });

    return new Response(backendResponse.body.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-vercel-ai-data-stream': 'v1'
      }
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
