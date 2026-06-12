"""
SnapMind MCP Tools — Chat
Wraps POST /api/v1/search/chat endpoint with persona and session support.
"""
from mcp.types import TextContent
from config import BACKEND_URL, API_PREFIX, get_headers, get_client


async def handle_chat(arguments: dict) -> list[TextContent]:
    """Ask a question with full RAG context and optional persona."""
    async with get_client(timeout=60.0) as client:
        response = await client.post(
            f"{BACKEND_URL}{API_PREFIX}/search/chat",
            json={
                "query": arguments.get("query"),
                "site_id": arguments.get("site_id"),
                "session_id": arguments.get("session_id"),
                "persona_id": arguments.get("persona_id"),
            },
            headers=get_headers()
        )
        data = response.json()

    if "error" in data or "detail" in data:
        return [TextContent(type="text", text=f"Chat error: {data.get('error', data.get('detail', 'Unknown error'))}")]

    answer = data.get("answer", "")
    sources = data.get("sources", [])

    text = answer
    if sources:
        text += "\n\nSources:\n" + "\n".join([f"- {s.get('url', s.get('title', 'Unknown'))}" for s in sources])

    return [TextContent(type="text", text=text)]
