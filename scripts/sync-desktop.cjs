const fs = require('fs');
const path = require('path');

const version = require('../public/version.json').version;
console.log('Sincronizando versión:', version);

const desktopPaths = [
  path.join(process.env.USERPROFILE || 'C:\\Users\\canci', 'OneDrive', 'Escritorio'),
  path.join(process.env.USERPROFILE || 'C:\\Users\\canci', 'Desktop')
];

let targetDesktop = null;
for (const p of desktopPaths) {
  if (fs.existsSync(p)) {
    targetDesktop = p;
    break;
  }
}

if (!targetDesktop) {
  console.error('No se encontró la carpeta del Escritorio.');
  process.exit(1);
}

// 1. Limpiar carpetas anteriores de SALAMANDRA en el escritorio
const entries = fs.readdirSync(targetDesktop);
for (const entry of entries) {
  if (entry.toUpperCase().startsWith('SALAMANDRA')) {
    const fullOld = path.join(targetDesktop, entry);
    try {
      fs.rmSync(fullOld, { recursive: true, force: true });
      console.log('Eliminada versión anterior:', entry);
    } catch (e) {
      console.warn('No se pudo borrar:', entry, e.message);
    }
  }
}

// 2. Crear nueva carpeta con la versión actual
const targetDir = path.join(targetDesktop, `SALAMANDRA ${version}`);
const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error('No existe la carpeta dist.');
  process.exit(1);
}

fs.cpSync(distDir, targetDir, { recursive: true });
console.log('✅ Copiado con éxito dist ->', targetDir);

// También mantener C:\Users\canci\Desktop\dist actualizado
const classicDist = path.join(process.env.USERPROFILE || 'C:\\Users\\canci', 'Desktop', 'dist');
try {
  fs.cpSync(distDir, classicDist, { recursive: true });
  console.log('✅ Sincronizado Desktop/dist');
} catch (e) {}
