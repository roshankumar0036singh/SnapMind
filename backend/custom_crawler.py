
from typing import List, Dict
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


def crawl_multiple_pages_custom(url: str, max_pages: int = 10) -> List[Dict[str, str]]:
    """Custom multi-page crawler using link extraction."""
    print(f"[CUSTOM_CRAWL] Starting custom crawl for {url}")
    
    urls_to_crawl = [url]
    additional_links = extract_links_from_page(url, max_pages - 1)
    urls_to_crawl.extend(additional_links[:max_pages - 1])
    
    print(f"[CUSTOM_CRAWL] Found {len(urls_to_crawl)} URLs to crawl")
    
    results = []
    for idx, page_url in enumerate(urls_to_crawl[:max_pages], 1):
        print(f"[CUSTOM_CRAWL] Crawling {idx}/{min(len(urls_to_crawl), max_pages)}: {page_url}")
        
        try:
            content = scrape_website_firecrawl(page_url)
            if content and len(content) > 200:
                results.append({'url': page_url, 'content': content})
        except:
            continue
    
    print(f"[CUSTOM_CRAWL] Completed: {len(results)} pages")
    return results
