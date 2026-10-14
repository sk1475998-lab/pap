const fs = require('fs');
const content = fs.readFileSync('dashboard.html', 'utf8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);

lines.forEach((l, idx) => {
  if (l.includes('<script>') || l.includes('</script>') || l.includes('class="page') || l.includes('class=\'page\'')) {
    console.log(`Line ${idx + 1}: ${l.trim().slice(0, 100)}`);
  }
});
