"""
SnapMind MCP Resources — Knowledge Base
Implements snapmind://kb/stats and snapmind://kb/tags resources.
"""
import httpx
from config import BACKEND_URL, get_headers


async def read_kb_stats() -> str:
    """Fetch live knowledge base statistics."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{BACKEND_URL}/admin/analytics", headers=get_headers())
        return resp.text


async def read_kb_tags() -> str:
    """Fetch all semantic tags from the knowledge base."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{BACKEND_URL}/tags", headers=get_headers())
        return resp.text
