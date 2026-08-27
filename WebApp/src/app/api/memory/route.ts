import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspace_id');
    const type = url.searchParams.get('type'); // 'graph', 'sites', 'saved', 'bookmarks'

    if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

    if (type === 'graph') {
      const { data: nodes } = await supabase.from('nodes').select('*').eq('workspace_id', workspaceId);
      const { data: edges } = await supabase.from('edges').select('*').eq('workspace_id', workspaceId);
      
      const formattedNodes = (nodes || []).map(n => ({
        id: n.name, // cytoscape uses string ids, and our graph_logic creates links based on names
        label: n.name,
        group: n.entity_type === 'concept' ? 1 : 2
      }));
      
      // Filter out edges where source/target node names might be missing
      const nodeNames = new Set(formattedNodes.map(n => n.id));
      
      const formattedEdges = [];
      if (edges) {
        for (const edge of edges) {
           const sourceNode = (nodes || []).find(n => n.id === edge.source_node_id);
           const targetNode = (nodes || []).find(n => n.id === edge.target_node_id);
           if (sourceNode && targetNode) {
             formattedEdges.push({
               source: sourceNode.name,
               target: targetNode.name,
               label: edge.relation
             });
           }
        }
      }
      
      return NextResponse.json({ nodes: formattedNodes, links: formattedEdges });
    }
    
    if (type === 'sites') {
      // Get unique source_urls from documents
      const { data: documents } = await supabase
        .from('documents')
        .select('source_url')
        .eq('workspace_id', workspaceId);
        
      const uniqueUrls = Array.from(new Set((documents || []).map(d => d.source_url).filter(Boolean)));
      
      const sites = uniqueUrls.map((url, i) => ({
        id: i,
        title: url,
        url: url,
      }));
      
      return NextResponse.json(sites);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    console.error('Memory API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
