"""
Source Credibility Scoring Module for SnapMind.

Automatically scores indexed sources on a 0-100 credibility scale using
multiple signals: domain authority, HTTPS, content depth, and structure.
"""

import re
from urllib.parse import urlparse
from typing import Dict, Any


class CredibilityScorer:
    """Scores source URLs on a 0-100 scale using multiple heuristic signals."""

    # Tier 1: Institutional / Academic / Government (85-100 range)
    TIER_1_DOMAINS = {
        # TLDs checked separately: .edu, .gov, .mil, .int
        'nature.com', 'science.org', 'ieee.org', 'acm.org',
        'arxiv.org', 'who.int', 'nih.gov', 'nist.gov', 'cdc.gov',
        'mozilla.org', 'w3.org', 'python.org', 'docs.python.org',
        'docs.microsoft.com', 'learn.microsoft.com',
        'developer.apple.com', 'cloud.google.com', 'developers.google.com',
        'docs.aws.amazon.com', 'docs.oracle.com',
        'pytorch.org', 'tensorflow.org', 'huggingface.co',
        'openai.com', 'anthropic.com', 'deepmind.google',
        'rfc-editor.org', 'ietf.org',
    }

    # Tier 2: High-quality community / journalism
    TIER_2_DOMAINS = {
        'wikipedia.org', 'en.wikipedia.org',
        'stackoverflow.com', 'stackexchange.com',
        'github.com', 'gitlab.com',
        'medium.com', 'dev.to', 'hashnode.dev',
        'bbc.com', 'bbc.co.uk', 'reuters.com', 'apnews.com',
        'nytimes.com', 'theguardian.com', 'washingtonpost.com',
        'techcrunch.com', 'arstechnica.com', 'theverge.com', 'wired.com',
        'hbr.org', 'forbes.com',
    }

    # Tier 1 TLDs
    AUTHORITY_TLDS = {'edu', 'gov', 'mil', 'int'}

    def score(self, source_url: str, content: str = "", metadata: dict = None) -> Dict[str, Any]:
        """
        Compute credibility score for a source.

        Returns:
            {
                "score": int (0-100),
                "tier": "verified" | "trusted" | "community" | "unverified",
                "factors": { ... }
            }
        """
        if not source_url:
            return {"score": 0, "tier": "unverified", "factors": {}}

        factors = {}

        # --- 1. Domain Authority (0-40 points) ---
        domain = self._extract_domain(source_url)
        tld = domain.rsplit('.', 1)[-1] if '.' in domain else ''
        root_domain = self._get_root_domain(domain)

        if root_domain in self.TIER_1_DOMAINS or tld in self.AUTHORITY_TLDS:
            factors['domain_authority'] = 40
        elif root_domain in self.TIER_2_DOMAINS:
            factors['domain_authority'] = 25
        elif tld in ('org', 'io'):
            factors['domain_authority'] = 15
        elif tld in ('com', 'net', 'co'):
            factors['domain_authority'] = 8
        else:
            factors['domain_authority'] = 5

        # --- 2. HTTPS (0-10 points) ---
        factors['https_bonus'] = 10 if source_url.startswith('https') else 0

        # --- 3. Content Depth (0-25 points) ---
        if content:
            word_count = len(content.split())
            has_headings = bool(re.search(r'^#{1,3}\s', content, re.MULTILINE))
            has_code = '```' in content or '<code>' in content
            has_lists = bool(re.search(r'^\s*[-*\d]+[.)]\s', content, re.MULTILINE))
            has_tables = '|' in content and '---' in content

            depth = min(25, (
                min(10, word_count // 200) +            # Up to 10 pts for length
                (4 if has_headings else 0) +             # Structure
                (4 if has_code else 0) +                 # Technical depth
                (3 if has_lists else 0) +                # Organization
                (4 if has_tables else 0)                 # Data presence
            ))
            factors['content_depth'] = depth
        else:
            factors['content_depth'] = 5  # Neutral default

        # --- 4. URL Quality Signals (0-10 points) ---
        url_score = 0
        parsed = urlparse(source_url)
        path = parsed.path.lower()

        # Documentation paths score higher
        if any(p in path for p in ['/docs/', '/documentation/', '/api/', '/reference/', '/guide/', '/tutorial/']):
            url_score += 5
        # Blog paths score lower (opinion content)
        if '/blog/' in path or '/opinion/' in path:
            url_score -= 2
        # Official paths
        if '/official/' in path or '/spec/' in path or '/rfc/' in path:
            url_score += 5
        # Short path depth = more authoritative (homepage-adjacent)
        path_depth = len([p for p in path.split('/') if p])
        if path_depth <= 2:
            url_score += 3

        factors['url_quality'] = max(0, min(10, url_score))

        # --- 5. Freshness proxy (0-15 points) ---
        # Default to moderate freshness; can be overridden by metadata
        freshness = 10
        if metadata:
            # If metadata has a created_at or date field, we could adjust
            tags = metadata.get('tags', [])
            if any(t.lower() in ('deprecated', 'archived', 'legacy', 'outdated') for t in tags):
                freshness = 3
        factors['freshness'] = freshness

        # --- Compute total ---
        total_score = sum(factors.values())
        total_score = max(0, min(100, total_score))

        # --- Determine tier ---
        if total_score >= 70:
            tier = 'verified'
        elif total_score >= 50:
            tier = 'trusted'
        elif total_score >= 30:
            tier = 'community'
        else:
            tier = 'unverified'

        return {
            "score": total_score,
            "tier": tier,
            "factors": factors
        }

    def _extract_domain(self, url: str) -> str:
        """Extract the full domain from a URL."""
        try:
            parsed = urlparse(url)
            return parsed.netloc.lower().replace('www.', '')
        except Exception:
            return ''

    def _get_root_domain(self, domain: str) -> str:
        """Get the root domain (e.g., 'docs.python.org' → 'python.org')."""
        parts = domain.split('.')
        if len(parts) >= 2:
            # Handle co.uk style TLDs
            if parts[-2] in ('co', 'com', 'org', 'ac', 'gov') and len(parts) >= 3:
                return '.'.join(parts[-3:])
            return '.'.join(parts[-2:])
        return domain


# Module-level singleton for convenience
_scorer = CredibilityScorer()


def score_source(source_url: str, content: str = "", metadata: dict = None) -> Dict[str, Any]:
    """Convenience function to score a source URL."""
    return _scorer.score(source_url, content, metadata)
