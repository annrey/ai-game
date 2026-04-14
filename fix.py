import os
import re

for filename in os.listdir('ui/src/js'):
    if not filename.endswith('.js') or filename == 'main.js':
        continue
    
    filepath = os.path.join('ui/src/js', filename)
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Remove existing Expose block if any
    content = re.sub(r'// Expose functions to window.*', '', content, flags=re.DOTALL)
    
    # Find all functions
    funcs = re.findall(r'^\s*(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(', content, flags=re.MULTILINE)
    
    if funcs:
        assignments = '\n'.join([f"window.{fn} = {fn};" for fn in funcs])
        content += "\n\n// Expose functions to window\n" + assignments + "\n"
        
    with open(filepath, 'w') as f:
        f.write(content)

print("Fixed window assignments.")
