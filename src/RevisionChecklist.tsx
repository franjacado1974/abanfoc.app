import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Building2, Layers, MapPin, FileText, ChevronDown, ChevronRight, Plus, X, CheckCircle2, XCircle, Trash2, AlertTriangle } from 'lucide-react';
import type { Centro, Parte, Cliente, CentroSistema, EquipoInstalado } from './Centros';
import { updateEquipoInstalado } from './firebase';
import ConfirmationModal from './ConfirmationModal';

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

    const [centro, setCentro] = useState<Centro | null>(() => {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
        return stored.find((c: any) => c.id === (location.state?.centroId)) || null;
    });
    const [parte, setParte] = useState<Parte | null>(() => {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
        return stored.find((p: any) => p.id === (location.state?.parteId)) || null;
    });
    const [sistemasDelCentro, setSistemasDelCentro] = useState<CentroSistema[]>(() => {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]');
        return stored.filter((s: any) => s.centroId === (location.state?.centroId));
    });
    const [equiposInstalados, setEquiposInstalados] = useState<EquipoInstalado[]>(() => {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        return stored.filter((e: any) => e.centroId === (location.state?.centroId));
    });
    const [equiposCatalogo, setEquiposCatalogo] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_sistemas_equipos') || '[]'));
    const [categoriasSistema, setCategoriasSistema] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_sistemas_categorias') || '[]'));
    const [loading, setLoading] = useState(true);
    const [clientes, setClientes] = useState<Cliente[]>(() => JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'));
    const [openSistemas, setOpenSistemas] = useState<Record<string, boolean>>({});
    const [selectedCatalogItem, setSelectedCatalogItem] = useState<string>('');
    const [addQuantity, setAddQuantity] = useState(1);
    const [newEquipo, setNewEquipo] = useState<{ codigo: string; nombre: string; ubicacion: string; placa: string }>({ codigo: '', nombre: '', ubicacion: '', placa: '' });
    const [addSistemaId, setAddSistemaId] = useState<string | null>(null);

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [equipoIdToDelete, setEquipoIdToDelete] = useState<string | null>(null);

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

    const handleAddFromCatalog = (sistemaId: string) => {
        if (!selectedCatalogItem) {
            alert('Por favor, selecciona un equipo del catálogo.');
            return;
        }

        const itemBase = equiposCatalogo.find(e => e.id === selectedCatalogItem);
        if (!itemBase) return;

        // Calcular correlativo para añadir desde catálogo
        const eqDelSist = equiposInstalados.filter(eq => eq.sistemaId === sistemaId);
        let startNum = 1;
        if (eqDelSist.length > 0) {
            const nums = eqDelSist.map(eq => parseInt(eq.codigo)).filter(n => !isNaN(n));
            startNum = nums.length > 0 ? Math.max(...nums) + 1 : eqDelSist.length + 1;
        }

        const newItems: EquipoInstalado[] = [];
        for (let i = 0; i < addQuantity; i++) {
            newItems.push({
                id: `EQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                centroId: centroId,
                sistemaId: sistemaId,
                codigo: (startNum + i).toString().padStart(2, '0'), // Asignación correlativa automática
                nombre: itemBase.nombre,
                ubicacion: '',
                placa: '',
                revisado: false,
                // Initialize all checks to true by default
                checkAcceso: true, checkAltura: true, checkSoporte: true, checkSenalizacion: true, checkManguera: true,
                checkPeso: true, checkManometro: true, checkMarcado: true, checkEtiquetas: true, checkRetimbre: true,
                checkRiesgo: true, checkDistancia: true, checkPasador: true, checkMovilidad: true
            });
        }

        const updatedEquipos = [...equiposInstalados, ...newItems];
        setEquiposInstalados(updatedEquipos);
        saveEquiposProgress(updatedEquipos);
        closeAddModal();
    };

    useEffect(() => {
        if (!centroId || !parteId) {
            alert('Faltan datos para iniciar la revisión.');
            navigate('/partes');
            return;
        }

        try {
            const storedCentros = JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
            const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
            const storedSistemas = JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]');
            const storedEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
            const storedClientes = JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]');
            const storedCat = JSON.parse(localStorage.getItem('firecheck_db_sistemas_equipos') || '[]');
            const storedCategories = JSON.parse(localStorage.getItem('firecheck_db_sistemas_categorias') || '[]');

            const currentCentro = storedCentros.find((c: any) => c.id === centroId);
            const currentParte = storedPartes.find((p: any) => p.id === parteId);
            const sistemas = storedSistemas.filter((s: CentroSistema) => s.centroId === centroId);
            const equipos = storedEquipos.filter((e: EquipoInstalado) => e.centroId === centroId);

            setCentro(currentCentro);
            setParte(currentParte);
            setSistemasDelCentro(sistemas);
            setEquiposInstalados(equipos);
            setEquiposCatalogo(storedCat);
            setCategoriasSistema(storedCategories);
            setClientes(storedClientes);
            const initialOpen: Record<string, boolean> = {};
            sistemas.forEach((s: CentroSistema) => { initialOpen[s.id] = false; });
            setOpenSistemas(initialOpen);

            if (currentParte && currentParte.estado === 'Planificado') {
                const updatedPartes = storedPartes.map((p: any) =>
                    p.id === parteId ? { ...p, estado: 'Descargado (Offline)' } : p
                );
                localStorage.setItem('firecheck_db_partes', JSON.stringify(updatedPartes));
                setParte({ ...currentParte, estado: 'Descargado (Offline)' });
            }

        } catch (e) {
            console.error("Error loading data for checklist:", e);
            alert('Error al cargar los datos de la revisión.');
            navigate('/partes');
        } finally {
            setLoading(false);
        }
    }, [centroId, parteId, navigate]);

    const handleCheckChange = (equipoId: string, checkKey: keyof EquipoInstalado, value: boolean) => {
        setEquiposInstalados(prevEquipos =>
            prevEquipos.map(eq =>
                eq.id === equipoId ? { ...eq, [checkKey]: value } : eq
            )
        );
    };

    const handleSaveRevision = () => {
        if (!parteId) return;

        const equiposInvalidos = equiposInstalados.filter((eq) => {
            const algunCheckRojo = CHECKLIST_ITEMS.some((item) => eq[item.key as keyof EquipoInstalado] === false);
            const anomaliaVacia = !eq.anomalias || eq.anomalias.trim() === '';
            return algunCheckRojo && anomaliaVacia;
        });

        if (equiposInvalidos.length > 0) {
            alert('Hay equipos con checks en rojo. Debes escribir la anomalía obligatoriamente en esos equipos.');
            return;
        }

        const numMant = `MANT-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        saveEquiposProgress();
        updateParte({ estado: 'Finalizado', numeroMantenimiento: numMant });

        alert('Revisión finalizada y guardada.');
        navigate('/partes');
    };

    const handlePauseRevision = () => {
        if (!parteId) return;

        saveEquiposProgress();
        updateParte({ estado: 'Descargado (Offline)' });

        alert('Revisión pausada. Todos los datos se han guardado.');
        navigate('/partes');
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
        setOpenSistemas(prev => {
            const isCurrentlyOpen = prev[sistemaId];
            return { ...prev, [sistemaId]: !isCurrentlyOpen };
        });
    };

    const openAddModal = (sistemaId: string) => {
        setAddSistemaId(sistemaId);
        setSelectedCatalogItem('');
        
        // Calcular correlativo para pre-rellenar el campo manual
        const eqDelSist = equiposInstalados.filter(eq => eq.sistemaId === sistemaId);
        let nextCode = '01';
        if (eqDelSist.length > 0) {
            const nums = eqDelSist.map(eq => parseInt(eq.codigo)).filter(n => !isNaN(n));
            const startNum = nums.length > 0 ? Math.max(...nums) + 1 : eqDelSist.length + 1;
            nextCode = startNum.toString().padStart(2, '0');
        }

        setNewEquipo({ codigo: nextCode, nombre: '', ubicacion: '', placa: '' });
        setAddQuantity(1);
    };

    const closeAddModal = () => {
        setAddSistemaId(null);
        setNewEquipo({ codigo: '', nombre: '', ubicacion: '', placa: '' });
        setSelectedCatalogItem('');
        setAddQuantity(1);
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
            revisado: false,
            checkAcceso: true,
            checkAltura: true,
            checkSoporte: true,
            checkSenalizacion: true,
            checkManguera: true,
            checkPeso: true,
            checkManometro: true,
            checkMarcado: true,
            checkEtiquetas: true,
            checkRetimbre: true,
            checkRiesgo: true,
            checkDistancia: true,
            checkPasador: true,
            checkMovilidad: true
        };

        const updatedEquipos = [...equiposInstalados, nuevoEquipo];
        setEquiposInstalados(updatedEquipos);

        const allEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify([...allEquipos, nuevoEquipo]));

        setNewEquipo({ codigo: '', nombre: '', ubicacion: '', placa: '' });
        setSelectedCatalogItem('');
        setAddQuantity(1);
        closeAddModal();
    };

    const getFilteredCatalog = (sistType: string) => {
        return equiposCatalogo.filter(eq => {
            const cat = categoriasSistema.find(c => c.id === eq.idCategoria);
            if (!cat) return false;
            const searchType = sistType.toUpperCase();
            return searchType.includes(cat.nombre.toUpperCase());
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
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-red-100 text-center max-w-md">
                    <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <p className="text-red-600 font-medium">Error: No se pudo cargar la información del centro o parte.</p>
                </div>
            </div>
        );
    }

    // Movemos esto aquí para evitar errores si centro es null
    const clientInfo = clientes.find(cl => cl.id === centro.clienteId);
    const currentAddSistema = sistemasDelCentro.find(s => s.id === addSistemaId);
    const filteredCatalog = currentAddSistema ? getFilteredCatalog(currentAddSistema.tipo || currentAddSistema.familia || '') : [];

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => navigate('/partes')}
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver a Partes
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
                        sistemasDelCentro.map(sist => (
                            <div key={sist.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-shadow hover:shadow-md">
                                {/* Accordion Header - Sticky */}
                                <div className="sticky top-[57px] z-10 bg-white px-6 py-4 border-b border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => toggleSistema(sist.id)}
                                            className="flex items-center gap-3 text-left flex-1 min-w-0"
                                        >
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${openSistemas[sist.id] ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                <Layers className="w-5 h-5" />
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
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openAddModal(sist.id);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
                                                    title="Añadir otro equipo a este sistema"
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
                                                {openSistemas[sist.id] ? (
                                                    <ChevronDown className="w-4 h-4" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4" />
                                                )}
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

                                        {/* Add Equipment Button */}
                                        <div className="mb-5">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openAddModal(sist.id);
                                                }}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-indigo-200"
                                            >
                                                <Plus className="w-4 h-4" /> Añadir equipo
                                            </button>
                                        </div>

                                        {/* Equipment List */}
                                        <div className="space-y-4">
                                            {(() => {
                                                const filteredEqs = equiposInstalados.filter(eq => eq.sistemaId === sist.id);
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
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="px-3 py-1 bg-black text-white text-sm font-mono font-bold rounded-lg shadow-md min-w-[36px] text-center">
                                                                    {eq.codigo || (i + 1).toString().padStart(2, '0')}
                                                                </span>
                                                                <span className="text-sm font-semibold text-slate-700">
                                                                    {eq.nombre}
                                                                    {eq.placa && <span className="text-xs text-slate-400 font-medium ml-1"> / #{eq.placa}</span>}
                                                                    {eq.ubicacion && (
                                                                        <span className="text-xs text-slate-400 font-medium inline-flex items-center gap-1 ml-1"> / <MapPin className="w-3 h-3 text-slate-400" />{eq.ubicacion}</span>
                                                                    )}
                                                                    {eq.fechaFabricacion && (
                                                                        <span className="text-xs text-slate-400 font-medium ml-1"> / F. Fabricación: {eq.fechaFabricacion.split('-').reverse().join('-')}</span>
                                                                    )}
                                                                    {eq.ultimoRetimbre && (
                                                                        <span className="text-xs text-slate-400 font-medium ml-1"> / F. Retimbre: {eq.ultimoRetimbre.split('-').reverse().join('-')}</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-slate-200">
                                                                    <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg font-medium">
                                                                        <CheckCircle2 className="w-3 h-3" /> {stats.ok}
                                                                    </span>
                                                                    {stats.fail > 0 && (
                                                                        <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg font-medium">
                                                                            <XCircle className="w-3 h-3" /> {stats.fail}
                                                                        </span>
                                                                    )}
                                                                    {stats.pending > 0 && (
                                                                        <span className="px-2 py-1 bg-slate-200 text-slate-500 rounded-lg font-medium">
                                                                            {stats.pending} pend.
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteEquipo(eq.id)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Eliminar equipo de la revisión"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="px-4 pb-3">
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-1.5">
                                                                {CHECKLIST_ITEMS.map(item => {
                                                                    const isChecked = eq[item.key as keyof EquipoInstalado] === true;
                                                                    const isUnchecked = eq[item.key as keyof EquipoInstalado] === false;
                                                                    return (
                                                                        <label
                                                                            key={item.key}
                                                                            className={`flex items-center gap-2 cursor-pointer text-xs px-2 py-1.5 rounded-lg transition-all select-none ${
                                                                                isUnchecked
                                                                                    ? 'text-red-600 font-semibold bg-red-50 hover:bg-red-100'
                                                                                    : isChecked
                                                                                    ? 'text-green-700 font-medium bg-green-50 hover:bg-green-100'
                                                                                    : 'text-slate-500 bg-white hover:bg-slate-100 border border-slate-150'
                                                                            }`}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!eq[item.key as keyof EquipoInstalado]}
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
                                                            <label className={`block text-xs font-semibold mb-1.5 ${
                                                                anomaliaObligatoriaVacia ? 'text-red-600' : 'text-slate-600'
                                                            }`}>
                                                                Anomalías / Observaciones {algunCheckRojo ? <span className="text-red-500">(obligatorio)</span> : ''}
                                                            </label>
                                                            <textarea
                                                                value={eq.anomalias || ''}
                                                                onChange={(e) => setEquiposInstalados(prevEquipos =>
                                                                    prevEquipos.map(currEq =>
                                                                        currEq.id === eq.id ? { ...currEq, anomalias: e.target.value } : currEq
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
                                                         </div>
                                                     </div>
                                                  );
                                              })
                                          )
                                      })()}
                                         </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3">
                    <button
                        onClick={handlePauseRevision}
                        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-all text-sm"
                    >
                        <Save className="w-5 h-5" /> Pausar Revisión
                    </button>
                    <button
                        onClick={handleSaveRevision}
                        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all text-sm"
                    >
                        <Save className="w-5 h-5" /> Finalizar Revisión
                    </button>
                </div>
            </div>

            {/* MODAL AÑADIR EQUIPO */}
            {addSistemaId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <h2 className="text-lg font-bold text-slate-800">Añadir equipo al sistema</h2>
                            <button onClick={closeAddModal} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Seleccionar del catálogo</label>
                                    <select
                                        value={selectedCatalogItem}
                                        onChange={e => setSelectedCatalogItem(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="">-- Elige un equipo --</option>
                                        {filteredCatalog.map((eq: any) => (
                                            <option key={eq.id} value={eq.id}>{eq.codigo} - {eq.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {selectedCatalogItem && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Cantidad</label>
                                        <input
                                            type="number" min={1} max={100}
                                            value={addQuantity}
                                            onChange={e => setAddQuantity(parseInt(e.target.value) || 1)}
                                            className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                )}
                                
                                <div className="border-t border-slate-100 pt-4">
                                    <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">O introduce los datos manualmente</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Código</label>
                                            <input
                                                type="text"
                                                value={newEquipo.codigo}
                                                onChange={(e) => setNewEquipo(prev => ({ ...prev, codigo: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                placeholder=""
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nombre</label>
                                            <input
                                                type="text"
                                                value={newEquipo.nombre}
                                                onChange={(e) => setNewEquipo(prev => ({ ...prev, nombre: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                placeholder="Ej: Extintor CO2 5kg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ubicación</label>
                                            <input
                                                type="text"
                                                value={newEquipo.ubicacion}
                                                onChange={(e) => setNewEquipo(prev => ({ ...prev, ubicacion: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                placeholder="Ej: Planta baja, entrada"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Placa</label>
                                            <input
                                                type="text"
                                                value={newEquipo.placa}
                                                onChange={(e) => setNewEquipo(prev => ({ ...prev, placa: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                placeholder="Ej: PL-12345"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={closeAddModal}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!addSistemaId) return;
                                    if (selectedCatalogItem) {
                                        handleAddFromCatalog(addSistemaId); // Corrected call
                                    } else if (newEquipo.codigo.trim() && newEquipo.nombre.trim()) {
                                        handleAddEquipo(addSistemaId);
                                    } else {
                                        alert('Selecciona un equipo del catálogo o introduce código y nombre manualmente.');
                                    }
                                }}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
                            >
                                Guardar
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
        </div>
    );
}
