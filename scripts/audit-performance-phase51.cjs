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
const onSnapshotCalls = [];
const useEffectsWithoutCleanup = [];
const largeFiles = [];

allFiles.forEach(filePath => {
  const relPath = path.relative(srcDir, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  if (lines.length > 500) {
    largeFiles.push({ file: relPath, lineCount: lines.length });
  }

  lines.forEach((line, idx) => {
    if (line.includes('onSnapshot')) {
      onSnapshotCalls.push({ file: relPath, lineNum: idx + 1, line: line.trim() });
    }
  });
});

console.log('=== LARGE FILES (>500 lines) ===');
console.log(JSON.stringify(largeFiles, null, 2));

console.log('\n=== ONSNAPSHOT CALLS ===');
console.log(JSON.stringify(onSnapshotCalls, null, 2));
