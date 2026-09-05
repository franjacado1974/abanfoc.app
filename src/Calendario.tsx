import { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
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
  Briefcase
} from 'lucide-react';
import {
  subscribePartes,
  updateParte,
  subscribeReparaciones,
  updateReparacion,
  subscribeInstalaciones,
  updateInstalacion,
  subscribeCentros,
  subscribeClientes,
  type ParteFirestore,
  type ReparacionItem,
  type InstalacionItem
} from './firebase';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export interface EventoCalendario {
  id: string;
  rawDocId: string;
  sigla: 'Rev.' | 'Rep.' | 'Inst.';
  clienteResumido: string;
  tituloCompleto: string;
  lugar?: string;
  cliente?: string;
  tecnico?: string;
  comercial?: string;
  estado?: string;
  fecha: string; // YYYY-MM-DD
  modulo: 'Mantenimientos' | 'Reparaciones' | 'Instalaciones';
  tipoBadge: string;
  colorTag: string;
  colorBadge: string;
  icono: typeof ClipboardCheck;
  detalles?: string;
}

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [partes, setPartes] = useState<ParteFirestore[]>([]);
  const [reparaciones, setReparaciones] = useState<ReparacionItem[]>([]);
  const [instalaciones, setInstalaciones] = useState<InstalacionItem[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [selectedEvento, setSelectedEvento] = useState<EventoCalendario | null>(null);
  const [mostrarFinSemana, setMostrarFinSemana] = useState(false);

  // Estados para Drag & Drop entre días
  const [draggedEvento, setDraggedEvento] = useState<EventoCalendario | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

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

    // 1. Mantenimientos: "Rev. [Centro]"
    partes.forEach((p) => {
      if (!p.fechaProgramada || p.estado === 'Cerrado') return;
      const c = centros.find((cent) => (cent._docId || cent.id) === p.centroId);
      const cl = clientes.find((cli) => (cli._docId || cli.id) === (p.clienteId || c?.clienteId));
      const tec = tecnicos.find((t) => (t._docId || t.id) === p.tecnicoId);

      // Priorizar incondicionalmente el nombre del centro para la etiqueta del calendario
      const nombreCentro = p.nombreCentro || c?.nombre || cl?.nombre || 'Centro';

      addEvento(p.fechaProgramada, {
        id: `parte-${p.id || (p as any)._docId}`,
        rawDocId: (p as any)._docId || p.id,
        sigla: 'Rev.',
        clienteResumido: nombreCentro,
        tituloCompleto: p.nombreCentro || c?.nombre || 'Revisión Mantenimiento',
        lugar: c?.nombre ? `${c.nombre} (${c.direccion || ''})` : c?.direccion,
        cliente: cl?.nombre,
        tecnico: tec?.nombre ? `${tec.nombre} ${tec.apellidos || ''}` : undefined,
        comercial: (p as any).comercial || (c as any)?.comercial || undefined,
        estado: p.estado || 'Planificado',
        fecha: p.fechaProgramada,
        modulo: 'Mantenimientos',
        tipoBadge: p.periodicidad ? `Revisión ${p.periodicidad}` : 'Revisión Mantenimiento',
        colorTag: 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200/90',
        colorBadge: 'bg-amber-50 text-amber-800 border-amber-200',
        icono: ClipboardCheck,
        detalles: p.observacionesTecnico || p.comentariosPrivados || undefined
      });
    });

    // 2. Operaciones - Reparaciones: "Rep. [Cliente / Lugar]" (Azul)
    reparaciones.forEach((r) => {
      const fecha = r.fecha || (r.fechaCreacion ? r.fechaCreacion.slice(0, 10) : '');
      if (!fecha) return;

      const c = centros.find((cent) => cent.nombre && r.lugar && cent.nombre.toLowerCase().includes(r.lugar.toLowerCase()));
      const cl = clientes.find((cli) => (cli._docId || cli.id) === c?.clienteId || (cli.nombre && r.lugar && cli.nombre.toLowerCase().includes(r.lugar.toLowerCase())));
      const nombreCliente = cl?.nombre || r.lugar || 'Cliente';

      addEvento(fecha, {
        id: `rep-${r.id || (r as any)._docId}`,
        rawDocId: (r as any)._docId || r.id,
        sigla: 'Rep.',
        clienteResumido: nombreCliente,
        tituloCompleto: r.reparacion || 'Reparación / Avería',
        lugar: r.lugar,
        cliente: cl?.nombre,
        tecnico: r.tecnicoAsignado,
        comercial: r.comercial || (r as any).comercialAsignado || undefined,
        estado: r.estado || 'Pendiente',
        fecha,
        modulo: 'Reparaciones',
        tipoBadge: 'Reparación / Avería',
        colorTag: 'bg-sky-100 text-sky-900 border-sky-300 hover:bg-sky-200/90',
        colorBadge: 'bg-sky-50 text-sky-800 border-sky-200',
        icono: Wrench,
        detalles: r.nota || r.observaciones || undefined
      });
    });

    // 3. Operaciones - Instalaciones: "Inst. [Cliente / Lugar]" (Rojo)
    instalaciones.forEach((i) => {
      const fecha = i.fecha || (i.fechaCreacion ? i.fechaCreacion.slice(0, 10) : '');
      if (!fecha) return;

      const c = centros.find((cent) => cent.nombre && i.lugar && cent.nombre.toLowerCase().includes(i.lugar.toLowerCase()));
      const cl = clientes.find((cli) => (cli._docId || cli.id) === c?.clienteId || (cli.nombre && i.lugar && cli.nombre.toLowerCase().includes(i.lugar.toLowerCase())));
      const nombreCliente = cl?.nombre || i.lugar || 'Cliente';

      addEvento(fecha, {
        id: `inst-${i.id || (i as any)._docId}`,
        rawDocId: (i as any)._docId || i.id,
        sigla: 'Inst.',
        clienteResumido: nombreCliente,
        tituloCompleto: i.instalacion || 'Instalación / Montaje',
        lugar: i.lugar,
        cliente: cl?.nombre,
        tecnico: i.tecnicoAsignado,
        comercial: i.comercial || (i as any).comercialAsignado || undefined,
        estado: i.estado || 'Pendiente',
        fecha,
        modulo: 'Instalaciones',
        tipoBadge: 'Instalación / Montaje',
        colorTag: 'bg-red-100 text-red-900 border-red-300 hover:bg-red-200/90',
        colorBadge: 'bg-red-50 text-red-800 border-red-200',
        icono: HardHat,
        detalles: i.nota || i.observaciones || undefined
      });
    });

    return map;
  }, [partes, reparaciones, instalaciones, centros, clientes, tecnicos]);

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

    days.filter((d) => d.currentMonth).forEach((d) => {
      const evs = eventosPorFecha[d.iso] || [];
      evs.forEach((ev) => {
        if (ev.sigla === 'Rev.') mantCount++;
        else if (ev.sigla === 'Rep.') repCount++;
        else if (ev.sigla === 'Inst.') instCount++;
      });
    });

    return { mantCount, repCount, instCount, total: mantCount + repCount + instCount };
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
    }
  };

  return (
    <div className="h-screen max-h-screen bg-[#F8FAFC] flex flex-col p-3 sm:p-4 lg:p-5 select-none overflow-hidden">
      {/* Barra de cabecera del Calendario */}
      <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm mb-3 shrink-0">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200/60 flex items-center justify-center text-red-600 shadow-sm shrink-0">
              <CalendarIcon className="w-6 h-6 stroke-[2.25]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
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

          {/* Leyenda y Conteo de Etiquetas */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
              <span className="font-extrabold text-amber-700">Rev.</span>
              <span>Revisiones ({statsMes.mantCount})</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-900 border border-sky-300">
              <span className="font-extrabold text-sky-700">Rep.</span>
              <span>Reparaciones ({statsMes.repCount})</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 text-red-900 border border-red-300">
              <span className="font-extrabold text-red-700">Inst.</span>
              <span>Instalaciones ({statsMes.instCount})</span>
            </span>
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

            const eventosDia = eventosPorFecha[d.iso] || [];
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
                  {eventosDia.map((ev) => (
                    <div
                      key={ev.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ev)}
                      onClick={() => setSelectedEvento(ev)}
                      className={`w-full text-left px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] font-bold transition-all cursor-grab active:cursor-grabbing shadow-2xs truncate flex items-center gap-1 active:scale-[0.98] shrink-0 select-none hover:shadow-xs ${ev.colorTag}`}
                      title={`${ev.sigla} ${ev.clienteResumido} (Arrastra a otro día para reprogramar o haz clic para ver detalles)`}
                    >
                      <span className="font-extrabold tracking-tight shrink-0">{ev.sigla}</span>
                      <span className="truncate font-semibold">{ev.clienteResumido}</span>
                    </div>
                  ))}
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

              {selectedEvento.lugar && (
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block uppercase">Lugar / Centro</span>
                    <span className="font-bold text-slate-800">{selectedEvento.lugar}</span>
                  </div>
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
            </div>

            {/* Pie del modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
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
