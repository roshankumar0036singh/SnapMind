import os
from dotenv import load_dotenv
from rag_pipeline import translate_text_lingo
import time

load_dotenv()

def test_fallback():
    # We use a text that would normally be translated by Lingo.dev
    text = "Guten Morgen, wie geht es dir?" # German: "Good morning, how are you?"
    print(f"Testing Mistral Fallback with text: {text}")
    
    start = time.time()
    translated, src, is_trans = translate_text_lingo(text)
    end = time.time()
    
    print("\n--- RESULTS ---")
    print(f"Original: {text}")
    print(f"Translated: {translated}")
    print(f"Source Lang: {src}")
    print(f"Is Translated: {is_trans}")
    print(f"Time Taken: {end - start:.2f}s")

if __name__ == "__main__":
    test_fallback()
