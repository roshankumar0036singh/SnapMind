import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return new Response('Unauthorized', { status: 401 });
    
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, title, messages, updated_at')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found, return empty shell for new chats
        return Response.json({
          session_id: id,
          title: 'New Chat',
          messages: [],
          updated_at: new Date().toISOString()
        });
      }
      return Response.json({ error: `Supabase Error: ${error.message}` }, { status: 500 });
    }

    if (!data) {
       return Response.json({
          session_id: id,
          title: 'New Chat',
          messages: [],
          updated_at: new Date().toISOString()
        });
    }

    const formattedData = {
      session_id: data.id,
      title: data.title,
      messages: data.messages,
      updated_at: data.updated_at
    };

    return Response.json(formattedData);

  } catch (error: any) {
    console.error(`Get Chat Session API Error:`, error);
    return new Response(error.message || 'Internal Server Error', { status: 500 });
  }
}
