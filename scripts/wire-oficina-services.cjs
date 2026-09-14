const fs = require('fs');
const path = require('path');

const oficinaDir = path.join(__dirname, '..', 'src', 'oficina', 'pages');

function updateFile(filename, fn) {
  const fullPath = path.join(oficinaDir, filename);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const updated = fn(content);
    if (updated !== content) {
      fs.writeFileSync(fullPath, updated, 'utf8');
      console.log(`Updated services in: oficina/pages/${filename}`);
    }
  }
}

// 1. Albaranes.tsx
updateFile('Albaranes.tsx', content => {
  return content
    .replace(
      "import { addAlbaran, updateAlbaran, deleteAlbaran, subscribeAlbaranes, subscribeEmpresas, subscribeTecnicos, subscribeCentros, subscribeClientes, subscribeTrabajos, db, type Albaran, type Cliente, type Centro, type Equipo, type Tecnico, type Empresa, type TrabajoConfig, updateParte } from '../../recursos-compartidos/firebase/firebase';",
      "import { subscribeAlbaranes, createAlbaran as addAlbaran, updateAlbaran, deleteAlbaran } from '../services/facturacionService';\nimport { subscribeClientes } from '../services/clientesService';\nimport { subscribeCentros } from '../services/centrosService';\nimport { subscribeTecnicos } from '../services/empresaService';\nimport { subscribeEmpresas, subscribeTrabajos, db, type Albaran, type Cliente, type Centro, type Equipo, type Tecnico, type Empresa, type TrabajoConfig, updateParte } from '../../recursos-compartidos/firebase/firebase';"
    );
});

// 2. Presupuestos.tsx
updateFile('Presupuestos.tsx', content => {
  return content
    .replace(
      "import { subscribePresupuestos, addPresupuesto, updatePresupuesto, deletePresupuesto, subscribeClientes, subscribeArticulos, subscribeCentros, subscribeImpuestos, subscribeEmpresas } from '../../recursos-compartidos/firebase/firebase';",
      "import { subscribePresupuestos, createPresupuesto as addPresupuesto, updatePresupuesto, deletePresupuesto } from '../services/facturacionService';\nimport { subscribeClientes } from '../services/clientesService';\nimport { subscribeCentros } from '../services/centrosService';\nimport { subscribeArticulos } from '../services/catalogoService';\nimport { subscribeImpuestos } from '../services/empresaService';\nimport { subscribeEmpresas } from '../../recursos-compartidos/firebase/firebase';"
    );
});

// 3. Certificados.tsx
updateFile('Certificados.tsx', content => {
  return content
    .replace(
      "import { db, subscribeCertificados, deleteCertificado, addCertificado } from '../../recursos-compartidos/firebase/firebase';",
      "import { subscribeCertificados, deleteCertificado, createCertificado as addCertificado } from '../services/facturacionService';\nimport { db } from '../../recursos-compartidos/firebase/firebase';"
    );
});

// 4. Articulos.tsx
updateFile('Articulos.tsx', content => {
  return content
    .replace(
      "  subscribeArticulos, \n  saveArticulo, \n  deleteArticulo, \n  getArticulos,\n  subscribeSistemasCategorias, // Changed from subscribeFamilias\n} from '../../recursos-compartidos/firebase/firebase';",
      "  subscribeSistemasCategorias, getArticulos\n} from '../../recursos-compartidos/firebase/firebase';\nimport { subscribeArticulos, saveArticulo, deleteArticulo } from '../services/catalogoService';"
    );
});

// 5. GestionEmpresa.tsx
updateFile('GestionEmpresa.tsx', content => {
  return content
    .replace(
      "import { subscribeTecnicos, saveTecnico, deleteTecnico, subscribeImpuestos, saveImpuestoConfig } from '../../recursos-compartidos/firebase/firebase';",
      "import { subscribeTecnicos, saveTecnico, deleteTecnico, subscribeImpuestos, saveImpuestoConfig } from '../services/empresaService';"
    );
});

// 6. ConfiguracionEmpresa.tsx
updateFile('ConfiguracionEmpresa.tsx', content => {
  return content
    .replace(
      "import { subscribeTecnicos, saveTecnico, deleteTecnico, subscribeImpuestos, saveImpuestoConfig } from '../../recursos-compartidos/firebase/firebase';",
      "import { subscribeTecnicos, saveTecnico, deleteTecnico, subscribeImpuestos, saveImpuestoConfig } from '../services/empresaService';"
    );
});

console.log('✅ oficina services wiring complete!');
