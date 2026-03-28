"""
MCP Unit Tests — Tool Handlers
Tests each tool handler in isolation using respx to mock httpx calls.
"""
import pytest
import respx
import httpx
import json
from unittest.mock import AsyncMock, patch


BASE_URL = "https://roshan123478-snapmind-backend.hf.space"


# ──────────────────────────────────────────────────────
# search tool
# ──────────────────────────────────────────────────────
@pytest.mark.asyncio
@respx.mock
async def test_search_success():
    respx.post(f"{BASE_URL}/search/global").mock(
        return_value=httpx.Response(200, json={
            "success": True,
            "results": [{"type": "doc", "url": "https://example.com", "score": 0.95, "content": "Hybrid search combines vector and keyword."}]
        })
    )
    from tools.search import handle_search
    result = await handle_search({"query": "hybrid search", "limit": 5})
    assert len(result) == 1
    assert "Hybrid search" in result[0].text or "Found 1" in result[0].text


@pytest.mark.asyncio
@respx.mock
async def test_search_no_results():
    respx.post(f"{BASE_URL}/search/global").mock(
        return_value=httpx.Response(200, json={"success": True, "results": []})
    )
    from tools.search import handle_search
    result = await handle_search({"query": "nonexistent query"})
    assert "No results" in result[0].text


@pytest.mark.asyncio
@respx.mock
async def test_search_api_error():
    respx.post(f"{BASE_URL}/search/global").mock(
        return_value=httpx.Response(200, json={"success": False, "error": "DB timeout"})
    )
    from tools.search import handle_search
    result = await handle_search({"query": "test"})
    assert "failed" in result[0].text.lower()


# ──────────────────────────────────────────────────────
# chat tool
# ──────────────────────────────────────────────────────
@pytest.mark.asyncio
@respx.mock
async def test_chat_success():
    respx.post(f"{BASE_URL}/chat").mock(
        return_value=httpx.Response(200, json={"answer": "SnapMind is a RAG platform.", "sources": []})
    )
    from tools.chat import handle_chat
    result = await handle_chat({"query": "What is SnapMind?"})
    assert "SnapMind" in result[0].text


@pytest.mark.asyncio
@respx.mock
async def test_chat_with_sources():
    respx.post(f"{BASE_URL}/chat").mock(
        return_value=httpx.Response(200, json={
            "answer": "RAG uses vector search.",
            "sources": [{"url": "https://example.com/rag"}]
        })
    )
    from tools.chat import handle_chat
    result = await handle_chat({"query": "Explain RAG"})
    assert "Sources" in result[0].text
    assert "example.com" in result[0].text


# ──────────────────────────────────────────────────────
# ingest tools
# ──────────────────────────────────────────────────────
@pytest.mark.asyncio
@respx.mock
async def test_ingest_url_success():
    respx.post(f"{BASE_URL}/ingest").mock(
        return_value=httpx.Response(200, json={"success": True, "chunks_stored": 42})
    )
    from tools.ingest import handle_ingest_url
    result = await handle_ingest_url({"url": "https://example.com"})
    assert "42" in result[0].text or "Successfully" in result[0].text


@pytest.mark.asyncio
@respx.mock
async def test_ingest_url_failure():
    respx.post(f"{BASE_URL}/ingest").mock(
        return_value=httpx.Response(200, json={"success": False, "error": "Firecrawl timeout"})
    )
    from tools.ingest import handle_ingest_url
    result = await handle_ingest_url({"url": "https://example.com"})
    assert "failed" in result[0].text.lower()


@pytest.mark.asyncio
async def test_ingest_file_not_found():
    from tools.ingest import handle_ingest_file
    result = await handle_ingest_file({"file_path": "/nonexistent/file.pdf"})
    assert "not found" in result[0].text.lower()


@pytest.mark.asyncio
@respx.mock
async def test_ingest_repo_success():
    respx.post(f"{BASE_URL}/ingest/github").mock(
        return_value=httpx.Response(200, json={"success": True, "job_id": "123"})
    )
    from tools.ingest import handle_ingest_repo
    result = await handle_ingest_repo({"repo_url": "https://github.com/example/repo"})
    assert "123" in result[0].text or "Started" in result[0].text


# ──────────────────────────────────────────────────────
# personas tool
# ──────────────────────────────────────────────────────
@pytest.mark.asyncio
@respx.mock
async def test_list_personas_success():
    respx.get(f"{BASE_URL}/personas").mock(
        return_value=httpx.Response(200, json={
            "success": True,
            "personas": [{"id": "abc", "name": "Scholar", "description": "Academic research"}]
        })
    )
    from tools.personas import handle_list_personas
    result = await handle_list_personas({})
    assert "Scholar" in result[0].text


@pytest.mark.asyncio
@respx.mock
async def test_get_analytics():
    respx.get(f"{BASE_URL}/admin/analytics").mock(
        return_value=httpx.Response(200, json={
            "docs": 120, "bookmarks": 55, "sessions": 34, "storage": "12 MB", "health": "excellent"
        })
    )
    from tools.personas import handle_get_analytics
    result = await handle_get_analytics({})
    assert "120" in result[0].text
    assert "excellent" in result[0].text


# ──────────────────────────────────────────────────────
# ingest_status tool
# ──────────────────────────────────────────────────────
@pytest.mark.asyncio
@respx.mock
async def test_ingest_status_completed():
    respx.get(f"{BASE_URL}/ingest/status/42").mock(
        return_value=httpx.Response(200, json={
            "success": True, "status": "completed", "message": "Done", "files_processed": 10, "chunks_count": 200
        })
    )
    from tools.ingest import handle_ingest_status
    result = await handle_ingest_status({"job_id": "42"})
    assert "completed" in result[0].text.lower()
    assert "200" in result[0].text
