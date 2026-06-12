"""
SnapMind MCP Tools — Translate
Wraps POST /api/v1/translate
"""
from mcp.types import TextContent
from snapmind_mcp.config import BACKEND_URL, API_PREFIX, get_headers, get_client

async def handle_translate(arguments: dict) -> list[TextContent]:
    """Translates text between languages."""
    text = arguments.get("text")
    target_lang = arguments.get("target_lang", "English")

    async with get_client(timeout=30.0) as client:
        response = await client.post(
            f"{BACKEND_URL}{API_PREFIX}/translate",
            json={
                "text": text,
                "target_lang": target_lang
            },
            headers=get_headers()
        )
        data = response.json()

    if "error" in data or "detail" in data:
        return [TextContent(type="text", text=f"Translation failed: {data.get('error', data.get('detail', 'Unknown error'))}")]

    translated = data.get("translatedText", "")
    original_lang = data.get("originalLang", "Unknown")
    
    return [TextContent(type="text", text=f"Translated from {original_lang} to {target_lang}:\n\n{translated}")]
