import { useState, useEffect } from 'react';
import { 
  HardHat, Plus, Search, Filter, Edit, Trash2, CheckCircle2, 
  Clock, PauseCircle, User, MapPin, Briefcase, 
  X, Save, ChevronDown, FileText, StickyNote, Bell, Calendar,
  ReceiptText
} from 'lucide-react';
import { 
  subscribeInstalaciones, addInstalacion, updateInstalacion, deleteInstalacion, 
  subscribeTecnicos, subscribeCentros, subscribeClientes, subscribeEmpresas, subscribeAlbaranes, addAlbaran,
  type InstalacionItem, type Albaran, type Cliente, type Centro, type Empresa 
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

export default function Instalaciones() {
  const currentMonthName = MESES[new Date().getMonth()];
  const [activeMonth, setActiveMonth] = useState<string>(currentMonthName);

  const [instalaciones, setInstalaciones] = useState<InstalacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('TODOS');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Listas para desplegables de ayuda
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InstalacionItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<{ id: string; docId?: string } | null>(null);

  // Modal rápido de Nota / Notificación
  const [notaModalItem, setNotaModalItem] = useState<InstalacionItem | null>(null);
  const [notaText, setNotaText] = useState('');

  // Modal para Crear Albarán desde Instalación
  const [albaranModalItem, setAlbaranModalItem] = useState<InstalacionItem | null>(null);
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
    instalacion: '',
    lugar: '',
    tecnicoAsignado: '',
    comercial: '',
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
    // 1. Cargar desde LocalStorage para acceso instantáneo
    try {
      const saved = localStorage.getItem('firecheck_db_instalaciones');
      if (saved) {
        setInstalaciones(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error cargando instalaciones de localStorage:', e);
    }

    // 2. Suscribir a Firebase
    const unsubIns = subscribeInstalaciones((items) => {
      setInstalaciones(items);
      localStorage.setItem('firecheck_db_instalaciones', JSON.stringify(items));
      setLoading(false);
    });

    const unsubTec = subscribeTecnicos((items) => setTecnicos(items));
    const unsubCen = subscribeCentros((items) => setCentros(items));
    const unsubCli = subscribeClientes((items) => setClientes(items));
    const unsubEmp = subscribeEmpresas((items) => setEmpresas(items));
    const unsubAlb = subscribeAlbaranes((items) => setAlbaranes(items));

    return () => {
      unsubIns();
      unsubTec();
      unsubCen();
      unsubCli();
      unsubEmp();
      unsubAlb();
    };
  }, []);

  // Guardar en localStorage cuando cambien
  const updateLocalAndState = (newItems: InstalacionItem[]) => {
    setInstalaciones(newItems);
    localStorage.setItem('firecheck_db_instalaciones', JSON.stringify(newItems));
  };

  // Abrir modal para crear
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      instalacion: '',
      lugar: '',
      tecnicoAsignado: '',
      comercial: '',
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'Pendiente',
      observaciones: ''
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEditModal = (item: InstalacionItem) => {
    setEditingItem(item);
    setFormData({
      instalacion: item.instalacion || '',
      lugar: item.lugar || '',
      tecnicoAsignado: item.tecnicoAsignado || '',
      comercial: item.comercial || '',
      fecha: item.fecha || (item.fechaCreacion ? item.fechaCreacion.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      estado: item.estado || 'Pendiente',
      observaciones: item.nota || item.observaciones || ''
    });
    setIsModalOpen(true);
  };

  // Abrir modal para ver / redactar Nota rápida
  const handleOpenNotaModal = (item: InstalacionItem) => {
    setNotaModalItem(item);
    setNotaText(item.nota || item.observaciones || '');
  };

  // Guardar Nota desde modal flotante de notas
  const handleSaveNota = async () => {
    if (!notaModalItem) return;
    const docId = notaModalItem._docId || notaModalItem.id;
    const trimmed = notaText.trim();

    const updatedList = instalaciones.map(i => 
      (i.id === notaModalItem.id || i._docId === notaModalItem._docId)
        ? { ...i, nota: trimmed, observaciones: trimmed }
        : i
    );
    updateLocalAndState(updatedList);

    try {
      await updateInstalacion(docId, { nota: trimmed, observaciones: trimmed });
    } catch (err) {
      console.error('Error al guardar nota de instalación en Firebase:', err);
    }

    setNotaModalItem(null);
  };

  // Abrir modal para Crear Albarán desde la instalación
  const handleOpenCrearAlbaran = (item: InstalacionItem) => {
    setAlbaranModalItem(item);

    // Intentar encontrar el centro y cliente por el nombre de lugar
    const matchCentro = centros.find(c => 
      (c.nombre && item.lugar && c.nombre.toLowerCase().trim() === item.lugar.toLowerCase().trim()) ||
      (c.direccion && item.lugar && c.direccion.toLowerCase().includes(item.lugar.toLowerCase()))
    );

    const clienteId = matchCentro?.clienteId || (clientes.length > 0 ? clientes[0].id : '');
    const centroId = matchCentro?.id || '';
    const empresaId = matchCentro?.empresaId || (empresas.length > 0 ? (empresas[0].id || '') : '');

    // Intentar encontrar el técnico asignado
    const matchTecnico = tecnicos.find(t => 
      `${t.nombre || ''} ${t.apellidos || ''}`.toLowerCase().trim() === (item.tecnicoAsignado || '').toLowerCase().trim() ||
      (t.nombre && (item.tecnicoAsignado || '').toLowerCase().includes(t.nombre.toLowerCase()))
    );

    setAlbaranData({
      empresaId,
      clienteId,
      centroId,
      tecnicoId: matchTecnico?.id || (tecnicos.length > 0 ? tecnicos[0].id : ''),
      concepto: item.instalacion || 'Trabajo de instalación',
      descripcion: (item.nota || item.observaciones || '').trim(),
      precioUnidad: 0
    });
  };

  // Guardar Albarán generado
  const handleSaveAlbaran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albaranModalItem) return;

    if (!albaranData.empresaId || !albaranData.clienteId) {
      alert('Por favor, selecciona una empresa y un cliente para el albarán.');
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

    const insDocId = albaranModalItem._docId || albaranModalItem.id;
    const precio = Number(albaranData.precioUnidad) || 0;

    const nuevoAlbaran: Albaran = {
      id: generatedId,
      empresaId: albaranData.empresaId,
      clienteId: albaranData.clienteId,
      centroId: albaranData.centroId || '',
      tecnicoId: albaranData.tecnicoId || '',
      fechaCreacion: albaranModalItem.fecha ? `${albaranModalItem.fecha}T10:00:00.000Z` : new Date().toISOString(),
      titulo: `Instalación: ${albaranModalItem.instalacion}`,
      instalacionId: insDocId,
      facturado: false,
      nombreFirmante: '',
      items: [
        {
          cantidad: 1,
          concepto: albaranData.concepto || albaranModalItem.instalacion || 'Trabajo de instalación',
          descripcion: albaranData.descripcion || albaranModalItem.nota || albaranModalItem.observaciones || '',
          precioUnidad: precio,
          subtotal: precio
        }
      ]
    };

    try {
      await addAlbaran(nuevoAlbaran);
      // Vincular albaranId en la instalación
      await updateInstalacion(insDocId, { albaranId: generatedId });
      
      const updatedList = instalaciones.map(i => 
        (i.id === albaranModalItem.id || i._docId === albaranModalItem._docId)
          ? { ...i, albaranId: generatedId }
          : i
      );
      updateLocalAndState(updatedList);

      setAlbaranModalItem(null);
      alert(`Albarán ${generatedId} creado con éxito y guardado en Albaranes.`);
    } catch (err) {
      console.error('Error al generar albarán desde instalación:', err);
      alert('Hubo un error al crear el albarán.');
    }
  };

  // Guardar (Crear o Modificar completo)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.instalacion.trim()) {
      alert('Por favor, introduce el nombre o descripción de la instalación.');
      return;
    }

    const calculatedMes = getMonthFromDateStr(formData.fecha);

    if (editingItem) {
      // Editar
      const docId = editingItem._docId || editingItem.id;
      const updatedItem: Partial<InstalacionItem> = {
        instalacion: formData.instalacion.trim(),
        lugar: formData.lugar.trim(),
        tecnicoAsignado: formData.tecnicoAsignado.trim(),
        comercial: formData.comercial.trim(),
        fecha: formData.fecha,
        mes: calculatedMes,
        estado: formData.estado,
        observaciones: formData.observaciones.trim(),
        nota: formData.observaciones.trim()
      };

      const updatedList = instalaciones.map(i => 
        (i.id === editingItem.id || i._docId === editingItem._docId) ? { ...i, ...updatedItem } : i
      );
      updateLocalAndState(updatedList);

      try {
        await updateInstalacion(docId, updatedItem);
      } catch (err) {
        console.error('Error al actualizar instalación en Firebase:', err);
      }
    } else {
      // Crear nuevo
      const newId = `INS-${Date.now().toString().slice(-6)}`;
      const newItem: InstalacionItem = {
        id: newId,
        instalacion: formData.instalacion.trim(),
        lugar: formData.lugar.trim(),
        tecnicoAsignado: formData.tecnicoAsignado.trim(),
        comercial: formData.comercial.trim(),
        fecha: formData.fecha,
        mes: calculatedMes,
        estado: formData.estado,
        observaciones: formData.observaciones.trim(),
        nota: formData.observaciones.trim(),
        fechaCreacion: new Date().toISOString()
      };

      const updatedList = [newItem, ...instalaciones];
      updateLocalAndState(updatedList);

      try {
        await addInstalacion(newItem);
      } catch (err) {
        console.error('Error al agregar instalación en Firebase:', err);
      }
    }

    setIsModalOpen(false);
  };

  // Eliminar
  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const { id, docId } = deleteConfirmId;

    const updatedList = instalaciones.filter(i => i.id !== id && i._docId !== docId);
    updateLocalAndState(updatedList);

    try {
      await deleteInstalacion(docId || id);
    } catch (err) {
      console.error('Error al eliminar instalación en Firebase:', err);
    }

    setDeleteConfirmId(null);
  };

  // Filtrado por mes activo (excluyendo las ya facturadas para que desaparezcan de la lista)
  const instalacionesDelMes = instalaciones.filter(i => getItemMonth(i) === activeMonth && !i.facturado);

  // Filtrado de la lista
  const instalacionesFiltradas = instalacionesDelMes.filter(i => {
    if (estadoFilter !== 'TODOS' && i.estado !== estadoFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchIns = (i.instalacion || '').toLowerCase().includes(q);
      const matchLugar = (i.lugar || '').toLowerCase().includes(q);
      const matchTec = (i.tecnicoAsignado || '').toLowerCase().includes(q);
      const matchCom = (i.comercial || '').toLowerCase().includes(q);
      const matchNota = (i.nota || i.observaciones || '').toLowerCase().includes(q);
      const matchFecha = (i.fecha || '').toLowerCase().includes(q);
      return matchIns || matchLugar || matchTec || matchCom || matchNota || matchFecha;
    }
    return true;
  });

  // Estadísticas del mes activo
  const totalCount = instalacionesDelMes.length;
  const pendientesCount = instalacionesDelMes.filter(i => i.estado === 'Pendiente').length;
  const enCursoCount = instalacionesDelMes.filter(i => i.estado === 'En curso').length;
  const paradosCount = instalacionesDelMes.filter(i => i.estado === 'Parado').length;
  const finalizadosCount = instalacionesDelMes.filter(i => i.estado === 'Finalizado').length;

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
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm shrink-0">
              <HardHat className="w-5 h-5 stroke-[2.25]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Instalaciones</h1>
              <p className="text-xs text-slate-500 font-medium">Gestión de obras e instalaciones, seguimiento de técnicos y notas notificables.</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Nueva Instalación
        </button>
      </div>

      {/* 12 Pestañas de los Meses con Toque de Colores por Estación y Mes */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-sm mb-6 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {MESES.map((mes) => {
            const count = instalaciones.filter(i => getItemMonth(i) === mes).length;
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
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tareas</span>
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
          <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Parados</span>
          <span className="text-2xl font-black text-red-700 mt-2">{paradosCount}</span>
        </div>
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Finalizados</span>
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
            placeholder="Buscar por instalación, lugar, técnico o nota..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-slate-50/50"
          />
        </div>

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

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                <th className="px-6 py-4">INSTALACIÓN</th>
                <th className="px-6 py-4">LUGAR</th>
                <th className="px-6 py-4">TÉCNICO ASIGNADO</th>
                <th className="px-6 py-4">COMERCIAL</th>
                <th className="px-6 py-4">ESTADO</th>
                <th className="px-4 py-4 text-center">NOTA</th>
                <th className="px-6 py-4 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Cargando proyectos de instalación...
                  </td>
                </tr>
              ) : instalacionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                    {search || estadoFilter !== 'TODOS'
                      ? 'No se encontraron proyectos de instalación con los filtros aplicados.'
                      : `No hay proyectos de instalación registrados en ${activeMonth}.`}
                  </td>
                </tr>
              ) : (
                instalacionesFiltradas.map((item) => {
                  const noteContent = (item.nota || item.observaciones || '').trim();
                  const hasNote = noteContent.length > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* INSTALACIÓN */}
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                            <HardHat className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{item.instalacion || 'Sin título'}</p>
                            {item.fecha && (
                              <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1 mt-0.5 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                                <Calendar className="w-3 h-3 text-red-500" />
                                {formatearFecha(item.fecha)}
                              </span>
                            )}
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

                      {/* COMERCIAL */}
                      <td className="px-6 py-4 font-medium text-slate-700">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{item.comercial || '—'}</span>
                        </div>
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
                          
                          {/* Insignia / Punto de notificación si hay algo escrito */}
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
                            className={`p-2 rounded-xl transition-colors cursor-pointer ${
                              item.albaranId 
                                ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50' 
                                : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title={item.albaranId ? `Albarán creado (${item.albaranId}) - Clic para generar otro` : "Crear Albarán"}
                          >
                            <ReceiptText className="w-4 h-4" />
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

      {/* MODAL FLOTANTE RÁPIDO DE NOTA DE INSTALACIÓN */}
      {notaModalItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            {/* Header modal nota */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <StickyNote className="w-5 h-5" />
                </div>
                <div className="min-w-0 pr-2">
                  <h3 className="font-extrabold text-base truncate">
                    Nota de Instalación
                  </h3>
                  <p className="text-xs text-slate-400 truncate">{notaModalItem.instalacion || 'Tarea sin título'}</p>
                </div>
              </div>
              <button
                onClick={() => setNotaModalItem(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido modal nota */}
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                <span>Instrucciones / Observaciones notificables</span>
              </div>

              <textarea
                rows={5}
                autoFocus
                value={notaText}
                onChange={(e) => setNotaText(e.target.value)}
                placeholder="Escribe aquí cualquier nota, aviso o detalle de la instalación..."
                className="w-full p-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-amber-50/30 text-slate-800 resize-none font-medium"
              />

              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                La nota quedará resguardada en el icono con un aviso de notificación encendido.
              </p>

              {/* Botones de acción del modal de notas */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                {notaText.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNotaText('');
                    }}
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                  >
                    Borrar nota
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNotaModalItem(null)}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNota}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-slate-900 bg-amber-400 hover:bg-amber-500 transition-colors shadow-sm cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Guardar Nota
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR COMPLETO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingItem ? 'Editar Instalación' : 'Nueva Instalación'}
                  </h3>
                  <p className="text-xs text-slate-400">Introduce los datos del proyecto de instalación.</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 flex flex-col gap-4">
              {/* INSTALACIÓN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Instalación (Descripción / Proyecto) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.instalacion}
                  onChange={(e) => setFormData({ ...formData, instalacion: e.target.value })}
                  placeholder="Ej: Montaje de sistema de detección en Nave B"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
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
                  placeholder="Ej: Polígono Industrial Sur - Nave 4"
                  list="centros-list"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                <datalist id="centros-list">
                  {centros.map((c: any) => (
                    <option key={c.id} value={c.nombre || c.id} />
                  ))}
                </datalist>
              </div>

              {/* TÉCNICO ASIGNADO Y COMERCIAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Técnico Asignado
                  </label>
                  <input
                    type="text"
                    value={formData.tecnicoAsignado}
                    onChange={(e) => setFormData({ ...formData, tecnicoAsignado: e.target.value })}
                    placeholder="Ej: Manuel Ruiz"
                    list="tecnicos-list"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                  <datalist id="tecnicos-list">
                    {tecnicos.map((t: any) => (
                      <option key={t.id || t._docId} value={`${t.nombre} ${t.apellidos}`.trim()} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Comercial
                  </label>
                  <input
                    type="text"
                    value={formData.comercial}
                    onChange={(e) => setFormData({ ...formData, comercial: e.target.value })}
                    placeholder="Ej: Ana Torres"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
              </div>

              {/* FECHA Y ESTADO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-red-500" />
                    Fecha de Instalación <span className="text-red-500">*</span>
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

              {/* NOTA / OBSERVACIONES */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                  Nota / Observaciones notificables
                </label>
                <textarea
                  rows={2}
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Detalles sobre planos, fechas de acopio o notas de instalación..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {editingItem ? 'Guardar Cambios' : 'Crear Instalación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR CONFIRMACIÓN */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden text-center animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600 shadow-sm">
                <Trash2 className="w-7 h-7 stroke-[2.25]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">¿Eliminar instalación?</h3>
              <p className="text-sm text-slate-500 mt-1">Esta acción no se puede deshacer. Se eliminará el proyecto de instalación.</p>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR ALBARÁN DESDE INSTALACIÓN */}
      {albaranModalItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                  <ReceiptText className="w-5 h-5 stroke-[2.25]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Crear Albarán de Instalación</h3>
                  <p className="text-xs text-slate-500 font-medium">Se enviará a la lista general de Albaranes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAlbaranModalItem(null)}
                className="w-9 h-9 rounded-xl hover:bg-slate-200/70 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAlbaran} className="p-6 space-y-4">
              {/* Información de la tarea origen */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 text-xs space-y-1">
                <div className="flex justify-between font-semibold text-blue-900">
                  <span>Instalación: {albaranModalItem.instalacion}</span>
                  <span>{albaranModalItem.fecha ? formatearFecha(albaranModalItem.fecha) : ''}</span>
                </div>
                <div className="text-blue-700">Lugar: {albaranModalItem.lugar || '—'}</div>
                <div className="text-blue-700">Técnico: {albaranModalItem.tecnicoAsignado || 'Sin asignar'}</div>
              </div>

              {/* Empresa Mantenedora */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Empresa Mantenedora <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={albaranData.empresaId}
                  onChange={(e) => setAlbaranData(prev => ({ ...prev, empresaId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="">Selecciona Empresa...</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cliente <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={albaranData.clienteId}
                  onChange={(e) => setAlbaranData(prev => ({ ...prev, clienteId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="">Selecciona Cliente...</option>
                  {clientes.map((cli) => (
                    <option key={cli.id} value={cli.id}>{cli.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Centro */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Centro / Lugar
                </label>
                <select
                  value={albaranData.centroId}
                  onChange={(e) => setAlbaranData(prev => ({ ...prev, centroId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="">Sin centro específico o seleccionar...</option>
                  {centros
                    .filter(c => !albaranData.clienteId || c.clienteId === albaranData.clienteId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre} {c.direccion ? `(${c.direccion})` : ''}</option>
                    ))}
                </select>
              </div>

              {/* Concepto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Concepto del Albarán <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={albaranData.concepto}
                  onChange={(e) => setAlbaranData(prev => ({ ...prev, concepto: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Descripción / Trabajos realizados */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Descripción / Detalle del trabajo
                </label>
                <textarea
                  rows={2}
                  value={albaranData.descripcion}
                  onChange={(e) => setAlbaranData(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Detalle de la instalación realizada o materiales..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Precio Unitario (€) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Importe (€ sin IVA)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={albaranData.precioUnidad || ''}
                  onChange={(e) => setAlbaranData(prev => ({ ...prev, precioUnidad: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAlbaranModalItem(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                  <ReceiptText className="w-4 h-4" />
                  Crear Albarán
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
