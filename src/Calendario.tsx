import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  RotateCcw,
  ReceiptText,
  Filter,
  Check
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
  obtenerEmpresaPorDefecto,
  subscribeVacacionesSolicitudes,
  type ParteFirestore,
  type ReparacionItem,
  type InstalacionItem,
  type UrgenciaItem,
  type Albaran,
  type VacacionSolicitud
} from './firebase';
import CalendarioLaboral from './components/CalendarioLaboral';
import CalendarioVacaciones from './components/CalendarioVacaciones';

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
  fechaInicio?: string; // YYYY-MM-DD
  fechaFin?: string; // YYYY-MM-DD
  modulo: 'Mantenimientos' | 'Reparaciones' | 'Instalaciones' | 'Urgencias' | 'Festivo';
  tipoBadge: string;
  colorTag: string;
  colorBadge: string;
  icono: typeof ClipboardCheck;
  detalles?: string;
  completado?: boolean;
  resueltaManual?: boolean;
  fechaConfirmada?: boolean;
}

interface CalendarioProps {
  user?: { id?: string; nombre: string; apellidos?: string; rol?: string; usuario?: string } | null;
  initialTab?: 'tareas' | 'laboral' | 'vacaciones';
}

export default function Calendario({ user, initialTab = 'tareas' }: CalendarioProps) {
  const navigate = useNavigate();
  const [calendarTab, setCalendarTab] = useState<'tareas' | 'laboral' | 'vacaciones'>(initialTab);
  const [vacacionesSolicitudes, setVacacionesSolicitudes] = useState<VacacionSolicitud[]>([]);
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
  const [editEstado, setEditEstado] = useState<string>('Pendiente');
  const [editNota, setEditNota] = useState<string>('');
  const [editFechaConfirmada, setEditFechaConfirmada] = useState<boolean>(false);
  const [editFechaInicio, setEditFechaInicio] = useState<string>('');
  const [editFechaFin, setEditFechaFin] = useState<string>('');
  const [mostrarAmpliarRango, setMostrarAmpliarRango] = useState<boolean>(false);
  const [guardandoCambios, setGuardandoCambios] = useState(false);
  const [selectedDayModal, setSelectedDayModal] = useState<{ iso: string; date: Date } | null>(null);
  const [showConfirmAlbaranModal, setShowConfirmAlbaranModal] = useState(false);

  useEffect(() => {
    setCalendarTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const unsubVac = subscribeVacacionesSolicitudes((items) => setVacacionesSolicitudes(items));
    return () => unsubVac();
  }, []);

  useEffect(() => {
    if (selectedEvento) {
      const startIso = selectedEvento.fechaInicio || selectedEvento.fecha;
      const endIso = selectedEvento.fechaFin && selectedEvento.fechaFin > startIso ? selectedEvento.fechaFin : startIso;
      setEditEstado(selectedEvento.estado || 'Pendiente');
      setEditNota(selectedEvento.detalles || '');
      setEditFechaConfirmada(!!selectedEvento.fechaConfirmada);
      setEditFechaInicio(startIso);
      setEditFechaFin(endIso);
      setMostrarAmpliarRango(Boolean(selectedEvento.fechaFin && selectedEvento.fechaFin > startIso));
      setShowConfirmAlbaranModal(false);
    } else {
      setEditEstado('Pendiente');
      setEditNota('');
      setEditFechaConfirmada(false);
      setEditFechaInicio('');
      setEditFechaFin('');
      setMostrarAmpliarRango(false);
      setShowConfirmAlbaranModal(false);
    }
  }, [selectedEvento]);

  // Filtros de visibilidad para tareas en el calendario (tachado al ocultar)
  const [filtrosVisibles, setFiltrosVisibles] = useState({
    revisiones: true,
    reparaciones: true,
    instalaciones: true,
    urgencias: true
  });
  const [showTiposDropdown, setShowTiposDropdown] = useState(false);
  const tiposDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tiposDropdownRef.current && !tiposDropdownRef.current.contains(e.target as Node)) {
        setShowTiposDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

    const getDatesInRange = (startRaw: string | undefined | null, endRaw?: string | undefined | null): string[] => {
      const startStr = normalizeDate(startRaw);
      if (!startStr) return [];
      const endStr = normalizeDate(endRaw);
      if (!endStr || endStr <= startStr) return [startStr];

      const dates: string[] = [];
      const [sy, sm, sd] = startStr.split('-').map(Number);
      const [ey, em, ed] = endStr.split('-').map(Number);
      const curr = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);

      let safety = 0;
      while (curr <= end && safety < 90) {
        dates.push(formatDateIso(curr));
        curr.setDate(curr.getDate() + 1);
        safety++;
      }
      return dates.length > 0 ? dates : [startStr];
    };

    const addEvento = (dateRaw: string | undefined | null, ev: EventoCalendario, endDateRaw?: string | undefined | null) => {
      const startIso = normalizeDate(dateRaw);
      if (!startIso) return;
      const endIso = normalizeDate(endDateRaw);
      const validEndIso = endIso && endIso > startIso ? endIso : undefined;
      const dates = getDatesInRange(startIso, validEndIso);

      dates.forEach((dateStr) => {
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({
          ...ev,
          fecha: dateStr,
          fechaInicio: startIso,
          fechaFin: validEndIso
        });
      });
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
        completado,
        fechaConfirmada: (p as any).fechaConfirmada === true
      }, p.fechaFinProgramada || (p as any).fechaFin);
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
        resueltaManual,
        fechaConfirmada: (r as any).fechaConfirmada === true
      }, r.fechaFinProgramada || (r as any).fechaFin);
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
        resueltaManual,
        fechaConfirmada: (i as any).fechaConfirmada === true
      }, i.fechaFinProgramada || (i as any).fechaFin);
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
        resueltaManual,
        fechaConfirmada: (u as any).fechaConfirmada === true
      }, u.fechaFinProgramada || (u as any).fechaFin);
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

    const { modulo, rawDocId, sigla, fechaInicio, fechaFin } = draggedEvento;
    setDraggedEvento(null);

    // Si la tarea tiene rango de varios días, desplazar inicio y fin manteniendo la duración
    let newStartIso = targetIso;
    let newEndIso = '';
    if (fechaInicio && fechaFin && fechaFin > fechaInicio) {
      const [sy, sm, sd] = sourceIso.split('-').map(Number);
      const [ty, tm, td] = targetIso.split('-').map(Number);
      const deltaMs = new Date(ty, tm - 1, td).getTime() - new Date(sy, sm - 1, sd).getTime();
      const deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24));

      const [iy, im, id] = fechaInicio.split('-').map(Number);
      const dtStart = new Date(iy, im - 1, id);
      dtStart.setDate(dtStart.getDate() + deltaDays);
      newStartIso = formatDateIso(dtStart);

      const [fy, fm, fd] = fechaFin.split('-').map(Number);
      const dtEnd = new Date(fy, fm - 1, fd);
      dtEnd.setDate(dtEnd.getDate() + deltaDays);
      newEndIso = formatDateIso(dtEnd);
    }

    // Mantenimientos / Planificación: actualiza fechaProgramada en DD-MM-YYYY
    if (modulo === 'Mantenimientos' || sigla === 'Rev.') {
      const parts = newStartIso.split('-'); // [YYYY, MM, DD]
      const planificacionDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY

      setPartes((prev) =>
        prev.map((p) => {
          const docId = (p as any)._docId || p.id;
          if (docId === rawDocId) {
            return { ...p, fechaProgramada: planificacionDateStr, ...(newEndIso ? { fechaFinProgramada: newEndIso } : {}) };
          }
          return p;
        })
      );

      try {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
        const updated = stored.map((p: any) => {
          const docId = p._docId || p.id;
          if (docId === rawDocId) {
            return { ...p, fechaProgramada: planificacionDateStr, ...(newEndIso ? { fechaFinProgramada: newEndIso } : {}) };
          }
          return p;
        });
        localStorage.setItem('firecheck_db_partes', JSON.stringify(updated));
      } catch {}

      try {
        await updateParte(rawDocId, { fechaProgramada: planificacionDateStr, ...(newEndIso ? { fechaFinProgramada: newEndIso } : {}) });
      } catch (err) {
        console.error('Error al mover revisión en Firestore:', err);
      }
    } else if (modulo === 'Reparaciones' || sigla === 'Rep.') {
      const patch = { fecha: newStartIso, ...(newEndIso ? { fechaFinProgramada: newEndIso } : {}) };
      setReparaciones((prev) =>
        prev.map((r) => {
          const docId = (r as any)._docId || r.id;
          if (docId === rawDocId) {
            return { ...r, ...patch };
          }
          return r;
        })
      );

      try {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_reparaciones') || '[]');
        const updated = stored.map((r: any) => {
          const docId = r._docId || r.id;
          if (docId === rawDocId) {
            return { ...r, ...patch };
          }
          return r;
        });
        localStorage.setItem('firecheck_db_reparaciones', JSON.stringify(updated));
      } catch {}

      try {
        await updateReparacion(rawDocId, patch);
      } catch (err) {
        console.error('Error al mover reparación en Firestore:', err);
      }
    } else if (modulo === 'Instalaciones' || sigla === 'Inst.') {
      const patch = { fecha: newStartIso, ...(newEndIso ? { fechaFinProgramada: newEndIso } : {}) };
      setInstalaciones((prev) =>
        prev.map((i) => {
          const docId = (i as any)._docId || i.id;
          if (docId === rawDocId) {
            return { ...i, ...patch };
          }
          return i;
        })
      );

      try {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_instalaciones') || '[]');
        const updated = stored.map((i: any) => {
          const docId = i._docId || i.id;
          if (docId === rawDocId) {
            return { ...i, ...patch };
          }
          return i;
        });
        localStorage.setItem('firecheck_db_instalaciones', JSON.stringify(updated));
      } catch {}

      try {
        await updateInstalacion(rawDocId, patch);
      } catch (err) {
        console.error('Error al mover instalación en Firestore:', err);
      }
    } else if (modulo === 'Urgencias' || sigla === 'Urg.') {
      const patch = { fecha: newStartIso, ...(newEndIso ? { fechaFinProgramada: newEndIso } : {}) };
      setUrgencias((prev) =>
        prev.map((u) => {
          const docId = (u as any)._docId || u.id;
          if (docId === rawDocId) {
            return { ...u, ...patch };
          }
          return u;
        })
      );

      try {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_urgencias') || '[]');
        const updated = stored.map((u: any) => {
          const docId = u._docId || u.id;
          if (docId === rawDocId) {
            return { ...u, ...patch };
          }
          return u;
        });
        localStorage.setItem('firecheck_db_urgencias', JSON.stringify(updated));
      } catch {}

      try {
        await updateUrgencia(rawDocId, patch);
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

  // Guardar Estado, Nota, Rango de Fecha Programada y Fecha Confirmada editados desde el modal del Calendario
  const handleGuardarCambiosEvento = async (ev: EventoCalendario, overrideEstado?: string) => {
    const { rawDocId, modulo, id: evId } = ev;
    if (!rawDocId || modulo === 'Festivo') return;

    const cleanId = (evId || '').replace(/^(parte|rep|inst|urg)-/, '');
    const matchesItem = (it: any) => {
      if (!it) return false;
      return (
        it._docId === rawDocId ||
        it.id === rawDocId ||
        (cleanId && (it.id === cleanId || it._docId === cleanId))
      );
    };

    const notaTrimmed = editNota.trim();
    const nuevoEstado = overrideEstado || editEstado || ev.estado || 'Pendiente';
    const confirmadaVal = !!editFechaConfirmada;
    const startIso = editFechaInicio || ev.fechaInicio || ev.fecha;
    const endIso = editFechaFin && editFechaFin > startIso ? editFechaFin : '';

    const persistLocal = (key: string, updater: (it: any) => any) => {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(stored)) {
          localStorage.setItem(key, JSON.stringify(stored.map((it: any) => (matchesItem(it) ? updater(it) : it))));
        }
      } catch {}
    };

    setGuardandoCambios(true);
    try {
      if (modulo === 'Reparaciones') {
        const patch = {
          estado: nuevoEstado as any,
          nota: notaTrimmed,
          observaciones: notaTrimmed,
          fechaConfirmada: confirmadaVal,
          fecha: startIso,
          fechaFinProgramada: endIso,
          fechaFin: endIso
        } as any;
        setReparaciones((prev) => prev.map((it) => (matchesItem(it) ? { ...it, ...patch } : it)));
        persistLocal('firecheck_db_reparaciones', (it) => ({ ...it, ...patch }));
        await updateReparacion(rawDocId, patch);
      } else if (modulo === 'Instalaciones') {
        const patch = {
          estado: nuevoEstado as any,
          nota: notaTrimmed,
          observaciones: notaTrimmed,
          fechaConfirmada: confirmadaVal,
          fecha: startIso,
          fechaFinProgramada: endIso,
          fechaFin: endIso
        } as any;
        setInstalaciones((prev) => prev.map((it) => (matchesItem(it) ? { ...it, ...patch } : it)));
        persistLocal('firecheck_db_instalaciones', (it) => ({ ...it, ...patch }));
        await updateInstalacion(rawDocId, patch);
      } else if (modulo === 'Urgencias') {
        const patch = {
          estado: nuevoEstado as any,
          nota: notaTrimmed,
          observaciones: notaTrimmed,
          fechaConfirmada: confirmadaVal,
          fecha: startIso,
          fechaFinProgramada: endIso,
          fechaFin: endIso
        } as any;
        setUrgencias((prev) => prev.map((it) => (matchesItem(it) ? { ...it, ...patch } : it)));
        persistLocal('firecheck_db_urgencias', (it) => ({ ...it, ...patch }));
        await updateUrgencia(rawDocId, patch);
      } else if (modulo === 'Mantenimientos') {
        const parts = startIso.split('-');
        const planificacionDateStr = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : startIso;
        const patch = {
          estado: nuevoEstado as any,
          observacionesTecnico: notaTrimmed,
          fechaConfirmada: confirmadaVal,
          fechaProgramada: planificacionDateStr,
          fechaFinProgramada: endIso,
          fechaFin: endIso
        } as any;
        setPartes((prev) => prev.map((it) => (matchesItem(it) ? { ...it, ...patch } : it)));
        persistLocal('firecheck_db_partes', (it) => ({ ...it, ...patch }));
        await updateParte(rawDocId, patch);
      }
    } catch (err) {
      console.error('Error al guardar estado y nota desde el Calendario:', err);
    } finally {
      setGuardandoCambios(false);
      setSelectedEvento(null);
    }
  };

  // Guardar como Finalizado y navegar a Albaranes para firmar y terminar el albarán de la tarea
  const handleIrAAlbaranDesdeCalendario = async (ev: EventoCalendario) => {
    setShowConfirmAlbaranModal(false);
    await handleGuardarCambiosEvento(ev, 'Finalizado');
    setSelectedDayModal(null);

    const { rawDocId, modulo, id: evId } = ev;
    const cleanId = (evId || '').replace(/^(parte|rep|inst|urg)-/, '');
    const matchById = (val?: string) => Boolean(val && (val === rawDocId || (cleanId && val === cleanId)));

    const targetRoute = modulo === 'Mantenimientos' ? '/albaranes-revision' : '/albaranes-trabajo';

    const existingAlbaran = albaranes.find((alb) => {
      if (modulo === 'Mantenimientos') return matchById(alb.parteId);
      if (modulo === 'Reparaciones') return matchById(alb.reparacionId);
      if (modulo === 'Instalaciones') return matchById(alb.instalacionId);
      if (modulo === 'Urgencias') return matchById(alb.urgenciaId);
      return false;
    });

    if (existingAlbaran) {
      navigate(targetRoute, {
        state: {
          editAlbaranId: existingAlbaran.id || (existingAlbaran as any)._docId
        }
      });
      return;
    }

    const sourceList: any[] =
      modulo === 'Mantenimientos'
        ? partes
        : modulo === 'Reparaciones'
        ? reparaciones
        : modulo === 'Instalaciones'
        ? instalaciones
        : modulo === 'Urgencias'
        ? urgencias
        : [];

    const rawItem = sourceList.find(
      (it) =>
        it._docId === rawDocId ||
        it.id === rawDocId ||
        (cleanId && (it.id === cleanId || it._docId === cleanId))
    );

    const centroObj = centros.find(
      (c) =>
        (rawItem?.centroId && c.id === rawItem.centroId) ||
        (ev.lugar && c.nombre?.trim().toLowerCase() === ev.lugar.trim().toLowerCase())
    );
    const clienteObj = clientes.find(
      (cl) =>
        ((rawItem?.clienteId || centroObj?.clienteId) && cl.id === (rawItem?.clienteId || centroObj?.clienteId)) ||
        (ev.cliente && cl.nombre?.trim().toLowerCase() === ev.cliente.trim().toLowerCase())
    );
    const tecnicoObj = tecnicos.find(
      (t) =>
        (rawItem?.tecnicoId && t.id === rawItem.tecnicoId) ||
        (ev.tecnico && t.nombre?.trim().toLowerCase() === ev.tecnico.trim().toLowerCase())
    );

    const empresaId = rawItem?.empresaId || centroObj?.empresaId || obtenerEmpresaPorDefecto() || '';
    const concepto = ev.tituloCompleto || ev.lugar || '';
    const descripcion = (editNota || ev.detalles || rawItem?.observaciones || rawItem?.nota || '').trim();

    navigate(targetRoute, {
      state: {
        prefillAlbaran: {
          empresaId,
          clienteId: clienteObj?.id || rawItem?.clienteId || '',
          clienteNombreLibre: !clienteObj?.id ? ev.cliente || '' : '',
          centroId: centroObj?.id || rawItem?.centroId || '',
          centroNombreLibre: !centroObj?.id ? ev.lugar || '' : '',
          tecnicoId: tecnicoObj?.id || rawItem?.tecnicoId || (tecnicos[0]?.id || ''),
          numeroPedido: rawItem?.numeroPedido || rawItem?.pedidoId || '',
          titulo: concepto,
          reparacionId: modulo === 'Reparaciones' ? rawDocId : '',
          instalacionId: modulo === 'Instalaciones' ? rawDocId : '',
          urgenciaId: modulo === 'Urgencias' ? rawDocId : '',
          parteId: modulo === 'Mantenimientos' ? rawDocId : '',
          fechaCreacion: ev.fecha ? `${ev.fecha}T10:00:00.000Z` : new Date().toISOString(),
          items: [
            {
              cantidad: 1,
              concepto,
              descripcion,
              precioUnidad: 0,
              subtotal: 0
            }
          ]
        }
      }
    });
  };

  const isSuperAdmin =
    (user?.rol || '').toLowerCase().replace(/[^a-z]/g, '') === 'superadministrador';
  const workerName =
    [user?.nombre, user?.apellidos].filter(Boolean).join(' ').trim() || user?.usuario || 'Usuario';
  const aprobadasVac = vacacionesSolicitudes.filter((s) => s.estado === 'aprobada');

  if (calendarTab !== 'tareas') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-2 sm:p-4 lg:p-5">
        {calendarTab === 'laboral' ? (
          <CalendarioLaboral workerName={workerName} vacacionesAprobadas={aprobadasVac} />
        ) : (
          <CalendarioVacaciones
            user={user}
            solicitudes={vacacionesSolicitudes}
            isSuperAdmin={isSuperAdmin}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen bg-[#F8FAFC] flex flex-col p-2 sm:p-4 lg:p-5 select-none overflow-hidden">
      {/* Barra de cabecera del Calendario */}
      <div className="bg-white rounded-2xl border border-slate-200/80 px-3 py-2.5 sm:px-5 sm:py-3.5 shadow-sm mb-2.5 sm:mb-3 shrink-0">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-2.5 sm:gap-4">
          <div className="w-full xl:w-auto text-left">
            <div>
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight capitalize truncate">
                    {MESES[month]} {year}
                  </h1>
                  {isCurrentMonth && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase bg-red-600 text-white tracking-wider shadow-sm shrink-0">
                      Mes en curso
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                Calendario unificado de todas las tareas.
              </p>
            </div>
          </div>

          {/* Botones de filtrado y acciones */}
          <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center justify-between xl:justify-end gap-2 w-full xl:w-auto min-w-0">
            {/* Desplegable de Tipos de Tareas en Móvil (< md) */}
            {(() => {
              const tiposOpciones = [
                { key: 'revisiones' as const, short: 'Rev.', label: 'Revisiones', count: statsMes.mantCount, dotClass: 'bg-amber-500', badgeClass: 'bg-amber-50 text-amber-900 border-amber-300' },
                { key: 'reparaciones' as const, short: 'Rep.', label: 'Reparaciones', count: statsMes.repCount, dotClass: 'bg-sky-500', badgeClass: 'bg-sky-50 text-sky-900 border-sky-300' },
                { key: 'instalaciones' as const, short: 'Inst.', label: 'Instalaciones', count: statsMes.instCount, dotClass: 'bg-red-500', badgeClass: 'bg-red-50 text-red-900 border-red-300' },
                { key: 'urgencias' as const, short: 'Urg.', label: 'Urgencias', count: statsMes.urgCount, dotClass: 'bg-black', badgeClass: 'bg-zinc-900 text-white border-zinc-950' },
              ];
              const activosCount = tiposOpciones.filter((t) => filtrosVisibles[t.key]).length;
              const resumenTexto =
                activosCount === 4
                  ? 'Tipos de tareas (Todas)'
                  : activosCount === 0
                  ? 'Tipos de tareas (Ninguna)'
                  : `Tipos: ${tiposOpciones.filter((t) => filtrosVisibles[t.key]).map((t) => t.short).join(' ')} (${activosCount}/4)`;

              return (
                <div className="relative md:hidden w-full" ref={tiposDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowTiposDropdown((prev) => !prev)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-between gap-2 shadow-2xs cursor-pointer"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{resumenTexto}</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${showTiposDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showTiposDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
                      {tiposOpciones.map((op) => {
                        const active = filtrosVisibles[op.key];
                        return (
                          <button
                            key={op.key}
                            type="button"
                            onClick={() => toggleFiltro(op.key)}
                            className={`w-full px-3.5 py-2.5 text-left text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              active ? 'bg-slate-50/80 text-slate-900' : 'text-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${active ? op.dotClass : 'bg-slate-300'}`} />
                              <span className={active ? '' : 'line-through'}>{op.label} ({op.count})</span>
                            </span>
                            <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              active ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {active && <Check className="w-3 h-3" />}
                            </span>
                          </button>
                        );
                      })}
                      {activosCount < 4 && (
                        <div className="border-t border-slate-100 mt-1 pt-1 px-2">
                          <button
                            type="button"
                            onClick={() => {
                              setFiltrosVisibles({ revisiones: true, reparaciones: true, instalaciones: true, urgencias: true });
                              setShowTiposDropdown(false);
                            }}
                            className="w-full py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            Mostrar todas
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Leyenda y Conteo de Etiquetas con Filtros Interactivos en Tablet/Escritorio (>= md) */}
            <div className="hidden md:flex items-center gap-2 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => toggleFiltro('revisiones')}
                className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
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
                className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
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
                className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
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
                className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
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

            <div className="hidden md:block h-5 w-px bg-slate-200 shrink-0 mx-0.5" />

            {/* Botones de Hoy, Finde y selector de mes compacto */}
            <div className="flex items-center justify-between md:justify-end gap-1.5 sm:gap-2 w-full md:w-auto shrink-0 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <button
                  type="button"
                  onClick={handleToday}
                  className="h-8 sm:h-9 inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                  <span>Hoy</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMostrarFinSemana((prev) => !prev)}
                  className={`h-8 sm:h-9 inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 rounded-xl border text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap ${
                    mostrarFinSemana
                      ? 'border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                  title={mostrarFinSemana ? 'Ocultar sábado y domingo' : 'Mostrar sábado y domingo'}
                >
                  <CalendarDays className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${mostrarFinSemana ? 'text-amber-700' : 'text-slate-500'}`} />
                  <span className="sm:hidden">{mostrarFinSemana ? 'Sin Finde' : 'Finde'}</span>
                  <span className="hidden sm:inline">{mostrarFinSemana ? 'Ocultar Finde' : 'Mostrar Finde'}</span>
                </button>
              </div>

              <div className="h-8 sm:h-9 inline-flex items-center bg-slate-100 px-0.5 sm:px-1 rounded-xl border border-slate-200/80 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                  title="Mes anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <span className="px-1.5 sm:px-2.5 text-[11px] sm:text-xs font-black text-slate-700 min-w-[40px] sm:min-w-[70px] text-center capitalize select-none">
                  {MESES[month].slice(0, 3)}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                  title="Mes siguiente"
                >
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor del Calendario a toda la pantalla */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-h-0">
        {/* Cabecera con Días de la Semana */}
        <div className={`grid ${mostrarFinSemana ? 'grid-cols-7' : 'grid-cols-5'} border-b border-zinc-300 bg-zinc-200/90 divide-x divide-zinc-300/60 text-center text-xs font-black uppercase tracking-wider py-3 shrink-0`}>
          {diasSemanaCabecera.map((dia, idx) => (
            <div key={dia} className={idx >= 5 ? 'text-red-600 font-black' : 'text-zinc-800 font-black'}>
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
                {/* Cabecera del día (clic en el número o cabecera abre todas las tareas del día) */}
                <div
                  onClick={() => setSelectedDayModal({ iso: d.iso, date: d.date })}
                  className="flex items-center justify-between mb-1 shrink-0 cursor-pointer group"
                  title="Haz clic para ver todas las tareas de este día"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDayModal({ iso: d.iso, date: d.date });
                    }}
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[11px] sm:text-xs font-black transition-transform group-hover:scale-110 active:scale-95 cursor-pointer ${
                      isToday
                        ? 'bg-red-600 text-white shadow-xs shadow-red-500/30'
                        : d.currentMonth
                        ? 'border border-red-500 text-slate-900 bg-transparent hover:bg-red-50'
                        : 'text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {d.dayNumber}
                  </button>
                  {eventosDia.length > 0 && (
                    <span
                      title={`${eventosDia.length} ${eventosDia.length === 1 ? 'tarea' : 'tareas'}`}
                      className="text-[10px] sm:text-[11px] font-black text-blue-500 select-none pr-0.5 leading-none"
                    >
                      {eventosDia.length}
                    </span>
                  )}
                </div>

                {/* Lista de etiquetas arrastrables */}
                <div className="flex-1 flex flex-col gap-0.5 sm:gap-1 overflow-y-auto pr-0.5 custom-calendar-scroll [scrollbar-color:#000000_transparent] [scrollbar-width:thin] min-h-0">
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
                            : `${ev.fechaConfirmada ? '* ' : ''}${ev.sigla} ${ev.clienteResumido}${ev.poblacion ? ` [${ev.poblacion}]` : ''}${ev.fechaConfirmada ? ' · Fecha confirmada' : ''}${ev.completado ? ' · Completada (Albarán generado)' : ''} (Arrastra a otro día para reprogramar o haz clic para ver detalles)`
                        }
                      >
                        <span className="font-extrabold tracking-tight shrink-0 inline-flex items-center">
                          {ev.fechaConfirmada && (
                            <span className="text-[14px] leading-none font-black mr-1">*</span>
                          )}
                          <span>{ev.sigla}</span>
                        </span>
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

      {/* Modal ampliado con todas las tareas del día seleccionado (ideal para móvil y días con muchas tareas) */}
      {selectedDayModal && (() => {
        const todosDelDia = eventosPorFecha[selectedDayModal.iso] || [];
        const eventosDelDia = todosDelDia.filter((ev) => {
          if (ev.sigla === 'Rev.' && !filtrosVisibles.revisiones) return false;
          if (ev.sigla === 'Rep.' && !filtrosVisibles.reparaciones) return false;
          if (ev.sigla === 'Inst.' && !filtrosVisibles.instalaciones) return false;
          if (ev.sigla === 'Urg.' && !filtrosVisibles.urgencias) return false;
          return true;
        });
        const fechaFormateada = selectedDayModal.date.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        return (
          <div
            onClick={() => setSelectedDayModal(null)}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs pt-16 pb-4 px-3 sm:p-4 animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[75dvh] sm:max-h-[82vh]"
            >
              {/* Cabecera */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-red-600 text-white font-black text-sm shadow-xs shrink-0">
                      {selectedDayModal.date.getDate()}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 capitalize truncate">
                        {fechaFormateada}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500">
                        {eventosDelDia.length} {eventosDelDia.length === 1 ? 'tarea programada' : 'tareas programadas'}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDayModal(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer shrink-0"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lista de tareas del día */}
              <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-2.5">
                {eventosDelDia.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-500">No hay tareas para este día</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Las tareas asignadas o filtradas aparecerán aquí.
                    </p>
                  </div>
                ) : (
                  eventosDelDia.map((ev) => {
                    const isFestivo = ev.modulo === 'Festivo';
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setSelectedEvento(ev)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all shadow-2xs hover:shadow-md active:scale-[0.99] cursor-pointer flex flex-col gap-1.5 ${ev.colorTag}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-2 py-0.5 rounded-md bg-white/80 font-black text-[11px] uppercase tracking-tight shrink-0 border border-current/20">
                              {ev.sigla}
                            </span>
                            <span className="font-black text-sm truncate">
                              {ev.fechaConfirmada ? '* ' : ''}{ev.clienteResumido}
                            </span>
                          </div>
                          {ev.estado && !isFestivo && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-current/20 shrink-0">
                              {ev.estado}
                            </span>
                          )}
                        </div>
                        {ev.tituloCompleto && ev.tituloCompleto !== ev.clienteResumido && (
                          <p className="text-xs font-semibold opacity-90 leading-snug">
                            {ev.tituloCompleto}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] opacity-80 font-medium">
                          {(ev.lugar || ev.poblacion) && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {[ev.lugar, ev.poblacion].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          {ev.tecnico && (
                            <span className="inline-flex items-center gap-1">
                              <User className="w-3 h-3 shrink-0" />
                              {ev.tecnico}
                            </span>
                          )}
                          {ev.completado && (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              Completada
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Pie */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedDayModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal flotante de Solo Lectura con todos los detalles del trabajo */}
      {selectedEvento && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col">
            {/* Cabecera del modal */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${selectedEvento.colorBadge}`}>
                  <selectedEvento.icono className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center ${selectedEvento.colorTag}`}>
                      {editFechaConfirmada && (
                        <span className="text-[13px] leading-none font-black mr-1">*</span>
                      )}
                      <span>{selectedEvento.sigla} {selectedEvento.modulo}</span>
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
            <div className="p-5 space-y-3.5 text-xs text-slate-600 max-h-[70vh] overflow-y-auto">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <CalendarDays className="w-4 h-4 text-red-500 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-600 font-bold block uppercase">Fecha programada</span>
                      <span className="font-extrabold text-slate-800 text-sm">
                        {(editFechaInicio || selectedEvento.fecha).split('-').reverse().join('/')}
                        {editFechaFin && editFechaFin > (editFechaInicio || selectedEvento.fecha) && (
                          <span className="text-red-600">
                            {' '}al {editFechaFin.split('-').reverse().join('/')}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {selectedEvento.modulo !== 'Festivo' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMostrarAmpliarRango((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all cursor-pointer shadow-2xs ${
                          mostrarAmpliarRango || (editFechaFin && editFechaFin > editFechaInicio)
                            ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title="Ampliar rango de fecha programada para que la tarea se repita varios días en el calendario"
                      >
                        <CalendarDays className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span>Ampliar rango de fecha programada</span>
                      </button>

                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-white hover:bg-slate-50 border-slate-200 cursor-pointer select-none shadow-2xs transition-all">
                        <input
                          type="checkbox"
                          checked={editFechaConfirmada}
                          onChange={(e) => setEditFechaConfirmada(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                        />
                        <span className={`text-xs font-extrabold ${editFechaConfirmada ? 'text-emerald-700' : 'text-slate-700'}`}>
                          Fecha confirmada
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {selectedEvento.modulo !== 'Festivo' && mostrarAmpliarRango && (
                  <div className="pt-2.5 border-t border-slate-200/80 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider">
                        Ampliar rango de fecha programada
                      </span>
                      {editFechaFin && editFechaFin > editFechaInicio && (
                        <button
                          type="button"
                          onClick={() => setEditFechaFin(editFechaInicio)}
                          className="text-[10px] font-bold text-slate-500 hover:text-red-600 underline cursor-pointer"
                        >
                          Dejar en 1 solo día
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Desde (Fecha inicio)
                        </label>
                        <input
                          type="date"
                          value={editFechaInicio}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditFechaInicio(val);
                            if (!editFechaFin || val > editFechaFin) {
                              setEditFechaFin(val);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Hasta (Fecha fin)
                        </label>
                        <input
                          type="date"
                          value={editFechaFin}
                          min={editFechaInicio}
                          onChange={(e) => setEditFechaFin(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                    {editFechaFin && editFechaFin > editFechaInicio && (
                      <p className="text-[11px] font-semibold text-red-700 bg-red-50/80 border border-red-200/80 rounded-lg px-2.5 py-1">
                        La tarea se repetirá en el calendario del{' '}
                        <span className="font-extrabold">{editFechaInicio.split('-').reverse().join('/')}</span> al{' '}
                        <span className="font-extrabold">{editFechaFin.split('-').reverse().join('/')}</span>. Al finalizarse, todos los días quedarán como realizados.
                      </p>
                    )}
                  </div>
                )}
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

                    <div className="pt-2 border-t border-slate-200/60 flex flex-col items-start gap-2">
                      {selectedEvento.poblacion && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-md text-[10px] font-bold break-words max-w-full">
                          📍 {selectedEvento.poblacion}
                        </span>
                      )}
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer group"
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

              {selectedEvento.modulo === 'Festivo' ? (
                <>
                  {selectedEvento.estado && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-600 font-bold uppercase">Estado</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-800 shadow-xs">
                        {selectedEvento.estado}
                      </span>
                    </div>
                  )}
                  {selectedEvento.detalles && (
                    <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/70 text-amber-900">
                      <span className="text-[10px] text-amber-800 font-bold block uppercase mb-1">Notas / Observaciones</span>
                      <p className="whitespace-pre-wrap font-medium">{selectedEvento.detalles}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-600 font-bold uppercase">Estado</span>
                      {selectedEvento.completado && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                          {selectedEvento.resueltaManual ? 'Resuelta manualmente' : 'Albarán generado'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {(['Pendiente', 'En curso', 'Parado', 'Finalizado'] as const).map((est) => {
                        const isSelected = editEstado === est;
                        const activeColors =
                          est === 'Pendiente'
                            ? 'bg-slate-200 text-slate-900 border-slate-500 ring-2 ring-slate-400/30'
                            : est === 'En curso'
                            ? 'bg-amber-100 text-amber-900 border-amber-500 ring-2 ring-amber-400/30'
                            : est === 'Parado'
                            ? 'bg-red-100 text-red-900 border-red-500 ring-2 ring-red-400/30'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-500 ring-2 ring-emerald-400/30';
                        const inactiveColors =
                          'bg-white hover:bg-slate-100 text-slate-600 border-slate-200';
                        return (
                          <button
                            key={est}
                            type="button"
                            onClick={() => {
                              setEditEstado(est);
                              if (est === 'Finalizado' && selectedEvento.modulo !== 'Festivo') {
                                setShowConfirmAlbaranModal(true);
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer text-center ${
                              isSelected ? activeColors : inactiveColors
                            }`}
                          >
                            {est}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80 text-amber-900 space-y-1.5">
                    <span className="text-[10px] text-amber-800 font-bold block uppercase">
                      Notas / Observaciones
                    </span>
                    <textarea
                      rows={3}
                      value={editNota}
                      onChange={(e) => setEditNota(e.target.value)}
                      placeholder="Escribe aquí cualquier nota o comentario sobre esta tarea..."
                      className="w-full rounded-lg bg-white/90 border border-amber-300/80 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 p-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none resize-y"
                    />
                  </div>
                </>
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
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all cursor-pointer"
              >
                Cerrar
              </button>
              {selectedEvento.modulo !== 'Festivo' && (
                <button
                  type="button"
                  disabled={guardandoCambios}
                  onClick={() => handleGuardarCambiosEvento(selectedEvento)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {guardandoCambios ? 'Guardando...' : 'Guardar cambios'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para hacer el albarán al pulsar Finalizado */}
      {showConfirmAlbaranModal && selectedEvento && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowConfirmAlbaranModal(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ReceiptText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 leading-snug">
                ¿Quieres hacer el albarán de esta tarea?
              </h3>
              <p className="text-xs font-medium text-slate-500 line-clamp-2">
                {selectedEvento.tituloCompleto || selectedEvento.lugar}
              </p>
            </div>
            <div className="px-6 pb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmAlbaranModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                disabled={guardandoCambios}
                onClick={() => handleIrAAlbaranDesdeCalendario(selectedEvento)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-60"
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-calendar-scroll {
          scrollbar-width: thin;
          scrollbar-color: #000000 transparent;
        }
        .custom-calendar-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-calendar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-calendar-scroll::-webkit-scrollbar-thumb {
          background: #000000;
          border-radius: 9999px;
        }
        .custom-calendar-scroll::-webkit-scrollbar-thumb:hover {
          background: #27272a;
        }
      `}</style>
    </div>
  );
}
