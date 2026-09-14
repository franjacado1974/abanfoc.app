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
      .replace(/from\s+['"]\.\/firebase['"]/g, "from './recursos-compartidos/firebase/firebase'")
      .replace(/from\s+['"]\.\/offlineDB['"]/g, "from './recursos-compartidos/offlineDB'")
      .replace(/from\s+['"]\.\/pdfGenerator['"]/g, "from './recursos-compartidos/pdfGenerator'")
      .replace(/from\s+['"]\.\/pdfContratoGenerator['"]/g, "from './recursos-compartidos/pdfContratoGenerator'")
      .replace(/from\s+['"]\.\/plantillas['"]/g, "from './recursos-compartidos/plantillas'")
      .replace(/from\s+['"]\.\/constants['"]/g, "from './recursos-compartidos/constants'")
      .replace(/from\s+['"]\.\/icono_extintor['"]/g, "from './recursos-compartidos/icono_extintor'")
      .replace(/from\s+['"]\.\/icono_bies['"]/g, "from './recursos-compartidos/icono_bies'")
      .replace(/from\s+['"]\.\/ConfirmationModal['"]/g, "from './recursos-compartidos/ConfirmationModal'")
      .replace(/from\s+['"]\.\/components\/Loader['"]/g, "from './recursos-compartidos/components/Loader'")
      .replace(/from\s+['"]\.\/components\/Sidebar['"]/g, "from './recursos-compartidos/components/Sidebar'")
      .replace(/from\s+['"]\.\/components\/DetailModal['"]/g, "from './recursos-compartidos/components/DetailModal'")
      .replace(/from\s+['"]\.\/components\/EquipoFormulario['"]/g, "from './recursos-compartidos/components/EquipoFormulario'")
      .replace(/from\s+['"]\.\/components\/SelectionInput['"]/g, "from './recursos-compartidos/components/SelectionInput'")
      .replace(/from\s+['"]\.\/components\/TableInput['"]/g, "from './recursos-compartidos/components/TableInput'")
      .replace(/from\s+['"]\.\/DashboardTecnico['"]/g, "from './mantenimientos/DashboardTecnico'")
      .replace(/from\s+['"]\.\/Clientes['"]/g, "from './oficina/Clientes'")
      .replace(/from\s+['"]\.\/Centros['"]/g, "from './oficina/Centros'")
      .replace(/from\s+['"]\.\/ClientesCentros['"]/g, "from './oficina/ClientesCentros'")
      .replace(/from\s+['"]\.\/Presupuestos['"]/g, "from './oficina/Presupuestos'")
      .replace(/from\s+['"]\.\/Catalogo['"]/g, "from './oficina/Catalogo'")
      .replace(/from\s+['"]\.\/Articulos['"]/g, "from './oficina/Articulos'")
      .replace(/from\s+['"]\.\/Servicios['"]/g, "from './oficina/Servicios'")
      .replace(/from\s+['"]\.\/Albaranes['"]/g, "from './oficina/Albaranes'")
      .replace(/from\s+['"]\.\/Certificados['"]/g, "from './oficina/Certificados'")
      .replace(/from\s+['"]\.\/ConfiguracionEmpresa['"]/g, "from './oficina/ConfiguracionEmpresa'")
      .replace(/from\s+['"]\.\/Pedidos['"]/g, "from './oficina/Pedidos'")
      .replace(/from\s+['"]\.\/Planificacion['"]/g, "from './mantenimientos/Planificacion'")
      .replace(/from\s+['"]\.\/Partes['"]/g, "from './mantenimientos/Partes'")
      .replace(/from\s+['"]\.\/RevisionChecklist['"]/g, "from './mantenimientos/RevisionChecklist'")
      .replace(/from\s+['"]\.\/Revisiones['"]/g, "from './mantenimientos/Revisiones'")
      .replace(/from\s+['"]\.\/Reparaciones['"]/g, "from './reparaciones/Reparaciones'")
      .replace(/from\s+['"]\.\/Instalaciones['"]/g, "from './instalaciones/Instalaciones'")
      .replace(/from\s+['"]\.\/Ajustes['"]/g, "from './oficina/Ajustes'")
      .replace(/from\s+['"]\.\/Buzon['"]/g, "from './oficina/Buzon'");
  }

  // 2. recursos-compartidos/firebase/firebase.tsx
  else if (relPath === 'recursos-compartidos/firebase/firebase.tsx') {
    updated = updated
      .replace(/from\s+['"]\.\/offlineDB['"]/g, "from '../offlineDB'")
      .replace(/from\s+['"]\.\/plantillas['"]/g, "from '../plantillas'")
      .replace(/from\s+['"]\.\/icono_extintor['"]/g, "from '../icono_extintor'")
      .replace(/from\s+['"]\.\/icono_bies['"]/g, "from '../icono_bies'");
  }

  // 3. recursos-compartidos/components/ (Sidebar, Loader, DetailModal, EquipoFormulario, SelectionInput, TableInput)
  else if (relPath.startsWith('recursos-compartidos/components/')) {
    updated = updated
      .replace(/from\s+['"]\.\.\/firebase['"]/g, "from '../firebase/firebase'")
      .replace(/from\s+['"]\.\/firebase['"]/g, "from '../firebase/firebase'")
      .replace(/import\(['"]\.\.\/firebase['"]\)/g, "import('../firebase/firebase')")
      .replace(/from\s+['"]\.\.\/constants['"]/g, "from '../constants'")
      .replace(/from\s+['"]\.\/constants['"]/g, "from '../constants'")
      .replace(/from\s+['"]\.\.\/offlineDB['"]/g, "from '../offlineDB'")
      .replace(/from\s+['"]\.\.\/Centros['"]/g, "from '../../oficina/Centros'")
      .replace(/from\s+['"]\.\/Centros['"]/g, "from '../../oficina/Centros'");
  }

  // 4. recursos-compartidos/ (pdfGenerator, pdfContratoGenerator, etc.)
  else if (relPath.startsWith('recursos-compartidos/')) {
    updated = updated
      .replace(/from\s+['"]\.\/firebase['"]/g, "from './firebase/firebase'")
      .replace(/from\s+['"]\.\.\/firebase['"]/g, "from './firebase/firebase'");
  }

  // 5. mantenimientos/RevisionSistemas/
  else if (relPath.startsWith('mantenimientos/RevisionSistemas/')) {
    updated = updated
      .replace(/from\s+['"]\.\.\/\.\.\/firebase['"]/g, "from '../../recursos-compartidos/firebase/firebase'")
      .replace(/from\s+['"]\.\.\/firebase['"]/g, "from '../../recursos-compartidos/firebase/firebase'")
      .replace(/from\s+['"]\.\.\/\.\.\/Centros['"]/g, "from '../../oficina/Centros'")
      .replace(/from\s+['"]\.\.\/Centros['"]/g, "from '../../oficina/Centros'")
      .replace(/from\s+['"]\.\.\/TableInput['"]/g, "from '../../recursos-compartidos/components/TableInput'")
      .replace(/from\s+['"]\.\.\/SelectionInput['"]/g, "from '../../recursos-compartidos/components/SelectionInput'")
      .replace(/from\s+['"]\.\.\/\.\.\/components\/SelectionInput['"]/g, "from '../../recursos-compartidos/components/SelectionInput'")
      .replace(/from\s+['"]\.\.\/\.\.\/components\/TableInput['"]/g, "from '../../recursos-compartidos/components/TableInput'");
  }

  // 6. mantenimientos/ (Planificacion, Partes, RevisionChecklist, Revisiones, DashboardTecnico, PartesTecnico, PartesMovil)
  else if (relPath.startsWith('mantenimientos/')) {
    updated = updated
      .replace(/from\s+['"]\.\/firebase['"]/g, "from '../recursos-compartidos/firebase/firebase'")
      .replace(/import\(['"]\.\/firebase['"]\)/g, "import('../recursos-compartidos/firebase/firebase')")
      .replace(/from\s+['"]\.\/offlineDB['"]/g, "from '../recursos-compartidos/offlineDB'")
      .replace(/from\s+['"]\.\/pdfGenerator['"]/g, "from '../recursos-compartidos/pdfGenerator'")
      .replace(/from\s+['"]\.\/pdfContratoGenerator['"]/g, "from '../recursos-compartidos/pdfContratoGenerator'")
      .replace(/from\s+['"]\.\/plantillas['"]/g, "from '../recursos-compartidos/plantillas'")
      .replace(/from\s+['"]\.\/constants['"]/g, "from '../recursos-compartidos/constants'")
      .replace(/from\s+['"]\.\/ConfirmationModal['"]/g, "from '../recursos-compartidos/ConfirmationModal'")
      .replace(/from\s+['"]\.\/Centros['"]/g, "from '../oficina/Centros'")
      .replace(/from\s+['"]\.\/Clientes['"]/g, "from '../oficina/Clientes'")
      .replace(/from\s+['"]\.\/Sistemas['"]/g, "from '../oficina/Sistemas'")
      .replace(/from\s+['"]\.\/Albaranes['"]/g, "from '../oficina/Albaranes'")
      .replace(/from\s+['"]\.\/Catalogo['"]/g, "from '../oficina/Catalogo'")
      .replace(/from\s+['"]\.\/Buzon['"]/g, "from '../oficina/Buzon'")
      .replace(/from\s+['"]\.\/components\/Sidebar['"]/g, "from '../recursos-compartidos/components/Sidebar'")
      .replace(/from\s+['"]\.\/components\/Loader['"]/g, "from '../recursos-compartidos/components/Loader'")
      .replace(/from\s+['"]\.\/components\/DetailModal['"]/g, "from '../recursos-compartidos/components/DetailModal'")
      .replace(/from\s+['"]\.\/components\/EquipoFormulario['"]/g, "from '../recursos-compartidos/components/EquipoFormulario'")
      .replace(/from\s+['"]\.\/components\/SelectionInput['"]/g, "from '../recursos-compartidos/components/SelectionInput'")
      .replace(/from\s+['"]\.\/components\/TableInput['"]/g, "from '../recursos-compartidos/components/TableInput'")
      .replace(/from\s+['"]\.\/components\/RevisionSistemas\//g, "from './RevisionSistemas/");
  }

  // 7. instalaciones/ (Instalaciones.tsx)
  else if (relPath.startsWith('instalaciones/')) {
    updated = updated
      .replace(/from\s+['"]\.\/firebase['"]/g, "from '../recursos-compartidos/firebase/firebase'")
      .replace(/import\(['"]\.\/firebase['"]\)/g, "import('../recursos-compartidos/firebase/firebase')")
      .replace(/from\s+['"]\.\/pdfGenerator['"]/g, "from '../recursos-compartidos/pdfGenerator'")
      .replace(/from\s+['"]\.\/constants['"]/g, "from '../recursos-compartidos/constants'")
      .replace(/from\s+['"]\.\/components\/Sidebar['"]/g, "from '../recursos-compartidos/components/Sidebar'")
      .replace(/from\s+['"]\.\/components\/Loader['"]/g, "from '../recursos-compartidos/components/Loader'")
      .replace(/from\s+['"]\.\/components\/DetailModal['"]/g, "from '../recursos-compartidos/components/DetailModal'")
      .replace(/from\s+['"]\.\/components\/EquipoFormulario['"]/g, "from '../recursos-compartidos/components/EquipoFormulario'");
  }

  // 8. reparaciones/ (Reparaciones.tsx)
  else if (relPath.startsWith('reparaciones/')) {
    updated = updated
      .replace(/from\s+['"]\.\/firebase['"]/g, "from '../recursos-compartidos/firebase/firebase'")
      .replace(/import\(['"]\.\/firebase['"]\)/g, "import('../recursos-compartidos/firebase/firebase')")
      .replace(/from\s+['"]\.\/pdfGenerator['"]/g, "from '../recursos-compartidos/pdfGenerator'")
      .replace(/from\s+['"]\.\/constants['"]/g, "from '../recursos-compartidos/constants'")
      .replace(/from\s+['"]\.\/components\/Sidebar['"]/g, "from '../recursos-compartidos/components/Sidebar'")
      .replace(/from\s+['"]\.\/components\/Loader['"]/g, "from '../recursos-compartidos/components/Loader'")
      .replace(/from\s+['"]\.\/components\/DetailModal['"]/g, "from '../recursos-compartidos/components/DetailModal'")
      .replace(/from\s+['"]\.\/components\/EquipoFormulario['"]/g, "from '../recursos-compartidos/components/EquipoFormulario'");
  }

  // 9. oficina/ (Clientes, Centros, Presupuestos, Pedidos, Albaranes, Certificados, etc.)
  else if (relPath.startsWith('oficina/')) {
    updated = updated
      .replace(/from\s+['"]\.\/firebase['"]/g, "from '../recursos-compartidos/firebase/firebase'")
      .replace(/import\(['"]\.\/firebase['"]\)/g, "import('../recursos-compartidos/firebase/firebase')")
      .replace(/from\s+['"]\.\/offlineDB['"]/g, "from '../recursos-compartidos/offlineDB'")
      .replace(/from\s+['"]\.\/pdfGenerator['"]/g, "from '../recursos-compartidos/pdfGenerator'")
      .replace(/from\s+['"]\.\/pdfContratoGenerator['"]/g, "from '../recursos-compartidos/pdfContratoGenerator'")
      .replace(/from\s+['"]\.\/plantillas['"]/g, "from '../recursos-compartidos/plantillas'")
      .replace(/from\s+['"]\.\/constants['"]/g, "from '../recursos-compartidos/constants'")
      .replace(/from\s+['"]\.\/components\/Sidebar['"]/g, "from '../recursos-compartidos/components/Sidebar'")
      .replace(/from\s+['"]\.\/components\/Loader['"]/g, "from '../recursos-compartidos/components/Loader'")
      .replace(/from\s+['"]\.\/components\/DetailModal['"]/g, "from '../recursos-compartidos/components/DetailModal'")
      .replace(/from\s+['"]\.\/components\/EquipoFormulario['"]/g, "from '../recursos-compartidos/components/EquipoFormulario'")
      .replace(/from\s+['"]\.\/components\/SelectionInput['"]/g, "from '../recursos-compartidos/components/SelectionInput'")
      .replace(/from\s+['"]\.\/components\/TableInput['"]/g, "from '../recursos-compartidos/components/TableInput'")
      .replace(/from\s+['"]\.\/ConfirmationModal['"]/g, "from '../recursos-compartidos/ConfirmationModal'");
  }

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    modifiedCount++;
    console.log(`Fixed imports in: ${relPath}`);
  }
});

console.log(`✅ Refreshed imports across ${modifiedCount} files.`);
