import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Edit, Trash2, X, Download, Upload } from 'lucide-react';
import { HandOptionsIcon } from './components/HandOptionsIcon';
import ConfirmationModal from './ConfirmationModal'; // Import the new modal component
import * as XLSX from 'xlsx';
import { 
  subscribeArticulos, 
  saveArticulo, 
  deleteArticulo, 
  getArticulos,
  subscribeSistemasCategorias, // Changed from subscribeFamilias
} from './firebase'; // Assuming firebase.ts also uses SistemaCategoria internally or exports it
import { type SistemaCategoria } from './Sistemas'; // Import SistemaCategoria from Sistemas.tsx

export interface Articulo {
  id: string;
  codigo: string;
  nombre: string;
  familiaId?: string;
  familia: string;
  precioCompra: number;
  precioVenta: number;
  revisable: boolean;
}

const formatMoneda = (valor: any) => {
  const num = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : Number(valor);
  if (isNaN(num)) return '0,00 €';
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${parts.join(',')} €`;
};

export default function Articulos() {
  const navigate = useNavigate();
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [familias, setFamilias] = useState<SistemaCategoria[]>([]); // This will now hold SistemaCategoria
  const [isFamiliasLoading, setIsFamiliasLoading] = useState(true);
  const [limiteArticulos, setLimiteArticulos] = useState<number | 'todos'>(10);
  const [accionesModalItem, setAccionesModalItem] = useState<Articulo | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticulo, setEditingArticulo] = useState<Articulo | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    familiaId: '',
    familia: '',
    precioCompra: '',
    precioVenta: '',
    revisable: true
  });
  
  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [articuloIdToDelete, setArticuloIdToDelete] = useState<string | null>(null);

  // Firebase subscription
  useEffect(() => {
    // Load initial data from Firebase
    const loadInitialData = async () => {
      try {
        const firebaseArticulos = await getArticulos();
        setArticulos(firebaseArticulos);
        // Also save to localStorage as backup
        localStorage.setItem('firecheck_db_articulos', JSON.stringify(firebaseArticulos));
      } catch (error) {
        console.error('Error loading articulos from Firebase:', error);
        // Fallback to localStorage
        const saved = localStorage.getItem('firecheck_db_articulos');
        if (saved) {
          try {
            setArticulos(JSON.parse(saved));
          } catch (parseError) {
            console.error('Error parsing articulos from localStorage:', parseError);
            setArticulos([]);
          }
        } else {
          setArticulos([]);
        }
      }
    };

    loadInitialData();

    // Subscribe to real-time updates from Firebase
    const unsubscribe = subscribeArticulos((firebaseArticulos) => {
      setArticulos(firebaseArticulos);
      // Update localStorage as backup
      localStorage.setItem('firecheck_db_articulos', JSON.stringify(firebaseArticulos));
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Cargar familias desde Firestore para el desplegable de artículos.
  useEffect(() => { // Changed to subscribeSistemasCategorias
    let isMounted = true;

    const unsubscribe = subscribeSistemasCategorias((familias) => { // Subscribing to SistemaCategorias
      if (isMounted) {
        setFamilias(familias);
        setIsFamiliasLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setFormData(prev => {
      if (!prev.familiaId || prev.familiaId === '__current__') return prev;
      const familia = familias.find(item => item.id === prev.familiaId);
      if (!familia || familia.nombre === prev.familia) return prev;
      return { ...prev, familia: familia.nombre };
    });
  }, [familias]);

  const saveToDb = async (data: Articulo[]) => {
    setArticulos(data);
    // Save to Firebase
    try {
      // Save each articulo individually
      for (const articulo of data) {
        await saveArticulo(articulo);
      }
      // Also save to localStorage as backup
      localStorage.setItem('firecheck_db_articulos', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving articulos to Firebase:', error);
      // Still update localStorage even if Firebase fails
      localStorage.setItem('firecheck_db_articulos', JSON.stringify(data));
    }
  };

  const handleOpenModal = (articulo?: Articulo) => {
    if (articulo) {
      setEditingArticulo(articulo);
      setFormData({
        codigo: articulo.codigo,
        nombre: articulo.nombre, 
        familiaId: articulo.familiaId || familias.find(familia => familia.nombre === articulo.familia)?.id || '',
        familia: articulo.familia,
        precioCompra: articulo.precioCompra.toString(),
        precioVenta: articulo.precioVenta.toString(),
        revisable: articulo.revisable
      });
    } else {
      setEditingArticulo(null);
      setFormData({ codigo: '', nombre: '', familiaId: '', familia: '', precioCompra: '', precioVenta: '', revisable: true });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingArticulo(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.familia.trim()) {
      alert('Debes seleccionar una familia de Firestore antes de guardar el artículo.');
      return;
    }

    const newArticulo: Articulo = {
      id: editingArticulo ? editingArticulo.id : crypto.randomUUID(),
      codigo: formData.codigo.trim(),
      nombre: formData.nombre.trim(),
      familiaId: formData.familiaId && formData.familiaId !== '__current__' ? formData.familiaId : undefined,
      familia: formData.familia.trim(),
      precioCompra: parseFloat(formData.precioCompra) || 0,
      precioVenta: parseFloat(formData.precioVenta) || 0,
      revisable: formData.revisable
    };

    if (editingArticulo) {
      // Update existing articulo
      const updatedArticulos = articulos.map(a => a.id === editingArticulo.id ? newArticulo : a);
      await saveToDb(updatedArticulos);
    } else {
      // Add new articulo
      const updatedArticulos = [...articulos, newArticulo];
      await saveToDb(updatedArticulos);
    }
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    setArticuloIdToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteArticulo = async () => {
    if (articuloIdToDelete) {
      setIsConfirmModalOpen(false);
      try {
        // Delete from Firebase
        await deleteArticulo(articuloIdToDelete);
        // Update local state
        setArticulos(articulos.filter(a => a.id !== articuloIdToDelete));
        // Update localStorage
        localStorage.setItem('firecheck_db_articulos', JSON.stringify(articulos.filter(a => a.id !== articuloIdToDelete)));
      } catch (error) {
        console.error('Error deleting articulo from Firebase:', error);
        // Fallback to localStorage only
        setArticulos(articulos.filter(a => a.id !== articuloIdToDelete));
        localStorage.setItem('firecheck_db_articulos', JSON.stringify(articulos.filter(a => a.id !== articuloIdToDelete)));
      }
      setArticuloIdToDelete(null);
    }
  };

  const filteredArticulos = articulos.filter(a => 
    a.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.familia.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const articulosAMostrar = useMemo(() => {
    if (limiteArticulos === 'todos') return filteredArticulos;
    return filteredArticulos.slice(0, Number(limiteArticulos));
  }, [filteredArticulos, limiteArticulos]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentFamiliaIsAvailable = familias.some(familia =>
    familia.id === formData.familiaId || familia.nombre === formData.familia
  );
  const selectFamiliaOptions = formData.familia && !currentFamiliaIsAvailable
    ? [{ id: '__current__', nombre: formData.familia }, ...familias]
    : familias;

  const handleFamiliaChange = (familiaId: string) => {
    if (familiaId === '__current__') return;
    const selectedFamilia = familias.find(familia => familia.id === familiaId);
    setFormData({
      ...formData,
      familiaId,
      familia: selectedFamilia?.nombre || '',
    });
  };

  const handleExport = () => {
    if (articulos.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(articulos.map(item => ({
      Codigo: item.codigo,
      Familia: item.familia,
      Nombre: item.nombre,
      PrecioCompra: item.precioCompra,
      PrecioVenta: item.precioVenta,
      Revisable: item.revisable ? 'Sí' : 'No'
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Articulos");
    XLSX.writeFile(workbook, "Articulos.xlsx");
  };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const targetInput = e.target;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result;
          const wb = XLSX.read(arrayBuffer, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          
          if (!data || data.length === 0) {
            alert('El archivo Excel está vacío o no se pudo leer correctamente.');
            targetInput.value = '';
            return;
          }

          let importados = 0;
          let actualizados = 0;
          const datosFinales = [...articulos]; // Copia del estado actual

          data.forEach((item: any) => {
            const codigo = String(item.Codigo || item.codigo || item.CODIGO || '').trim();
            if (!codigo) return;

            const parsePrice = (val: any) => {
              if (val === undefined || val === null) return 0;
              if (typeof val === 'number') return val;
              return parseFloat(String(val).replace(',', '.')) || 0;
            };

            // Handle Revisable field (could be boolean, string, or Excel value)
            let revisable = true; // Default value
            if (item.Revisable !== undefined && item.Revisable !== null) {
              if (typeof item.Revisable === 'boolean') {
                revisable = item.Revisable;
              } else if (typeof item.Revisable === 'string') {
                revisable = item.Revisable.toLowerCase() === 'sí' || 
                         item.Revisable.toLowerCase() === 'si' || 
                         item.Revisable.toLowerCase() === 'yes' || 
                         item.Revisable.toLowerCase() === 'true' || 
                         item.Revisable === '1';
              } else {
                // Assume numeric: 0 = false, anything else = true
                revisable = parseFloat(item.Revisable) !== 0;
              }
            }

            const nuevoItem = {
              id: crypto.randomUUID(),
              codigo: codigo,
              nombre: String(item.Nombre || item.nombre || item.NOMBRE || ''),
              familia: String(item.Familia || item.familia || item.FAMILIA || ''),
              precioCompra: parsePrice(item.PrecioCompra || item.precioCompra || item.PRECIOCOMPRA),
              precioVenta: parsePrice(item.PrecioVenta || item.precioVenta || item.PRECIOVENTA),
              revisable: revisable
            };

            const indexExistente = datosFinales.findIndex((x) => x.codigo === codigo);
            
            if (indexExistente >= 0) {
              datosFinales[indexExistente] = { ...datosFinales[indexExistente], ...nuevoItem, id: datosFinales[indexExistente].id };
              actualizados++;
            } else {
              datosFinales.push(nuevoItem);
              importados++;
            }
          });

          // Guardar actualizando estado y localStorage simultáneamente
          saveToDb(datosFinales);
          alert(`¡Importación completada!\nNuevos añadidos: ${importados}\nActualizados: ${actualizados}`);
        } catch (error) {
          console.error(error);
          alert('Error al importar el archivo. Asegúrate de que es un archivo Excel válido.');
        }
        targetInput.value = '';
      };
      reader.readAsArrayBuffer(file);
    };

  return (
    <div className="min-h-screen bg-fuchsia-50/40 p-6 md:p-12">
      <div className="max-w-5xl mx-auto w-full">
        <button onClick={() => navigate('/catalogo')} className="text-sm font-medium text-fuchsia-600 hover:text-fuchsia-950 mb-8 flex items-center gap-2 transition-colors mx-auto md:mx-0">
          ← Volver a Catálogo
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="text-center md:text-left flex flex-col items-center md:items-start">
            <h1 className="text-3xl font-bold text-fuchsia-950 tracking-tight flex items-center justify-center md:justify-start gap-3">
              <div className="w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              Artículos
            </h1>
            <p className="text-fuchsia-900/60 mt-1">Gestiona el inventario de repuestos y productos</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-60 lg:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por código, nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-zinc-200 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/10 outline-none transition-all shadow-xs text-xs text-zinc-900 placeholder-zinc-400"
              />
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImport} 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 bg-white border border-fuchsia-200 hover:border-fuchsia-300 text-fuchsia-700 px-3.5 py-2 rounded-xl font-medium transition-colors shadow-xs text-xs"
              title="Importar Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-1.5 bg-white border border-fuchsia-200 hover:border-fuchsia-300 text-fuchsia-700 px-3.5 py-2 rounded-xl font-medium transition-colors shadow-xs text-xs"
              title="Exportar a Excel"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="flex items-center justify-center gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-xs text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo
            </button>
          </div>
        </div>

        {/* Lista de Artículos */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden overflow-x-auto">
          <div className="hidden md:flex items-center bg-zinc-200/90 border-b border-zinc-300 px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 w-full">
            <div className="w-24 shrink-0 pr-3">Código</div>
            <div className="flex-1 min-w-0 pr-4">Artículo</div>
            <div className="w-40 lg:w-48 shrink-0 pr-4">Familia</div>
            <div className="w-28 lg:w-32 shrink-0 text-right pr-4">P. Compra</div>
            <div className="w-28 lg:w-32 shrink-0 text-right pr-4">P. Venta</div>
            <div className="w-24 shrink-0 text-center">Revisable</div>
          </div>

          <div className="divide-y divide-zinc-200">
            {filteredArticulos.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 text-blue-200 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No hay artículos registrados</p>
              </div>
            ) : (
              articulosAMostrar.map((a, index) => {
                return (
                  <div 
                    key={a.id} 
                    className={`flex flex-col md:flex-row md:items-center px-4 py-2.5 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'} hover:bg-amber-100/90 hover:shadow-xs transition-colors cursor-pointer group`}
                    onClick={() => setAccionesModalItem(a)}
                  >
                    <div className="flex md:hidden items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-medium text-slate-500 bg-white/90 border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">{a.codigo}</span>
                    </div>
                    <div className="flex md:hidden mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{a.nombre}</p>
                        <p className="text-xs text-slate-500">{a.familia}</p>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center w-full">
                      <div className="w-24 shrink-0 pr-3">
                        <span className="text-[11px] font-mono font-medium text-slate-600 bg-white/90 border border-zinc-200/80 hover:bg-amber-50 hover:text-amber-800 px-2 py-0.5 rounded transition-colors shadow-2xs">{a.codigo}</span>
                      </div>
                      <div className="flex-1 min-w-0 pr-4 group/title">
                        <p className="text-sm font-medium text-slate-800 truncate group-hover/title:text-blue-900 transition-colors">{a.nombre}</p>
                      </div>
                      <div className="w-40 lg:w-48 shrink-0 text-xs text-slate-600 truncate pr-4">{a.familia || '—'}</div>
                      <div className="w-28 lg:w-32 shrink-0 text-xs text-slate-600 text-right pr-4">{formatMoneda(a.precioCompra)}</div>
                      <div className="w-28 lg:w-32 shrink-0 text-xs font-semibold text-slate-700 text-right pr-4">{formatMoneda(a.precioVenta)}</div>
                      <div className="w-24 shrink-0 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${a.revisable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {a.revisable ? 'Sí' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selector de paginación */}
        {filteredArticulos.length > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 bg-white px-5 py-3.5 rounded-2xl border border-zinc-200/80 shadow-xs">
            <div className="font-bold text-zinc-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
              {limiteArticulos === 'todos' ? (
                <span>Mostrando todos los artículos ({filteredArticulos.length} en total)</span>
              ) : (
                <span>
                  Mostrando los {Math.min(Number(limiteArticulos), filteredArticulos.length)} primeros artículos
                  {filteredArticulos.length > Number(limiteArticulos) && (
                    <span className="text-zinc-400 font-normal ml-1">
                      (de {filteredArticulos.length} en total)
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-zinc-500 font-semibold uppercase text-[11px] tracking-wider">Mostrar:</span>
              <select
                value={limiteArticulos}
                onChange={(e) => setLimiteArticulos(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold rounded-xl px-3.5 py-1.5 outline-none focus:border-blue-500 focus:bg-white cursor-pointer transition-colors shadow-2xs"
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

        {/* MODAL FLOTANTE DE ACCIONES (VARITA MÁGICA) */}
        {accionesModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
              className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera del modal */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                    <HandOptionsIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Acciones del Artículo</h3>
                    <p className="text-xs text-slate-500 truncate max-w-xs">{accionesModalItem.codigo} - {accionesModalItem.nombre}</p>
                  </div>
                </div>
                <button
                  onClick={() => setAccionesModalItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tarjeta resumen del artículo */}
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {accionesModalItem.codigo}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{formatMoneda(accionesModalItem.precioVenta)}</span>
                  </div>
                  <div className="font-medium text-slate-800 text-sm">{accionesModalItem.nombre}</div>
                  <div className="flex items-center gap-4 text-slate-500 flex-wrap">
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200/80 text-[10px]">{accionesModalItem.familia || 'Sin familia'}</span>
                    <span className="text-slate-400">P. Compra: <strong className="text-slate-600">{formatMoneda(accionesModalItem.precioCompra)}</strong></span>
                  </div>
                </div>

                {/* Lista de acciones */}
                <div className="space-y-2">
                  {/* 1. Editar Artículo */}
                  <button
                    onClick={() => {
                      const art = accionesModalItem;
                      setAccionesModalItem(null);
                      handleOpenModal(art);
                    }}
                    className="w-full p-3 rounded-2xl bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200/80 flex items-center gap-3.5 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Edit className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-blue-900">Editar Artículo</div>
                      <div className="text-[11px] text-blue-700/80">Modificar código, nombre, precios y familia</div>
                    </div>
                  </button>

                  {/* 2. Eliminar Artículo */}
                  <button
                    onClick={() => {
                      const art = accionesModalItem;
                      setAccionesModalItem(null);
                      handleDelete(art.id);
                    }}
                    className="w-full p-3 rounded-2xl bg-red-50/60 hover:bg-red-100/80 border border-red-200/80 flex items-center gap-3.5 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-red-900">Eliminar Artículo</div>
                      <div className="text-[11px] text-red-700/80">Dar de baja del catálogo permanentemente</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Footer del modal */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setAccionesModalItem(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-fuchsia-950/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-fuchsia-100 flex items-center justify-between bg-fuchsia-50/30">
              <h2 className="text-xl font-bold text-fuchsia-950">
                {editingArticulo ? 'Editar Artículo' : 'Nuevo Artículo'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 text-fuchsia-400 hover:text-fuchsia-700 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-fuchsia-950">Código</label>
                  <input
                    required
                    type="text"
                    value={formData.codigo}
                    onChange={e => setFormData({...formData, codigo: e.target.value})}
                    className="w-full px-4 py-2.5 bg-fuchsia-50/50 border border-fuchsia-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all text-fuchsia-950"
                    placeholder="Ej: EXT-001"
                  />
                </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-fuchsia-950">Familia</label>
                    <select
                      required
                      value={formData.familiaId || (formData.familia ? '__current__' : '')}
                      disabled={isFamiliasLoading || selectFamiliaOptions.length === 0}
                      onChange={e => handleFamiliaChange(e.target.value)}
                      className="w-full px-4 py-2.5 bg-fuchsia-50/50 border border-fuchsia-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all text-fuchsia-950 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {isFamiliasLoading ? 'Cargando familias...' : '-- Selecciona familia --'}
                      </option>
                      {selectFamiliaOptions.map(option => (
                        <option key={option.id} value={option.id}>{option.nombre}</option>
                      ))}
                    </select>
                    {!isFamiliasLoading && selectFamiliaOptions.length === 0 && (
                      <p className="text-xs text-amber-600 font-medium">
                        No hay familias disponibles en Firestore. Añade documentos en la colección "familias".
                      </p>
                    )}
                  </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-fuchsia-950">Nombre / Descripción</label>
                <input
                  required
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className="w-full px-4 py-2.5 bg-fuchsia-50/50 border border-fuchsia-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all text-fuchsia-950"
                  placeholder="Ej: Extintor Polvo ABC 6kg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-fuchsia-950">Precio Compra (€)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioCompra}
                    onChange={e => setFormData({...formData, precioCompra: e.target.value})}
                    className="w-full px-4 py-2.5 bg-fuchsia-50/50 border border-fuchsia-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all text-fuchsia-950"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-fuchsia-950">Precio Venta s/IVA (€)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioVenta}
                    onChange={e => setFormData({...formData, precioVenta: e.target.value})}
                    className="w-full px-4 py-2.5 bg-fuchsia-50/50 border border-fuchsia-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all text-fuchsia-950"
                    placeholder="0.00"
                  />
                </div>
               </div>

               <div className="flex items-center gap-4">
                 <label className="text-sm font-medium text-fuchsia-950">Equipo revisable en los mantenimientos</label>
                 <input
                   type="checkbox"
                   checked={formData.revisable}
                   onChange={e => setFormData({...formData, revisable: e.target.checked})}
                   className="w-4 h-4 text-fuchsia-600"
                 />
               </div>

               {/* Previsualización del IVA */}
              <div className="mt-2 p-3 bg-fuchsia-50 rounded-xl border border-fuchsia-200/50 flex justify-between items-center">
                <span className="text-xs font-medium text-fuchsia-700">Precio Final (IVA 21%)</span>
                <span className="text-lg font-bold text-fuchsia-900">
                  {formData.precioVenta ? formatMoneda(parseFloat(formData.precioVenta) * 1.21) : formatMoneda(0)}
                </span>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2.5 text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl font-medium transition-colors shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && articuloIdToDelete && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={confirmDeleteArticulo}
          title="Confirmar Eliminación"
          message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?"
          confirmText="Sí, eliminar"
          cancelText="No, cancelar"
        />
      )}
    </div>
  );
}
