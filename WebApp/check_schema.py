from supabase import create_client, Client
import os
import requests
from dotenv import load_dotenv
load_dotenv('.env.local')

url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
key = os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')

res = requests.get(url + '/rest/v1/', headers={"apikey": key})
import json
print(json.dumps(res.json(), indent=2)[:2000])
