import os
import base64
import requests
from dotenv import load_dotenv
from huggingface_hub import InferenceClient
import traceback

load_dotenv()

def get_hf_token():
    return os.getenv("HF_TOKEN")

def get_groq_key():
    return os.getenv("GROQ_API_KEY")

def test_hf():
    print("\n--- Testing Hugging Face ---")
    hf_token = get_hf_token()
    if not hf_token:
        print("HF_TOKEN not found in .env")
        return
    
    # 1x1 white pixel
    image_bytes = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==")
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    data_url = f"data:image/png;base64,{base64_image}"
    
    hf_model = "meta-llama/Llama-3.2-11B-Vision-Instruct"
    print(f"Attempting HF model: {hf_model}")
    
    try:
        client = InferenceClient(api_key=hf_token)
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What is in this image?"},
                    {"type": "image_url", "image_url": {"url": data_url}}
                ]
            }
        ]
        
        completion = client.chat.completions.create(
            model=hf_model,
            messages=messages,
            max_tokens=100
        )
        print("HF Success!")
        print(f"Response: {completion.choices[0].message.content}")
    except Exception as e:
        print(f"HF Error Type: {type(e).__name__}")
        print(f"HF Error String: '{str(e)}'")
        print(f"HF Error Representation: '{repr(e)}'")
        traceback.print_exc()

def test_groq():
    print("\n--- Testing Groq ---")
    groq_key = get_groq_key()
    if not groq_key:
        print("GROQ_API_KEY not found in .env")
        return
    
    # 1x1 white pixel
    image_bytes = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==")
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    data_url = f"data:image/png;base64,{base64_image}"
    
    # Testing both potential models
    models_to_test = [
        "meta-llama/llama-4-scout-17b-16e-instruct", # The one in vision.py
        "llama-3.2-11b-vision-preview", # Standard vision model
        "llama-3.2-90b-vision-preview"  # Standard vision model
    ]
    
    for groq_model in models_to_test:
        print(f"\nAttempting Groq model: {groq_model}")
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
                            {"type": "text", "text": "What is in this image?"},
                            {"type": "image_url", "image_url": {"url": data_url}}
                        ]
                    }
                ],
                "max_tokens": 100
            }
            res = requests.post(url, headers=headers, json=payload, timeout=30)
            print(f"Status Code: {res.status_code}")
            if res.status_code == 200:
                print("Groq Success!")
                print(f"Response: {res.json()['choices'][0]['message']['content']}")
            else:
                print(f"Groq Error Body: {res.text}")
        except Exception as e:
            print(f"Groq Exception: {str(e)}")

if __name__ == "__main__":
    test_hf()
    test_groq()
