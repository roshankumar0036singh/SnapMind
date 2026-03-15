import asyncio
import os
from dotenv import load_dotenv
from lingodotdev import LingoDotDevEngine

load_dotenv()

async def debug_lingo_sdk():
    api_key = os.getenv("LINGODEV_API_KEY")
    print(f"Using API Key: {api_key[:5]}...{api_key[-5:]}")
    
    async with LingoDotDevEngine({"api_key": api_key}) as engine:
        print("Checking identity...")
        try:
            me = await engine.whoami()
            print(f"WhoAmI: {me}")
        except Exception as e:
            print(f"WhoAmI failed: {e}")

        print("Testing language detection...")
        try:
            locale = await engine.recognize_locale("Guten Morgen")
            print(f"Detected: {locale}")
        except Exception as e:
            print(f"Detection failed: {e}")

        print("Testing translation...")
        try:
            translated = await engine.localize_text("Hello world", {"target_locale": "es"})
            print(f"Translated: {translated}")
        except Exception as e:
            print(f"Translation failed: {e}")

if __name__ == "__main__":
    asyncio.run(debug_lingo_sdk())
