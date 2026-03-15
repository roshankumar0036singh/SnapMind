import os
from rag_pipeline import ingest_text_logic
import json

def test_foreign_file_ingest():
    # Japanese text: "This is a test document about Japanese history."
    foreign_text = "これは日本の歴史についてのテスト文書です。富士山はとても有名です。"
    fake_url = "file://test_japanese_doc.txt"
    
    # Mock API keys if needed, or rely on .env
    api_keys = {} 
    
    print(f"--- Starting Foreign Ingestion Test ---")
    print(f"Text: {foreign_text}")
    
    result = ingest_text_logic(fake_url, foreign_text, api_keys)
    
    print(f"\n--- Result ---")
    print(json.dumps(result, indent=2))
    
    if result.get("success"):
        print("\n✅ Ingestion Successful!")
        # Check if translation occurred (this depends on your .env/keys being active)
        # Note: If translated, the 'original_lang' in chunks should be 'ja' (or 'jp')
    else:
        print(f"\n❌ Ingestion Failed: {result.get('error') or result.get('message')}")

if __name__ == "__main__":
    test_foreign_file_ingest()
