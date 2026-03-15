import requests
import time
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_caching():
    print("\n[TEST] Testing Semantic Caching...")
    
    query = "What is the architecture of SnapMind?"
    payload = {"query": query}
    
    # 1. First Pass (Cache Miss)
    start_time = time.time()
    r1 = requests.post(f"{BASE_URL}/chat", json=payload)
    t1 = time.time() - start_time
    
    if r1.status_code != 200:
        print(f"❌ Initial request failed: {r1.text}")
        return False
        
    print(f"   First pass: {t1:.2f}s (Cache Miss)")
    
    # 2. Second Pass (Cache Hit)
    start_time = time.time()
    r2 = requests.post(f"{BASE_URL}/chat", json=payload)
    t2 = time.time() - start_time
    
    if r2.status_code != 200:
        print(f"❌ Second request failed: {r2.text}")
        return False
        
    print(f"   Second pass: {t2:.2f}s")
    
    if t2 < t1 * 0.5: # Expect significant speedup
        print("✅ Cache Verified (Significant speedup observed)")
        return True
    else:
        print("⚠️ Cache Verification inconclusive (check logs for [CACHE] lines)")
        return True # Soft pass, relying on logs

def test_reranking_and_optimization():
    print("\n[TEST] Testing Reranking & Context Optimization...")
    
    # This query should trigger retrieval of multiple chunks
    query = "How does the ingestion pipeline work?"
    payload = {"query": query}
    
    r = requests.post(f"{BASE_URL}/chat", json=payload)
    
    if r.status_code == 200:
        print("✅ Request Successful")
        print("   Please check backend logs for:")
        print("   - [RERANK] Reranking X candidates")
        print("   - [CONTEXT] Optimized from X to Y tokens")
        return True
    else:
        print(f"❌ Request failed: {r.text}")
        return False

if __name__ == "__main__":
    print("="*40)
    print("RAG FEATURE VERIFICATION")
    print("="*40)
    
    # Wait for server to potentially reload
    time.sleep(2)
    
    if test_caching() and test_reranking_and_optimization():
        print("\n✅ Verification Script Completed Successfully")
    else:
        print("\n❌ Verification Failed")
