const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/components/RevisionSistemas');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

const newBlock = `                                                                  {/* Campos de Anomalías y Observaciones del equipo (Bloque único no duplicado) */}
                                                                   {(() => {
                                                                       const notesItems = getItemsToUse(sist.id).filter((item: ChecklistItem) => {
                                                                           const lbl = (item.label || '').toLowerCase();
                                                                           return lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                                                                       });

                                                                       const rawAnom = eq.anomalias;
                                                                       const noteItemAnom = notesItems.find(i => (i.label || '').toLowerCase().includes('anomal') || (i.label || '').toLowerCase().includes('nota'));
                                                                       const valAnom = (typeof rawAnom === 'string' && rawAnom.trim() !== '') 
                                                                           ? rawAnom 
                                                                           : (noteItemAnom && typeof eq[noteItemAnom.key as keyof EquipoInstalado] === 'string' ? (eq[noteItemAnom.key as keyof EquipoInstalado] as string) : '');

                                                                       const rawObs = (eq as any).observaciones;
                                                                       const noteItemObs = notesItems.find(i => (i.label || '').toLowerCase().includes('observacion'));
                                                                       const valObs = (typeof rawObs === 'string' && rawObs.trim() !== '') 
                                                                           ? rawObs 
                                                                           : (noteItemObs && typeof eq[noteItemObs.key as keyof EquipoInstalado] === 'string' ? (eq[noteItemObs.key as keyof EquipoInstalado] as string) : '');

                                                                       const esNoEncontrado = typeof valAnom === 'string' && valAnom.includes('no localizarse');
                                                                       const isExtintor = (sist.tipo || sist.familia || '').toLowerCase().includes('extintor');
                                                                       const isBie = (sist.tipo || sist.familia || '').toLowerCase().includes('bie') || (sist.tipo || sist.familia || '').toLowerCase().includes('boca');
                                                                       const isCaseta = (sist.tipo || sist.familia || '').toLowerCase().includes('caseta');
                                                                       
                                                                       const esAvisoAutoMsg = typeof valAnom === 'string' && (
                                                                           (isExtintor && (valAnom.includes('Extintor caducado') || valAnom.includes('Extintor necesita retimbre') || valAnom.includes('Se aproxima caducidad o retimbrado'))) ||
                                                                           (isBie && (valAnom.includes('Equipo caducado') || valAnom.includes('Se necesita realizar prueba'))) ||
                                                                           (isCaseta && (valAnom.includes('Manguera 70 mm. caducada') || valAnom.includes('Manguera 70 mm. necesita prueba') || valAnom.includes('Manguera 45 mm. caducada') || valAnom.includes('Manguera 45 mm. necesita prueba')))
                                                                       );
                                                                       
                                                                       const isErrorNotas = esNoEncontrado || algunCheckRojo || esAvisoAutoMsg;
                                                                       const tieneAnomalia = (typeof valAnom === 'string' && valAnom.trim() !== '') || isErrorNotas;
                                                                       const tieneObservacion = typeof valObs === 'string' && valObs.trim() !== '';

                                                                       const handleAnomaliaChange = (newVal: string) => {
                                                                           handleCheckChange(eq.id, 'anomalias', newVal);
                                                                           if (noteItemAnom) {
                                                                               handleCheckChange(eq.id, noteItemAnom.key, newVal);
                                                                           }
                                                                       };

                                                                       const handleObservacionesChange = (newVal: string) => {
                                                                           handleCheckChange(eq.id, 'observaciones', newVal);
                                                                           if (noteItemObs) {
                                                                               handleCheckChange(eq.id, noteItemObs.key, newVal);
                                                                           }
                                                                       };

                                                                       return (
                                                                           <div key="single_notes_block" className="px-4 pb-3 mt-4 space-y-3">
                                                                               <div>
                                                                                   <label className={\`text-xs font-semibold mb-1 block \${tieneAnomalia ? 'text-red-700 font-bold' : 'text-slate-600'}\`}>Anomalías del equipo:</label>
                                                                                   <textarea
                                                                                       value={typeof valAnom === 'string' ? valAnom : ''}
                                                                                       onChange={(e) => handleAnomaliaChange(e.target.value)}
                                                                                       className={\`w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 resize-y min-h-[70px] \${tieneAnomalia ? 'bg-red-50 border-2 border-red-400 text-red-800 font-bold focus:border-red-500 focus:ring-red-500/20' : 'bg-white border border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}\`}
                                                                                       rows={3}
                                                                                       placeholder="Escribe aquí las anomalías..."
                                                                                   />
                                                                               </div>
                                                                               <div>
                                                                                   <label className={\`text-xs font-semibold mb-1 block \${tieneObservacion ? 'text-blue-700 font-bold' : 'text-slate-600'}\`}>Observaciones del equipo:</label>
                                                                                   <textarea
                                                                                       value={typeof valObs === 'string' ? valObs : ''}
                                                                                       onChange={(e) => handleObservacionesChange(e.target.value)}
                                                                                       className={\`w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 resize-y min-h-[60px] \${tieneObservacion ? 'bg-blue-50/70 border-2 border-blue-400 text-blue-900 font-bold focus:border-blue-500 focus:ring-blue-500/20' : 'bg-white border border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}\`}
                                                                                       rows={2}
                                                                                       placeholder="Escribe aquí observaciones adicionales..."
                                                                                   />
                                                                               </div>
                                                                           </div>
                                                                       );
                                                                   })()}`;

files.forEach(file => {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');
  
  // 1. Reemplazar bloque de notas si tiene la versión antigua
  if (content.includes('Observaciones y anomalías del equipo:')) {
    const startIdx = content.indexOf('{/* Campo notas debajo del grid');
    const endIdx = content.indexOf('{/* Galería de fotos debajo');
    if (startIdx !== -1 && endIdx > startIdx) {
      content = content.substring(0, startIdx) + newBlock + '\n\n                                                                  ' + content.substring(endIdx);
      console.log('Updated notes block in ' + file);
    }
  }

  // 2. Eliminar el botón "Revisado con anomalía"
  const target = 'Revisado con anomalía';
  let idx = content.indexOf(target);
  while (idx !== -1) {
    const btnStart = content.lastIndexOf('<button', idx);
    const btnEnd = content.indexOf('</button>', idx) + '</button>'.length;
    if (btnStart !== -1 && btnEnd > btnStart) {
      content = content.substring(0, btnStart) + content.substring(btnEnd);
      console.log('Removed button from ' + file);
    } else {
      break;
    }
    idx = content.indexOf(target);
  }

  fs.writeFileSync(p, content, 'utf8');
});
