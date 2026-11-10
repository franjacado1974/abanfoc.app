import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  Search,
  X,
  Filter,
  FileText,
  CheckCircle2,
  Clock,
  Wrench,
  HardHat,
  Gauge,
  AlertTriangle,
  Building2,
  MapPin,
  Plus,
  Trash,
  Edit,
  Maximize2,
  Save,
  Download,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Eye,
  Printer,
  ReceiptText,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Signature,
  StickyNote,
  Check
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import {
  db,
  subscribeReparaciones,
  subscribeInstalaciones,
  subscribeUrgencias,
  subscribeAlbaranes,
  subscribeClientes,
  subscribeCentros,
  subscribeTecnicos,
  subscribeEmpresas,
  subscribeTrabajos,
  addAlbaran,
  updateAlbaran,
  updateReparacion,
  updateInstalacion,
  updateUrgencia,
  obtenerSiguienteNumeroAlbaran,
  extraerSufijoSecuencia,
  obtenerEmpresaPorDefecto,
  type ReparacionItem,
  type InstalacionItem,
  type UrgenciaItem,
  type Albaran,
  type Cliente,
  type Centro,
  type Tecnico,
  type Empresa,
  type TrabajoConfig
} from './firebase';
import { generarAlbaranPDF, generarPresupuestoPDF } from './pdfGenerator';

export type TipoTareaOperacion = 'reparacion' | 'instalacion' | 'prueba-tecnica' | 'urgencia';

export interface TareaOperacionUnificada {
  uid: string; // `${origen}:${id}`
  id: string;
  _docId?: string;
  origen: TipoTareaOperacion;
  tipoLabel: string;
  numeroPedido: string;
  titulo: string;
  empresaId: string;
  clienteId: string;
  clienteNombre: string;
  clienteNombreLibre: string;
  centroId: string;
  centroNombre: string;
  centroNombreLibre: string;
  poblacion: string;
  lugar: string;
  tecnicoAsignado: string;
  comercial: string;
  fecha: string; // YYYY-MM-DD
  estado: 'Pendiente' | 'En curso' | 'Parado' | 'Finalizado';
  prioridad?: string;
  nota: string;
  items: {
    cantidad: number;
    concepto: string;
    descripcion: string;
    precioUnidad: number;
    descuento?: number;
    subtotal: number;
  }[];
  albaranId?: string;
  facturado?: boolean;
  raw: any;
}

interface PartesTrabajoOperacionesProps {
  isTecnicoMode?: boolean;
  loggedUser?: { id?: string; nombre: string; apellidos?: string; rol: string } | null;
  onBack?: () => void;
}

const formatMoneda = (valor: any) => {
  const num = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : Number(valor);
  if (isNaN(num)) return '0,00 €';
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${parts.join(',')} €`;
};

const isFirmaValida = (firma: string | undefined): boolean => {
  if (!firma) return false;
  if (firma.length <= 400) return false;
  if (firma.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAADICAYAAAA0n5+2')) return false;
  return true;
};

const isCanvasBlank = (canvas: HTMLCanvasElement | null): boolean => {
  if (!canvas) return true;
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;
  try {
    const buffer = new Uint32Array(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !buffer.some(color => color !== 0);
  } catch {
    return true;
  }
};

const getFormattedDate = (isoString: string | undefined): string => {
  if (!isoString) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString.trim())) return isoString.trim();
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatFechaDisplay = (dateStr?: string): string => {
  if (!dateStr) return 'Sin fecha';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr.replace(/-/g, '/');
};

const parseDateToNum = (dateStr?: string): number => {
  if (!dateStr) return 0;
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length === 3) {
    if (parts[0] > 1900) {
      return parts[0] * 10000 + parts[1] * 100 + parts[2];
    }
    return parts[2] * 10000 + parts[1] * 100 + parts[0];
  }
  return 0;
};

export default function PartesTrabajoOperaciones({
  isTecnicoMode = false,
  loggedUser: propLoggedUser,
  onBack
}: PartesTrabajoOperacionesProps) {
  const loggedUser = useMemo(() => {
    if (propLoggedUser) return propLoggedUser;
    try {
      const raw = sessionStorage.getItem('firecheck_logged_user') || localStorage.getItem('firecheck_logged_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [propLoggedUser]);

  // ─── ESTADOS DE COLECCIONES ───
  const [reparaciones, setReparaciones] = useState<ReparacionItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_reparaciones') || '[]'); } catch { return []; }
  });
  const [instalaciones, setInstalaciones] = useState<InstalacionItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_instalaciones') || '[]'); } catch { return []; }
  });
  const [urgencias, setUrgencias] = useState<UrgenciaItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_urgencias') || '[]'); } catch { return []; }
  });
  const [pruebasTecnicas, setPruebasTecnicas] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_pruebas_tecnicas') || '[]'); } catch { return []; }
  });
  const [albaranes, setAlbaranes] = useState<Albaran[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]'); } catch { return []; }
  });
  const [clientes, setClientes] = useState<Cliente[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'); } catch { return []; }
  });
  const [centros, setCentros] = useState<Centro[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'); } catch { return []; }
  });
  const [tecnicos, setTecnicos] = useState<Tecnico[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]'); } catch { return []; }
  });
  const [empresas, setEmpresas] = useState<Empresa[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_empresas') || '[]'); } catch { return []; }
  });
  const [trabajosConfig, setTrabajosConfig] = useState<TrabajoConfig[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_trabajos') || '[]'); } catch { return []; }
  });

  // ─── FILTROS Y BÚSQUEDA DE LA VISTA LISTA ───
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'TODOS' | TipoTareaOperacion>('TODOS');
  const [estadoFilter, setEstadoFilter] = useState<string>('Pendiente');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState<'fecha' | 'cliente' | 'centro' | 'poblacion' | 'tipo' | 'tecnico'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [limitePartes, setLimitePartes] = useState<number | 'todos'>(10);

  // ─── VISTA DETALLE / ALBARÁN DEL PARTE DE TRABAJO ───
  const [verParteTarea, setVerParteTarea] = useState<TareaOperacionUnificada | null>(null);
  const [editarParteTarea, setEditarParteTarea] = useState<TareaOperacionUnificada | null>(null);
  const [tareaOpcionesModal, setTareaOpcionesModal] = useState<TareaOperacionUnificada | null>(null);
  const [editParteForm, setEditParteForm] = useState<{
    titulo: string;
    numeroPedido: string;
    fecha: string;
    estado: 'Pendiente' | 'En curso' | 'Parado' | 'Finalizado';
    clienteNombre: string;
    centroNombre: string;
    lugar: string;
    tecnicoAsignado: string;
    nota: string;
    items: { cantidad: number; concepto: string; descripcion: string; precioUnidad: number; descuento?: number; subtotal: number }[];
  }>({
    titulo: '',
    numeroPedido: '',
    fecha: '',
    estado: 'Pendiente',
    clienteNombre: '',
    centroNombre: '',
    lugar: '',
    tecnicoAsignado: '',
    nota: '',
    items: [{ cantidad: 1, concepto: '', descripcion: '', precioUnidad: 0, subtotal: 0 }]
  });
  const [selectedTarea, setSelectedTarea] = useState<TareaOperacionUnificada | null>(null);
  const [existingAlbaranId, setExistingAlbaranId] = useState<string | null>(null);
  const [estadoTareaActual, setEstadoTareaActual] = useState<'Pendiente' | 'En curso' | 'Parado' | 'Finalizado'>('En curso');
  const [notaTecnico, setNotaTecnico] = useState('');

  const [form, setForm] = useState<Albaran>({
    id: '',
    empresaId: '',
    clienteId: '',
    centroId: '',
    fechaCreacion: new Date().toISOString(),
    items: [{ cantidad: 1, concepto: '', descripcion: '', precioUnidad: 0, subtotal: 0 }],
    nombreFirmante: '',
    tecnicoId: '',
    facturado: false,
    numeroPedido: '',
    titulo: '',
    reparacionId: '',
    instalacionId: '',
    urgenciaId: ''
  });

  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [editingDescriptionIndex, setEditingDescriptionIndex] = useState<number | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [precioUnidadInput, setPrecioUnidadInput] = useState<string>('');
  const [draggedLineIndex, setDraggedLineIndex] = useState<number | null>(null);
  const [dragOverLineIndex, setDragOverLineIndex] = useState<number | null>(null);

  const canvasClienteRef = useRef<HTMLCanvasElement>(null);
  const canvasTecnicoRef = useRef<HTMLCanvasElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const [signingRole, setSigningRole] = useState<'cliente' | 'tecnico' | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendCompleted, setSendCompleted] = useState(false);

  // Cerrar dropdown de estado al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };


    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Suscripciones en tiempo real a Firestore
  useEffect(() => {
    window.scrollTo(0, 0);
    const unsubs: (() => void)[] = [];

    try {
      unsubs.push(subscribeReparaciones((items) => {
        setReparaciones(items);
        try { localStorage.setItem('firecheck_db_reparaciones', JSON.stringify(items)); } catch {}
      }));
    } catch {}

    try {
      unsubs.push(subscribeInstalaciones((items) => {
        setInstalaciones(items);
        try { localStorage.setItem('firecheck_db_instalaciones', JSON.stringify(items)); } catch {}
      }));
    } catch {}

    try {
      unsubs.push(subscribeUrgencias((items) => {
        setUrgencias(items);
        try { localStorage.setItem('firecheck_db_urgencias', JSON.stringify(items)); } catch {}
      }));
    } catch {}

    try {
      const qPruebas = query(collection(db, 'pruebas_tecnicas'), orderBy('createdAt', 'desc'));
      unsubs.push(onSnapshot(qPruebas, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPruebasTecnicas(list);
        try { localStorage.setItem('firecheck_db_pruebas_tecnicas', JSON.stringify(list)); } catch {}
      }));
    } catch {}

    try {
      unsubs.push(subscribeAlbaranes((items) => {
        setAlbaranes(items);
        try { localStorage.setItem('firecheck_db_albaranes', JSON.stringify(items)); } catch {}
      }));
    } catch {}

    try {
      unsubs.push(subscribeClientes((items) => {
        setClientes(items);
        try { localStorage.setItem('firecheck_db_clientes', JSON.stringify(items)); } catch {}
      }));
    } catch {}

    try {
      unsubs.push(subscribeCentros((items) => {
        setCentros(items);
        try { localStorage.setItem('firecheck_db_centros', JSON.stringify(items)); } catch {}
      }));
    } catch {}

    try {
      unsubs.push(subscribeTecnicos((items) => {
        setTecnicos(items);
        try { localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(items)); } catch {}
      }));
    } catch {}

    try {
      unsubs.push(subscribeEmpresas((items) => {
        setEmpresas(items);
        try { localStorage.setItem('firecheck_db_empresas', JSON.stringify(items)); } catch {}
      }));
    } catch {}

    try {
      unsubs.push(subscribeTrabajos((items) => {
        setTrabajosConfig(items);
        try { localStorage.setItem('firecheck_db_trabajos', JSON.stringify(items)); } catch {}
      }));
    } catch {}

    return () => {
      unsubs.forEach(u => { if (typeof u === 'function') u(); });
    };


  }, []);

  useEffect(() => {
    if (editingLineIndex !== null && form.items[editingLineIndex]) {
      const val = form.items[editingLineIndex].precioUnidad;
      setPrecioUnidadInput(val === 0 ? '' : val.toString().replace('.', ','));
    } else {
      setPrecioUnidadInput('');
    }
  }, [editingLineIndex, form.items]);

  // ─── UNIFICACIÓN DE TAREAS DE OPERACIONES ───
  const todasLasTareas = useMemo<TareaOperacionUnificada[]>(() => {
    const getClienteObj = (id?: string, nombre?: string) => {
      if (id) {
        const found = clientes.find(c => c.id === id || (c as any)._docId === id);
        if (found) return found;
      }
      if (nombre) {
        const clean = nombre.trim().toLowerCase();
        return clientes.find(c => (c.nombre || '').trim().toLowerCase() === clean);
      }
      return undefined;
    };



    const getCentroObj = (centroId?: string, lugar?: string, clienteId?: string) => {
      if (centroId) {
        const found = centros.find(c => c._docId === centroId || c.id === centroId);
        if (found) return found;
      }
      if (lugar) {
        const clean = lugar.trim().toLowerCase();
        const found = centros.find(c =>
          (c.nombre || '').trim().toLowerCase() === clean &&
          (!clienteId || c.clienteId === clienteId)
        ) || centros.find(c => (c.nombre || '').trim().toLowerCase() === clean);
        if (found) return found;
      }
      return undefined;
    };



    const normalizarEstado = (est?: string): 'Pendiente' | 'En curso' | 'Parado' | 'Finalizado' => {
      const s = (est || '').trim().toLowerCase();
      if (s === 'finalizado' || s === 'solucionado' || s === 'conforme' || s === 'realizado' || s === 'completado') return 'Finalizado';
      if (s === 'en curso' || s === 'en proceso' || s === 'en revisión' || s === 'abierto') return 'En curso';
      if (s === 'parado' || s === 'no_conforme') return 'Parado';
      return 'Pendiente';
    };



    const lista: TareaOperacionUnificada[] = [];

    // 1. Reparaciones
    for (const r of reparaciones) {
      if (r.facturado) continue;
      const docId = r._docId || r.id;
      const cli = getClienteObj(r.clienteId, r.clienteNombre || r.clienteNombreLibre);
      const cen = getCentroObj(r.centroId, r.lugar || r.centroNombreLibre, cli?.id || r.clienteId);
      const titulo = r.titulo || r.reparacion || 'Reparación';
      const nota = r.nota || r.observaciones || '';
      const items = (r.items && r.items.length > 0)
        ? r.items
        : [{ cantidad: 1, concepto: 'Reparación', descripcion: titulo + (nota ? ` — ${nota}` : ''), precioUnidad: 0, subtotal: 0 }];

      lista.push({
        uid: `reparacion:${docId}`,
        id: r.id || docId,
        _docId: docId,
        origen: 'reparacion',
        tipoLabel: 'Reparación',
        numeroPedido: r.numeroPedido || r.pedidoId || '',
        titulo,
        empresaId: r.empresaId || '',
        clienteId: cli?.id || r.clienteId || '',
        clienteNombre: cli?.nombre || r.clienteNombre || r.clienteNombreLibre || '—',
        clienteNombreLibre: r.clienteNombreLibre || (!cli ? (r.clienteNombre || '') : ''),
        centroId: cen?._docId || cen?.id || r.centroId || '',
        centroNombre: cen?.nombre || r.centroNombreLibre || r.lugar || '—',
        centroNombreLibre: r.centroNombreLibre || (!cen ? (r.lugar || '') : ''),
        poblacion: cen?.poblacion || cli?.poblacion || '',
        lugar: r.lugar || cen?.nombre || '',
        tecnicoAsignado: r.tecnicoAsignado || '',
        comercial: r.comercial || '',
        fecha: r.fecha || (r.fechaCreacion ? r.fechaCreacion.slice(0, 10) : ''),
        estado: normalizarEstado(r.estado),
        nota,
        items,
        albaranId: r.albaranId,
        facturado: Boolean(r.facturado),
        raw: r
      });
    }

    // 2. Instalaciones
    for (const inst of instalaciones) {
      if (inst.facturado) continue;
      const docId = inst._docId || inst.id;
      const cli = getClienteObj(inst.clienteId, inst.clienteNombre || inst.clienteNombreLibre);
      const cen = getCentroObj(inst.centroId, inst.lugar || inst.centroNombreLibre, cli?.id || inst.clienteId);
      const titulo = inst.titulo || inst.instalacion || 'Instalación';
      const nota = inst.nota || inst.observaciones || '';
      const items = (inst.items && inst.items.length > 0)
        ? inst.items
        : [{ cantidad: 1, concepto: 'Instalación', descripcion: titulo + (nota ? ` — ${nota}` : ''), precioUnidad: 0, subtotal: 0 }];

      lista.push({
        uid: `instalacion:${docId}`,
        id: inst.id || docId,
        _docId: docId,
        origen: 'instalacion',
        tipoLabel: 'Instalación',
        numeroPedido: inst.numeroPedido || inst.pedidoId || '',
        titulo,
        empresaId: inst.empresaId || '',
        clienteId: cli?.id || inst.clienteId || '',
        clienteNombre: cli?.nombre || inst.clienteNombre || inst.clienteNombreLibre || '—',
        clienteNombreLibre: inst.clienteNombreLibre || (!cli ? (inst.clienteNombre || '') : ''),
        centroId: cen?._docId || cen?.id || inst.centroId || '',
        centroNombre: cen?.nombre || inst.centroNombreLibre || inst.lugar || '—',
        centroNombreLibre: inst.centroNombreLibre || (!cen ? (inst.lugar || '') : ''),
        poblacion: cen?.poblacion || cli?.poblacion || '',
        lugar: inst.lugar || cen?.nombre || '',
        tecnicoAsignado: inst.tecnicoAsignado || '',
        comercial: inst.comercial || '',
        fecha: inst.fecha || (inst.fechaCreacion ? inst.fechaCreacion.slice(0, 10) : ''),
        estado: normalizarEstado(inst.estado),
        nota,
        items,
        albaranId: inst.albaranId,
        facturado: Boolean(inst.facturado),
        raw: inst
      });
    }

    // 3. Avisos y Urgencias
    for (const u of urgencias) {
      if (u.facturado) continue;
      const docId = u._docId || u.id;
      const cli = getClienteObj(u.clienteId, u.clienteNombre || u.clienteNombreLibre);
      const cen = getCentroObj(u.centroId, u.lugar || u.centroNombreLibre, cli?.id || u.clienteId);
      const titulo = u.titulo || u.urgencia || 'Aviso / Urgencia';
      const nota = u.nota || u.observaciones || '';
      const items = (u.items && u.items.length > 0)
        ? u.items
        : [{ cantidad: 1, concepto: 'Visita técnica', descripcion: titulo + (nota ? ` — ${nota}` : ''), precioUnidad: 0, subtotal: 0 }];

      lista.push({
        uid: `urgencia:${docId}`,
        id: u.id || docId,
        _docId: docId,
        origen: 'urgencia',
        tipoLabel: 'Aviso / Urgencia',
        numeroPedido: u.numeroPedido || u.pedidoId || '',
        titulo,
        empresaId: u.empresaId || '',
        clienteId: cli?.id || u.clienteId || '',
        clienteNombre: cli?.nombre || u.clienteNombre || u.clienteNombreLibre || '—',
        clienteNombreLibre: u.clienteNombreLibre || (!cli ? (u.clienteNombre || '') : ''),
        centroId: cen?._docId || cen?.id || u.centroId || '',
        centroNombre: cen?.nombre || u.centroNombreLibre || u.lugar || '—',
        centroNombreLibre: u.centroNombreLibre || (!cen ? (u.lugar || '') : ''),
        poblacion: cen?.poblacion || cli?.poblacion || '',
        lugar: u.lugar || cen?.nombre || '',
        tecnicoAsignado: u.tecnicoAsignado || '',
        comercial: u.comercial || '',
        fecha: u.fecha || (u.fechaCreacion ? u.fechaCreacion.slice(0, 10) : ''),
        estado: normalizarEstado(u.estado),
        prioridad: u.prioridad,
        nota,
        items,
        albaranId: u.albaranId,
        facturado: Boolean(u.facturado),
        raw: u
      });
    }

    // 4. Pruebas Técnicas
    for (const pt of pruebasTecnicas) {
      if (pt.facturado) continue;
      const docId = pt.id;
      const cli = getClienteObj(pt.clienteId, pt.clienteNombre);
      const cen = getCentroObj(pt.centroId, pt.centroNombre, cli?.id || pt.clienteId);
      const subTipo = pt.tipo === 'grupo-presion' ? 'Grupo de Presión' : 'Red Pública';
      const eqLabel = pt.equipoAMedirLabel || pt.tipoEquipo || subTipo;
      const titulo = pt.titulo || `Prueba Técnica (${subTipo}) - ${eqLabel}`;
      const nota = pt.observaciones || '';
      const estRaw = pt.estado || (pt.albaranId ? 'Finalizado' : pt.evaluacionGlobal === 'conforme' ? 'Finalizado' : 'Pendiente');
      const items = (pt.items && pt.items.length > 0)
        ? pt.items
        : [{
            cantidad: 1,
            concepto: 'Visita técnica',
            descripcion: `${titulo}${pt.presionEstatica ? ` · P.Est: ${pt.presionEstatica} bar` : ''}${nota ? ` · ${nota}` : ''}`,
            precioUnidad: 0,
            subtotal: 0
          }];

      lista.push({
        uid: `prueba-tecnica:${docId}`,
        id: docId,
        _docId: docId,
        origen: 'prueba-tecnica',
        tipoLabel: 'Prueba Técnica',
        numeroPedido: pt.pedidoId || pt.numeroPedido || '',
        titulo,
        empresaId: pt.empresaId || '',
        clienteId: cli?.id || pt.clienteId || '',
        clienteNombre: cli?.nombre || pt.clienteNombre || '—',
        clienteNombreLibre: !cli ? (pt.clienteNombre || '') : '',
        centroId: cen?._docId || cen?.id || pt.centroId || '',
        centroNombre: cen?.nombre || pt.centroNombre || '—',
        centroNombreLibre: !cen ? (pt.centroNombre || '') : '',
        poblacion: cen?.poblacion || cli?.poblacion || '',
        lugar: pt.centroNombre || cen?.nombre || '',
        tecnicoAsignado: pt.tecnicoNombre || '',
        comercial: pt.comercial || '',
        fecha: pt.fechaEnsayo || (pt.createdAt ? String(pt.createdAt).slice(0, 10) : ''),
        estado: normalizarEstado(estRaw),
        nota,
        items,
        albaranId: pt.albaranId,
        facturado: Boolean(pt.facturado),
        raw: pt
      });
    }

    return lista;
  }, [reparaciones, instalaciones, urgencias, pruebasTecnicas, clientes, centros]);

  // Contadores por tipo para las pestañas superiores
  const countsPorTipo = useMemo(() => {
    return {
      TODOS: todasLasTareas.length,
      reparacion: todasLasTareas.filter(t => t.origen === 'reparacion').length,
      instalacion: todasLasTareas.filter(t => t.origen === 'instalacion').length,
      'prueba-tecnica': todasLasTareas.filter(t => t.origen === 'prueba-tecnica').length,
      urgencia: todasLasTareas.filter(t => t.origen === 'urgencia').length,
    };
  }, [todasLasTareas]);

  // Contadores por estado según el tipo de operación actual y búsqueda/fechas
  const countsPorEstado = useMemo(() => {
    const base = todasLasTareas.filter(t => {
      // 1. Tipo de operación actual
      if (tipoFilter !== 'TODOS' && t.origen !== tipoFilter) return false;

      // 2. Búsqueda por texto si está activa
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const fDisp = formatFechaDisplay(t.fecha).toLowerCase();
        const haystack = `${t.clienteNombre} ${t.centroNombre} ${t.poblacion} ${t.lugar} ${t.titulo} ${t.numeroPedido} ${t.tecnicoAsignado} ${t.tipoLabel} ${t.fecha} ${fDisp} ${t.nota}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // 3. Rango de fechas si está activo
      if (startDate || endDate) {
        const dNum = parseDateToNum(t.fecha);
        if (!dNum) return false;
        if (startDate) {
          const sNum = parseDateToNum(startDate);
          if (dNum < sNum) return false;
        }
        if (endDate) {
          const eNum = parseDateToNum(endDate);
          if (dNum > eNum) return false;
        }
      }

      return true;
    });

    return {
      TODOS: base.length,
      Pendiente: base.filter(t => t.estado === 'Pendiente').length,
      'En curso': base.filter(t => t.estado === 'En curso').length,
      Parado: base.filter(t => t.estado === 'Parado').length,
      Finalizado: base.filter(t => t.estado === 'Finalizado').length,
    };
  }, [todasLasTareas, tipoFilter, searchTerm, startDate, endDate]);

  // Filtrado y ordenación
  const tareasFiltradas = useMemo(() => {
    return todasLasTareas
      .filter(t => {
        // 1. Filtro por tipo de operación
        if (tipoFilter !== 'TODOS' && t.origen !== tipoFilter) return false;

        // 2. Filtro por estado
        if (estadoFilter !== 'TODOS' && t.estado !== estadoFilter) return false;

        // 3. Filtro por texto
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const fDisp = formatFechaDisplay(t.fecha).toLowerCase();
          const haystack = `${t.clienteNombre} ${t.centroNombre} ${t.poblacion} ${t.lugar} ${t.titulo} ${t.numeroPedido} ${t.tecnicoAsignado} ${t.tipoLabel} ${t.fecha} ${fDisp} ${t.nota}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }

        // 4. Filtro por rango de fechas
        if (startDate || endDate) {
          const dNum = parseDateToNum(t.fecha);
          if (!dNum) return false;
          if (startDate) {
            const sNum = parseDateToNum(startDate);
            if (dNum < sNum) return false;
          }
          if (endDate) {
            const eNum = parseDateToNum(endDate);
            if (dNum > eNum) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'fecha') {
          const nA = parseDateToNum(a.fecha);
          const nB = parseDateToNum(b.fecha);
          if (!nA && !nB) cmp = a.titulo.localeCompare(b.titulo, 'es');
          else if (!nA) cmp = 1;
          else if (!nB) cmp = -1;
          else cmp = nA - nB;
        } else if (sortField === 'cliente') {
          cmp = a.clienteNombre.localeCompare(b.clienteNombre, 'es', { sensitivity: 'base' });
        } else if (sortField === 'centro') {
          cmp = a.centroNombre.localeCompare(b.centroNombre, 'es', { sensitivity: 'base' });
        } else if (sortField === 'poblacion') {
          cmp = (a.poblacion || '').localeCompare(b.poblacion || '', 'es', { sensitivity: 'base' });
        } else if (sortField === 'tipo') {
          cmp = a.tipoLabel.localeCompare(b.tipoLabel, 'es', { sensitivity: 'base' });
        } else if (sortField === 'tecnico') {
          cmp = (a.tecnicoAsignado || '').localeCompare(b.tecnicoAsignado || '', 'es', { sensitivity: 'base' });
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [todasLasTareas, tipoFilter, estadoFilter, searchTerm, startDate, endDate, sortField, sortOrder]);

  const tareasAMostrar = useMemo(() => {
    if (limitePartes === 'todos') return tareasFiltradas;
    return tareasFiltradas.slice(0, Number(limitePartes));
  }, [tareasFiltradas, limitePartes]);

  const handleSort = (field: 'fecha' | 'cliente' | 'centro' | 'poblacion' | 'tipo' | 'tecnico') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };



  // ─── ABRIR TAREA Y CARGAR / PREPARAR SU ALBARÁN ───
  const handleAbrirTarea = async (tarea: TareaOperacionUnificada) => {
    // Buscar si ya existe un albarán vinculado a esta tarea
    const albExistente = albaranes.find(a =>
      (tarea.albaranId && a.id === tarea.albaranId) ||
      (tarea.origen === 'reparacion' && a.reparacionId && (a.reparacionId === tarea._docId || a.reparacionId === tarea.id)) ||
      (tarea.origen === 'instalacion' && a.instalacionId && (a.instalacionId === tarea._docId || a.instalacionId === tarea.id)) ||
      (tarea.origen === 'urgencia' && a.urgenciaId && (a.urgenciaId === tarea._docId || a.urgenciaId === tarea.id)) ||
      (tarea.numeroPedido && a.numeroPedido && a.numeroPedido === tarea.numeroPedido)
    );

    setSelectedTarea(tarea);
    setNotaTecnico(tarea.nota || '');
    setEstadoTareaActual(tarea.estado === 'Pendiente' ? 'En curso' : tarea.estado);

    // Si estaba en Pendiente, pasar a En curso automáticamente en segundo plano
    if (tarea.estado === 'Pendiente') {
      try {
        const docId = tarea._docId || tarea.id;
        if (tarea.origen === 'reparacion') {
          await updateReparacion(docId, { estado: 'En curso' });
        } else if (tarea.origen === 'instalacion') {
          await updateInstalacion(docId, { estado: 'En curso' });
        } else if (tarea.origen === 'urgencia') {
          await updateUrgencia(docId, { estado: 'En curso' });
        } else if (tarea.origen === 'prueba-tecnica') {
          await updateDoc(doc(db, 'pruebas_tecnicas', docId), { estado: 'En curso' });
        }
      } catch {}
    }

    if (albExistente) {
      setExistingAlbaranId(albExistente.id);
      setForm({
        ...albExistente,
        empresaId: albExistente.empresaId || tarea.empresaId || obtenerEmpresaPorDefecto(empresas),
        clienteId: albExistente.clienteId || tarea.clienteId || '',
        centroId: albExistente.centroId || tarea.centroId || '',
        clienteNombreLibre: albExistente.clienteNombreLibre || tarea.clienteNombreLibre || '',
        centroNombreLibre: albExistente.centroNombreLibre || tarea.centroNombreLibre || '',
        items: albExistente.items && albExistente.items.length > 0 ? albExistente.items : tarea.items,
        reparacionId: tarea.origen === 'reparacion' ? (tarea._docId || tarea.id) : (albExistente.reparacionId || ''),
        instalacionId: tarea.origen === 'instalacion' ? (tarea._docId || tarea.id) : (albExistente.instalacionId || ''),
        urgenciaId: tarea.origen === 'urgencia' ? (tarea._docId || tarea.id) : (albExistente.urgenciaId || ''),
      });
    } else {
      setExistingAlbaranId(null);
      let generatedId = '';
      if (tarea.numeroPedido) {
        const sufijo = extraerSufijoSecuencia(tarea.numeroPedido);
        if (sufijo) {
          generatedId = `ALB.${sufijo}`;
        }
      }
      if (!generatedId) {
        generatedId = await obtenerSiguienteNumeroAlbaran();
      }

      // Emparejar técnico asignado con la lista de técnicos
      const matchTec = tecnicos.find(t => {
        const full = `${t.nombre || ''} ${t.apellidos || ''}`.trim().toLowerCase();
        const asig = (tarea.tecnicoAsignado || loggedUser?.nombre || '').trim().toLowerCase();
        return asig && (full.includes(asig) || asig.includes((t.nombre || '').trim().toLowerCase()));
      });

      const defaultEmpId = tarea.empresaId || obtenerEmpresaPorDefecto(empresas);

      setForm({
        id: generatedId,
        empresaId: defaultEmpId,
        clienteId: tarea.clienteId || '',
        centroId: tarea.centroId || '',
        clienteNombreLibre: tarea.clienteNombreLibre || (!tarea.clienteId && tarea.clienteNombre !== '—' ? tarea.clienteNombre : ''),
        centroNombreLibre: tarea.centroNombreLibre || (!tarea.centroId && tarea.centroNombre !== '—' ? tarea.centroNombre : ''),
        tecnicoId: matchTec?.id || (tecnicos[0]?.id || ''),
        fechaCreacion: tarea.fecha ? `${tarea.fecha.slice(0, 10)}T10:00:00.000Z` : new Date().toISOString(),
        items: tarea.items && tarea.items.length > 0
          ? tarea.items.map(it => ({ ...it }))
          : [{ cantidad: 1, concepto: tarea.tipoLabel, descripcion: tarea.titulo, precioUnidad: 0, subtotal: 0 }],
        nombreFirmante: '',
        facturado: false,
        numeroPedido: tarea.numeroPedido || '',
        titulo: `${tarea.tipoLabel}: ${tarea.titulo}`,
        reparacionId: tarea.origen === 'reparacion' ? (tarea._docId || tarea.id) : '',
        instalacionId: tarea.origen === 'instalacion' ? (tarea._docId || tarea.id) : '',
        urgenciaId: tarea.origen === 'urgencia' ? (tarea._docId || tarea.id) : '',
      });
    }
    window.scrollTo(0, 0);
  };



  // Inicializar canvas de firmas al abrir el detalle de la tarea
  const initDraw = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    let drawing = false;
    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;
      if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };


    };


    canvas.onmousedown = (e) => { drawing = true; const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); };
    canvas.onmousemove = (e) => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); };
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.ontouchstart = (e) => { drawing = true; const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); };
    canvas.ontouchmove = (e) => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); };
    canvas.ontouchend = () => { drawing = false; };
  };



  useEffect(() => {
    if (selectedTarea) {
      const timer = setTimeout(() => {
        initDraw(canvasClienteRef.current);
        initDraw(canvasTecnicoRef.current);

        if (form.firmaCliente && canvasClienteRef.current) {
          const imgC = new Image();
          imgC.onload = () => {
            const ctx = canvasClienteRef.current?.getContext('2d');
            ctx?.clearRect(0, 0, canvasClienteRef.current!.width, canvasClienteRef.current!.height);
            ctx?.drawImage(imgC, 0, 0, canvasClienteRef.current!.width, canvasClienteRef.current!.height);
          };


          imgC.src = form.firmaCliente;
        }
        if (form.firmaTecnico && canvasTecnicoRef.current) {
          const imgT = new Image();
          imgT.onload = () => {
            const ctx = canvasTecnicoRef.current?.getContext('2d');
            ctx?.clearRect(0, 0, canvasTecnicoRef.current!.width, canvasTecnicoRef.current!.height);
            ctx?.drawImage(imgT, 0, 0, canvasTecnicoRef.current!.width, canvasTecnicoRef.current!.height);
          };


          imgT.src = form.firmaTecnico;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedTarea, existingAlbaranId]);

  useEffect(() => {
    if (signingRole !== null) {
      const timer = setTimeout(() => {
        initDraw(modalCanvasRef.current);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [signingRole]);

  // ─── GESTIÓN DE LÍNEAS DEL ALBARÁN ───
  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { cantidad: 1, concepto: '', descripcion: '', precioUnidad: 0, descuento: 0, subtotal: 0 }]
    }));
  };



  const removeItem = (index: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };



  const updateItem = (index: number, field: keyof Albaran['items'][0], value: string | number) => {
    setForm(prev => {
      const newItems = prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value } as Albaran['items'][0];
          if (field === 'cantidad' || field === 'precioUnidad' || field === 'descuento') {
            const cant = Number(updatedItem.cantidad) || 0;
            const precio = Number(updatedItem.precioUnidad) || 0;
            const dto = Number(updatedItem.descuento) || 0;
            updatedItem.subtotal = cant * precio * (1 - dto / 100);
          }
          return updatedItem;
        }
        return item;
      });
      return { ...prev, items: newItems };
    });
  };



  const handleDragStart = (index: number) => setDraggedLineIndex(index);
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
    const updated = [...form.items];
    const [moved] = updated.splice(draggedLineIndex, 1);
    updated.splice(index, 0, moved);
    setForm(prev => ({ ...prev, items: updated }));
    setDraggedLineIndex(null);
    setDragOverLineIndex(null);
  };


  const handleDragEnd = () => {
    setDraggedLineIndex(null);
    setDragOverLineIndex(null);
  };



  const handleMoverLinea = (index: number, direccion: 'up' | 'down') => {
    const targetIndex = direccion === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= form.items.length) return;
    const updated = [...form.items];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setForm(prev => ({ ...prev, items: updated }));
  };



  // ─── DESCARGAR PDF DEL ALBARÁN ───
  const handleDescargarPDFActual = async () => {
    const rawFirmaCliente = canvasClienteRef.current && !isCanvasBlank(canvasClienteRef.current)
      ? canvasClienteRef.current.toDataURL('image/png')
      : form.firmaCliente || '';
    const rawFirmaTecnico = canvasTecnicoRef.current && !isCanvasBlank(canvasTecnicoRef.current)
      ? canvasTecnicoRef.current.toDataURL('image/png')
      : form.firmaTecnico || '';

    const empId = form.empresaId || centros.find(c => c._docId === form.centroId || c.id === form.centroId)?.empresaId;
    let empresa = empresas.find(e => e._docId === empId || e.id === empId || (e.nombre && empId && e.nombre.trim().toLowerCase() === empId.trim().toLowerCase()));
    if (!empresa && empId) {
      try {
        const docSnap = await getDoc(doc(db, 'empresa', empId));
        if (docSnap.exists()) empresa = { _docId: docSnap.id, ...(docSnap.data() as any) };
      } catch {}
    }
    const tecnico = tecnicos.find(t => t.id === form.tecnicoId);
    const tecnicoNombre = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : (selectedTarea?.tecnicoAsignado || '');
    const cliente = clientes.find(c => c.id === form.clienteId);
    const centro = centros.find(c => c._docId === form.centroId || c.id === form.centroId);
    const clienteParaPDF = cliente || (form.clienteNombreLibre ? { nombre: form.clienteNombreLibre } : { nombre: selectedTarea?.clienteNombre || 'Cliente' });
    const centroParaPDF = centro || (form.centroNombreLibre ? { nombre: form.centroNombreLibre } : { nombre: selectedTarea?.centroNombre || 'Centro' });

    await generarAlbaranPDF(
      clienteParaPDF as any,
      centroParaPDF as any,
      [],
      form.id,
      tecnicoNombre,
      rawFirmaCliente,
      rawFirmaTecnico,
      form.nombreFirmante,
      form.items,
      empresa as any,
      false,
      form.titulo,
      undefined,
      undefined,
      form.numeroPedido,
      form.fechaCreacion
    );
  };



  // Descargar / Imprimir documento PDF del Parte de Trabajo
  const handleDescargarPartePDF = async (tarea: TareaOperacionUnificada, autoPrint: boolean = false) => {
    const cliObj = clientes.find(c => c.id === tarea.clienteId || (c as any)._docId === tarea.clienteId);
    let empObj = empresas.find(e => e._docId === tarea.empresaId || e.id === tarea.empresaId);
    if (!empObj && empresas.length > 0) {
      const defId = obtenerEmpresaPorDefecto(empresas);
      empObj = empresas.find(e => e._docId === defId || e.id === defId) || empresas[0];
    }

    const codigoParte = tarea.numeroPedido || tarea.id || 'PARTE';
    const lineasPDF = (tarea.items && tarea.items.length > 0)
      ? tarea.items.map(it => ({
          concepto: `${it.concepto || tarea.tipoLabel}${it.descripcion ? ` - ${it.descripcion}` : ''}`,
          descripcion: it.descripcion || it.concepto || tarea.titulo,
          familia: it.concepto || tarea.tipoLabel,
          cantidad: Number(it.cantidad) || 1,
          precioUnidad: Number(it.precioUnidad) || 0,
          subtotal: Number(it.subtotal) || 0
        }))
      : [{
          concepto: `${tarea.tipoLabel} - ${tarea.titulo}`,
          descripcion: tarea.titulo,
          familia: tarea.tipoLabel,
          cantidad: 1,
          precioUnidad: 0,
          subtotal: 0
        }];

    const subtotal = lineasPDF.reduce((acc, l) => acc + l.subtotal, 0);
    const iva = subtotal * 0.21;
    const total = subtotal + iva;

    const notasExtras = [
      tarea.centroNombre && tarea.centroNombre !== '—' ? `Centro: ${tarea.centroNombre}` : '',
      tarea.lugar ? `Ubicación: ${tarea.lugar}` : '',
      tarea.poblacion ? `Población: ${tarea.poblacion}` : '',
      tarea.tecnicoAsignado ? `Técnico asignado: ${tarea.tecnicoAsignado}` : '',
      tarea.nota ? `Observaciones: ${tarea.nota}` : ''
    ].filter(Boolean).join('\n');

    await generarPresupuestoPDF({
      titulo: `${tarea.tipoLabel}: ${tarea.titulo}`,
      numeroPresupuesto: codigoParte,
      nombreCliente: tarea.clienteNombre !== '—' ? tarea.clienteNombre : (tarea.centroNombre || 'Cliente'),
      cliente: cliObj,
      fechaCreacion: tarea.fecha || new Date().toISOString(),
      estado: 'Aprobado',
      lineas: lineasPDF,
      subtotal,
      iva,
      total,
      notas: notasExtras,
      esPedido: true,
      tituloDocumento: 'PARTE DE TRABAJO',
      sinValorar: true,
      autoPrint
    }, empObj as any);
  };



  // Abrir modal de Editar Parte de Trabajo
  const handleOpenEditarParte = (tarea: TareaOperacionUnificada) => {
    setEditarParteTarea(tarea);
    setEditParteForm({
      titulo: tarea.titulo || '',
      numeroPedido: tarea.numeroPedido || '',
      fecha: tarea.fecha ? tarea.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10),
      estado: tarea.estado || 'Pendiente',
      clienteNombre: tarea.clienteNombre !== '—' ? tarea.clienteNombre : '',
      centroNombre: tarea.centroNombre !== '—' ? tarea.centroNombre : '',
      lugar: tarea.lugar || (tarea.centroNombre !== '—' ? tarea.centroNombre : ''),
      tecnicoAsignado: tarea.tecnicoAsignado || '',
      nota: tarea.nota || '',
      items: tarea.items && tarea.items.length > 0
        ? tarea.items.map(it => ({ ...it, descuento: it.descuento || 0 }))
        : [{ cantidad: 1, concepto: tarea.tipoLabel, descripcion: tarea.titulo, precioUnidad: 0, descuento: 0, subtotal: 0 }]
    });
  };



  // Guardar cambios desde el modal Editar Parte
  const handleGuardarEditarParte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editarParteTarea) return;
    const docId = editarParteTarea._docId || editarParteTarea.id;
    const totalCalc = editParteForm.items.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);

    try {
      if (editarParteTarea.origen === 'reparacion') {
        const payload: Partial<ReparacionItem> = {
          titulo: editParteForm.titulo.trim(),
          reparacion: editParteForm.titulo.trim(),
          numeroPedido: editParteForm.numeroPedido.trim(),
          pedidoId: editParteForm.numeroPedido.trim(),
          fecha: editParteForm.fecha,
          estado: editParteForm.estado,
          lugar: editParteForm.lugar.trim() || editParteForm.centroNombre.trim(),
          tecnicoAsignado: editParteForm.tecnicoAsignado.trim(),
          nota: editParteForm.nota.trim(),
          observaciones: editParteForm.nota.trim(),
          items: editParteForm.items,
          total: totalCalc
        };


        await updateReparacion(docId, payload);
        const stored = JSON.parse(localStorage.getItem('firecheck_db_reparaciones') || '[]');
        const updated = stored.map((r: any) => (r.id === docId || r._docId === docId) ? { ...r, ...payload } : r);
        localStorage.setItem('firecheck_db_reparaciones', JSON.stringify(updated));
        setReparaciones(updated);
      } else if (editarParteTarea.origen === 'instalacion') {
        const payload: Partial<InstalacionItem> = {
          titulo: editParteForm.titulo.trim(),
          instalacion: editParteForm.titulo.trim(),
          numeroPedido: editParteForm.numeroPedido.trim(),
          pedidoId: editParteForm.numeroPedido.trim(),
          fecha: editParteForm.fecha,
          estado: editParteForm.estado,
          lugar: editParteForm.lugar.trim() || editParteForm.centroNombre.trim(),
          tecnicoAsignado: editParteForm.tecnicoAsignado.trim(),
          nota: editParteForm.nota.trim(),
          observaciones: editParteForm.nota.trim(),
          items: editParteForm.items,
          total: totalCalc
        };


        await updateInstalacion(docId, payload);
        const stored = JSON.parse(localStorage.getItem('firecheck_db_instalaciones') || '[]');
        const updated = stored.map((i: any) => (i.id === docId || i._docId === docId) ? { ...i, ...payload } : i);
        localStorage.setItem('firecheck_db_instalaciones', JSON.stringify(updated));
        setInstalaciones(updated);
      } else if (editarParteTarea.origen === 'urgencia') {
        const payload: Partial<UrgenciaItem> = {
          titulo: editParteForm.titulo.trim(),
          urgencia: editParteForm.titulo.trim(),
          numeroPedido: editParteForm.numeroPedido.trim(),
          pedidoId: editParteForm.numeroPedido.trim(),
          fecha: editParteForm.fecha,
          estado: editParteForm.estado,
          lugar: editParteForm.lugar.trim() || editParteForm.centroNombre.trim(),
          tecnicoAsignado: editParteForm.tecnicoAsignado.trim(),
          nota: editParteForm.nota.trim(),
          observaciones: editParteForm.nota.trim(),
          items: editParteForm.items,
          total: totalCalc
        };


        await updateUrgencia(docId, payload);
        const stored = JSON.parse(localStorage.getItem('firecheck_db_urgencias') || '[]');
        const updated = stored.map((u: any) => (u.id === docId || u._docId === docId) ? { ...u, ...payload } : u);
        localStorage.setItem('firecheck_db_urgencias', JSON.stringify(updated));
        setUrgencias(updated);
      } else if (editarParteTarea.origen === 'prueba-tecnica') {
        const payload = {
          titulo: editParteForm.titulo.trim(),
          numeroPedido: editParteForm.numeroPedido.trim(),
          fechaEnsayo: editParteForm.fecha,
          estado: editParteForm.estado,
          centroNombre: editParteForm.lugar.trim() || editParteForm.centroNombre.trim(),
          tecnicoNombre: editParteForm.tecnicoAsignado.trim(),
          observaciones: editParteForm.nota.trim(),
          items: editParteForm.items
        };


        await updateDoc(doc(db, 'pruebas_tecnicas', docId), payload);
        const stored = JSON.parse(localStorage.getItem('firecheck_db_pruebas_tecnicas') || '[]');
        const updated = stored.map((pt: any) => pt.id === docId ? { ...pt, ...payload } : pt);
        localStorage.setItem('firecheck_db_pruebas_tecnicas', JSON.stringify(updated));
        setPruebasTecnicas(updated);
      }
      setEditarParteTarea(null);
    } catch (err) {
      console.error('Error actualizando parte de trabajo:', err);
      alert('Error al guardar los cambios del parte.');
    }
  };



  // ─── GUARDAR Y FIRMAR PARTE DE TRABAJO / ALBARÁN ───
  const handleSaveParteTrabajo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarea) return;

    if (!form.id || !form.empresaId || (!form.clienteId && !form.clienteNombreLibre)) {
      alert('Por favor, verifica la Empresa Mantenedora y el Cliente antes de guardar.');
      return;
    }

    const rawFirmaCliente = canvasClienteRef.current?.toDataURL('image/png') || '';
    const rawFirmaTecnico = canvasTecnicoRef.current?.toDataURL('image/png') || '';

    const firmaCliente = isCanvasBlank(canvasClienteRef.current) ? (form.firmaCliente || '') : rawFirmaCliente;
    const firmaTecnico = isCanvasBlank(canvasTecnicoRef.current) ? (form.firmaTecnico || '') : rawFirmaTecnico;

    const tieneFirma = isFirmaValida(firmaCliente) || isFirmaValida(firmaTecnico);
    const estadoFinalTarea: 'Pendiente' | 'En curso' | 'Parado' | 'Finalizado' =
      tieneFirma ? 'Finalizado' : estadoTareaActual;

    const albaranToSave: Albaran = {
      ...form,
      firmaCliente,
      firmaTecnico,
      fechaCreacion: form.fechaCreacion || new Date().toISOString()
    };



    setIsSending(true);
    setSendProgress(20);
    setSendCompleted(false);

    try {
      setSendProgress(50);
      let finalAlbaranId = albaranToSave.id;

      if (existingAlbaranId || albaranes.some(a => a.id === albaranToSave.id)) {
        await updateAlbaran(albaranToSave);
      } else {
        const saved = await addAlbaran(albaranToSave);
        finalAlbaranId = saved.id || albaranToSave.id;
      }

      setSendProgress(80);
      const docId = selectedTarea._docId || selectedTarea.id;
      const totalCalc = (albaranToSave.items || []).reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
      const trimmedNota = notaTecnico.trim();

      if (selectedTarea.origen === 'reparacion') {
        const payload = {
          albaranId: finalAlbaranId,
          estado: estadoFinalTarea,
          items: albaranToSave.items,
          total: totalCalc,
          nota: trimmedNota,
          observaciones: trimmedNota
        };


        await updateReparacion(docId, payload);
        const stored = JSON.parse(localStorage.getItem('firecheck_db_reparaciones') || '[]');
        const updated = stored.map((r: any) =>
          (r.id === docId || r._docId === docId) ? { ...r, ...payload } : r
        );
        localStorage.setItem('firecheck_db_reparaciones', JSON.stringify(updated));
        setReparaciones(updated);
      } else if (selectedTarea.origen === 'instalacion') {
        const payload = {
          albaranId: finalAlbaranId,
          estado: estadoFinalTarea,
          items: albaranToSave.items,
          total: totalCalc,
          nota: trimmedNota,
          observaciones: trimmedNota
        };


        await updateInstalacion(docId, payload);
        const stored = JSON.parse(localStorage.getItem('firecheck_db_instalaciones') || '[]');
        const updated = stored.map((inst: any) =>
          (inst.id === docId || inst._docId === docId) ? { ...inst, ...payload } : inst
        );
        localStorage.setItem('firecheck_db_instalaciones', JSON.stringify(updated));
        setInstalaciones(updated);
      } else if (selectedTarea.origen === 'urgencia') {
        const payload = {
          albaranId: finalAlbaranId,
          estado: estadoFinalTarea,
          items: albaranToSave.items,
          total: totalCalc,
          nota: trimmedNota,
          observaciones: trimmedNota
        };


        await updateUrgencia(docId, payload);
        const stored = JSON.parse(localStorage.getItem('firecheck_db_urgencias') || '[]');
        const updated = stored.map((u: any) =>
          (u.id === docId || u._docId === docId) ? { ...u, ...payload } : u
        );
        localStorage.setItem('firecheck_db_urgencias', JSON.stringify(updated));
        setUrgencias(updated);
      } else if (selectedTarea.origen === 'prueba-tecnica') {
        const payload = {
          albaranId: finalAlbaranId,
          estado: estadoFinalTarea,
          items: albaranToSave.items,
          observaciones: trimmedNota
        };


        await updateDoc(doc(db, 'pruebas_tecnicas', docId), payload);
        const stored = JSON.parse(localStorage.getItem('firecheck_db_pruebas_tecnicas') || '[]');
        const updated = stored.map((pt: any) =>
          pt.id === docId ? { ...pt, ...payload } : pt
        );
        localStorage.setItem('firecheck_db_pruebas_tecnicas', JSON.stringify(updated));
        setPruebasTecnicas(updated);
      }

      setSendProgress(100);
      setSendCompleted(true);

      setTimeout(() => {
        setIsSending(false);
        setSendCompleted(false);
        setSelectedTarea(null);
        setExistingAlbaranId(null);
      }, 1800);
    } catch (err) {
      console.error('Error guardando parte de trabajo / albarán:', err);
      setIsSending(false);
      alert('Error al guardar el Parte de Trabajo. Inténtalo de nuevo.');
    }
  };



  // Helpers visuales de insignia por tipo de operación
  const getTipoBadgeStyle = (origen: TipoTareaOperacion) => {
    switch (origen) {
      case 'reparacion':
        return {
          bg: 'bg-sky-50 text-sky-700 border-sky-200',
          icon: Wrench,
          dot: 'bg-sky-500'
        };


      case 'instalacion':
        return {
          bg: 'bg-orange-50 text-orange-700 border-orange-200',
          icon: HardHat,
          dot: 'bg-orange-500'
        };


      case 'prueba-tecnica':
        return {
          bg: 'bg-violet-50 text-violet-700 border-violet-200',
          icon: Gauge,
          dot: 'bg-violet-500'
        };


      case 'urgencia':
        return {
          bg: 'bg-zinc-900 text-amber-400 border-zinc-800',
          icon: AlertTriangle,
          dot: 'bg-amber-400'
        };


    }
  };



  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA 2: DETALLE DE LA TAREA (EL ALBARÁN / PARTE DE TRABAJO PARA FIRMAR)
  // ═══════════════════════════════════════════════════════════════════════════
  if (selectedTarea) {
    const selectedEmpresa = empresas.find(e => e._docId === form.empresaId || e.id === form.empresaId);
    const selectedCliente = clientes.find(c => c.id === form.clienteId || (c as any)._docId === form.clienteId);
    const selectedCentro = centros.find(c => c._docId === form.centroId || c.id === form.centroId);
    const filteredCentros = centros.filter(c =>
      c.clienteId === form.clienteId ||
      (selectedCliente && (c.clienteId === selectedCliente.id || c.clienteId === (selectedCliente as any)._docId))
    );
    const tipoStyle = getTipoBadgeStyle(selectedTarea.origen);
    const TipoIcon = tipoStyle.icon;

    return (
      <div className="min-h-screen bg-zinc-50 p-3 sm:p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Barra superior de retorno y acciones */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <button
              type="button"
              onClick={() => {
                setSelectedTarea(null);
                setExistingAlbaranId(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700 hover:text-black hover:border-zinc-300 shadow-xs transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a Partes de Trabajo
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Selector de estado de la tarea */}
              <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Estado:</span>
                <select
                  value={estadoTareaActual}
                  onChange={e => setEstadoTareaActual(e.target.value as any)}
                  className="text-xs font-extrabold text-zinc-900 bg-transparent outline-none cursor-pointer"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En curso">En curso</option>
                  <option value="Parado">Parado</option>
                  <option value="Finalizado">Finalizado</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleDescargarPDFActual}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-extrabold transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                Descargar PDF Albarán
              </button>
            </div>
          </div>

          {/* Banner superior identificativo de la Tarea */}
          <div className="bg-[#0F2342] text-white rounded-3xl p-5 sm:p-6 mb-6 shadow-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${tipoStyle.bg}`}>
                  <TipoIcon className="w-3.5 h-3.5" />
                  {selectedTarea.tipoLabel}
                </span>
                {selectedTarea.numeroPedido && (
                  <span className="text-xs font-mono font-extrabold bg-white/10 text-amber-300 px-2.5 py-1 rounded-lg border border-white/15">
                    Pedido: {selectedTarea.numeroPedido}
                  </span>
                )}
                <span className="text-xs font-mono font-extrabold bg-orange-500/20 text-orange-300 px-2.5 py-1 rounded-lg border border-orange-400/30">
                  Albarán: {form.id}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                {selectedTarea.titulo}
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                {selectedTarea.clienteNombre} · {selectedTarea.centroNombre}
                {selectedTarea.poblacion ? ` (${selectedTarea.poblacion})` : ''}
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-1 text-xs text-slate-300 shrink-0">
              <span className="inline-flex items-center gap-1.5 font-bold text-white bg-white/10 px-3 py-1.5 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-orange-400" />
                Fecha prevista: {formatFechaDisplay(selectedTarea.fecha)}
              </span>
              {selectedTarea.tecnicoAsignado && (
                <span className="text-[11px] text-slate-300">
                  Técnico asignado: <strong className="text-white">{selectedTarea.tecnicoAsignado}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Formulario completo del Parte de Trabajo / Albarán */}
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-zinc-200 overflow-hidden">
            <div className="p-6 sm:p-8 md:p-12">
              <form onSubmit={handleSaveParteTrabajo} className="space-y-8">
                {/* Header con Empresa y Logo */}
                <div className="flex flex-col md:flex-row gap-6 items-start justify-between border-b border-zinc-100 pb-8">
                  <div className="flex-1 space-y-3 w-full">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Empresa Mantenedora *</label>
                    <select
                      required
                      value={form.empresaId}
                      onChange={e => setForm({ ...form, empresaId: e.target.value })}
                      className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-3xl outline-none focus:ring-2 focus:ring-violet-500/20 font-semibold text-sm"
                    >
                      <option value="">Selecciona Empresa...</option>
                      {empresas.map(emp => (
                        <option key={emp._docId || emp.id} value={emp._docId || emp.id}>
                          {emp.nombre}
                        </option>
                      ))}
                    </select>
                    {selectedEmpresa && (
                      <div className="p-4 bg-violet-50/50 rounded-3xl border border-violet-100 text-xs sm:text-sm text-zinc-600">
                        <p className="font-bold text-violet-900">{selectedEmpresa.nombre}</p>
                        <p>{selectedEmpresa.direccion}, {selectedEmpresa.localidad}</p>
                        <p>CIF: {selectedEmpresa.cif}</p>
                      </div>
                    )}
                  </div>
                  <div className="w-full md:w-44 h-28 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden p-4 shrink-0">
                    {selectedEmpresa?.logoUrl ? (
                      <img src={selectedEmpresa.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Building2 className="w-10 h-10 text-zinc-300" />
                    )}
                  </div>
                </div>

                {/* Cliente, Centro y Ubicación */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-5">
                    <div className="space-y-2 relative">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Cliente *</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Cliente..."
                          value={showClienteDropdown ? clienteSearchTerm : (form.clienteNombreLibre || selectedCliente?.nombre || clientes.find(c => c.id === form.clienteId)?.nombre || '')}
                          onFocus={() => {
                            setShowClienteDropdown(true);
                            setClienteSearchTerm(form.clienteNombreLibre || selectedCliente?.nombre || clientes.find(c => c.id === form.clienteId)?.nombre || '');
                          }}
                          onChange={(e) => {
                            setClienteSearchTerm(e.target.value);
                            setShowClienteDropdown(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              if (showClienteDropdown) {
                                const match = clientes.find(c => c.nombre.toLowerCase() === clienteSearchTerm.trim().toLowerCase());
                                if (match) {
                                  setForm({ ...form, clienteId: match.id, centroId: '', clienteNombreLibre: '', centroNombreLibre: '' });
                                } else if (clienteSearchTerm.trim()) {
                                  setForm({ ...form, clienteId: '', centroId: '', clienteNombreLibre: clienteSearchTerm.trim() });
                                }
                                setShowClienteDropdown(false);
                              }
                            }, 150);
                          }}
                          className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-3xl outline-none focus:ring-2 focus:ring-violet-500/20 text-sm font-semibold"
                        />
                        {showClienteDropdown && clienteSearchTerm && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                            {clientes.filter(c => c.nombre.toLowerCase().includes(clienteSearchTerm.toLowerCase())).map(cli => (
                              <div
                                key={cli.id}
                                className="px-4 py-3 hover:bg-zinc-50 cursor-pointer text-sm font-medium border-b border-zinc-50 last:border-0"
                                onMouseDown={() => {
                                  setForm({ ...form, clienteId: cli.id, centroId: '', clienteNombreLibre: '', centroNombreLibre: '' });
                                  setShowClienteDropdown(false);
                                }}
                              >
                                {cli.nombre}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Centro de Trabajo / Lugar</label>
                      {form.clienteId && filteredCentros.length > 0 ? (
                        <select
                          value={form.centroId}
                          onChange={e => setForm({ ...form, centroId: e.target.value })}
                          className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-3xl outline-none text-sm font-semibold"
                        >
                          <option value="">Sin centro específico (Usar datos cliente)</option>
                          {filteredCentros.map(cen => (
                            <option key={cen._docId || cen.id} value={cen._docId || cen.id}>
                              {cen.nombre}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Lugar o centro de trabajo..."
                          value={form.centroNombreLibre || selectedCentro?.nombre || ''}
                          onChange={e => setForm({ ...form, centroNombreLibre: e.target.value })}
                          className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-3xl outline-none focus:ring-2 focus:ring-violet-500/20 text-sm font-semibold"
                        />
                      )}
                    </div>
                  </div>

                  <div className="p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 space-y-2">
                    <div className="flex items-center gap-2 text-violet-600 mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">Datos de Ubicación</span>
                    </div>
                    {form.clienteId ? (
                      <div className="text-sm space-y-1">
                        <p className="font-bold text-zinc-900">{selectedCentro?.nombre || selectedCliente?.nombre || selectedTarea.centroNombre}</p>
                        <p className="text-zinc-600">{selectedCentro?.direccion || selectedCliente?.direccion || selectedTarea.lugar}</p>
                        <p className="text-zinc-600">
                          {selectedCentro?.poblacion || selectedCliente?.poblacion || selectedTarea.poblacion}
                          {(selectedCentro?.provincia || selectedCliente?.provincia) ? ` (${selectedCentro?.provincia || selectedCliente?.provincia})` : ''}
                        </p>
                        {(selectedCentro?.telefono || selectedCliente?.telefono) && (
                          <p className="text-zinc-500 text-xs">Tel: {selectedCentro?.telefono || selectedCliente?.telefono}</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm space-y-1">
                        <p className="font-bold text-zinc-900">{form.centroNombreLibre || form.clienteNombreLibre || selectedTarea.centroNombre}</p>
                        <p className="text-zinc-500">{form.clienteNombreLibre || selectedTarea.clienteNombre}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Número Albarán, Fecha, Pedido y Título */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nº Albarán *</label>
                    <input
                      required
                      type="text"
                      value={form.id}
                      readOnly
                      className="w-full px-4 py-3 bg-black text-white font-mono font-bold rounded-2xl outline-none text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Fecha *</label>
                    <input
                      required
                      type="date"
                      value={getFormattedDate(form.fechaCreacion)}
                      onChange={e => {
                        const selectedDate = e.target.value;
                        if (selectedDate) {
                          const [year, month, day] = selectedDate.split('-').map(Number);
                          const newDate = form.fechaCreacion ? new Date(form.fechaCreacion) : new Date();
                          newDate.setFullYear(year);
                          newDate.setMonth(month - 1);
                          newDate.setDate(day);
                          setForm({ ...form, fechaCreacion: newDate.toISOString() });
                        }
                      }}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none font-bold text-sm text-zinc-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nº Pedido / Parte</label>
                    <input
                      type="text"
                      value={form.numeroPedido || ''}
                      onChange={e => setForm({ ...form, numeroPedido: e.target.value.toUpperCase() })}
                      placeholder="PDR / PDI / PDA"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none font-mono font-bold text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Título del Trabajo</label>
                    <input
                      type="text"
                      value={form.titulo || ''}
                      onChange={e => setForm({ ...form, titulo: e.target.value })}
                      placeholder="Descripción general..."
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none font-bold text-sm"
                    />
                  </div>
                </div>

                {/* Observaciones / Notas de la Tarea */}
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-3xl p-4 sm:p-5 space-y-2">
                  <label className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <StickyNote className="w-4 h-4 text-amber-600" />
                    Notas / Observaciones de la Intervención
                  </label>
                  <textarea
                    value={notaTecnico}
                    onChange={e => setNotaTecnico(e.target.value)}
                    placeholder="Anota observaciones técnicas, incidencias detectadas o comentarios del trabajo realizado..."
                    className="w-full min-h-[76px] p-3.5 bg-white border border-amber-200 rounded-2xl text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/20 resize-y"
                  />
                </div>

                {/* Líneas del Albarán / Parte de Trabajo */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Líneas del Trabajo / Materiales y Mano de Obra
                    </label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="hidden md:flex text-xs font-bold text-violet-600 hover:underline items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Añadir línea
                    </button>
                  </div>

                  {/* Tabla Escritorio */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-900 text-white text-[10px] uppercase font-bold">
                          <th className="px-2 py-3 text-center rounded-l-xl w-14">Orden</th>
                          <th className="px-4 py-3 text-left w-20">Cant.</th>
                          <th className="px-4 py-3 text-left w-48">Concepto</th>
                          <th className="px-4 py-3 text-left">Descripción</th>
                          <th className="px-4 py-3 text-right w-28">P. Unidad</th>
                          <th className="px-3 py-3 text-right w-20">Dto. %</th>
                          <th className="px-4 py-3 text-right w-28">Subtotal</th>
                          <th className="px-2 py-3 rounded-r-xl w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {form.items.map((item, index) => (
                          <tr
                            key={index}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={() => handleDrop(index)}
                            onDragEnd={handleDragEnd}
                            className={`group transition-colors ${
                              draggedLineIndex === index
                                ? 'opacity-40 bg-violet-100'
                                : dragOverLineIndex === index
                                ? 'border-t-2 border-violet-500 bg-violet-50'
                                : 'hover:bg-zinc-50'
                            }`}
                          >
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <div className="cursor-grab active:cursor-grabbing p-1 text-zinc-400 hover:text-zinc-700 rounded">
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col items-center">
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => handleMoverLinea(index, 'up')}
                                    className="p-0.5 text-zinc-400 hover:text-violet-700 disabled:opacity-20 cursor-pointer"
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === form.items.length - 1}
                                    onClick={() => handleMoverLinea(index, 'down')}
                                    className="p-0.5 text-zinc-400 hover:text-violet-700 disabled:opacity-20 cursor-pointer"
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
                                className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.concepto}
                                onChange={e => updateItem(index, 'concepto', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1"
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
                                  ['Nuevo', 'Revisión', 'Reparación', 'Instalación', 'Suministro', 'Visita técnica', '*Desplazamientos'].map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))
                                )}
                              </select>
                            </td>
                            <td className="p-2 relative">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={item.descripcion}
                                  onChange={e => updateItem(index, 'descripcion', e.target.value)}
                                  className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1"
                                  placeholder="Detalle del trabajo o material..."
                                />
                                <button
                                  type="button"
                                  onClick={() => setEditingDescriptionIndex(index)}
                                  className="p-1.5 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors"
                                  title="Ampliar descripción"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={item.precioUnidad}
                                onChange={e => updateItem(index, 'precioUnidad', parseFloat(e.target.value) || 0)}
                                className="w-full text-right bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                value={item.descuento === 0 ? '' : (item.descuento ?? '')}
                                onChange={e => updateItem(index, 'descuento', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-full text-right bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1 font-semibold"
                              />
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-zinc-900">
                              {formatMoneda(item.subtotal)}
                            </td>
                            <td className="p-2">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Tarjetas Móvil / Tablet */}
                  <div className="grid grid-cols-1 gap-3 md:hidden">
                    {form.items.map((item, index) => (
                      <div
                        key={index}
                        className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs flex flex-col gap-2"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-2.5 pr-2">
                            <div className="flex flex-col items-center bg-zinc-50 px-1 py-0.5 rounded-lg border border-zinc-200/60 shrink-0">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoverLinea(index, 'up')}
                                className="p-0.5 text-zinc-400 hover:text-violet-700 disabled:opacity-20"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === form.items.length - 1}
                                onClick={() => handleMoverLinea(index, 'down')}
                                className="p-0.5 text-zinc-400 hover:text-violet-700 disabled:opacity-20"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-white bg-violet-600 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                {item.concepto || 'Sin concepto'}
                              </span>
                              <p className="text-sm font-bold text-zinc-900 mt-1.5 leading-snug">
                                {item.descripcion || <span className="text-zinc-400 font-normal italic">Sin descripción</span>}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-zinc-900">{formatMoneda(item.subtotal)}</p>
                            <p className="text-[11px] font-medium text-zinc-500 mt-0.5">
                              {item.cantidad} x {formatMoneda(item.precioUnidad)}
                              {Number(item.descuento) > 0 ? ` (Dto. ${item.descuento}%)` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-zinc-100">
                          <button
                            type="button"
                            onClick={() => setEditingLineIndex(index)}
                            className="px-3 py-1.5 text-zinc-600 hover:text-violet-700 bg-zinc-100 hover:bg-violet-100 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                          >
                            <Edit className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="px-3 py-1.5 text-zinc-600 hover:text-red-600 bg-zinc-100 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                          >
                            <Trash className="w-3.5 h-3.5" /> Borrar
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const nextIndex = form.items.length;
                        addItem();
                        setTimeout(() => setEditingLineIndex(nextIndex), 0);
                      }}
                      className="w-full py-3.5 border-2 border-dashed border-zinc-300 text-zinc-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-50 hover:text-violet-600 hover:border-violet-300 transition-colors mt-2"
                    >
                      <Plus className="w-4 h-4" /> Añadir Nueva Línea
                    </button>
                  </div>
                </div>

                {/* Firmas del Cliente y del Técnico */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-zinc-100">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Firma del Cliente (Conformidad)</label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={form.nombreFirmante}
                        onChange={e => setForm({ ...form, nombreFirmante: e.target.value })}
                        placeholder="Nombre y DNI del receptor / cliente"
                        className="w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                      />
                      <canvas
                        ref={canvasClienteRef}
                        width={600}
                        height={200}
                        className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-3xl touch-none shadow-inner"
                      />
                      <div className="flex justify-between items-center px-1">
                        <button
                          type="button"
                          onClick={() => {
                            canvasClienteRef.current?.getContext('2d')?.clearRect(0, 0, 2000, 2000);
                            setForm(prev => ({ ...prev, firmaCliente: '' }));
                          }}
                          className="text-xs text-zinc-400 hover:text-red-500 underline p-1 cursor-pointer"
                        >
                          Limpiar firma
                        </button>
                        <button
                          type="button"
                          onClick={() => setSigningRole('cliente')}
                          className="text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" /> Pantalla completa
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Firma del Técnico</label>
                    <div className="space-y-2">
                      <select
                        value={form.tecnicoId}
                        onChange={e => setForm({ ...form, tecnicoId: e.target.value })}
                        className="w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                      >
                        <option value="">Selecciona Técnico...</option>
                        {tecnicos.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.nombre} {t.apellidos}
                          </option>
                        ))}
                      </select>
                      <canvas
                        ref={canvasTecnicoRef}
                        width={600}
                        height={200}
                        className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-3xl touch-none shadow-inner"
                      />
                      <div className="flex justify-between items-center px-1">
                        <button
                          type="button"
                          onClick={() => {
                            canvasTecnicoRef.current?.getContext('2d')?.clearRect(0, 0, 2000, 2000);
                            setForm(prev => ({ ...prev, firmaTecnico: '' }));
                          }}
                          className="text-xs text-zinc-400 hover:text-red-500 underline p-1 cursor-pointer"
                        >
                          Limpiar firma
                        </button>
                        <button
                          type="button"
                          onClick={() => setSigningRole('tecnico')}
                          className="text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" /> Pantalla completa
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botón Guardar y Firmar */}
                <div className="flex justify-end pt-6">
                  <button
                    type="submit"
                    className="flex items-center gap-2.5 bg-black hover:bg-zinc-800 text-white px-8 py-4 rounded-3xl font-extrabold text-sm transition-all shadow-lg active:scale-95 cursor-pointer"
                  >
                    <Save className="w-5 h-5" />
                    Guardar y Firmar Parte de Trabajo
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Modal de Descripción Ampliada */}
        {editingDescriptionIndex !== null && form.items[editingDescriptionIndex] && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <h3 className="font-bold text-zinc-800">Descripción del trabajo</h3>
                <button onClick={() => setEditingDescriptionIndex(null)} className="p-1.5 hover:bg-zinc-200 rounded-xl">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <div className="p-5">
                <textarea
                  autoFocus
                  className="w-full h-48 p-4 bg-zinc-50 border border-zinc-200 rounded-xl resize-none outline-none focus:ring-2 focus:ring-violet-500/20 text-sm"
                  value={form.items[editingDescriptionIndex].descripcion}
                  onChange={e => updateItem(editingDescriptionIndex, 'descripcion', e.target.value)}
                  placeholder="Escribe la descripción detallada del trabajo realizado..."
                />
              </div>
              <div className="px-5 py-4 border-t border-zinc-100 flex justify-end bg-zinc-50">
                <button
                  type="button"
                  onClick={() => setEditingDescriptionIndex(null)}
                  className="px-6 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-zinc-800"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Firma en Pantalla Completa */}
        {signingRole !== null && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-6">
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <h3 className="font-bold text-zinc-800 text-lg">
                  {signingRole === 'cliente' ? 'Firma del Cliente' : 'Firma del Técnico'}
                </h3>
                <button type="button" onClick={() => setSigningRole(null)} className="p-2 hover:bg-zinc-200 rounded-xl">
                  <X className="w-6 h-6 text-zinc-500" />
                </button>
              </div>
              <div className="p-4 sm:p-8 bg-zinc-100/50 flex-1 flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-full bg-white p-2 rounded-3xl shadow-sm border border-zinc-200">
                  <canvas
                    ref={modalCanvasRef}
                    width={800}
                    height={400}
                    className="w-full h-[40vh] sm:h-80 bg-white rounded-xl touch-none"
                  />
                </div>
              </div>
              <div className="px-6 py-5 border-t border-zinc-100 flex justify-between items-center bg-white">
                <button
                  type="button"
                  onClick={() => modalCanvasRef.current?.getContext('2d')?.clearRect(0, 0, 2000, 2000)}
                  className="px-6 py-3 text-sm font-bold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-xl"
                >
                  Limpiar
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSigningRole(null)}
                    className="px-6 py-3 text-sm font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const dataUrl = modalCanvasRef.current?.toDataURL('image/png');
                      const targetCanvas = signingRole === 'cliente' ? canvasClienteRef.current : canvasTecnicoRef.current;
                      if (dataUrl && targetCanvas) {
                        const img = new Image();
                        img.onload = () => {
                          const ctx = targetCanvas.getContext('2d');
                          ctx?.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                          ctx?.drawImage(img, 0, 0, targetCanvas.width, targetCanvas.height);
                        };


                        img.src = dataUrl;
                      }
                      setSigningRole(null);
                    }}
                    className="px-8 py-3 text-sm font-bold text-white bg-black hover:bg-zinc-800 rounded-xl shadow-md"
                  >
                    Guardar Firma
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edición de Línea en Móvil */}
        {editingLineIndex !== null && form.items[editingLineIndex] && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <h3 className="font-bold text-zinc-800">Detalles de la línea</h3>
                <button onClick={() => setEditingLineIndex(null)} className="p-1.5 hover:bg-zinc-200 rounded-xl">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={form.items[editingLineIndex].cantidad}
                      onChange={e => updateItem(editingLineIndex, 'cantidad', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Concepto</label>
                    <select
                      value={form.items[editingLineIndex].concepto}
                      onChange={e => updateItem(editingLineIndex, 'concepto', e.target.value)}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      {['Nuevo', 'Revisión', 'Reparación', 'Instalación', 'Suministro', 'Visita técnica', '*Desplazamientos'].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Descripción</label>
                  <textarea
                    className="w-full h-28 p-3 bg-zinc-50 border border-zinc-200 rounded-xl resize-none outline-none text-sm"
                    value={form.items[editingLineIndex].descripcion}
                    onChange={e => updateItem(editingLineIndex, 'descripcion', e.target.value)}
                    placeholder="Detalle del trabajo o materiales..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">P. Unidad</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={precioUnidadInput}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9.,-]/g, '');
                        setPrecioUnidadInput(val);
                        const parsedVal = parseFloat(val.replace(',', '.'));
                        updateItem(editingLineIndex, 'precioUnidad', !isNaN(parsedVal) ? parsedVal : 0);
                      }}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none text-right font-bold text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Dto. %</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={form.items[editingLineIndex].descuento ?? 0}
                      onChange={e => updateItem(editingLineIndex, 'descuento', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none text-right font-bold text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Subtotal</label>
                    <div className="w-full px-3 py-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-right font-bold text-zinc-700 text-xs truncate">
                      {formatMoneda(form.items[editingLineIndex].subtotal)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-zinc-100 flex justify-end bg-white">
                <button
                  type="button"
                  onClick={() => setEditingLineIndex(null)}
                  className="px-6 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-zinc-800"
                >
                  Guardar Línea
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Progreso de Guardado */}
        {isSending && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[300]">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
              {!sendCompleted ? (
                <>
                  <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                    <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Guardando Parte de Trabajo...</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-5">Registrando albarán y firmas en Firebase</p>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-2 p-0.5 border border-slate-200">
                    <div
                      className="bg-gradient-to-r from-red-500 to-red-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${sendProgress}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-red-600 font-mono">{sendProgress}%</span>
                </>
              ) : (
                <div className="py-2">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-md">
                    <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Parte de Trabajo Registrado</h3>
                  <p className="text-xs text-slate-500 mt-2">
                    El albarán y el estado de la tarea se han sincronizado correctamente.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL DE VISTA PREVIA DEL PDF ("VER") CON UN SOLO BOTÓN DE IMPRIMIR O IR ATRÁS
  // ═══════════════════════════════════════════════════════════════════════════
  const renderVerParteModal = () => {
    if (!verParteTarea) return null;
    const cliObj = clientes.find(c => c.id === verParteTarea.clienteId || (c as any)._docId === verParteTarea.clienteId);
    const cenObj = centros.find(c => c._docId === verParteTarea.centroId || c.id === verParteTarea.centroId);
    const abanfocObj = empresas.find(e => (e.nombre || '').toLowerCase().includes('abanfoc')) || empresas[0];
    const codigoParte = verParteTarea.numeroPedido || verParteTarea.id || 'PARTE';

    const lineas = (verParteTarea.items && verParteTarea.items.length > 0)
      ? verParteTarea.items
      : [{ cantidad: 1, concepto: verParteTarea.tipoLabel, descripcion: verParteTarea.titulo, precioUnidad: 0, subtotal: 0 }];

    return (
      <div
        className="fixed inset-0 z-[250] bg-zinc-900/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-150"
      >
        {/* Barra superior única: Botón Ir hacia atrás + un solo botón Imprimir */}
        <div className="bg-zinc-950 text-white px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-zinc-800 shrink-0 shadow-md">
          <button
            type="button"
            onClick={() => setVerParteTarea(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm font-extrabold transition-all cursor-pointer border border-zinc-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ir atrás</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-zinc-400">
            <FileText className="w-4 h-4 text-red-500" />
            <span>Vista previa PDF · {codigoParte}</span>
          </div>

          <button
            type="button"
            onClick={() => handleDescargarPartePDF(verParteTarea, true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-extrabold transition-all shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
        </div>

        {/* Lienzo visor PDF con hoja A4 */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 pb-16 sm:p-8 sm:pb-20 bg-zinc-800" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="mx-auto bg-white w-full max-w-[794px] min-h-[1050px] h-auto shadow-2xl rounded-xs p-6 sm:p-12 flex flex-col justify-between gap-6 text-zinc-900 relative">

            {/* Parte superior del PDF A4 */}
            <div className="space-y-6">
              {/* Cabecera oficial estilo PDF ABANFOC (Logo | Línea Roja | Datos Empresa | Línea Roja | Contacto) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4 pb-5 border-b border-zinc-200">
                <div className="sm:col-span-4 flex items-center justify-center sm:justify-start">
                  <img
                    src={abanfocObj?.logoUrl || '/logo.png'}
                    alt="ABANFOC S.L."
                    className="h-14 sm:h-16 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }}
                  />
                </div>

                <div className="sm:col-span-4 sm:border-l-2 sm:border-red-600 sm:pl-4 text-[11px] leading-relaxed text-zinc-700">
                  <p className="font-black text-zinc-900 text-xs">ABANFOC S.L. &nbsp; B16794679</p>
                  <p>C/ America 16 B Ático (08921)</p>
                  <p>Sta. Coloma Gramanet, Barcelona</p>
                  <p>RASIC: 10600168</p>
                </div>

                <div className="sm:col-span-4 sm:border-l-2 sm:border-red-600 sm:pl-4 text-[11px] leading-relaxed text-zinc-700">
                  <p><span className="font-bold text-zinc-900">Tel:</span> 93 627 94 14</p>
                  <p><span className="font-bold text-zinc-900">Email:</span> abanfoc@abanfoc.es</p>
                  <p><span className="font-bold text-zinc-900">Web:</span> www.abanfoc.es</p>
                </div>
              </div>

              {/* Bloque Título del Documento y Datos del Cliente / Centro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-600">
                    PARTE DE TRABAJO ({verParteTarea.tipoLabel.toUpperCase()})
                  </p>
                  <div className="text-xs space-y-1 text-zinc-700 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
                    <p><span className="font-bold text-zinc-900">Nº Documento:</span> <span className="font-mono font-bold">{codigoParte}</span></p>
                    <p><span className="font-bold text-zinc-900">Fecha prevista:</span> {formatFechaDisplay(verParteTarea.fecha)}</p>
                    <p><span className="font-bold text-zinc-900">Técnico asignado:</span> {verParteTarea.tecnicoAsignado || 'Sin asignar'}</p>
                    <p><span className="font-bold text-zinc-900">Estado:</span> {verParteTarea.estado}</p>
                  </div>
                </div>

                <div className="text-xs space-y-1 text-zinc-700 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Datos del Cliente y Centro</p>
                  <p className="font-black text-zinc-900 text-sm">{verParteTarea.clienteNombre}</p>
                  {cliObj?.cif && <p>CIF: {cliObj.cif}</p>}
                  {verParteTarea.centroNombre && verParteTarea.centroNombre !== '—' && (
                    <p><span className="font-bold text-zinc-900">Centro:</span> {verParteTarea.centroNombre}</p>
                  )}
                  {(cenObj?.direccion || verParteTarea.lugar || cliObj?.direccion) && (
                    <p>{cenObj?.direccion || verParteTarea.lugar || cliObj?.direccion}</p>
                  )}
                  {(verParteTarea.poblacion || cenObj?.poblacion || cliObj?.poblacion) && (
                    <p>{verParteTarea.poblacion || cenObj?.poblacion || cliObj?.poblacion}</p>
                  )}
                </div>
              </div>

              {/* Asunto / Título de la Intervención */}
              <div className="border-b-2 border-zinc-800 pb-2 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Asunto / Trabajo</p>
                <p className="text-sm font-black text-zinc-900">{verParteTarea.titulo}</p>
              </div>

              {/* Tabla estilo PDF oficial (Código | Artículo / Descripción | Und.) */}
              <div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-zinc-500 text-[11px] font-extrabold text-zinc-900 uppercase">
                      <th className="py-2 px-2 w-24">Concepto</th>
                      <th className="py-2 px-2">Artículo / Descripción del Trabajo</th>
                      <th className="py-2 px-2 w-16 text-center">Und.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-xs">
                    {lineas.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-2 font-bold text-zinc-600 align-top">
                          {it.concepto || verParteTarea.tipoLabel}
                        </td>
                        <td className="py-3 px-2 text-zinc-800 whitespace-pre-wrap align-top">
                          <span className="font-bold text-zinc-900 uppercase block text-[11px]">
                            {it.concepto || verParteTarea.tipoLabel}
                          </span>
                          <span>{it.descripcion || verParteTarea.titulo}</span>
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-zinc-900 align-top">
                          {it.cantidad || 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pie del PDF A4: Recuadro de Aceptación + Notas y Condiciones + RGPD */}
            <div className="pt-10 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-5 border border-zinc-300 rounded-xl p-3.5 h-32 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase text-zinc-700 border-b border-zinc-200 pb-1">
                      CONFORME Y ACEPTACIÓN DEL CLIENTE
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-2">Fecha: ..... / ..... / ............</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Firma y Sello:</p>
                  </div>
                </div>

                <div className="sm:col-span-7 border border-zinc-300 rounded-xl p-3.5 min-h-32">
                  <p className="text-[10px] font-extrabold uppercase text-zinc-700 border-b border-zinc-200 pb-1">
                    NOTAS Y OBSERVACIONES
                  </p>
                  <p className="text-[11px] text-zinc-700 mt-2 whitespace-pre-wrap">
                    {verParteTarea.nota || 'Sin observaciones adicionales.'}
                  </p>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-2 flex items-center justify-between text-[9px] text-zinc-400 leading-tight">
                <p className="max-w-xl">
                  De acuerdo a lo establecido en la normativa de protección de datos, ABANFOC SL con CIF B16794679, le informa que tratará sus datos con la finalidad de llevar a cabo la gestión administrativa, facturación, contabilidad y obligaciones legales.
                </p>
                <span className="font-bold text-zinc-500 shrink-0 ml-4">Pág. 1 / 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };



  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL PARA EDITAR EL PARTE DE TRABAJO ("EDITAR PARTE")
  // ═══════════════════════════════════════════════════════════════════════════
  const renderEditarParteModal = () => {
    if (!editarParteTarea) return null;
    return (
      <div
        className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
        onClick={() => setEditarParteTarea(null)}
      >
        <div
          className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-[#0F2342] text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
                <Edit className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">Editar Parte de Trabajo</h2>
                <p className="text-xs text-slate-300">{editarParteTarea.tipoLabel} · {editarParteTarea.clienteNombre}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditarParteTarea(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleGuardarEditarParte} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Nº Pedido / Parte</label>
                <input
                  type="text"
                  value={editParteForm.numeroPedido}
                  onChange={e => setEditParteForm({ ...editParteForm, numeroPedido: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Fecha Prevista</label>
                <input
                  type="date"
                  value={editParteForm.fecha}
                  onChange={e => setEditParteForm({ ...editParteForm, fecha: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Estado</label>
                <select
                  value={editParteForm.estado}
                  onChange={e => setEditParteForm({ ...editParteForm, estado: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold outline-none focus:border-red-500"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En curso">En curso</option>
                  <option value="Parado">Parado</option>
                  <option value="Finalizado">Finalizado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Título / Trabajo a realizar *</label>
              <input
                required
                type="text"
                value={editParteForm.titulo}
                onChange={e => setEditParteForm({ ...editParteForm, titulo: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Centro / Lugar</label>
                <input
                  type="text"
                  value={editParteForm.lugar}
                  onChange={e => setEditParteForm({ ...editParteForm, lugar: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Técnico Asignado</label>
                <select
                  value={editParteForm.tecnicoAsignado}
                  onChange={e => setEditParteForm({ ...editParteForm, tecnicoAsignado: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold outline-none focus:border-red-500"
                >
                  <option value="">Sin asignar</option>
                  {tecnicos.map(t => {
                    const full = `${t.nombre || ''} ${t.apellidos || ''}`.trim();
                    return <option key={t.id} value={full}>{full}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Líneas del parte */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-500 uppercase">Líneas del Parte</label>
                <button
                  type="button"
                  onClick={() => setEditParteForm(prev => ({
                    ...prev,
                    items: [...prev.items, { cantidad: 1, concepto: editarParteTarea.tipoLabel, descripcion: '', precioUnidad: 0, subtotal: 0 }]
                  }))}
                  className="text-xs font-extrabold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir línea
                </button>
              </div>
              <div className="space-y-2">
                {editParteForm.items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-zinc-50 p-2 rounded-xl border border-zinc-200">
                    <input
                      type="number"
                      min="1"
                      value={it.cantidad}
                      onChange={e => {
                        const cant = parseInt(e.target.value) || 1;
                        const next = [...editParteForm.items];
                        const pUn = next[idx].precioUnidad || 0;
                        const dto = next[idx].descuento || 0;
                        next[idx] = { ...next[idx], cantidad: cant, subtotal: cant * pUn * (1 - dto / 100) };
                        setEditParteForm({ ...editParteForm, items: next });
                      }}
                      className="w-16 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-center outline-none"
                      title="Cantidad"
                    />
                    <input
                      type="text"
                      value={it.concepto}
                      onChange={e => {
                        const next = [...editParteForm.items];
                        next[idx] = { ...next[idx], concepto: e.target.value };
                        setEditParteForm({ ...editParteForm, items: next });
                      }}
                      placeholder="Concepto"
                      className="w-32 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-semibold outline-none"
                    />
                    <input
                      type="text"
                      value={it.descripcion}
                      onChange={e => {
                        const next = [...editParteForm.items];
                        next[idx] = { ...next[idx], descripcion: e.target.value };
                        setEditParteForm({ ...editParteForm, items: next });
                      }}
                      placeholder="Descripción del trabajo o material..."
                      className="flex-1 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none"
                    />
                    {editParteForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEditParteForm(prev => ({
                          ...prev,
                          items: prev.items.filter((_, i) => i !== idx)
                        }))}
                        className="p-1.5 text-zinc-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Notas / Observaciones</label>
              <textarea
                value={editParteForm.nota}
                onChange={e => setEditParteForm({ ...editParteForm, nota: e.target.value })}
                rows={3}
                placeholder="Observaciones o notas del parte..."
                className="w-full p-3 bg-amber-50/40 border border-amber-200 rounded-xl text-sm outline-none focus:border-amber-500 resize-y"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => setEditarParteTarea(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-extrabold cursor-pointer shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Modal de opciones al pulsar sobre cualquier parte de una fila o tarjeta
  const renderTareaOpcionesModal = () => {
    if (!tareaOpcionesModal) return null;

    const style = getTipoBadgeStyle(tareaOpcionesModal.origen);
    const IconTipo = style.icon;
    const albExistente = albaranes.find(a =>
      (tareaOpcionesModal.albaranId && a.id === tareaOpcionesModal.albaranId) ||
      (tareaOpcionesModal.numeroPedido && a.numeroPedido === tareaOpcionesModal.numeroPedido)
    );
    const firmado = albExistente && (isFirmaValida(albExistente.firmaCliente) || isFirmaValida(albExistente.firmaTecnico));

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
          {/* Cabecera */}
          <div className="bg-zinc-900 text-white p-5 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${style.bg}`}>
                  <IconTipo className="w-3.5 h-3.5" />
                  {tareaOpcionesModal.tipoLabel}
                </span>
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  tareaOpcionesModal.numeroPedido ? 'text-indigo-200 bg-indigo-950/80 border border-indigo-700/60' : 'text-zinc-400 bg-zinc-800'
                }`}>
                  Nº {tareaOpcionesModal.numeroPedido || 'Sin pedido'}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  tareaOpcionesModal.estado === 'Finalizado'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                    : tareaOpcionesModal.estado === 'En curso'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                    : tareaOpcionesModal.estado === 'Parado'
                    ? 'bg-red-950/80 text-red-300 border-red-700/60'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}>
                  {tareaOpcionesModal.estado}
                </span>
              </div>
              <h2 className="text-base font-black text-white truncate leading-snug">
                {tareaOpcionesModal.titulo}
              </h2>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {tareaOpcionesModal.clienteNombre} {tareaOpcionesModal.centroNombre !== '—' ? `· ${tareaOpcionesModal.centroNombre}` : ''}
              </p>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-zinc-300">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-400" />
                  {formatFechaDisplay(tareaOpcionesModal.fecha)}
                </span>
                {tareaOpcionesModal.tecnicoAsignado && (
                  <span className="truncate">· 👤 {tareaOpcionesModal.tecnicoAsignado}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTareaOpcionesModal(null)}
              className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Opciones */}
          <div className="p-4 sm:p-5 flex flex-col gap-3">
            {/* 1. Ver parte */}
            <button
              type="button"
              onClick={() => {
                const t = tareaOpcionesModal;
                setTareaOpcionesModal(null);
                setVerParteTarea(t);
              }}
              className="group text-left p-3.5 rounded-2xl border-2 border-slate-200 hover:border-zinc-800 bg-white hover:bg-zinc-50 flex items-center gap-3.5 transition-all cursor-pointer shadow-xs hover:shadow-md"
            >
              <div className="w-11 h-11 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Eye className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-zinc-900 group-hover:text-black">Ver parte</p>
                <p className="text-xs text-zinc-500 mt-0.5">Previsualizar o descargar el documento PDF del parte</p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 2. Editar parte */}
            <button
              type="button"
              onClick={() => {
                const t = tareaOpcionesModal;
                setTareaOpcionesModal(null);
                handleOpenEditarParte(t);
              }}
              className="group text-left p-3.5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/50 flex items-center gap-3.5 transition-all cursor-pointer shadow-xs hover:shadow-md"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Edit className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-zinc-900 group-hover:text-blue-900">Editar parte</p>
                <p className="text-xs text-zinc-500 mt-0.5">Modificar datos, operarios, firmas y notas</p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 3. Crear / Ver albarán */}
            <button
              type="button"
              onClick={() => {
                const t = tareaOpcionesModal;
                setTareaOpcionesModal(null);
                handleAbrirTarea(t);
              }}
              className="group text-left p-3.5 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/50 flex items-center gap-3.5 transition-all cursor-pointer shadow-xs hover:shadow-md"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ReceiptText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-zinc-900 group-hover:text-emerald-900">
                    {albExistente ? 'Ver albarán' : 'Crear albarán'}
                  </p>
                  {firmado && (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Firmado
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {albExistente ? 'Consultar el albarán vinculado a este trabajo' : 'Generar el albarán para facturación o firma'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Pie */}
          <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex justify-end">
            <button
              type="button"
              onClick={() => setTareaOpcionesModal(null)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-300 transition-colors cursor-pointer text-center"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA 1: LISTADO / TABLA DE PARTES DE TRABAJO (OPERACIONES)
  // ═══════════════════════════════════════════════════════════════════════════

  // Versión Tablet / Móvil (Panel Técnico con fondo azul corporativo #1d3557)
  if (isTecnicoMode) {
    return (
      <div className="min-h-screen bg-[#1d3557] pb-14">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-zinc-200 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 -ml-1 text-zinc-500 hover:text-black transition-colors rounded-xl hover:bg-zinc-100 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-black text-zinc-900">Partes de Trabajo</h1>
              <p className="text-[11px] text-zinc-500 font-medium">
                Reparaciones, instalaciones, pruebas técnicas y avisos · {tareasFiltradas.length} tarea{tareasFiltradas.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Filtros rápidos de Tipo de Operación */}
          <div className="px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {[
              { id: 'TODOS', label: 'Todos', count: countsPorTipo.TODOS },
              { id: 'reparacion', label: 'Reparaciones', count: countsPorTipo.reparacion },
              { id: 'instalacion', label: 'Instalaciones', count: countsPorTipo.instalacion },
              { id: 'prueba-tecnica', label: 'Pruebas Téc.', count: countsPorTipo['prueba-tecnica'] },
              { id: 'urgencia', label: 'Avisos', count: countsPorTipo.urgencia },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTipoFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  tipoFilter === tab.id
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  tipoFilter === tab.id ? 'bg-white/20 text-white' : 'bg-white text-zinc-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Fecha · Estado · Búsqueda — una sola línea */}
          <div className="px-4 pb-3 flex items-center gap-2">
            {/* Rango de fechas */}
            <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-zinc-300 shadow-xs shrink-0">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-[11px] outline-none text-zinc-700 bg-transparent w-[88px]"
              />
              <span className="text-zinc-400 text-[11px]">–</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-[11px] outline-none text-zinc-700 bg-transparent w-[88px]"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="p-0.5 text-zinc-400 hover:text-red-500 rounded-md"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Estado */}
            <div className="relative shrink-0">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
              <select
                value={estadoFilter}
                onChange={e => setEstadoFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-zinc-300 rounded-xl text-[11px] outline-none text-zinc-900 font-semibold cursor-pointer"
              >
                <option value="TODOS">Todos ( {countsPorEstado.TODOS} )</option>
                <option value="Pendiente">Pendientes ( {countsPorEstado.Pendiente} )</option>
                <option value="En curso">En curso ( {countsPorEstado['En curso']} )</option>
                <option value="Parado">Parados ( {countsPorEstado.Parado} )</option>
                <option value="Finalizado">Finalizados ( {countsPorEstado.Finalizado} )</option>
              </select>
            </div>

            {/* Búsqueda */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar…"
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-zinc-300 rounded-xl text-[11px] outline-none text-zinc-950"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

        </header>

        {/* Tarjetas de Tareas en Tablet / Móvil */}
        <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-4">
          {tareasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/70">
              <Wrench className="w-14 h-14 mb-3 opacity-40 text-white" />
              <p className="font-bold text-sm text-center text-white">
                No hay partes de trabajo en este filtro
              </p>
              <p className="text-xs text-center mt-1 text-white/60">
                Prueba cambiando el filtro de estado o buscando otro término
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tareasFiltradas.map(tarea => {
                const style = getTipoBadgeStyle(tarea.origen);
                const IconTipo = style.icon;
                const albVinc = albaranes.find(a =>
                  (tarea.albaranId && a.id === tarea.albaranId) ||
                  (tarea.numeroPedido && a.numeroPedido === tarea.numeroPedido)
                );
                const firmado = albVinc && (isFirmaValida(albVinc.firmaCliente) || isFirmaValida(albVinc.firmaTecnico));

                return (
                  <div
                    key={tarea.uid}
                    onClick={() => setTareaOpcionesModal(tarea)}
                    className="w-full bg-white rounded-2xl border border-zinc-200 p-4 text-left shadow-sm flex flex-col gap-2.5 cursor-pointer hover:border-zinc-400 hover:shadow-md transition-all active:scale-[0.99]"
                  >
                    {/* FILA 1 — Fecha · Tipo · Estado · Técnico en una sola línea */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full shrink-0">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {formatFechaDisplay(tarea.fecha)}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${style.bg}`}>
                        <IconTipo className="w-3 h-3" />
                        {tarea.tipoLabel}
                      </span>
                      <span className={`text-[10px] font-mono font-extrabold px-2.5 py-1 rounded-full shrink-0 border ${tarea.numeroPedido ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-zinc-400 bg-zinc-50 border-zinc-200'}`}>
                        Nº {tarea.numeroPedido || 'Sin pedido'}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border ${
                        tarea.estado === 'Finalizado'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : tarea.estado === 'En curso'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : tarea.estado === 'Parado'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                      }`}>
                        {tarea.estado}
                      </span>
                      {tarea.tecnicoAsignado && (
                        <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-1 rounded-full truncate max-w-[140px]">
                          👤 {tarea.tecnicoAsignado}
                        </span>
                      )}
                      {firmado && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          <Signature className="w-3 h-3" /> Firmado
                        </span>
                      )}
                    </div>

                    {/* FILA 3 — Información principal */}
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-zinc-400 truncate">{tarea.clienteNombre}</p>
                      <h3 className="text-sm font-black text-zinc-900 truncate leading-snug">
                        {tarea.centroNombre !== '—' ? tarea.centroNombre : tarea.clienteNombre}
                      </h3>
                      <p className="text-xs font-bold text-slate-600 mt-0.5 line-clamp-2">{tarea.titulo}</p>
                    </div>

                    {/* Nota (si existe) */}
                    {tarea.nota && (
                      <div className="bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
                        <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{tarea.nota}</span>
                      </div>
                    )}

                    {/* Población */}
                    {tarea.poblacion && (
                      <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-medium">
                        <MapPin className="w-3 h-3 text-zinc-300 shrink-0" />
                        {tarea.poblacion}
                      </div>
                    )}
                  </div>

                );
              })}
            </div>
          )}
        </div>
        {renderVerParteModal()}
        {renderEditarParteModal()}
        {renderTareaOpcionesModal()}
      </div>
    );
  }

  // Versión Escritorio (/partes-trabajo en menú Operaciones, idéntica en estructura y estética a Partes de Revisión)
  const opcionesEstado = [
    { value: 'TODOS', label: 'Todos los estados', count: countsPorEstado.TODOS, colorClass: '' },
    { value: 'Pendiente', label: 'Pendientes', count: countsPorEstado.Pendiente, colorClass: 'bg-zinc-400 shadow-[0_0_8px_rgba(161,161,170,0.8)]' },
    { value: 'En curso', label: 'En curso', count: countsPorEstado['En curso'], colorClass: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]' },
    { value: 'Parado', label: 'Parado', count: countsPorEstado.Parado, colorClass: 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]' },
    { value: 'Finalizado', label: 'Finalizado (Firmado)', count: countsPorEstado.Finalizado, colorClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' },
  ];
  const selectedOption = opcionesEstado.find(o => o.value === estadoFilter) || opcionesEstado[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-6">
      {/* Cabecera idéntica a Partes de Revisión */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full text-center sm:text-left">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight flex items-center justify-center sm:justify-start gap-2">
              Partes de Trabajo
            </h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1">
              Gestión y seguimiento de los partes y tareas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Filtro de fechas */}
            <div className="flex items-center gap-2 bg-white px-3 rounded-xl border border-zinc-200/80 shadow-sm shrink-0 h-[52px]">
              <CalendarDays className="w-4 h-4 text-zinc-400" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-sm outline-none text-zinc-600 bg-transparent border-0"
                title="Fecha inicial"
              />
              <span className="text-zinc-400 text-sm">a</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-sm outline-none text-zinc-600 bg-transparent border-0"
                title="Fecha final"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="ml-1 p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  title="Limpiar fechas"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Buscador */}
            <div className="relative w-full sm:w-64 shrink-0 h-[52px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 z-10" />
              <input
                type="text"
                placeholder="Buscar partes de trabajo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-full pl-10 pr-4 bg-white border border-zinc-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all text-zinc-950 shadow-sm"
              />
            </div>

            {/* Filtro por Estado con Indicador de Color y Contador */}
            <div className="relative shrink-0 h-[52px]" ref={filterRef}>
              <button
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="h-full px-4 bg-white border border-zinc-200/80 rounded-xl text-sm flex items-center justify-between gap-3 text-zinc-900 shadow-sm font-medium hover:border-zinc-300 transition-all min-w-[235px] cursor-pointer"
                title="Filtrar partes de trabajo por estado"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
                  {selectedOption.colorClass && (
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selectedOption.colorClass}`} />
                  )}
                  <span className="truncate font-semibold text-zinc-900">{selectedOption.label}</span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-black bg-zinc-100 text-zinc-800 border border-zinc-200/90 shrink-0 shadow-2xs">
                    ( {selectedOption.count} )
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden min-w-[235px]">
                  {opcionesEstado.map((op) => (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => {
                        setEstadoFilter(op.value);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                        estadoFilter === op.value
                          ? 'bg-red-50 text-red-700 font-bold'
                          : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      {op.colorClass ? (
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${op.colorClass}`} />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full border border-zinc-300 shrink-0" />
                      )}
                      <span className="flex-1">{op.label}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-extrabold shrink-0 ${
                        estadoFilter === op.value
                          ? 'bg-red-100 text-red-800'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}>
                        ( {op.count} )
                      </span>
                      {estadoFilter === op.value && <Check className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas de Operaciones en tarjeta alargada estilo Listman */}
      <div className="bg-white p-2.5 rounded-2xl border border-zinc-200/80 shadow-sm mb-6 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {[
            {
              id: 'TODOS',
              label: 'Todas las Operaciones',
              count: countsPorTipo.TODOS,
              icon: FileText,
              activeCls: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25',
              inactiveCls: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/80',
              iconActiveCls: 'text-emerald-100',
              iconInactiveCls: 'text-emerald-600',
              badgeActiveCls: 'bg-emerald-950/40 text-white',
              badgeInactiveCls: 'bg-emerald-200/90 text-emerald-900 font-black'
            },
            {
              id: 'reparacion',
              label: 'Reparaciones',
              count: countsPorTipo.reparacion,
              icon: Wrench,
              activeCls: 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25',
              inactiveCls: 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100/80',
              iconActiveCls: 'text-blue-100',
              iconInactiveCls: 'text-blue-600',
              badgeActiveCls: 'bg-blue-950/40 text-white',
              badgeInactiveCls: 'bg-blue-200/90 text-blue-900 font-black'
            },
            {
              id: 'instalacion',
              label: 'Instalaciones',
              count: countsPorTipo.instalacion,
              icon: HardHat,
              activeCls: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-500/25',
              inactiveCls: 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100/80',
              iconActiveCls: 'text-red-100',
              iconInactiveCls: 'text-red-600',
              badgeActiveCls: 'bg-red-950/40 text-white',
              badgeInactiveCls: 'bg-red-200/90 text-red-900 font-black'
            },
            {
              id: 'prueba-tecnica',
              label: 'Pruebas Técnicas',
              count: countsPorTipo['prueba-tecnica'],
              icon: Gauge,
              activeCls: 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/25',
              inactiveCls: 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100/80',
              iconActiveCls: 'text-purple-100',
              iconInactiveCls: 'text-purple-600',
              badgeActiveCls: 'bg-purple-950/40 text-white',
              badgeInactiveCls: 'bg-purple-200/90 text-purple-900 font-black'
            },
            {
              id: 'urgencia',
              label: 'Avisos y Urgencias',
              count: countsPorTipo.urgencia,
              icon: AlertTriangle,
              activeCls: 'bg-zinc-950 text-white border-black shadow-md shadow-black/30',
              inactiveCls: 'bg-zinc-100 text-zinc-900 border-zinc-400 hover:bg-zinc-200/80',
              iconActiveCls: 'text-amber-400',
              iconInactiveCls: 'text-zinc-900',
              badgeActiveCls: 'bg-white/20 text-white',
              badgeInactiveCls: 'bg-zinc-300 text-black font-black'
            },
          ].map(tab => {
            const TabIcon = tab.icon;
            const active = tipoFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTipoFilter(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                  active ? tab.activeCls : tab.inactiveCls
                }`}
              >
                <TabIcon className={`w-3.5 h-3.5 ${active ? tab.iconActiveCls : tab.iconInactiveCls}`} />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-black ${
                  active ? tab.badgeActiveCls : tab.badgeInactiveCls
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla principal estilo Partes de Revisión */}
      <div className="bg-white rounded-3xl shadow-xl border border-zinc-200/85 overflow-hidden">
        {tareasFiltradas.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-500 font-medium">No hay partes de trabajo para mostrar</p>
            <p className="text-zinc-400 text-sm mt-1">
              Las tareas creadas en Reparaciones, Instalaciones, Pruebas Técnicas y Avisos aparecen aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-200/90 border-b border-zinc-300 text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                  <th
                    onClick={() => handleSort('cliente')}
                    className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Cliente</span>
                      {sortField === 'cliente' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('centro')}
                    className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Centro / Tarea</span>
                      {sortField === 'centro' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('poblacion')}
                    className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Población</span>
                      {sortField === 'poblacion' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('fecha')}
                    className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Fecha</span>
                      {sortField === 'fecha' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('tipo')}
                    className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Tipo Trabajo</span>
                      {sortField === 'tipo' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('tecnico')}
                    className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Técnico</span>
                      {sortField === 'tecnico' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 whitespace-nowrap">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {tareasAMostrar.map((tarea, index) => {
                  const style = getTipoBadgeStyle(tarea.origen);
                  const IconTipo = style.icon;
                  const albVinc = albaranes.find(a =>
                    (tarea.albaranId && a.id === tarea.albaranId) ||
                    (tarea.numeroPedido && a.numeroPedido === tarea.numeroPedido)
                  );
                  const firmado = albVinc && (isFirmaValida(albVinc.firmaCliente) || isFirmaValida(albVinc.firmaTecnico));

                  return (
                    <tr
                      key={tarea.uid}
                      onClick={() => setTareaOpcionesModal(tarea)}
                      className={`transition-all duration-150 group cursor-pointer ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'
                      } hover:bg-amber-100/90 hover:shadow-xs`}
                    >
                      <td className="px-6 py-3">
                        <p className="font-medium text-zinc-800 text-sm">
                          {tarea.clienteNombre}
                        </p>
                        <p className={`text-[11px] font-mono font-bold mt-0.5 ${tarea.numeroPedido ? 'text-indigo-600' : 'text-zinc-400'}`}>
                          Nº {tarea.numeroPedido || 'Sin pedido'}
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <p className="font-semibold text-zinc-900 text-sm">
                          {tarea.centroNombre !== '—' ? tarea.centroNombre : tarea.lugar || '—'}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5 line-clamp-1">
                          {tarea.titulo}
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-sm text-zinc-600">
                          {tarea.poblacion || '—'}
                        </p>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-zinc-800">
                          {formatFechaDisplay(tarea.fecha)}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full border ${style.bg}`}>
                          <IconTipo className="w-3.5 h-3.5" />
                          {tarea.tipoLabel}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-xs font-semibold text-zinc-700">
                          {tarea.tecnicoAsignado || 'Sin asignar'}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              tarea.estado === 'Finalizado'
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                                : tarea.estado === 'En curso'
                                ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]'
                                : tarea.estado === 'Parado'
                                ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]'
                                : 'bg-zinc-400 shadow-[0_0_8px_rgba(161,161,170,0.8)]'
                            }`}
                          />
                          <span className="text-xs font-semibold text-zinc-700">
                            {tarea.estado}
                          </span>
                          {firmado && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md ml-1">
                              <Signature className="w-3 h-3" /> Firmado
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pie de paginación */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 bg-white px-5 py-3.5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div className="font-bold text-zinc-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          {limitePartes === 'todos' ? (
            <span>Mostrando todos los partes de trabajo ({tareasFiltradas.length} en total)</span>
          ) : (
            <span>
              Mostrando {Math.min(Number(limitePartes), tareasFiltradas.length)} de {tareasFiltradas.length} partes de trabajo
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-zinc-500 font-semibold uppercase text-[11px] tracking-wider">Mostrar:</span>
          <select
            value={limitePartes}
            onChange={(e) => setLimitePartes(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
            className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold rounded-xl px-3.5 py-1.5 outline-none focus:border-red-500 focus:bg-white cursor-pointer transition-colors"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value="todos">Mostrar todos</option>
          </select>
        </div>
      </div>
      {renderVerParteModal()}
      {renderEditarParteModal()}
      {renderTareaOpcionesModal()}
    </div>
  );
}
