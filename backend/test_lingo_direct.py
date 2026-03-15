import os
from dotenv import load_dotenv
from rag_pipeline import translate_text_lingo
import time

load_dotenv()

def test_lingo_direct():
    text = "これはテストです。" # "This is a test."
    print(f"Testing Lingo.dev directly with text: {text}")
    print(f"API Key present: {bool(os.getenv('LINGODEV_API_KEY'))}")
    
    start = time.time()
    # Call the actual function from rag_pipeline which now has logging and retries
    translated, src, is_trans = translate_text_lingo(text)
    end = time.time()
    
    print("\n--- RESULTS ---")
    print(f"Original: {text}")
    print(f"Translated: {translated}")
    print(f"Source Lang: {src}")
    print(f"Is Translated: {is_trans}")
    print(f"Time Taken: {end - start:.2f}s")

if __name__ == "__main__":
    test_lingo_direct()
