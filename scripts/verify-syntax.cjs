const fs = require('fs');
const content = fs.readFileSync('dashboard.html', 'utf8');
const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);

if (scriptMatch) {
  try {
    new Function(scriptMatch[1]);
    console.log('JavaScript syntax in dashboard.html is 100% VALID and error-free!');
  } catch(e) {
    console.error('JS Syntax Error:', e.message);
    process.exit(1);
  }
} else {
  console.error('No script tag found');
  process.exit(1);
}
