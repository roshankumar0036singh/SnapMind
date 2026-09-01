import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return new Response('Unauthorized', { status: 401 });

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let { data: workspaces, error } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase GET Error:', error);
      return new Response(`Database Error: ${error.message}`, { status: 500 });
    }

    // Backend fallback: if the user has absolutely no workspaces, create one synchronously
    // This prevents the frontend from ever seeing an empty list and triggering race conditions.
    if (!workspaces || workspaces.length === 0) {
      const { data: defaultWorkspace, error: createError } = await supabaseAdmin
        .from('workspaces')
        .insert({
          name: 'Personal Workspace',
          owner_id: session.user.id,
          metadata: {}
        })
        .select()
        .single();

      if (!createError && defaultWorkspace) {
        workspaces = [defaultWorkspace];
      }
    }

    return Response.json(workspaces || []);

  } catch (error: any) {
    console.error('Workspaces GET API Error:', error);
    return new Response(error.message || 'Internal Server Error', { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return new Response('Unauthorized', { status: 401 });

    // Use admin client to bypass RLS for inserts
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: workspace, error } = await supabaseAdmin
      .from('workspaces')
      .insert({
        name: body.name || 'New Workspace',
        owner_id: session.user.id,
        metadata: body.metadata || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase Admin POST Error:', error);
      return new Response(`Database Error: ${error.message}`, { status: 500 });
    }

    return Response.json(workspace);

  } catch (error: any) {
    console.error('Workspaces POST API Error:', error);
    return new Response(error.message || 'Internal Server Error', { status: 500 });
  }
}
