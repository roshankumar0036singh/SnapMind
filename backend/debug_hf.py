import sys
import os
import pkgutil

def debug_packages():
    print("--- System Path ---")
    for p in sys.path:
        print(p)
    
    print("\n--- Package Info ---")
    try:
        import mistralai
        print(f"✅ mistralai found at: {mistralai.__file__}")
        try:
            from mistralai import Mistral
            print("✅ Mistral class found")
        except ImportError as e:
            print(f"❌ Mistral class NOT found: {e}")
            print(f"Attributes in mistralai: {dir(mistralai)}")
    except ImportError:
        print("❌ mistralai package NOT found at all")
    
    print("\n--- Environment Variables (Keys Masked) ---")
    for k, v in os.environ.items():
        if "KEY" in k.upper() or "SECRET" in k.upper() or "PASSWORD" in k.upper() or "URL" in k.upper():
            print(f"{k}: {'*'*len(v)}")
        else:
            print(f"{k}: {v}")

if __name__ == "__main__":
    debug_packages()
