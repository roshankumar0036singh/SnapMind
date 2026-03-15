"""
Caching Module for RAG Pipeline

Implements semantic caching to reduce API calls and improve response times.
Uses in-memory cache with semantic similarity matching for query deduplication.
"""

import time
import hashlib
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from config import CacheConfig
import threading


@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    query: str
    query_embedding: List[float]
    results: Any
    timestamp: datetime
    hit_count: int = 0
    last_accessed: datetime = field(default_factory=datetime.now)


class SemanticCache:
    """
    In-memory semantic cache with similarity-based matching.
    
    Caches query results and matches similar queries using cosine similarity.
    """
    
    def __init__(self):
        """Initialize semantic cache"""
        self.cache: Dict[str, CacheEntry] = {}
        self.similarity_threshold = CacheConfig.CACHE_SIMILARITY_THRESHOLD
        self.ttl_general = CacheConfig.CACHE_TTL_GENERAL
        self.ttl_indexed = CacheConfig.CACHE_TTL_INDEXED
        self.lock = threading.Lock()
        
        # Statistics
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'total_queries': 0
        }
    
    def _compute_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Compute cosine similarity between two vectors.
        
        Args:
            vec1: First embedding vector
            vec2: Second embedding vector
            
        Returns:
            Cosine similarity score (0-1)
        """
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        
        # Dot product
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        
        # Magnitudes
        mag1 = sum(a * a for a in vec1) ** 0.5
        mag2 = sum(b * b for b in vec2) ** 0.5
        
        if mag1 == 0 or mag2 == 0:
            return 0.0
        
        return dot_product / (mag1 * mag2)
    
    def _generate_key(self, query: str, site_id: str = None) -> str:
        """Generate cache key from query and site_id"""
        key_string = f"{query}:{site_id or 'all'}"
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def _is_expired(self, entry: CacheEntry, is_indexed: bool = False) -> bool:
        """Check if cache entry is expired"""
        ttl = self.ttl_indexed if is_indexed else self.ttl_general
        age = (datetime.now() - entry.timestamp).total_seconds()
        return age > ttl
    
    def _evict_expired(self):
        """Remove expired entries from cache"""
        with self.lock:
            expired_keys = []
            for key, entry in self.cache.items():
                if self._is_expired(entry):
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self.cache[key]
                self.stats['evictions'] += 1
            
            if expired_keys:
                print(f"[CACHE] Evicted {len(expired_keys)} expired entries")
    
    def get(
        self,
        query: str,
        query_embedding: List[float],
        site_id: str = None
    ) -> Optional[Any]:
        """
        Get cached results for query.
        
        Uses semantic similarity to match similar queries.
        
        Args:
            query: Search query
            query_embedding: Query embedding vector
            site_id: Optional site filter
            
        Returns:
            Cached results if found, None otherwise
        """
        self.stats['total_queries'] += 1
        
        # Evict expired entries periodically
        if self.stats['total_queries'] % 100 == 0:
            self._evict_expired()
        
        # Try exact match first
        exact_key = self._generate_key(query, site_id)
        
        with self.lock:
            if exact_key in self.cache:
                entry = self.cache[exact_key]
                if not self._is_expired(entry):
                    entry.hit_count += 1
                    entry.last_accessed = datetime.now()
                    self.stats['hits'] += 1
                    print(f"[CACHE] Exact hit: '{query[:50]}...'")
                    return entry.results
                else:
                    # Remove expired entry
                    del self.cache[exact_key]
                    self.stats['evictions'] += 1
        
        # Try semantic similarity match
        if query_embedding:
            best_match = None
            best_similarity = 0.0
            
            with self.lock:
                for key, entry in self.cache.items():
                    # Skip if different site_id
                    if site_id and key != exact_key and not key.endswith(f":{site_id or 'all'}"):
                        continue
                    
                    # Skip if expired
                    if self._is_expired(entry):
                        continue
                    
                    # Compute similarity
                    similarity = self._compute_similarity(query_embedding, entry.query_embedding)
                    
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_match = entry
            
            # Check if similarity exceeds threshold
            if best_match and best_similarity >= self.similarity_threshold:
                with self.lock:
                    best_match.hit_count += 1
                    best_match.last_accessed = datetime.now()
                self.stats['hits'] += 1
                print(f"[CACHE] Semantic hit: '{query[:50]}...' (similarity: {best_similarity:.3f})")
                return best_match.results
        
        # Cache miss
        self.stats['misses'] += 1
        print(f"[CACHE] Miss: '{query[:50]}...'")
        return None
    
    def set(
        self,
        query: str,
        query_embedding: List[float],
        results: Any,
        site_id: str = None
    ):
        """
        Store results in cache.
        
        Args:
            query: Search query
            query_embedding: Query embedding vector
            results: Results to cache
            site_id: Optional site filter
        """
        key = self._generate_key(query, site_id)
        
        entry = CacheEntry(
            query=query,
            query_embedding=query_embedding,
            results=results,
            timestamp=datetime.now()
        )
        
        with self.lock:
            self.cache[key] = entry
        
        print(f"[CACHE] Stored: '{query[:50]}...'")
    
    def invalidate(self, site_id: str = None):
        """
        Invalidate cache entries.
        
        Args:
            site_id: If provided, only invalidate entries for this site
        """
        with self.lock:
            if site_id:
                # Invalidate specific site
                keys_to_remove = [
                    k for k in self.cache.keys()
                    if k.endswith(f":{site_id}")
                ]
                for key in keys_to_remove:
                    del self.cache[key]
                print(f"[CACHE] Invalidated {len(keys_to_remove)} entries for site: {site_id}")
            else:
                # Invalidate all
                count = len(self.cache)
                self.cache.clear()
                print(f"[CACHE] Invalidated all {count} entries")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self.lock:
            total = self.stats['hits'] + self.stats['misses']
            hit_rate = (self.stats['hits'] / total * 100) if total > 0 else 0
            
            return {
                'size': len(self.cache),
                'hits': self.stats['hits'],
                'misses': self.stats['misses'],
                'hit_rate': hit_rate,
                'evictions': self.stats['evictions'],
                'total_queries': self.stats['total_queries']
            }
    
    def clear(self):
        """Clear all cache entries"""
        with self.lock:
            self.cache.clear()
            self.stats = {
                'hits': 0,
                'misses': 0,
                'evictions': 0,
                'total_queries': 0
            }
        print("[CACHE] Cleared all entries and stats")


# Global cache instance
_cache_instance = None
_cache_lock = threading.Lock()


def get_cache() -> SemanticCache:
    """Get or create global cache instance"""
    global _cache_instance
    
    if _cache_instance is None:
        with _cache_lock:
            if _cache_instance is None:
                _cache_instance = SemanticCache()
    
    return _cache_instance


def cache_query(
    query: str,
    query_embedding: List[float],
    site_id: str = None
) -> Optional[Any]:
    """
    Convenience function to get cached results.
    
    Args:
        query: Search query
        query_embedding: Query embedding
        site_id: Optional site filter
        
    Returns:
        Cached results or None
    """
    if not CacheConfig.CACHE_ENABLED:
        return None
    
    cache = get_cache()
    return cache.get(query, query_embedding, site_id)


def store_in_cache(
    query: str,
    query_embedding: List[float],
    results: Any,
    site_id: str = None
):
    """
    Convenience function to store results in cache.
    
    Args:
        query: Search query
        query_embedding: Query embedding
        results: Results to cache
        site_id: Optional site filter
    """
    if not CacheConfig.CACHE_ENABLED:
        return
    
    cache = get_cache()
    cache.set(query, query_embedding, results, site_id)


def invalidate_cache(site_id: str = None):
    """
    Convenience function to invalidate cache.
    
    Args:
        site_id: Optional site to invalidate
    """
    cache = get_cache()
    cache.invalidate(site_id)


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    cache = get_cache()
    return cache.get_stats()
