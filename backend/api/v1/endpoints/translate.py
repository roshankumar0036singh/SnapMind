from fastapi import APIRouter, Request
from schemas import TranslateRequest

router = APIRouter()

@router.post("")
async def translate_endpoint(request: TranslateRequest, req: Request):
    """
    Translates text using the backend Lingo.dev proxy with Mistral fallback.
    """
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key")
    }
    from services.llm_service import LLMService
    llm_svc = LLMService(api_keys=api_keys)
    translated_text, original_lang, is_translated = await llm_svc.translate(
        request.text, 
        request.target_lang
    )
    return {
        "translatedText": translated_text,
        "originalLang": original_lang,
        "isTranslated": is_translated
    }
