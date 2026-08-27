from supabase import create_client, Client
import os
from dotenv import load_dotenv
load_dotenv('.env.local')
supabase: Client = create_client(os.environ.get('NEXT_PUBLIC_SUPABASE_URL'), os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
res = supabase.table('chat_sessions').select('*').limit(1).execute()
print(res)
