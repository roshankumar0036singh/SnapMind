import sys
import os

# Add current directory to path so we can import main
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import is_github_repo_url

def test_validation():
    valid_urls = [
        "https://github.com/roshankumar0036singh/SnapMind",
        "http://github.com/google/guava",
        "https://www.github.com/facebook/react.git",
        "https://github.com/psf/requests/",
    ]
    
    invalid_urls = [
        "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
        "https://github.com/features/actions",
        "https://github.com/marketplace/category/chat",
        "https://github.com/pricing",
        "https://github.com/explore",
        "https://github.com/trending",
        "https://github.com/microsoft/vscode/blob/main/package.json",
        "https://github.com/microsoft/vscode/tree/main/src",
        "https://github.com/microsoft/vscode/pull/123",
        "https://github.com/microsoft/vscode/issues/456",
        "https://google.com",
    ]
    
    print("--- Testing Valid URLs ---")
    for url in valid_urls:
        res = is_github_repo_url(url)
        print(f"PASS: {url}" if res else f"FAIL: {url} (expected True)")
        
    print("\n--- Testing Invalid URLs ---")
    for url in invalid_urls:
        res = is_github_repo_url(url)
        print(f"PASS: {url}" if not res else f"FAIL: {url} (expected False)")

if __name__ == "__main__":
    test_validation()
