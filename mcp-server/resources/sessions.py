"""
SnapMind MCP Resources — Session History
Implements snapmind://sessions/{id}/history resource.
"""
import httpx
from config import BACKEND_URL, get_headers


async def read_session_history(session_id: str) -> str:
    """Fetch chat history for a specific session."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{BACKEND_URL}/sessions/{session_id}",
            headers=get_headers()
        )
        return resp.text
