import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return new Response('Unauthorized', { status: 401 });
    
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspace_id');

    let query = supabase
      .from('chat_sessions')
      .select('id, title, updated_at')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });

    if (workspaceId) {
      query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
    } else {
      query = query.is('workspace_id', null);
    }
    
    const { data, error } = await query;

    if (error) {
      return new Response(`Supabase Error: ${error.message}`, { status: 500 });
    }

    // Map id to session_id to match frontend expectations
    const formattedData = (data || []).map(row => ({
      session_id: row.id,
      title: row.title,
      updated_at: row.updated_at
    }));

    return Response.json(formattedData);

  } catch (error: any) {
    console.error('Get Chat Sessions API Error:', error);
    return new Response(error.message || 'Internal Server Error', { status: 500 });
  }
}
