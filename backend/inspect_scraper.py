import requests

url = "https://api.firecrawl.dev/v1/scrape"
payload = {
    "url": "https://git-scm.com/book/ms/v2/Getting-Started-About-Version-Control",
    "formats": ["markdown"],
    "onlyMainContent": True
}
headers = {
    "Authorization": "Bearer fc-e313530ac1f14d2799073e2450f115d3",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
if response.status_code == 200:
    data = response.json()
    markdown = data.get("data", {}).get("markdown", "")
    with open("firecrawl_raw.md", "w", encoding="utf-8") as f:
        f.write(markdown)
    print("Successfully saved Firecrawl output to firecrawl_raw.md")
else:
    print(f"Error: {response.status_code} - {response.text}")
