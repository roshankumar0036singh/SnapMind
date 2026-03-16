import os
import requests
from dotenv import load_dotenv

load_dotenv()

def list_groq_models():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("GROQ_API_KEY not found")
        return

    url = "https://api.groq.com/openai/v1/models"
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    try:
        res = requests.get(url, headers=headers)
        if res.status_code == 200:
            models = res.json().get("data", [])
            print("Available Groq Models:")
            for model in models:
                mid = model.get("id")
                if "vision" in mid.lower():
                    print(f"- {mid} (VISION)")
                else:
                    print(f"- {mid}")
        else:
            print(f"Error listing models ({res.status_code}): {res.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    list_groq_models()
