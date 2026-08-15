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

  // 1. DashboardTecnico.tsx
  if (relPath === 'mantenimientos/pages/DashboardTecnico.tsx') {
    updated = updated
      .replace(/import\s+Albaranes\s+from\s+['"].*?\/oficina\/pages\/Albaranes['"];?\r?\n?/g, '')
      .replace(/import\s+Clientes\s+from\s+['"].*?\/oficina\/pages\/Clientes['"];?\r?\n?/g, '')
      .replace(/import\s+Centros\s+from\s+['"].*?\/oficina\/pages\/Centros['"];?\r?\n?/g, '')
      .replace(/import\s+Catalogo\s+from\s+['"].*?\/oficina\/pages\/Catalogo['"];?\r?\n?/g, '')
      .replace(/import\s+Buzon\s+from\s+['"].*?\/oficina\/pages\/Buzon['"];?\r?\n?/g, '');
  }

  // 2. RevisionChecklist.tsx
  if (relPath === 'mantenimientos/pages/RevisionChecklist.tsx') {
    updated = updated
      .replace(/from\s+['"].*?\/oficina\/pages\/Sistemas['"]/g, "from '../../recursos-compartidos/services/sistemasUtils'")
      .replace(/from\s+['"].*?\/oficina\/pages\/Centros['"]/g, "from '../../recursos-compartidos/types/models'");
  }

  // 3. PartesTecnico.tsx
  if (relPath === 'mantenimientos/components/PartesTecnico.tsx') {
    updated = updated
      .replace(/from\s+['"].*?\/oficina\/pages\/Centros['"]/g, "from '../../recursos-compartidos/types/models'");
  }

  // 4. RevisionSistemas/*.tsx
  if (relPath.startsWith('mantenimientos/components/RevisionSistemas/')) {
    updated = updated
      .replace(/from\s+['"].*?\/oficina\/pages\/Centros['"]/g, "from '../../../recursos-compartidos/types/models'");
  }

  // 5. EquipoFormulario.tsx
  if (relPath === 'recursos-compartidos/components/EquipoFormulario.tsx') {
    updated = updated
      .replace(/from\s+['"].*?\/oficina\/pages\/Centros['"]/g, "from '../types/models'");
  }

  // 6. PeriodicidadPage.tsx
  if (relPath === 'oficina/pages/PeriodicidadPage.tsx') {
    updated = updated
      .replace(/import\s+type\s+{\s*Centro\s*}\s+from\s+['"]\.\/Centros['"]/g, "import type { Centro } from '../../recursos-compartidos/types/models'");
  }

  // 7. General replacement of imports pointing to oficina/pages/Centros for types
  updated = updated
    .replace(/from\s+['"]\.\.\/\.\.\/oficina\/pages\/Centros['"]/g, "from '../../recursos-compartidos/types/models'")
    .replace(/from\s+['"]\.\.\/\.\.\/\.\.\/oficina\/pages\/Centros['"]/g, "from '../../../recursos-compartidos/types/models'");

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    modifiedCount++;
    console.log(`Updated: ${relPath}`);
  }
});

console.log(`✅ Phase 3C-1 execution completed across ${modifiedCount} files.`);
