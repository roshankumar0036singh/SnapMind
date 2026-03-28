import re
import os

def process():
    with open('snapmind-landing.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # We need to extract:
    # 1. PERSONAS
    # 2. HOW IT WORKS
    # 3. CLI REFERENCE
    # 4. NLP TUNING
    # 5. INSTALL CTA
    # And replace them in npm.html
    
    sections = [
        r'(<!-- PERSONAS -->.*?)<!-- HOW IT WORKS -->',
        r'(<!-- HOW IT WORKS -->.*?)<!-- CLI REFERENCE -->',
        r'(<!-- CLI REFERENCE -->.*?)<!-- PROVIDERS -->',
        r'(<!-- NLP TUNING -->.*?)<!-- SECURITY -->',
        r'(<!-- INSTALL CTA -->.*?)<!-- FAQ -->'
    ]
    
    cli_content = ""
    for pattern in sections:
        match = re.search(pattern, html, flags=re.DOTALL)
        if match:
            cli_content += match.group(1) + "\n"
            html = html.replace(match.group(1), "")

    # Clean the landing page Navbar
    nav_pattern = r'<div class="nav-links">.*?</div>'
    new_nav = '''<div class="nav-links">
    <a href="npm.html">CLI (npm)</a>
    <a href="desktop.html">Desktop App</a>
    <a href="extension.html">Browser Extension</a>
    <a href="widget.html">Web Widget</a>
    <a href="docs.html" target="_blank">Docs</a>
  </div>'''
    html = re.sub(nav_pattern, new_nav, html, flags=re.DOTALL)

    # Save the cleaned landing page
    with open('snapmind-landing.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    print("Cleaned snapmind-landing.html")

    # Now make the sub-pages
    def make_page(filename, title, extra_content):
        # build a simple page layout
        page = html
        # Remove the hero and other sections from the sub-pages
        # Keeping only Nav and Footer, plus specific content
        # Cut everything between </nav> and <footer>
        body_match = re.search(r'(</nav>)(.*?)(<footer>)', page, flags=re.DOTALL)
        if body_match:
            new_body = f"{body_match.group(1)}\n<section style='margin-top:64px; min-height:60vh;'>{extra_content}</section>\n{body_match.group(3)}"
            page = page[:body_match.start(1)] + new_body + page[body_match.end(3):]
        
        # update title
        page = re.sub(r'<title>.*?</title>', f'<title>SnapMind AI — {title}</title>', page)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(page)
            
        print(f"Created {filename}")

    # Create NPM page, injected with cli_content
    make_page('npm.html', 'CLI (npm)', f"<div class='container' style='padding-top:40px;'><h1 style='color:var(--cyan);font-family:var(--display);margin-bottom:1rem;font-size:3rem;'>CLI (npm)</h1><p style='color:var(--text2);margin-bottom:3rem;font-size:1.1rem;'>The full power of SnapMind in your terminal.</p></div>{cli_content}")

    # Create placeholders for others
    make_page('desktop.html', 'Desktop App', "<div class='container' style='padding-top:40px;'><h1 style='color:var(--cyan);font-family:var(--display);font-size:3rem;'>Desktop App</h1><p style='color:var(--text2);margin-top:1rem;font-size:1.1rem;'>Coming soon. Native desktop experience.</p></div>")
    make_page('extension.html', 'Browser Extension', "<div class='container' style='padding-top:40px;'><h1 style='color:var(--cyan);font-family:var(--display);font-size:3rem;'>Browser Extension</h1><p style='color:var(--text2);margin-top:1rem;font-size:1.1rem;'>Coming soon. Seamless browser integration.</p></div>")
    make_page('widget.html', 'Web Widget', "<div class='container' style='padding-top:40px;'><h1 style='color:var(--cyan);font-family:var(--display);font-size:3rem;'>Web Widget</h1><p style='color:var(--text2);margin-top:1rem;font-size:1.1rem;'>Coming soon. Embed anywhere.</p></div>")

if __name__ == '__main__':
    process()
