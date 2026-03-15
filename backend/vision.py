import os
import base64
from dotenv import load_dotenv

load_dotenv()

from api_clients import get_mistral_client, get_gemini_client

def analyze_image_logic(image_bytes: bytes, user_prompt: str = None, mode: str = "qa", api_keys: dict = None) -> dict:
    """
    Analyzes an image using Vision models (Gemini by default, Mistral as fallback).
    
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

    # --- 1. Try Gemini Models ---
    # We try 2.0-flash first (as requested), then 1.5-flash as fallback 
    # to handle different project quota assignments.
    gemini_models_to_try = ["gemini-2.0-flash-lite"]
    
    try:
        gemini_client = get_gemini_client(api_keys)
        if gemini_client:
            for g_model in gemini_models_to_try:
                try:
                    print(f"[VISION] Attempting {g_model}...")
                    from google.genai import types
                    
                    response = gemini_client.models.generate_content(
                        model=g_model,
                        contents=[
                            user_message_text,
                            types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
                        ]
                    )
                    
                    if response.text:
                        print(f"[VISION] Success with {g_model}")
                        return {
                            "answer": response.text,
                            "success": True,
                            "model_used": g_model
                        }
                except Exception as sub_e:
                    print(f"[VISION] {g_model} failed: {str(sub_e)[:100]}...")
                    # Continue to next Gemini model
                    continue
    except Exception as e:
        print(f"[VISION] Gemini client error: {e}")

    # --- 2. Fallback to Mistral (Pixtral) ---
    print("[VISION] Falling back to Mistral...")
    client = get_mistral_client(api_keys)
    if not client:
        return {
            "success": False,
            "answer": "Vision models failed to initialize or hit quota. Check API keys and Google Cloud Quota (limit 0 usually means API not enabled).",
            "model_used": "none"
        }

    from mistralai.models import TextChunk, ImageURLChunk

    # Encode image to base64 data URL
    try:
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        data_url = f"data:image/jpeg;base64,{base64_image}"
    except Exception as e:
        return {
            "success": False,
            "answer": f"Error encoding image: {str(e)}",
            "model_used": "none"
        }
    
    model_name = "pixtral-12b-2409" 

    try:
        # Use explicit SDK chunk classes to prevent tagging/discriminator errors
        content = [
            TextChunk(text=user_message_text),
            ImageURLChunk(image_url=data_url)
        ]
        
        chat_response = client.chat.complete(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": content
                }
            ]
        )
        
        answer = chat_response.choices[0].message.content
        
        return {
            "answer": answer,
            "success": True,
            "model_used": model_name
        }

    except Exception as e:
        error_msg = str(e)
        # Log error
        with open("vision_error.log", "a", encoding="utf-8") as f:
            f.write(f"\n[Error] Mistral Vision ({model_name}): {error_msg}\n")
        print(f"Mistral Vision Error ({model_name}): {error_msg}")
        
        return {
            "success": False,
            "answer": f"Error analyzing image: {error_msg}",
            "model_used": model_name
        }
