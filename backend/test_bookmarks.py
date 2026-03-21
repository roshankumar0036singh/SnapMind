import os
from database import get_db_pool
from rag_pipeline import embed_single_chunk
from dotenv import load_dotenv

load_dotenv()

def debug_bookmarks(query):
    pool = get_db_pool()
    _, embedding = embed_single_chunk(query)
    
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT content, (embedding <=> %s::halfvec) as distance FROM bookmarks ORDER BY distance ASC LIMIT 5",
                (embedding,)
            )
            rows = cur.fetchall()
            print(f"\nQuery: {query}")
            for content, dist in rows:
                print(f"Distance: {dist:.4f} | Content: {content[:100]}...")

if __name__ == "__main__":
    debug_bookmarks("How to Generate a PDF")
    debug_bookmarks("Neuro-symbolic AI")
