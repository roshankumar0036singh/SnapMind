import os
import base64
import requests
from dotenv import load_dotenv
from api_clients import get_groq_key, get_hf_token

load_dotenv()

def analyze_image_logic(image_bytes: bytes, user_prompt: str = None, mode: str = "qa", api_keys: dict = None, target_lang: str = "auto") -> dict:
    """
    Analyzes an image using Vision models (HF as primary, Groq as fallback).
    
    mode: "qa" (Default) or "extraction" (OCR-like)
    """
    
    final_prompt = user_prompt or "Describe this image in detail."
    if mode == "extraction":
        system_instruction = """You are a high-precision OCR and Layout Analysis engine. 
Your goal is to transcribe ALL visible text from the image into a structured Markdown format.
- Preserve headings (#), lists, and tables.
- Do NOT add commentary or conversational filler.
- Output ONLY the extracted text content.
"""
        user_message_text = f"{system_instruction}\n\nExtract all text from this screen."
    else:
        # QA Mode
        is_specific_query = user_prompt and user_prompt.strip() and "Describe the visual layout" not in user_prompt

        if is_specific_query:
            system_instruction = """You are a helpful and intelligent browser assistant.
Your EXCLUSIVE GOAL is to answer the user's specific question using the visual information provided.

<CRITICAL_RULES>
1. **CONVERSATIONAL TONE**: Answer the user directly like a human assistant. (e.g., "Based on the image, Roshan is a Full-Stack Developer...")
2. **NO STRUCTURED REPORTS**: Do NOT output "## Profile Overview", "Image Description", or use strict markdown document formatting. Write sentences.
3. **DIRECT ANSWER ONLY**: Immediately answer the user's explicit question. Explain ONLY what is relevant to their question and nothing else. Do not summarize the whole image.
4. **Be Precise**: Quote text from the image exactly when relevant.
5. **Contextual extraction**: If you see text related to the question, provide it. Do not refuse to answer if the context is a partial match.
6. **Follow-up**: At the very end, suggest two short follow-up questions. Format as a bullet list under '**Suggested Follow-ups:**', and make each question **bold** (e.g., * **What does...?**).
</CRITICAL_RULES>"""
            user_message_text = f"User's Question: \"{user_prompt}\"\n\nRemember: DO NOT write structured image reports. Focus EXCLUSIVELY on answering the specific question above directly and conversationally."
        else:
            system_instruction = """You are a highly intelligent browser assistant analyzing a screenshot of a web page.
Your GOAL is to provide a structured, helpful description of the image content.

<RULES>
1. **Focus on Content**: Describe the main content, data, or text visible in the image.
2. **Structured Format**: Use Markdown headers and lists to organize the description.
3. **Avoid Fluff**: Do not use generic openings like "This is a screenshot of". Dive straight into the useful details.
4. **Follow-up**: At the end, suggest 2-3 short follow-up questions about the image content. Format as a bulleted list titled '**Suggested Follow-ups:**' with each question in **bold**.
</RULES>"""
            user_message_text = "Please describe the core content and text visible in this image in detail."
    # Detect MIME type
    mime_type = "image/jpeg"  # Default
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        mime_type = "image/png"
    elif image_bytes.startswith(b"GIF87a") or image_bytes.startswith(b"GIF89a"):
        mime_type = "image/gif"
    elif image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP":
        mime_type = "image/webp"

    # Encode image to base64 data URL
    try:
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        data_url = f"data:{mime_type};base64,{base64_image}"
        print(f"[VISION] Detected MIME type: {mime_type}")
    except Exception as e:
        return {
            "success": False,
            "answer": f"Error encoding image: {str(e)}",
            "error": str(e),
            "model_used": "none"
        }

    # --- Primary: Groq (Llama 4 Scout Vision) ---
    groq_key = get_groq_key(api_keys)
    if groq_key:
        print("[VISION] Attempting Groq (Primary)...")
        # Llama 4 Scout as a preview multimodal model
        groq_model = "meta-llama/llama-4-scout-17b-16e-instruct"
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": groq_model,
                "messages": [
                    {
                        "role": "system",
                        "content": system_instruction
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": data_url}},
                            {"type": "text", "text": user_message_text}
                        ]
                    }
                ],
                "max_tokens": 1024
            }
            res = requests.post(url, headers=headers, json=payload, timeout=30)
            res_data = res.json()
            if res.status_code == 200:
                answer = res_data["choices"][0]["message"]["content"]
                print(f"[VISION] Success with {groq_model}")
                # [NEW] Post-process translation via Lingo.dev if target_lang is specified
                if target_lang and target_lang != "auto":
                    from rag_pipeline import translate_text_lingo
                    print(f"[VISION] Translating result to {target_lang}...")
                    translated_answer, _, _ = translate_text_lingo(answer, target_lang, api_keys)
                    answer = translated_answer

                return {
                    "answer": answer,
                    "success": True,
                    "model_used": groq_model
                }
            else:
                error_msg = res_data.get("error", {}).get("message", res.text)
                print(f"[VISION] Groq failed ({res.status_code}): {error_msg[:100]}")
        except Exception as e:
            print(f"[VISION] Groq error: {e}")

    return {
        "success": False,
        "answer": "All vision models failed (HF, Groq). Check availability and quotas.",
        "error": "All vision models failed",
        "model_used": "none"
    }
