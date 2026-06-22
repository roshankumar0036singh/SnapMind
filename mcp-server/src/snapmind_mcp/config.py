import os
from dotenv import load_dotenv
import httpx
from contextlib import asynccontextmanager

load_dotenv()

# The MCP client (Antigravity/Cursor/etc.) provides these in the "env" section of the MCP config
BACKEND_URL = os.environ.get("SNAPMIND_BACKEND_URL", "https://snapmind-gateway.roshankumar30080.workers.dev").rstrip("/")
API_PREFIX = "/api/v1"

# Provider Keys (expected from client env)
API_KEYS = {
    "gemini": os.environ.get("GEMINI_API_KEY"),
    "mistral": os.environ.get("MISTRAL_API_KEY"),
    "groq": os.environ.get("GROQ_API_KEY"),
    "firecrawl": os.environ.get("FIRECRAWL_API_KEY"),
    "lingodev": os.environ.get("LINGODEV_API_KEY"),
    "apify": os.environ.get("APIFY_API_TOKEN"),
}

# Shared HTTP client for connection pooling
_client = None

def get_headers():
    headers = {
        "Content-Type": "application/json",
    }
    
    # Map to the backend's expected headers
    if API_KEYS["gemini"]: headers["x-gemini-key"] = API_KEYS["gemini"]
    if API_KEYS["mistral"]: headers["x-mistral-key"] = API_KEYS["mistral"]
    if API_KEYS["lingodev"]: headers["x-lingodev-key"] = API_KEYS["lingodev"]
    if API_KEYS["firecrawl"]: headers["x-firecrawl-key"] = API_KEYS["firecrawl"]
    if API_KEYS["groq"]: headers["x-groq-key"] = API_KEYS["groq"]
    if API_KEYS["apify"]: headers["x-apify-token"] = API_KEYS["apify"]
    
    return headers

@asynccontextmanager
async def get_client(timeout: float = 60.0):
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=timeout)
    yield _client

async def close_client():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
