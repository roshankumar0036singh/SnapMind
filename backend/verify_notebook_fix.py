import os
from dotenv import load_dotenv
load_dotenv()

from search import chat_logic
import json

def test_notebook_query():
    print("Testing Notebook Query Logic...")
    
    # Mock parameters
    query = "What is in my notebook?"
    session_id = "test-session-123"
    api_keys = {"mistral": os.getenv("MISTRAL_API_KEY")}
    
    # Run chat logic with query_notebook=True
    result = chat_logic(
        query=query,
        query_notebook=True,
        api_keys=api_keys,
        session_id=session_id
    )
    
    print("\n--- Result ---")
    answer = result.get('answer', '')
    print(f"Answer Sample: {answer[:200]}...")
    print(f"Context Found: {result.get('context_found')}")
    
    blocks = result.get('retrieved_blocks', [])
    print(f"Total Blocks Found: {len(blocks)}")
    
    nb_blocks = [b for b in blocks if isinstance(b, dict) and str(b.get('id', '')).startswith('nb-block-')]
    print(f"Notebook Blocks (nb-block-*): {len(nb_blocks)}")
    
    if nb_blocks:
        print("PASS: Notebook blocks found in metadata.")
    else:
        print("FAIL: No notebook blocks in metadata.")
        
    import re
    if re.search(r'\[nb-block-\d+\]', answer):
        print("PASS: Citation format [nb-block-X] found in answer.")
    else:
        # Check if it citing without brackets or with different format
        print(f"DEBUG: Citations found in text: {re.findall(r'\[.*?\]', answer)}")
        print("FAIL: Expected citation format [nb-block-X] not found in answer.")

if __name__ == "__main__":
    if not os.getenv("MISTRAL_API_KEY"):
        print("SKIP: MISTRAL_API_KEY not set.")
    else:
        test_notebook_query()
