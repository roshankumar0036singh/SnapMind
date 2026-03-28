"""
SnapMind MCP Tools — Chat
Wraps POST /chat endpoint with persona and session support.
"""
import httpx
from mcp.types import TextContent
from config import BACKEND_URL, get_headers


async def handle_chat(arguments: dict) -> list[TextContent]:
    """Ask a question with full RAG context and optional persona."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{BACKEND_URL}/chat",
            json={
                "query": arguments.get("query"),
                "site_id": arguments.get("site_id"),
                "session_id": arguments.get("session_id"),
                "persona_id": arguments.get("persona_id"),
            },
            headers=get_headers()
        )
        data = response.json()

    if "error" in data:
        return [TextContent(type="text", text=f"Chat error: {data['error']}")]

    answer = data.get("answer", "")
    sources = data.get("sources", [])

    text = answer
    if sources:
        text += "\n\nSources:\n" + "\n".join([f"- {s.get('url', s.get('title', 'Unknown'))}" for s in sources])

    return [TextContent(type="text", text=text)]
