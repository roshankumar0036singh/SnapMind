import sys
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
sys.modules['graph_logic'] = MagicMock()

import search

def test_global_fallback():
    print("Testing Global Fallback mechanism...")
    
    # Mock Features to avoid optimization and complexity
    search.FeatureFlags.PHASE_5_CONTEXT_OPTIMIZATION = False
    search.FeatureFlags.PHASE_3_RERANKING = False
    search.FeatureFlags.PHASE_2_HYBRID_SEARCH = False
    search.FeatureFlags.GRAPHRAG_ENABLED = False
    
    search.SearchConfig.MATCH_THRESHOLD = 0.1
    search.SearchConfig.MATCH_COUNT = 1
    
    # 1. Mock Searcher
    search.HybridSearcher = MagicMock()
    mock_searcher = search.HybridSearcher.return_value
    
    # Simulate first call (with site_id) returning nothing
    # Simulate second call (site_id=None) returning matches
    def side_effect(query, site_id, top_k, mode):
        if site_id:
            return []
        else:
            return [{'id': 1, 'content': 'GitHub Terms content', 'source_url': 'https://github.com/terms'}]
            
    mock_searcher.search.side_effect = side_effect
    
    # 2. Call get_relevant_context
    ctx, matches = search.get_relevant_context("what is github terms", site_id="https://huggingface.co")
    
    # 3. Verify
    print(f"Context found length: {len(ctx)}")
    print(f"Matches count: {len(matches)}")
    
    if len(matches) > 0 and matches[0]['content'] == 'GitHub Terms content':
        print("✅ Success: Global fallback triggered and returned results!")
    else:
        print("❌ Failure: Global fallback did not return expected results.")
        print(f"DEBUG: matches={matches}")
        sys.exit(1)

if __name__ == "__main__":
    test_global_fallback()
