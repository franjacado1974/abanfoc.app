const fs = require('fs');
const path = require('path');

const mantenimientosDir = path.join(__dirname, '..', 'src', 'mantenimientos');

function updateFile(relPath, fn) {
  const fullPath = path.join(mantenimientosDir, relPath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const updated = fn(content);
    if (updated !== content) {
      fs.writeFileSync(fullPath, updated, 'utf8');
      console.log(`Updated services in: mantenimientos/${relPath}`);
    }
  } else {
    console.warn(`File not found: ${relPath}`);
  }
}

// 1. Partes.tsx
updateFile('pages/Partes.tsx', content => {
  return content
    .replace(
      "import { subscribePartes, subscribeCentros, subscribeClientes, subscribeTecnicos, deleteParte, db, updateParte } from '../../recursos-compartidos/firebase/firebase';",
      "import { subscribeCentros, subscribeClientes, subscribeTecnicos, db } from '../../recursos-compartidos/firebase/firebase';\nimport { subscribePartes, updateParte, deleteParte } from '../services/partesService';"
    )
    .replace(
      "const { addAlbaran } = await import('../../recursos-compartidos/firebase/firebase');",
      "const { addAlbaran } = await import('../../recursos-compartidos/firebase/firebase');"
    );
});

// 2. RevisionChecklist.tsx
updateFile('pages/RevisionChecklist.tsx', content => {
  return content
    .replace(
      "const { deleteEquipoInstalado } = await import('../../recursos-compartidos/firebase/firebase');",
      "const { deleteEquipoInstalado } = await import('../services/revisionesService');"
    )
    .replace(
      "import { addEquipoInstalado, addAlbaran, updateEquipoInstalado, updateParte as updateParteFirestore, updateCentro, subscribePartes, subscribeCentros, subscribeClientes, subscribeCentroSistemas, subscribeEquiposInstalados, subscribeArticulos, subscribeSistemasCategorias, generateNumeroMantenimiento, uploadFile, type Albaran, type ChecklistItem } from '../../recursos-compartidos/firebase/firebase';",
      "import { addEquipoInstalado, addAlbaran, updateCentro, subscribePartes, subscribeCentros, subscribeClientes, subscribeCentroSistemas, subscribeEquiposInstalados, subscribeArticulos, subscribeSistemasCategorias, generateNumeroMantenimiento, uploadFile, type Albaran, type ChecklistItem } from '../../recursos-compartidos/firebase/firebase';\nimport { getEquiposInstalados, deleteEquipoInstalado, updateEquipoInstalado } from '../services/revisionesService';\nimport { updateParte } from '../services/partesService';"
    );
});

// 3. Planificacion.tsx
updateFile('pages/Planificacion.tsx', content => {
  return content
    .replace(
      "import { addParte, updateParte, subscribePartes } from '../../recursos-compartidos/firebase/firebase';",
      "import { createParte as addParte, updateParte, subscribePartes } from '../services/partesService';"
    );
});

// 4. Revisiones.tsx
updateFile('pages/Revisiones.tsx', content => {
  return content
    .replace(
      "import { \n  subscribeCentros, subscribeEmpresas, \n  subscribeRevisiones, updateRevision, addRevision, deleteRevision,\n  type RevisionItem \n} from '../../recursos-compartidos/firebase/firebase';",
      "import { \n  subscribeCentros, subscribeEmpresas, \n  updateRevision, addRevision, deleteRevision,\n  type RevisionItem \n} from '../../recursos-compartidos/firebase/firebase';\nimport { subscribeRevisiones } from '../services/revisionesService';"
    );
});

// 5. PartesTecnico.tsx
updateFile('components/PartesTecnico.tsx', content => {
  return content
    .replace(
      "import { subscribePartes, subscribeCentroSistemas, subscribeClientes, subscribeCentros, updateParte, getEquiposInstalados } from '../../recursos-compartidos/firebase/firebase';",
      "import { subscribeCentroSistemas, subscribeClientes, subscribeCentros } from '../../recursos-compartidos/firebase/firebase';\nimport { subscribePartes, updateParte } from '../services/partesService';\nimport { getEquiposInstalados } from '../services/revisionesService';"
    );
});

console.log('✅ mantenimientos services wiring complete!');
