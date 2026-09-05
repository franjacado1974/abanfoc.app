import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Edit, Trash2, CheckCircle2, 
  Clock, PauseCircle, Building2, MapPin, Briefcase, 
  X, Save, Calendar, Filter, StickyNote
} from 'lucide-react';
import { 
  subscribeCentros, subscribeEmpresas, 
  subscribeRevisiones, updateRevision, addRevision, deleteRevision,
  type RevisionItem 
} from './firebase';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Configuración de paletas de color por mes (estaciones / tonotipos visuales)
const MESES_CONFIG: Record<string, {
  active: string;
  inactive: string;
  badgeActive: string;
  badgeInactive: string;
}> = {
  Enero: {
    active: 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-500/20 scale-[1.02]',
    inactive: 'bg-sky-50/70 text-sky-900 border-sky-200/80 hover:bg-sky-100/90',
    badgeActive: 'bg-sky-950/80 text-white',
    badgeInactive: 'bg-sky-200/80 text-sky-900 font-extrabold'
  },
  Febrero: {
    active: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 scale-[1.02]',
    inactive: 'bg-indigo-50/70 text-indigo-900 border-indigo-200/80 hover:bg-indigo-100/90',
    badgeActive: 'bg-indigo-950/80 text-white',
    badgeInactive: 'bg-indigo-200/80 text-indigo-900 font-extrabold'
  },
  Marzo: {
    active: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 scale-[1.02]',
    inactive: 'bg-emerald-50/70 text-emerald-900 border-emerald-200/80 hover:bg-emerald-100/90',
    badgeActive: 'bg-emerald-950/80 text-white',
    badgeInactive: 'bg-emerald-200/80 text-emerald-900 font-extrabold'
  },
  Abril: {
    active: 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-500/20 scale-[1.02]',
    inactive: 'bg-teal-50/70 text-teal-900 border-teal-200/80 hover:bg-teal-100/90',
    badgeActive: 'bg-teal-950/80 text-white',
    badgeInactive: 'bg-teal-200/80 text-teal-900 font-extrabold'
  },
  Mayo: {
    active: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md shadow-green-500/20 scale-[1.02]',
    inactive: 'bg-green-50/70 text-green-900 border-green-200/80 hover:bg-green-100/90',
    badgeActive: 'bg-green-950/80 text-white',
    badgeInactive: 'bg-green-200/80 text-green-900 font-extrabold'
  },
  Junio: {
    active: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 shadow-md shadow-amber-500/20 scale-[1.02]',
    inactive: 'bg-amber-50/70 text-amber-900 border-amber-200/80 hover:bg-amber-100/90',
    badgeActive: 'bg-amber-950/80 text-white',
    badgeInactive: 'bg-amber-200/80 text-amber-900 font-extrabold'
  },
  Julio: {
    active: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20 scale-[1.02]',
    inactive: 'bg-orange-50/70 text-orange-900 border-orange-200/80 hover:bg-orange-100/90',
    badgeActive: 'bg-orange-950/80 text-white',
    badgeInactive: 'bg-orange-200/80 text-orange-900 font-extrabold'
  },
  Agosto: {
    active: 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-500/20 scale-[1.02]',
    inactive: 'bg-red-50/70 text-red-900 border-red-200/80 hover:bg-red-100/90',
    badgeActive: 'bg-red-950/80 text-white',
    badgeInactive: 'bg-red-200/80 text-red-900 font-extrabold'
  },
  Septiembre: {
    active: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/20 scale-[1.02]',
    inactive: 'bg-violet-50/70 text-violet-900 border-violet-200/80 hover:bg-violet-100/90',
    badgeActive: 'bg-violet-950/80 text-white',
    badgeInactive: 'bg-violet-200/80 text-violet-900 font-extrabold'
  },
  Octubre: {
    active: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-600/20 scale-[1.02]',
    inactive: 'bg-amber-50/70 text-amber-950 border-amber-300/80 hover:bg-amber-100/90',
    badgeActive: 'bg-amber-950/80 text-white',
    badgeInactive: 'bg-amber-200/80 text-amber-900 font-extrabold'
  },
  Noviembre: {
    active: 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-500/20 scale-[1.02]',
    inactive: 'bg-rose-50/70 text-rose-900 border-rose-200/80 hover:bg-rose-100/90',
    badgeActive: 'bg-rose-950/80 text-white',
    badgeInactive: 'bg-rose-200/80 text-rose-900 font-extrabold'
  },
  Diciembre: {
    active: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20 scale-[1.02]',
    inactive: 'bg-cyan-50/70 text-cyan-900 border-cyan-200/80 hover:bg-cyan-100/90',
    badgeActive: 'bg-cyan-950/80 text-white',
    badgeInactive: 'bg-cyan-200/80 text-cyan-900 font-extrabold'
  }
};

export default function Revisiones() {
  const navigate = useNavigate();

  // Obtener mes actual del calendario (0: Enero ... 11: Diciembre)
  const currentMonthName = MESES[new Date().getMonth()];
  const [activeMonth, setActiveMonth] = useState<string>(currentMonthName);

  // Estados de datos
  const [centros, setCentros] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [revisionesState, setRevisionesState] = useState<RevisionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro de búsqueda por texto y filtros
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('TODOS');
  const [tipoFilter, setTipoFilter] = useState<string>('TODOS');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isTipoFilterOpen, setIsTipoFilterOpen] = useState(false);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    docId?: string;
    centroId: string;
    centroNombre: string;
    codigoCentro: string;
    empresaMantenedora: string;
    ubicacion: string;
    mes: string;
    tipoRevision: string;
    tag?: string;
    estado: 'Planificado' | 'En curso' | 'Parado' | 'Finalizado';
    observaciones: string;
  } | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<{ id: string; docId?: string; nombre: string } | null>(null);

  // Suscripción a datos de Firestore
  useEffect(() => {
    // 1. Cargar desde LocalStorage para rendering rápido
    try {
      const savedCen = localStorage.getItem('firecheck_db_centros');
      if (savedCen) setCentros(JSON.parse(savedCen));

      const savedEmp = localStorage.getItem('firecheck_db_empresas');
      if (savedEmp) setEmpresas(JSON.parse(savedEmp));

      const savedRev = localStorage.getItem('firecheck_db_revisiones');
      if (savedRev) setRevisionesState(JSON.parse(savedRev));
    } catch (e) {
      console.error('Error cargando cache local:', e);
    }

    // 2. Suscribir a Firestore
    const unsubCen = subscribeCentros((items) => {
      setCentros(items);
      localStorage.setItem('firecheck_db_centros', JSON.stringify(items));
    });

    const unsubEmp = subscribeEmpresas((items) => {
      setEmpresas(items);
      localStorage.setItem('firecheck_db_empresas', JSON.stringify(items));
    });

    const unsubRev = subscribeRevisiones((items) => {
      setRevisionesState(items);
      localStorage.setItem('firecheck_db_revisiones', JSON.stringify(items));
      setLoading(false);
    });

    return () => {
      unsubCen();
      unsubEmp();
      unsubRev();
    };
  }, []);

  // Función de mapa de empresas para búsqueda rápida por id
  const empresasMap = empresas.reduce((acc: Record<string, string>, emp: any) => {
    acc[emp.id || emp._docId] = emp.nombre || 'Sin empresa mantenedora';
    return acc;
  }, {});

  // Calcular todos los meses y tipos de revisión programados para un centro
  const getScheduledMonthsForCentro = (centro: any): { mes: string; tipo: string; tag: string }[] => {
    if (!centro) return [];

    // 1. Normalizar periodicidad
    let rawPeriodicidad: string[] = [];
    if (Array.isArray(centro.periodicidad)) {
      rawPeriodicidad = centro.periodicidad.map((p: any) => String(p).trim());
    } else if (typeof centro.periodicidad === 'string' && centro.periodicidad.trim() !== '') {
      rawPeriodicidad = centro.periodicidad.split(',').map((p: string) => p.trim());
    }

    // 2. Normalizar mes de referencia anual
    let refMes = '';
    if (Array.isArray(centro.mesesRevision) && centro.mesesRevision.length > 0) {
      refMes = String(centro.mesesRevision[0]).trim();
    } else if (typeof centro.mesesRevision === 'string' && centro.mesesRevision.trim() !== '') {
      refMes = centro.mesesRevision.trim();
    } else if (typeof centro.mesRevision === 'string' && centro.mesRevision.trim() !== '') {
      refMes = centro.mesRevision.trim();
    }

    // Buscar el índice del mes de referencia
    let refIdx = MESES.findIndex(m => m.toLowerCase() === refMes.toLowerCase());

    // Si no hay mes de referencia en mesesRevision, buscar si en periodicidad se puso un mes
    if (refIdx === -1) {
      for (const p of rawPeriodicidad) {
        const idx = MESES.findIndex(m => m.toLowerCase() === p.toLowerCase());
        if (idx !== -1) {
          refIdx = idx;
          refMes = MESES[idx];
          break;
        }
      }
    }

    const isAnual = rawPeriodicidad.some(p => p.toLowerCase().includes('anual'));
    const isTrimestral = rawPeriodicidad.some(p => p.toLowerCase().includes('trimestral'));
    const isSemestral = rawPeriodicidad.some(p => p.toLowerCase().includes('semestral'));
    const isMensual = rawPeriodicidad.some(p => p.toLowerCase().includes('mensual'));

    const scheduleMap = new Map<string, { mes: string; tipo: string; tag: string }>();

    // Si se tiene un mes de referencia válido
    if (refIdx !== -1) {
      const mesNombreRef = MESES[refIdx];

      // a) Si es Anual: el mes de referencia es Anual (A)
      if (isAnual) {
        scheduleMap.set(mesNombreRef.toLowerCase(), { mes: mesNombreRef, tipo: 'Anual', tag: 'A' });
      }

      // b) Si es Trimestral:
      // Si además es Anual: los trimestres +3, +6, +9 meses son Trimestrales (T).
      // Si solo es Trimestral (sin Anual): todos los trimestres 0, +3, +6, +9 son Trimestrales (T).
      if (isTrimestral) {
        const offsets = isAnual ? [3, 6, 9] : [0, 3, 6, 9];
        offsets.forEach(offset => {
          const targetMes = MESES[(refIdx + offset) % 12];
          if (!scheduleMap.has(targetMes.toLowerCase())) {
            scheduleMap.set(targetMes.toLowerCase(), { mes: targetMes, tipo: 'Trimestral', tag: 'T' });
          }
        });
      }

      // c) Si es Semestral:
      if (isSemestral) {
        const offsets = isAnual ? [6] : [0, 6];
        offsets.forEach(offset => {
          const targetMes = MESES[(refIdx + offset) % 12];
          if (!scheduleMap.has(targetMes.toLowerCase())) {
            scheduleMap.set(targetMes.toLowerCase(), { mes: targetMes, tipo: 'Semestral', tag: 'S' });
          }
        });
      }

      // d) Si es Mensual:
      if (isMensual) {
        MESES.forEach(m => {
          if (!scheduleMap.has(m.toLowerCase())) {
            scheduleMap.set(m.toLowerCase(), { mes: m, tipo: 'Mensual', tag: 'M' });
          }
        });
      }

      // Si no tiene marcado tipo específico pero tiene mes de referencia, por defecto es Anual
      if (!isAnual && !isTrimestral && !isSemestral && !isMensual) {
        scheduleMap.set(mesNombreRef.toLowerCase(), { mes: mesNombreRef, tipo: 'Anual', tag: 'A' });
      }
    } else {
      // Si mesesRevision tiene un listado de meses explícitos
      if (Array.isArray(centro.mesesRevision) && centro.mesesRevision.length > 0) {
        centro.mesesRevision.forEach((m: any) => {
          const foundMes = MESES.find(mesItem => mesItem.toLowerCase() === String(m).trim().toLowerCase());
          if (foundMes && !scheduleMap.has(foundMes.toLowerCase())) {
            const tipo = isTrimestral ? 'Trimestral' : 'Anual';
            const tag = tipo === 'Trimestral' ? 'T' : 'A';
            scheduleMap.set(foundMes.toLowerCase(), { mes: foundMes, tipo, tag });
          }
        });
      }
    }

    return Array.from(scheduleMap.values());
  };

  // Obtener la información de revisión de un centro en un mes determinado
  const getCentroScheduleForMonth = (centro: any, mes: string): { tipo: string; tag: string } | null => {
    if (!centro) return null;
    const schedules = getScheduledMonthsForCentro(centro);
    const found = schedules.find(s => s.mes.toLowerCase() === mes.toLowerCase());
    if (found) return { tipo: found.tipo, tag: found.tag };

    // Comprobar si tiene registrado un estado explícito en revisionesState para ese mes
    const revGuardada = revisionesState.find(r => 
      r.centroId === centro.id && r.mes?.toLowerCase() === mes.toLowerCase()
    );
    if (revGuardada) {
      const tipo = revGuardada.tipoRevision || 'Anual';
      const tag = tipo.toLowerCase().startsWith('trim') ? 'T' : (tipo.toLowerCase().startsWith('men') ? 'M' : 'A');
      return { tipo, tag };
    }

    return null;
  };

  // Calcular la lista combinada de revisiones para el mes activo
  const getRevisionesForMonth = (mes: string) => {
    const list: any[] = [];

    centros.forEach(centro => {
      const scheduleItem = getCentroScheduleForMonth(centro, mes);
      if (scheduleItem) {
        // Buscar si ya existe una revisión en Firestore para este centro y mes
        const revGuardada = revisionesState.find(r => 
          r.centroId === centro.id && r.mes?.toLowerCase() === mes.toLowerCase()
        );
        
        const empresaMantenedora = centro.empresaId 
          ? (empresasMap[centro.empresaId] || 'Sin empresa mantenedora')
          : 'Sin empresa mantenedora';

        const tipoRevisionFinal = revGuardada?.tipoRevision || scheduleItem.tipo;
        const tagFinal = tipoRevisionFinal.toLowerCase().startsWith('trim') ? 'T' : 
                         tipoRevisionFinal.toLowerCase().startsWith('sem') ? 'S' : 
                         tipoRevisionFinal.toLowerCase().startsWith('men') ? 'M' : 'A';

        list.push({
          _docId: revGuardada?._docId,
          id: revGuardada?.id || `rev-${centro.id}-${mes}`,
          centroId: centro.id,
          centroNombre: centro.nombre || 'Centro Sin Nombre',
          codigoCentro: centro.customIdPart || centro.id || 'S/C',
          empresaMantenedora: empresaMantenedora,
          ubicacion: centro.poblacion || centro.localidad || 'S/D',
          mes: mes,
          tipoRevision: tipoRevisionFinal,
          tag: tagFinal,
          estado: (revGuardada?.estado || 'Planificado') as 'Planificado' | 'En curso' | 'Parado' | 'Finalizado',
          observaciones: revGuardada?.observaciones || revGuardada?.nota || ''
        });
      }
    });

    return list;
  };

  // Obtener lista del mes activo
  const monthItems = getRevisionesForMonth(activeMonth);

  // Filtrar por texto de búsqueda, estado y tipo de revisión
  const filteredItems = monthItems.filter(item => {
    const query = search.toLowerCase().trim();
    const matchesSearch = !query || 
      item.centroNombre.toLowerCase().includes(query) ||
      item.codigoCentro.toLowerCase().includes(query) ||
      item.empresaMantenedora.toLowerCase().includes(query) ||
      item.ubicacion.toLowerCase().includes(query) ||
      item.tipoRevision.toLowerCase().includes(query);

    const matchesEstado = estadoFilter === 'TODOS' || item.estado === estadoFilter;
    const matchesTipo = tipoFilter === 'TODOS' || item.tipoRevision.toLowerCase() === tipoFilter.toLowerCase();

    return matchesSearch && matchesEstado && matchesTipo;
  });

  // Abrir modal de edición
  const handleOpenEdit = (item: any) => {
    setEditingItem({
      docId: item._docId,
      centroId: item.centroId,
      centroNombre: item.centroNombre,
      codigoCentro: item.codigoCentro,
      empresaMantenedora: item.empresaMantenedora,
      ubicacion: item.ubicacion,
      mes: item.mes,
      tipoRevision: item.tipoRevision,
      tag: item.tag,
      estado: item.estado,
      observaciones: item.observaciones || ''
    });
    setIsModalOpen(true);
  };

  // Guardar cambios del modal
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const dataToSave: RevisionItem = {
        id: editingItem.docId || `rev-${editingItem.centroId}-${editingItem.mes}`,
        centroId: editingItem.centroId,
        centroNombre: editingItem.centroNombre,
        codigoCentro: editingItem.codigoCentro,
        empresaMantenedora: editingItem.empresaMantenedora,
        ubicacion: editingItem.ubicacion,
        mes: editingItem.mes,
        tipoRevision: editingItem.tipoRevision,
        estado: editingItem.estado,
        observaciones: editingItem.observaciones,
        nota: editingItem.observaciones,
        fechaCreacion: new Date().toISOString()
      };

      if (editingItem.docId) {
        await updateRevision(editingItem.docId, dataToSave);
      } else {
        await addRevision(dataToSave);
      }

      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      console.error('Error guardando revisión:', err);
      alert('Ocurrió un error al guardar los cambios de la revisión.');
    }
  };

  // Confirmar eliminación
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    try {
      if (deleteConfirmId.docId) {
        await deleteRevision(deleteConfirmId.docId);
      }
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error eliminando revisión:', err);
      alert('Ocurrió un error al eliminar la revisión.');
    }
  };

  // Renderizar insignia de tipo de revisión (Anual [A], Trimestral [T], Semestral [S], Mensual [M])
  const renderTipoBadge = (tipo: string, tag?: string) => {
    const isTrimestral = tipo?.toLowerCase().includes('trimestral') || tag === 'T';
    const isSemestral = tipo?.toLowerCase().includes('semestral') || tag === 'S';
    const isMensual = tipo?.toLowerCase().includes('mensual') || tag === 'M';

    if (isTrimestral) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50/80 text-purple-700 border border-purple-200/70 shadow-xs">
          <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
            T
          </span>
          Trimestral
        </span>
      );
    }
    if (isSemestral) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50/80 text-teal-700 border border-teal-200/70 shadow-xs">
          <span className="w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
            S
          </span>
          Semestral
        </span>
      );
    }
    if (isMensual) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100/80 text-zinc-700 border border-zinc-200 shadow-xs">
          <span className="w-4 h-4 rounded-full bg-zinc-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
            M
          </span>
          Mensual
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50/80 text-blue-700 border border-blue-200/70 shadow-xs">
        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
          A
        </span>
        Anual
      </span>
    );
  };

  // Renderizar insignia de estado con icono y color
  const renderEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'En curso':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse shadow-sm">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            En curso
          </span>
        );
      case 'Parado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-800 border border-red-300 shadow-sm">
            <PauseCircle className="w-3.5 h-3.5 text-red-600" />
            Parado
          </span>
        );
      case 'Finalizado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Finalizado
          </span>
        );
      case 'Planificado':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Planificado
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 sm:px-8 py-6">
      {/* Header y Navegación Volver */}
      <div className="mb-6 flex flex-col items-center sm:items-start text-center sm:text-left">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight flex items-center justify-center sm:justify-start gap-2.5">
              <Calendar className="w-7 h-7 text-red-600" />
              Planificación de Revisiones
            </h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1">
              Control y seguimiento de mantenimientos preventivos (anuales, trimestrales y periódicos) organizados por meses del año.
            </p>
          </div>
        </div>
      </div>

      {/* 12 Pestañas de los Meses con Toque de Colores por Estación y Mes */}
      <div className="bg-white p-2.5 rounded-2xl border border-zinc-200/80 shadow-sm mb-6 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {MESES.map((mes) => {
            const count = getRevisionesForMonth(mes).length;
            const isActive = activeMonth === mes;
            const cfg = MESES_CONFIG[mes] || MESES_CONFIG.Enero;

            return (
              <button
                key={mes}
                onClick={() => setActiveMonth(mes)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                  isActive ? cfg.active : cfg.inactive
                }`}
              >
                <span>{mes}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                  isActive ? cfg.badgeActive : cfg.badgeInactive
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Campo de Búsqueda */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder={`Buscar por Centro, Código, Tipo (Anual/Trimestral), Empresa o Ubicación en ${activeMonth}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:border-black transition-colors"
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtros de Tipo y Estado */}
        <div className="flex items-center gap-2">
          {/* Desplegable de Filtro de Tipo de Revisión */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setIsTipoFilterOpen(!isTipoFilterOpen); setIsFilterOpen(false); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <span>Tipo: <strong className="text-zinc-950">{tipoFilter}</strong></span>
            </button>

            {isTipoFilterOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-zinc-200 rounded-2xl shadow-xl z-30 p-1.5">
                {['TODOS', 'Anual', 'Trimestral', 'Semestral', 'Mensual'].map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => {
                      setTipoFilter(tipo);
                      setIsTipoFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      tipoFilter === tipo ? 'bg-black text-white' : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {tipo}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desplegable de Filtro de Estado */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setIsFilterOpen(!isFilterOpen); setIsTipoFilterOpen(false); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <span>Estado: <strong className="text-zinc-950">{estadoFilter}</strong></span>
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-2xl shadow-xl z-30 p-1.5">
                {['TODOS', 'Planificado', 'En curso', 'Parado', 'Finalizado'].map((est) => (
                  <button
                    key={est}
                    onClick={() => {
                      setEstadoFilter(est);
                      setIsFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      estadoFilter === est ? 'bg-black text-white' : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {est}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla Principal de Revisiones */}
      <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 font-medium text-xs">
            Cargando revisiones del mes...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300 mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-zinc-700">Sin revisiones en {activeMonth}</h4>
            <p className="text-[11px] text-zinc-450 mt-1 max-w-sm">
              {search || estadoFilter !== 'TODOS' || tipoFilter !== 'TODOS'
                ? 'No se encontraron resultados con los filtros aplicados.'
                : `No hay centros asignados para revisión en el mes de ${activeMonth}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-200/60 text-[11px] font-black uppercase text-zinc-450 tracking-wider">
                  <th className="py-4 px-6">CENTRO</th>
                  <th className="py-4 px-6">CÓDIGO CENTRO</th>
                  <th className="py-4 px-6 text-center">TIPO</th>
                  <th className="py-4 px-6">EMPRESA MANTENEDORA</th>
                  <th className="py-4 px-6">UBICACIÓN</th>
                  <th className="py-4 px-6 text-center">ESTADO</th>
                  <th className="py-4 px-6 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filteredItems.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-zinc-50/60 transition-colors group"
                  >
                    {/* CENTRO */}
                    <td className="py-4 px-6 font-medium text-zinc-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-600 shrink-0 group-hover:bg-red-50 group-hover:text-red-600 group-hover:border-red-200 transition-colors">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-800 block">{item.centroNombre}</span>
                          {item.observaciones && (
                            <span className="text-[10px] font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-0.5">
                              <StickyNote className="w-3 h-3 text-amber-600" />
                              {item.observaciones}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* CÓDIGO CENTRO */}
                    <td className="py-4 px-6 font-mono font-bold text-zinc-700">
                      <span className="bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-lg">
                        {item.codigoCentro}
                      </span>
                    </td>

                    {/* TIPO DE REVISIÓN */}
                    <td className="py-4 px-6 text-center">
                      {renderTipoBadge(item.tipoRevision, item.tag)}
                    </td>

                    {/* EMPRESA MANTENEDORA */}
                    <td className="py-4 px-6 font-semibold text-zinc-700">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{item.empresaMantenedora}</span>
                      </div>
                    </td>

                    {/* UBICACIÓN */}
                    <td className="py-4 px-6 font-semibold text-zinc-700">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{item.ubicacion}</span>
                      </div>
                    </td>

                    {/* ESTADO */}
                    <td className="py-4 px-6 text-center">
                      {renderEstadoBadge(item.estado)}
                    </td>

                    {/* ACCIONES */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          title="Editar Estado u Observaciones"
                          className="p-2 rounded-xl bg-zinc-100 hover:bg-black hover:text-white text-zinc-600 transition-all cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId({ id: item.id, docId: item._docId, nombre: item.centroNombre })}
                          title="Eliminar Registro de Revisión"
                          className="p-2 rounded-xl bg-zinc-100 hover:bg-red-600 hover:text-white text-zinc-600 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Flotante para Editar Estado y Observaciones */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl w-full max-w-lg p-6 animate-in">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-5">
              <div>
                <h3 className="text-base font-black text-zinc-950">Editar Estado de Revisión</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-600 font-bold">{editingItem.centroNombre}</span>
                  <span className="text-xs text-zinc-400 font-medium">({editingItem.mes})</span>
                  {renderTipoBadge(editingItem.tipoRevision, editingItem.tag)}
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Estado de la Revisión</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'Planificado', label: 'Planificado', style: 'border-slate-300 text-slate-700 bg-slate-50' },
                    { key: 'En curso', label: 'En curso', style: 'border-amber-400 text-amber-800 bg-amber-50' },
                    { key: 'Parado', label: 'Parado', style: 'border-red-400 text-red-800 bg-red-50' },
                    { key: 'Finalizado', label: 'Finalizado', style: 'border-emerald-400 text-emerald-800 bg-emerald-50' },
                  ].map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, estado: st.key as any })}
                      className={`p-3 rounded-2xl border-2 text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                        editingItem.estado === st.key 
                          ? `${st.style} ring-2 ring-black shadow-sm scale-[1.02]` 
                          : 'border-zinc-200 text-zinc-500 bg-white hover:bg-zinc-50'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Observaciones o Notas</label>
                <textarea
                  rows={3}
                  placeholder="Detalles sobre la planificación, avisos al cliente o incidencias..."
                  value={editingItem.observaciones}
                  onChange={(e) => setEditingItem({ ...editingItem, observaciones: e.target.value })}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs outline-none focus:border-black transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-black hover:bg-zinc-800 text-white font-bold text-xs rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Flotante de Confirmación de Eliminación */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl w-full max-w-sm p-6 text-center animate-in">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-zinc-950">¿Eliminar revisión?</h3>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              ¿Estás seguro de que deseas eliminar el registro de revisión de <strong className="text-zinc-800">{deleteConfirmId.nombre}</strong>?
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xl transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
