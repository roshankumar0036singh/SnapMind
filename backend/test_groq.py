import os
import requests
from dotenv import load_dotenv

load_dotenv()
groq_key = os.getenv("GROQ_API_KEY")
print("KEY:", bool(groq_key))

res = requests.post(
    "https://api.groq.com/openai/v1/chat/completions",
    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
    json={
        "model": "llama-3.2-90b-vision-preview",
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    }
)
print(res.status_code, res.text)
