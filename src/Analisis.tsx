import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Calendar, 
  ClipboardCheck, 
  Wrench, 
  HardHat, 
  AlertTriangle, 
  TrendingUp, 
  Layers, 
  Download,
  Filter,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
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

type TipoFiltro = 'TODOS' | 'instalaciones' | 'revisiones' | 'reparaciones' | 'urgencias';

export default function Analisis() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedTipo, setSelectedTipo] = useState<TipoFiltro>('TODOS');
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<'lineas' | 'barras'>('lineas');

  // Visibilidad individual de líneas en el gráfico
  const [visibleLines, setVisibleLines] = useState({
    instalaciones: true,
    revisiones: true,
    reparaciones: true,
    urgencias: true
  });

  // Datos reactivos
  const [partes, setPartes] = useState<ParteFirestore[]>([]);
  const [reparaciones, setReparaciones] = useState<ReparacionItem[]>([]);
  const [instalaciones, setInstalaciones] = useState<InstalacionItem[]>([]);
  const [urgencias, setUrgencias] = useState<UrgenciaItem[]>([]);

  useEffect(() => {
    // Carga inicial rápida desde LocalStorage
    try {
      setPartes(JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]'));
      setReparaciones(JSON.parse(localStorage.getItem('firecheck_db_reparaciones') || '[]'));
      setInstalaciones(JSON.parse(localStorage.getItem('firecheck_db_instalaciones') || '[]'));
      setUrgencias(JSON.parse(localStorage.getItem('firecheck_db_urgencias') || '[]'));
    } catch {}

    const unsubP = subscribePartes(items => setPartes(items || []));
    const unsubR = subscribeReparaciones(items => setReparaciones(items || []));
    const unsubI = subscribeInstalaciones(items => setInstalaciones(items || []));
    const unsubU = subscribeUrgencias(items => setUrgencias(items || []));

    return () => {
      unsubP();
      unsubR();
      unsubI();
      unsubU();
    };
  }, []);

  // Extraer año y mes (0-11) de cualquier fecha registrada
  const parseDateInfo = (dateStr?: string | any): { year: number | null; monthIdx: number | null } => {
    if (!dateStr) return { year: null, monthIdx: null };

    // Si es objeto Timestamp de Firestore
    if (typeof dateStr === 'object' && dateStr?.seconds) {
      const d = new Date(dateStr.seconds * 1000);
      return { year: d.getFullYear(), monthIdx: d.getMonth() };
    }

    if (typeof dateStr !== 'string') return { year: null, monthIdx: null };

    const clean = dateStr.trim();
    // YYYY-MM o YYYY-MM-DD
    if (/^\d{4}-\d{2}/.test(clean)) {
      const parts = clean.slice(0, 7).split('-');
      return { year: parseInt(parts[0], 10), monthIdx: parseInt(parts[1], 10) - 1 };
    }
    // DD/MM/YYYY o DD-MM-YYYY
    const ddmmyyyy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (ddmmyyyy) {
      return { year: parseInt(ddmmyyyy[3], 10), monthIdx: parseInt(ddmmyyyy[2], 10) - 1 };
    }
    return { year: null, monthIdx: null };
  };

  // Obtener año y mes normalizados para un elemento
  const getItemDate = (item: any): { year: number | null; monthIdx: number | null } => {
    const candidates = [item.fechaProgramada, item.fecha, item.fechaCreacion];
    for (const c of candidates) {
      const parsed = parseDateInfo(c);
      if (parsed.year !== null && parsed.monthIdx !== null) {
        return parsed;
      }
    }
    // Si tiene campo 'mes' y el año actual coincide
    if (item.mes && typeof item.mes === 'string') {
      const idx = MESES.findIndex(m => m.toLowerCase() === item.mes.toLowerCase());
      if (idx !== -1) {
        return { year: selectedYear, monthIdx: idx };
      }
    }
    return { year: null, monthIdx: null };
  };

  // Detectar dinámicamente todos los años disponibles
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>([currentYear, currentYear - 1, currentYear + 1]);
    
    const inspect = (items: any[]) => {
      items.forEach(it => {
        const { year } = getItemDate(it);
        if (year && year >= 2020 && year <= 2040) yearSet.add(year);
      });
    };

    inspect(partes);
    inspect(reparaciones);
    inspect(instalaciones);
    inspect(urgencias);

    return Array.from(yearSet).sort((a, b) => b - a);
  }, [partes, reparaciones, instalaciones, urgencias, currentYear]);

  // Desglose de los 12 meses para el año seleccionado
  const datosMensuales = useMemo(() => {
    return MESES.map((mesNombre, idx) => {
      // 1. Instalaciones
      const instItems = instalaciones.filter(i => {
        const d = getItemDate(i);
        return d.year === selectedYear && d.monthIdx === idx;
      });

      // 2. Revisiones
      const revItems = partes.filter(p => {
        const d = getItemDate(p);
        return d.year === selectedYear && d.monthIdx === idx;
      });

      // 3. Reparaciones
      const repItems = reparaciones.filter(r => {
        const d = getItemDate(r);
        return d.year === selectedYear && d.monthIdx === idx;
      });

      // 4. Urgencias
      const urgItems = urgencias.filter(u => {
        const d = getItemDate(u);
        return d.year === selectedYear && d.monthIdx === idx;
      });

      const countInst = instItems.length;
      const countRev = revItems.length;
      const countRep = repItems.length;
      const countUrg = urgItems.length;

      const totalMes = countInst + countRev + countRep + countUrg;

      return {
        mesIdx: idx,
        mes: mesNombre,
        mesCorto: MESES_CORTOS[idx],
        instalaciones: countInst,
        revisiones: countRev,
        reparaciones: countRep,
        urgencias: countUrg,
        total: totalMes,
        // Detalle de estados en el mes
        revisionesCerradas: revItems.filter(p => p.estado === 'Cerrado' || p.estado === 'Finalizado').length,
        reparacionesFinalizadas: repItems.filter(r => r.estado === 'Finalizado').length,
        instalacionesFinalizadas: instItems.filter(i => i.estado === 'Finalizado').length,
        urgenciasFinalizadas: urgItems.filter(u => u.estado === 'Finalizado').length
      };
    });
  }, [partes, reparaciones, instalaciones, urgencias, selectedYear]);

  // Totales Anuales
  const totalesAnuales = useMemo(() => {
    const sumInst = datosMensuales.reduce((acc, m) => acc + m.instalaciones, 0);
    const sumRev = datosMensuales.reduce((acc, m) => acc + m.revisiones, 0);
    const sumRep = datosMensuales.reduce((acc, m) => acc + m.reparaciones, 0);
    const sumUrg = datosMensuales.reduce((acc, m) => acc + m.urgencias, 0);
    const granTotal = sumInst + sumRev + sumRep + sumUrg;

    // Completadas
    const compInst = datosMensuales.reduce((acc, m) => acc + m.instalacionesFinalizadas, 0);
    const compRev = datosMensuales.reduce((acc, m) => acc + m.revisionesCerradas, 0);
    const compRep = datosMensuales.reduce((acc, m) => acc + m.reparacionesFinalizadas, 0);
    const compUrg = datosMensuales.reduce((acc, m) => acc + m.urgenciasFinalizadas, 0);

    return {
      instalaciones: sumInst,
      revisiones: sumRev,
      reparaciones: sumRep,
      urgencias: sumUrg,
      granTotal,
      compInst,
      compRev,
      compRep,
      compUrg
    };
  }, [datosMensuales]);

  // Valor máximo en el gráfico para la escala Y
  const maxGrafico = useMemo(() => {
    let max = 5;
    datosMensuales.forEach(m => {
      if (visibleLines.instalaciones && m.instalaciones > max) max = m.instalaciones;
      if (visibleLines.revisiones && m.revisiones > max) max = m.revisiones;
      if (visibleLines.reparaciones && m.reparaciones > max) max = m.reparaciones;
      if (visibleLines.urgencias && m.urgencias > max) max = m.urgencias;
    });
    // Redondear hacia arriba a múltiplo conveniente
    if (max <= 10) return Math.ceil(max / 2) * 2 + 2;
    if (max <= 30) return Math.ceil(max / 5) * 5 + 5;
    if (max <= 100) return Math.ceil(max / 10) * 10 + 10;
    return Math.ceil(max / 20) * 20 + 20;
  }, [datosMensuales, visibleLines]);

  // Dimensiones del SVG del gráfico (expandido al 100% del ancho)
  const svgWidth = 1400;
  const svgHeight = 360;
  const padLeft = 45;
  const padRight = 35;
  const padTop = 30;
  const padBottom = 40;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Coordenadas para cada mes (12 puntos)
  const getXCoord = (mesIdx: number) => {
    return padLeft + (mesIdx / 11) * plotWidth;
  };

  const getYCoord = (val: number) => {
    const ratio = maxGrafico > 0 ? val / maxGrafico : 0;
    return padTop + plotHeight - ratio * plotHeight;
  };

  // Generador de curva suave SVG (Catmull-Rom a Bézier)
  const buildSmoothPath = (values: number[]) => {
    const points = values.map((val, idx) => ({
      x: getXCoord(idx),
      y: getYCoord(val)
    }));

    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;

      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  // Rutas de las 4 líneas con sus colores reglamentarios
  const pathInstalaciones = useMemo(() => buildSmoothPath(datosMensuales.map(m => m.instalaciones)), [datosMensuales, maxGrafico]);
  const pathRevisiones = useMemo(() => buildSmoothPath(datosMensuales.map(m => m.revisiones)), [datosMensuales, maxGrafico]);
  const pathReparaciones = useMemo(() => buildSmoothPath(datosMensuales.map(m => m.reparaciones)), [datosMensuales, maxGrafico]);
  const pathUrgencias = useMemo(() => buildSmoothPath(datosMensuales.map(m => m.urgencias)), [datosMensuales, maxGrafico]);

  // Líneas horizontales de guía del eje Y
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const val = Math.round(maxGrafico * pct);
    const y = padTop + plotHeight - pct * plotHeight;
    return { val, y };
  });

  // Conmutador de visibilidad de línea
  const toggleLine = (lineKey: keyof typeof visibleLines) => {
    setVisibleLines(prev => ({ ...prev, [lineKey]: !prev[lineKey] }));
  };

  // Exportar datos de la tabla a Excel (.xlsx)
  const exportarAExcel = () => {
    const dataRows = datosMensuales.map(m => ({
      'Mes': m.mes,
      'Instalaciones': m.instalaciones,
      'Revisiones': m.revisiones,
      'Reparaciones': m.reparaciones,
      'Urgencias': m.urgencias,
      'Total Mes': m.total,
      '% Anual': totalesAnuales.granTotal > 0 ? `${((m.total / totalesAnuales.granTotal) * 100).toFixed(1)}%` : '0.0%'
    }));

    // Fila total
    dataRows.push({
      'Mes': `TOTAL ${selectedYear}`,
      'Instalaciones': totalesAnuales.instalaciones,
      'Revisiones': totalesAnuales.revisiones,
      'Reparaciones': totalesAnuales.reparaciones,
      'Urgencias': totalesAnuales.urgencias,
      'Total Mes': totalesAnuales.granTotal,
      '% Anual': '100.0%'
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Análisis ${selectedYear}`);
    XLSX.writeFile(workbook, `Salamandra_Analisis_Operativo_${selectedYear}.xlsx`);
  };

  // Filtrado de visualización en la tabla según el tipo seleccionado
  const showInstalaciones = selectedTipo === 'TODOS' || selectedTipo === 'instalaciones';
  const showRevisiones = selectedTipo === 'TODOS' || selectedTipo === 'revisiones';
  const showReparaciones = selectedTipo === 'TODOS' || selectedTipo === 'reparaciones';
  const showUrgencias = selectedTipo === 'TODOS' || selectedTipo === 'urgencias';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen space-y-6">
      
      {/* 1. CABECERA PRINCIPAL Y BARRA DE FILTROS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/10">
            <BarChart3 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Análisis Operativo Anual</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200">
                {selectedYear}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Control anual de instalaciones, revisiones, reparaciones y avisos.</p>
          </div>
        </div>

        {/* Controles y Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Año */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
            <span className="text-xs font-bold text-slate-500 mr-1.5">Año:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="text-xs font-black text-slate-900 bg-transparent outline-none cursor-pointer pr-1"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Selector de Tipo de Trabajo */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 shadow-xs">
            <Filter className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
            <span className="text-xs font-bold text-slate-500 mr-1.5">Tipo:</span>
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value as TipoFiltro)}
              className="text-xs font-black text-slate-900 bg-transparent outline-none cursor-pointer pr-1"
            >
              <option value="TODOS">Todas las 4 tareas</option>
              <option value="instalaciones">Solo Instalaciones (Rojo)</option>
              <option value="revisiones">Solo Revisiones (Amarillo)</option>
              <option value="reparaciones">Solo Reparaciones (Azul)</option>
              <option value="urgencias">Solo Avisos (Negro)</option>
            </select>
          </div>

          {/* Botón Descargar Excel */}
          <button
            onClick={exportarAExcel}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer"
            title="Descargar datos en formato Excel (.xlsx)"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* 2. CUATRO TARJETAS KPI ARRIBA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: INSTALACIONES (ROJO) */}
        <div 
          onClick={() => setSelectedTipo(selectedTipo === 'instalaciones' ? 'TODOS' : 'instalaciones')}
          className={`bg-white p-5 rounded-3xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
            selectedTipo === 'instalaciones' 
              ? 'ring-2 ring-red-600 border-red-300 shadow-red-100' 
              : 'border-slate-200/80 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              Instalaciones
            </span>
            <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shadow-xs">
              <HardHat className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {totalesAnuales.instalaciones}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {totalesAnuales.granTotal > 0 ? `${Math.round((totalesAnuales.instalaciones / totalesAnuales.granTotal) * 100)}% del total` : '0%'}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {totalesAnuales.compInst} completadas
              </span>
              <span>{totalesAnuales.instalaciones - totalesAnuales.compInst} activas</span>
            </div>
          </div>
        </div>

        {/* KPI 2: REVISIONES (AMARILLO) */}
        <div 
          onClick={() => setSelectedTipo(selectedTipo === 'revisiones' ? 'TODOS' : 'revisiones')}
          className={`bg-white p-5 rounded-3xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
            selectedTipo === 'revisiones' 
              ? 'ring-2 ring-amber-500 border-amber-300 shadow-amber-100' 
              : 'border-slate-200/80 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Revisiones
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-xs">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {totalesAnuales.revisiones}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {totalesAnuales.granTotal > 0 ? `${Math.round((totalesAnuales.revisiones / totalesAnuales.granTotal) * 100)}% del total` : '0%'}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {totalesAnuales.compRev} cerradas
              </span>
              <span>{totalesAnuales.revisiones - totalesAnuales.compRev} pendientes</span>
            </div>
          </div>
        </div>

        {/* KPI 3: REPARACIONES (AZUL) */}
        <div 
          onClick={() => setSelectedTipo(selectedTipo === 'reparaciones' ? 'TODOS' : 'reparaciones')}
          className={`bg-white p-5 rounded-3xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
            selectedTipo === 'reparaciones' 
              ? 'ring-2 ring-sky-600 border-sky-300 shadow-sky-100' 
              : 'border-slate-200/80 hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-600"></span>
              Reparaciones
            </span>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600 shadow-xs">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {totalesAnuales.reparaciones}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {totalesAnuales.granTotal > 0 ? `${Math.round((totalesAnuales.reparaciones / totalesAnuales.granTotal) * 100)}% del total` : '0%'}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {totalesAnuales.compRep} resueltas
              </span>
              <span>{totalesAnuales.reparaciones - totalesAnuales.compRep} en curso</span>
            </div>
          </div>
        </div>

        {/* KPI 4: URGENCIAS (NEGRO) */}
        <div 
          onClick={() => setSelectedTipo(selectedTipo === 'urgencias' ? 'TODOS' : 'urgencias')}
          className={`bg-white p-5 rounded-3xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
            selectedTipo === 'urgencias' 
              ? 'ring-2 ring-black border-zinc-900 shadow-zinc-200' 
              : 'border-slate-200/80 hover:border-zinc-400'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-zinc-950 text-white border border-black flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white"></span>
              Avisos
            </span>
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-black shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {totalesAnuales.urgencias}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {totalesAnuales.granTotal > 0 ? `${Math.round((totalesAnuales.urgencias / totalesAnuales.granTotal) * 100)}% del total` : '0%'}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {totalesAnuales.compUrg} atendidos
              </span>
              <span>{totalesAnuales.urgencias - totalesAnuales.compUrg} pendientes</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. GRÁFICO GRANDE DE LÍNEAS (ENERO A DICIEMBRE CON 4 COLORES) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
        
        {/* Cabecera y Selector de Vistas (Líneas / Barras) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full lg:w-auto">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                {chartMode === 'lineas' ? (
                  <TrendingUp className="w-5 h-5 text-red-600" />
                ) : (
                  <BarChart3 className="w-5 h-5 text-red-600" />
                )}
                Evolución Comparativa Mensual · Año {selectedYear}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {chartMode === 'lineas' ? 'Curvas de tendencia continuas de las 4 tareas de Enero a Diciembre.' : 'Comparativa de barras de las 4 tareas de Enero a Diciembre.'}
              </p>
            </div>

            {/* Selector de modo Líneas / Barras */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-xs shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartMode('lineas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'lineas'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Líneas</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('barras')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'barras'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Barras</span>
              </button>
            </div>
          </div>

          {/* Botones de Leyenda con activación individual */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Instalaciones (Rojo) */}
            <button
              onClick={() => toggleLine('instalaciones')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                visibleLines.instalaciones 
                  ? 'bg-red-50 text-red-700 border-red-300 shadow-xs' 
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
              }`}
              title="Clic para mostrar/ocultar línea de Instalaciones"
            >
              <span className="w-3 h-1.5 rounded-full bg-red-600"></span>
              Instalaciones ({totalesAnuales.instalaciones})
            </button>

            {/* Revisiones (Amarillo) */}
            <button
              onClick={() => toggleLine('revisiones')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                visibleLines.revisiones 
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs' 
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
              }`}
              title="Clic para mostrar/ocultar línea de Revisiones"
            >
              <span className="w-3 h-1.5 rounded-full bg-amber-500"></span>
              Revisiones ({totalesAnuales.revisiones})
            </button>

            {/* Reparaciones (Azul) */}
            <button
              onClick={() => toggleLine('reparaciones')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                visibleLines.reparaciones 
                  ? 'bg-sky-50 text-sky-800 border-sky-300 shadow-xs' 
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
              }`}
              title="Clic para mostrar/ocultar línea de Reparaciones"
            >
              <span className="w-3 h-1.5 rounded-full bg-sky-600"></span>
              Reparaciones ({totalesAnuales.reparaciones})
            </button>

            {/* Avisos (Negro) */}
            <button
              onClick={() => toggleLine('urgencias')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                visibleLines.urgencias 
                  ? 'bg-zinc-900 text-white border-black shadow-xs' 
                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through'
              }`}
              title="Clic para mostrar/ocultar línea de Avisos"
            >
              <span className="w-3 h-1.5 rounded-full bg-white"></span>
              Avisos ({totalesAnuales.urgencias})
            </button>
          </div>
        </div>

        {/* LIENZO SVG INTERACTIVO (OCUPA EL 100% DEL ANCHO) */}
        <div className="w-full overflow-x-auto">
          <div className="w-full min-w-[750px]">
            <svg 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
              className="w-full h-auto min-h-[290px] select-none overflow-visible"
            >
              <defs>
                {/* Sombras suaves para las líneas */}
                <filter id="lineShadow" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
                </filter>
              </defs>

              {/* Fondo del área de trazado con marco nítido */}
              <rect 
                x={padLeft} 
                y={padTop} 
                width={plotWidth} 
                height={plotHeight} 
                fill="#f8fafc" 
                rx="8" 
                stroke="#cbd5e1" 
                strokeWidth="1.5" 
              />

              {/* Rejilla horizontal notable y etiquetas de valores Y */}
              {yTicks.map(({ val, y }) => (
                <g key={y}>
                  <line 
                    x1={padLeft} 
                    y1={y} 
                    x2={svgWidth - padRight} 
                    y2={y} 
                    stroke={val === 0 ? '#64748b' : '#cbd5e1'} 
                    strokeDasharray={val === 0 ? undefined : '4 4'} 
                    strokeWidth={val === 0 ? '1.5' : '1.2'} 
                  />
                  <text 
                    x={padLeft - 8} 
                    y={y + 3.5} 
                    textAnchor="end" 
                    fontSize="10" 
                    fontWeight="800" 
                    fill="#475569"
                  >
                    {val}
                  </text>
                </g>
              ))}

              {/* Guías verticales para los 12 meses notables */}
              {datosMensuales.map((m) => {
                const x = getXCoord(m.mesIdx);
                const isHovered = hoveredMonthIdx === m.mesIdx;
                return (
                  <g key={m.mes}>
                    {/* Línea vertical reactiva y visible */}
                    <line 
                      x1={x} 
                      y1={padTop} 
                      x2={x} 
                      y2={svgHeight - padBottom} 
                      stroke={isHovered ? '#0f172a' : '#cbd5e1'} 
                      strokeWidth={isHovered ? '2' : '1'} 
                      strokeDasharray={isHovered ? undefined : '3 3'}
                    />

                    {/* Etiqueta del mes en el eje X */}
                    <text 
                      x={x} 
                      y={svgHeight - padBottom + 20} 
                      textAnchor="middle" 
                      fontSize="11" 
                      fontWeight={isHovered ? '900' : '800'} 
                      fill={isHovered ? '#0f172a' : '#334155'}
                      className="cursor-pointer"
                    >
                      {m.mesCorto}
                    </text>
                  </g>
                );
              })}

              {/* RENDERIZADO MODO LÍNEAS */}
              {chartMode === 'lineas' && (
                <>
                  {/* 1. Línea Instalaciones (Rojo) */}
                  {visibleLines.instalaciones && (
                    <g>
                      <path 
                        d={pathInstalaciones} 
                        fill="none" 
                        stroke="#dc2626" 
                        strokeWidth="3.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        filter="url(#lineShadow)"
                      />
                      {datosMensuales.map(m => (
                        <circle 
                          key={`inst-${m.mesIdx}`}
                          cx={getXCoord(m.mesIdx)}
                          cy={getYCoord(m.instalaciones)}
                          r={hoveredMonthIdx === m.mesIdx ? '6' : '4'}
                          fill="#dc2626"
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="transition-all duration-150"
                        />
                      ))}
                    </g>
                  )}

                  {/* 2. Línea Revisiones (Amarillo) */}
                  {visibleLines.revisiones && (
                    <g>
                      <path 
                        d={pathRevisiones} 
                        fill="none" 
                        stroke="#eab308" 
                        strokeWidth="3.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        filter="url(#lineShadow)"
                      />
                      {datosMensuales.map(m => (
                        <circle 
                          key={`rev-${m.mesIdx}`}
                          cx={getXCoord(m.mesIdx)}
                          cy={getYCoord(m.revisiones)}
                          r={hoveredMonthIdx === m.mesIdx ? '6' : '4'}
                          fill="#eab308"
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="transition-all duration-150"
                        />
                      ))}
                    </g>
                  )}

                  {/* 3. Línea Reparaciones (Azul) */}
                  {visibleLines.reparaciones && (
                    <g>
                      <path 
                        d={pathReparaciones} 
                        fill="none" 
                        stroke="#0284c7" 
                        strokeWidth="3.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        filter="url(#lineShadow)"
                      />
                      {datosMensuales.map(m => (
                        <circle 
                          key={`rep-${m.mesIdx}`}
                          cx={getXCoord(m.mesIdx)}
                          cy={getYCoord(m.reparaciones)}
                          r={hoveredMonthIdx === m.mesIdx ? '6' : '4'}
                          fill="#0284c7"
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="transition-all duration-150"
                        />
                      ))}
                    </g>
                  )}

                  {/* 4. Línea Avisos (Negro) */}
                  {visibleLines.urgencias && (
                    <g>
                      <path 
                        d={pathUrgencias} 
                        fill="none" 
                        stroke="#18181b" 
                        strokeWidth="3.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        filter="url(#lineShadow)"
                      />
                      {datosMensuales.map(m => (
                        <circle 
                          key={`urg-${m.mesIdx}`}
                          cx={getXCoord(m.mesIdx)}
                          cy={getYCoord(m.urgencias)}
                          r={hoveredMonthIdx === m.mesIdx ? '6' : '4'}
                          fill="#18181b"
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="transition-all duration-150"
                        />
                      ))}
                    </g>
                  )}
                </>
              )}

              {/* RENDERIZADO MODO BARRAS AGRUPADAS */}
              {chartMode === 'barras' && (
                <g>
                  {datosMensuales.map((m) => {
                    const activeSeries = [
                      { id: 'inst', val: m.instalaciones, color: '#dc2626', visible: visibleLines.instalaciones },
                      { id: 'rev', val: m.revisiones, color: '#eab308', visible: visibleLines.revisiones },
                      { id: 'rep', val: m.reparaciones, color: '#0284c7', visible: visibleLines.reparaciones },
                      { id: 'urg', val: m.urgencias, color: '#18181b', visible: visibleLines.urgencias }
                    ].filter(s => s.visible);

                    const count = activeSeries.length;
                    if (count === 0) return null;

                    const barWidth = count > 2 ? 14 : 20;
                    const barGap = 3.5;
                    const groupWidth = count * barWidth + (count - 1) * barGap;
                    const startX = getXCoord(m.mesIdx) - groupWidth / 2;
                    const isHovered = hoveredMonthIdx === m.mesIdx;

                    return (
                      <g key={`bars-group-${m.mesIdx}`} opacity={hoveredMonthIdx !== null && !isHovered ? 0.7 : 1}>
                        {activeSeries.map((s, sIdx) => {
                          const bx = startX + sIdx * (barWidth + barGap);
                          const bh = maxGrafico > 0 ? (s.val / maxGrafico) * plotHeight : 0;
                          const by = padTop + plotHeight - bh;

                          return s.val > 0 ? (
                            <rect
                              key={`bar-${s.id}-${m.mesIdx}`}
                              x={bx}
                              y={by}
                              width={barWidth}
                              height={Math.max(bh, 3)}
                              fill={s.color}
                              rx="2.5"
                              filter="url(#lineShadow)"
                              className="transition-all duration-200"
                            />
                          ) : (
                            <rect
                              key={`bar-zero-${s.id}-${m.mesIdx}`}
                              x={bx}
                              y={padTop + plotHeight - 2}
                              width={barWidth}
                              height={2}
                              fill={s.color}
                              opacity={0.3}
                              rx="1"
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Columnas invisibles interactivas sobre cada mes para detectar hover */}
              {datosMensuales.map(m => {
                const colW = plotWidth / 12;
                const x = getXCoord(m.mesIdx) - colW / 2;
                return (
                  <rect 
                    key={`hit-${m.mesIdx}`}
                    x={x}
                    y={padTop}
                    width={colW}
                    height={plotHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredMonthIdx(m.mesIdx)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                  />
                );
              })}
            </svg>
          </div>
        </div>

        {/* TOOLTIP / TARJETA DINÁMICA DEL MES SELECCIONADO AL PASAR EL RATÓN */}
        <div className="mt-2 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-400">Detalle del mes:</span>
            <span className="font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
              {hoveredMonthIdx !== null ? `${MESES[hoveredMonthIdx]} ${selectedYear}` : `Promedio mensual ${selectedYear}`}
            </span>
          </div>

          {hoveredMonthIdx !== null ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                Instalaciones: <strong className="font-black">{datosMensuales[hoveredMonthIdx].instalaciones}</strong>
              </span>
              <span className="flex items-center gap-1.5 font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Revisiones: <strong className="font-black">{datosMensuales[hoveredMonthIdx].revisiones}</strong>
              </span>
              <span className="flex items-center gap-1.5 font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                Reparaciones: <strong className="font-black">{datosMensuales[hoveredMonthIdx].reparaciones}</strong>
              </span>
              <span className="flex items-center gap-1.5 font-bold text-white bg-black px-2.5 py-1 rounded-lg border border-black">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                Avisos: <strong className="font-black">{datosMensuales[hoveredMonthIdx].urgencias}</strong>
              </span>
              <span className="font-black text-slate-900 bg-slate-200 px-3 py-1 rounded-lg">
                Total: {datosMensuales[hoveredMonthIdx].total}
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 font-medium italic">
              Pasa el cursor sobre cualquier punto o mes en el gráfico para ver el desglose en tiempo real.
            </p>
          )}
        </div>
      </div>

      {/* 4. TABLA LIMPIA CON LOS MESES Y CANTIDADES */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Cabecera de la tabla */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-slate-700" />
              Desglose Mensual Detallado de Trabajos ({selectedYear})
            </h3>
            <p className="text-xs text-slate-500 font-medium">Cantidades exactas por cada mes y peso porcentual sobre el volumen anual.</p>
          </div>

          <span className="text-xs font-black text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs self-start sm:self-auto">
            {totalesAnuales.granTotal} intervenciones registradas
          </span>
        </div>

        {/* Tabla Responsiva */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/75 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Mes</th>
                
                {showInstalaciones && (
                  <th className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1.5 text-red-700">
                      <span className="w-2 h-2 rounded-full bg-red-600"></span>
                      Instalaciones
                    </span>
                  </th>
                )}

                {showRevisiones && (
                  <th className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1.5 text-amber-700">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Revisiones
                    </span>
                  </th>
                )}

                {showReparaciones && (
                  <th className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1.5 text-sky-700">
                      <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                      Reparaciones
                    </span>
                  </th>
                )}

                {showUrgencias && (
                  <th className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1.5 text-slate-900">
                      <span className="w-2 h-2 rounded-full bg-black"></span>
                      Avisos
                    </span>
                  </th>
                )}

                <th className="py-3.5 px-4 text-center font-black text-slate-900">Total Mes</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">% Anual</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-xs font-semibold">
              {datosMensuales.map((m) => {
                const isHovered = hoveredMonthIdx === m.mesIdx;
                const isOdd = m.mesIdx % 2 === 1;
                const porcentaje = totalesAnuales.granTotal > 0 ? ((m.total / totalesAnuales.granTotal) * 100).toFixed(1) : '0.0';

                return (
                  <tr 
                    key={m.mes}
                    onMouseEnter={() => setHoveredMonthIdx(m.mesIdx)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    className={`transition-colors cursor-pointer ${
                      isHovered 
                        ? 'bg-red-50/80 shadow-2xs' 
                        : isOdd 
                          ? 'bg-slate-100/70 hover:bg-slate-200/60' 
                          : 'bg-white hover:bg-slate-100/70'
                    }`}
                  >
                    {/* Nombre del Mes */}
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full transition-all ${
                        isHovered ? 'bg-red-600 scale-125' : 'bg-slate-300'
                      }`}></span>
                      {m.mes}
                    </td>

                    {/* Instalaciones (Rojo) */}
                    {showInstalaciones && (
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block min-w-[36px] py-1 px-2.5 rounded-lg text-xs font-black ${
                          m.instalaciones > 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-300'
                        }`}>
                          {m.instalaciones}
                        </span>
                      </td>
                    )}

                    {/* Revisiones (Amarillo) */}
                    {showRevisiones && (
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block min-w-[36px] py-1 px-2.5 rounded-lg text-xs font-black ${
                          m.revisiones > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'text-slate-300'
                        }`}>
                          {m.revisiones}
                        </span>
                      </td>
                    )}

                    {/* Reparaciones (Azul) */}
                    {showReparaciones && (
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block min-w-[36px] py-1 px-2.5 rounded-lg text-xs font-black ${
                          m.reparaciones > 0 ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'text-slate-300'
                        }`}>
                          {m.reparaciones}
                        </span>
                      </td>
                    )}

                    {/* Urgencias (Negro) */}
                    {showUrgencias && (
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block min-w-[36px] py-1 px-2.5 rounded-lg text-xs font-black ${
                          m.urgencias > 0 ? 'bg-zinc-950 text-white border border-black' : 'text-slate-300'
                        }`}>
                          {m.urgencias}
                        </span>
                      </td>
                    )}

                    {/* Total del Mes */}
                    <td className="py-3.5 px-4 text-center font-black text-slate-900">
                      <span className={`inline-block min-w-[42px] py-1 px-2.5 rounded-lg text-xs ${
                        m.total > 0 ? 'bg-slate-100 text-slate-900 font-black' : 'text-slate-300 font-normal'
                      }`}>
                        {m.total}
                      </span>
                    </td>

                    {/* Porcentaje sobre el Año */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden hidden sm:block">
                          <div 
                            className="bg-slate-800 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(parseFloat(porcentaje) * 3, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-black text-slate-700 w-10 text-right">
                          {porcentaje}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* FILA DE TOTAL ANUAL */}
            <tfoot>
              <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-950">
                <td className="py-4 px-4 sm:px-6 uppercase tracking-wider text-slate-200">
                  TOTAL AÑO {selectedYear}
                </td>

                {showInstalaciones && (
                  <td className="py-4 px-4 text-center text-red-400 font-black text-sm">
                    {totalesAnuales.instalaciones}
                  </td>
                )}

                {showRevisiones && (
                  <td className="py-4 px-4 text-center text-amber-400 font-black text-sm">
                    {totalesAnuales.revisiones}
                  </td>
                )}

                {showReparaciones && (
                  <td className="py-4 px-4 text-center text-sky-400 font-black text-sm">
                    {totalesAnuales.reparaciones}
                  </td>
                )}

                {showUrgencias && (
                  <td className="py-4 px-4 text-center text-white font-black text-sm">
                    {totalesAnuales.urgencias}
                  </td>
                )}

                <td className="py-4 px-4 text-center text-emerald-400 font-black text-base">
                  {totalesAnuales.granTotal}
                </td>

                <td className="py-4 px-4 sm:px-6 text-right font-black text-slate-300">
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
