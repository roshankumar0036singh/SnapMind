"""
SnapMind MCP Tools — Search
Wraps POST /search/global endpoint.
"""
import httpx
from mcp.types import TextContent
from config import BACKEND_URL, get_headers


async def handle_search(arguments: dict) -> list[TextContent]:
    """Semantic search across the entire RAG knowledge base."""
    query = arguments.get("query")
    limit = arguments.get("limit", 10)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BACKEND_URL}/search/global",
            json={"query": query, "limit": limit},
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Search failed: {data.get('error', 'Unknown error')}")]

    results = data.get("results", [])
    if not results:
        return [TextContent(type="text", text="No results found in your knowledge base.")]

    formatted = "\n\n".join([
        f"[{r['type'].upper()}] {r['url']}\nScore: {r['score']:.2f}\nContent: {r['content'][:300]}..."
        for r in results
    ])
    return [TextContent(type="text", text=f"Found {len(results)} matches:\n\n{formatted}")]
