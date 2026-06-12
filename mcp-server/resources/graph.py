"""
SnapMind MCP Resources — Graph
Implements snapmind://graph/full and snapmind://graph/sessions
"""
from config import BACKEND_URL, API_PREFIX, get_headers, get_client


async def read_graph_full() -> str:
    """Fetch the full knowledge graph data."""
    async with get_client(timeout=30.0) as client:
        resp = await client.get(f"{BACKEND_URL}{API_PREFIX}/graph/data", headers=get_headers())
        return resp.text

async def read_graph_sessions() -> str:
    """Fetch all sessions that have graph data."""
    async with get_client(timeout=15.0) as client:
        resp = await client.get(f"{BACKEND_URL}{API_PREFIX}/graph/sessions", headers=get_headers())
        return resp.text
