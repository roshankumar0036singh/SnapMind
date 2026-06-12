"""
SnapMind MCP Tools — Ingest
Wraps all 3 ingest endpoints: URL, File, and GitHub Repository under /api/v1/ingest.
"""
import os
from mcp.types import TextContent
from config import BACKEND_URL, API_PREFIX, get_headers, get_client


async def handle_ingest_url(arguments: dict) -> list[TextContent]:
    """Index a website URL into the knowledge base."""
    async with get_client(timeout=60.0) as client:
        response = await client.post(
            f"{BACKEND_URL}{API_PREFIX}/ingest",
            json={
                "url": arguments.get("url"),
                "crawl_mode": arguments.get("crawl_mode", "single"),
                "max_pages": arguments.get("max_pages", 20),
            },
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Ingestion failed: {data.get('error', data.get('detail', 'Unknown error'))}")]

    chunks = data.get("chunks_stored", "?")
    return [TextContent(type="text", text=f"Successfully indexed: {arguments['url']} ({chunks} chunks stored)")]


async def handle_ingest_file(arguments: dict) -> list[TextContent]:
    """Index a local file (PDF, DOCX, CSV, TXT) into the knowledge base."""
    path = arguments.get("file_path")
    if not os.path.exists(path):
        return [TextContent(type="text", text=f"Error: File '{path}' not found.")]

    async with get_client(timeout=120.0) as client:
        with open(path, "rb") as f:
            files = {"file": (os.path.basename(path), f)}
            headers = {k: v for k, v in get_headers().items() if k.lower() != "content-type"}
            response = await client.post(
                f"{BACKEND_URL}{API_PREFIX}/ingest/file",
                files=files,
                headers=headers
            )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"File ingestion failed: {data.get('error', data.get('detail', 'Unknown error'))}")]

    return [TextContent(type="text", text=f"Successfully indexed file: {os.path.basename(path)}")]


async def handle_ingest_repo(arguments: dict) -> list[TextContent]:
    """Clone and index an entire GitHub repository."""
    async with get_client(timeout=120.0) as client:
        response = await client.post(
            f"{BACKEND_URL}{API_PREFIX}/ingest/github",
            json={"repo_url": arguments.get("repo_url")},
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Repo ingestion failed: {data.get('error', data.get('detail', 'Unknown error'))}")]

    return [TextContent(type="text", text=f"Started indexing repo: {arguments['repo_url']}\nJob ID: {data.get('job_id', 'N/A')}")]


async def handle_ingest_status(arguments: dict) -> list[TextContent]:
    """Poll the status of a background repository ingestion job."""
    job_id = arguments.get("job_id")
    if not job_id:
        return [TextContent(type="text", text="Error: job_id is required.")]

    async with get_client(timeout=15.0) as client:
        response = await client.get(
            f"{BACKEND_URL}{API_PREFIX}/status/{job_id}", # NOTE: It seems status endpoints are in status.py under /api/v1/status
            headers=get_headers()
        )
        # fallback if not in status
        if response.status_code == 404:
             response = await client.get(
                 f"{BACKEND_URL}{API_PREFIX}/ingest/status/{job_id}",
                 headers=get_headers()
             )
        data = response.json()

    if not data.get("success"):
        return [TextContent(type="text", text=f"Status check failed: {data.get('error', data.get('detail', 'Unknown error'))}")]

    status = data.get("status", "unknown")
    msg = data.get("message", "")
    files = data.get("files_processed", "?")
    chunks = data.get("chunks_count", "?")

    return [TextContent(
        type="text",
        text=f"Job {job_id} — Status: {status.upper()}\n{msg}\nFiles processed: {files} | Chunks indexed: {chunks}"
    )]
