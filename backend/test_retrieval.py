
import psycopg
import os
from dotenv import load_dotenv
from hybrid_search import create_hybrid_searcher
from config import SearchConfig

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def test_retrieval():
    query = "summarize the poitns"
    print(f"Testing retrieval for query: '{query}'")
    
    try:
        from database import get_db_pool
        pool = get_db_pool()
        searcher = create_hybrid_searcher(pool)
        
        # Test 1: Global Search
        print("\n--- Test 1: Global Search (site_id=None) ---")
        matches = searcher.search(query=query, site_id=None, top_k=10, mode="hybrid")
        print(f"Found {len(matches)} matches")
        for i, m in enumerate(matches):
            print(f"[{i+1}] Score: {m.get('combined_score', m.get('score', 0)):.4f}, URL: {m.get('source_url')}")
            # print(f"    Content: {m.get('content')[:100]}...")
            
        # Test 2: Site-Specific Search (Github Repo)
        repo_url = "https://github.com/roshankumar0036singh/SHEETX"
        print(f"\n--- Test 2: Site-Specific Search (site_id={repo_url}) ---")
        matches = searcher.search(query=query, site_id=repo_url, top_k=10, mode="hybrid")
        print(f"Found {len(matches)} matches")
        for i, m in enumerate(matches):
            print(f"[{i+1}] Score: {m.get('combined_score', m.get('score', 0)):.4f}, URL: {m.get('source_url')}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_retrieval()
