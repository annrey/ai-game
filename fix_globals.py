import os
import re

globals_list = [
    'serverConfig', 'idleTimer', 'lastInteraction', 'providerModels',
    'gameState', 'narrativeHistory', 'logHistory', 'uiSettings',
    'cotPollingInterval', 'lastCOTId', 'cotEventSource', 'API_BASE'
]

pattern = r'(?<!window\.)\b(' + '|'.join(globals_list) + r')\b'

for filename in os.listdir('ui/src/js'):
    if not filename.endswith('.js'):
        continue
        
    filepath = os.path.join('ui/src/js', filename)
    with open(filepath, 'r') as f:
        content = f.read()
        
    new_content = re.sub(pattern, r'window.\1', content)
    
    with open(filepath, 'w') as f:
        f.write(new_content)

print("Fixed globals.")
