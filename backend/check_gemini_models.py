import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

def check_models():
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ No API key found in .env")
        return

    print(f"Using API Key: {api_key[:10]}...{api_key[-5:]}")
    
    try:
        client = genai.Client(api_key=api_key.strip())
        print("--- Available Models ---")
        models = client.models.list()
        for m in models:
            # The attribute is 'supported_generation_methods' in some versions, 
            # let's just print name and check methods if they exist
            methods = getattr(m, 'supported_generation_methods', [])
            print(f"Model ID: {m.name} | Methods: {methods}")
        
        print("\n--- Testing Specific Models ---")
        test_models = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite-001", "gemini-1.5-flash"]
        for model_id in test_models:
            try:
                print(f"Testing {model_id}...", end=" ", flush=True)
                # Using a very simple prompt to minimize token usage
                res = client.models.generate_content(model=model_id, contents="hi")
                print(f"✅ OK. Response: {res.text}")
            except Exception as e:
                import json
                error_str = str(e)
                print(f"❌ Failed: {error_str}")
                # Try to extract more if it's a 429
                if "429" in error_str:
                    print("   [INFO] This is a Rate Limit error. Check your Google AI Studio quota.")
                
    except Exception as e:
        print(f"❌ Error listing models: {e}")

if __name__ == "__main__":
    check_models()
