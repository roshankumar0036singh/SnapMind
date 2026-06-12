"""
SnapMind MCP Tools — Personas
Wraps GET /api/v1/personas and GET /api/v1/admin/analytics
"""
from mcp.types import TextContent
from snapmind_mcp.config import BACKEND_URL, API_PREFIX, get_headers, get_client


async def handle_list_personas(arguments: dict) -> list[TextContent]:
    """List all available AI personas."""
    async with get_client(timeout=15.0) as client:
        response = await client.get(f"{BACKEND_URL}{API_PREFIX}/personas", headers=get_headers())
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Failed to fetch personas: {data.get('detail', 'Unknown error')}")]

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
    async with get_client(timeout=15.0) as client:
        response = await client.get(f"{BACKEND_URL}{API_PREFIX}/admin/analytics", headers=get_headers())
        data = response.json()

    if "error" in data or "detail" in data:
        return [TextContent(type="text", text=f"Analytics error: {data.get('error', data.get('detail', 'Unknown error'))}")]

    stats = (
        f"SnapMind Library Stats:\n"
        f"- Documents Indexed: {data.get('docs', 0)}\n"
        f"- Bookmarks Saved: {data.get('bookmarks', 0)}\n"
        f"- Total Sessions: {data.get('sessions', 0)}\n"
        f"- Storage Used: {data.get('storage', '0 B')}\n"
        f"- Health: {data.get('health', 'unknown')}"
    )
    return [TextContent(type="text", text=stats)]
