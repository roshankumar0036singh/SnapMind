
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

def test_gemini_key():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("GOOGLE_API_KEY not found in .env")
        return

    print(f"Testing key: {api_key[:5]}...{api_key[-5:]}")
    client = genai.Client(api_key=api_key.strip())
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Say hello",
        )
        print("Success!")
        print(response.text)
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_gemini_key()
