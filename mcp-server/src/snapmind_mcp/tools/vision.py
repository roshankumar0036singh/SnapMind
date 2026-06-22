"""
SnapMind MCP Tools — Vision
Wraps POST /api/v1/vision/analyze-image
"""
from mcp.types import TextContent
from snapmind_mcp.config import BACKEND_URL, API_PREFIX, get_headers, get_client
import base64
import os

async def handle_analyze_image(arguments: dict) -> list[TextContent]:
    """Analyze an image (QA or OCR) via Vision model."""
    image_path = arguments.get("image_path")
    prompt = arguments.get("prompt", "Describe this image.")
    mode = arguments.get("mode", "qa")
    target_lang = arguments.get("target_lang", "English")

    if not os.path.exists(image_path):
        return [TextContent(type="text", text=f"Error: File '{image_path}' not found.")]

    try:
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')
    except Exception as e:
         return [TextContent(type="text", text=f"Error reading image: {str(e)}")]

    async with get_client(timeout=60.0) as client:
        response = await client.post(
            f"{BACKEND_URL}{API_PREFIX}/vision/analyze-image",
            json={
                "image_data": image_data,
                "prompt": prompt,
                "mode": mode,
                "target_lang": target_lang,
                "active_context": ""
            },
            headers=get_headers()
        )
        data = response.json()

    if not data.get("success", False):
        return [TextContent(type="text", text=f"Vision analysis failed: {data.get('error', data.get('detail', 'Unknown error'))}")]

    return [TextContent(type="text", text=f"Vision Analysis ({mode}):\n\n{data.get('answer')}")]

from mcp.types import ImageContent
import io

async def handle_see_screen(arguments: dict) -> list:
    """Takes a local screenshot and returns it to the LLM to 'see' the user's screen."""
    try:
        from PIL import ImageGrab
        
        # Grab screen
        img = ImageGrab.grab()
        
        # Convert to RGB if necessary (ImageGrab sometimes gives RGBA)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
        # Resize to reasonable dimensions for Claude to process quickly (max ~1600px width)
        max_size = (1600, 1600)
        img.thumbnail(max_size)
        
        # Save to memory buffer as PNG
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        
        # Encode to base64
        b64_data = base64.b64encode(buffer.read()).decode('utf-8')
        
        return [
            TextContent(type="text", text="Here is a screenshot of my current desktop/screen:"),
            ImageContent(type="image", data=b64_data, mimeType="image/png")
        ]
    except ImportError:
        return [TextContent(type="text", text="Error: Pillow library is not installed. Run `pip install Pillow` to enable screen capture.")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error capturing screen: {str(e)}")]
