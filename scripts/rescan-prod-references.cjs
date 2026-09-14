const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const searchTerms = [
  'app-abanfoc-v1',
  '468455047562',
  '1:468455047562'
];

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== '.firebase') {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const allFiles = getAllFiles(root);
const matches = [];

allFiles.forEach(filePath => {
  const relPath = path.relative(root, filePath).replace(/\\/g, '/');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      searchTerms.forEach(term => {
        if (line.includes(term)) {
          const isDoc = relPath.endsWith('.md') || relPath.endsWith('.txt');
          matches.push({
            file: relPath,
            lineNum: idx + 1,
            term,
            line: line.trim(),
            category: isDoc ? 'Documentación / Histórico' : 'Código Ejecutable / Config'
          });
        }
      });
    });
  } catch (err) {}
});

console.log(JSON.stringify(matches, null, 2));
