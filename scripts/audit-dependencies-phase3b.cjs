const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const allFiles = getAllFiles(srcDir);
const results = [];

allFiles.forEach(filePath => {
  const relPath = path.relative(srcDir, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const importMatch = line.match(/import\s+.*?from\s+['"](.*?)['"]/);
    const dynamicMatch = line.match(/import\(['"](.*?)['"]\)/);
    const target = importMatch ? importMatch[1] : (dynamicMatch ? dynamicMatch[1] : null);

    if (target) {
      results.push({
        file: relPath,
        lineNum: idx + 1,
        rawLine: line.trim(),
        target
      });
    }
  });
});

fs.writeFileSync(path.join(__dirname, 'audit-results.json'), JSON.stringify(results, null, 2));
console.log(`Audited ${allFiles.length} files. Total imports analyzed: ${results.length}`);
