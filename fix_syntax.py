import os
import re

for filename in os.listdir('ui/src/js'):
    if not filename.endswith('.js'):
        continue
        
    filepath = os.path.join('ui/src/js', filename)
    with open(filepath, 'r') as f:
        content = f.read()
        
    content = re.sub(r'(?:let|const|var)\s+window\.', 'window.', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Fixed syntax errors.")
