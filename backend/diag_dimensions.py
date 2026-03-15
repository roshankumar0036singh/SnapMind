import os
from dotenv import load_dotenv
from database import get_db_pool
import json

load_dotenv()

def check_dimensions():
    print("--- Diagnostic: Checking Embedding Dimensions ---")
    
    # 1. Check Model Dimensions
    from rag_pipeline import embed_single_chunk
    try:
        _, embedding = embed_single_chunk("Test content")
        print(f"Model embedding dimension: {len(embedding)}")
    except Exception as e:
        print(f"Error getting embedding: {e}")

    # 2. Check Database Schema
    pool = get_db_pool()
    if not pool:
        print("Database pool not initialized.")
        return

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # Check bookmarks table
                cur.execute("""
                    SELECT column_name, udt_name, character_maximum_length 
                    FROM information_schema.columns 
                    WHERE table_name = 'bookmarks' AND column_name = 'embedding'
                """)
                row = cur.fetchone()
                if row:
                    print(f"bookmarks.embedding: {row}")
                else:
                    print("bookmarks.embedding column not found!")

                # Check documents table
                cur.execute("""
                    SELECT column_name, udt_name, character_maximum_length 
                    FROM information_schema.columns 
                    WHERE table_name = 'documents' AND column_name = 'embedding'
                """)
                row = cur.fetchone()
                if row:
                    print(f"documents.embedding: {row}")
                else:
                    print("documents.embedding column not found!")
                    
                # Check pgvector dimension directly (if possible)
                cur.execute("SELECT atttypmod FROM pg_attribute WHERE attrelid = 'bookmarks'::regclass AND attname = 'embedding'")
                row = cur.fetchone()
                if row:
                    print(f"bookmarks.embedding atttypmod: {row[0]}")
                
    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    check_dimensions()
