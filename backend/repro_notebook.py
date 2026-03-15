from search import get_notebook_context
from dotenv import load_dotenv
import os

load_dotenv()

def test_repro():
    print("--- Reproduction Test: Generic Notebook Query ---")
    query = "summarize from notebook"
    
    # Simulate chat_logic behavior
    print(f"Querying notebook for: '{query}'")
    context = get_notebook_context(query)
    
    if not context:
        print("❌ FAILED: get_notebook_context returned empty string!")
    else:
        print("✅ SUCCESS: get_notebook_context found content:")
        print(f"--- Context (first 100 chars) ---\n{context[:100]}...")

if __name__ == "__main__":
    test_repro()
