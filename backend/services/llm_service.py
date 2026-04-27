import json
import re
from typing import List, Dict, Any, Tuple
from config import settings
from llm_router import LLMRouter
from api_clients import get_lingo_key, check_connectivity
import httpx
import uuid

class LLMService:
    """
    Service for high-level LLM operations like translation and semantic tagging.
    """
    
    ENGLISH_WORDS_PATTERN = re.compile(
        r'\b(?:the|and|with|from|this|that|have|for|not|you|was|but|are|indexing|content|repo|github|agreement|protection|policy|privacy|data)\b',
        re.IGNORECASE
    )

    def __init__(self, api_keys: dict = None):
        self.router = LLMRouter(api_keys=api_keys)
        self.api_keys = api_keys

    async def translate(self, text: str, target_lang: str = "en") -> tuple[str, str, bool]:
        """Translates text. Default uses Lingo.dev, tracking back to mistral."""
        return await self.translate_lingo(text, target_lang)

    async def translate_lingo(self, text: str, target_lang: str = "en") -> tuple[str, str, bool]:
        """Translates text using Lingo.dev or falls back to Mistral."""
        if not check_connectivity():
            return text, "unknown", False

        lingo_key = get_lingo_key(self.api_keys)
        if not lingo_key or not text or not text.strip():
            return await self.translate_mistral(text, target_lang) if text else (text or "", "unknown", False)

        try:
            request_data = {
                "params": {"workflowId": str(uuid.uuid4()), "fast": True},
                "locale": {"target": target_lang},
                "data": {"text": text},
            }
            
            async with httpx.AsyncClient(http2=False, timeout=90.0) as client:
                resp = await client.post(
                    "https://engine.lingo.dev/i18n",
                    headers={"Authorization": f"Bearer {lingo_key}", "Content-Type": "application/json"},
                    json=request_data
                )
            
            if resp.status_code == 200:
                json_resp = resp.json()
                data = json_resp.get("data", {})
                metrics = json_resp.get("metrics", {})
                detected = metrics.get("sourceLocale", "unknown")
                translated = data.get("text", text)
                return translated, detected, (translated != text)
            
            return await self.translate_mistral(text, target_lang)
        except Exception:
            return await self.translate_mistral(text, target_lang)

    async def translate_mistral(self, text: str, target_lang: str = "en") -> tuple[str, str, bool]:
        """Fallback translation using Mistral."""
        try:
            prompt = (
                f"Detect the language of the following text and translate it to {target_lang}.\n"
                f"Output ONLY a valid JSON object with 'detected_lang' (ISO code) and 'translated_text'.\n\n"
                f"Text: {text}"
            )
            content = await self.router.chat_async(
                prompt=prompt,
                model_id=settings.models.mistral_small,
                response_format="json_object"
            )
            res = json.loads(content)
            src_lang = res.get("detected_lang", "unknown")
            translated = res.get("translated_text", text)
            return translated, src_lang, (src_lang != target_lang and translated != text)
        except Exception:
            return text, "unknown", False

    async def extract_tags(self, text: str) -> List[str]:
        """Extract semantic tags from text."""
        try:
            if not text: return []
            content = await self.router.chat_async(
                prompt=text[:3000],
                system_instruction="Extract 2-5 technical tags (e.g. 'React', 'Python'). Output strictly JSON: {\"tags\": [\"tag1\", \"tag2\"]}.",
                model_id=settings.models.mistral_small,
                response_format="json_object"
            )
            data = json.loads(content)
            return data.get("tags", [])[:5] if isinstance(data, dict) else []
        except Exception:
            return []
