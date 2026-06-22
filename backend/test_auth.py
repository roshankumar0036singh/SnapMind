from security import supabase
try:
    res = supabase.auth.admin.list_users()
    print("USERS:", res)
except Exception as e:
    print("ERROR:", e)
