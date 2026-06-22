"""
SnapMind MCP Tools — Export
Wraps GET /api/v1/export/{url}
"""
from mcp.types import TextContent
from snapmind_mcp.config import BACKEND_URL, API_PREFIX, get_headers, get_client
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

async def handle_export_session(arguments: dict) -> list[TextContent]:
    """Export session data (chat, edges, sources)."""
    session_id = arguments.get("session_id")
    format_type = arguments.get("format", "markdown")

    async with get_client(timeout=30.0) as client:
        response = await client.get(
            f"{BACKEND_URL}{API_PREFIX}/export/session/{session_id}?format={format_type}",
            headers=get_headers()
        )

    if response.status_code != 200:
        try:
             data = response.json()
             err = data.get("detail", "Unknown error")
        except:
             err = response.text
        return [TextContent(type="text", text=f"Failed to export session: {err}")]

    if format_type == "csv":
        # CSV comes as a zip file, we shouldn't dump binary into MCP text
        return [TextContent(type="text", text=f"Session successfully exported as a ZIP file containing CSVs. The binary payload cannot be rendered here, but the backend generated it successfully.")]

    content = response.text
    if len(content) > 15000:
        return [TextContent(type="text", text=f"Export successful. Content is very large ({len(content)} chars). First 15000 chars:\n\n{content[:15000]}...\n\n(Truncated for MCP)")]
        
    return [TextContent(type="text", text=f"Export Data:\n\n{content}")]
