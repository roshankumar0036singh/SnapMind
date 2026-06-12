"""
MCP Unit Tests — Resource Handlers
"""
import pytest
import respx
import httpx


BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

@pytest.mark.asyncio
@respx.mock
async def test_kb_stats():
    respx.get(f"{BASE_URL}{API_PREFIX}/admin/analytics").mock(
        return_value=httpx.Response(200, json={"docs": 100, "health": "excellent"})
    )
    from resources.kb import read_kb_stats
    result = await read_kb_stats()
    assert "docs" in result or "100" in result


@pytest.mark.asyncio
@respx.mock
async def test_kb_tags():
    respx.get(f"{BASE_URL}{API_PREFIX}/tags").mock(
        return_value=httpx.Response(200, json={"success": True, "tags": ["AI", "RAG", "vector"]})
    )
    from resources.kb import read_kb_tags
    result = await read_kb_tags()
    assert "tags" in result or "AI" in result


@pytest.mark.asyncio
@respx.mock
async def test_session_history():
    respx.get(f"{BASE_URL}{API_PREFIX}/search/sessions/test-session-id").mock(
        return_value=httpx.Response(200, json={
            "success": True,
            "history": [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi!"}]
        })
    )
    from resources.sessions import read_session_history
    result = await read_session_history("test-session-id")
    assert "Hello" in result or "history" in result

@pytest.mark.asyncio
@respx.mock
async def test_kb_sites():
    respx.get(f"{BASE_URL}{API_PREFIX}/sites").mock(
        return_value=httpx.Response(200, json={"success": True, "sites": [{"url": "http://example.com"}]})
    )
    from resources.kb import read_kb_sites
    result = await read_kb_sites()
    assert "example.com" in result
