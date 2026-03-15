"""
Reranking Module for RAG Pipeline

Implements cross-encoder reranking to improve the quality of top-k results.
Supports Cohere Rerank API with local cross-encoder fallback.
"""

import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from config import RerankingConfig


@dataclass
class RerankResult:
    """Result from reranking operation"""
    document: Dict[str, Any]
    relevance_score: float
    original_rank: int
    reranked_position: int


class BaseReranker:
    """Base class for reranking implementations"""
    
    def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[RerankResult]:
        """
        Rerank documents based on query relevance.
        
        Args:
            query: Search query
            documents: List of candidate documents
            top_k: Number of top results to return
            
        Returns:
            List of reranked results with scores
        """
        raise NotImplementedError


class CohereReranker(BaseReranker):
    """
    Reranker using Cohere's Rerank API.
    Provides state-of-the-art reranking with minimal latency.
    """
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("COHERE_API_KEY")
        
        if not self.api_key:
            raise ValueError("COHERE_API_KEY not found in environment")
        
        try:
            import cohere
            self.client = cohere.Client(self.api_key)
            print("✅ Cohere Reranker initialized")
            
            # Connection check to catch 401 early
            try:
                # Use a dummy request to verify the token
                self.client.rerank(query="test", documents=["test"], top_n=1)
                print("✅ Cohere connection verified")
            except Exception as e:
                if "401" in str(e) or "invalid api token" in str(e).lower():
                    print(f"⚠️ Cohere API 401: The token in .env is invalid.")
                else:
                    print(f"⚠️ Cohere connection check failed: {e}")
        except ImportError:
            raise ImportError(
                "Cohere package not installed. "
                "Install with: pip install cohere"
            )
    
    def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[RerankResult]:
        """
        Rerank using Cohere Rerank API.
        """
        if not documents:
            return []
        
        # Extract text content for reranking
        doc_texts = [doc.get('content', '') for doc in documents]
        
        try:
            # Call Cohere Rerank API
            response = self.client.rerank(
                query=query,
                documents=doc_texts,
                top_n=top_k,
                model="rerank-english-v3.0"  # Latest model
            )
            
            # Build results
            results = []
            for idx, result in enumerate(response.results):
                original_doc = documents[result.index]
                
                rerank_result = RerankResult(
                    document=original_doc,
                    relevance_score=result.relevance_score,
                    original_rank=result.index + 1,
                    reranked_position=idx + 1
                )
                results.append(rerank_result)
            
            print(f"[RERANK] Cohere reranked {len(documents)} → {len(results)} docs")
            return results
            
        except Exception as e:
            print(f"[RERANK] Cohere error: {e}")
            raise


class LocalCrossEncoderReranker(BaseReranker):
    """
    Local reranker using sentence-transformers cross-encoder.
    Runs on CPU/GPU without external API calls.
    """
    
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        """
        Initialize local cross-encoder.
        
        Args:
            model_name: HuggingFace model name for cross-encoder
        """
        self.model_name = model_name
        
        try:
            from sentence_transformers import CrossEncoder
            
            print(f"[RERANK] Loading local model: {model_name}")
            self.model = CrossEncoder(model_name)
            print("✅ Local Cross-Encoder initialized")
            
        except ImportError:
            raise ImportError(
                "sentence-transformers not installed. "
                "Install with: pip install sentence-transformers"
            )
    
    def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[RerankResult]:
        """
        Rerank using local cross-encoder model.
        """
        if not documents:
            return []
        
        # Prepare query-document pairs
        doc_texts = [doc.get('content', '') for doc in documents]
        pairs = [[query, text] for text in doc_texts]
        
        try:
            # Score all pairs
            scores = self.model.predict(pairs)
            
            # Sort by score (descending)
            scored_docs = list(zip(documents, scores, range(len(documents))))
            scored_docs.sort(key=lambda x: x[1], reverse=True)
            
            # Build results
            results = []
            for new_rank, (doc, score, original_idx) in enumerate(scored_docs[:top_k], 1):
                rerank_result = RerankResult(
                    document=doc,
                    relevance_score=float(score),
                    original_rank=original_idx + 1,
                    reranked_position=new_rank
                )
                results.append(rerank_result)
            
            print(f"[RERANK] Local reranked {len(documents)} → {len(results)} docs")
            return results
            
        except Exception as e:
            print(f"[RERANK] Local reranker error: {e}")
            raise


class Reranker:
    """
    Main reranker with automatic fallback chain.
    Tries Cohere first, falls back to local cross-encoder.
    """
    
    def __init__(self, prefer_local: bool = False):
        """
        Initialize reranker with fallback chain.
        
        Args:
            prefer_local: If True, use local reranker first
        """
        self.prefer_local = prefer_local
        self.cohere_reranker = None
        self.local_reranker = None
        
        # Initialize based on configuration
        if not prefer_local:
            # Try Cohere first
            try:
                self.cohere_reranker = CohereReranker()
                print("[RERANK] Using Cohere Rerank API")
            except (ValueError, ImportError) as e:
                print(f"[RERANK] Cohere unavailable: {e}")
                print("[RERANK] Falling back to local cross-encoder")
                self._init_local()
        else:
            # Use local first
            self._init_local()
    
    def _init_local(self):
        """Initialize local cross-encoder"""
        try:
            self.local_reranker = LocalCrossEncoderReranker()
        except ImportError as e:
            print(f"[RERANK] Local reranker unavailable: {e}")
            raise RuntimeError(
                "No reranking backend available. "
                "Install either 'cohere' or 'sentence-transformers'"
            )
    
    def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int = None
    ) -> List[Dict[str, Any]]:
        """
        Rerank documents with automatic fallback.
        
        Args:
            query: Search query
            documents: Candidate documents from retrieval
            top_k: Number of results to return (uses config default if None)
            
        Returns:
            Reranked documents with updated scores
        """
        if not documents:
            return []
        
        # Use configured top_k if not specified
        if top_k is None:
            top_k = RerankingConfig.RERANK_TOP_K
        
        # Limit candidates to configured maximum
        candidates = documents[:RerankingConfig.RERANK_CANDIDATES]
        
        print(f"[RERANK] Reranking {len(candidates)} candidates → top {top_k}")
        
        # Try primary reranker
        try:
            if self.cohere_reranker:
                results = self.cohere_reranker.rerank(query, candidates, top_k)
            elif self.local_reranker:
                results = self.local_reranker.rerank(query, candidates, top_k)
            else:
                raise RuntimeError("No reranker available")
            
            # Convert RerankResult to dict format
            reranked_docs = []
            for result in results:
                doc = result.document.copy()
                doc['rerank_score'] = result.relevance_score
                doc['original_rank'] = result.original_rank
                doc['reranked_position'] = result.reranked_position
                reranked_docs.append(doc)
            
            return reranked_docs
            
        except Exception as e:
            print(f"[RERANK] Primary reranker failed: {e}")
            
            # Try fallback
            if self.cohere_reranker and not self.local_reranker:
                print("[RERANK] Attempting local fallback...")
                try:
                    self._init_local()
                    results = self.local_reranker.rerank(query, candidates, top_k)
                    
                    reranked_docs = []
                    for result in results:
                        doc = result.document.copy()
                        doc['rerank_score'] = result.relevance_score
                        doc['original_rank'] = result.original_rank
                        doc['reranked_position'] = result.reranked_position
                        reranked_docs.append(doc)
                    
                    return reranked_docs
                except Exception as fallback_error:
                    print(f"[RERANK] Fallback failed: {fallback_error}")
            
            # If all reranking fails, return original documents
            print("[RERANK] All rerankers failed, returning original order")
            return documents[:top_k]


def rerank_documents(
    query: str,
    documents: List[Dict[str, Any]],
    top_k: int = 5,
    use_local: bool = False
) -> List[Dict[str, Any]]:
    """
    Convenience function for reranking documents.
    
    Args:
        query: Search query
        documents: Candidate documents
        top_k: Number of results to return
        use_local: Prefer local cross-encoder over Cohere
        
    Returns:
        Reranked documents
    """
    reranker = Reranker(prefer_local=use_local)
    return reranker.rerank(query, documents, top_k)
