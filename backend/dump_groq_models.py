import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

def list_groq_models_detailed():
    api_key = os.getenv("GROQ_API_KEY")
    url = "https://api.groq.com/openai/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        with open("backend/groq_models_dump.json", "w") as f:
            json.dump(res.json(), f, indent=2)
        print("Detailed model list dumped to backend/groq_models_dump.json")
    else:
        print(f"Error: {res.status_code} - {res.text}")

if __name__ == "__main__":
    list_groq_models_detailed()
