
import os
import requests
import glob

# Configuration
BASE_URL = "http://localhost:8000"
DOCS_DIR = r"d:\Rag\website"
API_KEYS = {
    "x-gemini-key": os.getenv("GEMINI_API_KEY"),
    "x-mistral-key": os.getenv("MISTRAL_API_KEY")
}

def ingest_file(file_path):
    print(f"Ingesting {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    file_name = os.path.basename(file_path)
    # The widget expects documents matching its origin, e.g. localhost:3000
    source_url = f"http://localhost:3000/{file_name}"
    
    payload = {
        "url": source_url,
        "text_content": html_content,
        "crawl_mode": "single"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/ingest", json=payload, headers=API_KEYS)
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print(f"✅ Success: {file_name}")
            else:
                print(f"❌ Failed: {file_name} - {result.get('error')}")
        else:
            print(f"❌ HTTP Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")

def main():
    # Only ingest the main documentation files
    doc_files = [
        "index.html",
        "npm.html",
        "desktop.html",
        "extension.html",
        "widget.html",
        "docs.html"
    ]
    
    for doc in doc_files:
        full_path = os.path.join(DOCS_DIR, doc)
        if os.path.exists(full_path):
            ingest_file(full_path)
        else:
            print(f"⚠️ Warning: {doc} not found in {DOCS_DIR}")

if __name__ == "__main__":
    main()
