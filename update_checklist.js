import fs from 'fs';

const filePath = 'C:/Users/canci/OneDrive/Documentos/ABANFOC SERVIDOR/OneDrive/Cosas de Francis/SALAMANDRA/Versiones/V.03.07.26.AA/src/RevisionChecklist.tsx';

let content = fs.readFileSync(filePath, 'utf8');

// The marker where we insert our Casetas logic
const marker = '// Si es un check booleano y tenemos el label, auto-gestionar anomalías';

const casetasLogic = `                // Lógica de Casetas con dotación
                const isCasetas = (sistema?.tipo || sistema?.familia || '').toLowerCase().includes('caseta') || (sistema?.tipo || sistema?.familia || '').toLowerCase().includes('dotacion');
                if (isCasetas) {
                    const itemsToUse = checklistItemsPorSistema[eq.sistemaId] || [];
                    const item70Fab = itemsToUse.find(i => {
                        const lbl = (i.label||'').toLowerCase();
                        return lbl.includes('tramo 70') || (lbl.includes('70 mm') && lbl.includes('fabricaci'));
                    });
                    const item70PH = itemsToUse.find(i => {
                        const lbl = (i.label||'').toLowerCase();
                        return lbl.includes('70 mm') && (lbl.includes('p.h.') || lbl.includes('prueba') || lbl.includes('ultima'));
                    });
                    const item45Fab = itemsToUse.find(i => {
                        const lbl = (i.label||'').toLowerCase();
                        return lbl.includes('tramo 45') || (lbl.includes('45 mm') && lbl.includes('fabricaci'));
                    });
                    const item45PH = itemsToUse.find(i => {
                        const lbl = (i.label||'').toLowerCase();
                        return lbl.includes('45 mm') && (lbl.includes('p.h.') || lbl.includes('prueba') || lbl.includes('ultima'));
                    });
                    const anoItem = itemsToUse.find(i => (i.label||'').toLowerCase().includes('anomal') || (i.label||'').toLowerCase().includes('observacion') || (i.label||'').toLowerCase().includes('notas'));
                    const targetKey = anoItem ? anoItem.key : 'anomalias';

                    if (item70Fab && checkKey === item70Fab.key) {
                        updated.fechaFabricacion70 = value ? String(value) : '';
                    }
                    if (item70PH && checkKey === item70PH.key) {
                        updated.fechaPH70 = value ? String(value) : '';
                    }
                    if (item45Fab && checkKey === item45Fab.key) {
                        updated.fechaFabricacion45 = value ? String(value) : '';
                    }
                    if (item45PH && checkKey === item45PH.key) {
                        updated.fechaPH45 = value ? String(value) : '';
                    }

                    if (targetKey) {
                        const val70Fab = item70Fab ? updated[item70Fab.key as keyof EquipoInstalado] as string : null;
                        const val70PH = item70PH ? updated[item70PH.key as keyof EquipoInstalado] as string : null;
                        const val45Fab = item45Fab ? updated[item45Fab.key as keyof EquipoInstalado] as string : null;
                        const val45PH = item45PH ? updated[item45PH.key as keyof EquipoInstalado] as string : null;

                        let msg70Fab = "";
                        let msg70PH = "";
                        let msg45Fab = "";
                        let msg45PH = "";

                        const today = new Date();

                        // 70mm Fab
                        if (val70Fab) {
                            const date70Fab = new Date(val70Fab);
                            if (!isNaN(date70Fab.getTime())) {
                                let diff = today.getFullYear() - date70Fab.getFullYear();
                                if (today.getMonth() < date70Fab.getMonth() || (today.getMonth() === date70Fab.getMonth() && today.getDate() < date70Fab.getDate())) {
                                    diff--;
                                }
                                if (diff >= 20) {
                                    msg70Fab = "Manguera 70 mm. caducada + de 20 años se debe sustituir según normativa.";
                                }
                            }
                        }
                        // 70mm PH
                        if (val70PH) {
                            const date70PH = new Date(val70PH);
                            if (!isNaN(date70PH.getTime())) {
                                let diff = today.getFullYear() - date70PH.getFullYear();
                                if (today.getMonth() < date70PH.getMonth() || (today.getMonth() === date70PH.getMonth() && today.getDate() < date70PH.getDate())) {
                                    diff--;
                                }
                                if (diff >= 5) {
                                    msg70PH = "Manguera 70 mm. necesita prueba hidráulica (última hace + de 5 años).";
                                }
                            }
                        }
                        // 45mm Fab
                        if (val45Fab) {
                            const date45Fab = new Date(val45Fab);
                            if (!isNaN(date45Fab.getTime())) {
                                let diff = today.getFullYear() - date45Fab.getFullYear();
                                if (today.getMonth() < date45Fab.getMonth() || (today.getMonth() === date45Fab.getMonth() && today.getDate() < date45Fab.getDate())) {
                                    diff--;
                                }
                                if (diff >= 20) {
                                    msg45Fab = "Manguera 45 mm. caducada + de 20 años se debe sustituir según normativa.";
                                }
                            }
                        }
                        // 45mm PH
                        if (val45PH) {
                            const date45PH = new Date(val45PH);
                            if (!isNaN(date45PH.getTime())) {
                                let diff = today.getFullYear() - date45PH.getFullYear();
                                if (today.getMonth() < date45PH.getMonth() || (today.getMonth() === date45PH.getMonth() && today.getDate() < date45PH.getDate())) {
                                    diff--;
                                }
                                if (diff >= 5) {
                                    msg45PH = "Manguera 45 mm. necesita prueba hidráulica (última hace + de 5 años).";
                                }
                            }
                        }

                        let currentAno = (updated[targetKey as keyof EquipoInstalado] as string) || "";
                        const labelsToRemove = [
                            "Manguera 70 mm. caducada + de 20 años se debe sustituir según normativa.",
                            "Manguera 70 mm. necesita prueba hidráulica (última hace + de 5 años).",
                            "Manguera 45 mm. caducada + de 20 años se debe sustituir según normativa.",
                            "Manguera 45 mm. necesita prueba hidráulica (última hace + de 5 años)."
                        ];
                        labelsToRemove.forEach(m => { currentAno = currentAno.replace(m, '').trim(); });
                        currentAno = currentAno.replace(/\\n\\n+/g, '\\n').trim();

                        if (msg70Fab) {
                            currentAno = (currentAno + (currentAno ? "\\n" : "") + msg70Fab).trim();
                        }
                        if (msg70PH) {
                            currentAno = (currentAno + (currentAno ? "\\n" : "") + msg70PH).trim();
                        }
                        if (msg45Fab) {
                            currentAno = (currentAno + (currentAno ? "\\n" : "") + msg45Fab).trim();
                        }
                        if (msg45PH) {
                            currentAno = (currentAno + (currentAno ? "\\n" : "") + msg45PH).trim();
                        }

                        (updated as any)[targetKey] = currentAno;
                    }
                }

                `;

if (content.includes(marker)) {
    content = content.replace(marker, casetasLogic + marker);
    console.log("Successfully inserted Casetas logic into RevisionChecklist.tsx!");
} else {
    console.error("Marker not found in RevisionChecklist.tsx!");
}

// Also import SistemaCasetas and map it (since restore wiped it)
const importMarker = "import SistemaGenerico from './components/RevisionSistemas/SistemaGenerico';";
const importReplacement = `import SistemaCasetas from './components/RevisionSistemas/SistemaCasetas';
import SistemaGenerico from './components/RevisionSistemas/SistemaGenerico';`;

if (content.includes(importMarker) && !content.includes("SistemaCasetas")) {
    content = content.replace(importMarker, importReplacement);
    console.log("Imported SistemaCasetas!");
}

const mappingMarker = "if (isHidrantes) return <SistemaHidrantes {...commonProps} />;";
const mappingReplacement = `if (isHidrantes) return <SistemaHidrantes {...commonProps} />;
                                                         if (isCasetas) return <SistemaCasetas {...commonProps} />;`;

if (content.includes(mappingMarker) && !content.includes("isCasetas")) {
    content = content.replace(mappingMarker, mappingReplacement);
    // and define isCasetas
    content = content.replace("const isHidrantes = sistLower.includes('hidrante');", "const isHidrantes = sistLower.includes('hidrante');\n                                                        const isCasetas = sistLower.includes('caseta') || sistLower.includes('dotacion');");
    console.log("Mapped isCasetas to SistemaCasetas!");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated RevisionChecklist.tsx!");
