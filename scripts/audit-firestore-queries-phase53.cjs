const fs = require('fs');
const path = require('path');

const servicesDirs = [
  path.join(__dirname, '..', 'src', 'mantenimientos', 'services'),
  path.join(__dirname, '..', 'src', 'oficina', 'services'),
  path.join(__dirname, '..', 'src', 'instalaciones', 'services'),
  path.join(__dirname, '..', 'src', 'reparaciones', 'services'),
  path.join(__dirname, '..', 'src', 'recursos-compartidos', 'firebase')
];

const results = [];

servicesDirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      if (
        line.includes('onSnapshot') ||
        line.includes('getDocs') ||
        line.includes('query(') ||
        line.includes('collection(')
      ) {
        results.push({
          file: path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/'),
          lineNum: idx + 1,
          line: line.trim()
        });
      }
    });
  });
});

console.log(JSON.stringify(results, null, 2));
