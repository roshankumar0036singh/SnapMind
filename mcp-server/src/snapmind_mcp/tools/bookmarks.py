"""
SnapMind MCP Tools — Bookmarks
Wraps POST /api/v1/bookmarks, GET /api/v1/bookmarks, DELETE /api/v1/bookmarks/{id}
"""
from mcp.types import TextContent
from snapmind_mcp.config import BACKEND_URL, API_PREFIX, get_headers, get_client

async def handle_create_bookmark(arguments: dict) -> list[TextContent]:
    """Saves a research snippet as a bookmark with semantic search support."""
    content = arguments.get("content")
    source_url = arguments.get("source_url", "")
    metadata = arguments.get("metadata", {})
    workspace_id = arguments.get("workspace_id", "00000000-0000-0000-0000-000000000000")

    async with get_client() as client:
        response = await client.post(
            f"{BACKEND_URL}{API_PREFIX}/bookmarks",
            json={
                "content": content,
                "source_url": source_url,
                "metadata": metadata,
                "workspace_id": workspace_id
            },
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Bookmark creation failed: {data.get('detail', 'Unknown error')}")]

    return [TextContent(type="text", text=f"Successfully created bookmark with ID: {data.get('id')}")]

async def handle_list_bookmarks(arguments: dict) -> list[TextContent]:
    """Retrieves all bookmarks for the current user."""
    async with get_client() as client:
        response = await client.get(
            f"{BACKEND_URL}{API_PREFIX}/bookmarks",
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Failed to list bookmarks: {data.get('detail', 'Unknown error')}")]

    bookmarks = data.get("bookmarks", [])
    if not bookmarks:
        return [TextContent(type="text", text="No bookmarks found.")]

    formatted = "\n\n".join([
        f"ID: {b['id']} | Source: {b.get('source_url', 'N/A')} | Created: {b.get('created_at', 'N/A')}\nContent: {b['content'][:300]}..."
        for b in bookmarks
    ])
    return [TextContent(type="text", text=f"Found {len(bookmarks)} bookmarks:\n\n{formatted}")]

async def handle_delete_bookmark(arguments: dict) -> list[TextContent]:
    """Deletes a specific bookmark by ID."""
    bookmark_id = arguments.get("bookmark_id")
    
    async with get_client() as client:
        response = await client.delete(
            f"{BACKEND_URL}{API_PREFIX}/bookmarks/{bookmark_id}",
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Failed to delete bookmark: {data.get('detail', 'Unknown error')}")]

    return [TextContent(type="text", text=f"Successfully deleted bookmark {bookmark_id}")]
