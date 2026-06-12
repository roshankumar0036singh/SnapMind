"""
SnapMind MCP Tools — Search
Wraps POST /api/v1/search/global endpoint.
"""
from mcp.types import TextContent
from config import BACKEND_URL, API_PREFIX, get_headers, get_client


async def handle_search(arguments: dict) -> list[TextContent]:
    """Semantic search across the entire RAG knowledge base."""
    query = arguments.get("query")
    limit = arguments.get("limit", 10)

    async with get_client(timeout=30.0) as client:
        response = await client.post(
            f"{BACKEND_URL}{API_PREFIX}/search/global",
            json={"query": query, "limit": limit},
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Search failed: {data.get('error', data.get('detail', 'Unknown error'))}")]

    results = data.get("results", [])
    if not results:
        return [TextContent(type="text", text="No results found in your knowledge base.")]

    formatted = "\n\n".join([
        f"[{r['type'].upper()}] {r['url']}\nScore: {r['score']:.2f}\nContent: {r['content'][:300]}..."
        for r in results
    ])
    return [TextContent(type="text", text=f"Found {len(results)} matches:\n\n{formatted}")]
