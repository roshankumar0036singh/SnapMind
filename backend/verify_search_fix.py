import os
import sys
from dotenv import load_dotenv
from hybrid_search import HybridSearcher
from database import get_db_pool
from search import get_relevant_context

load_dotenv()
db_pool = get_db_pool()

def verify_fix():
    print("=== Phase 1: Dimension Fix Verification ===")
    searcher = HybridSearcher(db_pool)
    query = "What is BachatBuddy?"
    site_id = "https://bachat-buddy-nu.vercel.app"
    
    print(f"Searching for '{query}' on site '{site_id}'...")
    matches = searcher.search(query=query, site_id=site_id, top_k=5, mode="hybrid")
    
    if matches:
        top_score = matches[0].get('combined_score', 0)
        print(f"✅ Found {len(matches)} matches. Top Combined Score: {top_score:.4f}")
        for i, m in enumerate(matches[:2]):
             print(f"   Match {i+1}: {m.get('content')[:100]}...")
        if top_score > 0.5:
            print("✨ SUCCESS: Dimension fix improved relevance scores!")
        else:
            print("⚠️ WARNING: Relevance scores still lower than expected.")
    else:
        print("❌ FAILED: No matches found at all.")

    print("\n=== Phase 2: Relevance-Based Global Fallback Verification ===")
    # Search for something NOT on the site
    query_global = "What is SnapMind?"
    print(f"Searching for '{query_global}' on site '{site_id}'...")
    
    # We use get_relevant_context here as it has the fallback logic
    context, chunks = get_relevant_context(query_global, site_id=site_id)
    
    if "SnapMind" in context or any("snapmind" in c.get('content', '').lower() for c in chunks):
        print(f"✅ SUCCESS: Global fallback triggered and found SnapMind info!")
        if chunks:
             print(f"   Source of top chunk: {chunks[0].get('source_url')}")
    else:
        print("❌ FAILED: Global fallback didn't find SnapMind info.")

    print("\n=== Phase 3: Empty Embedding Robustness ===")
    # Monkeypatch _embed_query to return None
    original_embed = searcher._embed_query
    searcher._embed_query = lambda x: None
    
    try:
        print("Testing search with simulated embedding failure...")
        matches = searcher.search(query="test", site_id=None, mode="hybrid")
        print(f"✅ SUCCESS: No crash! Found {len(matches)} matches via keyword-only fallback.")
    except Exception as e:
        print(f"❌ FAILED: Search crashed on empty embedding: {e}")
    finally:
        searcher._embed_query = original_embed

if __name__ == "__main__":
    verify_fix()
