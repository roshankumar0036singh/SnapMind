"""
SnapMind MCP Tools — Export
Wraps GET /api/v1/export/{url}
"""
from mcp.types import TextContent
from config import BACKEND_URL, API_PREFIX, get_headers, get_client
import urllib.parse

async def handle_export_site(arguments: dict) -> list[TextContent]:
    """Export indexed content as text."""
    site_url = arguments.get("url")
    format_type = arguments.get("format", "text")
    encoded_url = urllib.parse.quote(site_url, safe='')

    async with get_client(timeout=30.0) as client:
        response = await client.get(
            f"{BACKEND_URL}{API_PREFIX}/export/{encoded_url}?format={format_type}",
            headers=get_headers()
        )

    if response.status_code != 200:
        try:
             data = response.json()
             err = data.get("detail", "Unknown error")
        except:
             err = response.text
        return [TextContent(type="text", text=f"Failed to export site: {err}")]

    content = response.text
    if len(content) > 10000:
        return [TextContent(type="text", text=f"Export successful. Content is very large ({len(content)} chars). First 10000 chars:\n\n{content[:10000]}...")]
        
    return [TextContent(type="text", text=f"Export Data:\n\n{content}")]
