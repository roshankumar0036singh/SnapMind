import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return new Response('Unauthorized', { status: 401 });
    
    const body = await req.json();
    const { session_id, title, messages, workspace_id } = body;

    if (!session_id || !messages) {
      return new Response('Missing session_id or messages', { status: 400 });
    }

    // Validate workspace_id format if provided (must be valid UUID for PostgreSQL uuid column)
    const isUuid = typeof workspace_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspace_id);
    const validWorkspaceId = isUuid ? workspace_id : null;

    const { error } = await supabase
      .from('chat_sessions')
      .upsert({
        id: session_id,
        title: title || 'New Chat',
        messages: messages,
        user_id: session.user.id,
        workspace_id: validWorkspaceId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.error('Supabase Sync Error:', error);
      return new Response(`Supabase Error: ${error.message}`, { status: 500 });
    }

    return Response.json({ success: true, session_id });

  } catch (error: any) {
    console.error('Sync Chat Session API Error:', error);
    return new Response(error.message || 'Internal Server Error', { status: 500 });
  }
}
