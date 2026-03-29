import requests
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Any, Tuple

NITTER_INSTANCES = [
    "https://nitter.privacydev.net",
    "https://nitter.poast.org",
    "https://nitter.it",
    "https://nitter.cz"
]

def get_twitter_thread(url: str) -> Tuple[bool, str, str]:
    """
    Scrapes a Twitter thread. Uses VxTwitter API first for reliability, 
    with Nitter instances as a fallback for full threads.
    
    Returns: (success, content, error_msg)
    """
    # 1. Extract username and tweet ID
    match = re.search(r"(?:twitter\.com|x\.com)/([^/]+)/status/(\d+)", url)
    if not match:
        return False, "", "Invalid Twitter/X URL format. Expected .../username/status/id"
    
    username = match.group(1)
    tweet_id = match.group(2)
    
    content = ""
    error = "Could not parse Twitter/X URL."

    # First try VxTwitter for ultra-reliable extraction of the main tweet
    try:
        vx_url = f"https://api.vxtwitter.com/{username}/status/{tweet_id}"
        print(f"[TWITTER] Trying VxTwitter API: {vx_url}")
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        resp = requests.get(vx_url, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            author = data.get("user_screen_name", username)
            text = data.get("text", "")
            return True, f"@{author}: {text}", ""
        else:
            print(f"[TWITTER] VxTwitter API returned status {resp.status_code}")
    except Exception as e:
        print(f"[TWITTER] Error with VxTwitter API: {e}")

    # Fallback: Try multiple Nitter instances (can extract thread replies if working)
    for instance in NITTER_INSTANCES:
        nitter_url = f"{instance}/{username}/status/{tweet_id}"
        print(f"[TWITTER] Trying Nitter fallback instance: {nitter_url}")
        
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            resp = requests.get(nitter_url, headers=headers, timeout=10)
            if resp.status_code == 200:
                success, thread_text = parse_nitter_html(resp.text)
                if success:
                    return True, thread_text, ""
            else:
                print(f"[TWITTER] Instance {instance} returned status {resp.status_code}")
        except Exception as e:
            print(f"[TWITTER] Error with instance {instance}: {e}")
            continue
            
    return False, "", "All Twitter extractors failed (VxTwitter and Nitter instances)."

def parse_nitter_html(html_content: str) -> Tuple[bool, str]:
    """Parses Nitter HTML to extract the thread tweets."""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Main tweet
    main_tweet = soup.find('div', class_='main-tweet')
    if not main_tweet:
        return False, "Main tweet not found in Nitter response."
    
    thread_parts = []
    
    # helper to extract text from a tweet container
    def extract_tweet_text(container):
        text_div = container.find('div', class_='tweet-content')
        if text_div:
            # Preserve links and mentions if needed, but for RAG we mostly want text
            return text_div.get_text(strip=True)
        return ""

    # 1. Get the main tweet
    main_text = extract_tweet_text(main_tweet)
    author = main_tweet.find('a', class_='fullname').get_text(strip=True) if main_tweet.find('a', class_='fullname') else "Unknown"
    thread_parts.append(f"@{author}: {main_text}")
    
    # 2. Get replies that are part of the thread (usually in 'replies' div)
    replies_div = soup.find('div', class_='replies')
    if replies_div:
        items = replies_div.find_all('div', class_='timeline-item')
        for item in items:
            text = extract_tweet_text(item)
            if text:
                item_author_tag = item.find('a', class_='fullname')
                item_author = item_author_tag.get_text(strip=True) if item_author_tag else "Unknown"
                if item_author == author:
                    thread_parts.append(f"@{item_author}: {text}")

    full_thread = "\n\n---\n\n".join(thread_parts)
    return True, full_thread
