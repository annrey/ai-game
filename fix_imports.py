import os
import re

directories = [
    'packages/core/src',
    'packages/memory/src',
    'apps/ui/src'
]

# Handle types replacements
types_pattern = re.compile(r"from\s+['\"](?:\.\./)+types(?:/[\w\-]+)?(?:\.js)?['\"]")
# Handle memory replacements
memory_pattern = re.compile(r"from\s+['\"](?:\.\./)+memory(?:/[\w\-]+)?(?:\.js)?['\"]")
# Handle core replacements inside ui (which probably used `../../src/...` or `../src/...`)
# Wait, ui imports might look like `from '../../src/...'` but maybe not. We'll check ui later.

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    # In core, memory, ui: Replace ../types to @openclaw/shared-types
    new_content = types_pattern.sub("from '@openclaw/shared-types'", new_content)
    
    # In core, ui: Replace ../memory to @openclaw/memory
    new_content = memory_pattern.sub("from '@openclaw/memory'", new_content)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for d in directories:
    if not os.path.exists(d):
        continue
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.ts') or file.endswith('.js') or file.endswith('.tsx') or file.endswith('.jsx'):
                replace_in_file(os.path.join(root, file))
