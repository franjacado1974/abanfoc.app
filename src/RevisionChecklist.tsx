import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Building2, Layers, MapPin, FileText, ChevronDown, ChevronRight, Plus, X, CheckCircle2, XCircle, Trash2, AlertTriangle, Pencil, PenLine, RotateCcw, CheckCheck, Eye } from 'lucide-react';
import { addAlbaran, updateEquipoInstalado, updateParte as updateParteFirestore, subscribePartes, subscribeCentros, subscribeClientes, subscribeCentroSistemas, subscribeEquiposInstalados, subscribeArticulos, subscribeSistemasCategorias, type Albaran, type Tecnico } from './firebase';
import type { Centro, Parte, Cliente, CentroSistema, EquipoInstalado } from './Centros';
import ConfirmationModal from './ConfirmationModal';
import { getIconForSistema } from './Sistemas';
import { generarActaExtintoresPDFView } from './pdfGenerator';

const CHECKLIST_ITEMS = [
    { key: 'checkAcceso', label: 'Acceso' },
    { key: 'checkAltura', label: 'Altura' },
    { key: 'checkSoporte', label: 'Soporte' },
    { key: 'checkSenalizacion', label: 'Señalización' },
    { key: 'checkManguera', label: 'Manguera' },
    { key: 'checkPeso', label: 'Peso' },
    { key: 'checkManometro', label: 'Manómetro' },
    { key: 'checkMarcado', label: 'Marcado' },
    { key: 'checkEtiquetas', label: 'Etiquetas' },
    { key: 'checkRetimbre', label: 'Retimbre' },
    { key: 'checkRiesgo', label: 'Riesgo' },
    { key: 'checkDistancia', label: 'Distancia' },
    { key: 'checkPasador', label: 'Pasador' },
    { key: 'checkMovilidad', label: 'Movilidad' },
];

export default function RevisionChecklist() {
    const navigate = useNavigate();
    const location = useLocation();
    const { centroId, parteId } = location.state || {};

    const [centro, setCentro] = useState<Centro | null>(null);
    const [parte, setParte] = useState<Parte | null>(null);
    const [sistemasDelCentro, setSistemasDelCentro] = useState<CentroSistema[]>([]);
    const [equiposInstalados, setEquiposInstalados] = useState<EquipoInstalado[]>([]);
    const [equiposCatalogo, setEquiposCatalogo] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_sistemas_equipos') || '[]'));
    const [categoriasSistema, setCategoriasSistema] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_sistemas_categorias') || '[]'));
    const [loading, setLoading] = useState(true);
    const [clientes, setClientes] = useState<Cliente[]>(() => JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'));
    const [openSistemas, setOpenSistemas] = useState<Record<string, boolean>>({});
    const [selectedCatalogItem, setSelectedCatalogItem] = useState<string>('');
    const [newEquipo, setNewEquipo] = useState<{ codigo: string; nombre: string; ubicacion: string; placa: string; fechaFabricacion: string; ultimoRetimbre: string }>({ codigo: '', nombre: '', ubicacion: '', placa: '', fechaFabricacion: '', ultimoRetimbre: '' });
    const [addSistemaId, setAddSistemaId] = useState<string | null>(null);

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [equipoIdToDelete, setEquipoIdToDelete] = useState<string | null>(null);

    // Estado para modal de edición de equipo
    const [editEquipo, setEditEquipo] = useState<{ id: string; codigo: string; nombre: string; ubicacion: string; placa: string; fechaFabricacion: string; ultimoRetimbre: string } | null>(null);

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
                // Normalizar equipos según el estado del parte
                const normalizedItems = items.map(eq => {
                    // Si el parte está en "Planificado", es una nueva revisión
                    // Resetear todos los checks a null para que el técnico revise de nuevo
                    if (parte?.estado === 'Planificado') {
                        const normalized = { ...eq, revisado: false };
                        CHECKLIST_ITEMS.forEach(item => {
                            (normalized as any)[item.key] = null;
                        });
                        // Mantener las anomalías anteriores como referencia pero limpiar para nueva revisión
                        normalized.anomalias = '';
                        return normalized;
                    }
                    // Si el parte ya está en otro estado (Abierto, etc.), mantener los valores actuales
                    return eq;
                });
                setEquiposInstalados(prev => {
                    const otros = prev.filter(e => e.sistemaId !== sist.id);
                    return [...otros, ...normalizedItems];
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

    const handleCheckChange = (equipoId: string, checkKey: keyof EquipoInstalado, value: boolean) => {
        setEquiposInstalados(prevEquipos =>
            prevEquipos.map(eq =>
                eq.id === equipoId ? { ...eq, [checkKey]: value, revisado: true } : eq
            )
        );
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
        ''
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

        const equiposInvalidos = equiposInstalados.filter((eq) => {
            const algunCheckRojo = CHECKLIST_ITEMS.some((item) => eq[item.key as keyof EquipoInstalado] === false);
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

    const confirmDeleteEquipo = () => {
        if (!equipoIdToDelete) return;
        setIsConfirmModalOpen(false);
        const updatedEquipos = equiposInstalados.filter(eq => eq.id !== equipoIdToDelete);
        setEquiposInstalados(updatedEquipos);

        const allEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        const updatedAll = allEquipos.filter((eq: any) => eq.id !== equipoIdToDelete);
        localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(updatedAll));
    };

    const toggleSistema = (sistemaId: string) => {
        setOpenSistemas(prev => ({ ...prev, [sistemaId]: !prev[sistemaId] }));
    };

    const openAddModal = (sistemaId: string) => {
        setAddSistemaId(sistemaId);
        setSelectedCatalogItem('');

        const eqDelSist = equiposInstalados.filter(eq => eq.sistemaId === sistemaId);
        let nextCode = '01';
        if (eqDelSist.length > 0) {
            const nums = eqDelSist.map(eq => parseInt(eq.codigo)).filter(n => !isNaN(n));
            const startNum = nums.length > 0 ? Math.max(...nums) + 1 : eqDelSist.length + 1;
            nextCode = startNum.toString().padStart(2, '0');
        }

        setNewEquipo({ codigo: nextCode, nombre: '', ubicacion: '', placa: '', fechaFabricacion: '', ultimoRetimbre: '' });
    };

    const closeAddModal = () => {
        setAddSistemaId(null);
        setNewEquipo({ codigo: '', nombre: '', ubicacion: '', placa: '', fechaFabricacion: '', ultimoRetimbre: '' });
        setSelectedCatalogItem('');
    };

    const handleAddEquipo = (sistemaId: string) => {
        if (!newEquipo.codigo.trim() || !newEquipo.nombre.trim()) {
            alert('El código y el nombre son obligatorios.');
            return;
        }

        const nuevoEquipo: EquipoInstalado = {
            id: `EQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            centroId: centroId,
            sistemaId: sistemaId,
            codigo: newEquipo.codigo.trim(),
            nombre: newEquipo.nombre.trim(),
            ubicacion: newEquipo.ubicacion.trim(),
            placa: newEquipo.placa.trim(),
            fechaFabricacion: newEquipo.fechaFabricacion,
            ultimoRetimbre: newEquipo.ultimoRetimbre,
            revisado: false,
            checkAcceso: null, checkAltura: null, checkSoporte: null, checkSenalizacion: null, checkManguera: null,
            checkPeso: null, checkManometro: null, checkMarcado: null, checkEtiquetas: null, checkRetimbre: null,
            checkRiesgo: null, checkDistancia: null, checkPasador: null, checkMovilidad: null
        };

        const updatedEquipos = [...equiposInstalados, nuevoEquipo];
        setEquiposInstalados(updatedEquipos);

        const allEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify([...allEquipos, nuevoEquipo]));

        setNewEquipo({ codigo: '', nombre: '', ubicacion: '', placa: '', fechaFabricacion: '', ultimoRetimbre: '' });
        setSelectedCatalogItem('');
        closeAddModal();
    };

    const getFilteredCatalog = (sistName: string) => {
        if (!sistName) return [];
        const normalize = (s: string) => 
            (s || '')
             .toLowerCase()
             .normalize('NFD')
             .replace(/[\u0300-\u036f]/g, '') // Quita tildes
             .replace(/^sistema\s+/i, '')     // Quita el prefijo "Sistema "
             .trim();
             
        const target = normalize(sistName);
        if (!target) return [];

        return equiposCatalogo.filter(eq => {
            const eqFam = normalize(eq.familia);
            // Validamos que eqFam no esté vacío para evitar que target.includes("") devuelva true
            if (eqFam && (eqFam === target || eqFam.includes(target) || target.includes(eqFam))) return true;
            
            const cat = categoriasSistema.find(c => c.id === eq.idCategoria || c.id === eq.familiaId);
            const catName = cat ? normalize(cat.nombre) : '';
            return catName && (catName === target || catName.includes(target) || target.includes(catName));
        });
    };

    const sistemaTieneAnomalias = (sistemaId: string) => {
        const equiposSistema = equiposInstalados.filter((eq) => eq.sistemaId === sistemaId);
        return equiposSistema.some((eq) => {
            const checkRojo = CHECKLIST_ITEMS.some((item) => eq[item.key as keyof EquipoInstalado] === false);
            const textoAnomalia = !!eq.anomalias && eq.anomalias.trim() !== '';
            return checkRojo || textoAnomalia;
        });
    };

    const getCheckStats = (eq: EquipoInstalado) => {
        let ok = 0;
        let fail = 0;
        let pending = 0;
        CHECKLIST_ITEMS.forEach(item => {
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
    const currentAddSistema = sistemasDelCentro.find(s => s.id === addSistemaId);
    const filteredCatalog = currentAddSistema ? getFilteredCatalog(currentAddSistema.tipo || currentAddSistema.familia || '') : [];

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
                        sistemasDelCentro.map(sist => {
                            // Buscar la imagen del sistema en categoriasSistema (cargado desde Firestore)
                            const sistemaCat = categoriasSistema.find(c => {
                                const nombreSist = (sist.tipo || sist.familia || '').toLowerCase().trim();
                                const nombreCat = (c.nombre || '').toLowerCase().trim();
                                return nombreCat.includes(nombreSist) || nombreSist.includes(nombreCat);
                            });
                            const imagenUrl = sistemaCat?.imagenUrl;
                            const IconoCat = imagenUrl || getIconForSistema(sist.tipo || sist.familia || '');
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
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 overflow-hidden ${openSistemas[sist.id] ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {typeof IconoCat === 'string' ? (
                                                    <img src={IconoCat} alt="Icon" className="w-6 h-6 object-contain opacity-80" />
                                                ) : (
                                                    <IconoCat className="w-5 h-5" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h2 className="text-lg font-semibold text-slate-800 truncate">
                                                    {sist.familia || sist.tipo}
                                                </h2>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {equiposInstalados.filter(eq => eq.sistemaId === sist.id).length} equipos
                                                </p>
                                            </div>
                                        </button>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {openSistemas[sist.id] && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); openAddModal(sist.id); }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Añadir
                                                </button>
                                            )}
                                            {sistemaTieneAnomalias(sist.id) && (
                                                <span title="Este sistema tiene anomalías">
                                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                                </span>
                                            )}
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${openSistemas[sist.id] ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                                                {openSistemas[sist.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </div>
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
                                                onClick={(e) => { e.stopPropagation(); openAddModal(sist.id); }}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-indigo-200"
                                            >
                                                <Plus className="w-4 h-4" /> Añadir equipo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    // Revisar todos los equipos del sistema
                                                    const updatedEquipos = equiposInstalados.map(eq => {
                                                        if (eq.sistemaId === sist.id) {
                                                            return {
                                                                ...eq,
                                                                revisado: true,
                                                                checkAcceso: true, checkAltura: true, checkSoporte: true, checkSenalizacion: true, checkManguera: true,
                                                                checkPeso: true, checkManometro: true, checkMarcado: true, checkEtiquetas: true, checkRetimbre: true,
                                                                checkRiesgo: true, checkDistancia: true, checkPasador: true, checkMovilidad: true
                                                            };
                                                        }
                                                        return eq;
                                                    });
                                                    setEquiposInstalados(updatedEquipos);
                                                    saveEquiposProgress(updatedEquipos);
                                                    // Cambiar estado del parte a "Abierto" si estaba en "Planificado"
                                                    if (parte?.estado === 'Planificado') {
                                                        updateParte({ estado: 'Abierto' });
                                                        const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                                                        const parteActual = storedPartes.find((p: any) => p.id === parteId);
                                                        const docId = parteActual?._docId || parteId;
                                                        try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
                                                    }
                                                }}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-green-200"
                                            >
                                                <CheckCheck className="w-4 h-4" /> Revisar todo
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
                                                        const algunCheckRojo = CHECKLIST_ITEMS.some((item) => eq[item.key as keyof EquipoInstalado] === false);
                                                        const anomaliaObligatoriaVacia = algunCheckRojo && (!eq.anomalias || eq.anomalias.trim() === '');
                                                        const stats = getCheckStats(eq);

                                                        return (
                                                            <div key={eq.id} className={`rounded-xl border transition-all ${algunCheckRojo ? 'bg-red-50/30 border-red-200' : 'bg-slate-50 border-slate-150'}`}>
                                                                <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                                                                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                                        <span className="px-3 py-1 bg-black text-white text-sm font-mono font-bold rounded-lg shadow-md min-w-[36px] text-center shrink-0">
                                                                            {eq.codigo || (i + 1).toString().padStart(2, '0')}
                                                                        </span>
                                                                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0 uppercase">
                                                                            <span className="text-sm font-semibold text-slate-700">{eq.nombre}</span>
                                                                            {eq.placa && (
                                                                                <><span className="text-slate-300 font-light">/</span><span className="text-sm font-medium text-slate-500">#{eq.placa}</span></>
                                                                            )}
                                                                            {eq.ubicacion && (
                                                                                <><span className="text-slate-300 font-light">/</span><span className="text-sm font-medium text-slate-500">{eq.ubicacion}</span></>
                                                                            )}
                                                                            {eq.fechaFabricacion && (
                                                                                <><span className="text-slate-300 font-light">/</span><span className="text-sm font-medium text-slate-500">F. Fabricación {eq.fechaFabricacion.substring(0,7).split('-').reverse().join('-')}</span></>
                                                                            )}
                                                                            {eq.ultimoRetimbre && (
                                                                                <><span className="text-slate-300 font-light">/</span><span className="text-sm font-medium text-slate-500">F. Retimbre {eq.ultimoRetimbre.substring(0,7).split('-').reverse().join('-')}</span></>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                    </div>
                                                                </div>

                                                                <div className="px-4 pb-3">
                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-1.5">
                                                                        {CHECKLIST_ITEMS.map(item => {
                                                                            const val = eq[item.key as keyof EquipoInstalado];
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
                                                                                        onChange={(e) => handleCheckChange(eq.id, item.key as keyof EquipoInstalado, e.target.checked)}
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
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                <div className={`px-4 pb-4 ${algunCheckRojo ? 'border-t border-red-200 pt-3' : 'border-t border-slate-200 pt-3'}`}>
                                                                    <div className="flex items-center justify-between mb-1.5">
                                                                        <label className={`text-xs font-semibold ${anomaliaObligatoriaVacia ? 'text-red-600' : 'text-slate-600'}`}>
                                                                            Anomalías / Observaciones {algunCheckRojo ? <span className="text-red-500">(obligatorio)</span> : ''}
                                                                        </label>
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
                                                                            <div className="w-px h-4 bg-slate-200 mx-0.5" />
                                                                            <button
                                                                                onClick={() => setEditEquipo({ id: eq.id, codigo: eq.codigo || '', nombre: eq.nombre || '', ubicacion: eq.ubicacion || '', placa: eq.placa || '', fechaFabricacion: eq.fechaFabricacion || '', ultimoRetimbre: eq.ultimoRetimbre || '' })}
                                                                                className="p-1 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                                                                                title="Editar equipo"
                                                                            >
                                                                                <Pencil className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteEquipo(eq.id)}
                                                                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                                                title="Eliminar equipo"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <textarea
                                                                        value={eq.anomalias || ''}
                                                                        onChange={(e) => setEquiposInstalados(prevEquipos =>
                                                                            prevEquipos.map(currEq =>
                                                                                currEq.id === eq.id ? { ...currEq, anomalias: e.target.value, revisado: true } : currEq
                                                                            )
                                                                        )}
                                                                        className={`w-full px-3 py-2.5 rounded-lg text-sm resize-none outline-none transition-all ${
                                                                            anomaliaObligatoriaVacia
                                                                                ? 'bg-red-50 border-2 border-red-300 text-red-700 placeholder-red-400 focus:ring-2 focus:ring-red-500/20'
                                                                                : 'bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                                                                        }`}
                                                                        rows={2}
                                                                        placeholder={algunCheckRojo ? 'Obligatorio: describe la anomalía encontrada...' : 'Añadir anomalías, observaciones o notas...'}
                                                                    />
                                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={async () => {
                                                                                const updatedEquipos = equiposInstalados.map(currEq => {
                                                                                    if (currEq.id === eq.id) {
                                                                                        return {
                                                                                            ...currEq,
                                                                                            revisado: true,
                                                                                            checkAcceso: true, checkAltura: true, checkSoporte: true, checkSenalizacion: true, checkManguera: true,
                                                                                            checkPeso: true, checkManometro: true, checkMarcado: true, checkEtiquetas: true, checkRetimbre: true,
                                                                                            checkRiesgo: true, checkDistancia: true, checkPasador: true, checkMovilidad: true
                                                                                        };
                                                                                    }
                                                                                    return currEq;
                                                                                });
                                                                                setEquiposInstalados(updatedEquipos);
                                                                                saveEquiposProgress(updatedEquipos);
                                                                                // Cambiar estado del parte a "Abierto" si estaba en "Planificado"
                                                                                if (parte?.estado === 'Planificado') {
                                                                                    updateParte({ estado: 'Abierto' });
                                                                                    const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                                                                                    const parteActual = storedPartes.find((p: any) => p.id === parteId);
                                                                                    const docId = parteActual?._docId || parteId;
                                                                                    try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
                                                                                }
                                                                            }}
                                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                                                        >
                                                                            <CheckCheck className="w-4 h-4" /> Revisado
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={async () => {
                                                                                const updatedEquipos = equiposInstalados.map(currEq => {
                                                                                    if (currEq.id === eq.id) {
                                                                                        return {
                                                                                            ...currEq,
                                                                                            revisado: true,
                                                                                    checkAcceso: false, checkAltura: false, checkSoporte: false, checkSenalizacion: false, checkManguera: false,
                                                                                    checkPeso: false, checkManometro: false, checkMarcado: false, checkEtiquetas: false, checkRetimbre: false,
                                                                                    checkRiesgo: false, checkDistancia: false, checkPasador: false, checkMovilidad: false,
                                                                                            anomalias: 'Equipo no revisado por no localizarse en su lugar.'
                                                                                        };
                                                                                    }
                                                                                    return currEq;
                                                                                });
                                                                                setEquiposInstalados(updatedEquipos);
                                                                                saveEquiposProgress(updatedEquipos);
                                                                                // Cambiar estado del parte a "Abierto" si estaba en "Planificado"
                                                                                if (parte?.estado === 'Planificado') {
                                                                                    updateParte({ estado: 'Abierto' });
                                                                                    const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                                                                                    const parteActual = storedPartes.find((p: any) => p.id === parteId);
                                                                                    const docId = parteActual?._docId || parteId;
                                                                                    try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
                                                                                }
                                                                            }}
                                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                                                        >
                                                                            <AlertTriangle className="w-4 h-4" /> Equipo no encontrado
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={async () => {
                                                                                const updatedEquipos = equiposInstalados.map(currEq => {
                                                                                    if (currEq.id === eq.id) {
                                                                                        const cleanedEq = { ...currEq, revisado: false, anomalias: '' };
                                                                                        CHECKLIST_ITEMS.forEach(item => {
                                                                                            (cleanedEq as any)[item.key] = null;
                                                                                        });
                                                                                        return cleanedEq;
                                                                                    }
                                                                                    return currEq;
                                                                                });
                                                                                setEquiposInstalados(updatedEquipos);
                                                                                saveEquiposProgress(updatedEquipos);
                                                                            }}
                                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                                                        >
                                                                            <RotateCcw className="w-4 h-4" /> Limpiar
                                                                        </button>
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

            {/* MODAL AÑADIR EQUIPO */}
            {addSistemaId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Plus className="w-5 h-5 text-slate-600" /> Añadir equipo
                                </h2>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                                    Sistema: {currentAddSistema?.familia || currentAddSistema?.tipo}
                                </p>
                            </div>
                            <button onClick={closeAddModal} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Catalog Helper */}
                            <div className="pb-4 border-b border-slate-100">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Autocompletar desde catálogo</label>
                                <select
                                    value={selectedCatalogItem}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setSelectedCatalogItem(val);
                                        const itemBase = equiposCatalogo.find(eq => eq.id === val);
                                        if (itemBase) {
                                            setNewEquipo(prev => ({ ...prev, nombre: itemBase.nombre }));
                                        }
                                    }}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">-- Selecciona para cargar nombre --</option>
                                    {filteredCatalog.map((eq: any) => (
                                        <option key={eq.id} value={eq.id}>{eq.codigo} - {eq.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Código</label>
                                    <input
                                        type="text"
                                        value={newEquipo.codigo}
                                        onChange={e => setNewEquipo(prev => ({ ...prev, codigo: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Placa</label>
                                    <input
                                        type="text"
                                        value={newEquipo.placa}
                                        onChange={e => setNewEquipo(prev => ({ ...prev, placa: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                        placeholder="Ej: PL-12345"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nombre</label>
                                <input
                                    type="text"
                                    value={newEquipo.nombre}
                                    onChange={e => setNewEquipo(prev => ({ ...prev, nombre: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    placeholder="Ej: Extintor CO2 5kg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ubicación</label>
                                <input
                                    type="text"
                                    value={newEquipo.ubicacion}
                                    onChange={e => setNewEquipo(prev => ({ ...prev, ubicacion: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    placeholder="Ej: Planta baja, entrada"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">F. Fabricación</label>
                                    <input
                                        type="month"
                                        value={newEquipo.fechaFabricacion ? newEquipo.fechaFabricacion.substring(0, 7) : ''}
                                        onChange={e => setNewEquipo(prev => ({ ...prev, fechaFabricacion: e.target.value ? e.target.value + '-01' : '' }))}
                                        className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">F. Retimbre</label>
                                    <input
                                        type="month"
                                        value={newEquipo.ultimoRetimbre ? newEquipo.ultimoRetimbre.substring(0, 7) : ''}
                                        onChange={e => setNewEquipo(prev => ({ ...prev, ultimoRetimbre: e.target.value ? e.target.value + '-01' : '' }))}
                                        className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button
                                type="button"
                                onClick={closeAddModal}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => addSistemaId && handleAddEquipo(addSistemaId)}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
                            >
                                Guardar equipo
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Código</label>
                                    <input
                                        type="text"
                                        value={editEquipo.codigo}
                                        onChange={e => setEditEquipo(prev => prev ? { ...prev, codigo: e.target.value } : null)}
                                        className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Placa</label>
                                    <input
                                        type="text"
                                        value={editEquipo.placa}
                                        onChange={e => setEditEquipo(prev => prev ? { ...prev, placa: e.target.value } : null)}
                                        className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                        placeholder="Ej: PL-12345"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nombre</label>
                                <input
                                    type="text"
                                    value={editEquipo.nombre}
                                    onChange={e => setEditEquipo(prev => prev ? { ...prev, nombre: e.target.value } : null)}
                                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    placeholder="Ej: Extintor CO2 5kg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ubicación</label>
                                <input
                                    type="text"
                                    value={editEquipo.ubicacion}
                                    onChange={e => setEditEquipo(prev => prev ? { ...prev, ubicacion: e.target.value } : null)}
                                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    placeholder="Ej: Planta baja, entrada"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">F. Fabricación</label>
                                    <input
                                        type="month"
                                        value={editEquipo.fechaFabricacion ? editEquipo.fechaFabricacion.substring(0, 7) : ''}
                                        onChange={e => setEditEquipo(prev => prev ? { ...prev, fechaFabricacion: e.target.value ? e.target.value + '-01' : '' } : null)}
                                        className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">F. Retimbre</label>
                                    <input
                                        type="month"
                                        value={editEquipo.ultimoRetimbre ? editEquipo.ultimoRetimbre.substring(0, 7) : ''}
                                        onChange={e => setEditEquipo(prev => prev ? { ...prev, ultimoRetimbre: e.target.value ? e.target.value + '-01' : '' } : null)}
                                        className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
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
        </div>
    );
}
