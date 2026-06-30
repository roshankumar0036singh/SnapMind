import sys

with open('d:/Rag/backend/youtube_parser.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the start and end of the pytubefix block
pytubefix_start = -1
pytubefix_end = -1
for i, line in enumerate(lines):
    if "ATTEMPT 5: pytubefix" in line:
        pytubefix_start = i
    if "combined_errors =" in line:
        pytubefix_end = i
        break

if pytubefix_start != -1 and pytubefix_end != -1:
    pytubefix_block = lines[pytubefix_start:pytubefix_end]
    
    # We want to put pytubefix_block right before ATTEMPT 1
    # Find ATTEMPT 1
    attempt1_start = -1
    for i, line in enumerate(lines):
        if "ATTEMPT 1: youtube-transcript-api" in line:
            attempt1_start = i
            break
            
    if attempt1_start != -1:
        # Reconstruct file
        new_lines = lines[:attempt1_start]
        # Rewrite the attempt headers
        modified_pytubefix = []
        for line in pytubefix_block:
            if "ATTEMPT 5: pytubefix" in line:
                modified_pytubefix.append(line.replace("ATTEMPT 5", "ATTEMPT 1"))
            else:
                modified_pytubefix.append(line)
        
        new_lines.extend(modified_pytubefix)
        
        # Now add the rest, adjusting their attempt numbers
        rest_of_fallbacks = lines[attempt1_start:pytubefix_start]
        for line in rest_of_fallbacks:
            if "ATTEMPT 1:" in line:
                new_lines.append(line.replace("ATTEMPT 1:", "ATTEMPT 2:"))
            elif "ATTEMPT 2:" in line:
                new_lines.append(line.replace("ATTEMPT 2:", "ATTEMPT 3:"))
            elif "ATTEMPT 3:" in line:
                new_lines.append(line.replace("ATTEMPT 3:", "ATTEMPT 4:"))
            elif "ATTEMPT 4:" in line:
                new_lines.append(line.replace("ATTEMPT 4:", "ATTEMPT 5:"))
            else:
                new_lines.append(line)
                
        # Add the remaining lines (combined_errors...)
        new_lines.extend(lines[pytubefix_end:])
        
        with open('d:/Rag/backend/youtube_parser.py', 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print("Successfully reordered fallbacks.")
    else:
        print("Could not find Attempt 1")
else:
    print("Could not find pytubefix block")
