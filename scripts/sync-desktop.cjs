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
  console.warn('⚠️ No se encontró la carpeta del Escritorio (entorno aislado o sandbox). Omitiendo copia al escritorio.');
  process.exit(0);
}

// 1. Limpiar carpetas anteriores de SALAMANDRA en el escritorio
try {
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
} catch (e) {
  console.warn('⚠️ No se pudo listar el escritorio:', e.message);
}

// 2. Crear nueva carpeta con la versión actual
const targetDir = path.join(targetDesktop, `SALAMANDRA ${version}`);
const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error('No existe la carpeta dist.');
  process.exit(1);
}

try {
  fs.cpSync(distDir, targetDir, { recursive: true });
  console.log('✅ Copiado con éxito dist ->', targetDir);
} catch (e) {
  console.warn('⚠️ No se pudo copiar a Escritorio:', e.message);
}

// También mantener C:\Users\canci\Desktop\dist actualizado
const classicDist = path.join(process.env.USERPROFILE || 'C:\\Users\\canci', 'Desktop', 'dist');
try {
  fs.cpSync(distDir, classicDist, { recursive: true });
  console.log('✅ Sincronizado Desktop/dist');
} catch (e) {}
