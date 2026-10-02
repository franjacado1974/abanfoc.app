import { useState, useEffect, useMemo } from 'react';
import { 
  Boxes, Plus, Search, Pencil, Trash2, X, Download, 
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  subscribeInventario, 
  addInventarioItem, 
  updateInventarioItem, 
  deleteInventarioItem, 
  subscribeSistemasCategorias,
  type InventarioItem
} from './firebase';

interface InventarioProps {
  user?: { nombre: string; apellidos: string; rol: string; usuario?: string } | null;
}

// Familias de sistemas oficiales por defecto
const SISTEMAS_DEFAULT = [
  'SISTEMA EXTINTORES',
  'SISTEMA BIES',
  'SISTEMA HIDRANTES',
  'SISTEMA CASETAS Y DOTACIÓN',
  'SISTEMA DETECCIÓN AUTOMÁTICA',
  'SISTEMA DETECCIÓN POR ASPIRACIÓN',
  'SISTEMA DETECCIÓN MONÓXIDO (CO)',
  'SISTEMA ROCIADORES / SPRINKLERS',
  'SISTEMA ABASTECIMIENTO / SALA BOMBAS',
  'SISTEMA BOMBA ELÉCTRICA',
  'SISTEMA BOMBA DIÉSEL',
  'SISTEMA BOMBA JOCKEY',
  'SISTEMA ALUMBRADO DE EMERGENCIA',
  'SISTEMA PUERTAS CORTAFUEGO (RF)',
  'SISTEMA EXTINCIÓN POR GAS',
  'SISTEMA EXTINCIÓN CAMPANA COCINA',
  'SISTEMA EXTINCIÓN AGUA / ESPUMA',
  'SISTEMA EXUTORIOS / CONTROL HUMOS',
  'SISTEMA SOBREPRESIÓN / PRESURIZACIÓN',
  'TALLER / GENERAL'
];

const TIPOS_ARTICULO = [
  'Repuesto',
  'Material Nuevo',
  'Equipo Reacondicionado',
  'Fungible / Consumible',
  'Manguera / Tramo',
  'Valvulería / Racores',
  'Herramienta / Maquinaria',
  'Electrónica / Central',
  'Manómetro / Señalización',
  'Otro'
];

const ESTADOS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  'Disponible': {
    label: 'Disponible',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500'
  },
  'Bajo Stock': {
    label: 'Bajo Stock',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
    dot: 'bg-amber-500 animate-pulse'
  },
  'En Taller': {
    label: 'En Taller',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500'
  },
  'Reservado': {
    label: 'Reservado',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500'
  },
  'Agotado': {
    label: 'Agotado',
    badge: 'bg-red-50 text-red-700 border-red-200 font-black',
    dot: 'bg-red-500'
  }
};

export default function Inventario({ user }: InventarioProps) {
  // Lista de artículos en el inventario
  const [items, setItems] = useState<InventarioItem[]>(() => {
    try {
      const cached = localStorage.getItem('firecheck_db_inventario');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Lista de familias de sistemas (mezcla de defaults + categorías de Firestore)
  const [familiasSistemas, setFamiliasSistemas] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_sistemas_categorias');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const names = parsed.map((p: any) => p.nombre).filter(Boolean);
          return Array.from(new Set([...SISTEMAS_DEFAULT, ...names]));
        }
      }
    } catch {}
    return SISTEMAS_DEFAULT;
  });

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroFamilia, setFiltroFamilia] = useState('Todas');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventarioItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventarioItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formArticulo, setFormArticulo] = useState('');
  const [formTipo, setFormTipo] = useState('Repuesto');
  const [formModelo, setFormModelo] = useState('');
  const [formFamilia, setFormFamilia] = useState(SISTEMAS_DEFAULT[0]);
  const [formEstado, setFormEstado] = useState('Disponible');
  const [formCantidad, setFormCantidad] = useState<number | string>(1);
  const [formObservaciones, setFormObservaciones] = useState('');

  // Nombre de usuario actual
  const currentUserName = useMemo(() => {
    if (user?.nombre) return `${user.nombre} ${user.apellidos || ''}`.trim();
    if (user?.usuario) return user.usuario;
    try {
      const saved = localStorage.getItem('firecheck_logged_user') || sessionStorage.getItem('firecheck_logged_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u?.nombre) return `${u.nombre} ${u.apellidos || ''}`.trim();
        if (u?.usuario) return u.usuario;
      }
    } catch {}
    return 'Usuario';
  }, [user]);

  // Suscripción a Firestore en tiempo real
  useEffect(() => {
    const unsub = subscribeInventario((data) => {
      setItems(data);
    });
    return () => unsub();
  }, []);

  // Suscripción a Categorías de Sistemas
  useEffect(() => {
    const unsub = subscribeSistemasCategorias((cats) => {
      if (Array.isArray(cats) && cats.length > 0) {
        const names = cats.map(c => c.nombre).filter(Boolean);
        setFamiliasSistemas(Array.from(new Set([...SISTEMAS_DEFAULT, ...names])));
      }
    });
    return () => unsub();
  }, []);

  // Filtrado de items
  const itemsFiltrados = useMemo(() => {
    return items.filter(it => {
      // Filtro por familia
      if (filtroFamilia !== 'Todas' && it.familia !== filtroFamilia) {
        return false;
      }
      // Filtro por estado
      if (filtroEstado !== 'Todos' && it.estado !== filtroEstado) {
        return false;
      }
      // Filtro por búsqueda
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchArticulo = (it.articulo || '').toLowerCase().includes(q);
        const matchTipo = (it.tipo || '').toLowerCase().includes(q);
        const matchModelo = (it.modelo || '').toLowerCase().includes(q);
        const matchFamilia = (it.familia || '').toLowerCase().includes(q);
        const matchObs = (it.observaciones || '').toLowerCase().includes(q);
        if (!matchArticulo && !matchTipo && !matchModelo && !matchFamilia && !matchObs) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => (a.articulo || '').localeCompare(b.articulo || ''));
  }, [items, filtroFamilia, filtroEstado, searchTerm]);

  // Métricas
  const metricas = useMemo(() => {
    const totalReferencias = items.length;
    let totalUnidades = 0;
    let disponibles = 0;
    let enTaller = 0;
    let bajoStock = 0;

    items.forEach(it => {
      const cant = Number(it.cantidad || 0);
      totalUnidades += cant;
      if (it.estado === 'Disponible') disponibles += cant;
      else if (it.estado === 'En Taller') enTaller += cant;
      else if (it.estado === 'Bajo Stock' || it.estado === 'Agotado') bajoStock += cant;
    });

    return { totalReferencias, totalUnidades, disponibles, enTaller, bajoStock };
  }, [items]);

  // Abrir modal de creación
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormArticulo('');
    setFormTipo('Repuesto');
    setFormModelo('');
    setFormFamilia(filtroFamilia !== 'Todas' ? filtroFamilia : SISTEMAS_DEFAULT[0]);
    setFormEstado('Disponible');
    setFormCantidad(1);
    setFormObservaciones('');
    setModalOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEditModal = (item: InventarioItem) => {
    setEditingItem(item);
    setFormArticulo(item.articulo || '');
    setFormTipo(item.tipo || 'Repuesto');
    setFormModelo(item.modelo || '');
    setFormFamilia(item.familia || SISTEMAS_DEFAULT[0]);
    setFormEstado(item.estado || 'Disponible');
    setFormCantidad(item.cantidad ?? 0);
    setFormObservaciones(item.observaciones || '');
    setModalOpen(true);
  };

  // Guardar item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formArticulo.trim()) {
      alert('Por favor, indica el nombre del artículo.');
      return;
    }

    const cantidadNum = Math.max(0, parseInt(String(formCantidad), 10) || 0);

    // Ajustar estado automáticamente si la cantidad es 0 y estaba Disponible
    let estadoFinal = formEstado;
    if (cantidadNum === 0 && estadoFinal === 'Disponible') {
      estadoFinal = 'Agotado';
    }

    setIsSaving(true);
    try {
      if (editingItem && (editingItem._docId || editingItem.id)) {
        const docId = editingItem._docId || editingItem.id!;
        await updateInventarioItem(docId, {
          articulo: formArticulo.trim(),
          tipo: formTipo.trim(),
          modelo: formModelo.trim(),
          familia: formFamilia,
          estado: estadoFinal,
          cantidad: cantidadNum,
          observaciones: formObservaciones.trim(),
          fechaActualizacion: new Date().toISOString()
        });
      } else {
        await addInventarioItem({
          articulo: formArticulo.trim(),
          tipo: formTipo.trim(),
          modelo: formModelo.trim(),
          familia: formFamilia,
          estado: estadoFinal,
          cantidad: cantidadNum,
          observaciones: formObservaciones.trim(),
          creadoPor: currentUserName,
          fechaCreacion: new Date().toISOString()
        });
      }

      setModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      console.error('Error guardando artículo en inventario:', err);
      alert('Hubo un error al guardar. Por favor, inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  // Ajuste rápido de cantidad (+1 / -1)
  const handleAjustarCantidad = async (item: InventarioItem, delta: number) => {
    const docId = item._docId || item.id;
    if (!docId) return;

    const actual = Number(item.cantidad || 0);
    const nuevaCantidad = Math.max(0, actual + delta);
    let nuevoEstado = item.estado;
    if (nuevaCantidad === 0 && nuevoEstado === 'Disponible') {
      nuevoEstado = 'Agotado';
    } else if (nuevaCantidad > 0 && nuevoEstado === 'Agotado') {
      nuevoEstado = 'Disponible';
    }

    try {
      await updateInventarioItem(docId, {
        cantidad: nuevaCantidad,
        estado: nuevoEstado
      });
    } catch (err) {
      console.error('Error ajustando cantidad:', err);
    }
  };

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const docId = itemToDelete._docId || itemToDelete.id;
    if (!docId) return;

    try {
      await deleteInventarioItem(docId);
      setItemToDelete(null);
    } catch (err) {
      console.error('Error eliminando item:', err);
      alert('Hubo un error al eliminar el artículo.');
    }
  };

  // Exportar a Excel
  const handleExportarExcel = () => {
    if (itemsFiltrados.length === 0) {
      alert('No hay artículos para exportar.');
      return;
    }

    const dataExport = itemsFiltrados.map(it => ({
      'ARTÍCULO': it.articulo,
      'TIPO': it.tipo,
      'MODELO': it.modelo,
      'FAMILIA (SISTEMA)': it.familia,
      'ESTADO': it.estado,
      'CANTIDAD': it.cantidad,
      'OBSERVACIONES': it.observaciones,
      'REGISTRADO': it.creadoPor || '',
      'FECHA': it.fechaCreacion ? it.fechaCreacion.slice(0, 10) : ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    const fechaStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Inventario_Taller_${fechaStr}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Inventario de Taller</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {items.length} {items.length === 1 ? 'artículo' : 'artículos'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Control de materiales, repuestos y stock asociados a familias de sistemas PCI
            </p>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportarExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200/80"
            title="Exportar a Excel"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Artículo</span>
          </button>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Referencias</p>
          <p className="text-2xl font-black text-slate-900 mt-1 leading-none">{metricas.totalReferencias}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stock Total</p>
          <p className="text-2xl font-black text-blue-600 mt-1 leading-none">{metricas.totalUnidades}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Disponibles</p>
          <p className="text-2xl font-black text-emerald-600 mt-1 leading-none">{metricas.disponibles}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">En Taller</p>
          <p className="text-2xl font-black text-amber-600 mt-1 leading-none">{metricas.enTaller}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bajo Stock / Agotados</p>
          <p className="text-2xl font-black text-red-600 mt-1 leading-none">{metricas.bajoStock}</p>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* BUSCADOR */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por artículo, tipo, modelo, observaciones..."
            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* SELECTOR DE FAMILIA (SISTEMA) Y ESTADO */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filtroFamilia}
              onChange={(e) => setFiltroFamilia(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="Todas">Todas las Familias / Sistemas</option>
              {familiasSistemas.map(fam => (
                <option key={fam} value={fam}>{fam}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="Todos">Todos los Estados</option>
              {Object.keys(ESTADOS_CONFIG).map(est => (
                <option key={est} value={est}>{est}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE INVENTARIO */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {itemsFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
              <Boxes className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No se encontraron artículos en el inventario</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {searchTerm || filtroFamilia !== 'Todas' || filtroEstado !== 'Todos'
                ? 'Prueba a cambiar los filtros o el término de búsqueda introducido.'
                : 'Añade el primer artículo del taller para comenzar a controlar el stock por sistemas.'}
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir artículo al inventario
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Artículo</th>
                  <th className="py-3.5 px-3">Tipo</th>
                  <th className="py-3.5 px-3">Modelo</th>
                  <th className="py-3.5 px-3">Familia (Sistema)</th>
                  <th className="py-3.5 px-3">Estado</th>
                  <th className="py-3.5 px-3 text-center">Cantidad</th>
                  <th className="py-3.5 px-4">Observaciones</th>
                  <th className="py-3.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {itemsFiltrados.map((it) => {
                  const estadoCfg = ESTADOS_CONFIG[it.estado] || ESTADOS_CONFIG['Disponible'];
                  const cant = Number(it.cantidad || 0);

                  return (
                    <tr 
                      key={it._docId || it.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* ARTÍCULO */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="truncate max-w-xs">{it.articulo}</span>
                        </div>
                      </td>

                      {/* TIPO */}
                      <td className="py-3.5 px-3 font-medium text-slate-600">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 text-[11px] font-semibold">
                          {it.tipo || 'Repuesto'}
                        </span>
                      </td>

                      {/* MODELO */}
                      <td className="py-3.5 px-3 font-semibold text-slate-700">
                        {it.modelo || <span className="text-slate-300 italic">—</span>}
                      </td>

                      {/* FAMILIA (SISTEMA) */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          {it.familia || 'General'}
                        </span>
                      </td>

                      {/* ESTADO */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${estadoCfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${estadoCfg.dot}`} />
                          {estadoCfg.label}
                        </span>
                      </td>

                      {/* CANTIDAD CON BOTONES RÁPIDOS */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleAjustarCantidad(it, -1)}
                            disabled={cant <= 0}
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed font-bold"
                            title="Restar 1 unidad"
                          >
                            -
                          </button>
                          <span className={`w-7 text-center font-black ${cant === 0 ? 'text-red-600' : cant <= 2 ? 'text-amber-600' : 'text-slate-900'}`}>
                            {cant}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAjustarCantidad(it, 1)}
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-white cursor-pointer font-bold"
                            title="Sumar 1 unidad"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* OBSERVACIONES */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={it.observaciones}>
                        {it.observaciones || <span className="text-slate-300 italic">—</span>}
                      </td>

                      {/* ACCIONES */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(it)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar artículo"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(it)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar artículo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* MODAL CREAR / EDITAR ARTÍCULO */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Boxes className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {editingItem ? 'Editar Artículo de Inventario' : 'Nuevo Artículo de Inventario'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              {/* ARTÍCULO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Artículo / Material <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formArticulo}
                  onChange={(e) => setFormArticulo(e.target.value)}
                  placeholder="Ej: Boquilla manguera BIE 25mm / Válvula 1/2 pulgada"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
              </div>

              {/* TIPO Y MODELO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tipo
                  </label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                  >
                    {TIPOS_ARTICULO.map(tp => (
                      <option key={tp} value={tp}>{tp}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Modelo / Referencia
                  </label>
                  <input
                    type="text"
                    value={formModelo}
                    onChange={(e) => setFormModelo(e.target.value)}
                    placeholder="Ej: MOD-B25 / Ref. 8831"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* FAMILIA (SISTEMA) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Familia (Sistema PCI Asociado) <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-400 normal-case font-normal">Sistemas del taller</span>
                </label>
                <select
                  required
                  value={formFamilia}
                  onChange={(e) => setFormFamilia(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                >
                  {familiasSistemas.map(fam => (
                    <option key={fam} value={fam}>{fam}</option>
                  ))}
                </select>
              </div>

              {/* ESTADO Y CANTIDAD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Estado
                  </label>
                  <select
                    value={formEstado}
                    onChange={(e) => setFormEstado(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                  >
                    {Object.keys(ESTADOS_CONFIG).map(est => (
                      <option key={est} value={est}>{est}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Cantidad (Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formCantidad}
                    onChange={(e) => setFormCantidad(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* OBSERVACIONES */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observaciones / Ubicación en Taller
                </label>
                <textarea
                  rows={3}
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  placeholder="Ej: Estantería B-3, balda central. Repuesto para revisiones de BIEs."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-y"
                />
              </div>

              {/* BOTONES MODAL */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isSaving ? 'Guardando...' : editingItem ? 'Actualizar Artículo' : 'Crear Artículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">¿Eliminar artículo?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Se eliminará <strong>"{itemToDelete.articulo}"</strong> del inventario de taller.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
