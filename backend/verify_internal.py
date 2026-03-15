import sys
import os
import asyncio
from dotenv import load_dotenv

# Ensure backend is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Force enable features for verification (overriding .env)
os.environ["PHASE_3_ENABLED"] = "true"
os.environ["PHASE_5_ENABLED"] = "true"
os.environ["PHASE_6_ENABLED"] = "true"
os.environ["CACHE_ENABLED"] = "true"
os.environ["RERANK_ENABLED"] = "true"

load_dotenv()

from config import FeatureFlags
from context_optimizer import optimize_context, OptimizedContext
from cache import get_cache, store_in_cache, cache_query

def test_context_optimization_direct():
    print("\n[TEST] Context Optimization (Direct)...")
    
    # Create dummy chunks
    chunks = [
        {"content": "This is chunk 1. " * 5, "score": 0.9, "source_url": "doc1"},
        {"content": "This is chunk 2. " * 5, "score": 0.8, "source_url": "doc2"},
        {"content": "This is chunk 1. " * 5, "score": 0.9, "source_url": "doc1"}, # Duplicate
    ]
    
    print(f"   Input: {len(chunks)} chunks")
    
    # Test optimization
    ctx = optimize_context(chunks, "test query")
    
    print(f"   Output Token Ratio: {ctx.compression_ratio:.1f}%")
    print(f"   Removed Duplicates: {ctx.removed_duplicates}")
    
    if ctx.removed_duplicates == 1 and len(chunks) > ctx.optimized_chunks:
        print("✅ Context Optimization working (removed duplicates)")
        return True
    else:
        print(f"❌ Context Optimization check failed. Removed: {ctx.removed_duplicates}")
        return False

def test_caching_direct():
    print("\n[TEST] Caching (Direct)...")
    
    query = "test_query_unique_123"
    results = "Cached Answer 123"
    
    # 1. Clear cache
    cache = get_cache()
    cache.clear()
    
    # 2. Check miss
    cached = cache_query(query, None)
    if cached is not None:
        print("❌ Expected cache miss")
        return False
    print("   Cache miss confirmed")
    
    # 3. Store
    store_in_cache(query, None, results)
    print("   Stored value")
    
    # 4. Check hit
    cached = cache_query(query, None)
    if cached == results:
        print("✅ Cache Hit Confirmed")
        return True
    else:
        print(f"❌ Cache hit failed. Got: {cached}")
        return False

def check_feature_flags():
    print("\n[TEST] Feature Flags...")
    print(f"   RERANKING: {FeatureFlags.PHASE_3_RERANKING}")
    print(f"   CONTEXT_OPT: {FeatureFlags.PHASE_5_CONTEXT_OPTIMIZATION}")
    print(f"   CACHING: {FeatureFlags.PHASE_6_CACHING}")
    
    if all([FeatureFlags.PHASE_3_RERANKING, FeatureFlags.PHASE_5_CONTEXT_OPTIMIZATION, FeatureFlags.PHASE_6_CACHING]):
         print("✅ All flags enabled")
         return True
    else:
         print("❌ Flags not enabled properly")
         return False

if __name__ == "__main__":
    print("="*40)
    print("DIRECT FEATURE VERIFICATION")
    print("="*40)
    
    tests = [
        check_feature_flags(),
        test_context_optimization_direct(),
        test_caching_direct()
    ]
    
    if all(tests):
        print("\n✅ Internal Logic Verified")
    else:
        print("\n❌ Internal Logic Failed")
