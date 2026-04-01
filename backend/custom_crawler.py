from typing import List, Dict, Optional
import requests

def extract_links_from_page(url: str, max_links: int = 10) -> List[str]:
    """Extract links from a page for multi-page crawling."""
    try:
        from bs4 import BeautifulSoup
        from urllib.parse import urljoin, urlparse
        
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        base_domain = urlparse(url).netloc
        links = []
        
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            full_url = urljoin(url, href)
            parsed = urlparse(full_url)
            
            if parsed.netloc == base_domain and full_url not in links:
                if not any(x in full_url.lower() for x in ['login', 'signup', 'auth']):
                    links.append(full_url)
                    if len(links) >= max_links:
                        break
        
        return links
    except:
        return []


def crawl_website_firecrawl(url: str, max_pages: int = 10, max_depth: int = 2, api_keys: dict = None) -> List[Dict[str, str]]:
    """
    Standard multi-page crawler entry point.
    Satisfies imports in widget_logic.py.
    """
    from rag_pipeline import scrape_website_firecrawl # Local import to avoid circular dependency
    print(f"[CRAWL] Starting multi-page crawl for {url}")
    
    urls_to_crawl = [url]
    # Simple one-level link extraction for now, can be expanded if max_depth > 1
    additional_links = extract_links_from_page(url, max_pages - 1)
    urls_to_crawl.extend(additional_links[:max_pages - 1])
    
    print(f"[CRAWL] Found {len(urls_to_crawl)} target URLs")
    
    results = []
    for idx, page_url in enumerate(urls_to_crawl[:max_pages], 1):
        print(f"[CRAWL] Processing {idx}/{len(urls_to_crawl)}: {page_url}")
        
        try:
            # scrape_website_firecrawl returns (content: str, title: Optional[str])
            content, title = scrape_website_firecrawl(page_url, api_keys=api_keys)
            if content and len(content) > 100:
                results.append({
                    'url': page_url, 
                    'content': content,
                    'title': title or "Untitled Page"
                })
        except Exception as e:
            print(f"[CRAWL] Error scraping {page_url}: {e}")
            continue
    
    print(f"[CRAWL] Complete. Collected {len(results)} pages.")
    return results

# Alias for legacy or internal imports to resolve circular dependencies in rag_pipeline
crawl_multiple_pages_custom = crawl_website_firecrawl

def normalize_url(url: str) -> str:
    """Wrapper that late-imports to avoid circular dependency."""
    from rag_pipeline import normalize_url as norm
    return norm(url)
