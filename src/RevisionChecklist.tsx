import SistemaExtintores from './components/RevisionSistemas/SistemaExtintores';
import SistemaBies from './components/RevisionSistemas/SistemaBies';
import SistemaDeteccion from './components/RevisionSistemas/SistemaDeteccion';
import SistemaGenerico from './components/RevisionSistemas/SistemaGenerico';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Layers, ChevronDown, ChevronUp, Plus, X, CheckCircle2, AlertTriangle, PenLine, RotateCcw, CheckCheck, Lock } from 'lucide-react';
import { addEquipoInstalado, addAlbaran, updateEquipoInstalado, updateParte as updateParteFirestore, subscribePartes, subscribeCentros, subscribeClientes, subscribeCentroSistemas, subscribeEquiposInstalados, subscribeArticulos, subscribeSistemasCategorias, generateNumeroMantenimiento, type Albaran, type ChecklistItem } from './firebase';
import { subscribePlantillas, subscribeItemsDePlantilla, type ItemPlantilla } from './plantillas';
import type { Centro, Parte, Cliente, CentroSistema, EquipoInstalado } from './Centros';
import ConfirmationModal from './ConfirmationModal';
import { getIconForSistema } from './Sistemas';
import EquipoFormulario from './components/EquipoFormulario';

export default function RevisionChecklist() {
    const navigate = useNavigate();
    const location = useLocation();
    const { centroId, parteId } = location.state || {};

    const [centro, setCentro] = useState<Centro | null>(null);
    const [parte, setParte] = useState<Parte | null>(null);
    const [sistemasDelCentro, setSistemasDelCentro] = useState<CentroSistema[]>([]);
    const [equiposInstalados, setEquiposInstalados] = useState<EquipoInstalado[]>([]);
    const [, setEquiposCatalogo] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_sistemas_equipos') || '[]'));
    const [categoriasSistema, setCategoriasSistema] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_sistemas_categorias') || '[]'));
    const [loading, setLoading] = useState(true);
    const [clientes, setClientes] = useState<Cliente[]>(() => JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'));
    const [openSistemas, setOpenSistemas] = useState<Record<string, boolean>>({});
    const [tecnicos] = useState<{ id: string; nombre: string; apellidos: string }[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');
        } catch { return []; }
    });
    // Orden personalizado de sistemas (guardado en localStorage)
    const [sistemaOrden, setSistemaOrden] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('firecheck_revision_sistema_orden');
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });
    // Checklist dinámico desde Firestore (usando plantillas) - mapa por sistemaId
    const [checklistItemsPorSistema, setChecklistItemsPorSistema] = useState<Record<string, ChecklistItem[]>>({});
    const [plantillas, setPlantillas] = useState<any[]>([]);

    // Cargar todas las plantillas
    useEffect(() => {
        const unsub = subscribePlantillas((lista) => {
            setPlantillas(lista);
        });
        return () => unsub();
    }, []);

    // Cuando cambian los sistemas del centro o las plantillas, cargar los items de cada sistema
    useEffect(() => {
        if (sistemasDelCentro.length === 0 || plantillas.length === 0 || categoriasSistema.length === 0) return;

        console.log("=== RevisionChecklist: loading templates ===");
        console.log("sistemasDelCentro:", sistemasDelCentro);
        console.log("plantillas:", plantillas.map(p => p.nombre));
        console.log("categoriasSistema:", categoriasSistema.map(c => c.nombre));

        const normalizarNombre = (nombre: string) =>
            nombre
                .toLowerCase()
                .trim()
                .replace(/^sistema\s+/i, '')
                .replace(/^check\s*list\s+/i, '')
                .replace(/^checklist\s+/i, '')
                .replace(/\s+/g, ' ')
                .replace(/[áàäâ]/g, 'a')
                .replace(/[éèëê]/g, 'e')
                .replace(/[íìïî]/g, 'i')
                .replace(/[óòöô]/g, 'o')
                .replace(/[úùüû]/g, 'u');

        const unsubs: (() => void)[] = [];

        sistemasDelCentro.forEach(sist => {
            // Obtener el nombre del sistema desde categoriasSistema
            const sistemaCat = categoriasSistema.find(c => {
                const nombreSist = (sist.tipo || sist.familia || '').toLowerCase().trim();
                const nombreCat = (c.nombre || '').toLowerCase().trim();
                return nombreCat === nombreSist || nombreCat.includes(nombreSist) || nombreSist.includes(nombreCat);
            });
            const sistemaNombre = sistemaCat?.nombre || sist.tipo || sist.familia || '';
            if (!sistemaNombre) {
                console.warn(`⚠️ Sistema sin nombre para sist.id: ${sist.id}`);
                return;
            }

            const nombreSistemaNorm = normalizarNombre(sistemaNombre);

            // Buscar la plantilla que coincida con el nombre del sistema con orden de prioridad
            // 1. Coincidencia exacta
            let plantilla = plantillas.find(p => {
                const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                return nombrePlantillaNorm === nombreSistemaNorm;
            });

            // 2. Coincidencia por inclusión (si una contiene a la otra)
            if (!plantilla) {
                plantilla = plantillas.find(p => {
                    const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                    return nombrePlantillaNorm.includes(nombreSistemaNorm) || nombreSistemaNorm.includes(nombrePlantillaNorm);
                });
            }

            // 3. Coincidencia por palabras compartidas
            if (!plantilla) {
                plantilla = plantillas.find(p => {
                    const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                    const palabrasSistema = nombreSistemaNorm.split(' ').filter(w => w.length > 3);
                    const palabrasPlantilla = nombrePlantillaNorm.split(' ').filter(w => w.length > 3);
                    return palabrasSistema.some(ps => palabrasPlantilla.some(pp => ps === pp || pp.includes(ps) || ps.includes(pp)));
                });
            }

            if (!plantilla) {
                console.warn(`❌ No se encontró plantilla para sistema: "${sistemaNombre}" (sist.id: ${sist.id})`);
                return;
            }

            console.log(`✅ Coincidencia: sistema "${sistemaNombre}" (sist.id: ${sist.id}) -> Plantilla "${plantilla.nombre}" (plantilla.id: ${plantilla.id})`);

            const unsub = subscribeItemsDePlantilla(plantilla.id, (items: ItemPlantilla[]) => {
                console.log(`📋 Cargados ${items.length} items de plantilla "${plantilla.nombre}" para sist.id: ${sist.id}`);
                const checklistItems: ChecklistItem[] = items.map(item => ({
                    id: item.id,
                    key: item.key,
                    label: item.label,
                    tipoRespuesta: item.tipoRespuesta,
                    opciones: item.opciones || [],
                    filasInicio: item.filasInicio,
                    sistemaId: sist.id,
                    sistemaNombre: sistemaNombre,
                    orden: item.orden,
                    horizontal: item.horizontal === true,
                }));
                setChecklistItemsPorSistema(prev => {
                    console.log(`💾 Actualizando checklistItemsPorSistema para ${sist.id}:`, checklistItems);
                    return { ...prev, [sist.id]: checklistItems };
                });
            });
            unsubs.push(unsub);
        });

        return () => unsubs.forEach(u => u());
    }, [sistemasDelCentro, plantillas, categoriasSistema]);

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [equipoIdToDelete, setEquipoIdToDelete] = useState<string | null>(null);

    // Modal Revisar todo
    const [revisarTodoConfirm, setRevisarTodoConfirm] = useState<{ isOpen: boolean; sistemaId: string | null }>({ isOpen: false, sistemaId: null });

    // Estado para modal de edición de equipo
    const [editEquipo, setEditEquipo] = useState<string | null>(null);

    // Estado para modal de añadir equipo
    const [addEquipo, setAddEquipo] = useState<{ isOpen: boolean; sistemaId: string | null; codigo: string; nombre: string; ubicacion: string; placa: string; fechaFabricacion: string; ultimoRetimbre: string }>({
        isOpen: false, sistemaId: null, codigo: '', nombre: '', ubicacion: '', placa: '', fechaFabricacion: '', ultimoRetimbre: ''
    });

    // Estados para pre-cierre y firmas
    const [showPreCierreModal, setShowPreCierreModal] = useState(false);
    const [showFirmasModal, setShowFirmasModal] = useState(false);
    const canvasClienteRef = useRef<HTMLCanvasElement>(null);
    const canvasTecnicoRef = useRef<HTMLCanvasElement>(null);
    const [drawingCliente, setDrawingCliente] = useState(false);
    const [drawingTecnico, setDrawingTecnico] = useState(false);
    const [firmaClienteOk, setFirmaClienteOk] = useState(false);
    const [firmaTecnicoOk, setFirmaTecnicoOk] = useState(false);
    const [nombreClienteFirma, setNombreClienteFirma] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Función para mostrar el toast temporalmente
    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // ── Si el parte está Cerrado, redirigir ───────────────────────────
    useEffect(() => {
        if (parte?.estado === 'Cerrado') {
            alert('Este parte está cerrado y no puede ser modificado.');
            navigate(-1);
        }
    }, [parte?.estado, navigate]);

    // ── Carga inicial desde Firestore ──────────────────────────────────────────
    useEffect(() => {
        if (!centroId || !parteId) {
            alert('Faltan datos para iniciar la revisión.');
            navigate(-1);
            return;
        }

    // 1. Cargar clientes
    const unsubClientes = subscribeClientes((items) => {
            setClientes(items as Cliente[]);
            localStorage.setItem('firecheck_db_clientes', JSON.stringify(items));
        });

        // 2. Cargar centros y encontrar el centro actual
        const unsubCentros = subscribeCentros((items) => {
            const found = items.find((c: any) => c.id === centroId || c._docId === centroId) as Centro | undefined;
            if (found) setCentro(found);
            localStorage.setItem('firecheck_db_centros', JSON.stringify(items));
        });

        // 3. Cargar partes y encontrar el parte actual
        const unsubPartes = subscribePartes((items) => {
            const found = items.find((p: any) => p.id === parteId || p._docId === parteId) as Parte | undefined;
            if (found) {
                setParte(found);
                // Ya NO cambiamos automáticamente a "Abierto" al entrar
                // El estado solo cambiará cuando se pulse un botón "Revisado"
            }
            localStorage.setItem('firecheck_db_partes', JSON.stringify(items));
            setLoading(false);
        });

        // 4. Cargar sistemas del centro
        const unsubSistemas = subscribeCentroSistemas(centroId, (items: CentroSistema[]) => {
            setSistemasDelCentro(items);
            // Inicializar acordeones cerrados
            setOpenSistemas(prev => {
                const next = { ...prev };
                items.forEach(s => { if (!(s.id in next)) next[s.id] = false; });
                return next;
            });
            localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(items));
        });

        // 5. Cargar categorías de sistemas (catálogo) para el autocompletado
        const unsubSst = subscribeSistemasCategorias((items) => {
            setCategoriasSistema(items);
            localStorage.setItem('firecheck_db_sistemas_categorias', JSON.stringify(items));
        });

        // 6. Cargar artículos (catálogo de equipos) para el autocompletado
        const unsubArt = subscribeArticulos((items) => {
            const revisables = items.filter(a => a.revisable === true);
            setEquiposCatalogo(revisables);
            localStorage.setItem('firecheck_db_sistemas_equipos', JSON.stringify(revisables));
        });

        return () => {
            unsubClientes(); unsubCentros(); unsubPartes(); unsubSistemas();
            unsubSst(); unsubArt();
        };
    }, [centroId, parteId, navigate]);

    // Generar numeroMantenimiento si no existe
    useEffect(() => {
        if (parte && !parte.numeroMantenimiento) {
            generateNumeroMantenimiento().then(num => {
                handleParteChange({ numeroMantenimiento: num });
            }).catch(console.error);
        }
    }, [parte?.id, parte?.numeroMantenimiento]); // eslint-disable-line react-hooks/exhaustive-deps

    // 5. Cargar equipos de cada sistema en tiempo real
    useEffect(() => {
        if (!centroId || sistemasDelCentro.length === 0) return;

        const unsubs = sistemasDelCentro.map(sist =>
            subscribeEquiposInstalados(centroId, sist.id, (items: EquipoInstalado[]) => {
                // Mantener todos los datos tal como están en Firestore (centro y parte comparten los mismos equipos)
                // NO resetear ningún campo: los datos introducidos en el centro deben verse en el parte
                setEquiposInstalados(prev => {
                    const otros = prev.filter(e => e.sistemaId !== sist.id);
                    return [...otros, ...items];
                });
            })
        );
        return () => unsubs.forEach(u => u());
    }, [centroId, sistemasDelCentro.length, parte?.estado]); // eslint-disable-line react-hooks/exhaustive-deps

    const saveEquiposProgress = async (currentEquipos: EquipoInstalado[] = equiposInstalados) => {
        const allEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        const equiposOtrosCentros = allEquipos.filter((eq: EquipoInstalado) => eq.centroId !== centroId);
        const updatedAllEquipos = [...equiposOtrosCentros, ...currentEquipos];
        localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(updatedAllEquipos));
        // Sincronizar con Firestore
        for (const eq of currentEquipos) {
            try { await updateEquipoInstalado(eq.id, eq as any); } catch (err) { console.error('Error sincronizando equipo en Firestore:', err); }
        }
        return updatedAllEquipos;
    };

    const updateParte = (changes: Partial<Parte>) => {
        if (!parteId) return;

        const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
        const updatedPartes = storedPartes.map((p: Parte) =>
            p.id === parteId ? { ...p, ...changes } : p
        );
        const updatedParte = updatedPartes.find((p: Parte) => p.id === parteId);

        localStorage.setItem('firecheck_db_partes', JSON.stringify(updatedPartes));
        if (updatedParte) setParte(updatedParte);
    };

    const handleParteChange = async (changes: Partial<Parte>) => {
        updateParte(changes);
        try {
            const docId = (parte as any)?._docId || parte?.id;
            if (docId) {
                await updateParteFirestore(docId, changes);
            }
        } catch (err) {
            console.error('Error updating parte in Firestore:', err);
        }
    };

    const handleCheckChange = (equipoId: string, checkKey: string, value: boolean | string | number | string[], checkLabel?: string) => {
        setEquiposInstalados(prevEquipos => {
            const updatedEquipos = prevEquipos.map(eq => {
                if (eq.id !== equipoId) return eq;
                
                // Actualizar el valor del check
                const updated = { ...eq, [checkKey]: value, revisado: true };
                
                // Lógica Extintores (igual que en EquipoFormulario)
                const sistema = sistemasDelCentro.find(s => s.id === eq.sistemaId);
                const isExtintor = (sistema?.tipo || sistema?.familia || '').toLowerCase().includes('extintor');
                if (isExtintor) {
                    const itemsToUse = checklistItemsPorSistema[eq.sistemaId] || [];
                    const fabItem = itemsToUse.find(i => (i.label||'').toLowerCase().includes('fabricaci'));
                    const retItem = itemsToUse.find(i => (i.label||'').toLowerCase().includes('retimbre'));
                    const anoItem = itemsToUse.find(i => (i.label||'').toLowerCase().includes('anomal') || (i.label||'').toLowerCase().includes('observacion'));

                    if (fabItem && checkKey === fabItem.key) {
                        updated.fechaFabricacion = value ? String(value) : '';
                    }
                    if (retItem && checkKey === retItem.key) {
                        updated.ultimoRetimbre = value ? String(value) : '';
                    }

                    if (anoItem && fabItem) {
                        const valFab = updated[fabItem.key as keyof EquipoInstalado] as string;
                        const valRet = retItem ? updated[retItem.key as keyof EquipoInstalado] as string : null;
                        let autoMsg = "";

                        if (valFab) {
                            const today = new Date();
                            const dateFab = new Date(valFab);
                            if (!isNaN(dateFab.getTime())) {
                                const monthsSinceFab = (today.getFullYear() - dateFab.getFullYear()) * 12 + today.getMonth() - dateFab.getMonth();
                                if (monthsSinceFab >= 240) {
                                    autoMsg = "Extintor caducado + 20 años";
                                } else {
                                    let refDate = dateFab;
                                    if (valRet) {
                                        const dr = new Date(valRet);
                                        if (!isNaN(dr.getTime())) refDate = dr;
                                    }
                                    const monthsSinceRef = (today.getFullYear() - refDate.getFullYear()) * 12 + today.getMonth() - refDate.getMonth();
                                    if (monthsSinceRef >= 60) {
                                        autoMsg = "Extintor necesita retimbre";
                                    } else if (monthsSinceFab >= 237 || monthsSinceRef >= 57) {
                                        autoMsg = "Se aproxima caducidad o retimbrado del equipo";
                                    }
                                }
                            }
                        }

                        let currentAno = (updated[anoItem.key as keyof EquipoInstalado] as string) || "";
                        const autoMsgs = ["Extintor caducado + 20 años", "Extintor necesita retimbre", "Se aproxima caducidad o retimbrado del equipo"];
                        autoMsgs.forEach(m => { currentAno = currentAno.replace(m, '').trim(); });
                        if (autoMsg) {
                            currentAno = (currentAno + (currentAno ? "\n" : "") + autoMsg).trim();
                        }
                        (updated as any)[anoItem.key] = currentAno;
                    }
                }

                // Lógica de BIES
                const isBie = (sistema?.tipo || sistema?.familia || '').toLowerCase().includes('bie') || (sistema?.tipo || sistema?.familia || '').toLowerCase().includes('boca');
                if (isBie) {
                    const itemsToUse = checklistItemsPorSistema[eq.sistemaId] || [];
                    const fabItem = itemsToUse.find(i => (i.label||'').toLowerCase().includes('fabricaci'));
                    const hidraulicaItem = itemsToUse.find(i => {
                        const lbl = (i.label||'').toLowerCase();
                        return lbl.includes('hidra') || lbl.includes('prueba');
                    });
                    const anoItem = itemsToUse.find(i => (i.label||'').toLowerCase().includes('anomal') || (i.label||'').toLowerCase().includes('observacion') || (i.label||'').toLowerCase().includes('notas'));

                    if (fabItem && checkKey === fabItem.key) {
                        updated.fechaFabricacion = value ? String(value) : '';
                    }
                    if (hidraulicaItem && checkKey === hidraulicaItem.key) {
                        updated.pruebaHidraulica = value ? String(value) : '';
                    }

                    if (anoItem && (fabItem || hidraulicaItem)) {
                        const valFab = fabItem ? updated[fabItem.key as keyof EquipoInstalado] as string : null;
                        const valHidra = hidraulicaItem ? updated[hidraulicaItem.key as keyof EquipoInstalado] as string : null;
                        let autoMsgCaducado = "";
                        let autoMsgHidra = "";

                        const today = new Date();

                        if (valFab) {
                            const dateFab = new Date(valFab);
                            if (!isNaN(dateFab.getTime())) {
                                let diffYears = today.getFullYear() - dateFab.getFullYear();
                                if (today.getMonth() < dateFab.getMonth() || (today.getMonth() === dateFab.getMonth() && today.getDate() < dateFab.getDate())) {
                                    diffYears--;
                                }
                                if (diffYears >= 20) {
                                    autoMsgCaducado = "Equipo caducado + de 20 años se debe sustituir tramo de manguera según normativa.";
                                }
                            }
                        }

                        if (valHidra) {
                            const dateHidra = new Date(valHidra);
                            if (!isNaN(dateHidra.getTime())) {
                                let diffYears = today.getFullYear() - dateHidra.getFullYear();
                                if (today.getMonth() < dateHidra.getMonth() || (today.getMonth() === dateHidra.getMonth() && today.getDate() < dateHidra.getDate())) {
                                    diffYears--;
                                }
                                if (diffYears >= 5) {
                                    autoMsgHidra = "Se necesita realizar prueba hidráulica obligatoria cada 5 años.";
                                }
                            }
                        }

                        let currentAno = (updated[anoItem.key as keyof EquipoInstalado] as string) || "";
                        const msgCaducado = "Equipo caducado + de 20 años se debe sustituir tramo de manguera según normativa.";
                        const msgHidra = "Se necesita realizar prueba hidráulica obligatoria cada 5 años.";
                        
                        currentAno = currentAno.replace(msgCaducado, '').trim();
                        currentAno = currentAno.replace(msgHidra, '').trim();
                        currentAno = currentAno.replace(/\n\n+/g, '\n').trim();

                        if (autoMsgCaducado) {
                            currentAno = (currentAno + (currentAno ? "\n" : "") + autoMsgCaducado).trim();
                        }
                        if (autoMsgHidra) {
                            currentAno = (currentAno + (currentAno ? "\n" : "") + autoMsgHidra).trim();
                        }
                        (updated as any)[anoItem.key] = currentAno;
                    }
                }

                
                // Si es un check booleano y tenemos el label, auto-gestionar anomalías
                if (typeof value === 'boolean' && checkLabel) {
                    const itemsToUse = checklistItemsPorSistema[eq.sistemaId] || [];
                    const notasItem = itemsToUse.find(item => {
                        const lbl = (item.label || '').toLowerCase();
                        return lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                    });
                    const notasKey = notasItem?.key || null;

                    if (notasKey) {
                        const textoAnomalia = `${checkLabel} mal`;
                        const notasActuales = typeof (updated as any)[notasKey] === 'string' 
                            ? ((updated as any)[notasKey] as string) 
                            : '';
                        
                        if (value === false) {
                            if (!notasActuales.includes(textoAnomalia)) {
                                const nuevoTexto = notasActuales.trim() 
                                    ? notasActuales + ', ' + textoAnomalia 
                                    : textoAnomalia;
                                (updated as any)[notasKey] = nuevoTexto;
                            }
                        } else {
                            const partes = notasActuales.split(', ').filter(p => p.trim() !== textoAnomalia);
                            (updated as any)[notasKey] = partes.join(', ');
                        }
                    }
                }
                
                return updated;
            });

            // Guardar inmediatamente en Firestore el equipo modificado
            const equipoModificado = updatedEquipos.find(eq => eq.id === equipoId);
            if (equipoModificado) {
                updateEquipoInstalado(equipoId, equipoModificado as any).catch(err => 
                    console.error('Error guardando cambio en Firestore:', err)
                );
            }

            return updatedEquipos;
        });
    };

    const handleSaveRevision = () => {
        if (!parteId) return;

        // 1. Verificar que todos los equipos han sido procesados (Revisados o No encontrados)
        const equiposSinRevisar = equiposInstalados.filter(eq => !eq.revisado);
        if (equiposSinRevisar.length > 0) {
            alert(`Atención: Quedan ${equiposSinRevisar.length} equipos sin revisar. Todos los equipos deben marcarse como 'Revisado', 'No encontrado' o ser inspeccionados manualmente antes de finalizar.`);
            return;
        }

        const equiposInvalidos = equiposInstalados.filter((eq) => {
            const itemsDelSistema = checklistItemsPorSistema[eq.sistemaId] || [];
            const algunCheckRojo = itemsDelSistema.some((item) => eq[item.key as keyof EquipoInstalado] === false);

            const tieneAnomalia = itemsDelSistema.some(item => {
                const lbl = (item.label || '').toLowerCase();
                if (lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal')) {
                    const val = eq[item.key as keyof EquipoInstalado];
                    if (typeof val === 'string' && val.trim() !== '') return true;
                }
                return false;
            });
            const textoAnomaliaDirecto = !!eq.anomalias && eq.anomalias.trim() !== '';

            return algunCheckRojo && !tieneAnomalia && !textoAnomaliaDirecto;
        });

        if (equiposInvalidos.length > 0) {
            alert('Hay equipos con checks en rojo. Debes escribir la anomalía obligatoriamente en esos equipos.');
            return;
        }

        // 3. Validar que la "Fecha de revisión" (si existe) coincide con HOY
        const hoy = new Date().toISOString().split('T')[0];
        const equiposFechaInvalida = equiposInstalados.filter(eq => {
            const itemsDelSistema = checklistItemsPorSistema[eq.sistemaId] || [];
            const itemFechaRev = itemsDelSistema.find(item => (item.label || '').toLowerCase().includes('fecha de revisi'));
            if (!itemFechaRev) return false;
            const val = eq[itemFechaRev.key as keyof EquipoInstalado];
            return val !== hoy;
        });

        if (equiposFechaInvalida.length > 0) {
            alert(`Atención: Hay ${equiposFechaInvalida.length} equipos donde la "Fecha de revisión" no coincide con "Hoy" (${hoy}). Asegúrate de pulsar "Hoy" o "Revisar todo como ok" para actualizar las fechas de hoy.`);
            return;
        }

        // Mostrar modal de pre-cierre
        setShowPreCierreModal(true);
    };

    const handleConfirmarPreCierre = () => {
        setShowPreCierreModal(false);
        setFirmaClienteOk(false);
        setFirmaTecnicoOk(false);
        setShowFirmasModal(true);
        // Limpiar canvas al abrir
        setTimeout(() => {
            [canvasClienteRef, canvasTecnicoRef].forEach(ref => {
                const canvas = ref.current;
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
                }
            });
        }, 100);
    };

    const getCanvasPos = (canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            };
        }
        return {
            x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
            y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
        };
    };

    const startDraw = (canvasRef: React.RefObject<HTMLCanvasElement | null>, setDrawing: (v: boolean) => void, e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setDrawing(true);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pos = getCanvasPos(canvas, e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (canvasRef: React.RefObject<HTMLCanvasElement | null>, drawing: boolean, e: React.MouseEvent | React.TouchEvent) => {
        if (!drawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pos = getCanvasPos(canvas, e);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1e293b';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDraw = (setDrawing: (v: boolean) => void, setFirmaOk: (v: boolean) => void, canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
        setDrawing(false);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const hasContent = Array.from(data).some((v, i) => i % 4 === 3 && v > 0);
        setFirmaOk(hasContent);
    };

    const clearCanvas = (canvasRef: React.RefObject<HTMLCanvasElement | null>, setFirmaOk: (v: boolean) => void) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        setFirmaOk(false);
    };

    const handleFinalizarConFirmas = async () => {
        if (!nombreClienteFirma.trim()) {
            alert('Por favor, introduce el nombre del cliente.');
            return;
        }

        const firmaCliente = canvasClienteRef.current?.toDataURL('image/png') || '';
        const firmaTecnico = canvasTecnicoRef.current?.toDataURL('image/png') || '';

        // 1. Generar ID correlativo de Albarán para guardar las firmas
        const albaranesExistentes: Albaran[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
        const year = new Date().getFullYear().toString().slice(-2);
        const prefix = `ALB-${year}-`;
        const patterned = albaranesExistentes.filter((alb) => alb.id?.startsWith(prefix));
        let nextNum = 1;
        if (patterned.length > 0) {
            const nums = patterned.map((alb) => {
                const parts = alb.id.split('-');
                return parseInt(parts[parts.length - 1]);
            }).filter((n) => !isNaN(n));
            if (nums.length > 0) nextNum = Math.max(...nums) + 1;
        }
        const nextId = `${prefix}${nextNum.toString().padStart(3, '0')}`;

        const numMantenimiento = parte?.numeroMantenimiento || await generateNumeroMantenimiento();

        const nuevoAlbaran: Albaran = {
            id: nextId,
            centroId: centro?.id || '',
            clienteId: centro?.clienteId || '',
            empresaId: centro?.empresaId || '',
            parteId: parteId,
            tecnicoId: parte?.tecnicoId || '',
            numeroMantenimiento: numMantenimiento,
            fechaCreacion: new Date().toISOString(),
            facturado: false,
            items: [], // Se puede poblar basándose en los equipos revisados
            firmaCliente,
            firmaTecnico,
            nombreFirmante: nombreClienteFirma
        };

        await saveEquiposProgress();

        try {
            // Guardar Albarán con las firmas
            await addAlbaran(nuevoAlbaran);
            
            // Cambiar estado a Pre-Cerrado y guardar firmas en el parte
            const docId = (parte as any)?._docId || parteId;
            await updateParteFirestore(docId, { 
                estado: 'Pre-Cerrado', 
                numeroMantenimiento: numMantenimiento,
                firmaCliente,
                firmaTecnico,
                nombreFirmante: nombreClienteFirma
            } as any);

            // Actualizar localmente
            updateParte({ 
                estado: 'Pre-Cerrado', 
                numeroMantenimiento: numMantenimiento,
                firmaCliente,
                firmaTecnico,
                nombreFirmante: nombreClienteFirma
            });

            setShowFirmasModal(false);
            navigate(-1);
        } catch (err) {
            console.error('Error al finalizar el parte:', err);
            alert('Error al guardar los datos finales y las firmas.');
        }
    };

    const handlePauseRevision = () => {
        if (!parteId) return;

        saveEquiposProgress();
        updateParte({ estado: 'Descargado (Offline)' });

        alert('Revisión pausada. Todos los datos se han guardado.');
        navigate(-1);
    };

    const handleDeleteEquipo = (id: string) => {
        setEquipoIdToDelete(id);
        setIsConfirmModalOpen(true);
    };

    const handleConfirmarRevisarTodo = async () => {
        const sistId = revisarTodoConfirm.sistemaId;
        if (!sistId) return;
        setRevisarTodoConfirm({ isOpen: false, sistemaId: null });

        const itemsToUse = getItemsToUse(sistId);
        let updatedCount = 0;
        const hoy = new Date().toISOString().split('T')[0];
        const updatedEquipos = equiposInstalados.map(eq => {
            if (eq.sistemaId === sistId) {
                updatedCount++;
                const allChecked: Record<string, any> = {};
                itemsToUse.forEach(item => {
                    if (item.tipoRespuesta === 'check') {
                        allChecked[item.key] = true;
                    } else if (item.tipoRespuesta === 'fecha') {
                        const lblLower = (item.label || '').toLowerCase();
                        if (lblLower.includes('fecha de revisi')) {
                            allChecked[item.key] = hoy;
                        }
                    }
                });
                return {
                    ...eq,
                    revisado: true,
                    ...allChecked
                };
            }
            return eq;
        });

        if (updatedCount > 0) {
            setEquiposInstalados(updatedEquipos);
            saveEquiposProgress(updatedEquipos);
            
            // Guardar individualmente en Firestore para asegurar sincronía
            updatedEquipos.filter(eq => eq.sistemaId === sistId).forEach(async (equipoModificado) => {
                try {
                    await updateEquipoInstalado(equipoModificado.id, equipoModificado as any);
                } catch (err) {
                    console.error('Error guardando en Firestore desde Revisar Todo:', err);
                }
            });

            showToast('Guardado');
            if (parte?.estado === 'Planificado') {
                updateParte({ estado: 'Abierto' });
                const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                const parteActual = storedPartes.find((p: any) => p.id === parteId);
                const docId = parteActual?._docId || parteId;
                try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
            }
        }
    };

    const confirmDeleteEquipo = async () => {
        if (!equipoIdToDelete) return;
        setIsConfirmModalOpen(false);
        
        // Encontrar el equipo a eliminar desde el estado actual
        const eqEliminado = equiposInstalados.find(eq => eq.id === equipoIdToDelete);
        
        const updatedEquipos = equiposInstalados.filter(eq => eq.id !== equipoIdToDelete);
        setEquiposInstalados(updatedEquipos);

        const allEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        const updatedAll = allEquipos.filter((eq: any) => eq.id !== equipoIdToDelete);
        localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(updatedAll));

        // Eliminar también de Firestore
        if (eqEliminado?.centroId && eqEliminado?.sistemaId) {
            try {
                const { deleteEquipoInstalado } = await import('./firebase');
                await deleteEquipoInstalado(eqEliminado.centroId, eqEliminado.sistemaId, equipoIdToDelete);
            } catch (err) {
                console.warn('Error eliminando equipo de Firestore:', err);
            }
        }
    };

    const moveSistema = (sistemaId: string, direction: 'up' | 'down') => {
        const sistemasOrdenados = [...sistemasDelCentro].sort((a, b) => {
            const idxA = sistemaOrden.indexOf(a.id);
            const idxB = sistemaOrden.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
        const currentIndex = sistemasOrdenados.findIndex(s => s.id === sistemaId);
        if (currentIndex === -1) return;
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= sistemasOrdenados.length) return;

        const newOrden = sistemasOrdenados.map(s => s.id);
        const [moved] = newOrden.splice(currentIndex, 1);
        newOrden.splice(newIndex, 0, moved);
        setSistemaOrden(newOrden);
        localStorage.setItem('firecheck_revision_sistema_orden', JSON.stringify(newOrden));
    };

    const toggleSistema = (sistemaId: string) => {
        setOpenSistemas(prev => ({ ...prev, [sistemaId]: !prev[sistemaId] }));
    };

    const getItemsToUse = (sistemaId?: string): ChecklistItem[] => {
        if (sistemaId) {
            return checklistItemsPorSistema[sistemaId] || [];
        }
        // Si no hay sistemaId, buscar en cualquier sistema cargado
        const allItems = Object.values(checklistItemsPorSistema).flat();
        if (allItems.length > 0) return allItems;
        return [];
    };

    const sistemaTieneAnomalias = (sistemaId: string) => {
        const equiposSistema = equiposInstalados.filter((eq) => eq.sistemaId === sistemaId);
        const items = getItemsToUse(sistemaId);
        return equiposSistema.some((eq) => {
            const checkRojo = items.some((item) => eq[item.key as keyof EquipoInstalado] === false);
            
            // Comprobar si hay mensajes de anomalias en los campos de notas
            const campoNotasConAnomalia = items.some(item => {
                const lbl = (item.label || '').toLowerCase();
                if (lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal')) {
                    const val = eq[item.key as keyof EquipoInstalado];
                    if (typeof val === 'string' && val.trim() !== '') return true;
                }
                return false;
            });

            const textoAnomalia = !!eq.anomalias && eq.anomalias.trim() !== '';
            return checkRojo || textoAnomalia || campoNotasConAnomalia;
        });
    };

    const getCheckStats = (eq: EquipoInstalado) => {
        let ok = 0;
        let fail = 0;
        let pending = 0;
        const items = getItemsToUse(eq.sistemaId);
        items.forEach(item => {
            const val = eq[item.key as keyof EquipoInstalado];
            if (val === true) ok++;
            else if (val === false) fail++;
            else pending++;
        });
        return { ok, fail, pending };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    <p className="text-slate-500 text-sm font-medium">Cargando revisión...</p>
                </div>
            </div>
        );
    }

    console.log('RevisionChecklist render check:', { centro, parte, centroId, parteId });
    if (!centro || !parte) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-amber-100 text-center max-w-md">
                    <div className="w-8 h-8 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-amber-700 font-medium">Cargando datos del parte...</p>
                    <p className="text-xs text-zinc-400 mt-2">Conectando con Firestore</p>
                </div>
            </div>
        );
    }

    const clientInfo = clientes.find(cl => cl.id === centro.clienteId);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver
                    </button>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Revisión técnica</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Header Card */}
                <div className="mb-8 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-6 border-b border-slate-100 relative">
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                            Revisión del parte: <span className="text-slate-500 font-mono text-lg">{parte.numeroMantenimiento || parte.id}</span>
                        </h1>
                        
                        <div className="mt-4">
                            <div className="text-lg font-bold text-slate-700">
                                {clientInfo?.nombre || 'Cliente'} - {centro.nombre}
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                                {centro.direccion}, {centro.poblacion}
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                                Tipo de revisión: <span className="font-semibold text-slate-700">{parte.periodicidad || 'No definida'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="px-6 py-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {parte.tecnicoId ? (
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-slate-600">Técnico asignado:</label>
                                    <select
                                        value={parte.tecnicoId || ''}
                                        onChange={(e) => handleParteChange({ tecnicoId: e.target.value })}
                                        className="bg-white border border-slate-200 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:border-sky-500 font-semibold text-sky-700"
                                    >
                                        <option value="">-- Seleccionar Técnico --</option>
                                        {tecnicos.map(t => (
                                            <option key={t.id} value={t.id}>{t.nombre} {t.apellidos}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value=""
                                        onChange={(e) => handleParteChange({ tecnicoId: e.target.value })}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    >
                                        <option value="" disabled>Asignar Técnico</option>
                                        {tecnicos.map(t => (
                                            <option key={t.id} value={t.id}>{t.nombre} {t.apellidos}</option>
                                        ))}
                                    </select>
                                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm pointer-events-none">
                                        Asignar Técnico
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {parte.estado !== 'En revisión' && parte.estado !== 'Cerrado' && parte.estado !== 'Pre-Cerrado' && (
                                <button
                                    onClick={() => handleParteChange({ estado: 'En revisión' })}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                                >
                                    <CheckCircle2 className="w-4 h-4" /> Empezar revisión
                                </button>
                            )}
                            <span className="flex items-center gap-1.5 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                <div className={`w-2 h-2 rounded-full ${parte.estado === 'En revisión' ? 'bg-green-500' : (parte.estado === 'Cerrado' || parte.estado === 'Pre-Cerrado') ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                                Estado: <span className="font-semibold text-slate-700">{parte.estado}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Systems Accordion List */}
                <div className="space-y-4">
                    {sistemasDelCentro.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 border-dashed">
                            <Layers className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-400 font-medium">Este centro no tiene sistemas registrados.</p>
                        </div>
                    ) : (
                        [...sistemasDelCentro].sort((a, b) => {
                            const idxA = sistemaOrden.indexOf(a.id);
                            const idxB = sistemaOrden.indexOf(b.id);
                            if (idxA === -1 && idxB === -1) return 0;
                            if (idxA === -1) return 1;
                            if (idxB === -1) return -1;
                            return idxA - idxB;
                        }).map((sist, index, arr) => {
                            // Buscar la imagen del sistema en categoriasSistema (cargado desde Firestore)
                            const sistemaCat = categoriasSistema.find(c => {
                                const nombreSist = (sist.tipo || sist.familia || '').toLowerCase().trim();
                                const nombreCat = (c.nombre || '').toLowerCase().trim();
                                return nombreCat.includes(nombreSist) || nombreSist.includes(nombreCat);
                            });
                            const imagenUrl = sistemaCat?.imagenUrl;
                            const IconoCat = imagenUrl || getIconForSistema(sist.tipo || sist.familia || '');
                            const isFirst = index === 0;
                            const isLast = index === arr.length - 1;
                            return (
                                <div key={sist.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md">
                                {/* Accordion Header - sticky respecto al viewport */}
                                <div className="sticky top-[57px] z-10 bg-white px-6 py-4 border-b border-slate-100 rounded-t-2xl shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => toggleSistema(sist.id)}
                                            className="flex items-center gap-3 text-left flex-1 min-w-0"
                                        >
                                            <div className="w-9 h-9 flex items-center justify-center shrink-0 overflow-hidden">
                                                {typeof IconoCat === 'string' ? (
                                                    <img src={IconoCat} alt="Icon" className="w-7 h-7 object-contain" />
                                                ) : (
                                                    <IconoCat className="w-5 h-5 text-slate-500" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h2 className="text-lg font-semibold text-slate-800 truncate">
                                                    {sist.familia || sist.tipo}
                                                </h2>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {(() => {
                                                        const equiposSistema = equiposInstalados.filter(eq => eq.sistemaId === sist.id);
                                                        const numEquipos = equiposSistema.length;
                                                        
                                                        // Buscar el campo "Referencia instalación" en el primer equipo
                                                        const itemReferenciaInstalacion = getItemsToUse(sist.id).find((item: ChecklistItem) => {
                                                            const lbl = (item.label || '').toLowerCase();
                                                            return lbl.includes('referencia') && lbl.includes('instalacion');
                                                        });
                                                        
                                                        let referenciaTexto = '';
                                                        if (itemReferenciaInstalacion && equiposSistema.length > 0) {
                                                            const primerEquipo = equiposSistema[0];
                                                            const valorReferencia = primerEquipo[itemReferenciaInstalacion.key as keyof EquipoInstalado];
                                                            if (typeof valorReferencia === 'string' && valorReferencia.trim() !== '') {
                                                                referenciaTexto = valorReferencia.trim() + ', ';
                                                            }
                                                        }
                                                        
                                                        return `${referenciaTexto}${numEquipos} equipo${numEquipos !== 1 ? 's' : ''}`;
                                                    })()}
                                                </p>
                                            </div>
                                        </button>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {/* Flechas para reordenar */}
                                            <div className="flex flex-col gap-0.5 mr-1">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); moveSistema(sist.id, 'up'); }}
                                                    disabled={isFirst}
                                                    className={`p-0.5 rounded transition-colors ${isFirst ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                                                    title="Mover arriba"
                                                >
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); moveSistema(sist.id, 'down'); }}
                                                    disabled={isLast}
                                                    className={`p-0.5 rounded transition-colors ${isLast ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                                                    title="Mover abajo"
                                                >
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            {sistemaTieneAnomalias(sist.id) && (
                                                <span title="Este sistema tiene anomalías">
                                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                                </span>
                                            )}
                                        </div>


                                    </div>
                                </div>

                                {/* Accordion Content */}
                                {openSistemas[sist.id] && (
                                    <div className="px-4 sm:px-6 py-5">
                                        {sist.descripcion && (
                                            <p className="text-sm text-slate-500 mb-5 px-1">{sist.descripcion}</p>
                                        )}

                                        {/* Botones de acción del sistema - parte superior */}
                                        <div className="mb-5 flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setRevisarTodoConfirm({ isOpen: true, sistemaId: sist.id });
                                                }}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-green-200"
                                            >
                                                <CheckCheck className="w-4 h-4" /> Revisar todo como ok
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAddEquipo(prev => ({ ...prev, isOpen: true, sistemaId: sist.id }));
                                                }}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
                                            >
                                                <Plus className="w-4 h-4" /> Añadir equipo
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {(() => {
                                                const filteredEqs = equiposInstalados
                                                    .filter(eq => eq.sistemaId === sist.id)
                                                    .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }));
                                                return filteredEqs.length === 0 ? (
                                                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                                        <Layers className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                                        <p className="text-sm text-slate-400 font-medium">No hay equipos instalados en este sistema.</p>
                                                    </div>
                                                ) : (
                                                    (() => {
                                                        const sistLower = (sist.tipo || sist.familia || '').toLowerCase();
                                                        const isExtintor = sistLower.includes('extintor');
                                                        const isBie = sistLower.includes('bie') || sistLower.includes('boca');
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
                                                    })()
                                                );
                                            })()}
                                        </div>

                                        {equiposInstalados.some(eq => eq.sistemaId === sist.id) && (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAddEquipo(prev => ({ ...prev, isOpen: true, sistemaId: sist.id }));
                                                    }}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
                                                >
                                                    <Plus className="w-4 h-4" /> Añadir equipo
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            );
                        })
                    )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3">
                    <button
                        onClick={handlePauseRevision}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-slate-600 hover:bg-slate-700 shadow-lg shadow-slate-200 transition-all text-sm sm:w-auto"
                    >
                        <Save className="w-4 h-4" /> Guardar datos
                    </button>
                    <button
                        onClick={handleSaveRevision}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all text-sm sm:w-auto"
                    >
                        <Lock className="w-4 h-4" /> Pre-cerrar
                    </button>
                </div>
            </div>

            {/* MODAL EDITAR EQUIPO */}
            {editEquipo && equiposInstalados.find(e => e.id === editEquipo) && centroId && (
                <EquipoFormulario
                    equipo={equiposInstalados.find(e => e.id === editEquipo) || null}
                    sistemaId={equiposInstalados.find(e => e.id === editEquipo)?.sistemaId || ''}
                    sistemaNombre={sistemasDelCentro.find(s => s.id === equiposInstalados.find(e => e.id === editEquipo)?.sistemaId)?.tipo || sistemasDelCentro.find(s => s.id === equiposInstalados.find(e => e.id === editEquipo)?.sistemaId)?.familia || ''}
                    centroId={centroId}
                    parteId={parteId}
                    plantillaId={sistemasDelCentro.find(s => s.id === equiposInstalados.find(e => e.id === editEquipo)?.sistemaId)?.tipo || sistemasDelCentro.find(s => s.id === equiposInstalados.find(e => e.id === editEquipo)?.sistemaId)?.familia || ''}
                    equiposExistentes={equiposInstalados.filter(e => e.sistemaId === equiposInstalados.find(eq => eq.id === editEquipo)?.sistemaId)}
                    onSave={async (updatedEq) => {
                        const updated = equiposInstalados.map(eq =>
                            eq.id === editEquipo ? { ...eq, ...updatedEq } as any : eq
                        );
                        setEquiposInstalados(updated);
                        saveEquiposProgress(updated);

                        try {
                            if (updatedEq.id && !updatedEq.id.startsWith('temp_')) {
                                await updateEquipoInstalado(updatedEq.id, updatedEq);
                            }
                            showToast('Equipo actualizado');
                        } catch (err) {
                            console.error('Error al actualizar equipo en Firestore:', err);
                            showToast('Error al actualizar en servidor');
                        }
                        
                        setEditEquipo(null);
                    }}
                    onCancel={() => setEditEquipo(null)}
                    isNew={false}
                />
            )}

            {isConfirmModalOpen && equipoIdToDelete && (
                <ConfirmationModal
                    isOpen={isConfirmModalOpen}
                    onClose={() => { setIsConfirmModalOpen(false); setEquipoIdToDelete(null); }}
                    onConfirm={confirmDeleteEquipo}
                    title="Confirmar Eliminación"
                    message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?"
                    confirmText="Sí, eliminar"
                    cancelText="No, cancelar"
                />
            )}

            {/* MODAL AÑADIR EQUIPO */}
            {addEquipo.isOpen && addEquipo.sistemaId && centroId && (
                <EquipoFormulario
                    equipo={null}
                    sistemaId={addEquipo.sistemaId}
                    sistemaNombre={sistemasDelCentro.find(s => s.id === addEquipo.sistemaId)?.tipo || sistemasDelCentro.find(s => s.id === addEquipo.sistemaId)?.familia || ''}
                    centroId={centroId}
                    plantillaId={sistemasDelCentro.find(s => s.id === addEquipo.sistemaId)?.tipo || sistemasDelCentro.find(s => s.id === addEquipo.sistemaId)?.familia || ''}
                    equiposExistentes={equiposInstalados.filter(e => e.sistemaId === addEquipo.sistemaId)}
                    onSave={async (equipo) => {
                        const equipoConCodigo = {
                            ...equipo,
                            codigo: equipo.codigo || '',
                            revisado: false
                        };
                        const updatedEquipos = [...equiposInstalados, equipoConCodigo as any];
                        setEquiposInstalados(updatedEquipos);
                        saveEquiposProgress(updatedEquipos);
                        
                        try {
                            await addEquipoInstalado(equipoConCodigo as any);
                            showToast('Equipo añadido');
                        } catch (err) {
                            console.error('Error al añadir equipo en Firestore:', err);
                            showToast('Error al añadir en servidor');
                        }
                        
                        setAddEquipo(prev => ({ ...prev, isOpen: false }));
                    }}
                    onCancel={() => {
                        setAddEquipo(prev => ({ ...prev, isOpen: false }));
                    }}
                    isNew={true}
                />
            )}

            {revisarTodoConfirm.isOpen && revisarTodoConfirm.sistemaId && (
                <ConfirmationModal
                    isOpen={revisarTodoConfirm.isOpen}
                    onClose={() => setRevisarTodoConfirm({ isOpen: false, sistemaId: null })}
                    onConfirm={handleConfirmarRevisarTodo}
                    title="Confirmar Revisión"
                    message="¿Seguro que quieres pasar todos los equipos como revisados y OK?"
                    confirmText="Sí, revisar todo"
                    cancelText="No, cancelar"
                />
            )}

            {/* MODAL PRE-CIERRE */}
            {showPreCierreModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="px-6 py-5 bg-indigo-50 border-b border-indigo-100 text-center">
                            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <PenLine className="w-7 h-7 text-indigo-600" />
                            </div>
                            <h2 className="text-lg font-bold text-indigo-900">¿Pre-cerrar la revisión?</h2>
                            <p className="text-sm text-indigo-600 mt-1">Se solicitarán las firmas del cliente y del técnico para finalizar el parte.</p>
                        </div>
                        <div className="p-6 flex flex-col gap-3">
                            <button
                                onClick={handleConfirmarPreCierre}
                                className="w-full px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Sí, continuar con las firmas
                            </button>
                            <button
                                onClick={() => setShowPreCierreModal(false)}
                                className="w-full px-4 py-3 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Volver a la revisión
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL FIRMAS */}
            {showFirmasModal && (() => {
                const tecnicos: any[] = JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');
                const tecnico = tecnicos.find((t: any) => t.id === parte?.tecnicoId || t._docId === parte?.tecnicoId);
                const nombreTecnico = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : (JSON.parse(localStorage.getItem('firecheck_logged_user') || '{}')?.nombre || 'Técnico');
                return (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[95vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <PenLine className="w-5 h-5 text-indigo-600" /> Firmas de conformidad
                            </h2>
                            <button
                                onClick={() => setShowFirmasModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 space-y-6">
                            {/* Firma Cliente */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold">C</span>
                                        Firma del Cliente
                                        {firmaClienteOk && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                    </label>
                                    <button
                                        onClick={() => clearCanvas(canvasClienteRef, setFirmaClienteOk)}
                                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Borrar
                                    </button>
                                </div>
                                {/* Campo nombre cliente */}
                                <div className="mb-3">
                                    <input
                                        type="text"
                                        value={nombreClienteFirma}
                                        onChange={e => setNombreClienteFirma(e.target.value)}
                                        placeholder="Nombre y apellidos del cliente..."
                                        className="w-full px-3 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 outline-none transition-all"
                                    />
                                </div>
                                <div className={`rounded-xl border-2 overflow-hidden transition-colors ${firmaClienteOk ? 'border-green-400' : 'border-slate-200'}`}>
                                    <canvas
                                        ref={canvasClienteRef}
                                        width={600}
                                        height={240}
                                        className="w-full touch-none bg-slate-50 cursor-crosshair"
                                        style={{ display: 'block' }}
                                        onMouseDown={e => startDraw(canvasClienteRef, setDrawingCliente, e)}
                                        onMouseMove={e => draw(canvasClienteRef, drawingCliente, e)}
                                        onMouseUp={() => stopDraw(setDrawingCliente, setFirmaClienteOk, canvasClienteRef)}
                                        onMouseLeave={() => stopDraw(setDrawingCliente, setFirmaClienteOk, canvasClienteRef)}
                                        onTouchStart={e => { e.preventDefault(); startDraw(canvasClienteRef, setDrawingCliente, e); }}
                                        onTouchMove={e => { e.preventDefault(); draw(canvasClienteRef, drawingCliente, e); }}
                                        onTouchEnd={() => stopDraw(setDrawingCliente, setFirmaClienteOk, canvasClienteRef)}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1 text-center">Firme con el dedo o el ratón en el recuadro</p>
                            </div>

                            {/* Firma Técnico */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">T</span>
                                        Firma del Técnico
                                        {firmaTecnicoOk && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                    </label>
                                    <button
                                        onClick={() => clearCanvas(canvasTecnicoRef, setFirmaTecnicoOk)}
                                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Borrar
                                    </button>
                                </div>
                                {/* Nombre técnico automático */}
                                <div className="mb-3">
                                    <div className="w-full px-3 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-sm font-semibold text-indigo-700 flex items-center gap-2">
                                        <span className="w-4 h-4 text-indigo-400">👤</span>
                                        {nombreTecnico}
                                    </div>
                                </div>
                                <div className={`rounded-xl border-2 overflow-hidden transition-colors ${firmaTecnicoOk ? 'border-green-400' : 'border-slate-200'}`}>
                                    <canvas
                                        ref={canvasTecnicoRef}
                                        width={600}
                                        height={240}
                                        className="w-full touch-none bg-slate-50 cursor-crosshair"
                                        style={{ display: 'block' }}
                                        onMouseDown={e => startDraw(canvasTecnicoRef, setDrawingTecnico, e)}
                                        onMouseMove={e => draw(canvasTecnicoRef, drawingTecnico, e)}
                                        onMouseUp={() => stopDraw(setDrawingTecnico, setFirmaTecnicoOk, canvasTecnicoRef)}
                                        onMouseLeave={() => stopDraw(setDrawingTecnico, setFirmaTecnicoOk, canvasTecnicoRef)}
                                        onTouchStart={e => { e.preventDefault(); startDraw(canvasTecnicoRef, setDrawingTecnico, e); }}
                                        onTouchMove={e => { e.preventDefault(); draw(canvasTecnicoRef, drawingTecnico, e); }}
                                        onTouchEnd={() => stopDraw(setDrawingTecnico, setFirmaTecnicoOk, canvasTecnicoRef)}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1 text-center">Firme con el dedo o el ratón en el recuadro</p>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowFirmasModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Volver
                            </button>
                            <button
                                type="button"
                                onClick={handleFinalizarConFirmas}
                                disabled={!firmaClienteOk || !firmaTecnicoOk || !nombreClienteFirma.trim()}
                                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                {firmaClienteOk && firmaTecnicoOk && nombreClienteFirma.trim() ? '✓ Finalizar Parte' : 'Faltan datos'}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* TOAST DE GUARDADO */}
            {toastMessage && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[300] flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl font-medium text-sm animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    {toastMessage}
                </div>
            )}
        </div>
    );
}