"""
SnapMind MCP Tools — Knowledge Graph
Wraps GET /api/v1/graph/data
"""
from mcp.types import TextContent
from snapmind_mcp.config import BACKEND_URL, API_PREFIX, get_headers, get_client
import json

async def handle_knowledge_graph(arguments: dict) -> list[TextContent]:
    """Get the full knowledge graph (nodes + edges) data."""
    async with get_client(timeout=30.0) as client:
        response = await client.get(
            f"{BACKEND_URL}{API_PREFIX}/graph/data",
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Failed to fetch knowledge graph: {data.get('detail', 'Unknown error')}")]

    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    
    summary = f"Knowledge Graph Data: {len(nodes)} nodes, {len(edges)} edges.\n\n"
    summary += "Nodes (sample):\n"
    for n in nodes[:10]:
        summary += f"- {n['data']['label']} ({n['data']['type']})\n"
        
    summary += "\nEdges (sample):\n"
    for e in edges[:10]:
        summary += f"- {e['data']['source']} --[{e['data']['label']}]--> {e['data']['target']}\n"

    if len(nodes) > 10 or len(edges) > 10:
        summary += "\n(Truncated... use resource snapmind://graph/full to read full JSON)"

    return [TextContent(type="text", text=summary)]
