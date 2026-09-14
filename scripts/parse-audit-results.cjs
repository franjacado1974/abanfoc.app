const fs = require('fs');
const path = require('path');

const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-results.json'), 'utf8'));

const crossModuleImports = [];
const directFirebaseImports = [];
const pageTypeImports = [];

function getModule(filePath) {
  const parts = filePath.split('/');
  if (parts.length > 1) {
    return parts[0];
  }
  return 'root';
}

results.forEach(r => {
  const sourceModule = getModule(r.file);

  // Check if target points to another module
  if (r.target.includes('/oficina/') || r.target.includes('/mantenimientos/') || r.target.includes('/instalaciones/') || r.target.includes('/reparaciones/')) {
    let targetModule = 'unknown';
    if (r.target.includes('/oficina/')) targetModule = 'oficina';
    if (r.target.includes('/mantenimientos/')) targetModule = 'mantenimientos';
    if (r.target.includes('/instalaciones/')) targetModule = 'instalaciones';
    if (r.target.includes('/reparaciones/')) targetModule = 'reparaciones';

    if (sourceModule !== targetModule && sourceModule !== 'root') {
      crossModuleImports.push({
        sourceModule,
        targetModule,
        file: r.file,
        lineNum: r.lineNum,
        rawLine: r.rawLine,
        target: r.target
      });
    }
  }

  // Check if target is direct firebase.tsx
  if (r.target.includes('firebase/firebase')) {
    directFirebaseImports.push({
      module: sourceModule,
      file: r.file,
      lineNum: r.lineNum,
      rawLine: r.rawLine
    });
  }

  // Check if importing types from page components
  if (r.rawLine.includes('type ') && (r.target.includes('/pages/') || r.target.includes('Centros') || r.target.includes('Clientes'))) {
    pageTypeImports.push({
      file: r.file,
      lineNum: r.lineNum,
      rawLine: r.rawLine,
      target: r.target
    });
  }
});

console.log('=== CROSS-MODULE IMPORTS ===');
console.log(JSON.stringify(crossModuleImports, null, 2));

console.log('\n=== PAGE TYPE IMPORTS ===');
console.log(JSON.stringify(pageTypeImports, null, 2));

console.log(`\nTotal Direct Firebase Imports: ${directFirebaseImports.length}`);
