const fs = require('fs');

const filenames = ['core.js', 'guide.js', 'dialogs.js', 'settings.js', 'ui-render.js', 'cot.js', 'api.js'];

let initCode = '';

for (const filename of filenames) {
  const filepath = `ui/src/js/${filename}`;
  if (!fs.existsSync(filepath)) continue;
  
  let content = fs.readFileSync(filepath, 'utf8');
  
  // Extract global event listeners and initialization calls
  // In guide.js, from `// 初始化引导系统` to the end (before `// Expose`)
  const initPattern = /\/\/ 初始化引导系统[\s\S]*?(?=\/\/ Expose|$)/;
  const match = content.match(initPattern);
  
  if (match) {
    initCode += match[0] + '\n';
    content = content.replace(initPattern, '');
    fs.writeFileSync(filepath, content);
  }
}

if (initCode) {
  fs.writeFileSync('ui/src/js/init.js', initCode);
  console.log('Moved initialization code to init.js');
} else {
  console.log('No initialization code found.');
}
