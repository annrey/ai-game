import re

with open('ui/src/js/dialogs.js', 'r') as f:
    dialogs = f.read()

to_extract = [
    r"document\.querySelectorAll\('details\.panel-section\[data-panel\]'\)\.forEach\(\(details\) => \{[\s\S]*?\}\);",
    r"applySettings\(window\.uiSettings\);",
    r"syncSettingsControls\(\);",
    r"updateCOTUI\(\);",
    r"startCOTPolling\(1000\);",
    r"if \(sidebar\) sidebar\.id = 'sidebar';",
    r"if \(openSidebarBtn\) openSidebarBtn\.addEventListener\('click', toggleLeftDrawer\);",
    r"if \(openRightPanelBtn\) openRightPanelBtn\.addEventListener\('click', toggleRightDrawer\);",
    r"setInterval\(checkServerHealth, 5000\);",
    r"checkServerHealth\(\);"
]

extracted_code = []

for pat in to_extract:
    match = re.search(pat, dialogs)
    if match:
        extracted_code.append(match.group(0))
        dialogs = dialogs.replace(match.group(0), '')

with open('ui/src/js/dialogs.js', 'w') as f:
    f.write(dialogs)

with open('ui/src/js/main.js', 'a') as f:
    f.write("\n// Extracted init code\n")
    f.write("\n".join(extracted_code))

print("Extracted init code.")
