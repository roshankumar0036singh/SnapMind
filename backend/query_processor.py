"""
Query Enhancement Module for RAG Pipeline

Implements advanced query processing techniques:
- HyDE (Hypothetical Document Embeddings)
- Multi-query generation
- Query expansion
- Query classification
"""

import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from config import QueryConfig, GenerationConfig


@dataclass
class EnhancedQuery:
    """Enhanced query with variations and metadata"""
    original_query: str
    enhanced_queries: List[str]
    query_type: str
    hyde_document: Optional[str] = None
    keywords: List[str] = None


class QueryProcessor:
    """
    Main query processor implementing various enhancement techniques.
    """
    
    def __init__(self, api_keys: dict = None):
        """Initialize query processor with LLM client"""
        try:
            from api_clients import get_mistral_client
            self.mistral_client = get_mistral_client(api_keys)
            
            if not self.mistral_client:
                print("[QUERY] Warning: Mistral client not initialized")
        except Exception as e:
            print(f"[QUERY] Failed to initialize Mistral: {e}")
            self.mistral_client = None
    
    def classify_query(self, query: str) -> str:
        """
        Classify query type to determine best enhancement strategy.
        
        Returns:
            Query type: 'factual', 'conversational', 'code', 'conceptual'
        """
        query_lower = query.lower()
        
        # Code-related keywords
        code_keywords = ['code', 'function', 'class', 'error', 'bug', 'implement', 'syntax']
        if any(kw in query_lower for kw in code_keywords):
            return 'code'
        
        # Factual keywords (who, what, when, where)
        factual_keywords = ['what is', 'who is', 'when', 'where', 'define', 'explain']
        if any(kw in query_lower for kw in factual_keywords):
            return 'factual'
        
        # Conversational (how to, why)
        conversational_keywords = ['how to', 'how do', 'why', 'best way']
        if any(kw in query_lower for kw in conversational_keywords):
            return 'conversational'
        
        # Default to conceptual
        return 'conceptual'
    
    def generate_hyde_document(self, query: str) -> Optional[str]:
        """
        Generate hypothetical document using HyDE technique.
        
        HyDE: Instead of embedding the query directly, generate a hypothetical
        answer and embed that. This often retrieves better results.
        """
        if not self.mistral_client or not QueryConfig.HYDE_ENABLED:
            return None
        
        try:
            prompt = f"""Generate a concise, factual answer to this question as if it were from a high-quality document. 
Do not include conversational elements or questions. Just provide the direct answer.

Question: {query}

Answer:"""
            
            response = self.mistral_client.chat.complete(
                model=GenerationConfig.GENERATION_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,  # Lower temperature for more focused answers
                max_tokens=200
            )
            
            hyde_doc = response.choices[0].message.content.strip()
            print(f"[HYDE] Generated hypothetical document ({len(hyde_doc)} chars)")
            return hyde_doc
            
        except Exception as e:
            print(f"[HYDE] Error generating document: {e}")
            return None
    
    def generate_query_variations(self, query: str, num_variations: int = None) -> List[str]:
        """
        Generate multiple variations of the query for multi-query retrieval.
        
        This helps capture different phrasings and aspects of the question.
        """
        if not self.mistral_client or not QueryConfig.MULTI_QUERY_ENABLED:
            return [query]
        
        if num_variations is None:
            num_variations = QueryConfig.QUERY_VARIATIONS
        
        try:
            prompt = f"""Generate {num_variations} different ways to ask the following question. 
Each variation should capture the same intent but use different wording.
Return only the questions, one per line, without numbering or explanations.

Original question: {query}

Variations:"""
            
            response = self.mistral_client.chat.complete(
                model=GenerationConfig.GENERATION_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=150
            )
            
            variations_text = response.choices[0].message.content.strip()
            variations = [v.strip() for v in variations_text.split('\n') if v.strip()]
            
            # Remove numbering if present
            variations = [v.split('. ', 1)[-1] if '. ' in v else v for v in variations]
            
            # Include original query
            all_queries = [query] + variations[:num_variations]
            
            print(f"[MULTI-QUERY] Generated {len(variations)} variations")
            return all_queries
            
        except Exception as e:
            print(f"[MULTI-QUERY] Error generating variations: {e}")
            return [query]
    
    def extract_keywords(self, query: str) -> List[str]:
        """
        Extract important keywords from query for query expansion.
        
        Simple implementation using common patterns.
        """
        # Remove common stop words
        stop_words = {
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
            'how', 'what', 'when', 'where', 'who', 'why', 'which',
            'do', 'does', 'did', 'can', 'could', 'should', 'would',
            'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by'
        }
        
        # Simple tokenization
        words = query.lower().split()
        keywords = [w.strip('.,!?') for w in words if w.lower() not in stop_words and len(w) > 2]
        
        return keywords[:5]  # Return top 5 keywords
    
    def enhance_query(
        self,
        query: str,
        use_hyde: bool = None,
        use_multi_query: bool = None
    ) -> EnhancedQuery:
        """
        Main method to enhance a query using configured techniques.
        
        Args:
            query: Original user query
            use_hyde: Override HyDE setting
            use_multi_query: Override multi-query setting
            
        Returns:
            EnhancedQuery object with all enhancements
        """
        # Determine which enhancements to use
        if use_hyde is None:
            use_hyde = QueryConfig.HYDE_ENABLED
        if use_multi_query is None:
            use_multi_query = QueryConfig.MULTI_QUERY_ENABLED
        
        # Classify query
        query_type = self.classify_query(query)
        print(f"[QUERY] Type: {query_type}")
        
        # Extract keywords
        keywords = self.extract_keywords(query)
        
        # Generate HyDE document if enabled
        hyde_doc = None
        if use_hyde:
            hyde_doc = self.generate_hyde_document(query)
        
        # Generate query variations if enabled
        query_variations = [query]
        if use_multi_query:
            query_variations = self.generate_query_variations(query)
        
        return EnhancedQuery(
            original_query=query,
            enhanced_queries=query_variations,
            query_type=query_type,
            hyde_document=hyde_doc,
            keywords=keywords
        )


def enhance_query(
    query: str,
    use_hyde: bool = None,
    use_multi_query: bool = None,
    api_keys: dict = None
) -> EnhancedQuery:
    """
    Convenience function for query enhancement.
    
    Args:
        query: User query
        use_hyde: Enable HyDE
        use_multi_query: Enable multi-query generation
        
    Returns:
        EnhancedQuery object
    """
    processor = QueryProcessor(api_keys=api_keys)
    return processor.enhance_query(query, use_hyde, use_multi_query)


def get_best_query_for_search(enhanced_query: EnhancedQuery) -> str:
    """
    Determine the best query string to use for search.
    
    For HyDE: Use the hypothetical document
    For multi-query: Use the original (variations used separately)
    Otherwise: Use original query
    """
    if enhanced_query.hyde_document:
        return enhanced_query.hyde_document
    else:
        return enhanced_query.original_query
