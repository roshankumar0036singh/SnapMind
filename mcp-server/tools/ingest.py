"""
SnapMind MCP Tools — Ingest
Wraps all 3 ingest endpoints: URL, File, and GitHub Repository.
"""
import os
import httpx
from mcp.types import TextContent
from config import BACKEND_URL, get_headers


async def handle_ingest_url(arguments: dict) -> list[TextContent]:
    """Index a website URL into the knowledge base."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{BACKEND_URL}/ingest",
            json={
                "url": arguments.get("url"),
                "crawl_mode": arguments.get("crawl_mode", "single"),
                "max_pages": arguments.get("max_pages", 20),
            },
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Ingestion failed: {data.get('error', 'Unknown error')}")]

    chunks = data.get("chunks_stored", "?")
    return [TextContent(type="text", text=f"Successfully indexed: {arguments['url']} ({chunks} chunks stored)")]


async def handle_ingest_file(arguments: dict) -> list[TextContent]:
    """Index a local file (PDF, DOCX, CSV, TXT) into the knowledge base."""
    path = arguments.get("file_path")
    if not os.path.exists(path):
        return [TextContent(type="text", text=f"Error: File '{path}' not found.")]

    async with httpx.AsyncClient(timeout=120.0) as client:
        with open(path, "rb") as f:
            files = {"file": (os.path.basename(path), f)}
            headers = {k: v for k, v in get_headers().items() if k.lower() != "content-type"}
            response = await client.post(
                f"{BACKEND_URL}/ingest/file",
                files=files,
                headers=headers
            )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"File ingestion failed: {data.get('error', 'Unknown error')}")]

    return [TextContent(type="text", text=f"Successfully indexed file: {os.path.basename(path)}")]


async def handle_ingest_repo(arguments: dict) -> list[TextContent]:
    """Clone and index an entire GitHub repository."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BACKEND_URL}/ingest/github",
            json={"repo_url": arguments.get("repo_url")},
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Repo ingestion failed: {data.get('error', 'Unknown error')}")]

    return [TextContent(type="text", text=f"Started indexing repo: {arguments['repo_url']}\nJob ID: {data.get('job_id', 'N/A')}")]
