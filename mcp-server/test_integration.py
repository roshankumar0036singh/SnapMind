"""
SnapMind MCP Server — Integration Tests
Tests tool logic by calling the backend endpoints directly.
"""
import asyncio
import httpx
import os
import sys
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.environ.get("SNAPMIND_BACKEND_URL", "https://roshan123478-snapmind-backend.hf.space").rstrip("/")
HF_TOKEN = os.environ.get("HF_TOKEN", "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")

HEADERS = {"Content-Type": "application/json"}
if HF_TOKEN:
    HEADERS["Authorization"] = f"Bearer {HF_TOKEN}"
    HEADERS["x-hf-token"] = HF_TOKEN

passed = 0
failed = 0


async def test(name: str, coro):
    global passed, failed
    try:
        await coro
        print(f"  PASS  {name}")
        passed += 1
    except Exception as e:
        print(f"  FAIL  {name}: {e}")
        failed += 1


async def test_backend_connectivity():
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{BACKEND_URL}/", headers=HEADERS)
        assert resp.status_code == 200, f"Root returned {resp.status_code}"


async def test_analytics():
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{BACKEND_URL}/admin/analytics", headers=HEADERS)
        assert resp.status_code == 200, f"Analytics returned {resp.status_code}"
        data = resp.json()
        assert "docs" in data or "error" not in data, f"Unexpected response: {data}"


async def test_search():
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/search/global",
            json={"query": "what is hybrid search", "limit": 3},
            headers=HEADERS
        )
        assert resp.status_code == 200, f"Search returned {resp.status_code}"


async def test_chat():
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/chat",
            json={"query": "What is SnapMind?"},
            headers=HEADERS
        )
        assert resp.status_code == 200, f"Chat returned {resp.status_code}"
        data = resp.json()
        assert "answer" in data or "error" not in data, f"Unexpected: {data}"


async def test_personas():
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{BACKEND_URL}/personas", headers=HEADERS)
        assert resp.status_code == 200, f"Personas returned {resp.status_code}"


async def test_ingest_url():
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/ingest",
            json={"url": "https://example.com", "crawl_mode": "single"},
            headers=HEADERS
        )
        assert resp.status_code == 200, f"Ingest returned {resp.status_code}"


async def run_all():
    print(f"\nSnapMind MCP Integration Tests")
    print(f"Backend: {BACKEND_URL}\n")

    await test("Backend Connectivity", test_backend_connectivity())
    await test("Analytics Endpoint", test_analytics())
    await test("Global Search", test_search())
    await test("RAG Chat", test_chat())
    await test("List Personas", test_personas())
    await test("Ingest URL", test_ingest_url())

    print(f"\nResults: {passed} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_all())
