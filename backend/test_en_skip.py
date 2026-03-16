import os
from rag_pipeline import translate_text_lingo
import time

def test_english_skip():
    text = "What is GitHub terms of service?"
    print(f"Testing English Skip with: '{text}'")
    
    start = time.time()
    translated, src, is_trans = translate_text_lingo(text, target_lang="en")
    end = time.time()
    
    print("\n--- RESULTS ---")
    print(f"Original: {text}")
    print(f"Translated: {translated}")
    print(f"Source Lang: {src}")
    print(f"Is Translated: {is_trans}")
    print(f"Time Taken: {end - start:.4f}s")
    
    if (end - start) < 0.1 and not is_trans:
        print("\n✅ SUCCESS: Local English check skipped the API call instantly!")
    else:
        print("\n❌ FAILURE: API call was not skipped or was too slow.")

if __name__ == "__main__":
    test_english_skip()
