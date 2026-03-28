import re
import glob

def update_nav_logo():
    files = glob.glob("*.html")
    for file in files:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Some pages might already have it as <a>, let's normalize
        content = re.sub(r'<div class="nav-logo">', r'<a href="snapmind-landing.html" class="nav-logo" style="text-decoration:none">', content)
        # Fix closing div if it hasn't been fixed
        content = re.sub(r'(<a href="snapmind-landing.html" class="nav-logo" style="text-decoration:none">.*?snapmind<span>-ai</span>)\s*</div>', r'\1\n  </a>', content, flags=re.DOTALL)
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")

if __name__ == "__main__":
    update_nav_logo()
