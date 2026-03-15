
import os
import sys
from repo_ingester import ingest_repository

# Simulate api_keys if needed
api_keys = {
    "gemini": os.getenv("GEMINI_API_KEY"),
    "mistral": os.getenv("MISTRAL_API_KEY"),
    "lingodev": os.getenv("LINGODEV_API_KEY"),
}

repo_url = "https://github.com/roshankumar0036singh/SHEETX"

print(f"Testing ingestion for {repo_url}...")
# We use job_id=None so it doesn't try to update the DB during our test if we don't want to, 
# but actually we want to see if the status updates work too.
# For now, let's just see if the logic runs.

try:
    result = ingest_repository(repo_url, api_keys=api_keys)
    print("\nResult:")
    print(result)
except Exception as e:
    print(f"Error: {e}")
