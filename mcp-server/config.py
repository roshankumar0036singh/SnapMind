import os
from dotenv import load_dotenv

load_dotenv()

# The MCP client (Antigravity/Cursor/etc.) provides these in the "env" section of the MCP config
BACKEND_URL = os.environ.get("SNAPMIND_BACKEND_URL", "http://localhost:8000").rstrip("/")
HF_TOKEN = os.environ.get("HF_TOKEN")

# Provider Keys (expected from client env)
API_KEYS = {
    "gemini": os.environ.get("GEMINI_API_KEY"),
    "mistral": os.environ.get("MISTRAL_API_KEY"),
    "groq": os.environ.get("GROQ_API_KEY"),
    "firecrawl": os.environ.get("FIRECRAWL_API_KEY"),
    "lingodev": os.environ.get("LINGODEV_API_KEY"),
}

def get_headers():
    headers = {
        "Content-Type": "application/json",
    }
    if HF_TOKEN:
        headers["Authorization"] = f"Bearer {HF_TOKEN}"
        headers["x-hf-token"] = HF_TOKEN
        
    # Map to the backend's expected headers
    if API_KEYS["gemini"]: headers["x-gemini-key"] = API_KEYS["gemini"]
    if API_KEYS["mistral"]: headers["x-mistral-key"] = API_KEYS["mistral"]
    if API_KEYS["lingodev"]: headers["x-lingodev-key"] = API_KEYS["lingodev"]
    if API_KEYS["firecrawl"]: headers["x-firecrawl-key"] = API_KEYS["firecrawl"]
    if API_KEYS["groq"]: headers["x-groq-key"] = API_KEYS["groq"]
    
    return headers
