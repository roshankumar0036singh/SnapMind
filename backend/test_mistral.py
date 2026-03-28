
import os
from mistralai import Mistral
from dotenv import load_dotenv

load_dotenv()

def test_mistral_key():
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        print("MISTRAL_API_KEY not found in .env")
        return

    print(f"Testing key: {api_key[:5]}...{api_key[-5:]}")
    client = Mistral(api_key=api_key.strip())
    
    try:
        chat_response = client.chat.complete(
            model="mistral-small-latest",
            messages=[
                {"role": "user", "content": "Say hello"},
            ],
        )
        print("Success!")
        print(chat_response.choices[0].message.content)
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_mistral_key()
