import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, Plus, Search, Filter, Edit, Trash2, CheckCircle2, 
  Clock, PauseCircle, User, MapPin, 
  X, Save, ChevronDown, StickyNote, Calendar,
  ShieldAlert
} from 'lucide-react';
import { 
  subscribeUrgencias, addUrgencia, updateUrgencia, deleteUrgencia, 
  subscribeTecnicos, subscribeCentros, subscribeClientes, subscribeEmpresas,
  type UrgenciaItem, type Cliente, type Centro, type Empresa 
} from './firebase';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

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

export default function Urgencias() {
  const navigate = useNavigate();
  const currentMonthName = MESES[new Date().getMonth()];
  const [activeMonth, setActiveMonth] = useState<string>(currentMonthName);

  const [urgencias, setUrgencias] = useState<UrgenciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('TODOS');
  const [prioridadFilter, setPrioridadFilter] = useState<string>('TODAS');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Listas para desplegables de ayuda
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UrgenciaItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<{ id: string; docId?: string } | null>(null);

  // Modal rápido de Nota / Notificación
  const [notaModalItem, setNotaModalItem] = useState<UrgenciaItem | null>(null);
  const [notaText, setNotaText] = useState('');

  // Formulario de edición/creación
  const [formData, setFormData] = useState({
    titulo: '',
    clienteId: '',
    clienteNombre: '',
    centroId: '',
    urgencia: '',
    lugar: '',
    tecnicoAsignado: '',
    comercial: '',
    prioridad: 'Alta' as 'Baja' | 'Media' | 'Alta',
    fecha: new Date().toISOString().slice(0, 10),
    estado: 'Pendiente' as 'Pendiente' | 'En curso' | 'Parado' | 'Finalizado',
    observaciones: ''
  });

  // Funciones auxiliares para fechas y meses
  const getItemMonth = (item: { fecha?: string; mes?: string; fechaCreacion?: string }): string => {
    if (item.mes && MESES.includes(item.mes)) {
      return item.mes;
    }
    const f = item.fecha || item.fechaCreacion;
    if (f) {
      const parts = f.slice(0, 10).split('-');
      if (parts.length >= 2) {
        const mIdx = parseInt(parts[1], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          return MESES[mIdx];
        }
      }
    }
    return MESES[new Date().getMonth()];
  };

  const getMonthFromDateStr = (dateStr: string): string => {
    if (!dateStr) return MESES[new Date().getMonth()];
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length >= 2) {
      const mIdx = parseInt(parts[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return MESES[mIdx];
      }
    }
    return MESES[new Date().getMonth()];
  };

  const formatearFecha = (dateStr?: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Cargar datos locales y suscribir a Firebase
  useEffect(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_urgencias');
      if (saved) {
        setUrgencias(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error cargando urgencias de localStorage:', e);
    }

    const unsubUrg = subscribeUrgencias((items) => {
      setUrgencias(items);
      localStorage.setItem('firecheck_db_urgencias', JSON.stringify(items));
      setLoading(false);
    });

    const unsubTec = subscribeTecnicos((items) => setTecnicos(items));
    const unsubCen = subscribeCentros((items) => setCentros(items));
    const unsubCli = subscribeClientes((items) => setClientes(items));
    const unsubEmp = subscribeEmpresas((items) => setEmpresas(items));

    return () => {
      unsubUrg();
      unsubTec();
      unsubCen();
      unsubCli();
      unsubEmp();
    };
  }, []);

  // Guardar en localStorage cuando cambien
  const updateLocalAndState = (newItems: UrgenciaItem[]) => {
    setUrgencias(newItems);
    localStorage.setItem('firecheck_db_urgencias', JSON.stringify(newItems));
  };

  // Abrir modal para crear
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      titulo: '',
      clienteId: '',
      clienteNombre: '',
      centroId: '',
      urgencia: '',
      lugar: '',
      tecnicoAsignado: '',
      comercial: '',
      prioridad: 'Alta',
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'Pendiente',
      observaciones: ''
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEditModal = (item: UrgenciaItem) => {
    setEditingItem(item);
    setFormData({
      titulo: item.titulo || '',
      clienteId: item.clienteId || '',
      clienteNombre: item.clienteNombre || '',
      centroId: item.centroId || '',
      urgencia: item.urgencia || '',
      lugar: item.lugar || '',
      tecnicoAsignado: item.tecnicoAsignado || '',
      comercial: item.comercial || '',
      prioridad: item.prioridad || 'Media',
      fecha: item.fecha || (item.fechaCreacion ? item.fechaCreacion.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      estado: item.estado || 'Pendiente',
      observaciones: item.nota || item.observaciones || ''
    });
    setIsModalOpen(true);
  };

  // Abrir modal para ver / redactar Nota rápida
  const handleOpenNotaModal = (item: UrgenciaItem) => {
    setNotaModalItem(item);
    setNotaText(item.nota || item.observaciones || '');
  };

  // Guardar Nota desde modal flotante de notas
  const handleSaveNota = async () => {
    if (!notaModalItem) return;
    const docId = notaModalItem._docId || notaModalItem.id;
    const trimmed = notaText.trim();

    const updatedList = urgencias.map(u => 
      (u.id === notaModalItem.id || u._docId === notaModalItem._docId)
        ? { ...u, nota: trimmed, observaciones: trimmed }
        : u
    );
    updateLocalAndState(updatedList);

    try {
      await updateUrgencia(docId, { nota: trimmed, observaciones: trimmed });
    } catch (err) {
      console.error('Error al guardar nota de urgencia en Firebase:', err);
    }

    setNotaModalItem(null);
  };

  // Abrir Albaranes directamente con los datos precargados desde la urgencia
  const handleOpenCrearAlbaran = (item: UrgenciaItem) => {
    const matchCentro = centros.find(c => 
      (c.nombre && item.lugar && c.nombre.toLowerCase().trim() === item.lugar.toLowerCase().trim()) ||
      (c.direccion && item.lugar && c.direccion.toLowerCase().includes(item.lugar.toLowerCase()))
    );

    const clienteId = matchCentro?.clienteId || (clientes.length > 0 ? clientes[0].id : '');
    const centroId = matchCentro?.id || '';
    const empresaId = matchCentro?.empresaId || (empresas.length > 0 ? (empresas[0].id || '') : '');

    const matchTecnico = tecnicos.find(t => 
      `${t.nombre || ''} ${t.apellidos || ''}`.toLowerCase().trim() === (item.tecnicoAsignado || '').toLowerCase().trim() ||
      (t.nombre && (item.tecnicoAsignado || '').toLowerCase().includes(t.nombre.toLowerCase()))
    );

    const urgDocId = item._docId || item.id;

    navigate('/albaranes', {
      state: {
        prefillAlbaran: {
          empresaId,
          clienteId,
          centroId,
          tecnicoId: matchTecnico?.id || (tecnicos.length > 0 ? tecnicos[0].id : ''),
          numeroPedido: '',
          titulo: `Urgencia: ${item.urgencia || 'Atención urgente'}`,
          reparacionId: urgDocId,
          fechaCreacion: item.fecha ? `${item.fecha}T10:00:00.000Z` : new Date().toISOString(),
          items: [
            {
              cantidad: 1,
              concepto: 'Aviso',
              descripcion: item.titulo || item.urgencia || item.nota || item.observaciones || `Intervención de urgencia realizada en ${item.lugar || 'instalación'}.`,
              precioUnidad: 0,
              subtotal: 0
            }
          ]
        }
      }
    });
  };

  // Guardar formulario de creación / edición
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const calculatedMes = getMonthFromDateStr(formData.fecha);

    if (editingItem) {
      const docId = editingItem._docId || editingItem.id;
      const updatedItem: Partial<UrgenciaItem> = {
        titulo: formData.titulo?.trim() || '',
        clienteId: formData.clienteId?.trim() || '',
        clienteNombre: formData.clienteNombre?.trim() || '',
        centroId: formData.centroId?.trim() || '',
        urgencia: formData.titulo?.trim() || '',
        lugar: formData.lugar.trim(),
        tecnicoAsignado: formData.tecnicoAsignado.trim(),
        comercial: formData.comercial.trim(),
        prioridad: formData.prioridad,
        fecha: formData.fecha,
        mes: calculatedMes,
        estado: formData.estado,
        observaciones: formData.observaciones.trim(),
        nota: formData.observaciones.trim()
      };

      const updatedList = urgencias.map(u => 
        (u.id === editingItem.id || u._docId === editingItem._docId)
          ? { ...u, ...updatedItem }
          : u
      );
      updateLocalAndState(updatedList);

      try {
        await updateUrgencia(docId, updatedItem);
      } catch (err) {
        console.error('Error al actualizar urgencia en Firebase:', err);
      }
    } else {
      const newId = `URG-${Date.now().toString().slice(-6)}`;
      const newItem: UrgenciaItem = {
        id: newId,
        titulo: formData.titulo?.trim() || '',
        clienteId: formData.clienteId?.trim() || '',
        clienteNombre: formData.clienteNombre?.trim() || '',
        centroId: formData.centroId?.trim() || '',
        urgencia: formData.titulo?.trim() || '',
        lugar: formData.lugar.trim(),
        tecnicoAsignado: formData.tecnicoAsignado.trim(),
        comercial: formData.comercial.trim(),
        prioridad: formData.prioridad,
        fecha: formData.fecha,
        mes: calculatedMes,
        estado: formData.estado,
        observaciones: formData.observaciones.trim(),
        nota: formData.observaciones.trim(),
        fechaCreacion: new Date().toISOString()
      };

      const updatedList = [newItem, ...urgencias];
      updateLocalAndState(updatedList);

      try {
        await addUrgencia(newItem);
      } catch (err) {
        console.error('Error al agregar urgencia en Firebase:', err);
      }
    }

    setIsModalOpen(false);
  };

  // Eliminar
  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const { id, docId } = deleteConfirmId;

    const updatedList = urgencias.filter(u => u.id !== id && u._docId !== docId);
    updateLocalAndState(updatedList);

    try {
      await deleteUrgencia(docId || id);
    } catch (err) {
      console.error('Error al eliminar urgencia en Firebase:', err);
    }

    setDeleteConfirmId(null);
  };

  // Filtrado por mes activo (excluyendo facturadas)
  const urgenciasDelMes = urgencias.filter(u => getItemMonth(u) === activeMonth && !u.facturado);

  // Filtrado general
  const urgenciasFiltradas = urgenciasDelMes.filter(u => {
    if (estadoFilter !== 'TODOS' && u.estado !== estadoFilter) {
      return false;
    }
    if (prioridadFilter !== 'TODAS' && u.prioridad !== prioridadFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchUrg = (u.urgencia || '').toLowerCase().includes(q);
      const matchLugar = (u.lugar || '').toLowerCase().includes(q);
      const matchTec = (u.tecnicoAsignado || '').toLowerCase().includes(q);
      const matchCom = (u.comercial || '').toLowerCase().includes(q);
      const matchNota = (u.nota || u.observaciones || '').toLowerCase().includes(q);
      const matchFecha = (u.fecha || '').toLowerCase().includes(q);
      return matchUrg || matchLugar || matchTec || matchCom || matchNota || matchFecha;
    }
    return true;
  });

  // Estadísticas del mes activo
  const totalCount = urgenciasDelMes.length;
  const pendientesCount = urgenciasDelMes.filter(u => u.estado === 'Pendiente').length;
  const enCursoCount = urgenciasDelMes.filter(u => u.estado === 'En curso').length;
  const paradosCount = urgenciasDelMes.filter(u => u.estado === 'Parado').length;
  const finalizadosCount = urgenciasDelMes.filter(u => u.estado === 'Finalizado').length;

  // Renderizador de Insignias de Prioridad
  const renderPrioridadBadge = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-black rounded-md bg-red-100 text-red-800 border border-red-300 shadow-[0_0_8px_rgba(239,68,68,0.25)]">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            Alta
          </span>
        );
      case 'Media':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-md bg-amber-100 text-amber-900 border border-amber-300">
            Media
          </span>
        );
      case 'Baja':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-300">
            Baja
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-300">
            {prioridad}
          </span>
        );
    }
  };

  // Renderizador de Insignias de Estado
  const renderEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'Pendiente':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Pendiente
          </span>
        );
      case 'En curso':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            En curso
          </span>
        );
      case 'Parado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-300 shadow-[0_0_8px_rgba(239,68,68,0.25)]">
            <PauseCircle className="w-3.5 h-3.5 text-red-600" />
            Parado
          </span>
        );
      case 'Finalizado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Finalizado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300">
            {estado}
          </span>
        );
    }
  };

  const opcionesEstado = [
    { value: 'TODOS', label: 'Todos los estados', colorClass: '' },
    { value: 'Pendiente', label: 'Pendiente (Gris)', colorClass: 'bg-slate-400' },
    { value: 'En curso', label: 'En curso (Amarillo)', colorClass: 'bg-amber-400' },
    { value: 'Parado', label: 'Parado (Rojo)', colorClass: 'bg-red-500' },
    { value: 'Finalizado', label: 'Finalizado (Verde)', colorClass: 'bg-emerald-500' },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto min-h-screen">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shadow-sm shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.25]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Avisos y Urgencias</h1>
              <p className="text-xs text-slate-500 font-medium">Gestión y control de intervenciones urgentes, averías críticas y asignación técnica.</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Nueva Urgencia
        </button>
      </div>

      {/* 12 Pestañas de los Meses con Colores Estacionales */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-sm mb-6 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {MESES.map((mes) => {
            const count = urgencias.filter(u => getItemMonth(u) === mes && !u.facturado).length;
            const isActive = activeMonth === mes;
            const cfg = MESES_CONFIG[mes] || MESES_CONFIG.Enero;

            return (
              <button
                key={mes}
                type="button"
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

      {/* Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Urgencias</span>
          <span className="text-2xl font-black text-slate-900 mt-2">{totalCount}</span>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Pendientes</span>
          <span className="text-2xl font-black text-slate-700 mt-2">{pendientesCount}</span>
        </div>
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">En curso</span>
          <span className="text-2xl font-black text-amber-700 mt-2">{enCursoCount}</span>
        </div>
        <div className="bg-red-50/70 p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Paradas</span>
          <span className="text-2xl font-black text-red-700 mt-2">{paradosCount}</span>
        </div>
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Finalizadas</span>
          <span className="text-2xl font-black text-emerald-700 mt-2">{finalizadosCount}</span>
        </div>
      </div>

      {/* Controls: Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por urgencia, lugar, técnico, nota..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Filtro Prioridad */}
          <select
            value={prioridadFilter}
            onChange={(e) => setPrioridadFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 shadow-sm cursor-pointer"
          >
            <option value="TODAS">Todas las prioridades</option>
            <option value="Alta">Alta (Roja)</option>
            <option value="Media">Media (Ámbar)</option>
            <option value="Baja">Baja (Gris)</option>
          </select>

          {/* Dropdown Filtro por Estado */}
          <div className="relative w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium flex items-center justify-between gap-3 text-slate-800 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span>{opcionesEstado.find(o => o.value === estadoFilter)?.label || 'Todos los estados'}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in duration-150">
                {opcionesEstado.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => {
                      setEstadoFilter(op.value);
                      setIsFilterOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
                      estadoFilter === op.value
                        ? 'bg-red-50 text-red-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {op.colorClass ? (
                      <span className={`w-2.5 h-2.5 rounded-full ${op.colorClass}`} />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-300" />
                    )}
                    {op.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                <th className="px-6 py-4">URGENCIA</th>
                <th className="px-6 py-4">LUGAR</th>
                <th className="px-6 py-4">TÉCNICO ASIGNADO</th>
                <th className="px-6 py-4">PRIORIDAD</th>
                <th className="px-6 py-4">ESTADO</th>
                <th className="px-4 py-4 text-center">NOTA</th>
                <th className="px-6 py-4 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Cargando avisos de urgencia...
                  </td>
                </tr>
              ) : urgenciasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                    {search || estadoFilter !== 'TODOS' || prioridadFilter !== 'TODAS'
                      ? 'No se encontraron avisos de urgencia con los filtros aplicados.'
                      : `No hay avisos de urgencia registrados en ${activeMonth}.`}
                  </td>
                </tr>
              ) : (
                urgenciasFiltradas.map((item) => {
                  const noteContent = (item.nota || item.observaciones || '').trim();
                  const hasNote = noteContent.length > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* URGENCIA */}
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                            item.prioridad === 'Alta' 
                              ? 'bg-red-50 border-red-200 text-red-600' 
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}>
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{item.urgencia || 'Sin descripción'}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {item.fecha && (
                                <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                                  <Calendar className="w-3 h-3 text-red-500" />
                                  {formatearFecha(item.fecha)}
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-slate-400">
                                {item.id}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* LUGAR */}
                      <td className="px-6 py-4 font-medium text-slate-700">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{item.lugar || '—'}</span>
                        </div>
                      </td>

                      {/* TÉCNICO ASIGNADO */}
                      <td className="px-6 py-4 font-medium text-slate-700">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{item.tecnicoAsignado || 'Sin asignar'}</span>
                        </div>
                      </td>

                      {/* PRIORIDAD */}
                      <td className="px-6 py-4">
                        {renderPrioridadBadge(item.prioridad || 'Media')}
                      </td>

                      {/* ESTADO */}
                      <td className="px-6 py-4">
                        {renderEstadoBadge(item.estado)}
                      </td>

                      {/* NOTA CON ICONO Y NOTIFICACIÓN SI EXISTE */}
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenNotaModal(item)}
                          className={`relative inline-flex items-center justify-center p-2.5 rounded-xl transition-all cursor-pointer ${
                            hasNote
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm hover:bg-amber-200'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent'
                          }`}
                          title={hasNote ? `Nota registrada: "${noteContent}" (Clic para abrir)` : 'Añadir nota'}
                        >
                          <StickyNote className={`w-4 h-4 ${hasNote ? 'text-amber-800' : 'text-slate-400'}`} />
                          
                          {hasNote && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 border-2 border-white"></span>
                            </span>
                          )}
                        </button>
                      </td>

                      {/* ACCIONES */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenCrearAlbaran(item)}
                            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                              item.albaranId 
                                ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50' 
                                : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title={item.albaranId ? `Albarán creado (${item.albaranId}) - Clic para generar otro` : "Crear Albarán"}
                          >
                            <svg className="w-5 h-5 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <text x="12" y="19" textAnchor="middle" fill="currentColor" stroke="none" fontSize="11.5" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif">A</text>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-2 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId({ id: item.id, docId: item._docId })}
                            className="p-2 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FLOTANTE RÁPIDO DE NOTA */}
      {notaModalItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <StickyNote className="w-5 h-5" />
                </div>
                <div className="min-w-0 pr-2">
                  <h3 className="font-black text-base text-white tracking-tight truncate">
                    Nota de Urgencia
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {notaModalItem.urgencia || 'Urgencia'} • {notaModalItem.lugar || 'Lugar'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotaModalItem(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                Observaciones / Nota Adicional
              </label>
              <textarea
                rows={5}
                value={notaText}
                onChange={(e) => setNotaText(e.target.value)}
                placeholder="Escribe aquí anotaciones importantes sobre la urgencia..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-amber-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none font-medium text-slate-800"
              />
              <p className="text-[11px] text-slate-400 mt-2 font-medium">
                Esta nota activará el indicador de notificación visual en el listado.
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setNotaText('');
                }}
                className="text-xs font-bold text-red-600 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
              >
                Borrar nota
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNotaModalItem(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveNota}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Guardar Nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR URGENCIA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white tracking-tight">
                    {editingItem ? 'Editar Aviso de Urgencia' : 'Nueva Urgencia'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingItem ? 'Actualiza los datos de la intervención.' : 'Registra un nuevo aviso urgente en el sistema.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 overflow-y-auto">
              {/* TÍTULO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Título de la Tarea <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ej: Fuga de agua en manguera de BIE 3"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              {/* CLIENTE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cliente
                </label>
                <select
                  value={formData.clienteId}
                  onChange={(e) => {
                    const sel: any = clientes.find((c: any) => c.id === e.target.value || c._docId === e.target.value);
                    setFormData({
                      ...formData,
                      clienteId: e.target.value,
                      clienteNombre: sel ? (sel.nombre || sel.razonSocial || '') : '',
                      centroId: '',
                      lugar: ''
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                >
                  <option value="">-- Seleccionar cliente --</option>
                  {clientes.map((c: any) => (
                    <option key={c.id || c._docId} value={c.id || c._docId}>{c.nombre || c.razonSocial || c.id}</option>
                  ))}
                </select>
              </div>

              {/* CENTRO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Centro
                </label>
                <select
                  value={formData.centroId}
                  onChange={(e) => {
                    const sel = centros.find((c: any) => c.id === e.target.value || c._docId === e.target.value);
                    setFormData({
                      ...formData,
                      centroId: e.target.value,
                      lugar: sel ? (sel.nombre || '') : formData.lugar
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                >
                  <option value="">-- Seleccionar centro --</option>
                  {centros
                    .filter((c: any) => !formData.clienteId || c.clienteId === formData.clienteId || c.cliente === formData.clienteId || c.cliente === formData.clienteNombre)
                    .map((c: any) => (
                      <option key={c.id || c._docId} value={c.id || c._docId}>{c.nombre || c.id}</option>
                    ))}
                </select>
              </div>

              {/* LUGAR */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lugar / Centro / Ubicación
                </label>
                <input
                  type="text"
                  value={formData.lugar}
                  onChange={(e) => setFormData({ ...formData, lugar: e.target.value })}
                  placeholder="Ej: Centro Logístico Nave 4"
                  list="urg-centros-list"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                <datalist id="urg-centros-list">
                  {centros.map((c: any) => (
                    <option key={c.id} value={c.nombre || c.id} />
                  ))}
                </datalist>
              </div>

              {/* TÉCNICO Y COMERCIAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Técnico Asignado
                  </label>
                  <input
                    type="text"
                    value={formData.tecnicoAsignado}
                    onChange={(e) => setFormData({ ...formData, tecnicoAsignado: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    list="urg-tecnicos-list"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                  <datalist id="urg-tecnicos-list">
                    {tecnicos.map((t: any) => (
                      <option key={t.id || t._docId} value={`${t.nombre} ${t.apellidos}`.trim()} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Comercial / Responsable
                  </label>
                  <input
                    type="text"
                    value={formData.comercial}
                    onChange={(e) => setFormData({ ...formData, comercial: e.target.value })}
                    placeholder="Ej: Carlos Gómez"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
              </div>

              {/* PRIORIDAD, FECHA Y ESTADO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                    Prioridad
                  </label>
                  <select
                    value={formData.prioridad}
                    onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                  >
                    <option value="Alta">Alta (Roja)</option>
                    <option value="Media">Media (Ámbar)</option>
                    <option value="Baja">Baja (Gris)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-red-500" />
                    Fecha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                  >
                    <option value="Pendiente">Pendiente (Gris)</option>
                    <option value="En curso">En curso (Amarillo)</option>
                    <option value="Parado">Parado (Rojo)</option>
                    <option value="Finalizado">Finalizado (Verde)</option>
                  </select>
                </div>
              </div>

              {/* OBSERVACIONES */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Observaciones / Notas
                </label>
                <textarea
                  rows={3}
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Detalles sobre avería, materiales necesarios, horario de atención..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
                />
              </div>

              {/* Botones */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingItem ? 'Guardar Cambios' : 'Crear Urgencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN DE ELIMINACIÓN */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">
              ¿Eliminar esta urgencia?
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Esta acción eliminará el registro de urgencia permanentemente de la base de datos.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
