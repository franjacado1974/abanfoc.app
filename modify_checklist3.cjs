const fs = require('fs');
let content = fs.readFileSync('src/RevisionChecklist.tsx', 'utf-8');

const startStr = 'filteredEqs.map((eq, i) => {';
const endStr = '})\n                                                );';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.log('Failed to find bounds', startIndex, endIndex);
    process.exit(1);
}

const replaceStr = `(() => {
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
                                                    })()\n                                                );`;

content = content.slice(0, startIndex) + replaceStr + content.slice(endIndex + endStr.length);

const finalContent = `import SistemaExtintores from './components/RevisionSistemas/SistemaExtintores';
import SistemaBies from './components/RevisionSistemas/SistemaBies';
import SistemaDeteccion from './components/RevisionSistemas/SistemaDeteccion';
import SistemaGenerico from './components/RevisionSistemas/SistemaGenerico';\n` + content;

fs.writeFileSync('src/RevisionChecklist.tsx', finalContent);
console.log('Done patching properly!');
