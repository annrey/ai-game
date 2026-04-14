import re
import os

with open('ui/index.html', 'r') as f:
    html = f.read()

# Extract style
style_match = re.search(r'<style>([\s\S]*?)</style>', html)
if style_match:
    os.makedirs('ui/src/styles', exist_ok=True)
    with open('ui/src/styles/main.css', 'w') as f:
        f.write(style_match.group(1))

# Extract script
script_match = re.search(r'<script>([\s\S]*?)</script>', html)
if script_match:
    app_js = script_match.group(1)

# Replace in html
new_html = re.sub(r'<style>[\s\S]*?</style>', '<link rel="stylesheet" href="./src/styles/main.css">', html)
new_html = re.sub(r'<script>[\s\S]*?</script>', '<script type="module" src="./src/js/main.js"></script>', new_html)

with open('ui/index.html', 'w') as f:
    f.write(new_html)

# Now we process app_js to extract modules
# Replace globals
globals_list = [
    'serverConfig', 'idleTimer', 'lastInteraction', 'providerModels',
    'gameState', 'narrativeHistory', 'logHistory', 'uiSettings',
    'cotPollingInterval', 'lastCOTId', 'cotEventSource', 'API_BASE'
]
pattern = r'(?<!window\.)\b(' + '|'.join(globals_list) + r')\b'
app_js = re.sub(pattern, r'window.\1', app_js)

# Split sections based on markers and functions
def extract_section(start_marker, end_marker):
    global app_js
    start_idx = app_js.find(start_marker)
    if start_idx == -1: return ""
    
    end_idx = app_js.find(end_marker, start_idx + len(start_marker))
    if end_idx == -1: end_idx = len(app_js)
    
    extracted = app_js[start_idx:end_idx]
    app_js = app_js[:start_idx] + app_js[end_idx:]
    return extracted

cot_code = extract_section('// ========== 思维链 (Chain of Thought) 相关函数 ==========', '// ========== 思维链函数结束 ==========')
guide_code = extract_section('// ============ 引导系统功能 ============', 'async function checkServerHealth()')
api_code = extract_section('// API 客户端', '// 游戏状态')
settings_code = extract_section('const defaultSettings = {', '// ========== 思维链 (Chain of Thought) 相关函数 ==========')

# Split settings.js into core, dialogs, ui-render
def extract_from_settings(start_marker, end_marker):
    global settings_code
    start_idx = settings_code.find(start_marker)
    if start_idx == -1: return ""
    
    end_idx = settings_code.find(end_marker, start_idx + len(start_marker))
    if end_idx == -1: end_idx = len(settings_code)
    
    extracted = settings_code[start_idx:end_idx]
    settings_code = settings_code[:start_idx] + settings_code[end_idx:]
    return extracted

core_code = extract_from_settings('function escapeHtml(text) {', 'const openHistoryBtn = document.getElementById(\'openHistory\');')
dialogs_code = extract_from_settings('function formatTime(d) {', 'function escapeHtml(text) {')
ui_render_code = extract_from_settings('async function loadGameState() {', 'function formatTime(d) {')

# The rest of app.js becomes main.js
# But we need to separate initialization code
init_pattern = r'// 初始化引导系统.*$'
init_match = re.search(init_pattern, guide_code, re.DOTALL)
init_code = ""
if init_match:
    init_code += init_match.group(0) + "\n"
    guide_code = guide_code[:init_match.start()]

init_pattern2 = r'const openHistoryBtn = document.getElementById.*$'
init_match2 = re.search(init_pattern2, settings_code, re.DOTALL)
if init_match2:
    init_code += init_match2.group(0) + "\n"
    settings_code = settings_code[:init_match2.start()]

main_code = app_js

# State.js
state_code = """
window.serverConfig = null;
window.idleTimer = null;
window.lastInteraction = 0;
window.providerModels = null;
window.gameState = { turnCount: 0, isProcessing: false };
window.narrativeHistory = [];
window.logHistory = [];
window.cotPollingInterval = null;
window.lastCOTId = null;
window.cotEventSource = null;
window.API_BASE = "";
"""

# Helper to expose functions
def expose_functions(text):
    funcs = re.findall(r'^\s*(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(', text, flags=re.MULTILINE)
    if funcs:
        assignments = '\n'.join([f"window.{fn} = {fn};" for fn in funcs])
        text += "\n\n// Expose functions to window\n" + assignments + "\n"
    return text

os.makedirs('ui/src/js', exist_ok=True)

with open('ui/src/js/state.js', 'w') as f: f.write(state_code)
with open('ui/src/js/api.js', 'w') as f: f.write(expose_functions(api_code))
with open('ui/src/js/cot.js', 'w') as f: f.write(expose_functions(cot_code))
with open('ui/src/js/guide.js', 'w') as f: f.write(expose_functions(guide_code))
with open('ui/src/js/core.js', 'w') as f: f.write(expose_functions(core_code))
with open('ui/src/js/dialogs.js', 'w') as f: f.write(expose_functions(dialogs_code))
with open('ui/src/js/ui-render.js', 'w') as f: f.write(expose_functions(ui_render_code))
with open('ui/src/js/settings.js', 'w') as f: f.write(expose_functions(settings_code))

# Write main.js
with open('ui/src/js/main.js', 'w') as f:
    f.write("""import './state.js';
import './api.js';
import './settings.js';
import './ui-render.js';
import './dialogs.js';
import './core.js';
import './cot.js';
import './guide.js';

""")
    f.write(expose_functions(main_code))
    f.write("\n" + init_code)

print("Done python refactor.")
