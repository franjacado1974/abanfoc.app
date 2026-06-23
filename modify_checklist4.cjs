const fs = require('fs');
let content = fs.readFileSync('src/RevisionChecklist.tsx', 'utf-8');

const startStr = 'filteredEqs.map((eq, i) => {';
const startIndex = content.indexOf(startStr);

const endRegex = /\}\)[\r\n\s]+\);/;
const match = content.substring(startIndex).match(endRegex);

if (!match) {
    console.log('Failed to find end index');
    process.exit(1);
}

const endIndex = startIndex + match.index;
const endLength = match[0].length;

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

content = content.slice(0, startIndex) + replaceStr + content.slice(endIndex + endLength);

const finalContent = `import SistemaExtintores from './components/RevisionSistemas/SistemaExtintores';
import SistemaBies from './components/RevisionSistemas/SistemaBies';
import SistemaDeteccion from './components/RevisionSistemas/SistemaDeteccion';
import SistemaGenerico from './components/RevisionSistemas/SistemaGenerico';\n` + content;

fs.writeFileSync('src/RevisionChecklist.tsx', finalContent);
console.log('Successfully patched!');
