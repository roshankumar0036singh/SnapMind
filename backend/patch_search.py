import sys
import os

filepath = r'd:\Rag\backend\search.py'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_comparison_loop = False
target_header = 'if block_id.startswith(("source-", "pin-")):'
new_header = '                if block_id.startswith("source-"):\n'

for line in lines:
    if target_header in line:
        # Preserve leading spaces
        indent = line[:line.find('if ')]
        new_lines.append(f'{indent}if block_id.startswith("source-"):\n')
    else:
        new_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully patched search.py grouping logic.")
