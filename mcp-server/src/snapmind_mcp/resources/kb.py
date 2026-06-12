"""
SnapMind MCP Resources — Knowledge Base
Implements snapmind://kb/stats, snapmind://kb/tags, snapmind://kb/sites
"""
from snapmind_mcp.config import BACKEND_URL, API_PREFIX, get_headers, get_client


async def read_kb_stats() -> str:
    """Fetch live knowledge base statistics."""
    async with get_client(timeout=15.0) as client:
        resp = await client.get(f"{BACKEND_URL}{API_PREFIX}/admin/analytics", headers=get_headers())
        return resp.text


async def read_kb_tags() -> str:
    """Fetch all semantic tags from the knowledge base."""
    async with get_client(timeout=15.0) as client:
        resp = await client.get(f"{BACKEND_URL}{API_PREFIX}/tags", headers=get_headers())
        return resp.text

async def read_kb_sites() -> str:
    """Fetch all indexed sites."""
    async with get_client(timeout=15.0) as client:
        resp = await client.get(f"{BACKEND_URL}{API_PREFIX}/sites", headers=get_headers())
        return resp.text
