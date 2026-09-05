import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  ClipboardCheck,
  Wrench,
  HardHat,
  AlertTriangle,
  Calendar,
  Layers,
  Sparkles,
  TrendingUp,
  Activity,
  CheckCircle2,
  Info
} from 'lucide-react';
import {
  subscribePartes,
  subscribeReparaciones,
  subscribeInstalaciones,
  subscribeUrgencias,
  type ParteFirestore,
  type ReparacionItem,
  type InstalacionItem,
  type UrgenciaItem
} from './firebase';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

interface ItemFecha {
  year: number;
  month: number; // 0..11
}

function parseFecha(raw?: string | null): ItemFecha | null {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim();

  // Formato YYYY-MM-DD
  const yyyymmdd = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (yyyymmdd) {
    const y = parseInt(yyyymmdd[1], 10);
    const m = parseInt(yyyymmdd[2], 10) - 1;
    if (m >= 0 && m < 12) return { year: y, month: m };
  }

  // Formato DD-MM-YYYY
  const ddmmyyyy = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (ddmmyyyy) {
    const y = parseInt(ddmmyyyy[3], 10);
    const m = parseInt(ddmmyyyy[2], 10) - 1;
    if (m >= 0 && m < 12) return { year: y, month: m };
  }

  // Formato DD/MM/YYYY
  const ddmmyyyySlash = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyySlash) {
    const y = parseInt(ddmmyyyySlash[3], 10);
    const m = parseInt(ddmmyyyySlash[2], 10) - 1;
    if (m >= 0 && m < 12) return { year: y, month: m };
  }

  return null;
}

export default function Analisis() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [chartType, setChartType] = useState<'agrupadas' | 'apiladas'>('agrupadas');

  // Filtros interactivos de la barra izquierda
  const [showRevisiones, setShowRevisiones] = useState(true);
  const [showReparaciones, setShowReparaciones] = useState(true);
  const [showInstalaciones, setShowInstalaciones] = useState(true);
  const [showUrgencias, setShowUrgencias] = useState(true);

  // Estados de datos
  const [partes, setPartes] = useState<ParteFirestore[]>([]);
  const [reparaciones, setReparaciones] = useState<ReparacionItem[]>([]);
  const [instalaciones, setInstalaciones] = useState<InstalacionItem[]>([]);
  const [urgencias, setUrgencias] = useState<UrgenciaItem[]>([]);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  // Carga inicial y suscripciones en tiempo real
  useEffect(() => {
    const safeParse = (key: string) => {
      try {
        const d = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(d) ? d : [];
      } catch {
        return [];
      }
    };

    setPartes(safeParse('firecheck_db_partes'));
    setReparaciones(safeParse('firecheck_db_reparaciones'));
    setInstalaciones(safeParse('firecheck_db_instalaciones'));
    setUrgencias(safeParse('firecheck_db_urgencias'));

    const unsubPartes = subscribePartes((items) => setPartes(items || []));
    const unsubRep = subscribeReparaciones((items) => setReparaciones(items || []));
    const unsubInst = subscribeInstalaciones((items) => setInstalaciones(items || []));
    const unsubUrg = subscribeUrgencias((items) => setUrgencias(items || []));

    return () => {
      unsubPartes();
      unsubRep();
      unsubInst();
      unsubUrg();
    };
  }, []);

  // Años disponibles detectados en la base de datos
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentYear);
    yearsSet.add(currentYear - 1);

    partes.forEach((p) => {
      const f = parseFecha(p.fechaProgramada || p.fechaCreacion);
      if (f && f.year > 2020 && f.year < 2050) yearsSet.add(f.year);
    });
    reparaciones.forEach((r) => {
      const f = parseFecha(r.fecha || r.fechaCreacion);
      if (f && f.year > 2020 && f.year < 2050) yearsSet.add(f.year);
    });
    instalaciones.forEach((i) => {
      const f = parseFecha(i.fecha || i.fechaCreacion);
      if (f && f.year > 2020 && f.year < 2050) yearsSet.add(f.year);
    });
    urgencias.forEach((u) => {
      const f = parseFecha(u.fecha || u.fechaCreacion);
      if (f && f.year > 2020 && f.year < 2050) yearsSet.add(f.year);
    });

    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [partes, reparaciones, instalaciones, urgencias, currentYear]);

  // Procesar conteos mensuales para el año seleccionado
  const dataMeses = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => ({
      revisiones: 0,
      reparaciones: 0,
      instalaciones: 0,
      urgencias: 0,
      total: 0
    }));

    // 1. Revisiones (Mantenimientos)
    partes.forEach((p) => {
      const f = parseFecha(p.fechaProgramada || p.fechaCreacion);
      if (f && f.year === selectedYear) {
        counts[f.month].revisiones += 1;
      }
    });

    // 2. Reparaciones
    reparaciones.forEach((r) => {
      const f = parseFecha(r.fecha || r.fechaCreacion);
      if (f && f.year === selectedYear) {
        counts[f.month].reparaciones += 1;
      }
    });

    // 3. Instalaciones
    instalaciones.forEach((i) => {
      const f = parseFecha(i.fecha || i.fechaCreacion);
      if (f && f.year === selectedYear) {
        counts[f.month].instalaciones += 1;
      }
    });

    // 4. Urgencias
    urgencias.forEach((u) => {
      const f = parseFecha(u.fecha || u.fechaCreacion);
      if (f && f.year === selectedYear) {
        counts[f.month].urgencias += 1;
      }
    });

    // Totales calculados según series activas
    counts.forEach((m) => {
      let t = 0;
      if (showRevisiones) t += m.revisiones;
      if (showReparaciones) t += m.reparaciones;
      if (showInstalaciones) t += m.instalaciones;
      if (showUrgencias) t += m.urgencias;
      m.total = t;
    });

    return counts;
  }, [partes, reparaciones, instalaciones, urgencias, selectedYear, showRevisiones, showReparaciones, showInstalaciones, showUrgencias]);

  // Totales anuales absolutos (para el panel izquierdo)
  const totalesAnuales = useMemo(() => {
    let rev = 0;
    let rep = 0;
    let inst = 0;
    let urg = 0;

    dataMeses.forEach((m) => {
      rev += m.revisiones;
      rep += m.reparaciones;
      inst += m.instalaciones;
      urg += m.urgencias;
    });

    return {
      revisiones: rev,
      reparaciones: rep,
      instalaciones: inst,
      urgencias: urg,
      totalGeneral: rev + rep + inst + urg,
      totalActivo: (showRevisiones ? rev : 0) + (showReparaciones ? rep : 0) + (showInstalaciones ? inst : 0) + (showUrgencias ? urg : 0)
    };
  }, [dataMeses, showRevisiones, showReparaciones, showInstalaciones, showUrgencias]);

  // Mes con mayor volumen de trabajo
  const peakMonthInfo = useMemo(() => {
    let maxVal = -1;
    let maxMonth = 0;
    dataMeses.forEach((m, idx) => {
      if (m.total > maxVal) {
        maxVal = m.total;
        maxMonth = idx;
      }
    });
    return {
      monthName: MESES[maxMonth],
      count: maxVal > 0 ? maxVal : 0
    };
  }, [dataMeses]);

  // Mes con mayor cantidad de urgencias
  const peakUrgenciasMonth = useMemo(() => {
    let maxVal = -1;
    let maxMonth = 0;
    dataMeses.forEach((m, idx) => {
      if (m.urgencias > maxVal) {
        maxVal = m.urgencias;
        maxMonth = idx;
      }
    });
    return {
      monthName: MESES[maxMonth],
      count: maxVal > 0 ? maxVal : 0
    };
  }, [dataMeses]);

  // Valor máximo para la escala del gráfico
  const maxScaleValue = useMemo(() => {
    if (chartType === 'apiladas') {
      const maxTotal = Math.max(...dataMeses.map((m) => m.total), 1);
      return Math.ceil(maxTotal * 1.15);
    }
    let maxSingle = 1;
    dataMeses.forEach((m) => {
      if (showRevisiones && m.revisiones > maxSingle) maxSingle = m.revisiones;
      if (showReparaciones && m.reparaciones > maxSingle) maxSingle = m.reparaciones;
      if (showInstalaciones && m.instalaciones > maxSingle) maxSingle = m.instalaciones;
      if (showUrgencias && m.urgencias > maxSingle) maxSingle = m.urgencias;
    });
    return Math.ceil(maxSingle * 1.2);
  }, [dataMeses, chartType, showRevisiones, showReparaciones, showInstalaciones, showUrgencias]);

  // Cantidad de series visibles activas
  const activeSeriesCount = (showRevisiones ? 1 : 0) + (showReparaciones ? 1 : 0) + (showInstalaciones ? 1 : 0) + (showUrgencias ? 1 : 0);

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto min-h-screen space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm shrink-0">
            <BarChart3 className="w-6 h-6 stroke-[2.25]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Análisis Operativo</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200">
                {selectedYear}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Estadísticas y gráficos comparativos de Revisiones, Reparaciones, Instalaciones y Urgencias
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de tipo de gráfico */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setChartType('agrupadas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartType === 'agrupadas'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-red-600" />
              <span>Barras Agrupadas</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('apiladas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartType === 'apiladas'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-red-600" />
              <span>Barras Apiladas</span>
            </button>
          </div>

          {/* Selector de Año */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Año {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid Principal: Barra Izquierda (4 opciones) + Gráfico Central */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* BARRA IZQUIERDA: LAS 4 OPCIONES */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Líneas de Trabajo
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {activeSeriesCount}/4 visibles
              </span>
            </div>

            {/* 1. REVISIONES */}
            <div
              onClick={() => setShowRevisiones(!showRevisiones)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                showRevisiones
                  ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${showRevisiones ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <ClipboardCheck className="w-4 h-4 stroke-[2.25]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Revisiones</h4>
                    <span className="text-[10px] text-slate-500 font-medium">Mantenimientos</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showRevisiones}
                  onChange={() => {}}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer pointer-events-none"
                />
              </div>
              <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Total {selectedYear}</span>
                  <span className="text-base font-black text-amber-900">{totalesAnuales.revisiones}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Promedio/mes</span>
                  <span className="text-xs font-bold text-slate-700">
                    {(totalesAnuales.revisiones / 12).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. REPARACIONES */}
            <div
              onClick={() => setShowReparaciones(!showReparaciones)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                showReparaciones
                  ? 'bg-sky-50/70 border-sky-300 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${showReparaciones ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <Wrench className="w-4 h-4 stroke-[2.25]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Reparaciones</h4>
                    <span className="text-[10px] text-slate-500 font-medium">Averías y partes</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showReparaciones}
                  onChange={() => {}}
                  className="w-4 h-4 accent-sky-500 rounded cursor-pointer pointer-events-none"
                />
              </div>
              <div className="mt-2.5 pt-2 border-t border-sky-200/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Total {selectedYear}</span>
                  <span className="text-base font-black text-sky-900">{totalesAnuales.reparaciones}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Promedio/mes</span>
                  <span className="text-xs font-bold text-slate-700">
                    {(totalesAnuales.reparaciones / 12).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. INSTALACIONES */}
            <div
              onClick={() => setShowInstalaciones(!showInstalaciones)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                showInstalaciones
                  ? 'bg-red-50/70 border-red-300 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${showInstalaciones ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <HardHat className="w-4 h-4 stroke-[2.25]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Instalaciones</h4>
                    <span className="text-[10px] text-slate-500 font-medium">Montajes y obras</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showInstalaciones}
                  onChange={() => {}}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer pointer-events-none"
                />
              </div>
              <div className="mt-2.5 pt-2 border-t border-red-200/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Total {selectedYear}</span>
                  <span className="text-base font-black text-red-900">{totalesAnuales.instalaciones}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Promedio/mes</span>
                  <span className="text-xs font-bold text-slate-700">
                    {(totalesAnuales.instalaciones / 12).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. URGENCIAS */}
            <div
              onClick={() => setShowUrgencias(!showUrgencias)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                showUrgencias
                  ? 'bg-zinc-900 border-zinc-800 text-white shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${showUrgencias ? 'bg-amber-400 text-zinc-950' : 'bg-slate-200 text-slate-500'}`}>
                    <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${showUrgencias ? 'text-amber-300' : 'text-slate-900'}`}>Urgencias</h4>
                    <span className={`text-[10px] font-medium ${showUrgencias ? 'text-zinc-400' : 'text-slate-500'}`}>Avisos prioritarios</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showUrgencias}
                  onChange={() => {}}
                  className="w-4 h-4 accent-amber-400 rounded cursor-pointer pointer-events-none"
                />
              </div>
              <div className={`mt-2.5 pt-2 flex items-center justify-between ${showUrgencias ? 'border-t border-zinc-800' : 'border-t border-slate-200'}`}>
                <div>
                  <span className={`text-[10px] block ${showUrgencias ? 'text-zinc-400' : 'text-slate-500'}`}>Total {selectedYear}</span>
                  <span className={`text-base font-black ${showUrgencias ? 'text-amber-300' : 'text-slate-900'}`}>{totalesAnuales.urgencias}</span>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] block ${showUrgencias ? 'text-zinc-400' : 'text-slate-500'}`}>Promedio/mes</span>
                  <span className={`text-xs font-bold ${showUrgencias ? 'text-zinc-300' : 'text-slate-700'}`}>
                    {(totalesAnuales.urgencias / 12).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta de conclusiones automáticas */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5">
            <div className="flex items-center gap-2 text-red-600">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">Conclusiones Rápidas</span>
            </div>
            <div className="text-xs space-y-2 text-slate-600">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Pico de Actividad</span>
                <p className="font-semibold text-slate-900 mt-0.5">
                  <strong>{peakMonthInfo.monthName}</strong> registró el mayor volumen con <strong>{peakMonthInfo.count}</strong> trabajos.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Mes con más Urgencias</span>
                <p className="font-semibold text-slate-900 mt-0.5">
                  <strong>{peakUrgenciasMonth.monthName}</strong> acumuló <strong>{peakUrgenciasMonth.count}</strong> urgencias.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ÁREA CENTRAL: GRÁFICO COMPARATIVO MENSUAL */}
        <div className="lg:col-span-9 space-y-6">
          {/* Métricas rápidas superiores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Anual Trabajos</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900">{totalesAnuales.totalGeneral}</span>
                <span className="text-xs text-slate-500 font-medium">en {selectedYear}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Promedio Mensual</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900">{(totalesAnuales.totalGeneral / 12).toFixed(1)}</span>
                <span className="text-xs text-slate-500 font-medium">trabajos/mes</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mayor Actividad</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-red-600">{peakMonthInfo.monthName}</span>
                <span className="text-xs font-bold text-slate-500">({peakMonthInfo.count})</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Seleccionado</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900">{totalesAnuales.totalActivo}</span>
                <span className="text-xs text-slate-500 font-medium">filtrados</span>
              </div>
            </div>
          </div>

          {/* Gráfico SVG Responsivo */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-black text-slate-900">Distribución de Trabajos por Mes</h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {showRevisiones && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Revisiones
                  </span>
                )}
                {showReparaciones && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Reparaciones
                  </span>
                )}
                {showInstalaciones && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Instalaciones
                  </span>
                )}
                {showUrgencias && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-black border border-amber-300" /> Urgencias
                  </span>
                )}
              </div>
            </div>

            {/* Lienzo del gráfico SVG */}
            <div className="relative w-full h-80 sm:h-96">
              <svg className="w-full h-full" viewBox="0 0 1000 400" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="gradRevisiones" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                  <linearGradient id="gradReparaciones" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0284c7" />
                    <stop offset="100%" stopColor="#0369a1" />
                  </linearGradient>
                  <linearGradient id="gradInstalaciones" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#b91c1c" />
                  </linearGradient>
                  <linearGradient id="gradUrgencias" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#18181b" />
                    <stop offset="100%" stopColor="#000000" />
                  </linearGradient>
                </defs>

                {/* Líneas de guía horizontales de la cuadrícula */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = 340 - ratio * 300;
                  const val = Math.round(ratio * maxScaleValue);
                  return (
                    <g key={ratio}>
                      <line x1="60" y1={y} x2="980" y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="45" y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8" fontWeight="600">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Eje horizontal base */}
                <line x1="60" y1="340" x2="980" y2="340" stroke="#cbd5e1" strokeWidth="1.5" />

                {/* Barras mensuales */}
                {dataMeses.map((m, idx) => {
                  const colWidth = 920 / 12;
                  const colCenterX = 60 + idx * colWidth + colWidth / 2;
                  const isHovered = hoveredMonth === idx;

                  if (chartType === 'apiladas') {
                    // MODO BARRAS APILADAS
                    const barWidth = Math.min(colWidth * 0.55, 38);
                    let currentH = 0;
                    const segments = [];

                    if (showRevisiones && m.revisiones > 0) {
                      const segH = (m.revisiones / maxScaleValue) * 300;
                      segments.push({ y: 340 - currentH - segH, h: segH, fill: 'url(#gradRevisiones)' });
                      currentH += segH;
                    }
                    if (showReparaciones && m.reparaciones > 0) {
                      const segH = (m.reparaciones / maxScaleValue) * 300;
                      segments.push({ y: 340 - currentH - segH, h: segH, fill: 'url(#gradReparaciones)' });
                      currentH += segH;
                    }
                    if (showInstalaciones && m.instalaciones > 0) {
                      const segH = (m.instalaciones / maxScaleValue) * 300;
                      segments.push({ y: 340 - currentH - segH, h: segH, fill: 'url(#gradInstalaciones)' });
                      currentH += segH;
                    }
                    if (showUrgencias && m.urgencias > 0) {
                      const segH = (m.urgencias / maxScaleValue) * 300;
                      segments.push({ y: 340 - currentH - segH, h: segH, fill: 'url(#gradUrgencias)' });
                      currentH += segH;
                    }

                    return (
                      <g
                        key={idx}
                        onMouseEnter={() => setHoveredMonth(idx)}
                        onMouseLeave={() => setHoveredMonth(null)}
                        className="cursor-pointer"
                      >
                        {/* Fondo resaltado en hover */}
                        {isHovered && (
                          <rect
                            x={colCenterX - colWidth / 2}
                            y="40"
                            width={colWidth}
                            height="300"
                            fill="#f8fafc"
                            opacity="0.8"
                            rx="8"
                          />
                        )}

                        {segments.map((seg, sIdx) => (
                          <rect
                            key={sIdx}
                            x={colCenterX - barWidth / 2}
                            y={seg.y}
                            width={barWidth}
                            height={seg.h}
                            fill={seg.fill}
                            rx={sIdx === segments.length - 1 ? 4 : 0}
                          />
                        ))}

                        {/* Etiqueta total arriba de la barra apilada */}
                        {m.total > 0 && (
                          <text
                            x={colCenterX}
                            y={340 - currentH - 6}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="800"
                            fill="#334155"
                          >
                            {m.total}
                          </text>
                        )}

                        {/* Nombre del mes en eje X */}
                        <text
                          x={colCenterX}
                          y="362"
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight={isHovered ? '900' : '700'}
                          fill={isHovered ? '#dc2626' : '#64748b'}
                        >
                          {MESES_CORTOS[idx]}
                        </text>
                      </g>
                    );
                  }

                  // MODO BARRAS AGRUPADAS
                  const slotWidth = (colWidth * 0.8) / (activeSeriesCount || 1);
                  const startX = colCenterX - ((activeSeriesCount || 1) * slotWidth) / 2;
                  let curSlot = 0;

                  const bars = [];
                  if (showRevisiones) {
                    const h = (m.revisiones / maxScaleValue) * 300;
                    bars.push({ x: startX + curSlot * slotWidth, h, fill: 'url(#gradRevisiones)', val: m.revisiones });
                    curSlot++;
                  }
                  if (showReparaciones) {
                    const h = (m.reparaciones / maxScaleValue) * 300;
                    bars.push({ x: startX + curSlot * slotWidth, h, fill: 'url(#gradReparaciones)', val: m.reparaciones });
                    curSlot++;
                  }
                  if (showInstalaciones) {
                    const h = (m.instalaciones / maxScaleValue) * 300;
                    bars.push({ x: startX + curSlot * slotWidth, h, fill: 'url(#gradInstalaciones)', val: m.instalaciones });
                    curSlot++;
                  }
                  if (showUrgencias) {
                    const h = (m.urgencias / maxScaleValue) * 300;
                    bars.push({ x: startX + curSlot * slotWidth, h, fill: 'url(#gradUrgencias)', val: m.urgencias });
                    curSlot++;
                  }

                  return (
                    <g
                      key={idx}
                      onMouseEnter={() => setHoveredMonth(idx)}
                      onMouseLeave={() => setHoveredMonth(null)}
                      className="cursor-pointer"
                    >
                      {isHovered && (
                        <rect
                          x={colCenterX - colWidth / 2}
                          y="40"
                          width={colWidth}
                          height="300"
                          fill="#f8fafc"
                          opacity="0.8"
                          rx="8"
                        />
                      )}

                      {bars.map((b, bIdx) => (
                        <g key={bIdx}>
                          <rect
                            x={b.x + 1}
                            y={340 - b.h}
                            width={Math.max(slotWidth - 2, 4)}
                            height={b.h}
                            fill={b.fill}
                            rx="3"
                          />
                          {b.val > 0 && isHovered && (
                            <text
                              x={b.x + slotWidth / 2}
                              y={340 - b.h - 4}
                              textAnchor="middle"
                              fontSize="9"
                              fontWeight="800"
                              fill="#1e293b"
                            >
                              {b.val}
                            </text>
                          )}
                        </g>
                      ))}

                      <text
                        x={colCenterX}
                        y="362"
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight={isHovered ? '900' : '700'}
                        fill={isHovered ? '#dc2626' : '#64748b'}
                      >
                        {MESES_CORTOS[idx]}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip flotante interactivo */}
              {hoveredMonth !== null && (
                <div
                  className="absolute z-20 bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs pointer-events-none transition-all duration-75"
                  style={{
                    left: `${Math.min(Math.max((hoveredMonth / 11) * 85 + 5, 10), 75)}%`,
                    top: '20px'
                  }}
                >
                  <p className="font-black text-amber-400 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between gap-4">
                    <span>{MESES[hoveredMonth]} {selectedYear}</span>
                    <span className="text-white text-[11px] font-extrabold">{dataMeses[hoveredMonth].total} total</span>
                  </p>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1 text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-400" /> Revisiones:
                      </span>
                      <strong className="text-white">{dataMeses[hoveredMonth].revisiones}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1 text-sky-300">
                        <span className="w-2 h-2 rounded-full bg-sky-400" /> Reparaciones:
                      </span>
                      <strong className="text-white">{dataMeses[hoveredMonth].reparaciones}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1 text-red-300">
                        <span className="w-2 h-2 rounded-full bg-red-500" /> Instalaciones:
                      </span>
                      <strong className="text-white">{dataMeses[hoveredMonth].instalaciones}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1 text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-zinc-950 border border-amber-400" /> Urgencias:
                      </span>
                      <strong className="text-white">{dataMeses[hoveredMonth].urgencias}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabla Desglosada Mes a Mes */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Desglose Mensual Detallado · {selectedYear}
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold">
                Valores calculados en tiempo real
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Mes</th>
                    <th className="py-2.5 px-4 text-center">Revisiones</th>
                    <th className="py-2.5 px-4 text-center">Reparaciones</th>
                    <th className="py-2.5 px-4 text-center">Instalaciones</th>
                    <th className="py-2.5 px-4 text-center">Urgencias</th>
                    <th className="py-2.5 px-4 text-right">Total Mes</th>
                    <th className="py-2.5 px-4 text-right">% del Año</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {dataMeses.map((m, idx) => {
                    const pct = totalesAnuales.totalGeneral > 0
                      ? ((m.total / totalesAnuales.totalGeneral) * 100).toFixed(1)
                      : '0.0';
                    const isPeak = m.total === peakMonthInfo.count && m.total > 0;

                    return (
                      <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${isPeak ? 'bg-red-50/30' : ''}`}>
                        <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <span>{MESES[idx]}</span>
                          {isPeak && (
                            <span className="px-1.5 py-0.2 rounded-md bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider">
                              Pico
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center font-semibold text-amber-700">{m.revisiones}</td>
                        <td className="py-2.5 px-4 text-center font-semibold text-sky-700">{m.reparaciones}</td>
                        <td className="py-2.5 px-4 text-center font-semibold text-red-700">{m.instalaciones}</td>
                        <td className="py-2.5 px-4 text-center font-black text-slate-900">{m.urgencias}</td>
                        <td className="py-2.5 px-4 text-right font-black text-slate-900">{m.total}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-500">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 font-black text-slate-900 text-xs border-t-2 border-slate-200">
                    <td className="py-3 px-4 uppercase tracking-wider">TOTAL ANUAL</td>
                    <td className="py-3 px-4 text-center text-amber-700">{totalesAnuales.revisiones}</td>
                    <td className="py-3 px-4 text-center text-sky-700">{totalesAnuales.reparaciones}</td>
                    <td className="py-3 px-4 text-center text-red-700">{totalesAnuales.instalaciones}</td>
                    <td className="py-3 px-4 text-center text-slate-900">{totalesAnuales.urgencias}</td>
                    <td className="py-3 px-4 text-right text-red-600 text-sm">{totalesAnuales.totalGeneral}</td>
                    <td className="py-3 px-4 text-right text-slate-700">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Banner de Futura Facturación */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Módulo de Facturación en Análisis</h4>
                <p className="text-xs text-slate-300 font-medium">
                  Próximamente incorporaremos las métricas económicas, importes facturados y rentabilidad mensual por cada tipo de tarea.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold whitespace-nowrap border border-white/10">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Operativa Activa
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
