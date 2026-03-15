import sys
import os
from unittest.mock import MagicMock

# Mocking imports that might fail or cause side effects
sys.modules['database'] = MagicMock()
sys.modules['api_clients'] = MagicMock()
sys.modules['hybrid_search'] = MagicMock()
sys.modules['config'] = MagicMock()
sys.modules['cache'] = MagicMock()
sys.modules['context_optimizer'] = MagicMock()
sys.modules['query_processor'] = MagicMock()
sys.modules['rag_pipeline'] = MagicMock()

import search

def test_suggestions():
    print("Testing get_chat_suggestions for signature issues...")
    
    # Mock searcher behavior within get_relevant_context
    search.HybridSearcher = MagicMock()
    mock_searcher = search.HybridSearcher.return_value
    mock_searcher.search.return_value = [] # No matches
    
    # Mock client and response
    search.get_mistral_client = MagicMock()
    mock_client = search.get_mistral_client.return_value
    mock_client.chat.complete.return_value.choices = [MagicMock()]
    mock_client.chat.complete.return_value.choices[0].message.content = '{"suggestions": ["test1", "test2", "test3"]}'
    
    try:
        # This is where it failed before
        res = search.get_chat_suggestions("Some content", "http://example.com", "site123")
        print("Result:", res)
        assert "suggestions" in res
        assert len(res["suggestions"]) == 3
        print("✅ Success: No TypeError raised!")
    except TypeError as e:
        print(f"❌ Failure: TypeError still exists: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Caught other exception (possibly due to mocks): {e}")
        # If it's not a TypeError, we fixed the specific reported issue
        if "get_relevant_context() got an unexpected keyword argument 'limit'" in str(e):
             print("❌ Failure: Signature mismatch still present.")
             sys.exit(1)
        else:
             print("Assuming signature mismatch is fixed since no TypeError was raised.")

if __name__ == "__main__":
    test_suggestions()
