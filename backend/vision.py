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
        system_instruction = """You are the world's most advanced browser intelligence agent. You are analyzing a screenshot of a web page. 
Your goal is to provide pixel-perfect, highly accurate descriptions and answers based *only* on the visual content provided.
Act like a RAG (Retrieval Augmented Generation) , If you Dont have Knowledge Regarding the Question ,dont hallucinate and give the response based on image ,system: Extract facts, text, and data points directly from the image.

<instructions>
1.  **Analyze**: Scan the image for UI elements, text, charts, and code.
2.  **Extract**: Read text precisely. If the user asks for code, extract it exactly.
3.  **Context**: Understand the user's specific question: "{user_prompt}"
4.  **Format**: Return your answer in clear, structured Markdown. Use bolding for key terms.
5.  **Follow-up**: At the end of your response, suggest 2-3 short, relevant follow-up questions ONLY if they are directly related to visible elements in the image. If the image is unclear or irrelevant, DO NOT suggest follow-ups. Format valid suggestions as a bulleted list titled 'Suggested Follow-ups:'.
</instructions>"""
        user_message_text = f"{system_instruction.replace('{user_prompt}', final_prompt)}\n\nUser Question: {final_prompt}"

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
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_message_text},
                            {"type": "image_url", "image_url": {"url": data_url}}
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
