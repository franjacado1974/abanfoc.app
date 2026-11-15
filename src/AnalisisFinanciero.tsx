import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Receipt, ShoppingCart,
  Download, Calendar, Building2, PieChart, BarChart3,
  CheckCircle2, Clock, Wallet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  type Factura, type CompraGasto, type Proveedor,
  subscribeFacturas, subscribeCompras, subscribeProveedores
} from './firebase';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

function formatEuro(val: number): string {
  return Number(val || 0).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';
}

function formatEuroCompact(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1000) {
    return (val / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + 'k €';
  }
  return Math.round(val).toLocaleString('es-ES') + ' €';
}

function getYearMonthFromDate(raw: string | undefined): { year: number; month: number } | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // YYYY-MM-DD or ISO
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    if (!isNaN(y) && m >= 0 && m <= 11) return { year: y, month: m };
  }
  // DD/MM/YYYY
  const esMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (esMatch) {
    const m = parseInt(esMatch[2], 10) - 1;
    const y = parseInt(esMatch[3], 10);
    if (!isNaN(y) && m >= 0 && m <= 11) return { year: y, month: m };
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() };
  }
  return null;
}

export default function AnalisisFinanciero() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [modoImporte, setModoImporte] = useState<'neto' | 'total'>('neto');
  const [chartMode, setChartMode] = useState<'barras' | 'lineas'>('barras');
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

  const [facturas, setFacturas] = useState<Factura[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_facturas');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [compras, setCompras] = useState<CompraGasto[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_compras');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [proveedores, setProveedores] = useState<Proveedor[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_proveedores');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const u1 = subscribeFacturas((items) => setFacturas(items));
    const u2 = subscribeCompras((items) => setCompras(items));
    const u3 = subscribeProveedores((items) => setProveedores(items));
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const proveedoresMap = useMemo(() => {
    const map = new Map<string, Proveedor>();
    for (const p of proveedores) {
      if (p._docId) map.set(p._docId, p);
      if (p.id) map.set(p.id, p);
      if (p.referencia) map.set(p.referencia, p);
    }
    return map;
  }, [proveedores]);

  // Excluir borradores de la facturación real
  const facturasEmitidas = useMemo(() => {
    return facturas.filter(f => f.estado !== 'Borrador' && !(f as any).esBorrador);
  }, [facturas]);

  // Años disponibles
  const availableYears = useMemo(() => {
    const set = new Set<number>([currentYear]);
    facturasEmitidas.forEach(f => {
      const ym = getYearMonthFromDate(f.fechaCreacion);
      if (ym) set.add(ym.year);
    });
    compras.forEach(c => {
      const ym = getYearMonthFromDate(c.fecha || c.fechaCreacion);
      if (ym) set.add(ym.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [facturasEmitidas, compras, currentYear]);

  // Datos filtrados del año seleccionado
  const {
    monthlyData,
    totals,
    gastosPorCategoria,
    topProveedores,
    topClientes
  } = useMemo(() => {
    const months = MESES.map((nombre, idx) => ({
      idx,
      nombre,
      corto: MESES_CORTOS[idx],
      numFacturas: 0,
      facturacionBase: 0,
      facturacionTotal: 0,
      ivaRepercutido: 0,
      cobrado: 0,
      pendienteCobro: 0,
      numCompras: 0,
      gastosBase: 0,
      gastosTotal: 0,
      ivaSoportado: 0,
      pagado: 0,
      pendientePago: 0
    }));

    const catMap = new Map<string, { categoria: string; count: number; base: number; total: number }>();
    const provMap = new Map<string, { ref: string; nombre: string; tipo: string; count: number; base: number; total: number }>();
    const cliMap = new Map<string, { nombre: string; count: number; base: number; total: number }>();

    for (const f of facturasEmitidas) {
      const ym = getYearMonthFromDate(f.fechaCreacion);
      if (!ym || ym.year !== selectedYear) continue;
      const m = months[ym.month];
      const base = Number(f.subtotal || 0);
      const total = Number(f.total || 0);
      const ivaAmt = Math.max(0, total - base);
      const valor = modoImporte === 'neto' ? base : total;

      m.numFacturas += 1;
      m.facturacionBase += base;
      m.facturacionTotal += total;
      m.ivaRepercutido += ivaAmt;
      if (f.estado === 'Cobrada') {
        m.cobrado += valor;
      } else {
        m.pendienteCobro += valor;
      }

      const cliName = (f.nombreCliente || f.clienteNombreLibre || 'CLIENTE GENERAL').trim().toUpperCase();
      const prevCli = cliMap.get(cliName) || { nombre: cliName, count: 0, base: 0, total: 0 };
      prevCli.count += 1;
      prevCli.base += base;
      prevCli.total += total;
      cliMap.set(cliName, prevCli);
    }

    for (const c of compras) {
      const ym = getYearMonthFromDate(c.fecha || c.fechaCreacion);
      if (!ym || ym.year !== selectedYear) continue;
      const m = months[ym.month];
      const base = Number(c.baseImponible || 0);
      const total = Number(c.total || 0);
      const ivaAmt = Math.max(0, total - base);
      const valor = modoImporte === 'neto' ? base : total;

      m.numCompras += 1;
      m.gastosBase += base;
      m.gastosTotal += total;
      m.ivaSoportado += ivaAmt;
      if (c.estado === 'Pagado') {
        m.pagado += valor;
      } else {
        m.pendientePago += valor;
      }

      const cat = c.categoria || 'Otros';
      const prevCat = catMap.get(cat) || { categoria: cat, count: 0, base: 0, total: 0 };
      prevCat.count += 1;
      prevCat.base += base;
      prevCat.total += total;
      catMap.set(cat, prevCat);

      const provObj = (c.proveedorId ? proveedoresMap.get(c.proveedorId) : undefined) ||
        (c.proveedorReferencia ? proveedoresMap.get(c.proveedorReferencia) : undefined);
      const provNombre = (provObj?.proveedor || c.proveedorNombre || 'PROVEEDOR GENERAL').toUpperCase();
      const provRef = provObj?.referencia || c.proveedorReferencia || '';
      const provKey = provRef ? `${provRef}||${provNombre}` : provNombre;
      const prevProv = provMap.get(provKey) || {
        ref: provRef,
        nombre: provNombre,
        tipo: provObj?.tipoComercio || '',
        count: 0,
        base: 0,
        total: 0
      };
      prevProv.count += 1;
      prevProv.base += base;
      prevProv.total += total;
      provMap.set(provKey, prevProv);
    }

    const monthlyComputed = months.map(m => {
      const ing = modoImporte === 'neto' ? m.facturacionBase : m.facturacionTotal;
      const gas = modoImporte === 'neto' ? m.gastosBase : m.gastosTotal;
      const margen = ing - gas;
      const pctMargen = ing > 0 ? (margen / ing) * 100 : (gas > 0 ? -100 : 0);
      return {
        ...m,
        ingresos: ing,
        gastos: gas,
        margen,
        pctMargen,
        difIva: m.ivaRepercutido - m.ivaSoportado
      };
    });

    const tot = monthlyComputed.reduce((acc, m) => ({
      numFacturas: acc.numFacturas + m.numFacturas,
      ingresos: acc.ingresos + m.ingresos,
      cobrado: acc.cobrado + m.cobrado,
      pendienteCobro: acc.pendienteCobro + m.pendienteCobro,
      numCompras: acc.numCompras + m.numCompras,
      gastos: acc.gastos + m.gastos,
      pagado: acc.pagado + m.pagado,
      pendientePago: acc.pendientePago + m.pendientePago,
      ivaRepercutido: acc.ivaRepercutido + m.ivaRepercutido,
      ivaSoportado: acc.ivaSoportado + m.ivaSoportado
    }), {
      numFacturas: 0,
      ingresos: 0,
      cobrado: 0,
      pendienteCobro: 0,
      numCompras: 0,
      gastos: 0,
      pagado: 0,
      pendientePago: 0,
      ivaRepercutido: 0,
      ivaSoportado: 0
    });

    const margenTotal = tot.ingresos - tot.gastos;
    const pctMargenTotal = tot.ingresos > 0 ? (margenTotal / tot.ingresos) * 100 : 0;
    const ratioGasto = tot.ingresos > 0 ? (tot.gastos / tot.ingresos) * 100 : (tot.gastos > 0 ? 100 : 0);

    const categoriasList = Array.from(catMap.values()).sort((a, b) => {
      const va = modoImporte === 'neto' ? a.base : a.total;
      const vb = modoImporte === 'neto' ? b.base : b.total;
      return vb - va;
    });

    const proveedoresList = Array.from(provMap.values()).sort((a, b) => {
      const va = modoImporte === 'neto' ? a.base : a.total;
      const vb = modoImporte === 'neto' ? b.base : b.total;
      return vb - va;
    }).slice(0, 8);

    const clientesList = Array.from(cliMap.values()).sort((a, b) => {
      const va = modoImporte === 'neto' ? a.base : a.total;
      const vb = modoImporte === 'neto' ? b.base : b.total;
      return vb - va;
    }).slice(0, 8);

    return {
      monthlyData: monthlyComputed,
      totals: {
        ...tot,
        margenTotal,
        pctMargenTotal,
        ratioGasto,
        difIva: tot.ivaRepercutido - tot.ivaSoportado
      },
      gastosPorCategoria: categoriasList,
      topProveedores: proveedoresList,
      topClientes: clientesList
    };
  }, [facturasEmitidas, compras, selectedYear, modoImporte, proveedoresMap]);

  // Exportar Excel financiero
  const handleExportExcel = () => {
    const rows = monthlyData.map(m => ({
      Mes: m.nombre,
      'Nº Facturas': m.numFacturas,
      [`Facturación (${modoImporte === 'neto' ? 'Base' : 'Total'})`]: Number(m.ingresos.toFixed(2)),
      'Nº Compras': m.numCompras,
      [`Compras / Gastos (${modoImporte === 'neto' ? 'Base' : 'Total'})`]: Number(m.gastos.toFixed(2)),
      'Resultado / Margen': Number(m.margen.toFixed(2)),
      '% Margen': `${m.pctMargen.toFixed(1)}%`,
      'IVA Repercutido': Number(m.ivaRepercutido.toFixed(2)),
      'IVA Soportado': Number(m.ivaSoportado.toFixed(2)),
      'Diferencia IVA': Number(m.difIva.toFixed(2))
    }));
    rows.push({
      Mes: 'TOTAL ANUAL',
      'Nº Facturas': totals.numFacturas,
      [`Facturación (${modoImporte === 'neto' ? 'Base' : 'Total'})`]: Number(totals.ingresos.toFixed(2)),
      'Nº Compras': totals.numCompras,
      [`Compras / Gastos (${modoImporte === 'neto' ? 'Base' : 'Total'})`]: Number(totals.gastos.toFixed(2)),
      'Resultado / Margen': Number(totals.margenTotal.toFixed(2)),
      '% Margen': `${totals.pctMargenTotal.toFixed(1)}%`,
      'IVA Repercutido': Number(totals.ivaRepercutido.toFixed(2)),
      'IVA Soportado': Number(totals.ivaSoportado.toFixed(2)),
      'Diferencia IVA': Number(totals.difIva.toFixed(2))
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `Financiero_${selectedYear}`);
    XLSX.writeFile(wb, `Analisis_Financiero_${selectedYear}_${modoImporte}.xlsx`);
  };

  // Parámetros del gráfico SVG
  const svgW = 920;
  const svgH = 290;
  const padL = 64;
  const padR = 24;
  const padT = 24;
  const padB = 34;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const maxVal = useMemo(() => {
    let m = 100;
    for (const d of monthlyData) {
      if (d.ingresos > m) m = d.ingresos;
      if (d.gastos > m) m = d.gastos;
    }
    return Math.ceil(m * 1.15);
  }, [monthlyData]);

  const yPos = (val: number) => padT + plotH - (Math.max(0, val) / maxVal) * plotH;

  return (
    <div className="px-4 md:px-8 py-6 w-full space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Análisis Financiero</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Comparativa de facturación emitida frente a compras y gastos registrados en {selectedYear}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector Base vs Total */}
          <div className="inline-flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => setModoImporte('neto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                modoImporte === 'neto' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Base Imponible (Sin IVA)
            </button>
            <button
              onClick={() => setModoImporte('total')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                modoImporte === 'total' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Total (Con IVA)
            </button>
          </div>

          {/* Selector Año */}
          <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs font-bold text-zinc-800 bg-transparent outline-none cursor-pointer"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-xl font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Facturación */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Facturación {selectedYear}</p>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-zinc-900 mt-1.5">{formatEuro(totals.ingresos)}</p>
          <div className="flex items-center justify-between text-[11px] mt-1.5 pt-1.5 border-t border-zinc-100">
            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {formatEuro(totals.cobrado)}
            </span>
            <span className="text-amber-600 font-semibold inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatEuro(totals.pendienteCobro)}
            </span>
          </div>
        </div>

        {/* Compras y Gastos */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Compras y Gastos</p>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-zinc-900 mt-1.5">{formatEuro(totals.gastos)}</p>
          <div className="flex items-center justify-between text-[11px] mt-1.5 pt-1.5 border-t border-zinc-100">
            <span className="text-zinc-600 font-medium">{totals.numCompras} apuntes</span>
            <span className="text-amber-600 font-semibold">Pdte: {formatEuro(totals.pendientePago)}</span>
          </div>
        </div>

        {/* Resultado / Margen */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Resultado Neto</p>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              totals.margenTotal >= 0 ? 'bg-teal-50 text-teal-600' : 'bg-red-50 text-red-600'
            }`}>
              {totals.margenTotal >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <p className={`text-xl font-black mt-1.5 ${totals.margenTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatEuro(totals.margenTotal)}
          </p>
          <div className="text-[11px] text-zinc-500 mt-1.5 pt-1.5 border-t border-zinc-100 font-semibold">
            Margen sobre ventas: <span className="text-zinc-900 font-bold">{totals.pctMargenTotal.toFixed(1)}%</span>
          </div>
        </div>

        {/* Balance IVA */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Balance de IVA</p>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-blue-700 mt-1.5">{formatEuro(totals.difIva)}</p>
          <div className="flex items-center justify-between text-[11px] mt-1.5 pt-1.5 border-t border-zinc-100 text-zinc-500">
            <span>Rep: {formatEuro(totals.ivaRepercutido)}</span>
            <span>Sop: {formatEuro(totals.ivaSoportado)}</span>
          </div>
        </div>

        {/* Ratio Gasto / Facturación */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Ratio Gasto / Ingreso</p>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-zinc-900 mt-1.5">{totals.ratioGasto.toFixed(1)}%</p>
          <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                totals.ratioGasto <= 60 ? 'bg-emerald-500' : totals.ratioGasto <= 85 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, totals.ratioGasto)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Gráfico Mensual Interactivo */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Evolución Mensual: Facturación vs Compras y Gastos</h2>
            <p className="text-xs text-zinc-500">
              Pasa el cursor sobre cualquier mes para ver el desglose exacto ({modoImporte === 'neto' ? 'Base Imponible' : 'Total con IVA'}).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Facturación
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-700">
                <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" /> Gastos
              </span>
            </div>
            <div className="inline-flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              <button
                onClick={() => setChartMode('barras')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                  chartMode === 'barras' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Barras
              </button>
              <button
                onClick={() => setChartMode('lineas')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                  chartMode === 'lineas' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Líneas
              </button>
            </div>
          </div>
        </div>

        <div className="relative w-full overflow-x-auto">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full min-w-[640px] h-auto select-none">
            {/* Líneas de cuadrícula horizontal */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const val = maxVal * ratio;
              const y = yPos(val);
              return (
                <g key={i}>
                  <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#e4e4e7" strokeDasharray={ratio === 0 ? undefined : '4 4'} />
                  <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-zinc-400 text-[10px] font-semibold">
                    {formatEuroCompact(val)}
                  </text>
                </g>
              );
            })}

            {chartMode === 'barras' ? (
              monthlyData.map((d, i) => {
                const slotW = plotW / 12;
                const centerX = padL + slotW * i + slotW / 2;
                const barW = Math.min(20, slotW * 0.3);
                const hIng = (d.ingresos / maxVal) * plotH;
                const hGas = (d.gastos / maxVal) * plotH;
                const isHovered = hoveredMonthIdx === i;

                return (
                  <g
                    key={d.idx}
                    onMouseEnter={() => setHoveredMonthIdx(i)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={padL + slotW * i}
                      y={padT}
                      width={slotW}
                      height={plotH}
                      fill={isHovered ? '#fef3c7' : 'transparent'}
                      opacity={isHovered ? 0.45 : 0}
                      rx={6}
                    />
                    <rect
                      x={centerX - barW - 2}
                      y={padT + plotH - hIng}
                      width={barW}
                      height={Math.max(0, hIng)}
                      rx={4}
                      fill="#10b981"
                      opacity={isHovered ? 1 : 0.88}
                    />
                    <rect
                      x={centerX + 2}
                      y={padT + plotH - hGas}
                      width={barW}
                      height={Math.max(0, hGas)}
                      rx={4}
                      fill="#f43f5e"
                      opacity={isHovered ? 1 : 0.88}
                    />
                    <text x={centerX} y={svgH - 10} textAnchor="middle" className="fill-zinc-600 text-[11px] font-bold">
                      {d.corto}
                    </text>
                  </g>
                );
              })
            ) : (
              <>
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={monthlyData.map((d, i) => {
                    const slotW = plotW / 12;
                    return `${padL + slotW * i + slotW / 2},${yPos(d.ingresos)}`;
                  }).join(' ')}
                />
                <polyline
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={monthlyData.map((d, i) => {
                    const slotW = plotW / 12;
                    return `${padL + slotW * i + slotW / 2},${yPos(d.gastos)}`;
                  }).join(' ')}
                />
                {monthlyData.map((d, i) => {
                  const slotW = plotW / 12;
                  const cx = padL + slotW * i + slotW / 2;
                  const isHovered = hoveredMonthIdx === i;
                  return (
                    <g
                      key={d.idx}
                      onMouseEnter={() => setHoveredMonthIdx(i)}
                      onMouseLeave={() => setHoveredMonthIdx(null)}
                      className="cursor-pointer"
                    >
                      <rect x={padL + slotW * i} y={padT} width={slotW} height={plotH} fill="transparent" />
                      <circle cx={cx} cy={yPos(d.ingresos)} r={isHovered ? 6 : 4} fill="#10b981" stroke="#fff" strokeWidth={2} />
                      <circle cx={cx} cy={yPos(d.gastos)} r={isHovered ? 6 : 4} fill="#f43f5e" stroke="#fff" strokeWidth={2} />
                      <text x={cx} y={svgH - 10} textAnchor="middle" className="fill-zinc-600 text-[11px] font-bold">
                        {d.corto}
                      </text>
                    </g>
                  );
                })}
              </>
            )}
          </svg>

          {/* Tooltip mes activo */}
          {hoveredMonthIdx !== null && monthlyData[hoveredMonthIdx] && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs bg-zinc-900 text-white px-4 py-2 rounded-2xl shadow-md">
              <span className="font-extrabold">{monthlyData[hoveredMonthIdx].nombre} {selectedYear}</span>
              <span className="text-emerald-300 font-bold">
                Facturación: {formatEuro(monthlyData[hoveredMonthIdx].ingresos)} ({monthlyData[hoveredMonthIdx].numFacturas} fact.)
              </span>
              <span className="text-rose-300 font-bold">
                Gastos: {formatEuro(monthlyData[hoveredMonthIdx].gastos)} ({monthlyData[hoveredMonthIdx].numCompras} comp.)
              </span>
              <span className={`font-black ${monthlyData[hoveredMonthIdx].margen >= 0 ? 'text-teal-300' : 'text-red-300'}`}>
                Resultado: {formatEuro(monthlyData[hoveredMonthIdx].margen)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Desglose por Categorías, Top Proveedores y Top Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gastos por Categoría */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-rose-600" />
            Gastos por Categoría ({selectedYear})
          </h3>
          {gastosPorCategoria.length === 0 ? (
            <p className="text-xs text-zinc-400 py-8 text-center">Sin gastos registrados en {selectedYear}.</p>
          ) : (
            <div className="space-y-3">
              {gastosPorCategoria.map(c => {
                const val = modoImporte === 'neto' ? c.base : c.total;
                const pct = totals.gastos > 0 ? (val / totals.gastos) * 100 : 0;
                return (
                  <div key={c.categoria} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-800">{c.categoria} ({c.count})</span>
                      <span className="font-bold text-zinc-900">{formatEuro(val)} <span className="text-zinc-400 font-medium">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Proveedores */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-zinc-700" />
            Principales Proveedores ({selectedYear})
          </h3>
          {topProveedores.length === 0 ? (
            <p className="text-xs text-zinc-400 py-8 text-center">Sin compras a proveedores en {selectedYear}.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {topProveedores.map((p, idx) => {
                const val = modoImporte === 'neto' ? p.base : p.total;
                return (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {p.ref && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-[10px] font-bold text-zinc-700">
                            {p.ref}
                          </span>
                        )}
                        <span className="font-bold text-zinc-900 truncate">{p.nombre}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">{p.count} compras {p.tipo ? `· ${p.tipo}` : ''}</p>
                    </div>
                    <span className="font-black text-rose-700 shrink-0">{formatEuro(val)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Clientes */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            Principales Clientes Facturados ({selectedYear})
          </h3>
          {topClientes.length === 0 ? (
            <p className="text-xs text-zinc-400 py-8 text-center">Sin facturas emitidas en {selectedYear}.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {topClientes.map((c, idx) => {
                const val = modoImporte === 'neto' ? c.base : c.total;
                return (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 truncate">{c.nombre}</p>
                      <p className="text-[11px] text-zinc-400">{c.count} facturas</p>
                    </div>
                    <span className="font-black text-emerald-700 shrink-0">{formatEuro(val)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabla Resumen Mensual (Cabecera gris y cebra) */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden w-full">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900">Cuenta de Resultados Mensual ({selectedYear})</h3>
          <span className="text-[11px] font-semibold text-zinc-500">
            Importes mostrados en {modoImporte === 'neto' ? 'Base Imponible (sin IVA)' : 'Total (con IVA)'}
          </span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-200/90 border-b border-zinc-300 text-[11px] font-extrabold text-zinc-700 uppercase tracking-wider">
                <th className="py-3 px-4">Mes</th>
                <th className="py-3 px-4 text-center">Facturas</th>
                <th className="py-3 px-4 text-right">Facturación</th>
                <th className="py-3 px-4 text-center">Compras</th>
                <th className="py-3 px-4 text-right">Compras / Gastos</th>
                <th className="py-3 px-4 text-right">Resultado</th>
                <th className="py-3 px-4 text-right">% Margen</th>
                <th className="py-3 px-4 text-right">IVA Rep.</th>
                <th className="py-3 px-4 text-right">IVA Sop.</th>
                <th className="py-3 px-4 text-right">Dif. IVA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs">
              {monthlyData.map((m, idx) => (
                <tr key={m.idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'} hover:bg-amber-100/70 transition-colors`}>
                  <td className="py-2.5 px-4 font-bold text-slate-800">{m.nombre}</td>
                  <td className="py-2.5 px-4 text-center text-slate-600">{m.numFacturas}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">{formatEuro(m.ingresos)}</td>
                  <td className="py-2.5 px-4 text-center text-slate-600">{m.numCompras}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-rose-700 whitespace-nowrap">{formatEuro(m.gastos)}</td>
                  <td className={`py-2.5 px-4 text-right font-black whitespace-nowrap ${m.margen >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                    {formatEuro(m.margen)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold text-slate-600">{m.pctMargen.toFixed(1)}%</td>
                  <td className="py-2.5 px-4 text-right text-slate-600 whitespace-nowrap">{formatEuro(m.ivaRepercutido)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-600 whitespace-nowrap">{formatEuro(m.ivaSoportado)}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-blue-700 whitespace-nowrap">{formatEuro(m.difIva)}</td>
                </tr>
              ))}
              <tr className="bg-zinc-900 text-white font-bold text-xs">
                <td className="py-3 px-4">TOTAL {selectedYear}</td>
                <td className="py-3 px-4 text-center">{totals.numFacturas}</td>
                <td className="py-3 px-4 text-right text-emerald-300 whitespace-nowrap">{formatEuro(totals.ingresos)}</td>
                <td className="py-3 px-4 text-center">{totals.numCompras}</td>
                <td className="py-3 px-4 text-right text-rose-300 whitespace-nowrap">{formatEuro(totals.gastos)}</td>
                <td className={`py-3 px-4 text-right font-black whitespace-nowrap ${totals.margenTotal >= 0 ? 'text-teal-300' : 'text-red-300'}`}>
                  {formatEuro(totals.margenTotal)}
                </td>
                <td className="py-3 px-4 text-right">{totals.pctMargenTotal.toFixed(1)}%</td>
                <td className="py-3 px-4 text-right whitespace-nowrap">{formatEuro(totals.ivaRepercutido)}</td>
                <td className="py-3 px-4 text-right whitespace-nowrap">{formatEuro(totals.ivaSoportado)}</td>
                <td className="py-3 px-4 text-right text-blue-300 whitespace-nowrap">{formatEuro(totals.difIva)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
