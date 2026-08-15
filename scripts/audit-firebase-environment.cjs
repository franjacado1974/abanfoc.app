const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const findings = [];

function searchInFile(filePath) {
  const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  if (relPath.includes('node_modules') || relPath.includes('dist') || relPath.includes('.git')) return;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      if (
        line.toLowerCase().includes('firebase') ||
        line.toLowerCase().includes('fire2') ||
        line.toLowerCase().includes('projectid') ||
        line.toLowerCase().includes('apikey') ||
        line.toLowerCase().includes('abanfoc')
      ) {
        findings.push({
          file: relPath,
          lineNum: idx + 1,
          content: line.trim()
        });
      }
    });
  } catch (err) {}
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir);
  entries.forEach(entry => {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry !== 'node_modules' && entry !== 'dist' && entry !== '.git') {
        scanDir(fullPath);
      }
    } else {
      searchInFile(fullPath);
    }
  });
}

scanDir(projectRoot);
fs.writeFileSync(path.join(__dirname, 'firebase-audit.json'), JSON.stringify(findings, null, 2));
console.log(`Audit complete. Found ${findings.length} references to analyze.`);
