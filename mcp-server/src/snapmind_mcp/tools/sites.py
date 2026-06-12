"""
SnapMind MCP Tools — Sites
Wraps GET /api/v1/sites, DELETE /api/v1/sites/{site_id}
"""
from mcp.types import TextContent
from snapmind_mcp.config import BACKEND_URL, API_PREFIX, get_headers, get_client
import urllib.parse

async def handle_list_sites(arguments: dict) -> list[TextContent]:
    """Returns list of indexed sites from unique source URLs."""
    async with get_client() as client:
        response = await client.get(
            f"{BACKEND_URL}{API_PREFIX}/sites",
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Failed to list sites: {data.get('detail', 'Unknown error')}")]

    sites = data.get("sites", [])
    if not sites:
        return [TextContent(type="text", text="No indexed sites found.")]

    formatted = "\n".join([
        f"- {s['url']} (Last updated: {s['last_updated_at']})"
        for s in sites
    ])
    return [TextContent(type="text", text=f"Indexed Sites ({len(sites)}):\n\n{formatted}")]

async def handle_delete_site(arguments: dict) -> list[TextContent]:
    """Deletes an indexed site and all its documents."""
    site_url = arguments.get("url")
    encoded_url = urllib.parse.quote(site_url, safe='')
    
    async with get_client() as client:
        response = await client.delete(
            f"{BACKEND_URL}{API_PREFIX}/sites/{encoded_url}",
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Failed to delete site: {data.get('detail', 'Unknown error')}")]

    return [TextContent(type="text", text=f"Successfully deleted site: {site_url}")]
