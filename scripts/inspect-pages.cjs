const fs = require('fs');
const content = fs.readFileSync('dashboard.html', 'utf8');

const pages = [];
const regex = /id="(pg-[^"]+)"/g;
let m;
while ((m = regex.exec(content)) !== null) {
  pages.push(m[1]);
}
console.log('Found pages:', pages);

// Find navigation links in sidebar
const navRegex = /go\('([^']+)'/g;
const navs = [];
while ((m = navRegex.exec(content)) !== null) {
  navs.push(m[1]);
}
console.log('Sidebar navigation targets:', [...new Set(navs)]);

// Find all functions in scripts
const fnRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(/g;
const fns = [];
while ((m = fnRegex.exec(content)) !== null) {
  fns.push(m[1]);
}
console.log('Defined JS functions:', fns.length);
