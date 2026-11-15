import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Pencil, Trash2, X, Building2,
  Phone, Mail, User, Receipt, Fuel, Wrench, Package, Download,
  CheckCircle2, Clock, Filter, AlertTriangle
} from 'lucide-react';
import {
  type Proveedor, type CompraGasto,
  subscribeProveedores,
  subscribeCompras, addCompra, updateCompra, deleteCompra
} from './firebase';
import { ProveedorFormModal } from './Proveedores';

const CATEGORIAS_GASTO = [
  'Materiales',
  'Gasolina / Combustible',
  'Herramientas',
  'Repuestos',
  'Dietas / Viajes',
  'Subcontratación',
  'Otros'
];

const FORMAS_PAGO = [
  'Tarjeta empresa',
  'Transferencia',
  'Efectivo',
  'Domiciliación',
  'Otro'
];

const MESES_OPCIONES = [
  { value: 'all', label: 'Todos los meses' },
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' }
];

function formatEuro(val: number): string {
  return Number(val || 0).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';
}

function formatFechaEs(fechaIso: string): string {
  if (!fechaIso) return '-';
  const parts = fechaIso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return fechaIso;
}

export default function Compras() {
  const [proveedores, setProveedores] = useState<Proveedor[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_proveedores');
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

  useEffect(() => {
    const unsubProv = subscribeProveedores((items) => setProveedores(items));
    const unsubComp = subscribeCompras((items) => setCompras(items));
    return () => {
      unsubProv();
      unsubComp();
    };
  }, []);

  // Mapa rápido de proveedores por id / docId / referencia
  const proveedoresMap = useMemo(() => {
    const map = new Map<string, Proveedor>();
    for (const p of proveedores) {
      if (p._docId) map.set(p._docId, p);
      if (p.id) map.set(p.id, p);
      if (p.referencia) map.set(p.referencia, p);
    }
    return map;
  }, [proveedores]);

  const resolveProveedor = (c: CompraGasto): Proveedor | undefined =>
    (c.proveedorId ? proveedoresMap.get(c.proveedorId) : undefined) ||
    (c.proveedorReferencia ? proveedoresMap.get(c.proveedorReferencia) : undefined);

  // Filtros Gastos
  const [searchGasto, setSearchGasto] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('all');
  const [estadoFiltro, setEstadoFiltro] = useState('all');
  const [mesFiltro, setMesFiltro] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [anioFiltro, setAnioFiltro] = useState(() => String(new Date().getFullYear()));

  // Modales Gasto
  const [isGastoModalOpen, setIsGastoModalOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<CompraGasto | null>(null);
  const [gastoForm, setGastoForm] = useState<CompraGasto>({
    fecha: new Date().toISOString().split('T')[0],
    numeroFactura: '',
    proveedorId: '',
    proveedorReferencia: '',
    proveedorNombre: '',
    categoria: 'Materiales',
    concepto: '',
    baseImponible: 0,
    iva: 21,
    total: 0,
    formaPago: 'Tarjeta empresa',
    estado: 'Pagado',
    notas: ''
  });
  const [savingGasto, setSavingGasto] = useState(false);

  // Modal Nuevo Proveedor desde Compras y Gastos
  const [isProveedorModalOpen, setIsProveedorModalOpen] = useState(false);

  // Modal de opciones al tocar una fila
  const [accionesModalItem, setAccionesModalItem] = useState<CompraGasto | null>(null);

  // Modal confirmación borrado
  const [deleteTarget, setDeleteTarget] = useState<CompraGasto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Años disponibles en compras
  const aniosDisponibles = useMemo(() => {
    const currentYear = String(new Date().getFullYear());
    const setAnios = new Set<string>([currentYear]);
    compras.forEach(c => {
      if (c.fecha && c.fecha.length >= 4) setAnios.add(c.fecha.substring(0, 4));
    });
    return Array.from(setAnios).sort((a, b) => b.localeCompare(a));
  }, [compras]);

  // Filtrado de compras
  const comprasFiltradas = useMemo(() => {
    const q = searchGasto.toLowerCase().trim();
    return compras.filter(c => {
      if (anioFiltro !== 'all' && (!c.fecha || !c.fecha.startsWith(anioFiltro))) return false;
      if (mesFiltro !== 'all' && (!c.fecha || c.fecha.substring(5, 7) !== mesFiltro)) return false;
      if (categoriaFiltro !== 'all' && c.categoria !== categoriaFiltro) return false;
      if (estadoFiltro !== 'all' && c.estado !== estadoFiltro) return false;
      if (q) {
        const prov = resolveProveedor(c);
        const hay = [
          c.numeroFactura,
          c.proveedorNombre,
          c.proveedorReferencia,
          c.concepto,
          c.categoria,
          c.formaPago,
          prov?.proveedor,
          prov?.nombreComercial,
          prov?.nif,
          prov?.tipoComercio,
          prov?.telefono,
          prov?.email,
          prov?.contacto
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [compras, anioFiltro, mesFiltro, categoriaFiltro, estadoFiltro, searchGasto, proveedoresMap]);

  // KPIs de las compras filtradas
  const kpisGastos = useMemo(() => {
    let total = 0;
    let base = 0;
    let pendiente = 0;
    for (const c of comprasFiltradas) {
      const t = Number(c.total || 0);
      const b = Number(c.baseImponible || 0);
      total += t;
      base += b;
      if (c.estado === 'Pendiente') pendiente += t;
    }
    const ivaSoportado = Math.max(0, total - base);
    return {
      total,
      base,
      ivaSoportado,
      pendiente,
      count: comprasFiltradas.length
    };
  }, [comprasFiltradas]);

  const handleOpenNuevoGasto = () => {
    setEditingGasto(null);
    setGastoForm({
      fecha: new Date().toISOString().split('T')[0],
      numeroFactura: '',
      proveedorId: '',
      proveedorReferencia: '',
      proveedorNombre: '',
      categoria: 'Materiales',
      concepto: '',
      baseImponible: 0,
      iva: 21,
      total: 0,
      formaPago: 'Tarjeta empresa',
      estado: 'Pagado',
      notas: ''
    });
    setIsGastoModalOpen(true);
  };

  const handleOpenEditarGasto = (g: CompraGasto) => {
    setEditingGasto(g);
    setGastoForm({ ...g });
    setIsGastoModalOpen(true);
  };

  const handleSelectProveedorEnGasto = (provId: string) => {
    const prov = proveedores.find(p => (p._docId || p.id) === provId);
    if (prov) {
      setGastoForm(prev => ({
        ...prev,
        proveedorId: prov._docId || prov.id || '',
        proveedorReferencia: prov.referencia || '',
        proveedorNombre: prov.nombreComercial || prov.proveedor || ''
      }));
    } else {
      setGastoForm(prev => ({
        ...prev,
        proveedorId: '',
        proveedorReferencia: ''
      }));
    }
  };

  const handleProveedorCreado = (saved: Proveedor) => {
    setProveedores(prev => {
      const docId = saved._docId || saved.id;
      const exists = prev.some(p => (p._docId || p.id) === docId);
      const next = exists
        ? prev.map(p => ((p._docId || p.id) === docId ? saved : p))
        : [...prev, saved];
      next.sort((a, b) => (a.referencia || '').localeCompare(b.referencia || ''));
      try { localStorage.setItem('firecheck_db_proveedores', JSON.stringify(next)); } catch {}
      return next;
    });

    // Si estaba abierto el modal de gasto, lo selecciona automáticamente
    if (isGastoModalOpen) {
      setGastoForm(prev => ({
        ...prev,
        proveedorId: saved._docId || saved.id || '',
        proveedorReferencia: saved.referencia || '',
        proveedorNombre: saved.nombreComercial || saved.proveedor || ''
      }));
    }
  };

  const handleBaseOrIvaChange = (newBase: number, newIva: number) => {
    const calcTotal = Math.round((newBase * (1 + newIva / 100)) * 100) / 100;
    setGastoForm(prev => ({
      ...prev,
      baseImponible: newBase,
      iva: newIva,
      total: calcTotal
    }));
  };

  const handleSaveGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastoForm.concepto.trim() || !gastoForm.fecha) return;
    setSavingGasto(true);
    try {
      const payload: CompraGasto = {
        ...gastoForm,
        baseImponible: Number(gastoForm.baseImponible || 0),
        iva: Number(gastoForm.iva || 0),
        total: Number(gastoForm.total || 0),
        proveedorNombre: (gastoForm.proveedorNombre.trim() || 'PROVEEDOR GENERAL').toUpperCase()
      };
      if (editingGasto && (editingGasto._docId || editingGasto.id)) {
        const docId = editingGasto._docId || editingGasto.id!;
        await updateCompra(docId, payload);
        setCompras(prev => {
          const next = prev.map(item => (item._docId === docId || item.id === docId ? { ...item, ...payload } : item));
          try { localStorage.setItem('firecheck_db_compras', JSON.stringify(next)); } catch {}
          return next;
        });
      } else {
        const created = await addCompra(payload);
        setCompras(prev => {
          const next = [created as CompraGasto, ...prev];
          try { localStorage.setItem('firecheck_db_compras', JSON.stringify(next)); } catch {}
          return next;
        });
      }
      setIsGastoModalOpen(false);
    } catch (err) {
      console.error('Error guardando compra:', err);
    } finally {
      setSavingGasto(false);
    }
  };

  const handleToggleEstadoGasto = async (g: CompraGasto) => {
    const docId = g._docId || g.id;
    if (!docId) return;
    const nextEstado: 'Pagado' | 'Pendiente' = g.estado === 'Pagado' ? 'Pendiente' : 'Pagado';
    try {
      setCompras(prev => {
        const next = prev.map(item => (item._docId === docId || item.id === docId ? { ...item, estado: nextEstado } : item));
        try { localStorage.setItem('firecheck_db_compras', JSON.stringify(next)); } catch {}
        return next;
      });
      await updateCompra(docId, { estado: nextEstado });
    } catch (err) {
      console.error('Error actualizando estado de gasto:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const docId = deleteTarget._docId || deleteTarget.id;
    if (!docId) return;
    setIsDeleting(true);
    try {
      await deleteCompra(docId);
      setCompras(prev => {
        const next = prev.filter(item => item._docId !== docId && item.id !== docId);
        try { localStorage.setItem('firecheck_db_compras', JSON.stringify(next)); } catch {}
        return next;
      });
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error eliminando gasto:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Fecha', 'Nº Factura/Ticket', 'Ref. Proveedor', 'Proveedor', 'NIF', 'Tipo Comercio', 'Teléfono', 'Categoría', 'Concepto', 'Base Imponible', 'IVA %', 'Total', 'Forma de Pago', 'Estado'];
    const rows = comprasFiltradas.map(c => {
      const prov = resolveProveedor(c);
      return [
        formatFechaEs(c.fecha),
        `"${(c.numeroFactura || '').replace(/"/g, '""')}"`,
        `"${(prov?.referencia || c.proveedorReferencia || '').replace(/"/g, '""')}"`,
        `"${(prov?.proveedor || c.proveedorNombre || '').replace(/"/g, '""')}"`,
        `"${(prov?.nif || '').replace(/"/g, '""')}"`,
        `"${(prov?.tipoComercio || '').replace(/"/g, '""')}"`,
        `"${(prov?.telefono || '').replace(/"/g, '""')}"`,
        `"${(c.categoria || '').replace(/"/g, '""')}"`,
        `"${(c.concepto || '').replace(/"/g, '""')}"`,
        String(Number(c.baseImponible || 0).toFixed(2)).replace('.', ','),
        String(Number(c.iva || 0)),
        String(Number(c.total || 0).toFixed(2)).replace('.', ','),
        `"${(c.formaPago || '').replace(/"/g, '""')}"`,
        c.estado
      ];
    });
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Compras_Gastos_${anioFiltro}_${mesFiltro}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoriaIcon = (cat: string) => {
    const low = (cat || '').toLowerCase();
    if (low.includes('gasolina') || low.includes('combustible')) return <Fuel className="w-3.5 h-3.5 text-amber-600" />;
    if (low.includes('herramienta')) return <Wrench className="w-3.5 h-3.5 text-indigo-600" />;
    return <Package className="w-3.5 h-3.5 text-zinc-600" />;
  };

  return (
    <div className="px-4 md:px-8 py-6 w-full space-y-6">
      {/* Cabecera estilo resto de menús */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-center md:text-left flex flex-col items-center md:items-start">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Compras y Gastos</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Control contable de materiales, gasolina, herramientas y proveedores ({compras.length} apuntes registrados).
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
          <button
            onClick={handleExportCSV}
            disabled={comprasFiltradas.length === 0}
            className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3.5 py-2 rounded-xl font-medium hover:bg-zinc-50 hover:border-zinc-300 disabled:opacity-40 transition-all text-xs shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={() => setIsProveedorModalOpen(true)}
            className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-800 px-3.5 py-2 rounded-xl font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Nuevo Proveedor</span>
          </button>
          <button
            onClick={handleOpenNuevoGasto}
            className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-xl font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Gasto / Compra</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Compras / Gastos</p>
          <p className="text-xl font-black text-zinc-900 mt-1">{formatEuro(kpisGastos.total)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{kpisGastos.count} apuntes en el filtro</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Base Imponible</p>
          <p className="text-xl font-black text-zinc-800 mt-1">{formatEuro(kpisGastos.base)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Importe neto sin IVA</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">IVA Soportado</p>
          <p className="text-xl font-black text-blue-700 mt-1">{formatEuro(kpisGastos.ivaSoportado)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">IVA deducible acumulado</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Pendiente de Pago</p>
          <p className="text-xl font-black text-amber-600 mt-1">{formatEuro(kpisGastos.pendiente)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Facturas por abonar</p>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm flex flex-wrap items-center gap-3 w-full">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchGasto}
            onChange={(e) => setSearchGasto(e.target.value)}
            placeholder="Buscar por concepto, nº factura, proveedor, PROV.00001, NIF..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="text-xs font-medium rounded-xl border border-zinc-200 px-3 py-2 bg-white outline-none focus:border-red-500"
          >
            <option value="all">Todas las categorías</option>
            {CATEGORIAS_GASTO.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <select
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          className="text-xs font-medium rounded-xl border border-zinc-200 px-3 py-2 bg-white outline-none focus:border-red-500"
        >
          {MESES_OPCIONES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <select
          value={anioFiltro}
          onChange={(e) => setAnioFiltro(e.target.value)}
          className="text-xs font-medium rounded-xl border border-zinc-200 px-3 py-2 bg-white outline-none focus:border-red-500"
        >
          <option value="all">Todos los años</option>
          {aniosDisponibles.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="text-xs font-medium rounded-xl border border-zinc-200 px-3 py-2 bg-white outline-none focus:border-red-500"
        >
          <option value="all">Todos los estados</option>
          <option value="Pagado">Pagado</option>
          <option value="Pendiente">Pendiente</option>
        </select>
      </div>

      {/* Tabla ancho completo con datos del proveedor en la línea */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-200/90 border-b border-zinc-300 text-[11px] font-extrabold text-zinc-700 uppercase tracking-wider">
                <th className="py-3 px-4">Fecha / Nº Doc</th>
                <th className="py-3 px-4">Proveedor (Datos completos)</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Concepto / Artículo</th>
                <th className="py-3 px-4 text-right">Base</th>
                <th className="py-3 px-4 text-right">IVA</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs">
              {comprasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400 font-medium">
                    No hay gastos o compras registrados con los filtros actuales.
                  </td>
                </tr>
              ) : (
                comprasFiltradas.map((c, idx) => {
                  const prov = resolveProveedor(c);
                  const refProv = prov?.referencia || c.proveedorReferencia;
                  const nombreProv = prov?.proveedor || c.proveedorNombre || '-';
                  const nombreComercial = prov?.nombreComercial && prov.nombreComercial !== nombreProv ? prov.nombreComercial : '';

                  return (
                    <tr
                      key={c._docId || c.id || idx}
                      onClick={() => setAccionesModalItem(c)}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'} hover:bg-amber-100/90 transition-colors cursor-pointer`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap align-top">
                        <div className="font-semibold text-slate-800">{formatFechaEs(c.fecha)}</div>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5">{c.numeroFactura || '-'}</div>
                      </td>

                      <td className="py-3 px-4 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {refProv && (
                            <span className="px-2 py-0.5 rounded-md bg-white/90 text-zinc-700 border border-zinc-200/80 font-mono text-[10px] font-bold shadow-2xs">
                              {refProv}
                            </span>
                          )}
                          <span className="font-bold text-slate-800 uppercase">{nombreProv.toUpperCase()}</span>
                          {nombreComercial && (
                            <span className="text-[11px] text-slate-500">({nombreComercial})</span>
                          )}
                          {prov?.tipoComercio && (
                            <span className="px-2 py-0.5 rounded-md bg-white/90 border border-zinc-200/70 text-slate-700 text-[10px] font-semibold">
                              {prov.tipoComercio}
                            </span>
                          )}
                        </div>
                        {prov && (prov.nif || prov.telefono || prov.email || prov.contacto) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                            {prov.nif && <span className="font-mono">NIF: {prov.nif}</span>}
                            {prov.telefono && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-3 h-3 text-zinc-400" />
                                {prov.telefono}
                              </span>
                            )}
                            {prov.email && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="w-3 h-3 text-zinc-400" />
                                {prov.email}
                              </span>
                            )}
                            {prov.contacto && (
                              <span className="inline-flex items-center gap-1">
                                <User className="w-3 h-3 text-zinc-400" />
                                {prov.contacto}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap align-top">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 border border-zinc-200/70 text-slate-700 text-[11px] font-semibold">
                          {getCategoriaIcon(c.categoria)}
                          {c.categoria}
                        </span>
                      </td>

                      <td className="py-3 px-4 align-top">
                        <div className="font-medium text-slate-800">{c.concepto}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{c.formaPago}</div>
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-slate-600 whitespace-nowrap align-top">
                        {formatEuro(c.baseImponible)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap align-top">
                        {c.iva}%
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap align-top">
                        {formatEuro(c.total)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap align-top">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            c.estado === 'Pagado'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {c.estado === 'Pagado' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {c.estado}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE OPCIONES AL TOCAR LA LÍNEA */}
      {accionesModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setAccionesModalItem(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-800">Opciones del Gasto</h3>
                  <p className="text-xs text-slate-500 truncate">{accionesModalItem.concepto}</p>
                </div>
              </div>
              <button
                onClick={() => setAccionesModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">
                    {formatFechaEs(accionesModalItem.fecha)} · {accionesModalItem.numeroFactura || 'Sin nº factura'}
                  </span>
                  <span className="font-black text-slate-900 text-sm">{formatEuro(accionesModalItem.total)}</span>
                </div>
                <p className="text-slate-600 font-medium">{accionesModalItem.proveedorNombre} · {accionesModalItem.categoria}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => {
                    const item = accionesModalItem;
                    setAccionesModalItem(null);
                    handleToggleEstadoGasto(item);
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl text-xs font-bold border transition-colors ${
                    accionesModalItem.estado === 'Pagado'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {accionesModalItem.estado === 'Pagado' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {accionesModalItem.estado === 'Pagado' ? 'Marcar Pendiente' : 'Marcar Pagado'}
                </button>
                <button
                  onClick={() => {
                    const item = accionesModalItem;
                    setAccionesModalItem(null);
                    handleOpenEditarGasto(item);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => {
                    const item = accionesModalItem;
                    setAccionesModalItem(null);
                    setDeleteTarget(item);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl bg-red-50 text-red-600 border border-red-200 text-xs font-bold hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR GASTO */}
      {isGastoModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-red-400" />
                <h2 className="text-base font-bold">
                  {editingGasto ? 'Editar Gasto / Compra' : 'Registrar Nuevo Gasto / Compra'}
                </h2>
              </div>
              <button onClick={() => setIsGastoModalOpen(false)} className="p-1.5 rounded-xl hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGasto} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={gastoForm.fecha}
                    onChange={(e) => setGastoForm(prev => ({ ...prev, fecha: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Nº Factura / Ticket</label>
                  <input
                    type="text"
                    value={gastoForm.numeroFactura}
                    onChange={(e) => setGastoForm(prev => ({ ...prev, numeroFactura: e.target.value }))}
                    placeholder="Ej. F-2026-0142 / Ticket"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Categoría *</label>
                  <select
                    value={gastoForm.categoria}
                    onChange={(e) => setGastoForm(prev => ({ ...prev, categoria: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
                  >
                    {CATEGORIAS_GASTO.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase">Proveedor de catálogo</label>
                    <button
                      type="button"
                      onClick={() => setIsProveedorModalOpen(true)}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Nuevo proveedor
                    </button>
                  </div>
                  <select
                    value={gastoForm.proveedorId || ''}
                    onChange={(e) => handleSelectProveedorEnGasto(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
                  >
                    <option value="">-- Seleccionar proveedor --</option>
                    {proveedores.map(p => (
                      <option key={p._docId || p.id} value={p._docId || p.id}>
                        {p.referencia} - {p.nombreComercial || p.proveedor}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Nombre Proveedor / Comercio *</label>
                  <input
                    type="text"
                    required
                    value={gastoForm.proveedorNombre}
                    onChange={(e) => setGastoForm(prev => ({ ...prev, proveedorNombre: e.target.value.toUpperCase() }))}
                    placeholder="NOMBRE DEL PROVEEDOR O ESTABLECIMIENTO"
                    className="w-full px-3 py-2 text-xs uppercase rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Concepto / Descripción del Gasto *</label>
                <input
                  type="text"
                  required
                  value={gastoForm.concepto}
                  onChange={(e) => setGastoForm(prev => ({ ...prev, concepto: e.target.value }))}
                  placeholder="Ej. Reposición gasoil furgoneta, compra taladro, material tubería BIE..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-200/70">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Base Imponible (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={gastoForm.baseImponible}
                    onChange={(e) => handleBaseOrIvaChange(parseFloat(e.target.value) || 0, gastoForm.iva)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-zinc-200 bg-white focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">IVA (%)</label>
                  <select
                    value={gastoForm.iva}
                    onChange={(e) => handleBaseOrIvaChange(gastoForm.baseImponible, parseFloat(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-zinc-200 bg-white focus:border-red-500 focus:outline-none"
                  >
                    <option value={21}>21%</option>
                    <option value={10}>10%</option>
                    <option value={4}>4%</option>
                    <option value={0}>0% (Exento)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Total (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={gastoForm.total}
                    onChange={(e) => setGastoForm(prev => ({ ...prev, total: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-xs font-black text-zinc-900 rounded-xl border border-zinc-300 bg-white focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Forma de Pago</label>
                  <select
                    value={gastoForm.formaPago}
                    onChange={(e) => setGastoForm(prev => ({ ...prev, formaPago: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 bg-white focus:border-red-500 focus:outline-none"
                  >
                    {FORMAS_PAGO.map(fp => (
                      <option key={fp} value={fp}>{fp}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Estado</label>
                  <select
                    value={gastoForm.estado}
                    onChange={(e) => setGastoForm(prev => ({ ...prev, estado: e.target.value as 'Pagado' | 'Pendiente' }))}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 bg-white focus:border-red-500 focus:outline-none"
                  >
                    <option value="Pagado">Pagado</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Notas</label>
                <textarea
                  rows={2}
                  value={gastoForm.notas || ''}
                  onChange={(e) => setGastoForm(prev => ({ ...prev, notas: e.target.value }))}
                  placeholder="Observaciones adicionales..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsGastoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingGasto}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-black text-white hover:bg-zinc-800 disabled:opacity-50 shadow-md shadow-black/10"
                >
                  {savingGasto ? 'Guardando...' : (editingGasto ? 'Guardar Cambios' : 'Registrar Gasto')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR PROVEEDOR DESDE COMPRAS Y GASTOS */}
      <ProveedorFormModal
        isOpen={isProveedorModalOpen}
        editingProveedor={null}
        proveedores={proveedores}
        onClose={() => setIsProveedorModalOpen(false)}
        onSaved={handleProveedorCreado}
      />

      {/* MODAL CONFIRMACIÓN ELIMINAR GASTO */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Eliminar gasto</h3>
                <p className="text-xs text-zinc-500">Se moverá a la Papelera de reciclaje.</p>
              </div>
            </div>
            <p className="text-xs font-semibold text-zinc-700 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
              {deleteTarget.concepto} ({formatEuro(deleteTarget.total)})
            </p>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
