"""
SnapMind MCP Tools — Web Research
Wraps POST /browser/research multi-agent pipeline.
"""
import httpx
from mcp.types import TextContent
from config import BACKEND_URL, get_headers


async def handle_web_research(arguments: dict) -> list[TextContent]:
    """Deep multi-agent web research with synthesis and citations."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BACKEND_URL}/browser/research",
            json={
                "query": arguments.get("query"),
                "session_id": arguments.get("session_id"),
            },
            headers=get_headers()
        )
        data = response.json()

    if "error" in data:
        return [TextContent(type="text", text=f"Research error: {data['error']}")]

    answer = data.get("answer", "")
    sources = data.get("sources", [])

    text = answer
    if sources:
        text += "\n\nResearch Sources:\n" + "\n".join([f"- {s}" for s in sources])

    return [TextContent(type="text", text=text)]
