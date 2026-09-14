const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function moveFile(relSource, relTarget) {
  const sourcePath = path.join(srcDir, relSource);
  const targetPath = path.join(srcDir, relTarget);

  if (fs.existsSync(sourcePath)) {
    ensureDir(path.dirname(targetPath));
    fs.renameSync(sourcePath, targetPath);
    console.log(`Moved: ${relSource} -> ${relTarget}`);
  } else {
    console.warn(`Source not found: ${relSource}`);
  }
}

function moveDir(relSource, relTarget) {
  const sourcePath = path.join(srcDir, relSource);
  const targetPath = path.join(srcDir, relTarget);

  if (fs.existsSync(sourcePath)) {
    ensureDir(path.dirname(targetPath));
    fs.renameSync(sourcePath, targetPath);
    console.log(`Moved Directory: ${relSource} -> ${relTarget}`);
  } else {
    console.warn(`Source dir not found: ${relSource}`);
  }
}

// 1. Crear estructuras de carpetas vacías (.gitkeep)
const subdirs = [
  'mantenimientos/pages', 'mantenimientos/components', 'mantenimientos/hooks', 'mantenimientos/types', 'mantenimientos/services',
  'instalaciones/pages', 'instalaciones/components', 'instalaciones/hooks', 'instalaciones/types', 'instalaciones/services',
  'reparaciones/pages', 'reparaciones/components', 'reparaciones/hooks', 'reparaciones/types', 'reparaciones/services',
  'oficina/pages', 'oficina/components', 'oficina/hooks', 'oficina/types', 'oficina/services',
  'recursos-compartidos/types', 'recursos-compartidos/services'
];

subdirs.forEach(sd => {
  ensureDir(path.join(srcDir, sd));
  fs.writeFileSync(path.join(srcDir, sd, '.gitkeep'), `# ${sd}\n`);
});

// 2. Mover archivos de mantenimientos
moveFile('mantenimientos/Planificacion.tsx', 'mantenimientos/pages/Planificacion.tsx');
moveFile('mantenimientos/Partes.tsx', 'mantenimientos/pages/Partes.tsx');
moveFile('mantenimientos/RevisionChecklist.tsx', 'mantenimientos/pages/RevisionChecklist.tsx');
moveFile('mantenimientos/Revisiones.tsx', 'mantenimientos/pages/Revisiones.tsx');
moveFile('mantenimientos/DashboardTecnico.tsx', 'mantenimientos/pages/DashboardTecnico.tsx');
moveFile('mantenimientos/PartesTecnico.tsx', 'mantenimientos/components/PartesTecnico.tsx');
moveFile('mantenimientos/PartesMovil.tsx', 'mantenimientos/components/PartesMovil.tsx');
moveDir('mantenimientos/RevisionSistemas', 'mantenimientos/components/RevisionSistemas');

// 3. Mover instalaciones
moveFile('instalaciones/Instalaciones.tsx', 'instalaciones/pages/Instalaciones.tsx');

// 4. Mover reparaciones
moveFile('reparaciones/Reparaciones.tsx', 'reparaciones/pages/Reparaciones.tsx');

// 5. Mover oficina
moveFile('oficina/Clientes.tsx', 'oficina/pages/Clientes.tsx');
moveFile('oficina/Centros.tsx', 'oficina/pages/Centros.tsx');
moveFile('oficina/ClientesCentros.tsx', 'oficina/pages/ClientesCentros.tsx');
moveFile('oficina/Presupuestos.tsx', 'oficina/pages/Presupuestos.tsx');
moveFile('oficina/Pedidos.tsx', 'oficina/pages/Pedidos.tsx');
moveFile('oficina/Albaranes.tsx', 'oficina/pages/Albaranes.tsx');
moveFile('oficina/Certificados.tsx', 'oficina/pages/Certificados.tsx');
moveFile('oficina/Catalogo.tsx', 'oficina/pages/Catalogo.tsx');
moveFile('oficina/Articulos.tsx', 'oficina/pages/Articulos.tsx');
moveFile('oficina/Servicios.tsx', 'oficina/pages/Servicios.tsx');
moveFile('oficina/ConfiguracionEmpresa.tsx', 'oficina/pages/ConfiguracionEmpresa.tsx');
moveFile('oficina/GestionEmpresa.tsx', 'oficina/pages/GestionEmpresa.tsx');
moveFile('oficina/Ajustes.tsx', 'oficina/pages/Ajustes.tsx');
moveFile('oficina/Buzon.tsx', 'oficina/pages/Buzon.tsx');
moveFile('oficina/FormBuilderPlantillas.tsx', 'oficina/pages/FormBuilderPlantillas.tsx');
moveFile('oficina/Sistemas.tsx', 'oficina/pages/Sistemas.tsx');
moveFile('oficina/PeriodicidadPage.tsx', 'oficina/pages/PeriodicidadPage.tsx');

// 6. Mover recursos compartidos a services/ y types/
moveFile('recursos-compartidos/offlineDB.ts', 'recursos-compartidos/services/offlineDB.ts');
moveFile('recursos-compartidos/pdfGenerator.ts', 'recursos-compartidos/services/pdfGenerator.ts');
moveFile('recursos-compartidos/pdfContratoGenerator.ts', 'recursos-compartidos/services/pdfContratoGenerator.ts');
moveFile('recursos-compartidos/icono_extintor.ts', 'recursos-compartidos/services/icono_extintor.ts');
moveFile('recursos-compartidos/icono_bies.ts', 'recursos-compartidos/services/icono_bies.ts');
moveFile('recursos-compartidos/plantillas.ts', 'recursos-compartidos/types/plantillas.ts');
moveFile('recursos-compartidos/constants.ts', 'recursos-compartidos/types/constants.ts');

console.log('✅ Phase 3A directory setup and file movement finished!');
