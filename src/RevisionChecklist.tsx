import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Building2, Layers, MapPin, FileText, ChevronDown, ChevronUp, Plus, X, CheckCircle2, XCircle, Trash2, AlertTriangle, Pencil, PenLine, RotateCcw, CheckCheck, Eye } from 'lucide-react';
import { addEquipoInstalado, addAlbaran, updateEquipoInstalado, updateParte as updateParteFirestore, subscribePartes, subscribeCentros, subscribeClientes, subscribeCentroSistemas, subscribeEquiposInstalados, subscribeArticulos, subscribeSistemasCategorias, uploadFile, type Albaran, type Tecnico, type ChecklistItem } from './firebase';
import { subscribePlantillas, subscribeItemsDePlantilla, type ItemPlantilla } from './plantillas';
import type { Centro, Parte, Cliente, CentroSistema, EquipoInstalado } from './Centros';
import ConfirmationModal from './ConfirmationModal';
import { getIconForSistema } from './Sistemas';
import { generarActaExtintoresPDFView } from './pdfGenerator';
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
            if (!sistemaNombre) return;

            const nombreSistemaNorm = normalizarNombre(sistemaNombre);

            // Buscar la plantilla que coincida con el nombre del sistema
            const plantilla = plantillas.find(p => {
                const nombrePlantillaNorm = normalizarNombre(p.nombre);
                const coincideExacto = nombrePlantillaNorm === nombreSistemaNorm;
                const plantillaContieneSistema = nombrePlantillaNorm.includes(nombreSistemaNorm);
                const sistemaContienePlantilla = nombreSistemaNorm.includes(nombrePlantillaNorm);
                const palabrasSistema = nombreSistemaNorm.split(' ').filter(w => w.length > 3);
                const palabrasPlantilla = nombrePlantillaNorm.split(' ').filter(w => w.length > 3);
                const coincidePalabras = palabrasSistema.some(ps => palabrasPlantilla.some(pp => ps === pp || pp.includes(ps) || ps.includes(pp)));
                return coincideExacto || plantillaContieneSistema || sistemaContienePlantilla || coincidePalabras;
            });

            if (!plantilla) {
                console.warn(`❌ No se encontró plantilla para sistema: "${sistemaNombre}"`);
                return;
            }

            const unsub = subscribeItemsDePlantilla(plantilla.id, (items: ItemPlantilla[]) => {
                const checklistItems: ChecklistItem[] = items.map(item => ({
                    id: item.id,
                    key: item.key,
                    label: item.label,
                    tipoRespuesta: item.tipoRespuesta,
                    sistemaId: sist.id,
                    sistemaNombre: sistemaNombre,
                    orden: item.orden,
                }));
                setChecklistItemsPorSistema(prev => ({ ...prev, [sist.id]: checklistItems }));
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
    const [editEquipo, setEditEquipo] = useState<{ id: string; codigo: string; nombre: string; ubicacion: string; placa: string; fechaFabricacion: string; ultimoRetimbre: string } | null>(null);

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
            const found = items.find((c: any) => c.id === centroId) as Centro | undefined;
            if (found) setCentro(found);
            localStorage.setItem('firecheck_db_centros', JSON.stringify(items));
        });

        // 3. Cargar partes y encontrar el parte actual
        const unsubPartes = subscribePartes((items) => {
            const found = items.find((p: any) => p.id === parteId) as Parte | undefined;
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

  const handlePreviewPDF = async () => {
    try {
      const cliente = clientes.find(cl => cl.id === centro?.clienteId);
      const tecnicos: Tecnico[] = JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');
      const tecnico = tecnicos.find(t => t.id === parte?.tecnicoId);
      const nombreTecnico = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'Técnico';
      
      if (!centro || !cliente) return;

      const pdfBlobUrl = await generarActaExtintoresPDFView(
        cliente as Record<string, any>,
        centro as Record<string, any>,
        sistemasDelCentro as Record<string, any>[],
        equiposInstalados
          .filter(e => e.centroId === centroId)
          .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true })),
        parte?.numeroMantenimiento || parte?.id,
        nombreTecnico,
        undefined,
        undefined, // Sin firma cliente aún
        undefined, // Sin firma técnico aún
        '',
        Object.values(checklistItemsPorSistema).flat() // Pasar los items del checklist dinámico
      );
      window.open(pdfBlobUrl, '_blank');
    } catch (e) {
      console.error(e);
    }
  };

    const handleSaveRevision = () => {
        if (!parteId) return;

        // 1. Verificar que todos los equipos han sido procesados (Revisados o No encontrados)
        const equiposSinRevisar = equiposInstalados.filter(eq => !eq.revisado);
        if (equiposSinRevisar.length > 0) {
            alert(`Atención: Quedan ${equiposSinRevisar.length} equipos sin revisar. Todos los equipos deben marcarse como 'Revisado', 'No encontrado' o ser inspeccionados manualmente antes de finalizar.`);
            return;
        }

        const itemsToUse = getItemsToUse();
        const equiposInvalidos = equiposInstalados.filter((eq) => {
            const algunCheckRojo = itemsToUse.some((item) => eq[item.key as keyof EquipoInstalado] === false);
            const anomaliaVacia = !eq.anomalias || eq.anomalias.trim() === '';
            return algunCheckRojo && anomaliaVacia;
        });

        if (equiposInvalidos.length > 0) {
            alert('Hay equipos con checks en rojo. Debes escribir la anomalía obligatoriamente en esos equipos.');
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

        const numMantenimiento = `MANT-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

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
        const updatedEquipos = equiposInstalados.map(eq => {
            if (eq.sistemaId === sistId) {
                updatedCount++;
                const allChecked: Record<string, any> = {};
                itemsToUse.forEach(item => {
                    if (item.tipoRespuesta === 'check') {
                        allChecked[item.key] = true;
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
        const updatedEquipos = equiposInstalados.filter(eq => eq.id !== equipoIdToDelete);
        setEquiposInstalados(updatedEquipos);

        const allEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        const updatedAll = allEquipos.filter((eq: any) => eq.id !== equipoIdToDelete);
        localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(updatedAll));

        // Eliminar también de Firestore
        const eqEliminado = allEquipos.find((eq: any) => eq.id === equipoIdToDelete);
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
        if (sistemaId && checklistItemsPorSistema[sistemaId]?.length > 0) {
            return checklistItemsPorSistema[sistemaId];
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
                    <div className="px-6 py-5 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {clientInfo?.nombre || 'Cliente'} &bull; {centro.nombre}
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                            Revisión del Parte: <span className="text-slate-500 font-mono text-lg">{parte.id}</span>
                        </h1>
                    </div>
                    <div className="px-6 py-3 bg-slate-50/50 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {centro.direccion}, {centro.poblacion}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            Estado: <span className="font-semibold text-slate-700">{parte.estado}</span>
                        </span>
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
                                                    filteredEqs.map((eq, i) => {
                                                        const itemsToUse = getItemsToUse(sist.id);
                                                        const algunCheckRojo = itemsToUse.some((item) => eq[item.key as keyof EquipoInstalado] === false);
                                                        const stats = getCheckStats(eq);
                                                        
                                                        const isExtintor = (sist.tipo || sist.familia || '').toLowerCase().includes('extintor');
                                                        let caducado = false;
                                                        let necesitaRetimbre = false;
                                                        let seAproxima = false;
                                                        let fabItemKey = "";
                                                        let retItemKey = "";
                                                        if (isExtintor) {
                                                            const fabItem = itemsToUse.find(i => (i.label||'').toLowerCase().includes('fabricaci'));
                                                            const retItem = itemsToUse.find(i => (i.label||'').toLowerCase().includes('retimbre'));
                                                            fabItemKey = fabItem?.key || "";
                                                            retItemKey = retItem?.key || "";
                                                            if (fabItem) {
                                                                const valFab = eq[fabItem.key as keyof EquipoInstalado] as string;
                                                                const valRet = retItem ? eq[retItem.key as keyof EquipoInstalado] as string : null;
                                                                if (valFab) {
                                                                    const today = new Date();
                                                                    const dateFab = new Date(valFab);
                                                                    if (!isNaN(dateFab.getTime())) {
                                                                        const monthsSinceFab = (today.getFullYear() - dateFab.getFullYear()) * 12 + today.getMonth() - dateFab.getMonth();
                                                                        if (monthsSinceFab >= 240) {
                                                                            caducado = true;
                                                                        } else {
                                                                            let refDate = dateFab;
                                                                            if (valRet) {
                                                                                const dr = new Date(valRet);
                                                                                if (!isNaN(dr.getTime())) refDate = dr;
                                                                            }
                                                                            const monthsSinceRef = (today.getFullYear() - refDate.getFullYear()) * 12 + today.getMonth() - refDate.getMonth();
                                                                            if (monthsSinceRef >= 60) {
                                                                                necesitaRetimbre = true;
                                                                            } else if (monthsSinceFab >= 237 || monthsSinceRef >= 57) {
                                                                                seAproxima = true;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }

                                                        return (
                                                            <div key={eq.id} className={`rounded-xl border transition-all ${algunCheckRojo ? 'bg-red-50/30 border-red-200' : 'bg-slate-50 border-slate-150'}`}>
                                                                <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                                                                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                                        <span className="px-3 py-1 bg-black text-white text-sm font-mono font-bold rounded-lg shadow-md min-w-[36px] text-center shrink-0">
                                                                            {eq.codigo || (i + 1).toString().padStart(2, '0')}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                    </div>
                                                                </div>

                                                                <div className="px-4 pb-3">
                                                                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1.5">
                                                                        {/* SOLO los items del checklist dinámico (exactamente como en el editor de plantillas) */}
                                                                        {getItemsToUse(sist.id).filter((item: ChecklistItem) => {
                                                                            const lbl = (item.label || '').toLowerCase();
                                                                            // Solo filtrar campo de notas para ponerlo debajo del grid
                                                                            if (lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal')) return false;
                                                                            return true;
                                                                        }).map(item => {
                                                                             const val = eq[item.key as keyof EquipoInstalado];
                                                                             const tipo = (item as ChecklistItem).tipoRespuesta || 'check';
                                                                             const lbl = (item.label || '').toLowerCase();
                                                                             const esCampoNotas = lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                                                                             
                                                                             // No renderizar campo notas en el grid (se renderiza debajo)
                                                                             if (esCampoNotas) return null;
                                                                            
                                                                            if (tipo === 'check') {
                                                                                const isChecked = val === true;
                                                                                const isUnchecked = val === false;
                                                                                return (
                                                                                    <label
                                                                                        key={item.key}
                                                                                        className={`flex items-center gap-2 cursor-pointer text-xs px-2 py-1.5 rounded-lg transition-all select-none ${
                                                                                            isUnchecked
                                                                                                ? 'text-red-600 font-semibold bg-red-50 hover:bg-red-100'
                                                                                                : isChecked
                                                                                                ? 'text-green-700 font-medium bg-green-50 hover:bg-green-100'
                                                                                                : 'text-slate-600 font-medium bg-white hover:bg-slate-50 border border-slate-200'
                                                                                        }`}
                                                                                    >
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isChecked}
                                                                                            onChange={(e) => handleCheckChange(eq.id, item.key, e.target.checked, item.label)}
                                                                                            className={`w-3.5 h-3.5 rounded cursor-pointer ${
                                                                                                isUnchecked
                                                                                                    ? 'text-red-500 border-red-300 focus:ring-red-400'
                                                                                                    : isChecked
                                                                                                    ? 'text-green-500 border-green-300 focus:ring-green-400'
                                                                                                    : 'text-slate-400 border-slate-300 focus:ring-slate-400'
                                                                                            }`}
                                                                                        />
                                                                                        {item.label}
                                                                                        {isChecked && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />}
                                                                                        {isUnchecked && <XCircle className="w-3 h-3 text-red-400 ml-auto" />}
                                                                                    </label>
                                                                                );
                                                                             } else if (tipo === 'numero') {
                                                                                 const tieneValor = typeof val === 'number';
                                                                                 return (
                                                                                     <div key={item.key} className="flex flex-col gap-0.5">
                                                                                         <label className="text-[10px] font-semibold text-slate-500">{item.label}</label>
                                                                                         <input
                                                                                             type="number"
                                                                                             value={tieneValor ? val : ''}
                                                                                             onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value ? Number(e.target.value) : '')}
                                                                                             className={`w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${tieneValor ? 'font-bold' : ''}`}
                                                                                             placeholder="0"
                                                                                         />
                                                                                     </div>
                                                                                 );
                                                                                } else if (tipo === 'fecha') {
                                                                                const fechaVal = typeof val === 'string' && val ? val.substring(0, 7) : '';
                                                                                const isErrorDate = (caducado || necesitaRetimbre || seAproxima) && (item.key === fabItemKey || item.key === retItemKey);
                                                                                return (
                                                                                    <div key={item.key} className="flex flex-col gap-0.5">
                                                                                        <label className="text-[10px] font-semibold text-slate-500">{item.label}</label>
                                                                                        <input
                                                                                            type="month"
                                                                                            value={fechaVal}
                                                                                            onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value ? e.target.value + '-01' : '')}
                                                                                            className={`w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 transition-colors ${
                                                                                                isErrorDate
                                                                                                ? 'bg-red-50 border-red-400 text-red-700 focus:border-red-500 focus:ring-red-500/20'
                                                                                                : `bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 ${fechaVal ? 'font-bold' : ''}`
                                                                                            }`}
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                             } else if (tipo === 'texto') {
                                                                                 const labelLower = (item.label || '').toLowerCase().replace(/[áéíóú]/g, (c) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'})[c] || c);
                                                                                 const esNumeroOrden = labelLower.includes('orden');
                                                                                 if (esNumeroOrden) console.log('🔍 Campo Nº Orden detectado, eq.codigo =', eq.codigo);
                                                                                 const placeholderTexto = labelLower.includes('referencia') && labelLower.includes('instalacion')
                                                                                     ? 'Ejemplo: Area general o zona'
                                                                                     : '...';
                                                                                 const tieneValorTexto = !esNumeroOrden && typeof val === 'string' && val.trim() !== '';
                                                                                 return (
                                                                                     <div key={item.key} className="flex flex-col gap-0.5">
                                                                                         <label className="text-[10px] font-semibold text-slate-500">{item.label}</label>
                                                                                         <input
                                                                                             type="text"
                                                                                             value={esNumeroOrden ? (eq.codigo || '') : (typeof val === 'string' ? val : '')}
                                                                                             onChange={(e) => {
                                                                                                 if (!esNumeroOrden) {
                                                                                                     handleCheckChange(eq.id, item.key, e.target.value);
                                                                                                 }
                                                                                             }}
                                                                                             className={`w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${esNumeroOrden ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''} ${tieneValorTexto ? 'font-bold' : ''}`}
                                                                                             placeholder={placeholderTexto}
                                                                                             readOnly={esNumeroOrden}
                                                                                         />
                                                                                     </div>
                                                                                 );
                                                                              } else if (tipo === 'texto-largo') {
                                                                                 // No renderizar "notas" en el grid
                                                                                 const lbl = (item.label || '').toLowerCase();
                                                                                 if (lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal')) return null;
                                                                                 const tieneValorTextoLargo = typeof val === 'string' && val.trim() !== '';
                                                                                 return (
                                                                                     <div key={item.key} className="flex flex-col gap-0.5 col-span-2">
                                                                                         <label className="text-[10px] font-semibold text-slate-500">{item.label}</label>
                                                                                         <textarea
                                                                                             value={typeof val === 'string' ? val : ''}
                                                                                             onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                                                             className={`w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none ${tieneValorTextoLargo ? 'font-bold' : ''}`}
                                                                                             rows={3}
                                                                                             placeholder="..."
                                                                                         />
                                                                                     </div>
                                                                                 );
                                                                             }
                                                                        })}
                                                                     </div>
                                                                 </div>
                                                                 {/* Campo notas debajo del grid, a ancho completo */}
                                                                 {getItemsToUse(sist.id).filter((item: ChecklistItem) => {
                                                                     const lbl = (item.label || '').toLowerCase();
                                                                     return lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                                                                 }).map(item => {
                                                                     const val = eq[item.key as keyof EquipoInstalado];
                                                                     const esNoEncontrado = typeof val === 'string' && val.includes('no localizarse');
                                                                     const esAvisoAutoMsg = typeof val === 'string' && (val.includes('Extintor caducado') || val.includes('Extintor necesita retimbre') || val.includes('Se aproxima caducidad o retimbrado'));
                                                                     const tieneValorNotas = typeof val === 'string' && val.trim() !== '' && !esNoEncontrado;
                                                                     const isErrorNotas = esNoEncontrado || algunCheckRojo || esAvisoAutoMsg;
                                                                     return (
                                                                         <div key={item.key} className="px-4 pb-3 mt-4">
                                                                             <label className={`text-xs font-semibold mb-1 block ${isErrorNotas ? 'text-red-700' : 'text-slate-600'}`}>Observaciones y anomalías del equipo:</label>
                                                                             <textarea
                                                                                 value={typeof val === 'string' ? val : ''}
                                                                                 onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                                                 className={`w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 resize-y min-h-[80px] ${isErrorNotas ? 'bg-red-50 border-2 border-red-400 text-red-800 font-bold focus:border-red-500 focus:ring-red-500/20' : `bg-white border border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 ${tieneValorNotas ? 'font-bold' : ''}`}`}
                                                                                 rows={4}
                                                                                 placeholder="Escribe aquí las anomalías, observaciones o notas..."
                                                                             />
                                                                         </div>
                                                                     );
                                                                 })}

                                                                 {/* Galería de fotos debajo de las anomalías */}
                                                                 {(() => {
                                                                     const currentFotos = Array.isArray((eq as any)['fotos']) 
                                                                         ? (eq as any)['fotos'] 
                                                                         : ((eq as any)['foto'] ? [(eq as any)['foto']] : []);
                                                                     
                                                                     return (
                                                                         <div className="px-4 pb-4 flex flex-wrap gap-3">
                                                                             {currentFotos.map((fotoUrl: string, idx: number) => (
                                                                                 <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0 shadow-sm group">
                                                                                     <img src={fotoUrl} alt="Foto equipo" className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-300" onClick={() => window.open(fotoUrl, '_blank')} />
                                                                                     <button
                                                                                         onClick={() => {
                                                                                             const newFotos = currentFotos.filter((_: any, i: number) => i !== idx);
                                                                                             handleCheckChange(eq.id, 'fotos', newFotos);
                                                                                             if (newFotos.length === 0) handleCheckChange(eq.id, 'foto', ''); // Mantenemos retrocompatibilidad vaciando 'foto'
                                                                                             else if (idx === 0) handleCheckChange(eq.id, 'foto', newFotos[0]);
                                                                                         }}
                                                                                         className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                         title="Eliminar foto"
                                                                                     >
                                                                                         <X className="w-3 h-3" />
                                                                                     </button>
                                                                                 </div>
                                                                             ))}
                                                                             
                                                                             <input
                                                                                 type="file"
                                                                                 accept="image/*"
                                                                                 capture="environment"
                                                                                 onChange={async (e) => {
                                                                                     const file = e.target.files?.[0];
                                                                                     if (!file) return;
                                                                                     try {
                                                                                         const thumbnail = await new Promise<Blob>((resolve, reject) => {
                                                                                             const img = new Image();
                                                                                             const objectUrl = URL.createObjectURL(file);
                                                                                             img.onload = () => {
                                                                                                 URL.revokeObjectURL(objectUrl);
                                                                                                 const canvas = document.createElement('canvas');
                                                                                                 const MAX = 640;
                                                                                                 let w = img.width, h = img.height;
                                                                                                 if (w > h) { if (w > MAX) { h = Math.floor(h * MAX / w); w = MAX; } }
                                                                                                 else { if (h > MAX) { w = Math.floor(w * MAX / h); h = MAX; } }
                                                                                                 canvas.width = w; canvas.height = h;
                                                                                                 const ctx = canvas.getContext('2d');
                                                                                                 if (!ctx) { reject(new Error('No canvas context')); return; }
                                                                                                 ctx.drawImage(img, 0, 0, w, h);
                                                                                                 canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Error blob')), 'image/jpeg', 0.75);
                                                                                             };
                                                                                             img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Error cargando imagen')); };
                                                                                             img.src = objectUrl;
                                                                                         });
                                                                                         const thumbFile = new File([thumbnail], `thumb_${Date.now()}.jpg`, { type: 'image/jpeg' });
                                                                                         const path = `revisiones/${parteId}/${eq.id}/foto_${Date.now()}`;
                                                                                         const url = await uploadFile(thumbFile, path);
                                                                                         
                                                                                         const newFotos = [...currentFotos, url];
                                                                                         handleCheckChange(eq.id, 'fotos', newFotos);
                                                                                         if (currentFotos.length === 0) handleCheckChange(eq.id, 'foto', url); // Mantenemos retrocompatibilidad con el primer string
                                                                                     } catch (err) {
                                                                                         console.error('Error al subir imagen:', err);
                                                                                         alert('Error al subir la imagen');
                                                                                     }
                                                                                 }}
                                                                                 className="hidden"
                                                                                 id={`foto-file-multi-${eq.id}`}
                                                                             />
                                                                             <label
                                                                                 htmlFor={`foto-file-multi-${eq.id}`}
                                                                                 className="flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
                                                                                 title="Añadir foto"
                                                                             >
                                                                                 <span className="text-xl leading-none mb-0.5">+</span>
                                                                                 <span className="text-[9px] font-bold">Foto</span>
                                                                             </label>
                                                                         </div>
                                                                     );
                                                                 })()}

                                                                   <div className={`px-4 pb-4 ${algunCheckRojo ? 'border-t border-red-200 pt-3' : 'border-t border-slate-200 pt-3'}`}>
                                                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                                                          <div className="flex items-center gap-2">
                                                                             <button
                                                                                 type="button"
                                                                                 onClick={async () => {
                                                                                     const itemsToUse = getItemsToUse(eq.sistemaId);
                                                                                     const updatedEquipos = equiposInstalados.map(currEq => {
                                                                                         if (currEq.id === eq.id) {
                                                                                             const allChecked: Record<string, any> = {};
                                                                                             itemsToUse.forEach(item => {
                                                                                                 if (item.tipoRespuesta === 'check') {
                                                                                                     allChecked[item.key] = true;
                                                                                                 }
                                                                                             });
                                                                                             return {
                                                                                                 ...currEq,
                                                                                                 revisado: true,
                                                                                                 ...allChecked
                                                                                             };
                                                                                         }
                                                                                         return currEq;
                                                                                     });
                                                                                     setEquiposInstalados(updatedEquipos);
                                                                                     saveEquiposProgress(updatedEquipos);
                                                                                     const equipoModificado = updatedEquipos.find(currEq => currEq.id === eq.id);
                                                                                     if (equipoModificado) {
                                                                                         try { await updateEquipoInstalado(eq.id, equipoModificado as any); } catch (err) { console.error('Error guardando en Firestore:', err); }
                                                                                     }
                                                                                     showToast('Guardado');
                                                                                     // Cambiar estado del parte a "Abierto" si estaba en "Planificado"
                                                                                     if (parte?.estado === 'Planificado') {
                                                                                         updateParte({ estado: 'Abierto' });
                                                                                         const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                                                                                         const parteActual = storedPartes.find((p: any) => p.id === parteId);
                                                                                         const docId = parteActual?._docId || parteId;
                                                                                         try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
                                                                                     }
                                                                                 }}
                                                                                 className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                                                             >
                                                                                 Revisado OK
                                                                             </button>
                                                                             <button
                                                                                 type="button"
                                                                                 onClick={async () => {
                                                                                     const updatedEquipos = equiposInstalados.map(currEq => {
                                                                                         if (currEq.id === eq.id) {
                                                                                             return {
                                                                                                 ...currEq,
                                                                                                 revisado: true
                                                                                             };
                                                                                         }
                                                                                         return currEq;
                                                                                     });
                                                                                     setEquiposInstalados(updatedEquipos);
                                                                                     saveEquiposProgress(updatedEquipos);
                                                                                     const equipoModificado = updatedEquipos.find(currEq => currEq.id === eq.id);
                                                                                     if (equipoModificado) {
                                                                                         try { await updateEquipoInstalado(eq.id, equipoModificado as any); } catch (err) { console.error('Error guardando en Firestore:', err); }
                                                                                     }
                                                                                     showToast('Guardado');
                                                                                     // Cambiar estado del parte a "Abierto" si estaba en "Planificado"
                                                                                     if (parte?.estado === 'Planificado') {
                                                                                         updateParte({ estado: 'Abierto' });
                                                                                         const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                                                                                         const parteActual = storedPartes.find((p: any) => p.id === parteId);
                                                                                         const docId = parteActual?._docId || parteId;
                                                                                         try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
                                                                                     }
                                                                                 }}
                                                                                 className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                                                             >
                                                                                 Revisado con anomalía
                                                                             </button>
                                                                             <button
                                                                                 type="button"
                                                                                 onClick={async () => {
                                                                                     const itemsToUse = getItemsToUse(eq.sistemaId);
                                                                                     const updatedEquipos = equiposInstalados.map(currEq => {
                                                                                         if (currEq.id === eq.id) {
                                                                                             const allFalse: Record<string, any> = {};
                                                                                             itemsToUse.forEach(item => {
                                                                                                 if (item.tipoRespuesta === 'check') {
                                                                                                     allFalse[item.key] = false;
                                                                                                 }
                                                                                             });
                                                                                             // También establecer el campo notas con el texto de anomalía
                                                                                             const notasItem = itemsToUse.find(item => {
                                                                                                 const lbl = (item.label || '').toLowerCase();
                                                                                                 return lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                                                                                             });
                                                                                             if (notasItem) {
                                                                                                 allFalse[notasItem.key] = 'Equipo no revisado por no localizarse en su sitio.';
                                                                                             }
                                                                                             return {
                                                                                                 ...currEq,
                                                                                                 revisado: true,
                                                                                                 ...allFalse,
                                                                                                 anomalias: 'Equipo no revisado por no localizarse en su sitio.'
                                                                                             };
                                                                                         }
                                                                                         return currEq;
                                                                                     });
                                                                                     setEquiposInstalados(updatedEquipos);
                                                                                     saveEquiposProgress(updatedEquipos);
                                                                                     const equipoModificado = updatedEquipos.find(currEq => currEq.id === eq.id);
                                                                                     if (equipoModificado) {
                                                                                         try { await updateEquipoInstalado(eq.id, equipoModificado as any); } catch (err) { console.error('Error guardando en Firestore:', err); }
                                                                                     }
                                                                                     showToast('Guardado');
                                                                                     // Cambiar estado del parte a "Abierto" si estaba en "Planificado"
                                                                                     if (parte?.estado === 'Planificado') {
                                                                                         updateParte({ estado: 'Abierto' });
                                                                                         const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                                                                                         const parteActual = storedPartes.find((p: any) => p.id === parteId);
                                                                                         const docId = parteActual?._docId || parteId;
                                                                                         try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
                                                                                     }
                                                                                 }}
                                                                                 className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                                                             >
                                                                                 Equipo no encontrado
                                                                             </button>
                                                                             <button
                                                                                 type="button"
                                                                                 onClick={async () => {
                                                                                     const itemsToUse = getItemsToUse(eq.sistemaId);
                                                                                     const updatedEquipos = equiposInstalados.map(currEq => {
                                                                                         if (currEq.id === eq.id) {
                                                                                             const cleanedEq = { ...currEq, revisado: false };
                                                                                             cleanedEq.anomalias = ''; // Limpiar siempre anomalías principales
                                                                                             
                                                                                             itemsToUse.forEach(item => {
                                                                                                 const lbl = (item.label || '').toLowerCase();
                                                                                                 const isNotas = lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                                                                                                 
                                                                                                 // Limpiar checks y campos de observaciones
                                                                                                 if (item.tipoRespuesta === 'check') {
                                                                                                     (cleanedEq as any)[item.key] = null;
                                                                                                 } else if (isNotas) {
                                                                                                     (cleanedEq as any)[item.key] = '';
                                                                                                 }
                                                                                             });
                                                                                             return cleanedEq;
                                                                                         }
                                                                                         return currEq;
                                                                                     });
                                                                                     setEquiposInstalados(updatedEquipos);
                                                                                     saveEquiposProgress(updatedEquipos);
                                                                                 }}
                                                                                 className="px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                                                             >
                                                                                 Limpiar Checks
                                                                             </button>
                                                                          </div>
                                                                          <div className="flex items-center gap-1.5">
                                                                              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
                                                                                  <CheckCircle2 className="w-3 h-3" /> {stats.ok}
                                                                              </span>
                                                                              {stats.fail > 0 && (
                                                                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold">
                                                                                      <XCircle className="w-3 h-3" /> {stats.fail}
                                                                                  </span>
                                                                              )}
                                                                              {stats.pending > 0 && (
                                                                                  <span className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded-lg text-xs font-bold">
                                                                                      {stats.pending}?
                                                                                  </span>
                                                                              )}
                                                                              <div className="w-px h-5 bg-slate-200" />
                                                                              <button
                                                                                  onClick={() => setEditEquipo({ id: eq.id, codigo: eq.codigo || '', nombre: eq.nombre || '', ubicacion: eq.ubicacion || '', placa: eq.placa || '', fechaFabricacion: eq.fechaFabricacion || '', ultimoRetimbre: eq.ultimoRetimbre || '' })}
                                                                                  className="p-1.5 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                                                                                  title="Editar equipo"
                                                                              >
                                                                                  <Pencil className="w-3.5 h-3.5" />
                                                                              </button>
                                                                              <button
                                                                                  onClick={() => handleDeleteEquipo(eq.id)}
                                                                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                                                  title="Eliminar equipo"
                                                                              >
                                                                                  <Trash2 className="w-3.5 h-3.5" />
                                                                              </button>
                                                                          </div>
                                                                      </div>
                                                                 </div>
                                                            </div>
                                                        );
                                                    })
                                                );
                                            })()}
                                        </div>
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
                        onClick={handlePreviewPDF}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all text-sm sm:w-auto"
                    >
                        <Eye className="w-4 h-4" /> Previsualizar Acta
                    </button>
                    <button
                        onClick={handlePauseRevision}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-all text-sm sm:w-auto"
                    >
                        <Save className="w-4 h-4" /> Pausar Revisión
                    </button>
                    <button
                        onClick={handleSaveRevision}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all text-sm sm:w-auto"
                    >
                        <Save className="w-4 h-4" /> Finalizar Revisión
                    </button>
                </div>
            </div>

            {/* MODAL EDITAR EQUIPO */}
            {editEquipo && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Pencil className="w-5 h-5 text-slate-600" /> Editar equipo
                            </h2>
                            <button onClick={() => setEditEquipo(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Código</label>
                                <input
                                    type="text"
                                    value={editEquipo.codigo}
                                    onChange={e => setEditEquipo(prev => prev ? { ...prev, codigo: e.target.value } : null)}
                                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setEditEquipo(null)}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!editEquipo) return;
                                    const updated = equiposInstalados.map(eq =>
                                        eq.id === editEquipo.id
                                            ? { ...eq, codigo: editEquipo.codigo, nombre: editEquipo.nombre, ubicacion: editEquipo.ubicacion, placa: editEquipo.placa, fechaFabricacion: editEquipo.fechaFabricacion, ultimoRetimbre: editEquipo.ultimoRetimbre }
                                            : eq
                                    );
                                    setEquiposInstalados(updated);
                                    saveEquiposProgress(updated);
                                    setEditEquipo(null);
                                }}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
                            >
                                Guardar cambios
                            </button>
                        </div>
                    </div>
                </div>
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