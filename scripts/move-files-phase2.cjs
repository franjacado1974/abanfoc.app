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

// 1. Recursos Compartidos
moveFile('firebase.tsx', 'recursos-compartidos/firebase/firebase.tsx');
moveFile('offlineDB.ts', 'recursos-compartidos/offlineDB.ts');
moveFile('pdfGenerator.ts', 'recursos-compartidos/pdfGenerator.ts');
moveFile('pdfContratoGenerator.ts', 'recursos-compartidos/pdfContratoGenerator.ts');
moveFile('icono_bies.ts', 'recursos-compartidos/icono_bies.ts');
moveFile('icono_extintor.ts', 'recursos-compartidos/icono_extintor.ts');
moveFile('plantillas.ts', 'recursos-compartidos/plantillas.ts');
moveFile('constants.ts', 'recursos-compartidos/constants.ts');
moveFile('ConfirmationModal.tsx', 'recursos-compartidos/ConfirmationModal.tsx');

// Componentes UI compartidos
moveFile('components/Sidebar.tsx', 'recursos-compartidos/components/Sidebar.tsx');
moveFile('components/Loader.tsx', 'recursos-compartidos/components/Loader.tsx');
moveFile('components/DetailModal.tsx', 'recursos-compartidos/components/DetailModal.tsx');
moveFile('components/EquipoFormulario.tsx', 'recursos-compartidos/components/EquipoFormulario.tsx');
moveFile('components/SelectionInput.tsx', 'recursos-compartidos/components/SelectionInput.tsx');
moveFile('components/TableInput.tsx', 'recursos-compartidos/components/TableInput.tsx');

// 2. Mantenimientos
moveFile('Planificacion.tsx', 'mantenimientos/Planificacion.tsx');
moveFile('Partes.tsx', 'mantenimientos/Partes.tsx');
moveFile('RevisionChecklist.tsx', 'mantenimientos/RevisionChecklist.tsx');
moveFile('Revisiones.tsx', 'mantenimientos/Revisiones.tsx');
moveFile('DashboardTecnico.tsx', 'mantenimientos/DashboardTecnico.tsx');
moveFile('PartesTecnico.tsx', 'mantenimientos/PartesTecnico.tsx');
moveFile('PartesMovil.tsx', 'mantenimientos/PartesMovil.tsx');
moveDir('components/RevisionSistemas', 'mantenimientos/RevisionSistemas');

// 3. Instalaciones
moveFile('Instalaciones.tsx', 'instalaciones/Instalaciones.tsx');

// 4. Reparaciones
moveFile('Reparaciones.tsx', 'reparaciones/Reparaciones.tsx');

// 5. Oficina
moveFile('Clientes.tsx', 'oficina/Clientes.tsx');
moveFile('Centros.tsx', 'oficina/Centros.tsx');
moveFile('ClientesCentros.tsx', 'oficina/ClientesCentros.tsx');
moveFile('Presupuestos.tsx', 'oficina/Presupuestos.tsx');
moveFile('Pedidos.tsx', 'oficina/Pedidos.tsx');
moveFile('Albaranes.tsx', 'oficina/Albaranes.tsx');
moveFile('Certificados.tsx', 'oficina/Certificados.tsx');
moveFile('Catalogo.tsx', 'oficina/Catalogo.tsx');
moveFile('Articulos.tsx', 'oficina/Articulos.tsx');
moveFile('Servicios.tsx', 'oficina/Servicios.tsx');
moveFile('ConfiguracionEmpresa.tsx', 'oficina/ConfiguracionEmpresa.tsx');
moveFile('GestionEmpresa.tsx', 'oficina/GestionEmpresa.tsx');
moveFile('Ajustes.tsx', 'oficina/Ajustes.tsx');
moveFile('Buzon.tsx', 'oficina/Buzon.tsx');
moveFile('FormBuilderPlantillas.tsx', 'oficina/FormBuilderPlantillas.tsx');
moveFile('Sistemas.tsx', 'oficina/Sistemas.tsx');
moveFile('PeriodicidadPage.tsx', 'oficina/PeriodicidadPage.tsx');

console.log('✅ File move completed successfully!');
