import os
import base64
import json
from dotenv import load_dotenv
from mistralai import Mistral
from mistralai.models import TextChunk, ImageURLChunk

load_dotenv()

def repro():
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        print("MISTRAL_API_KEY not found")
        return

    client = Mistral(api_key=api_key)
    
    # Tiny 1x1 black pixel png
    image_bytes = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    data_url = f"data:image/png;base64,{base64_image}"
    
    user_message_text = "What is in this image?"
    model_name = "pixtral-12b-2409"

    print(f"--- Testing with explicit SDK chunks ---")
    try:
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
        print("Success with chunks!")
    except Exception as e:
        print(f"Error with chunks type: {type(e)}")
        print(f"Error with chunks: {e}")

    print(f"\n--- Testing with dictionaries (OpenAI style) ---")
    try:
        content = [
            {"type": "text", "text": user_message_text},
            {"type": "image_url", "image_url": data_url}
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
        print("Success with dictionaries!")
    except Exception as e:
        print(f"Error with dictionaries type: {type(e)}")
        print(f"Error with dictionaries: {e}")

    print(f"\n--- Testing with Mistral style dictionaries ---")
    # Some Mistral SDK versions expect a different format
    try:
        content = [
            {"type": "text", "text": user_message_text},
            {"type": "image_url", "image_url": {"url": data_url}}
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
        print("Success with Mistral style dictionaries!")
    except Exception as e:
        print(f"Error with Mistral style dictionaries type: {type(e)}")
        print(f"Error with Mistral style dictionaries: {e}")

if __name__ == "__main__":
    repro()
