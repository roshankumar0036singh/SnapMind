import os
from dotenv import load_dotenv

load_dotenv()

keys = ["DATABASE_URL", "GOOGLE_API_KEY", "MISTRAL_API_KEY", "FIRECRAWL_API_KEY"]

print("Checking Environment Variables:")
for key in keys:
    val = os.getenv(key)
    if val:
        print(f"{key}: Found (starts with {val[:4]}...)")
    else:
        print(f"{key}: ❌ MISSING")
