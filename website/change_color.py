import re
import glob

def update_colors():
    files = glob.glob("*.html")
    for file in files:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Update CSS variables mapping
        content = content.replace('--cyan', '--purple')
        content = content.replace('--cyan2', '--purple2')
        content = content.replace('--current-color: var(--cyan)', '--current-color: var(--purple)')
        
        # Add purple2 definition if not exists
        if '--purple2:' not in content and '--purple:' in content:
            # We already have `--purple: #7c3aed;`, let's add `--purple2: #a855f7;` right after
            content = re.sub(r'(--purple: #7c3aed;)', r'\1\n  --purple2: #a855f7;', content)

        # Replace the literal colors and rgba
        # Cyan #00bcd4 -> Purple #7c3aed
        # Cyan RGB 0,188,212 -> Purple RGB 124,58,237
        content = content.replace('#00bcd4', '#7c3aed')
        content = content.replace('0,188,212', '124,58,237')
        
        # Just in case there was cyan2 #00e5ff
        content = content.replace('#00e5ff', '#a855f7')

        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated colors in {file}")

if __name__ == "__main__":
    update_colors()
