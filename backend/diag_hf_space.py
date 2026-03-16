import requests
import sys

url = 'https://roshan123478-snapmind-backend.hf.space/'
try:
    print(f"Checking URL: {url}")
    r = requests.get(url, timeout=15)
    print(f"Status Code: {r.status_code}")
    print(f"Content-Type: {r.headers.get('Content-Type')}")
    
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(r.text, 'html.parser')
    print(f"Page Title: {soup.title.string if soup.title else 'No Title'}")
    
    print("\nBody Preview (first 1000 chars):")
    print(r.text[:1000])
    
    if "Log in" in r.text or "Sign in" in r.text:
        print("\n[!] Found 'Log in' or 'Sign in' - likely a private space or HF login redirect.")
    if "is sleeping" in r.text.lower():
        print("\n[!] The Space is sleeping.")
    if "Building" in r.text:
        print("\n[!] The Space is currently building.")
    
except Exception as e:
    print(f"Error: {e}")
