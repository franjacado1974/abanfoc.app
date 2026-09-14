const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const filesToCheck = [
  '.firebaserc',
  'firebase.json',
  'vite.config.ts',
  'src/recursos-compartidos/firebase/firebase.tsx',
  'src/recursos-compartidos/types/constants.ts',
  'public/manifest.webmanifest',
  'public/version.json',
  'documentacion.md',
  'DEPLOY_FIREBASE.md'
];

const report = [];

filesToCheck.forEach(relPath => {
  const fullPath = path.join(root, relPath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('app-abanfoc-v1') || line.includes('fire2-fcd66') || line.includes('firebaseConfig')) {
        report.push({
          file: relPath,
          lineNum: idx + 1,
          line: line.trim()
        });
      }
    });
  }
});

console.log(JSON.stringify(report, null, 2));
