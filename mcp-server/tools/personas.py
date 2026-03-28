"""
SnapMind MCP Tools — Personas
Wraps GET /personas and related persona management endpoints.
"""
import httpx
from mcp.types import TextContent
from config import BACKEND_URL, get_headers


async def handle_list_personas(arguments: dict) -> list[TextContent]:
    """List all available AI personas."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{BACKEND_URL}/personas", headers=get_headers())
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text="Failed to fetch personas.")]

    personas = data.get("personas", [])
    if not personas:
        return [TextContent(type="text", text="No custom personas found. Using default SnapMind persona.")]

    formatted = "\n".join([
        f"- **{p['name']}** (ID: {p['id']})\n  {p.get('description', 'No description')}"
        for p in personas
    ])
    return [TextContent(type="text", text=f"Available Personas:\n\n{formatted}")]


async def handle_get_analytics(arguments: dict) -> list[TextContent]:
    """Get knowledge base analytics and health status."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{BACKEND_URL}/admin/analytics", headers=get_headers())
        data = response.json()

    if "error" in data:
        return [TextContent(type="text", text=f"Analytics error: {data['error']}")]

    stats = (
        f"SnapMind Library Stats:\n"
        f"- Documents Indexed: {data.get('docs', 0)}\n"
        f"- Bookmarks Saved: {data.get('bookmarks', 0)}\n"
        f"- Total Sessions: {data.get('sessions', 0)}\n"
        f"- Storage Used: {data.get('storage', '0 B')}\n"
        f"- Health: {data.get('health', 'unknown')}"
    )
    return [TextContent(type="text", text=stats)]
