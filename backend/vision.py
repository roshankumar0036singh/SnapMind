import os
import base64
import requests
import hashlib
import json
from pathlib import Path
from dotenv import load_dotenv
from api_clients import get_groq_key, get_hf_token, get_gemini_client, get_openai_client
from config import settings

# --- Vision Cache Configuration ---
CACHE_DIR = Path("data/vision_cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def get_image_hash(image_bytes: bytes) -> str:
    return hashlib.md5(image_bytes).hexdigest()

def get_cached_result(img_hash: str, mode: str, prompt: str) -> dict:
    # Hash the prompt too to ensure different questions for the same image get new answers
    prompt_hash = hashlib.md5(prompt.encode()).hexdigest()
    cache_file = CACHE_DIR / f"{img_hash}_{mode}_{prompt_hash}.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text())
        except:
            return None
    return None

def save_to_cache(img_hash: str, mode: str, prompt: str, result: dict):
    prompt_hash = hashlib.md5(prompt.encode()).hexdigest()
    cache_file = CACHE_DIR / f"{img_hash}_{mode}_{prompt_hash}.json"
    cache_file.write_text(json.dumps(result))

def analyze_image_logic(image_bytes: bytes, user_prompt: str = None, mode: str = "qa", api_keys: dict = None, target_lang: str = "auto", active_context: dict = None) -> dict:
    """
    Analyzes an image using high-performance Vision models.
    Priority: Gemini 2.0 Flash -> GPT-4o -> Groq (Llama Scout)
    """
    
    # 0. Context Awareness
    context_hint = ""
    if active_context:
        ctx_type = active_context.get("type", "")
        ctx_name = active_context.get("name", "")
        if ctx_type == "file":
            context_hint = f" This is a direct file/document ({ctx_name}). "
        elif ctx_type == "url":
            context_hint = f" This is a screenshot of a web page ({ctx_name}). "
    
    final_prompt = user_prompt or "Describe this image in detail."
    
    # Generate system and user messages
    if mode == "extraction":
        system_instruction = "You are a high-precision OCR engine. Transcribe ALL visible text into structured Markdown. No chat/filler."
        user_message_text = "Extract all text from this image exactly."
    else:
        if user_prompt and len(user_prompt.strip()) > 0:
            system_instruction = f"You are a helpful AI assistant analyzing an image. Answer the user's question directly and concisely based ONLY on the visual evidence.{context_hint}"
            user_message_text = user_prompt
        else:
            system_instruction = f"Provide a structured, detailed description of this visual content.{context_hint} List key sections and notable details."
            user_message_text = "Describe this content."

    # Check Cache
    img_hash = get_image_hash(image_bytes)
    cached = get_cached_result(img_hash, mode, final_prompt)
    if cached:
        print(f"[VISION] Cache Hit: {img_hash}")
        return cached

    # Detect MIME type
    mime_type = "image/jpeg"
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"): mime_type = "image/png"
    elif image_bytes.startswith(b"GIF"): mime_type = "image/gif"
    elif image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP": mime_type = "image/webp"

    # 1. Primary: Groq (Llama Scout) - User Preferred
    groq_key = get_groq_key(api_keys)
    if groq_key:
        print("[VISION] Attempting Groq (Primary Choice)...")
        try:
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "qwen/qwen3.6-27b",
                    "messages": [
                        {"role": "system", "content": system_instruction},
                        {
                            "role": "user",
                            "content": [
                                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}},
                                {"type": "text", "text": user_message_text}
                            ]
                        }
                    ]
                },
                timeout=20
            )
            if res.status_code == 200:
                answer = res.json()["choices"][0]["message"]["content"]
                result = {"answer": answer, "success": True, "model_used": "qwen3.6-27b"}
                save_to_cache(img_hash, mode, final_prompt, result)
                return result
            else:
                print(f"[VISION] Groq API returned {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[VISION] Groq error: {e}")

    # 2. Secondary: Gemini 2.0 Flash (Fallback)
    try:
        client = get_gemini_client(api_keys)
        print("[VISION] Attempting Gemini Flash (Fallback)...")
        from google.genai import types
        
        response = client.models.generate_content(
            model=settings.models.gemini_flash,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                types.Part.from_text(text=f"{system_instruction}\n\n{user_message_text}")
            ]
        )
        
        if response.text:
            result = {"answer": response.text, "success": True, "model_used": settings.models.gemini_flash}
            save_to_cache(img_hash, mode, final_prompt, result)
            return result
    except Exception as e:
        print(f"[VISION] Gemini error: {e}")

    # 3. Tertiary: GPT-4o (Fallback)
    try:
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        client = get_openai_client(api_keys)
        print("[VISION] Attempting GPT-4o Vision (Fallback)...")
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_instruction},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_message_text},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}}
                    ]
                }
            ],
            max_tokens=1024
        )
        
        if response.choices[0].message.content:
            result = {"answer": response.choices[0].message.content, "success": True, "model_used": "gpt-4o"}
            save_to_cache(img_hash, mode, final_prompt, result)
            return result
    except Exception as e:
        print(f"[VISION] GPT-4o error: {e}")

    return {
        "success": False,
        "answer": "All Vision models failing. Verify API keys and connection.",
        "error": "All models failed",
        "model_used": "none"
    }
