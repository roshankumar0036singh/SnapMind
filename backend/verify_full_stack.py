import os
import asyncio
from dotenv import load_dotenv
from google import genai

# Force load .env from current directory
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

print("="*50)
print("DIAGNOSTIC TOOL")
print("="*50)

def test_embedding():
    print("\n[1] Testing Google Embedding API...")
    if not GOOGLE_API_KEY:
        print("❌ GOOGLE_API_KEY missing in .env")
        return False
        
    try:
        client = genai.Client(api_key=GOOGLE_API_KEY)
        text = "This is a test chunk."
        print(f"   Generating embedding for: '{text}'")
        
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=text,
        )
        
        embedding = result.embeddings[0].values
        
        if len(embedding) == 3072:
            print("✅ Embedding success! (Dimension 3072)")
            return True, embedding
        else:
            print(f"❌ Embedding dimension mismatch: {len(embedding)}")
            return False, None
            
    except Exception as e:
        print(f"❌ Embedding failed: {e}")
        return False, None

def test_database(mock_embedding):
    print("\n[2] Testing Database Connection & Insert...")
    from database import get_db_pool
    db_pool = get_db_pool()
    if not db_pool:
        print("❌ Database pool initialization failed")
        return
        
    try:
        # Test Query
        print("   Checking 'documents' table access...")
        try:
            with db_pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT id FROM documents LIMIT 1")
            print("✅ Table 'documents' is accessible")
        except Exception as e:
            print(f"❌ Failed to query 'documents' table: {e}")
            print("   (Did you run the migration SQL?)")
            return

        # Test Insert (only if we have an embedding)
        if mock_embedding:
            print("   Attempting test insertion...")
            try:
                # Insert
                import json
                with db_pool.connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute("INSERT INTO documents (content, source_url, embedding, metadata) VALUES (%s, %s, %s, %s) RETURNING id",
                            ("Diagnostics Test Chunk", "diagnostics://test", mock_embedding, json.dumps({"test": True}))
                        )
                        row_id = cur.fetchone()[0]
                    conn.commit()
                print("✅ Insertion successful!")
                
                # Cleanup
                if row_id:
                    print(f"   Cleaning up test row {row_id}...")
                    with db_pool.connection() as conn:
                        with conn.cursor() as cur:
                            cur.execute("DELETE FROM documents WHERE id = %s", (row_id,))
                        conn.commit()
                    print("✅ Cleanup successful")
            except Exception as e:
                print(f"❌ Insertion failed: {e}")
                if "dimension" in str(e):
                    print("   (Hint: Check vector column dimension)")

    except Exception as e:
        print(f"❌ Database client initialization failed: {e}")

if __name__ == "__main__":
    success, embedding = test_embedding()
    if embedding:
        test_database(embedding)
    else:
        print("\n⚠️ Skipping Database test because embedding failed.")
        # Try generic dummy embedding
        print("   Using dummy embedding for DB check...")
        test_database([0.1] * 3072)
        
    print("\n[3] Shutting down connection pool...")
    from database import get_db_pool
    db_pool = get_db_pool()
    if db_pool:
        db_pool.close()
    print("✅ Diagnostic complete")
