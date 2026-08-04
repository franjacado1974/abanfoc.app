const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/components/RevisionSistemas');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

const badgeSnippet = `</span>
                                                                        {getEquipoSyncStatus && (() => {
                                                                            const status = getEquipoSyncStatus(eq.id);
                                                                            if (status === 'saving') {
                                                                                return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full animate-pulse shadow-xs">🟡 Guardando...</span>;
                                                                            }
                                                                            if (status === 'offline') {
                                                                                return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200/80 px-2 py-0.5 rounded-full shadow-xs">🔴 Sin conexión</span>;
                                                                            }
                                                                            return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full shadow-xs">🟢 Sincronizado</span>;
                                                                        })()}`;

files.forEach(file => {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');

  // 1. Agregar a interface Props
  if (!content.includes('getEquipoSyncStatus?:')) {
    content = content.replace(
      'getCheckStats: (eq: EquipoInstalado) => { ok: number; fail: number; pending: number };',
      'getCheckStats: (eq: EquipoInstalado) => { ok: number; fail: number; pending: number };\n    getEquipoSyncStatus?: (equipoId: string) => string;'
    );
  }

  // 2. Agregar a destructuración del componente
  if (!content.includes('getEquipoSyncStatus\n') && !content.includes('getEquipoSyncStatus,') && !content.includes('getEquipoSyncStatus\r')) {
    content = content.replace(
      'getCheckStats\n}: Props)',
      'getCheckStats,\n    getEquipoSyncStatus\n}: Props)'
    );
    content = content.replace(
      'getCheckStats\r\n}: Props)',
      'getCheckStats,\r\n    getEquipoSyncStatus\r\n}: Props)'
    );
  }

  // 3. Insertar badge de sincronización junto al número/código de equipo
  if (!content.includes('getEquipoSyncStatus(eq.id)')) {
    const codeTag = '</span>';
    const codeTarget = content.indexOf('{eq.codigo || (i + 1).toString().padStart(2, \'0\')}');
    if (codeTarget !== -1) {
      const tagEnd = content.indexOf(codeTag, codeTarget);
      if (tagEnd !== -1) {
        content = content.substring(0, tagEnd) + badgeSnippet + content.substring(tagEnd + codeTag.length);
        console.log('Added sync badge to ' + file);
      }
    }
  }

  fs.writeFileSync(p, content, 'utf8');
});
