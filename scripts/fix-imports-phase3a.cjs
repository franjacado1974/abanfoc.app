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
let modifiedCount = 0;

allFiles.forEach(filePath => {
  const relPath = path.relative(srcDir, filePath).replace(/\\/g, '/');
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = content;

  // 1. Root level files (App.tsx, pdfGenerator_backup.ts, etc.)
  if (!relPath.includes('/')) {
    updated = updated
      .replace(/from\s+['"]\.\/recursos-compartidos\/icono_extintor['"]/g, "from './recursos-compartidos/services/icono_extintor'")
      .replace(/from\s+['"]\.\/recursos-compartidos\/icono_bies['"]/g, "from './recursos-compartidos/services/icono_bies'")
      .replace(/from\s+['"]\.\/recursos-compartidos\/pdfGenerator['"]/g, "from './recursos-compartidos/services/pdfGenerator'")
      .replace(/from\s+['"]\.\/recursos-compartidos\/pdfContratoGenerator['"]/g, "from './recursos-compartidos/services/pdfContratoGenerator'")
      .replace(/from\s+['"]\.\/recursos-compartidos\/offlineDB['"]/g, "from './recursos-compartidos/services/offlineDB'")
      .replace(/from\s+['"]\.\/recursos-compartidos\/plantillas['"]/g, "from './recursos-compartidos/types/plantillas'")
      .replace(/from\s+['"]\.\/recursos-compartidos\/constants['"]/g, "from './recursos-compartidos/types/constants'")
      .replace(/from\s+['"]\.\/mantenimientos\/DashboardTecnico['"]/g, "from './mantenimientos/pages/DashboardTecnico'")
      .replace(/from\s+['"]\.\/mantenimientos\/Planificacion['"]/g, "from './mantenimientos/pages/Planificacion'")
      .replace(/from\s+['"]\.\/mantenimientos\/Partes['"]/g, "from './mantenimientos/pages/Partes'")
      .replace(/from\s+['"]\.\/mantenimientos\/RevisionChecklist['"]/g, "from './mantenimientos/pages/RevisionChecklist'")
      .replace(/from\s+['"]\.\/mantenimientos\/Revisiones['"]/g, "from './mantenimientos/pages/Revisiones'")
      .replace(/from\s+['"]\.\/instalaciones\/Instalaciones['"]/g, "from './instalaciones/pages/Instalaciones'")
      .replace(/from\s+['"]\.\/reparaciones\/Reparaciones['"]/g, "from './reparaciones/pages/Reparaciones'")
      .replace(/from\s+['"]\.\/oficina\/Clientes['"]/g, "from './oficina/pages/Clientes'")
      .replace(/from\s+['"]\.\/oficina\/Centros['"]/g, "from './oficina/pages/Centros'")
      .replace(/from\s+['"]\.\/oficina\/ClientesCentros['"]/g, "from './oficina/pages/ClientesCentros'")
      .replace(/from\s+['"]\.\/oficina\/Presupuestos['"]/g, "from './oficina/pages/Presupuestos'")
      .replace(/from\s+['"]\.\/oficina\/Catalogo['"]/g, "from './oficina/pages/Catalogo'")
      .replace(/from\s+['"]\.\/oficina\/Articulos['"]/g, "from './oficina/pages/Articulos'")
      .replace(/from\s+['"]\.\/oficina\/Servicios['"]/g, "from './oficina/pages/Servicios'")
      .replace(/from\s+['"]\.\/oficina\/Albaranes['"]/g, "from './oficina/pages/Albaranes'")
      .replace(/from\s+['"]\.\/oficina\/Certificados['"]/g, "from './oficina/pages/Certificados'")
      .replace(/from\s+['"]\.\/oficina\/ConfiguracionEmpresa['"]/g, "from './oficina/pages/ConfiguracionEmpresa'")
      .replace(/from\s+['"]\.\/oficina\/Pedidos['"]/g, "from './oficina/pages/Pedidos'")
      .replace(/from\s+['"]\.\/oficina\/Ajustes['"]/g, "from './oficina/pages/Ajustes'")
      .replace(/from\s+['"]\.\/oficina\/Buzon['"]/g, "from './oficina/pages/Buzon'");
  }

  // 2. recursos-compartidos/types/plantillas.ts
  else if (relPath === 'recursos-compartidos/types/plantillas.ts') {
    updated = updated
      .replace(/from\s+['"]\.\/firebase\/firebase['"]/g, "from '../firebase/firebase'")
      .replace(/from\s+['"]\.\.\/firebase\/firebase['"]/g, "from '../firebase/firebase'");
  }

  // 3. recursos-compartidos/components/Loader.tsx & EquipoFormulario.tsx
  else if (relPath.startsWith('recursos-compartidos/components/')) {
    updated = updated
      .replace(/from\s+['"]\.\.\/icono_extintor['"]/g, "from '../services/icono_extintor'")
      .replace(/from\s+['"]\.\.\/icono_bies['"]/g, "from '../services/icono_bies'")
      .replace(/from\s+['"]\.\.\/plantillas['"]/g, "from '../types/plantillas'")
      .replace(/from\s+['"]\.\.\/constants['"]/g, "from '../types/constants'")
      .replace(/from\s+['"]\.\.\/offlineDB['"]/g, "from '../services/offlineDB'")
      .replace(/from\s+['"]\.\.\/pdfGenerator['"]/g, "from '../services/pdfGenerator'");
  }

  // 4. mantenimientos/components/ (PartesTecnico.tsx, PartesMovil.tsx)
  else if (relPath.startsWith('mantenimientos/components/')) {
    updated = updated
      .replace(/from\s+['"]\.\.\/recursos-compartidos\/plantillas['"]/g, "from '../../recursos-compartidos/types/plantillas'")
      .replace(/from\s+['"]\.\.\/oficina\/Centros['"]/g, "from '../../oficina/pages/Centros'")
      .replace(/from\s+['"]\.\.\/recursos-compartidos\/firebase\/firebase['"]/g, "from '../../recursos-compartidos/firebase/firebase'")
      .replace(/from\s+['"]\.\.\/recursos-compartidos\/offlineDB['"]/g, "from '../../recursos-compartidos/services/offlineDB'")
      .replace(/from\s+['"]\.\.\/recursos-compartidos\/pdfGenerator['"]/g, "from '../../recursos-compartidos/services/pdfGenerator'");
  }

  // 5. General fallback fixes for any lingering paths
  updated = updated
    .replace(/from\s+['"]\.\.\/recursos-compartidos\/plantillas['"]/g, "from '../../recursos-compartidos/types/plantillas'")
    .replace(/from\s+['"]\.\.\/recursos-compartidos\/constants['"]/g, "from '../../recursos-compartidos/types/constants'")
    .replace(/from\s+['"]\.\.\/recursos-compartidos\/pdfGenerator['"]/g, "from '../../recursos-compartidos/services/pdfGenerator'")
    .replace(/from\s+['"]\.\.\/recursos-compartidos\/pdfContratoGenerator['"]/g, "from '../../recursos-compartidos/services/pdfContratoGenerator'")
    .replace(/from\s+['"]\.\.\/recursos-compartidos\/offlineDB['"]/g, "from '../../recursos-compartidos/services/offlineDB'");

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    modifiedCount++;
    console.log(`Updated: ${relPath}`);
  }
});

console.log(`✅ Phase 3A import path fix completed. ${modifiedCount} files modified.`);
