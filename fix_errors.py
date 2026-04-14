import os

with open('packages/shared-types/src/game.ts', 'r') as f:
    content = f.read()
content = content.replace('autoSaveInterval: number;', 'autoSaveInterval: number;\n  streaming?: boolean;\n  language?: string;')
with open('packages/shared-types/src/game.ts', 'w') as f:
    f.write(content)

with open('packages/core/src/providers/provider-factory.ts', 'r') as f:
    content = f.read()
content = content.replace("'drama-curator': 'DRAMA_CURATOR',", "'drama-curator': 'DRAMA_CURATOR',\n      'guide': 'GUIDE',")
with open('packages/core/src/providers/provider-factory.ts', 'w') as f:
    f.write(content)

with open('apps/server/src/server.ts', 'r') as f:
    content = f.read()
content = content.replace('step =>', '(step: any) =>')
content = content.replace('s =>', '(s: any) =>')
content = content.replace('(sum, step) =>', '(sum: any, step: any) =>')
with open('apps/server/src/server.ts', 'w') as f:
    f.write(content)

with open('packages/core/src/test-world-keeper-enhanced.ts', 'r') as f:
    content = f.read()
content = content.replace('userInput: scene.userInput,', '')
with open('packages/core/src/test-world-keeper-enhanced.ts', 'w') as f:
    f.write(content)
