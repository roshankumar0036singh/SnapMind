"""
SnapMind MCP Resources — Session History
Implements snapmind://sessions/{id}/history resource.
"""
from snapmind_mcp.config import BACKEND_URL, API_PREFIX, get_headers, get_client


async def read_session_history(session_id: str) -> str:
    """Fetch chat history for a specific session."""
    async with get_client(timeout=15.0) as client:
        resp = await client.get(
            f"{BACKEND_URL}{API_PREFIX}/search/sessions/{session_id}", # Assuming it's under search or similar now, fallback logic below
            headers=get_headers()
        )
        if resp.status_code == 404:
             # Try old route or workspaces route just in case
             resp = await client.get(
                 f"{BACKEND_URL}{API_PREFIX}/workspaces/sessions/{session_id}",
                 headers=get_headers()
             )
        return resp.text
