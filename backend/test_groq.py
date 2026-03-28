
import os
import requests
from dotenv import load_dotenv

load_dotenv()

def test_groq_key():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("GROQ_API_KEY not found in .env")
        return

    print(f"Testing key: {api_key[:5]}...{api_key[-5:]}")
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "llama3-8b-8192",
        "messages": [{"role": "user", "content": "Say hello"}]
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            print("Success!")
            print(response.json()['choices'][0]['message']['content'])
        else:
            print(f"Failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_groq_key()
