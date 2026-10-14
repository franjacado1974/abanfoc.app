import { useState, useEffect, useMemo } from 'react';
import {
  Phone,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardCheck,
  Wrench,
  HardHat,
  X,
  MapPin,
  User,
  Building2,
  CalendarDays,
  Briefcase,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';
import {
  subscribePartes,
  updateParte,
  subscribeReparaciones,
  updateReparacion,
  subscribeInstalaciones,
  updateInstalacion,
  subscribeUrgencias,
  updateUrgencia,
  subscribeCentros,
  subscribeClientes,
  subscribeAlbaranes,
  type ParteFirestore,
  type ReparacionItem,
  type InstalacionItem,
  type UrgenciaItem,
  type Albaran
} from './firebase';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Cálculo de festivos para Barcelona (Nacionales de España + Autonómicos de Catalunya + Locales de Barcelona)
function getEasterSunday(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

function formatDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getFestivosBarcelona(year: number): Record<string, string> {
  const map: Record<string, string> = {};

  // Fiestas con fecha fija
  map[`${year}-01-01`] = 'Año Nuevo';
  map[`${year}-01-06`] = 'Reyes';
  map[`${year}-05-01`] = 'Día del Trabajador';
  map[`${year}-06-24`] = 'Sant Joan';
  map[`${year}-08-15`] = 'Asunción de la Virgen';
  map[`${year}-09-11`] = 'Diada Nacional de Catalunya';
  map[`${year}-09-24`] = 'La Mercè';
  map[`${year}-10-12`] = 'Fiesta Nacional de España';
  map[`${year}-11-01`] = 'Todos los Santos';
  map[`${year}-12-06`] = 'Día de la Constitución';
  map[`${year}-12-08`] = 'Inmaculada Concepción';
  map[`${year}-12-25`] = 'Navidad';
  map[`${year}-12-26`] = 'Sant Esteve';

  // Fiestas móviles basadas en el Domingo de Pascua
  const easter = getEasterSunday(year);

  // Viernes Santo (2 días antes de Pascua)
  const viernesSanto = new Date(easter);
  viernesSanto.setDate(easter.getDate() - 2);
  map[formatDateIso(viernesSanto)] = 'Viernes Santo';

  // Lunes de Pascua (1 día después de Pascua - Catalunya)
  const lunesPascua = new Date(easter);
  lunesPascua.setDate(easter.getDate() + 1);
  map[formatDateIso(lunesPascua)] = 'Lunes de Pascua';

  // Pascua Granada / Segunda Pascua (50 días después de Pascua - Fiesta Local Barcelona)
  const pascuaGranada = new Date(easter);
  pascuaGranada.setDate(easter.getDate() + 50);
  map[formatDateIso(pascuaGranada)] = 'Pascua Granada';

  return map;
}


export interface EventoCalendario {
  id: string;
  rawDocId: string;
  sigla: 'Rev.' | 'Rep.' | 'Inst.' | 'Urg.' | 'Fiesta:';
  clienteResumido: string;
  tituloCompleto: string;
  lugar?: string;
  direccion?: string;
  poblacion?: string;
  cliente?: string;
  contacto?: string;
  telefono?: string;
  tecnico?: string;
  comercial?: string;
  estado?: string;
  fecha: string; // YYYY-MM-DD
  modulo: 'Mantenimientos' | 'Reparaciones' | 'Instalaciones' | 'Urgencias' | 'Festivo';
  tipoBadge: string;
  colorTag: string;
  colorBadge: string;
  icono: typeof ClipboardCheck;
  detalles?: string;
  completado?: boolean;
  resueltaManual?: boolean;
}

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [partes, setPartes] = useState<ParteFirestore[]>([]);
  const [reparaciones, setReparaciones] = useState<ReparacionItem[]>([]);
  const [instalaciones, setInstalaciones] = useState<InstalacionItem[]>([]);
  const [urgencias, setUrgencias] = useState<UrgenciaItem[]>([]);
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [selectedEvento, setSelectedEvento] = useState<EventoCalendario | null>(null);
  const [mostrarFinSemana, setMostrarFinSemana] = useState(false);
  const [guardandoResuelta, setGuardandoResuelta] = useState(false);

  // Filtros de visibilidad para tareas en el calendario (tachado al ocultar)
  const [filtrosVisibles, setFiltrosVisibles] = useState({
    revisiones: true,
    reparaciones: true,
    instalaciones: true,
    urgencias: true
  });

  const toggleFiltro = (filtroKey: keyof typeof filtrosVisibles) => {
    setFiltrosVisibles((prev) => ({ ...prev, [filtroKey]: !prev[filtroKey] }));
  };

  // Estados para Drag & Drop entre días
  const [draggedEvento, setDraggedEvento] = useState<EventoCalendario | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Comprobar si el usuario actual es Super Administrador (único con permiso para marcar/desmarcar tareas como resueltas)
  const isSuperUser = (() => {
    try {
      const raw = sessionStorage.getItem('firecheck_logged_user') || localStorage.getItem('firecheck_logged_user');
      const loggedUser = raw ? JSON.parse(raw) : null;
      if (!loggedUser) return true;
      const rol = (loggedUser.rol || '').toLowerCase().trim();
      const userStr = (loggedUser.usuario || loggedUser.username || loggedUser.nombre || '').toLowerCase().trim();
      return rol === 'super-administrador' || rol === 'superusuario' || rol === 'superadministrador' || userStr === 'superusuario' || userStr === 'super-administrador';
    } catch {
      return true;
    }
  })();

  // Carga de centros, clientes y técnicos para resolver nombres
  useEffect(() => {
    const safeParse = (key: string) => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };
    setCentros(safeParse('firecheck_db_centros'));
    setClientes(safeParse('firecheck_db_clientes'));
    setTecnicos(safeParse('firecheck_db_tecnicos'));

    const unsubCentros = subscribeCentros((items) => {
      setCentros(items || []);
    });
    const unsubClientes = subscribeClientes((items) => {
      setClientes(items || []);
    });

    return () => {
      unsubCentros();
      unsubClientes();
    };
  }, []);

  // Suscripción en tiempo real a Mantenimientos (Partes de trabajo planificados)
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
      if (Array.isArray(cached) && cached.length > 0) setPartes(cached);
    } catch {}

    const unsubPartes = subscribePartes((items) => {
      setPartes(items || []);
    });
    return () => unsubPartes();
  }, []);

  // Suscripción en tiempo real a Reparaciones
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('firecheck_db_reparaciones') || '[]');
      if (Array.isArray(cached) && cached.length > 0) setReparaciones(cached);
    } catch {}

    const unsubRep = subscribeReparaciones((items) => {
      setReparaciones(items || []);
    });
    return () => unsubRep();
  }, []);

  // Suscripción en tiempo real a Instalaciones
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('firecheck_db_instalaciones') || '[]');
      if (Array.isArray(cached) && cached.length > 0) setInstalaciones(cached);
    } catch {}

    const unsubInst = subscribeInstalaciones((items) => {
      setInstalaciones(items || []);
    });
    return () => unsubInst();
  }, []);

  // Suscripción en tiempo real a Urgencias
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('firecheck_db_urgencias') || '[]');
      if (Array.isArray(cached) && cached.length > 0) setUrgencias(cached);
    } catch {}

    const unsubUrg = subscribeUrgencias((items) => {
      setUrgencias(items || []);
    });
    return () => unsubUrg();
  }, []);

  // Suscripción en tiempo real a Albaranes para detectar tareas completadas
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      if (Array.isArray(cached) && cached.length > 0) setAlbaranes(cached);
    } catch {}

    const unsubAlb = subscribeAlbaranes((items) => {
      setAlbaranes(items || []);
    });
    return () => unsubAlb();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Festivos oficiales de Barcelona y España para el año actual y adyacentes
  const festivosPorFecha = useMemo(() => {
    return {
      ...getFestivosBarcelona(year - 1),
      ...getFestivosBarcelona(year),
      ...getFestivosBarcelona(year + 1)
    };
  }, [year]);


  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Normalizar cualquier formato de fecha a YYYY-MM-DD
  const normalizeDate = (raw: string | undefined | null): string | null => {
    if (!raw || typeof raw !== 'string') return null;
    const clean = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    const ddmmyyyy = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddmmyyyy) {
      const d = ddmmyyyy[1].padStart(2, '0');
      const m = ddmmyyyy[2].padStart(2, '0');
      const y = ddmmyyyy[3];
      return `${y}-${m}-${d}`;
    }
    const ddmmyyyySlash = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyySlash) {
      const d = ddmmyyyySlash[1].padStart(2, '0');
      const m = ddmmyyyySlash[2].padStart(2, '0');
      const y = ddmmyyyySlash[3];
      return `${y}-${m}-${d}`;
    }
    if (clean.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(clean)) {
      return clean.slice(0, 10);
    }
    return null;
  };

  // Normalizar eventos de todas las fuentes con formato Rev., Rep. o Inst. + Cliente
  const eventosPorFecha = useMemo(() => {
    const map: Record<string, EventoCalendario[]> = {};

    const addEvento = (dateRaw: string | undefined | null, ev: EventoCalendario) => {
      const dateStr = normalizeDate(dateRaw);
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push({ ...ev, fecha: dateStr });
    };

    // 0. Festivos de Barcelona y España
    Object.entries(festivosPorFecha).forEach(([fIso, fNombre]) => {
      addEvento(fIso, {
        id: `festivo-${fIso}`,
        rawDocId: '',
        sigla: 'Fiesta:',
        clienteResumido: fNombre,
        tituloCompleto: `Fiesta: ${fNombre}`,
        lugar: 'Barcelona / España',
        estado: 'Festivo Oficial',
        fecha: fIso,
        modulo: 'Festivo',
        tipoBadge: 'Festivo Oficial Barcelona / España',
        colorTag: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-xs',
        colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icono: Sparkles,
        detalles: `Día festivo no laborable: ${fNombre} (Festivo oficial en Barcelona y/o España).`
      });
    });

    const COLOR_COMPLETADO_TAG = 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/60 opacity-80';
    const COLOR_COMPLETADO_BADGE = 'bg-slate-50 text-slate-500 border-slate-200';

    // 1. Mantenimientos: "Rev. [Centro]"
    partes.forEach((p) => {
      if (!p.fechaProgramada) return;
      const c = centros.find((cent) => (cent._docId || cent.id) === p.centroId);
      const cl = clientes.find((cli) => (cli._docId || cli.id) === (p.clienteId || c?.clienteId));
      const tec = tecnicos.find((t) => (t._docId || t.id) === p.tecnicoId);

      // Priorizar incondicionalmente el nombre del centro para la etiqueta del calendario
      const nombreCentro = p.nombreCentro || c?.nombre || cl?.nombre || 'Centro';
      const tieneAlbaran = albaranes.some((a) => a.parteId === p.id || a.parteId === (p as any)._docId || (p.numeroMantenimiento && a.numeroMantenimiento === p.numeroMantenimiento));
      const completado = tieneAlbaran || p.estado === 'Finalizado' || p.estado === 'Cerrado';
      const poblacion = c?.poblacion || (p as any).poblacionCentro || cl?.poblacion;
      const direccion = c?.direccion || (p as any).direccionCentro || cl?.direccion;
      const contacto = c?.contacto || (p as any).contacto || cl?.contacto;
      const telefono = c?.telefono || (p as any).telefono || cl?.telefono;

      // Unificar dirección y población en el lugar
      const direccionConPoblacion = [direccion, poblacion].filter(Boolean).join(', ');
      const lugarTexto = c?.nombre
        ? (direccionConPoblacion ? `${c.nombre} (${direccionConPoblacion})` : c.nombre)
        : (direccionConPoblacion || undefined);

      addEvento(p.fechaProgramada, {
        id: `parte-${p.id || (p as any)._docId}`,
        rawDocId: (p as any)._docId || p.id,
        sigla: 'Rev.',
        clienteResumido: nombreCentro,
        tituloCompleto: p.nombreCentro || c?.nombre || 'Revisión Mantenimiento',
        lugar: lugarTexto,
        direccion,
        poblacion,
        cliente: cl?.nombre,
        contacto,
        telefono,
        tecnico: tec?.nombre ? `${tec.nombre} ${tec.apellidos || ''}` : undefined,
        comercial: (p as any).comercial || (c as any)?.comercial || undefined,
        estado: p.estado || 'Planificado',
        fecha: p.fechaProgramada,
        modulo: 'Mantenimientos',
        tipoBadge: p.periodicidad ? `Revisión ${p.periodicidad}` : 'Revisión Mantenimiento',
        colorTag: completado ? COLOR_COMPLETADO_TAG : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200/90',
        colorBadge: completado ? COLOR_COMPLETADO_BADGE : 'bg-amber-50 text-amber-800 border-amber-200',
        icono: ClipboardCheck,
        detalles: p.observacionesTecnico || p.comentariosPrivados || undefined,
        completado
      });
    });

    // 2. Operaciones - Reparaciones: "Rep. [Cliente / Lugar]" (Azul)
    reparaciones.forEach((r) => {
      const fecha = r.fecha || (r.fechaCreacion ? r.fechaCreacion.slice(0, 10) : '');
      if (!fecha) return;

      const c = centros.find((cent) => (r.centroId && (cent._docId || cent.id) === r.centroId) || (cent.nombre && r.lugar && cent.nombre.toLowerCase().includes(r.lugar.toLowerCase())));
      const cl = clientes.find((cli) => (cli._docId || cli.id) === r.clienteId || (cli._docId || cli.id) === c?.clienteId || (cli.nombre && r.lugar && cli.nombre.toLowerCase().includes(r.lugar.toLowerCase())));
      const nombreCliente = cl?.nombre || r.lugar || 'Cliente';
      const tieneAlbaran = !!r.albaranId || albaranes.some((a) => a.reparacionId === r.id || a.reparacionId === (r as any)._docId || a.id === r.albaranId);
      const resueltaManual = (r as any).resueltaManual === true;
      const completado = tieneAlbaran || r.estado === 'Finalizado' || resueltaManual;
      const poblacion = (r as any).poblacion || c?.poblacion || cl?.poblacion;
      const direccion = c?.direccion || cl?.direccion;
      const contacto = c?.contacto || (r as any).contacto || cl?.contacto;
      const telefono = c?.telefono || (r as any).telefono || cl?.telefono;

      // Si el lugar no incluye la población, incorporarla
      let lugarTexto = r.lugar;
      if (poblacion && lugarTexto && !lugarTexto.toLowerCase().includes(poblacion.toLowerCase())) {
        lugarTexto = `${lugarTexto}, ${poblacion}`;
      } else if (!lugarTexto && poblacion) {
        lugarTexto = [direccion, poblacion].filter(Boolean).join(', ');
      }

      addEvento(fecha, {
        id: `rep-${r.id || (r as any)._docId}`,
        rawDocId: (r as any)._docId || r.id,
        sigla: 'Rep.',
        clienteResumido: nombreCliente,
        tituloCompleto: r.reparacion || 'Reparación / Avería',
        lugar: lugarTexto,
        direccion,
        poblacion,
        cliente: cl?.nombre,
        tecnico: r.tecnicoAsignado,
        comercial: r.comercial || (r as any).comercialAsignado || undefined,
        estado: r.estado || 'Pendiente',
        fecha,
        contacto,
        telefono,
        modulo: 'Reparaciones',
        tipoBadge: 'Reparación / Avería',
        colorTag: completado ? COLOR_COMPLETADO_TAG : 'bg-sky-100 text-sky-900 border-sky-300 hover:bg-sky-200/90',
        colorBadge: completado ? COLOR_COMPLETADO_BADGE : 'bg-sky-50 text-sky-800 border-sky-200',
        icono: Wrench,
        detalles: r.nota || r.observaciones || undefined,
        completado,
        resueltaManual
      });
    });

    // 3. Operaciones - Instalaciones: "Inst. [Cliente / Lugar]" (Rojo)
    instalaciones.forEach((i) => {
      const fecha = i.fecha || (i.fechaCreacion ? i.fechaCreacion.slice(0, 10) : '');
      if (!fecha) return;

      const c = centros.find((cent) => (i.centroId && (cent._docId || cent.id) === i.centroId) || (cent.nombre && i.lugar && cent.nombre.toLowerCase().includes(i.lugar.toLowerCase())));
      const cl = clientes.find((cli) => (cli._docId || cli.id) === i.clienteId || (cli._docId || cli.id) === c?.clienteId || (cli.nombre && i.lugar && cli.nombre.toLowerCase().includes(i.lugar.toLowerCase())));
      const nombreCliente = cl?.nombre || i.lugar || 'Cliente';
      const tieneAlbaran = !!i.albaranId || albaranes.some((a) => a.instalacionId === i.id || a.instalacionId === (i as any)._docId || a.id === i.albaranId);
      const resueltaManual = (i as any).resueltaManual === true;
      const completado = tieneAlbaran || i.estado === 'Finalizado' || resueltaManual;
      const poblacion = (i as any).poblacion || c?.poblacion || cl?.poblacion;
      const direccion = c?.direccion || cl?.direccion;
      const contacto = c?.contacto || (i as any).contacto || cl?.contacto;
      const telefono = c?.telefono || (i as any).telefono || cl?.telefono;

      let lugarTexto = i.lugar;
      if (poblacion && lugarTexto && !lugarTexto.toLowerCase().includes(poblacion.toLowerCase())) {
        lugarTexto = `${lugarTexto}, ${poblacion}`;
      } else if (!lugarTexto && poblacion) {
        lugarTexto = [direccion, poblacion].filter(Boolean).join(', ');
      }

      addEvento(fecha, {
        id: `inst-${i.id || (i as any)._docId}`,
        rawDocId: (i as any)._docId || i.id,
        sigla: 'Inst.',
        clienteResumido: nombreCliente,
        tituloCompleto: i.instalacion || 'Instalación / Montaje',
        lugar: lugarTexto,
        direccion,
        poblacion,
        cliente: cl?.nombre,
        tecnico: i.tecnicoAsignado,
        comercial: i.comercial || (i as any).comercialAsignado || undefined,
        estado: i.estado || 'Pendiente',
        fecha,
        contacto,
        telefono,
        modulo: 'Instalaciones',
        tipoBadge: 'Instalación / Montaje',
        colorTag: completado ? COLOR_COMPLETADO_TAG : 'bg-red-100 text-red-900 border-red-300 hover:bg-red-200/90',
        colorBadge: completado ? COLOR_COMPLETADO_BADGE : 'bg-red-50 text-red-800 border-red-200',
        icono: HardHat,
        detalles: i.nota || i.observaciones || undefined,
        completado,
        resueltaManual
      });
    });

    // 4. Operaciones - Urgencias: "Urg. [Cliente / Lugar]" (Rosa/Rojo vibrante con AlertTriangle)
    urgencias.forEach((u) => {
      const fecha = u.fecha || (u.fechaCreacion ? u.fechaCreacion.slice(0, 10) : '');
      if (!fecha) return;

      const c = centros.find((cent) => (u.centroId && (cent._docId || cent.id) === u.centroId) || (cent.nombre && u.lugar && cent.nombre.toLowerCase().includes(u.lugar.toLowerCase())));
      const cl = clientes.find((cli) => (cli._docId || cli.id) === u.clienteId || (cli._docId || cli.id) === c?.clienteId || (cli.nombre && u.lugar && cli.nombre.toLowerCase().includes(u.lugar.toLowerCase())));
      const nombreCliente = cl?.nombre || u.lugar || 'Cliente';
      const tieneAlbaran = !!u.albaranId || albaranes.some((a) => a.reparacionId === u.id || a.reparacionId === (u as any)._docId || (a as any).urgenciaId === u.id || (a as any).urgenciaId === (u as any)._docId || a.id === u.albaranId);
      const resueltaManual = (u as any).resueltaManual === true;
      const completado = tieneAlbaran || u.estado === 'Finalizado' || resueltaManual;
      const poblacion = (u as any).poblacion || c?.poblacion || cl?.poblacion;
      const direccion = c?.direccion || cl?.direccion;
      const contacto = c?.contacto || (u as any).contacto || cl?.contacto;
      const telefono = c?.telefono || (u as any).telefono || cl?.telefono;

      let lugarTexto = u.lugar;
      if (poblacion && lugarTexto && !lugarTexto.toLowerCase().includes(poblacion.toLowerCase())) {
        lugarTexto = `${lugarTexto}, ${poblacion}`;
      } else if (!lugarTexto && poblacion) {
        lugarTexto = [direccion, poblacion].filter(Boolean).join(', ');
      }

      const tituloAviso = u.titulo || u.urgencia || nombreCliente || 'Aviso de Urgencia';

      addEvento(fecha, {
        id: `urg-${u.id || (u as any)._docId}`,
        rawDocId: (u as any)._docId || u.id,
        sigla: 'Urg.',
        clienteResumido: tituloAviso,
        tituloCompleto: tituloAviso,
        lugar: lugarTexto,
        direccion,
        poblacion,
        cliente: cl?.nombre,
        tecnico: u.tecnicoAsignado,
        comercial: u.comercial || undefined,
        estado: u.estado || 'Pendiente',
        fecha,
        contacto,
        telefono,
        modulo: 'Urgencias',
        tipoBadge: u.prioridad ? `Urgencia (${u.prioridad})` : 'Aviso de Urgencia',
        colorTag: completado ? COLOR_COMPLETADO_TAG : 'bg-black text-white border-zinc-950 hover:bg-zinc-800 shadow-xs',
        colorBadge: completado ? COLOR_COMPLETADO_BADGE : 'bg-zinc-900 text-white border-black',
        icono: AlertTriangle,
        detalles: u.nota || u.observaciones || undefined,
        completado,
        resueltaManual
      });
    });

    return map;
  }, [partes, reparaciones, instalaciones, urgencias, albaranes, centros, clientes, tecnicos, festivosPorFecha]);

  const getCalendarDays = () => {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    for (let i = startDayOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: d,
        iso,
        currentMonth: false,
        dayNumber: daysInPrevMonth - i
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: d,
        iso,
        currentMonth: true,
        dayNumber: i
      });
    }

    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: d,
        iso,
        currentMonth: false,
        dayNumber: i
      });
    }

    return days;
  };

  const days = getCalendarDays();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Filtrar días según visualización de fin de semana
  const diasMostrados = useMemo(() => {
    if (mostrarFinSemana) return days;
    return days.filter((d) => d.date.getDay() !== 0 && d.date.getDay() !== 6);
  }, [days, mostrarFinSemana]);

  const diasSemanaCabecera = mostrarFinSemana ? DIAS_SEMANA : DIAS_SEMANA.slice(0, 5);

  // Estadísticas del mes en curso
  const statsMes = useMemo(() => {
    let mantCount = 0;
    let repCount = 0;
    let instCount = 0;
    let urgCount = 0;

    days.filter((d) => d.currentMonth).forEach((d) => {
      const evs = eventosPorFecha[d.iso] || [];
      evs.forEach((ev) => {
        if (ev.sigla === 'Rev.') mantCount++;
        else if (ev.sigla === 'Rep.') repCount++;
        else if (ev.sigla === 'Inst.') instCount++;
        else if (ev.sigla === 'Urg.') urgCount++;
      });
    });

    return { mantCount, repCount, instCount, urgCount, total: mantCount + repCount + instCount + urgCount };
  }, [days, eventosPorFecha]);

  // Gestores de arrastre (Drag & Drop)
  const handleDragStart = (e: React.DragEvent, ev: EventoCalendario) => {
    setDraggedEvento(ev);
    e.dataTransfer.setData('text/plain', ev.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetIso: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDate !== targetIso) {
      setDragOverDate(targetIso);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, targetIso: string) => {
    if (dragOverDate === targetIso) {
      setDragOverDate(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetIso: string) => {
    e.preventDefault();
    setDragOverDate(null);
    if (!draggedEvento || !targetIso) return;

    const sourceIso = draggedEvento.fecha;
    if (sourceIso === targetIso) {
      setDraggedEvento(null);
      return;
    }

    const { modulo, rawDocId, sigla } = draggedEvento;
    setDraggedEvento(null);

    // Mantenimientos / Planificación: actualiza fechaProgramada en DD-MM-YYYY
    if (modulo === 'Mantenimientos' || sigla === 'Rev.') {
      const parts = targetIso.split('-'); // [YYYY, MM, DD]
      const planificacionDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY

      setPartes((prev) =>
        prev.map((p) => {
          const docId = (p as any)._docId || p.id;
          if (docId === rawDocId) {
            return { ...p, fechaProgramada: planificacionDateStr };
          }
          return p;
        })
      );

      try {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
        const updated = stored.map((p: any) => {
          const docId = p._docId || p.id;
          if (docId === rawDocId) {
            return { ...p, fechaProgramada: planificacionDateStr };
          }
          return p;
        });
        localStorage.setItem('firecheck_db_partes', JSON.stringify(updated));
      } catch {}

      try {
        await updateParte(rawDocId, { fechaProgramada: planificacionDateStr });
      } catch (err) {
        console.error('Error al mover revisión en Firestore:', err);
      }
    } else if (modulo === 'Reparaciones' || sigla === 'Rep.') {
      setReparaciones((prev) =>
        prev.map((r) => {
          const docId = (r as any)._docId || r.id;
          if (docId === rawDocId) {
            return { ...r, fecha: targetIso };
          }
          return r;
        })
      );

      try {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_reparaciones') || '[]');
        const updated = stored.map((r: any) => {
          const docId = r._docId || r.id;
          if (docId === rawDocId) {
            return { ...r, fecha: targetIso };
          }
          return r;
        });
        localStorage.setItem('firecheck_db_reparaciones', JSON.stringify(updated));
      } catch {}

      try {
        await updateReparacion(rawDocId, { fecha: targetIso });
      } catch (err) {
        console.error('Error al mover reparación en Firestore:', err);
      }
    } else if (modulo === 'Instalaciones' || sigla === 'Inst.') {
      setInstalaciones((prev) =>
        prev.map((i) => {
          const docId = (i as any)._docId || i.id;
          if (docId === rawDocId) {
            return { ...i, fecha: targetIso };
          }
          return i;
        })
      );

      try {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_instalaciones') || '[]');
        const updated = stored.map((i: any) => {
          const docId = i._docId || i.id;
          if (docId === rawDocId) {
            return { ...i, fecha: targetIso };
          }
          return i;
        });
        localStorage.setItem('firecheck_db_instalaciones', JSON.stringify(updated));
      } catch {}

      try {
        await updateInstalacion(rawDocId, { fecha: targetIso });
      } catch (err) {
        console.error('Error al mover instalación en Firestore:', err);
      }
    } else if (modulo === 'Urgencias' || sigla === 'Urg.') {
      setUrgencias((prev) =>
        prev.map((u) => {
          const docId = (u as any)._docId || u.id;
          if (docId === rawDocId) {
            return { ...u, fecha: targetIso };
          }
          return u;
        })
      );

      try {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_urgencias') || '[]');
        const updated = stored.map((u: any) => {
          const docId = u._docId || u.id;
          if (docId === rawDocId) {
            return { ...u, fecha: targetIso };
          }
          return u;
        });
        localStorage.setItem('firecheck_db_urgencias', JSON.stringify(updated));
      } catch {}

      try {
        await updateUrgencia(rawDocId, { fecha: targetIso });
      } catch (err) {
        console.error('Error al mover urgencia en Firestore:', err);
      }
    }
  };

  // Marcar / Desmarcar como resuelta (solo Super Admin; solo Reparaciones, Instalaciones y Urgencias).
  // Usa un campo independiente `resueltaManual` sin modificar el `estado` de la tarea.
  const handleToggleResuelta = async (ev: EventoCalendario, valor: boolean) => {
    if (!isSuperUser) return;
    const { rawDocId, modulo, id: evId } = ev;
    if (!rawDocId || (modulo !== 'Reparaciones' && modulo !== 'Instalaciones' && modulo !== 'Urgencias')) return;

    const cleanId = (evId || '').replace(/^(rep|inst|urg)-/, '');
    const matchesItem = (it: any) => {
      if (!it) return false;
      return (
        it._docId === rawDocId ||
        it.id === rawDocId ||
        (cleanId && (it.id === cleanId || it._docId === cleanId))
      );
    };

    const aplicar = <T,>(list: T[]): T[] =>
      list.map((it: any) => (matchesItem(it) ? { ...it, resueltaManual: valor } : it));

    const persistLocal = (key: string) => {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(stored)) localStorage.setItem(key, JSON.stringify(aplicar(stored)));
      } catch {}
    };

    setGuardandoResuelta(true);
    try {
      if (modulo === 'Reparaciones') {
        setReparaciones((prev) => aplicar(prev));
        persistLocal('firecheck_db_reparaciones');
        await updateReparacion(rawDocId, { resueltaManual: valor } as any);
      } else if (modulo === 'Instalaciones') {
        setInstalaciones((prev) => aplicar(prev));
        persistLocal('firecheck_db_instalaciones');
        await updateInstalacion(rawDocId, { resueltaManual: valor } as any);
      } else {
        setUrgencias((prev) => aplicar(prev));
        persistLocal('firecheck_db_urgencias');
        await updateUrgencia(rawDocId, { resueltaManual: valor } as any);
      }
    } catch (err) {
      console.error('Error al marcar/desmarcar tarea como resuelta en Firestore:', err);
    } finally {
      setGuardandoResuelta(false);
      setSelectedEvento(null);
    }
  };

  return (
    <div className="h-screen max-h-screen bg-[#F8FAFC] flex flex-col p-3 sm:p-4 lg:p-5 select-none overflow-hidden">
      {/* Barra de cabecera del Calendario */}
      <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm mb-3 shrink-0">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="w-full lg:w-auto text-center">
            <div>
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight capitalize">
                  {MESES[month]} {year}
                </h1>
                {isCurrentMonth && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-600 text-white tracking-wider shadow-sm">
                    Mes en curso
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Calendario unificado en tiempo real · Arrastra tareas entre días para reprogramar
              </p>
            </div>
          </div>

          {/* Leyenda y Conteo de Etiquetas con Filtros Interactivos */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleFiltro('revisiones')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                filtrosVisibles.revisiones
                  ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
              }`}
              title={filtrosVisibles.revisiones ? 'Clic para ocultar Revisiones' : 'Clic para mostrar Revisiones'}
            >
              <span className={`font-extrabold ${filtrosVisibles.revisiones ? 'text-amber-700' : 'text-slate-400'}`}>Rev.</span>
              <span>Revisiones ({statsMes.mantCount})</span>
            </button>

            <button
              type="button"
              onClick={() => toggleFiltro('reparaciones')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                filtrosVisibles.reparaciones
                  ? 'bg-sky-50 text-sky-900 border-sky-300 shadow-xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
              }`}
              title={filtrosVisibles.reparaciones ? 'Clic para ocultar Reparaciones' : 'Clic para mostrar Reparaciones'}
            >
              <span className={`font-extrabold ${filtrosVisibles.reparaciones ? 'text-sky-700' : 'text-slate-400'}`}>Rep.</span>
              <span>Reparaciones ({statsMes.repCount})</span>
            </button>

            <button
              type="button"
              onClick={() => toggleFiltro('instalaciones')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                filtrosVisibles.instalaciones
                  ? 'bg-red-50 text-red-900 border-red-300 shadow-xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
              }`}
              title={filtrosVisibles.instalaciones ? 'Clic para ocultar Instalaciones' : 'Clic para mostrar Instalaciones'}
            >
              <span className={`font-extrabold ${filtrosVisibles.instalaciones ? 'text-red-700' : 'text-slate-400'}`}>Inst.</span>
              <span>Instalaciones ({statsMes.instCount})</span>
            </button>

            <button
              type="button"
              onClick={() => toggleFiltro('urgencias')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                filtrosVisibles.urgencias
                  ? 'bg-black text-white border-zinc-950 shadow-xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
              }`}
              title={filtrosVisibles.urgencias ? 'Clic para ocultar Urgencias' : 'Clic para mostrar Urgencias'}
            >
              <span className={`font-extrabold ${filtrosVisibles.urgencias ? 'text-white' : 'text-slate-400'}`}>Urg.</span>
              <span>Urgencias ({statsMes.urgCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <button
              type="button"
              onClick={handleToday}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Hoy</span>
            </button>

            <button
              type="button"
              onClick={() => setMostrarFinSemana((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 ${
                mostrarFinSemana
                  ? 'border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
              title={mostrarFinSemana ? 'Ocultar sábado y domingo' : 'Mostrar sábado y domingo'}
            >
              <CalendarDays className={`w-3.5 h-3.5 ${mostrarFinSemana ? 'text-amber-700' : 'text-slate-500'}`} />
              <span>{mostrarFinSemana ? 'Ocultar Finde' : 'Mostrar Finde'}</span>
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-black text-slate-700 min-w-[80px] text-center capitalize">
                {MESES[month].slice(0, 3)}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor del Calendario a toda la pantalla */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-0">
        {/* Cabecera con Días de la Semana */}
        <div className={`grid ${mostrarFinSemana ? 'grid-cols-7' : 'grid-cols-5'} border-b border-slate-200 bg-slate-50/80 text-center text-xs font-black text-slate-600 uppercase tracking-wider py-2.5 shrink-0`}>
          {diasSemanaCabecera.map((dia, idx) => (
            <div key={dia} className={idx >= 5 ? 'text-red-600' : ''}>
              <span className="hidden sm:inline">{dia}</span>
              <span className="sm:hidden">{dia.slice(0, 2)}</span>
            </div>
          ))}
        </div>

        {/* Cuadrícula de Días que ocupa el 100% del alto disponible */}
        <div className={`grid ${mostrarFinSemana ? 'grid-cols-7' : 'grid-cols-5'} flex-1 auto-rows-fr divide-x divide-y divide-slate-200/80 bg-slate-100/30 min-h-0 overflow-hidden`}>
          {diasMostrados.map((d, index) => {
            const isToday =
              d.date.getDate() === today.getDate() &&
              d.date.getMonth() === today.getMonth() &&
              d.date.getFullYear() === today.getFullYear();

            const isHoliday = !!festivosPorFecha[d.iso];
            const todosEventosDia = eventosPorFecha[d.iso] || [];
            const eventosDia = todosEventosDia.filter((ev) => {
              if (ev.sigla === 'Rev.' && !filtrosVisibles.revisiones) return false;
              if (ev.sigla === 'Rep.' && !filtrosVisibles.reparaciones) return false;
              if (ev.sigla === 'Inst.' && !filtrosVisibles.instalaciones) return false;
              if (ev.sigla === 'Urg.' && !filtrosVisibles.urgencias) return false;
              return true;
            });
            const isOverThisDay = dragOverDate === d.iso;

            return (
              <div
                key={index}
                onDragOver={(e) => handleDragOver(e, d.iso)}
                onDragLeave={(e) => handleDragLeave(e, d.iso)}
                onDrop={(e) => handleDrop(e, d.iso)}
                className={`p-1 sm:p-1.5 flex flex-col justify-start transition-all min-h-0 h-full overflow-hidden ${
                  isOverThisDay
                    ? 'bg-red-50/70 border-2 border-dashed border-red-400 scale-[0.99] shadow-inner'
                    : isHoliday
                    ? 'bg-slate-200/85 hover:bg-slate-200 text-slate-800'
                    : d.currentMonth
                    ? 'bg-white hover:bg-slate-50/70'
                    : 'bg-slate-50/40 text-slate-300'
                }`}
              >
                {/* Cabecera del día */}
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <span
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[11px] sm:text-xs font-black ${
                      isToday
                        ? 'bg-red-600 text-white shadow-xs shadow-red-500/30'
                        : d.currentMonth
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {d.dayNumber}
                  </span>
                  {eventosDia.length > 0 && (
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                      {eventosDia.length}
                    </span>
                  )}
                </div>

                {/* Lista de etiquetas arrastrables */}
                <div className="flex-1 flex flex-col gap-0.5 sm:gap-1 overflow-y-auto pr-0.5 custom-calendar-scroll min-h-0">
                  {eventosDia.map((ev) => {
                    const isFestivo = ev.modulo === 'Festivo';
                    return (
                      <div
                        key={ev.id}
                        draggable={!isFestivo}
                        onDragStart={(e) => !isFestivo && handleDragStart(e, ev)}
                        onClick={() => setSelectedEvento(ev)}
                        className={`w-full text-left px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] font-bold transition-all shadow-2xs truncate flex items-center gap-1 shrink-0 select-none ${
                          isFestivo
                            ? 'cursor-pointer'
                            : 'cursor-grab active:cursor-grabbing active:scale-[0.98] hover:shadow-xs'
                        } ${ev.colorTag}`}
                        title={
                          isFestivo
                            ? `${ev.tituloCompleto} (Festivo oficial en Barcelona / España)`
                            : `${ev.sigla} ${ev.clienteResumido}${ev.poblacion ? ` [${ev.poblacion}]` : ''}${ev.completado ? ' · Completada (Albarán generado)' : ''} (Arrastra a otro día para reprogramar o haz clic para ver detalles)`
                        }
                      >
                        <span className="font-extrabold tracking-tight shrink-0">{ev.sigla}</span>
                        <span className="truncate font-semibold">{ev.clienteResumido}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal flotante de Solo Lectura con todos los detalles del trabajo */}
      {selectedEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col">
            {/* Cabecera del modal */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${selectedEvento.colorBadge}`}>
                  <selectedEvento.icono className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${selectedEvento.colorTag}`}>
                      {selectedEvento.sigla} {selectedEvento.modulo}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {selectedEvento.tipoBadge}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight mt-1">
                    {selectedEvento.clienteResumido}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvento(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del modal informativo */}
            <div className="p-5 space-y-3.5 text-xs text-slate-600">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <CalendarDays className="w-4 h-4 text-red-500 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-600 font-bold block uppercase">Fecha programada</span>
                  <span className="font-extrabold text-slate-800 text-sm">
                    {selectedEvento.fecha.split('-').reverse().join('/')}
                  </span>
                </div>
              </div>

              {selectedEvento.tituloCompleto && selectedEvento.tituloCompleto !== selectedEvento.clienteResumido && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-600 font-bold block uppercase">Concepto / Tarea</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedEvento.tituloCompleto}</span>
                </div>
              )}

              {selectedEvento.cliente && (
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block uppercase">Cliente</span>
                    <span className="font-bold text-slate-800">{selectedEvento.cliente}</span>
                  </div>
                </div>
              )}

              {selectedEvento.lugar && (() => {
                // Generar query limpio para Google Maps combinando dirección o lugar y población
                const rawQuery = [selectedEvento.direccion, selectedEvento.poblacion].filter(Boolean).join(', ') || selectedEvento.lugar || '';
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawQuery)}`;

                return (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs space-y-2">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                          Lugar / Dirección y Población
                        </span>
                        <div className="font-bold text-slate-800 text-xs leading-snug break-words">
                          {selectedEvento.lugar}
                        </div>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                      {selectedEvento.poblacion && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded-md text-[10px] font-bold">
                          📍 {selectedEvento.poblacion}
                        </span>
                      )}
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer group"
                        title="Abrir ubicación en Google Maps"
                      >
                        {/* Icono oficial Google Maps Pin Multicolor */}
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                            fill="#EA4335"
                          />
                          <path
                            d="M12 2C8.13 2 5 5.13 5 9c0 2.22 1.25 5.14 3.06 8.35L12 9V2z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 9v13s2.94-3.26 4.94-7.65L12 9z"
                            fill="#FBBC04"
                          />
                          <path
                            d="M12 22s-2.06-2.28-3.94-6.65L12 9v13z"
                            fill="#34A853"
                          />
                          <circle cx="12" cy="9" r="2.8" fill="#FFFFFF" />
                        </svg>
                        <span>Abrir en Google Maps</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </a>
                    </div>
                  </div>
                );
              })()}

              {(selectedEvento.contacto || selectedEvento.telefono) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedEvento.contacto && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Contacto</span>
                        <span className="font-bold text-slate-800 text-xs truncate block" title={selectedEvento.contacto}>
                          {selectedEvento.contacto}
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedEvento.telefono && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Teléfono</span>
                        <a
                          href={`tel:${selectedEvento.telefono}`}
                          className="font-bold text-emerald-700 hover:text-emerald-800 text-xs hover:underline inline-block truncate max-w-full"
                          title="Llamar al teléfono"
                        >
                          {selectedEvento.telefono}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedEvento.tecnico && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block uppercase">Técnico Asignado</span>
                    <span className="font-bold text-slate-800">{selectedEvento.tecnico}</span>
                  </div>
                </div>
              )}

              {selectedEvento.comercial && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block uppercase">Comercial</span>
                    <span className="font-bold text-slate-800">{selectedEvento.comercial}</span>
                  </div>
                </div>
              )}

              {selectedEvento.estado && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-600 font-bold uppercase">Estado</span>
                  <div className="flex items-center gap-1.5">
                    {selectedEvento.completado && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                        {selectedEvento.resueltaManual ? 'Resuelta manualmente' : 'Albarán generado'}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-800 shadow-xs">
                      {selectedEvento.estado}
                    </span>
                  </div>
                </div>
              )}

              {selectedEvento.detalles && (
                <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/70 text-amber-900">
                  <span className="text-[10px] text-amber-800 font-bold block uppercase mb-1">Notas / Observaciones</span>
                  <p className="whitespace-pre-wrap font-medium">{selectedEvento.detalles}</p>
                </div>
              )}
            </div>

            {/* Pie del modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-end gap-2">
              {isSuperUser &&
                (selectedEvento.modulo === 'Reparaciones' || selectedEvento.modulo === 'Instalaciones' || selectedEvento.modulo === 'Urgencias') && (
                  <>
                    {!selectedEvento.completado && (
                      <button
                        type="button"
                        disabled={guardandoResuelta}
                        onClick={() => handleToggleResuelta(selectedEvento, true)}
                        className="mr-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Marcar esta tarea como resuelta aunque no tenga albarán"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Marcar como resuelta
                      </button>
                    )}
                    {selectedEvento.resueltaManual && (
                      <button
                        type="button"
                        disabled={guardandoResuelta}
                        onClick={() => handleToggleResuelta(selectedEvento, false)}
                        className="mr-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Quitar la marca de resuelta y devolver la tarea a pendiente"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Desmarcar como resuelta
                      </button>
                    )}
                  </>
                )}
              <button
                type="button"
                onClick={() => setSelectedEvento(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-calendar-scroll::-webkit-scrollbar { width: 3px; }
        .custom-calendar-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
      `}</style>
    </div>
  );
}
