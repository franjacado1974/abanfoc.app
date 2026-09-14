const fs = require('fs');
const content = fs.readFileSync('src/RevisionChecklist.tsx', 'utf-8');
const lines = content.split('\n');

const startList = lines.findIndex(l => l.includes('filteredEqs.map((eq, i) => {'));
const endList = lines.findIndex((l, idx) => idx > startList && l.includes(');') && lines[idx-1] && lines[idx-1].includes('</div>') && lines[idx-2] && lines[idx-2].includes('</div>'));

const replaceStr = `                                                    (() => {
                                                        const sistLower = (sist.tipo || sist.familia || '').toLowerCase();
                                                        const isExtintor = sistLower.includes('extintor');
                                                        const isBie = sistLower.includes('bie');
                                                        const isDeteccion = sistLower.includes('detecci');

                                                        const commonProps = {
                                                            sist,
                                                            filteredEqs,
                                                            equiposInstalados,
                                                            setEquiposInstalados,
                                                            saveEquiposProgress,
                                                            getItemsToUse,
                                                            parte,
                                                            parteId,
                                                            updateParte,
                                                            showToast,
                                                            setEditEquipo,
                                                            handleDeleteEquipo,
                                                            handleCheckChange,
                                                            getCheckStats
                                                        };

                                                        if (isExtintor) return <SistemaExtintores {...commonProps} />;
                                                        if (isBie) return <SistemaBies {...commonProps} />;
                                                        if (isDeteccion) return <SistemaDeteccion {...commonProps} />;
                                                        return <SistemaGenerico {...commonProps} />;
                                                    })()`;

lines.splice(startList, endList - startList + 1, replaceStr);

const finalContent = `import SistemaExtintores from './components/RevisionSistemas/SistemaExtintores';
import SistemaBies from './components/RevisionSistemas/SistemaBies';
import SistemaDeteccion from './components/RevisionSistemas/SistemaDeteccion';
import SistemaGenerico from './components/RevisionSistemas/SistemaGenerico';\n` + lines.join('\n');

fs.writeFileSync('src/RevisionChecklist.tsx', finalContent);
console.log('RevisionChecklist.tsx updated successfully');
