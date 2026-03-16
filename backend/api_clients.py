import os
from google import genai

try:
    # Attempt 1: Standard v1.0.0+ SDK (Modern)
    from mistralai import Mistral
    print("[OK] Successfully imported Mistral from mistralai (Root)")
except ImportError:
    try:
        # Attempt 2: Mistral v2.x or specific builds often put it here
        from mistralai.client import Mistral
        print("[OK] Successfully imported Mistral from mistralai.client")
    except ImportError:
        try:
            # Attempt 3: Legacy SDK (pre-v1) used MistralClient
            from mistralai.client import MistralClient as Mistral
            print("[OK] Successfully imported MistralClient as Mistral from mistralai.client")
        except ImportError:
            print("[ERROR] Error: Could not find Mistral or MistralClient classes in mistralai package")
            Mistral = None
except Exception as e:
    print(f"[ERROR] Unexpected Error importing mistralai: {e}")
    Mistral = None

def get_gemini_client(api_keys=None):
    api_keys = api_keys or {}
    key = api_keys.get("gemini")
    if not key:
        key = os.getenv("GOOGLE_API_KEY")
    if not key:
        raise ValueError("Missing GOOGLE_API_KEY")
    return genai.Client(api_key=key.strip())

def get_mistral_client(api_keys=None):
    api_keys = api_keys or {}
    key = api_keys.get("mistral")
    if not key:
        key = os.getenv("MISTRAL_API_KEY")
    if not key:
        return None
    return Mistral(api_key=key.strip())

def get_firecrawl_key(api_keys=None):
    api_keys = api_keys or {}
    key = api_keys.get("firecrawl")
    if not key:
        key = os.getenv("FIRECRAWL_API_KEY")
    return key.strip() if key else key

def get_lingo_key(api_keys=None):
    api_keys = api_keys or {}
    key = api_keys.get("lingodev")
    if not key:
        key = os.getenv("LINGODEV_API_KEY")
    return key.strip() if key else key

def get_groq_key(api_keys=None):
    api_keys = api_keys or {}
    key = api_keys.get("groq") or api_keys.get("x-groq-key")
    if not key:
        key = os.getenv("GROQ_API_KEY")
    return key.strip() if key else key

def get_hf_token(api_keys=None):
    api_keys = api_keys or {}
    key = api_keys.get("hf") or api_keys.get("x-hf-token")
    if not key:
        key = os.getenv("HF_TOKEN")
    return key.strip() if key else key
