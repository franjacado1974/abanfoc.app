import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchableSelect from './components/SearchableSelect';
import { 
  HardHat, Plus, Search, Filter, Edit, Trash2, CheckCircle2, 
  Clock, PauseCircle, User, MapPin, Briefcase, 
  X, Save, ChevronDown, FileText, StickyNote, Bell, Calendar,
  Building2, Maximize2, Trash, GripVertical, ChevronUp, ReceiptText
} from 'lucide-react';
import { HandOptionsIcon } from './components/HandOptionsIcon';
import { 
  subscribeInstalaciones, addInstalacion, updateInstalacion, deleteInstalacion, 
  subscribeTecnicos, subscribeCentros, subscribeClientes, subscribeEmpresas, subscribeAlbaranes,
  subscribePresupuestos, subscribePedidos, subscribeTrabajos,
  obtenerSiguienteNumeroPedido, obtenerEmpresaPorDefecto,
  type InstalacionItem, type Albaran, type Cliente, type Centro, type Empresa, type Presupuesto, type Pedido, type TrabajoConfig 
} from './firebase';
import { generarPresupuestoPDF } from './pdfGenerator';

const formatMoneda = (valor: any) => {
  const num = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : Number(valor);
  if (isNaN(num)) return '0,00 €';
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${parts.join(',')} €`;
};

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
  const navigate = useNavigate();
  const currentMonthName = MESES[new Date().getMonth()];
  const [activeMonth, setActiveMonth] = useState<string>(currentMonthName);

  const [instalaciones, setInstalaciones] = useState<InstalacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('TODOS');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [limiteInstalaciones, setLimiteInstalaciones] = useState<number | 'todos'>(10);

  // Listas para desplegables de ayuda
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_empresas') || '[]'); } catch { return []; } });
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [trabajosConfig, setTrabajosConfig] = useState<TrabajoConfig[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_trabajos') || '[]'); } catch { return []; } });

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InstalacionItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<{ id: string; docId?: string } | null>(null);
  const [editingDescriptionIndex, setEditingDescriptionIndex] = useState<number | null>(null);
  const [draggedLineIndex, setDraggedLineIndex] = useState<number | null>(null);
  const [dragOverLineIndex, setDragOverLineIndex] = useState<number | null>(null);

  // Modal rápido de Nota / Notificación
  const [notaModalItem, setNotaModalItem] = useState<InstalacionItem | null>(null);
  const [notaText, setNotaText] = useState('');

  // Modal rápido de Acciones (Varita mágica)
  const [accionesModalItem, setAccionesModalItem] = useState<InstalacionItem | null>(null);

  // Formulario de edición/creación
  const [formData, setFormData] = useState({
    titulo: '',
    empresaId: '',
    clienteId: '',
    clienteNombre: '',
    clienteNombreLibre: '',
    centroId: '',
    centroNombreLibre: '',
    instalacion: '',
    lugar: '',
    numeroPedido: '',
    tecnicoAsignado: '',
    comercial: '',
    fecha: new Date().toISOString().slice(0, 10),
    estado: 'Pendiente' as 'Pendiente' | 'En curso' | 'Parado' | 'Finalizado',
    observaciones: '',
    items: [
      { cantidad: 1, concepto: 'Instalación', descripcion: '', precioUnidad: 0, subtotal: 0 }
    ]
  });

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { cantidad: 1, concepto: 'Instalación', descripcion: '', precioUnidad: 0, subtotal: 0 }
      ]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : prev.items
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index], [field]: value };
      if (field === 'cantidad' || field === 'precioUnidad') {
        const cant = field === 'cantidad' ? (Number(value) || 0) : (Number(item.cantidad) || 0);
        const pUnidad = field === 'precioUnidad' ? (Number(value) || 0) : (Number(item.precioUnidad) || 0);
        item.subtotal = cant * pUnidad;
      }
      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  };

  // Reordenar líneas (arrastrar y soltar)
  const handleDragStart = (index: number) => {
    setDraggedLineIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedLineIndex === null || draggedLineIndex === index) return;
    setDragOverLineIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedLineIndex === null || draggedLineIndex === index) {
      setDraggedLineIndex(null);
      setDragOverLineIndex(null);
      return;
    }
    const updated = [...formData.items];
    const [movedItem] = updated.splice(draggedLineIndex, 1);
    updated.splice(index, 0, movedItem);
    setFormData(prev => ({ ...prev, items: updated }));
    setDraggedLineIndex(null);
    setDragOverLineIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedLineIndex(null);
    setDragOverLineIndex(null);
  };

  // Mover línea hacia arriba o hacia abajo
  const handleMoverLinea = (index: number, direccion: 'up' | 'down') => {
    const targetIndex = direccion === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formData.items.length) return;
    const updated = [...formData.items];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFormData(prev => ({ ...prev, items: updated }));
    if (editingDescriptionIndex === index) setEditingDescriptionIndex(targetIndex);
    else if (editingDescriptionIndex === targetIndex) setEditingDescriptionIndex(index);
  };

  // Opciones ordenadas alfabéticamente para búsqueda interactiva
  const clienteOptions = useMemo(() => {
    return clientes
      .map((c: any) => ({
        value: c.id || c._docId,
        label: c.nombre || c.razonSocial || c.id || '',
        sublabel: c.cif || c.nif || ''
      }))
      .filter(opt => opt.value && opt.label)
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [clientes]);


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

  // Scroll arriba al montar la vista
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

    const safeLocalSet = (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn(`[StorageQuota] Error guardando ${key} en localStorage:`, e);
      }
    };

    // Timer de seguridad: liberar pantalla de carga tras 2 segundos si Firestore tarda
    const loadingSafetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    // 2. Suscribir a Firebase
    const unsubIns = subscribeInstalaciones((items) => {
      setInstalaciones(items);
      safeLocalSet('firecheck_db_instalaciones', JSON.stringify(items));
      setLoading(false);
    });

    const unsubTec = subscribeTecnicos((items) => setTecnicos(items));
    const unsubCen = subscribeCentros((items) => setCentros(items));
    const unsubCli = subscribeClientes((items) => setClientes(items));
    const unsubEmp = subscribeEmpresas((items) => setEmpresas(items));
    const unsubAlb = subscribeAlbaranes((items) => setAlbaranes(items));
    const unsubPres = subscribePresupuestos((items) => setPresupuestos(items));
    const unsubPed = subscribePedidos((items) => setPedidos(items));
    const unsubTrab = subscribeTrabajos((items) => setTrabajosConfig(items));

    return () => {
      clearTimeout(loadingSafetyTimer);
      unsubIns();
      unsubTec();
      unsubCen();
      unsubCli();
      unsubEmp();
      unsubAlb();
      unsubPres();
      unsubPed();
      unsubTrab();
    };
  }, []);

  // Si las empresas se cargan y en el formulario de creación aún no hay empresa seleccionada, asignar ABANFOC por defecto
  useEffect(() => {
    if (isModalOpen && !editingItem && !formData.empresaId && empresas.length > 0) {
      setFormData(prev => ({ ...prev, empresaId: obtenerEmpresaPorDefecto(empresas) }));
    }
  }, [empresas, isModalOpen, editingItem, formData.empresaId]);

  // Guardar en localStorage cuando cambien
  const updateLocalAndState = (newItems: InstalacionItem[]) => {
    setInstalaciones(newItems);
    try {
      localStorage.setItem('firecheck_db_instalaciones', JSON.stringify(newItems));
    } catch (e) {
      console.warn('[StorageQuota] Error guardando firecheck_db_instalaciones:', e);
    }
  };

  // Abrir modal para crear
  const handleOpenCreateModal = async () => {
    setEditingItem(null);
    const defaultEmpresaId = obtenerEmpresaPorDefecto(empresas);
    const nextPedido = await obtenerSiguienteNumeroPedido();
    setFormData({
      titulo: '',
      empresaId: defaultEmpresaId,
      clienteId: '',
      clienteNombre: '',
      clienteNombreLibre: '',
      centroId: '',
      centroNombreLibre: '',
      instalacion: '',
      lugar: '',
      numeroPedido: nextPedido,
      tecnicoAsignado: '',
      comercial: '',
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'Pendiente',
      observaciones: '',
      items: [
        { cantidad: 1, concepto: 'Instalación', descripcion: '', precioUnidad: 0, subtotal: 0 }
      ]
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEditModal = (item: InstalacionItem) => {
    setEditingItem(item);
    const defaultEmpresaId = item.empresaId || obtenerEmpresaPorDefecto(empresas);
    const loadedItems = (item.items && item.items.length > 0)
      ? item.items
      : [
          { cantidad: 1, concepto: 'Instalación', descripcion: item.titulo || item.instalacion || item.nota || item.observaciones || '', precioUnidad: 0, subtotal: 0 }
        ];

    setFormData({
      titulo: item.titulo || item.instalacion || '',
      empresaId: defaultEmpresaId,
      clienteId: item.clienteId || '',
      clienteNombre: item.clienteNombre || '',
      clienteNombreLibre: item.clienteNombreLibre || '',
      centroId: item.centroId || '',
      centroNombreLibre: item.centroNombreLibre || '',
      instalacion: item.instalacion || item.titulo || '',
      lugar: item.lugar || '',
      numeroPedido: item.numeroPedido || item.pedidoId || '',
      tecnicoAsignado: item.tecnicoAsignado || '',
      comercial: item.comercial || '',
      fecha: item.fecha || (item.fechaCreacion ? item.fechaCreacion.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      estado: item.estado || 'Pendiente',
      observaciones: item.nota || item.observaciones || '',
      items: loadedItems
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

  // Abrir Albaranes directamente con los datos precargados desde la instalación / presupuesto (albaranModalItem reemplazado por redirección completa a Albaranes)
  const handleOpenCrearAlbaran = (item: InstalacionItem) => {
    const norm = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const lugarNorm = norm(item.lugar);
    const parenMatch = (item.lugar || '').match(/^(.+?)\s*\((.+)\)\s*$/);
    const lugarCentroPart = parenMatch ? norm(parenMatch[1]) : lugarNorm;
    const lugarClientePart = parenMatch ? norm(parenMatch[2]) : '';

    // 1. Buscar si proviene de un presupuesto o pedido vinculado
    const matchPresupuesto = presupuestos.find(p => 
      (item.presupuestoId && (p.id === item.presupuestoId || (p as any)._docId === item.presupuestoId)) ||
      (item.pedidoId && (
        p.numeroPresupuesto === item.pedidoId ||
        `PDV ${p.numeroPresupuesto?.replace(/^(PDV|PRV|PRE)[-\s]*/i, '')}` === item.pedidoId ||
        p.id === item.pedidoId
      ))
    );

    const matchPedido = pedidos.find(ped =>
      (item.pedidoId && (ped.numeroPedido === item.pedidoId || ped.id === item.pedidoId || (ped as any)._docId === item.pedidoId)) ||
      (item.presupuestoId && ped.presupuestoId === item.presupuestoId)
    );

    // 2. Resolver el cliente desde la propia tarea (clienteId, clienteNombre, presupuesto, pedido o texto en lugar)
    const targetClienteId = item.clienteId || matchPresupuesto?.clienteId || matchPedido?.clienteId || '';
    const targetClienteNombre = item.clienteNombre || matchPresupuesto?.nombreCliente || (matchPedido as any)?.nombreCliente || '';

    let matchCliente = clientes.find(c =>
      (targetClienteId && (c.id === targetClienteId || (c as any)._docId === targetClienteId || norm(c.nombre) === norm(targetClienteId))) ||
      (targetClienteNombre && norm(c.nombre) === norm(targetClienteNombre)) ||
      (lugarClientePart && norm(c.nombre) === lugarClientePart) ||
      (lugarNorm && norm(c.nombre) === lugarNorm)
    );

    if (!matchCliente && (targetClienteNombre || lugarNorm)) {
      const searchName = norm(targetClienteNombre) || lugarClientePart || lugarNorm;
      if (searchName) {
        matchCliente = clientes.find(c => norm(c.nombre).includes(searchName) || searchName.includes(norm(c.nombre)));
      }
    }

    // 3. Intentar encontrar el centro por centroId, presupuesto, pedido o nombre de lugar
    const targetCentroId = item.centroId || matchPresupuesto?.centroId || matchPedido?.centroId || '';
    const matchCentro =
      centros.find(c => targetCentroId && ((c as any)._docId === targetCentroId || c.id === targetCentroId)) ||
      (matchCliente ? centros.find(c =>
        (c.clienteId === matchCliente!.id || c.clienteId === (matchCliente as any)._docId) && (
          (c.nombre && (norm(c.nombre) === lugarNorm || norm(c.nombre) === lugarCentroPart)) ||
          (c.direccion && lugarNorm && norm(c.direccion).includes(lugarNorm))
        )
      ) : undefined) ||
      centros.find(c =>
        (c.nombre && (norm(c.nombre) === lugarNorm || norm(c.nombre) === lugarCentroPart)) ||
        (c.direccion && lugarNorm && norm(c.direccion).includes(lugarNorm))
      );

    if (!matchCliente && matchCentro?.clienteId) {
      matchCliente = clientes.find(c => c.id === matchCentro.clienteId || (c as any)._docId === matchCentro.clienteId);
    }

    let clienteId = matchCliente?.id || matchCentro?.clienteId || '';
    let centroId = (matchCentro as any)?._docId || matchCentro?.id || '';

    if (clienteId && !centroId) {
      const centrosDelCliente = centros.filter(c => c.clienteId === clienteId || (matchCliente && c.clienteId === (matchCliente as any)._docId));
      if (centrosDelCliente.length === 1) {
        centroId = (centrosDelCliente[0] as any)._docId || centrosDelCliente[0].id || '';
      }
    }

    const clienteNombreLibre = !clienteId
      ? (targetClienteNombre || targetClienteId || item.lugar || '')
      : '';
    const centroNombreLibre = !centroId ? (item.lugar || '') : '';

    let empresaId =
      (matchPresupuesto as any)?.empresaId ||
      matchPedido?.empresaId ||
      matchCentro?.empresaId ||
      obtenerEmpresaPorDefecto(empresas);
    const existingAlbaran = albaranes.find(a => a.id === item.albaranId || a.instalacionId === (item._docId || item.id));
    let numeroPedido = item.pedidoId || existingAlbaran?.numeroPedido || '';
    let titulo = matchPresupuesto?.titulo || `Instalación: ${item.instalacion || 'Trabajo realizado'}`;

    if (matchPresupuesto && !numeroPedido && matchPresupuesto.numeroPresupuesto) {
      numeroPedido = `PDV ${matchPresupuesto.numeroPresupuesto.replace(/^(PDV|PRV|PRE)[-\s]*/i, '')}`;
    }

    // Intentar encontrar el técnico asignado
    const matchTecnico = tecnicos.find(t => 
      `${t.nombre || ''} ${t.apellidos || ''}`.toLowerCase().trim() === (item.tecnicoAsignado || '').toLowerCase().trim() ||
      (t.nombre && (item.tecnicoAsignado || '').toLowerCase().includes(t.nombre.toLowerCase()))
    );

    // Cargar artículos de la caché local para obtener la familia
    let articulosList: any[] = [];
    try {
      articulosList = JSON.parse(localStorage.getItem('firecheck_db_articulos') || '[]');
    } catch {
      articulosList = [];
    }

    // Construir las líneas del albarán:
    let items: { cantidad: number; concepto: string; descripcion: string; precioUnidad: number; subtotal: number }[] = [];

    if (item.items && item.items.length > 0) {
      items = item.items;
    } else if (matchPresupuesto?.lineas && matchPresupuesto.lineas.length > 0) {
      items = matchPresupuesto.lineas.map(l => {
        const art = articulosList.find(a => 
          (l.codigo && a.codigo && a.codigo === l.codigo) ||
          (a.nombre && l.concepto && a.nombre.toLowerCase().trim() === l.concepto.toLowerCase().trim())
        );
        const familia = art?.familia || l.concepto || 'Instalación';
        const descripcion = l.descripcion || l.concepto || '';
        const cantidad = Number(l.cantidad) || 1;
        const precioUnidad = Number(l.precioUnidad) || 0;
        return {
          cantidad,
          concepto: familia,
          descripcion,
          precioUnidad,
          subtotal: cantidad * precioUnidad
        };
      });
    } else {
      items = [
        {
          cantidad: 1,
          concepto: 'Instalación',
          descripcion: item.titulo || item.instalacion || item.nota || item.observaciones || '',
          precioUnidad: 0,
          subtotal: 0
        }
      ];
    }

    const insDocId = item._docId || item.id;
    const finalEmpresaId = item.empresaId || empresaId;
    const finalNumeroPedido = item.numeroPedido || numeroPedido;

    navigate('/albaranes', {
      state: {
        prefillAlbaran: {
          empresaId: finalEmpresaId,
          clienteId,
          clienteNombreLibre,
          centroId,
          centroNombreLibre,
          tecnicoId: matchTecnico?.id || (tecnicos.length > 0 ? tecnicos[0].id : ''),
          numeroPedido: finalNumeroPedido,
          titulo,
          instalacionId: insDocId,
          fechaCreacion: item.fecha ? `${item.fecha}T10:00:00.000Z` : new Date().toISOString(),
          items
        }
      }
    });
  };

  // Descargar / Ver Pedido de Venta (PDV) en PDF (valorado o sin valorar)
  const handleDescargarPDV = async (item: InstalacionItem, sinValorar: boolean = false) => {
    // 1. Buscar presupuesto o pedido vinculado
    const matchPresupuesto = presupuestos.find(p => 
      (item.presupuestoId && (p.id === item.presupuestoId || (p as any)._docId === item.presupuestoId)) ||
      (item.pedidoId && (
        p.numeroPresupuesto === item.pedidoId ||
        `PDV ${p.numeroPresupuesto?.replace(/^(PDV|PRV|PRE)[-\s]*/i, '')}` === item.pedidoId ||
        p.id === item.pedidoId
      ))
    );

    const matchPedido = pedidos.find(ped => 
      (item.pedidoId && (ped.numeroPedido === item.pedidoId || ped.id === item.pedidoId || (ped as any)._docId === item.pedidoId)) ||
      (item.presupuestoId && ped.presupuestoId === item.presupuestoId)
    );

    // Buscar centro y cliente
    const matchCentro = centros.find(c => 
      (matchPresupuesto?.centroId && ((c as any)._docId === matchPresupuesto.centroId || c.id === matchPresupuesto.centroId)) ||
      (matchPedido?.centroId && ((c as any)._docId === matchPedido.centroId || c.id === matchPedido.centroId)) ||
      (c.nombre && item.lugar && c.nombre.toLowerCase().trim() === item.lugar.toLowerCase().trim()) ||
      (c.direccion && item.lugar && c.direccion.toLowerCase().includes(item.lugar.toLowerCase()))
    );

    const clienteId = matchPresupuesto?.clienteId || matchPedido?.clienteId || matchCentro?.clienteId;
    const clienteObj = clientes.find(c => (c as any)._docId === clienteId || c.id === clienteId);
    const nombreCliente = clienteObj?.nombre || matchPresupuesto?.nombreCliente || (matchPedido as any)?.nombreCliente || item.lugar || 'Cliente';

    // Empresa mantenedora
    const empresaId = matchPresupuesto ? (matchPresupuesto as any).empresaId : (matchPedido?.empresaId || matchCentro?.empresaId);
    let empresaSeleccionada = empresas.find(e => (e as any)._docId === empresaId || (e as any).id === empresaId);
    if (!empresaSeleccionada && empresas.length > 0) {
      const defId = obtenerEmpresaPorDefecto(empresas);
      empresaSeleccionada = empresas.find(e => (e as any)._docId === defId || (e as any).id === defId) || empresas[0];
    }

    // Código de pedido (ej: PDV XXXXXX)
    let codigoPDV = item.pedidoId || matchPedido?.numeroPedido || '';
    if (!codigoPDV && matchPresupuesto?.numeroPresupuesto) {
      codigoPDV = `PDV ${matchPresupuesto.numeroPresupuesto.replace(/^(PDV|PRV|PRE)[-\s]*/i, '')}`;
    }
    if (!codigoPDV) {
      codigoPDV = `PDV-${item.id.replace(/^[A-Z]+-/, '')}`;
    }

    // Líneas del pedido
    let lineasPDF: { concepto: string; codigo?: string; fotoUrl?: string; cantidad: number; precioUnidad: number; subtotal: number }[] = [];

    if (matchPresupuesto?.lineas && matchPresupuesto.lineas.length > 0) {
      lineasPDF = matchPresupuesto.lineas.map(l => ({
        concepto: l.concepto,
        codigo: l.codigo,
        fotoUrl: l.fotoUrl,
        cantidad: Number(l.cantidad) || 1,
        precioUnidad: Number(l.precioUnidad) || 0,
        subtotal: Number(l.subtotal) || ((Number(l.cantidad) || 1) * (Number(l.precioUnidad) || 0))
      }));
    } else if (matchPedido?.items && matchPedido.items.length > 0) {
      lineasPDF = matchPedido.items.map(l => ({
        concepto: l.concepto + (l.descripcion ? ` - ${l.descripcion}` : ''),
        cantidad: Number(l.cantidad) || 1,
        precioUnidad: Number(l.precioUnidad) || 0,
        subtotal: Number(l.subtotal) || ((Number(l.cantidad) || 1) * (Number(l.precioUnidad) || 0))
      }));
    } else {
      lineasPDF = [{
        concepto: item.instalacion || 'Instalación',
        cantidad: 1,
        precioUnidad: 0,
        subtotal: 0
      }];
    }

    const subtotal = matchPresupuesto?.subtotal ?? lineasPDF.reduce((sum, l) => sum + l.subtotal, 0);
    const iva = matchPresupuesto?.iva ?? (subtotal * 0.21);
    const total = matchPresupuesto?.total ?? (subtotal + iva);
    const notas = matchPresupuesto?.notas || matchPedido?.notas || item.observaciones || item.nota || '';
    const fechaCreacion = matchPedido?.fechaCreacion || matchPresupuesto?.fechaCreacion || item.fecha || new Date().toISOString();

    await generarPresupuestoPDF({
      titulo: matchPresupuesto?.titulo || matchPedido?.titulo || `Instalación: ${item.instalacion}`,
      numeroPresupuesto: codigoPDV,
      nombreCliente,
      cliente: clienteObj,
      fechaCreacion,
      estado: 'Aprobado',
      lineas: lineasPDF,
      subtotal,
      iva,
      total,
      notas,
      esPedido: true,
      tituloDocumento: sinValorar ? 'PEDIDO DE VENTA (SIN VALORAR)' : 'PEDIDO DE VENTA',
      sinValorar
    }, empresaSeleccionada);
  };

  // Guardar (Crear o Modificar completo)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombreInstalacion = (formData.titulo || formData.instalacion || '').trim();
    if (!nombreInstalacion) {
      alert('Por favor, introduce el nombre o descripción de la instalación.');
      return;
    }

    const calculatedMes = getMonthFromDateStr(formData.fecha);
    const totalCalc = formData.items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);

    if (editingItem) {
      // Editar
      const docId = editingItem._docId || editingItem.id;
      const updatedItem: Partial<InstalacionItem> = {
        titulo: nombreInstalacion,
        empresaId: formData.empresaId?.trim() || obtenerEmpresaPorDefecto(empresas),
        clienteId: formData.clienteId?.trim() || '',
        clienteNombre: formData.clienteNombre?.trim() || '',
        clienteNombreLibre: formData.clienteNombreLibre?.trim() || '',
        centroId: formData.centroId?.trim() || '',
        centroNombreLibre: formData.centroNombreLibre?.trim() || '',
        instalacion: nombreInstalacion,
        lugar: formData.lugar.trim(),
        numeroPedido: formData.numeroPedido?.trim() || '',
        pedidoId: formData.numeroPedido?.trim() || '',
        tecnicoAsignado: formData.tecnicoAsignado.trim(),
        comercial: formData.comercial.trim(),
        fecha: formData.fecha,
        mes: calculatedMes,
        estado: formData.estado,
        observaciones: formData.observaciones.trim(),
        nota: formData.observaciones.trim(),
        items: formData.items,
        total: totalCalc
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
      const finalPedido = formData.numeroPedido?.trim() || await obtenerSiguienteNumeroPedido();
      const newId = `INS-${Date.now().toString().slice(-6)}`;
      const newItem: InstalacionItem = {
        id: newId,
        titulo: nombreInstalacion,
        empresaId: formData.empresaId?.trim() || obtenerEmpresaPorDefecto(empresas),
        clienteId: formData.clienteId?.trim() || '',
        clienteNombre: formData.clienteNombre?.trim() || '',
        clienteNombreLibre: formData.clienteNombreLibre?.trim() || '',
        centroId: formData.centroId?.trim() || '',
        centroNombreLibre: formData.centroNombreLibre?.trim() || '',
        instalacion: nombreInstalacion,
        lugar: formData.lugar.trim(),
        numeroPedido: finalPedido,
        pedidoId: finalPedido,
        tecnicoAsignado: formData.tecnicoAsignado.trim(),
        comercial: formData.comercial.trim(),
        fecha: formData.fecha,
        mes: calculatedMes,
        estado: formData.estado,
        observaciones: formData.observaciones.trim(),
        nota: formData.observaciones.trim(),
        items: formData.items,
        total: totalCalc,
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

  // Paginación de instalaciones a mostrar
  const instalacionesAMostrar = useMemo(() => {
    if (limiteInstalaciones === 'todos') return instalacionesFiltradas;
    return instalacionesFiltradas.slice(0, Number(limiteInstalaciones));
  }, [instalacionesFiltradas, limiteInstalaciones]);

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
    { value: 'TODOS', label: `Todos los estados (${totalCount})`, colorClass: '' },
    { value: 'Pendiente', label: `Pendientes (${pendientesCount})`, colorClass: 'bg-slate-400' },
    { value: 'En curso', label: `En curso (${enCursoCount})`, colorClass: 'bg-amber-400' },
    { value: 'Parado', label: `Parados (${paradosCount})`, colorClass: 'bg-red-500' },
    { value: 'Finalizado', label: `Finalizados (${finalizadosCount})`, colorClass: 'bg-emerald-500' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 sm:px-8 py-6">
      {/* Header & Title + Controles (Búsqueda, Filtro de Estado y Nueva Instalación) */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div className="shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm shrink-0">
              <HardHat className="w-5 h-5 stroke-[2.25]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Instalaciones</h1>
              <p className="text-xs text-slate-500 font-medium">Gestión de obras e instalaciones, seguimiento de técnicos y notas notificables.</p>
            </div>
          </div>
        </div>

        {/* Controles entre el título y el botón: Búsqueda y Estados */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 justify-start xl:justify-center">
          {/* Campo de búsqueda pequeño */}
          <div className="relative w-44 sm:w-48 lg:w-52 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar instalación..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-white shadow-2xs"
            />
          </div>

          {/* Dropdown Filtro por Estado con Cantidades */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-between gap-2.5 text-slate-800 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>{opcionesEstado.find(o => o.value === estadoFilter)?.label || 'Todos los estados'}</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in duration-150">
                {opcionesEstado.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => {
                      setEstadoFilter(op.value);
                      setIsFilterOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      estadoFilter === op.value
                        ? 'bg-red-50 text-red-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {op.colorClass ? (
                        <span className={`w-2.5 h-2.5 rounded-full ${op.colorClass}`} />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full border border-slate-300" />
                      )}
                      <span>{op.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Botón Nueva Instalación */}
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Nueva Instalación</span>
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

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-200/90 border-b border-zinc-300 text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                <th className="px-5 py-3">INSTALACIÓN</th>
                <th className="w-28 whitespace-nowrap px-4 py-3">FECHA</th>
                <th className="w-48 lg:w-60 px-4 py-3">LUGAR</th>
                <th className="w-40 lg:w-48 whitespace-nowrap px-4 py-3">TÉCNICO ASIGNADO</th>
                <th className="w-36 lg:w-44 whitespace-nowrap px-4 py-3">COMERCIAL</th>
                <th className="w-28 whitespace-nowrap px-4 py-3 text-center">ESTADO</th>
                <th className="w-16 whitespace-nowrap px-3 py-3 text-center">NOTA</th>
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
                instalacionesAMostrar.map((item, index) => {
                  const noteContent = (item.nota || item.observaciones || '').trim();
                  const hasNote = noteContent.length > 0;

                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => setAccionesModalItem(item)}
                      className={`transition-all duration-150 group cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'} hover:bg-amber-100/90 hover:shadow-xs`}
                    >
                      {/* INSTALACIÓN CON REFERENCIA SUSTITUYENDO AL ICONO */}
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {(item.pedidoId || item.numeroPedido) ? (
                            <span className="font-mono text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/80 shrink-0">
                              {item.pedidoId || item.numeroPedido}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 shrink-0">
                              —
                            </span>
                          )}
                          <span className="font-medium text-slate-800 text-sm" title={item.instalacion || 'Sin título'}>
                            {item.instalacion || 'Sin título'}
                          </span>
                        </div>
                      </td>

                      {/* FECHA */}
                      <td className="w-28 whitespace-nowrap px-4 py-2.5 text-xs">
                        {item.fecha ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-red-500" />
                            {formatearFecha(item.fecha)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* LUGAR */}
                      <td className="w-48 lg:w-60 px-4 py-2.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={item.lugar || '—'}>{item.lugar || '—'}</span>
                        </div>
                      </td>

                      {/* TÉCNICO ASIGNADO */}
                      <td className="w-40 lg:w-48 whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={item.tecnicoAsignado || 'Sin asignar'}>{item.tecnicoAsignado || 'Sin asignar'}</span>
                        </div>
                      </td>

                      {/* COMERCIAL */}
                      <td className="w-36 lg:w-44 whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={item.comercial || '—'}>{item.comercial || '—'}</span>
                        </div>
                      </td>

                      {/* ESTADO */}
                      <td className="w-28 whitespace-nowrap px-4 py-2.5 text-center">
                        {renderEstadoBadge(item.estado)}
                      </td>

                      {/* NOTA CON ICONO Y NOTIFICACIÓN SI EXISTE */}
                      <td className="w-16 whitespace-nowrap px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenNotaModal(item);
                          }}
                          className={`relative inline-flex items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer ${
                            hasNote
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs hover:bg-amber-200'
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selector de paginación */}
      {instalacionesFiltradas.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 bg-white px-5 py-3.5 rounded-2xl border border-zinc-200/80 shadow-xs">
          <div className="font-bold text-zinc-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
            {limiteInstalaciones === 'todos' ? (
              <span>Mostrando todas las tareas de instalación ({instalacionesFiltradas.length} en total)</span>
            ) : (
              <span>
                Mostrando las {Math.min(Number(limiteInstalaciones), instalacionesFiltradas.length)} últimas instalaciones
                {instalacionesFiltradas.length > Number(limiteInstalaciones) && (
                  <span className="text-zinc-400 font-normal ml-1">
                    (de {instalacionesFiltradas.length} instalaciones en total)
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-zinc-500 font-semibold uppercase text-[11px] tracking-wider">Mostrar:</span>
            <select
              value={limiteInstalaciones}
              onChange={(e) => setLimiteInstalaciones(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
              className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold rounded-xl px-3.5 py-1.5 outline-none focus:border-red-500 focus:bg-white cursor-pointer transition-colors shadow-2xs"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value="todos">Mostrar todos</option>
            </select>
          </div>
        </div>
      )}

      {/* MODAL FLOTANTE DE ACCIONES RÁPIDAS (VARITA MÁGICA) */}
      {accionesModalItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            {/* Cabecera */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <HandOptionsIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-base truncate">
                    Acciones de la Instalación
                  </h3>
                  <p className="text-xs text-slate-300 truncate">
                    {accionesModalItem.instalacion || 'Tarea sin título'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccionesModalItem(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subcabecera con información resumida */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 flex-wrap text-xs">
              {accionesModalItem.fecha && (
                <span className="inline-flex items-center gap-1 font-medium text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-red-500" />
                  {formatearFecha(accionesModalItem.fecha)}
                </span>
              )}
              {(accionesModalItem.pedidoId || accionesModalItem.numeroPedido) && (
                <span className="font-mono font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/80">
                  {accionesModalItem.pedidoId || accionesModalItem.numeroPedido}
                </span>
              )}
              {accionesModalItem.lugar && (
                <span className="inline-flex items-center gap-1 text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 truncate max-w-[200px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{accionesModalItem.lugar}</span>
                </span>
              )}
            </div>

            {/* Listado de acciones */}
            <div className="p-6 flex flex-col gap-3">
              {/* Acción 1: PDV Valorado */}
              <button
                type="button"
                onClick={() => {
                  const it = accionesModalItem;
                  setAccionesModalItem(null);
                  handleDescargarPDV(it, false);
                }}
                className="w-full flex items-center gap-3.5 p-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-950 transition-all text-left cursor-pointer group hover:shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Search className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-indigo-950">
                      Ver / Descargar Pedido de Venta (PDV)
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-200/70 text-indigo-800 px-1.5 py-0.5 rounded-md">
                      Valorado
                    </span>
                  </div>
                  <div className="text-xs text-indigo-600/80 truncate">
                    Documento oficial con precios, desglose económico y totales
                  </div>
                </div>
              </button>

              {/* Acción 2: PDV Sin Valorar (para operario) */}
              <button
                type="button"
                onClick={() => {
                  const it = accionesModalItem;
                  setAccionesModalItem(null);
                  handleDescargarPDV(it, true);
                }}
                className="w-full flex items-center gap-3.5 p-3 rounded-2xl border border-amber-200/80 bg-amber-50/50 hover:bg-amber-100/70 text-amber-950 transition-all text-left cursor-pointer group hover:shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-950">
                      Descargar Pedido para Operario
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded-md">
                      Sin valorar
                    </span>
                  </div>
                  <div className="text-xs text-amber-700/80 truncate">
                    Para el técnico: tareas, descripciones y unidades sin importes
                  </div>
                </div>
              </button>

              {/* Acción 2: Albarán */}
              <button
                type="button"
                onClick={() => {
                  const it = accionesModalItem;
                  setAccionesModalItem(null);
                  handleOpenCrearAlbaran(it);
                }}
                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl border transition-all text-left cursor-pointer group hover:shadow-xs ${
                  accionesModalItem.albaranId
                    ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-950'
                    : 'border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-blue-950'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                  accionesModalItem.albaranId ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  <ReceiptText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {accionesModalItem.albaranId
                      ? `Albarán creado (${accionesModalItem.albaranId})`
                      : 'Crear Albarán'}
                  </div>
                  <div className={`text-xs truncate ${accionesModalItem.albaranId ? 'text-emerald-700/80' : 'text-blue-700/80'}`}>
                    {accionesModalItem.albaranId
                      ? 'Albarán ya vinculado. Clic para generar otro nuevo'
                      : 'Generar un albarán correlativo desde este proyecto de instalación'}
                  </div>
                </div>
              </button>

              {/* Acción 3: Editar */}
              <button
                type="button"
                onClick={() => {
                  const it = accionesModalItem;
                  setAccionesModalItem(null);
                  handleOpenEditModal(it);
                }}
                className="w-full flex items-center gap-3.5 p-3 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 text-slate-900 transition-all text-left cursor-pointer group hover:shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Edit className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">
                    Editar Instalación
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    Modificar datos, técnico, comercial o líneas de trabajo
                  </div>
                </div>
              </button>

              {/* Acción 4: Eliminar */}
              <button
                type="button"
                onClick={() => {
                  const it = accionesModalItem;
                  setAccionesModalItem(null);
                  setDeleteConfirmId({ id: it.id, docId: it._docId });
                }}
                className="w-full flex items-center gap-3.5 p-3 rounded-2xl border border-red-200 bg-red-50/40 hover:bg-red-50 text-red-950 transition-all text-left cursor-pointer group hover:shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-red-900">
                    Eliminar Instalación
                  </div>
                  <div className="text-xs text-red-600/80 truncate">
                    Enviar este proyecto de instalación a la papelera
                  </div>
                </div>
              </button>
            </div>

            {/* Pie de modal */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setAccionesModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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
      {isModalOpen && (() => {
        const selectedEmpresa = empresas.find(e => (e as any)._docId === formData.empresaId || e.id === formData.empresaId);
        const selectedCliente = clientes.find(c => c.id === formData.clienteId || (c as any)._docId === formData.clienteId);
        const selectedCentro = centros.find(c => (c as any)._docId === formData.centroId || c.id === formData.centroId);
        const filteredCentros = centros.filter(c => c.clienteId === formData.clienteId || (selectedCliente && (c.clienteId === selectedCliente.id || c.clienteId === (selectedCliente as any)._docId)));
        const totalCalc = formData.items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 z-[9999] animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Cabecera */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
                    <HardHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base">
                      {editingItem ? 'Editar Instalación' : 'Nueva Instalación'}
                    </h3>
                    <p className="text-xs text-slate-400">Introduce los datos comerciales, técnicos y partidas de la instalación.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Formulario scrollable */}
              <form onSubmit={handleSubmitForm} className="p-6 md:p-8 flex flex-col gap-6 overflow-y-auto">
                {/* 1. Empresa Mantenedora y Logo */}
                <div className="flex flex-col md:flex-row gap-6 items-start justify-between border-b border-zinc-100 pb-6">
                  <div className="flex-1 space-y-2 w-full">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-red-500" />
                      Empresa Mantenedora *
                    </label>
                    <select
                      required
                      value={formData.empresaId}
                      onChange={e => setFormData({ ...formData, empresaId: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500/20 font-semibold text-sm text-zinc-900"
                    >
                      <option value="">Selecciona Empresa...</option>
                      {empresas.map(emp => (
                        <option key={(emp as any)._docId || emp.id} value={(emp as any)._docId || emp.id}>
                          {emp.nombre}
                        </option>
                      ))}
                    </select>
                    {selectedEmpresa && (
                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-zinc-600 space-y-0.5">
                        <p className="font-bold text-zinc-900">{selectedEmpresa.nombre}</p>
                        <p>{selectedEmpresa.direccion}, {selectedEmpresa.localidad}</p>
                        <p className="font-mono">CIF: {selectedEmpresa.cif}</p>
                      </div>
                    )}
                  </div>
                  <div className="w-full md:w-44 h-28 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden p-3 shrink-0">
                    {selectedEmpresa?.logoUrl ? (
                      <img src={selectedEmpresa.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Building2 className="w-8 h-8 text-zinc-300" />
                    )}
                  </div>
                </div>

                {/* 2. Cliente y Centro de Trabajo con Ubicación */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                        Cliente *
                      </label>
                      <SearchableSelect
                        value={formData.clienteId}
                        onChange={(val, opt) => {
                          const matchCentros = centros.filter(c => c.clienteId === val);
                          const autoCentro = matchCentros.length === 1 ? ((matchCentros[0] as any)._docId || matchCentros[0].id) : '';
                          const autoLugar = matchCentros.length === 1 ? (matchCentros[0].nombre || '') : (opt ? opt.label : '');
                          setFormData({
                            ...formData,
                            clienteId: val,
                            clienteNombre: opt ? opt.label : '',
                            clienteNombreLibre: '',
                            centroId: autoCentro,
                            lugar: autoLugar
                          });
                        }}
                        options={clienteOptions}
                        placeholder="Buscar o seleccionar cliente..."
                        emptyMessage="No se encontraron clientes"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                        Centro de Trabajo
                      </label>
                      <select
                        value={formData.centroId}
                        onChange={e => {
                          const cId = e.target.value;
                          const cenObj = centros.find(c => (c as any)._docId === cId || c.id === cId);
                          setFormData({
                            ...formData,
                            centroId: cId,
                            lugar: cenObj ? cenObj.nombre : (formData.clienteNombre || '')
                          });
                        }}
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none text-sm font-semibold text-zinc-900"
                      >
                        <option value="">Sin centro (Usar datos cliente)</option>
                        {filteredCentros.map(cen => (
                          <option key={(cen as any)._docId || cen.id} value={(cen as any)._docId || cen.id}>
                            {cen.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tarjeta de ubicación */}
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-2 flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-red-600 mb-0.5">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Datos de Ubicación</span>
                    </div>
                    {selectedCentro || selectedCliente ? (
                      <div className="text-xs space-y-1 text-zinc-600">
                        <p className="font-bold text-zinc-900 text-sm">{selectedCentro?.nombre || selectedCliente?.nombre}</p>
                        <p>{selectedCentro?.direccion || selectedCliente?.direccion || 'Sin dirección registrada'}</p>
                        <p>{selectedCentro?.poblacion || selectedCliente?.poblacion || ''} {selectedCentro?.provincia || selectedCliente?.provincia ? `(${selectedCentro?.provincia || selectedCliente?.provincia})` : ''}</p>
                        {(selectedCentro?.telefono || selectedCliente?.telefono) && (
                          <p className="font-mono text-zinc-500">Tel: {selectedCentro?.telefono || selectedCliente?.telefono}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 italic">Selecciona un cliente para visualizar los datos de ubicación.</p>
                    )}
                  </div>
                </div>

                {/* 3. Título, Número de Pedido, Fecha, Estado, Técnico y Comercial */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-100">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Título de la Instalación <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.titulo}
                      onChange={e => setFormData({ ...formData, titulo: e.target.value, instalacion: e.target.value })}
                      placeholder="Ej: Montaje sistema detección analógico nave B"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Número de Pedido
                    </label>
                    <input
                      type="text"
                      value={formData.numeroPedido}
                      onChange={e => setFormData({ ...formData, numeroPedido: e.target.value.toUpperCase() })}
                      placeholder="Ej: PDV 26001 (Opcional)"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold text-zinc-800 outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-red-500" />
                      Fecha de Instalación <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.fecha}
                      onChange={e => setFormData({ ...formData, fecha: e.target.value })}
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Técnico Asignado
                    </label>
                    <input
                      type="text"
                      value={formData.tecnicoAsignado}
                      onChange={e => setFormData({ ...formData, tecnicoAsignado: e.target.value })}
                      placeholder="Ej: Manuel Ruiz"
                      list="ins-tecnicos-list"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                    <datalist id="ins-tecnicos-list">
                      {tecnicos.map((t: any) => (
                        <option key={t.id || t._docId} value={`${t.nombre} ${t.apellidos}`.trim()} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Comercial / Responsable
                    </label>
                    <input
                      type="text"
                      value={formData.comercial}
                      onChange={e => setFormData({ ...formData, comercial: e.target.value })}
                      placeholder="Ej: Ana Torres"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Estado de la Tarea
                    </label>
                    <select
                      value={formData.estado}
                      onChange={e => setFormData({ ...formData, estado: e.target.value as any })}
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-red-500/20"
                    >
                      <option value="Pendiente">Pendiente (Gris)</option>
                      <option value="En curso">En curso (Amarillo)</option>
                      <option value="Parado">Parado (Rojo)</option>
                      <option value="Finalizado">Finalizado (Verde)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Tabla de Líneas / Partidas (idéntica a Albarán) */}
                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-red-500" />
                      Líneas del Trabajo / Albarán
                    </label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Añadir partida
                    </button>
                  </div>

                  <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-zinc-900 text-white text-[11px] uppercase font-bold tracking-wider">
                            <th className="px-2 py-2.5 text-center w-14" title="Posición y orden">Orden</th>
                            <th className="px-3 py-2.5 text-center w-16">Cant.</th>
                            <th className="px-3 py-2.5 text-left w-52">Concepto</th>
                            <th className="px-3 py-2.5 text-left">Descripción</th>
                            <th className="px-3 py-2.5 text-right w-28">P. Unidad</th>
                            <th className="px-3 py-2.5 text-right w-28">Subtotal</th>
                            <th className="px-2 py-2.5 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {formData.items.map((item, index) => (
                            <tr
                              key={index}
                              draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDrop={() => handleDrop(index)}
                              onDragEnd={handleDragEnd}
                              className={`transition-colors group ${
                                draggedLineIndex === index
                                  ? 'opacity-40 bg-red-100'
                                  : dragOverLineIndex === index
                                  ? 'border-t-2 border-red-500 bg-red-50'
                                  : 'hover:bg-zinc-50/70'
                              }`}
                            >
                              <td className="p-1.5 text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                  <div
                                    className="cursor-grab active:cursor-grabbing p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors"
                                    title="Arrastra para mover la partida hacia arriba o hacia abajo"
                                  >
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => handleMoverLinea(index, 'up')}
                                      className="p-0.5 text-zinc-400 hover:text-red-700 disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                      title="Subir partida"
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === formData.items.length - 1}
                                      onClick={() => handleMoverLinea(index, 'down')}
                                      className="p-0.5 text-zinc-400 hover:text-red-700 disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                      title="Bajar partida"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.cantidad}
                                  onChange={e => updateItem(index, 'cantidad', parseInt(e.target.value) || 1)}
                                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-1.5 text-center font-bold text-xs outline-none focus:ring-1 focus:ring-red-500"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={item.concepto}
                                  onChange={e => updateItem(index, 'concepto', e.target.value)}
                                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-1.5 text-xs font-semibold text-zinc-900 outline-none focus:ring-1 focus:ring-red-500"
                                >
                                  <option value="">Seleccionar concepto...</option>
                                  {item.concepto && !trabajosConfig.some(tc => tc.opciones.includes(item.concepto)) && !['Nuevo', 'Revisión', 'Reparación', 'Instalación', 'Suministro', 'Visita técnica', '*Desplazamientos'].includes(item.concepto) && (
                                    <option value={item.concepto}>{item.concepto}</option>
                                  )}
                                  {trabajosConfig.length > 0 ? (
                                    trabajosConfig.map(tc => (
                                      <optgroup key={tc.id} label={tc.id}>
                                        {tc.opciones.map(opt => <option key={`${tc.id}-${opt}`} value={opt}>{opt}</option>)}
                                      </optgroup>
                                    ))
                                  ) : (
                                    ['Instalación', 'Nuevo', 'Revisión', 'Reparación', 'Suministro', 'Visita técnica', '*Desplazamientos'].map(opt => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))
                                  )}
                                </select>
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={item.descripcion}
                                    onChange={e => updateItem(index, 'descripcion', e.target.value)}
                                    placeholder="Detalle de la partida o material..."
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-1.5 text-xs outline-none focus:ring-1 focus:ring-red-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditingDescriptionIndex(index)}
                                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                    title="Ampliar descripción"
                                  >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.precioUnidad === 0 ? '' : item.precioUnidad}
                                  onChange={e => updateItem(index, 'precioUnidad', parseFloat(e.target.value) || 0)}
                                  placeholder="0,00"
                                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-1.5 text-right font-mono text-xs outline-none focus:ring-1 focus:ring-red-500"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-zinc-900 font-mono text-xs whitespace-nowrap">
                                {formatMoneda(item.subtotal)}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItem(index)}
                                  disabled={formData.items.length <= 1}
                                  className="p-1 text-zinc-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Eliminar partida"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumen de Total */}
                    <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs font-bold text-zinc-700">
                      <span>Total Partidas: {formData.items.length}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 uppercase tracking-wider text-[11px]">Total Instalación:</span>
                        <span className="text-base text-zinc-900 font-mono font-black">
                          {formatMoneda(totalCalc)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Nota / Observaciones */}
                <div className="pt-2 border-t border-zinc-100">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                    Nota / Observaciones notificables
                  </label>
                  <textarea
                    rows={2}
                    value={formData.observaciones}
                    onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                    placeholder="Detalles sobre planos, fechas de acopio o notas de instalación..."
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {editingItem ? 'Guardar Cambios' : 'Crear Instalación'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL AMPLIAR DESCRIPCIÓN DE PARTIDA */}
      {editingDescriptionIndex !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[10000] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h4 className="font-bold text-sm text-zinc-900">Editar Descripción de la Partida</h4>
              <button
                type="button"
                onClick={() => setEditingDescriptionIndex(null)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={6}
              value={formData.items[editingDescriptionIndex]?.descripcion || ''}
              onChange={e => updateItem(editingDescriptionIndex, 'descripcion', e.target.value)}
              placeholder="Escribe la descripción completa o detallada del trabajo..."
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEditingDescriptionIndex(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Aceptar
              </button>
            </div>
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
    </div>
  );
}
