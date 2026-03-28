import os
import psycopg
from dotenv import load_dotenv
from hybrid_search import HybridSearcher
from database import get_db_pool

load_dotenv()
db_pool = get_db_pool()

def check_search_results():
    query = "what is snapmind"
    site_id = "https://bachat-buddy-nu.vercel.app"
    
    searcher = HybridSearcher(db_pool)
    print(f"--- Searching for '{query}' on site '{site_id}' ---")
    
    matches = searcher.search(
        query=query,
        site_id=site_id,
        top_k=5,
        mode="hybrid"
    )
    
    print(f"Found {len(matches)} matches.")
    for i, m in enumerate(matches):
        print(f"\nMatch {i+1} (Score: {m.get('score', 0):.4f}, Vector: {m.get('vector_score', 0):.4f}):")
        print(f"Source: {m.get('source_url')}")
        print(f"Content: {m.get('content')[:200]}...")

if __name__ == "__main__":
    check_search_results()
