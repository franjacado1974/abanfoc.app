import { useState, useEffect } from 'react';
import { 
  AlertTriangle, Plus, Search, Filter, Edit, Trash2, CheckCircle2, 
  Clock, PauseCircle, User, MapPin, Briefcase, 
  X, Save, ChevronDown, StickyNote, Calendar,
  ReceiptText, ShieldAlert
} from 'lucide-react';
import { 
  subscribeUrgencias, addUrgencia, updateUrgencia, deleteUrgencia, 
  subscribeTecnicos, subscribeCentros, subscribeClientes, subscribeEmpresas, subscribeAlbaranes, addAlbaran,
  moverAPapelera,
  type UrgenciaItem, type Albaran, type Cliente, type Centro, type Empresa 
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
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UrgenciaItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<{ id: string; docId?: string } | null>(null);

  // Modal rápido de Nota / Notificación
  const [notaModalItem, setNotaModalItem] = useState<UrgenciaItem | null>(null);
  const [notaText, setNotaText] = useState('');

  // Modal para Crear Albarán desde Urgencia
  const [albaranModalItem, setAlbaranModalItem] = useState<UrgenciaItem | null>(null);
  const [albaranData, setAlbaranData] = useState({
    empresaId: '',
    clienteId: '',
    centroId: '',
    tecnicoId: '',
    concepto: '',
    descripcion: '',
    precioUnidad: 0
  });

  // Formulario de edición/creación
  const [formData, setFormData] = useState({
    urgencia: '',
    lugar: '',
    tecnicoAsignado: '',
    comercial: '',
    fecha: new Date().toISOString().slice(0, 10),
    prioridad: 'Alta' as 'Baja' | 'Media' | 'Alta',
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
    const unsubAlb = subscribeAlbaranes((items) => setAlbaranes(items));

    return () => {
      unsubUrg();
      unsubTec();
      unsubCen();
      unsubCli();
      unsubEmp();
      unsubAlb();
    };
  }, []);

  const updateLocalAndState = (newItems: UrgenciaItem[]) => {
    setUrgencias(newItems);
    localStorage.setItem('firecheck_db_urgencias', JSON.stringify(newItems));
  };

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      urgencia: '',
      lugar: '',
      tecnicoAsignado: '',
      comercial: '',
      fecha: new Date().toISOString().slice(0, 10),
      prioridad: 'Alta',
      estado: 'Pendiente',
      observaciones: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: UrgenciaItem) => {
    setEditingItem(item);
    setFormData({
      urgencia: item.urgencia || '',
      lugar: item.lugar || '',
      tecnicoAsignado: item.tecnicoAsignado || '',
      comercial: item.comercial || '',
      fecha: item.fecha || (item.fechaCreacion ? item.fechaCreacion.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      prioridad: item.prioridad || 'Media',
      estado: item.estado || 'Pendiente',
      observaciones: item.nota || item.observaciones || ''
    });
    setIsModalOpen(true);
  };

  const handleOpenNotaModal = (item: UrgenciaItem) => {
    setNotaModalItem(item);
    setNotaText(item.nota || item.observaciones || '');
  };

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
      console.error('Error al guardar nota en Firebase:', err);
    }

    setNotaModalItem(null);
  };

  const handleOpenCrearAlbaran = (item: UrgenciaItem) => {
    setAlbaranModalItem(item);

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

    setAlbaranData({
      empresaId,
      clienteId,
      centroId,
      tecnicoId: matchTecnico?.id || (tecnicos.length > 0 ? tecnicos[0].id : ''),
      concepto: item.urgencia || 'Atención de Urgencia',
      descripcion: (item.nota || item.observaciones || '').trim(),
      precioUnidad: 0
    });
  };

  const handleSaveAlbaran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albaranModalItem) return;

    if (!albaranData.empresaId || !albaranData.clienteId) {
      return;
    }

    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `ALB-${year}-`;
    const yearAlbaranes = albaranes.filter(alb => alb.id?.startsWith(prefix));
    let nextNum = 1;
    if (yearAlbaranes.length > 0) {
      const nums = yearAlbaranes.map(alb => {
        const parts = alb.id.split('-');
        return parseInt(parts[parts.length - 1]);
      }).filter(n => !isNaN(n));
      if (nums.length > 0) nextNum = Math.max(...nums) + 1;
    }
    const generatedId = `${prefix}${nextNum.toString().padStart(3, '0')}`;

    const urgDocId = albaranModalItem._docId || albaranModalItem.id;
    const precio = Number(albaranData.precioUnidad) || 0;

    const nuevoAlbaran: Albaran = {
      id: generatedId,
      empresaId: albaranData.empresaId,
      clienteId: albaranData.clienteId,
      centroId: albaranData.centroId || '',
      tecnicoId: albaranData.tecnicoId || '',
      fechaCreacion: albaranModalItem.fecha ? `${albaranModalItem.fecha}T10:00:00.000Z` : new Date().toISOString(),
      titulo: `Urgencia: ${albaranModalItem.urgencia}`,
      reparacionId: urgDocId,
      facturado: false,
      nombreFirmante: '',
      items: [
        {
          cantidad: 1,
          concepto: albaranData.concepto || albaranModalItem.urgencia || 'Atención de Urgencia',
          descripcion: albaranData.descripcion || albaranModalItem.nota || albaranModalItem.observaciones || '',
          precioUnidad: precio,
          subtotal: precio
        }
      ]
    };

    try {
      await addAlbaran(nuevoAlbaran);
      await updateUrgencia(urgDocId, { albaranId: generatedId });

      const updated = urgencias.map(u => 
        (u.id === urgDocId || u._docId === urgDocId)
          ? { ...u, albaranId: generatedId }
          : u
      );
      updateLocalAndState(updated);
      setAlbaranModalItem(null);
    } catch (err) {
      console.error('Error al generar albarán desde urgencia:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.urgencia.trim()) return;

    const parts = formData.fecha.slice(0, 10).split('-');
    let assignedMonth = activeMonth;
    if (parts.length >= 2) {
      const mIdx = parseInt(parts[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        assignedMonth = MESES[mIdx];
      }
    }

    if (editingItem) {
      const docId = editingItem._docId || editingItem.id;
      const updatedItem: UrgenciaItem = {
        ...editingItem,
        urgencia: formData.urgencia.trim(),
        lugar: formData.lugar.trim(),
        tecnicoAsignado: formData.tecnicoAsignado,
        comercial: formData.comercial.trim(),
        fecha: formData.fecha,
        mes: assignedMonth,
        prioridad: formData.prioridad,
        estado: formData.estado,
        observaciones: formData.observaciones.trim(),
        nota: formData.observaciones.trim()
      };

      const nextList = urgencias.map(u => (u.id === editingItem.id || u._docId === editingItem._docId ? updatedItem : u));
      updateLocalAndState(nextList);

      try {
        await updateUrgencia(docId, {
          urgencia: updatedItem.urgencia,
          lugar: updatedItem.lugar,
          tecnicoAsignado: updatedItem.tecnicoAsignado,
          comercial: updatedItem.comercial,
          fecha: updatedItem.fecha,
          mes: updatedItem.mes,
          prioridad: updatedItem.prioridad,
          estado: updatedItem.estado,
          observaciones: updatedItem.observaciones,
          nota: updatedItem.nota
        });
      } catch (err) {
        console.error('Error al actualizar urgencia:', err);
      }
    } else {
      const newId = 'urg_' + Date.now();
      const newItem: UrgenciaItem = {
        id: newId,
        urgencia: formData.urgencia.trim(),
        lugar: formData.lugar.trim(),
        tecnicoAsignado: formData.tecnicoAsignado,
        comercial: formData.comercial.trim(),
        fecha: formData.fecha,
        mes: assignedMonth,
        prioridad: formData.prioridad,
        estado: formData.estado,
        observaciones: formData.observaciones.trim(),
        nota: formData.observaciones.trim(),
        fechaCreacion: new Date().toISOString(),
        facturado: false
      };

      const nextList = [newItem, ...urgencias];
      updateLocalAndState(nextList);

      try {
        await addUrgencia(newItem);
      } catch (err) {
        console.error('Error al crear urgencia:', err);
      }
    }

    setIsModalOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const { id, docId } = deleteConfirmId;
    const targetDocId = docId || id;

    const itemToDelete = urgencias.find(u => u.id === id || u._docId === docId);

    // Mover a papelera según Regla 29
    try {
      if (itemToDelete) {
        await moverAPapelera({
          coleccion: 'urgencias',
          originalDocId: targetDocId,
          tipo: 'Urgencia',
          titulo: `Urgencia: ${itemToDelete.urgencia} (${itemToDelete.lugar || 'Sin lugar'})`,
          datos: itemToDelete,
          usuario: 'Usuario'
        });
      }
    } catch (papeleraErr) {
      console.warn('Error moviendo a papelera:', papeleraErr);
    }

    const nextList = urgencias.filter(u => u.id !== id && u._docId !== targetDocId);
    updateLocalAndState(nextList);

    try {
      await deleteUrgencia(targetDocId);
    } catch (err) {
      console.error('Error eliminando urgencia en Firebase:', err);
    }

    setDeleteConfirmId(null);
  };

  // Conteo de tareas por mes
  const countByMonth = (monthName: string) => {
    return urgencias.filter(u => !u.facturado && getItemMonth(u) === monthName).length;
  };

  // Filtrado de urgencias para el mes activo
  const filteredUrgencias = urgencias
    .filter(u => !u.facturado)
    .filter(u => getItemMonth(u) === activeMonth)
    .filter(u => {
      const matchSearch = 
        u.urgencia.toLowerCase().includes(search.toLowerCase()) ||
        u.lugar.toLowerCase().includes(search.toLowerCase()) ||
        u.tecnicoAsignado.toLowerCase().includes(search.toLowerCase()) ||
        (u.comercial && u.comercial.toLowerCase().includes(search.toLowerCase()));
      const matchEstado = estadoFilter === 'TODOS' || u.estado === estadoFilter;
      const matchPrioridad = prioridadFilter === 'TODAS' || u.prioridad === prioridadFilter;
      return matchSearch && matchEstado && matchPrioridad;
    });

  // Estadísticas del mes activo
  const statsMes = {
    total: urgencias.filter(u => !u.facturado && getItemMonth(u) === activeMonth).length,
    pendientes: urgencias.filter(u => !u.facturado && getItemMonth(u) === activeMonth && u.estado === 'Pendiente').length,
    enCurso: urgencias.filter(u => !u.facturado && getItemMonth(u) === activeMonth && u.estado === 'En curso').length,
    parados: urgencias.filter(u => !u.facturado && getItemMonth(u) === activeMonth && u.estado === 'Parado').length,
    finalizados: urgencias.filter(u => !u.facturado && getItemMonth(u) === activeMonth && u.estado === 'Finalizado').length,
    alta: urgencias.filter(u => !u.facturado && getItemMonth(u) === activeMonth && u.prioridad === 'Alta').length
  };

  const opcionesEstado = [
    { value: 'TODOS', label: 'Todos los estados' },
    { value: 'Pendiente', label: 'Pendiente (Gris)' },
    { value: 'En curso', label: 'En curso (Amarillo)' },
    { value: 'Parado', label: 'Parado (Rojo)' },
    { value: 'Finalizado', label: 'Finalizado (Verde)' },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto min-h-screen">
      {/* Header & Title (ARRIBA) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.25]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Urgencias y Avisos</h1>
              <p className="text-xs text-slate-500 font-medium">Gestión operativa de intervenciones urgentes con prioridad y notas notificables.</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Nueva Urgencia
        </button>
      </div>

      {/* 12 Pestañas de los Meses con Toque de Colores por Estación y Mes (ABAJO DEL TÍTULO) */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-sm mb-6 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {MESES.map((mes) => {
            const count = countByMonth(mes);
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
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tareas</span>
          <span className="text-2xl font-black text-slate-900 mt-2">{statsMes.total}</span>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Pendientes</span>
          <span className="text-2xl font-black text-slate-700 mt-2">{statsMes.pendientes}</span>
        </div>
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">En curso</span>
          <span className="text-2xl font-black text-amber-700 mt-2">{statsMes.enCurso}</span>
        </div>
        <div className="bg-red-50/70 p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Parados</span>
          <span className="text-2xl font-black text-red-700 mt-2">{statsMes.parados}</span>
        </div>
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Finalizados</span>
          <span className="text-2xl font-black text-emerald-700 mt-2">{statsMes.finalizados}</span>
        </div>
        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            Prioridad Alta
          </span>
          <span className="text-2xl font-black text-rose-700 mt-2">{statsMes.alta}</span>
        </div>
      </div>

      {/* Controls: Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por urgencia, lugar, técnico, comercial o nota..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Filtro Prioridad */}
          <select
            value={prioridadFilter}
            onChange={(e) => setPrioridadFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 hover:bg-slate-50 transition-all cursor-pointer shadow-sm focus:outline-hidden focus:border-red-500"
          >
            <option value="TODAS">Prioridad: Todas</option>
            <option value="Alta">Prioridad: Alta (🚨)</option>
            <option value="Media">Prioridad: Media (⚠️)</option>
            <option value="Baja">Prioridad: Baja (🟢)</option>
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
                      estadoFilter === op.value ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{op.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de Urgencias */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">URGENCIA</th>
                <th className="py-3 px-4">LUGAR</th>
                <th className="py-3 px-4">TÉCNICO ASIGNADO</th>
                <th className="py-3 px-4">COMERCIAL</th>
                <th className="py-3 px-4">PRIORIDAD</th>
                <th className="py-3 px-4">ESTADO</th>
                <th className="py-3 px-4 text-center">NOTA</th>
                <th className="py-3 px-4 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Cargando urgencias...
                  </td>
                </tr>
              ) : filteredUrgencias.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600">No hay urgencias registradas para {activeMonth}</p>
                      <p className="text-[11px] text-slate-400">Pulsa en «+ Nueva Urgencia» para añadir una.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUrgencias.map((item) => {
                  const hasNota = !!(item.nota && item.nota.trim());
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. URGENCIA */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-900 text-[13px]">{item.urgencia}</span>
                          <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 text-[11px] font-semibold text-slate-500 w-fit">
                            <Calendar className="w-3 h-3 text-red-500 shrink-0" />
                            <span>{formatearFecha(item.fecha)}</span>
                          </div>
                        </div>
                      </td>

                      {/* 2. LUGAR */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.lugar || '—'}</span>
                        </div>
                      </td>

                      {/* 3. TÉCNICO */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.tecnicoAsignado || 'Sin asignar'}</span>
                        </div>
                      </td>

                      {/* 4. COMERCIAL */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.comercial || '—'}</span>
                        </div>
                      </td>

                      {/* 5. PRIORIDAD */}
                      <td className="py-3 px-4">
                        {item.prioridad === 'Alta' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-red-100 text-red-800 border border-red-300 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                            Alta
                          </span>
                        ) : item.prioridad === 'Media' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Media
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Baja
                          </span>
                        )}
                      </td>

                      {/* 6. ESTADO */}
                      <td className="py-3 px-4">
                        {item.estado === 'Pendiente' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                            <Clock className="w-3 h-3 text-slate-500" />
                            Pendiente
                          </span>
                        )}
                        {item.estado === 'En curso' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)] animate-pulse">
                            <Clock className="w-3 h-3 text-amber-600" />
                            En curso
                          </span>
                        )}
                        {item.estado === 'Parado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-800 border border-red-300 shadow-[0_0_8px_rgba(239,68,68,0.25)]">
                            <PauseCircle className="w-3 h-3 text-red-600" />
                            Parado
                          </span>
                        )}
                        {item.estado === 'Finalizado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Finalizado
                          </span>
                        )}
                      </td>

                      {/* 7. NOTA RÁPIDA */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenNotaModal(item)}
                          className={`relative p-1.5 rounded-lg border transition-all cursor-pointer ${
                            hasNota
                              ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                              : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                          }`}
                          title={hasNota ? item.nota : 'Añadir nota rápida'}
                        >
                          <StickyNote className="w-4 h-4" />
                          {hasNota && (
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                            </span>
                          )}
                        </button>
                      </td>

                      {/* 8. ACCIONES */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {/* Crear Albarán */}
                          <button
                            type="button"
                            onClick={() => handleOpenCrearAlbaran(item)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              item.albaranId
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                            }`}
                            title={item.albaranId ? `Albarán creado (${item.albaranId})` : 'Crear Albarán'}
                          >
                            <ReceiptText className="w-4 h-4" />
                          </button>

                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Editar urgencia"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Eliminar */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId({ id: item.id, docId: item._docId })}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                            title="Eliminar urgencia"
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

      {/* MODAL CREAR / EDITAR URGENCIA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-base text-white">
                  {editingItem ? 'Editar Urgencia' : 'Nueva Urgencia'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Concepto de la Urgencia *
                </label>
                <input
                  type="text"
                  required
                  value={formData.urgencia}
                  onChange={(e) => setFormData({ ...formData, urgencia: e.target.value })}
                  placeholder="Ej: Fuga de agua en BIE planta 2, fallo central de incendios..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Lugar / Centro
                  </label>
                  <input
                    type="text"
                    list="centros-list"
                    value={formData.lugar}
                    onChange={(e) => setFormData({ ...formData, lugar: e.target.value })}
                    placeholder="Centro o dirección"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <datalist id="centros-list">
                    {centros.map((c) => (
                      <option key={c.id} value={c.nombre} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Técnico Asignado
                  </label>
                  <select
                    value={formData.tecnicoAsignado}
                    onChange={(e) => setFormData({ ...formData, tecnicoAsignado: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  >
                    <option value="">-- Sin asignar --</option>
                    {tecnicos.map((t) => (
                      <option key={t.id || t._docId} value={`${t.nombre || ''} ${t.apellidos || ''}`.trim()}>
                        {t.nombre} {t.apellidos || ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Prioridad *
                  </label>
                  <select
                    value={formData.prioridad}
                    onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as any })}
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs font-bold focus:outline-hidden ${
                      formData.prioridad === 'Alta'
                        ? 'border-red-400 bg-red-50 text-red-800'
                        : formData.prioridad === 'Media'
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : 'border-emerald-400 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    <option value="Alta">🚨 Alta</option>
                    <option value="Media">⚠️ Media</option>
                    <option value="Baja">🟢 Baja</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Estado *
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:outline-hidden focus:border-red-500"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En curso">En curso</option>
                    <option value="Parado">Parado</option>
                    <option value="Finalizado">Finalizado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Comercial
                </label>
                <input
                  type="text"
                  value={formData.comercial}
                  onChange={(e) => setFormData({ ...formData, comercial: e.target.value })}
                  placeholder="Nombre del comercial responsable"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Observaciones / Notas
                </label>
                <textarea
                  rows={3}
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Detalles sobre la urgencia, material necesario, contacto de la persona en el centro..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingItem ? 'Guardar Cambios' : 'Crear Urgencia'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RÁPIDO DE NOTA */}
      {notaModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Nota de Urgencia</h3>
              </div>
              <button
                type="button"
                onClick={() => setNotaModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                Urgencia: <strong className="text-slate-800">{notaModalItem.urgencia}</strong>
              </p>
              <textarea
                rows={4}
                value={notaText}
                onChange={(e) => setNotaText(e.target.value)}
                placeholder="Escribe aquí las observaciones o notas rápidas de la urgencia..."
                className="w-full p-3 rounded-xl border border-amber-300 bg-amber-50/30 text-xs font-medium focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setNotaText('')}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                >
                  Borrar texto
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNotaModalItem(null)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNota}
                    className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-md cursor-pointer"
                  >
                    Guardar Nota
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR ALBARÁN */}
      {albaranModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm">Generar Albarán de Urgencia</h3>
              </div>
              <button
                type="button"
                onClick={() => setAlbaranModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAlbaran} className="p-5 space-y-4">
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-950 space-y-1">
                <p><strong>Urgencia:</strong> {albaranModalItem.urgencia}</p>
                <p><strong>Lugar:</strong> {albaranModalItem.lugar || 'No especificado'}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Empresa Mantenedora *
                </label>
                <select
                  required
                  value={albaranData.empresaId}
                  onChange={(e) => setAlbaranData({ ...albaranData, empresaId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:outline-hidden focus:border-blue-600"
                >
                  <option value="">-- Seleccionar Empresa --</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cliente *
                </label>
                <select
                  required
                  value={albaranData.clienteId}
                  onChange={(e) => setAlbaranData({ ...albaranData, clienteId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:outline-hidden focus:border-blue-600"
                >
                  <option value="">-- Seleccionar Cliente --</option>
                  {clientes.map((cli) => (
                    <option key={cli.id} value={cli.id}>{cli.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Importe (€ sin IVA)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={albaranData.precioUnidad}
                    onChange={(e) => setAlbaranData({ ...albaranData, precioUnidad: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Técnico
                  </label>
                  <select
                    value={albaranData.tecnicoId}
                    onChange={(e) => setAlbaranData({ ...albaranData, tecnicoId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:outline-hidden focus:border-blue-600"
                  >
                    <option value="">-- Seleccionar --</option>
                    {tecnicos.map((t) => (
                      <option key={t.id || t._docId} value={t.id || t._docId}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAlbaranModalItem(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Generar Albarán
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-slate-900">¿Eliminar esta urgencia?</h4>
              <p className="text-xs text-slate-500">
                El elemento será movido a la Papelera de reciclaje durante 100 días antes de su eliminación definitiva.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer"
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
