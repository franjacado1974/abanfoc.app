import { useState, useEffect, useRef } from 'react';
import { Package, Wrench, Plus, Search, Edit, Trash2, X, Download, Upload, Image as ImageIcon, Copy } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import * as XLSX from 'xlsx';
import { 
  subscribeArticulos, 
  saveArticulo, 
  deleteArticulo, 
  getArticulos,
  subscribeSistemasCategorias,
  uploadFile
} from './firebase';
import { type SistemaCategoria } from './Sistemas';

export interface Articulo {
  id: string;
  codigo: string;
  nombre: string;
  familiaId?: string;
  familia: string;
  precioCompra: number;
  precioVenta: number;
  revisable: boolean;
  fotoUrl?: string;
}

const formatMoneda = (valor: number) => 
  new Intl.NumberFormat('es-ES', { 
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor) || 0);

interface CatalogoProps {
  isTecnicoMode?: boolean;
}

export default function Catalogo({ isTecnicoMode = false }: CatalogoProps) {
  const [tab, setTab] = useState<'articulos' | 'servicios'>('articulos');
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [familias, setFamilias] = useState<SistemaCategoria[]>([]);
  const [isFamiliasLoading, setIsFamiliasLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticulo, setEditingArticulo] = useState<Articulo | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    familiaId: '',
    familia: '',
    precioCompra: '',
    precioVenta: '',
    revisable: true,
    fotoUrl: ''
  });
  
  // State for view modal (Tecnico mode)
  const [viewArticuloModal, setViewArticuloModal] = useState<Articulo | null>(null);

  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [articuloIdToDelete, setArticuloIdToDelete] = useState<string | null>(null);

  // Firebase subscription
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const firebaseArticulos = await getArticulos();
        setArticulos(firebaseArticulos);
        localStorage.setItem('firecheck_db_articulos', JSON.stringify(firebaseArticulos));
      } catch (error) {
        console.error('Error loading articulos from Firebase:', error);
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

    const unsubscribe = subscribeArticulos((firebaseArticulos) => {
      setArticulos(firebaseArticulos);
      localStorage.setItem('firecheck_db_articulos', JSON.stringify(firebaseArticulos));
    });

    return () => unsubscribe();
  }, []);

  // Cargar familias desde Firestore para el desplegable de artículos.
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeSistemasCategorias((familias) => {
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
    try {
      for (const articulo of data) {
        await saveArticulo(articulo);
      }
      localStorage.setItem('firecheck_db_articulos', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving articulos to Firebase:', error);
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
        revisable: articulo.revisable,
        fotoUrl: articulo.fotoUrl || ''
      });
      setFotoPreview(articulo.fotoUrl || '');
    } else {
      setEditingArticulo(null);
      setFormData({ codigo: '', nombre: '', familiaId: '', familia: '', precioCompra: '', precioVenta: '', revisable: true, fotoUrl: '' });
      setFotoPreview('');
    }
    setFotoFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingArticulo(null);
    setFotoFile(null);
    setFotoPreview('');
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.familia.trim()) {
      alert('Debes seleccionar una familia de Firestore antes de guardar el artículo.');
      return;
    }

    setIsSaving(true);
    try {
      let url = formData.fotoUrl;
      if (fotoFile) {
        url = await uploadFile(fotoFile, `articulos/${crypto.randomUUID()}_${fotoFile.name}`);
      }

      const newArticulo: Articulo = {
        id: editingArticulo ? editingArticulo.id : crypto.randomUUID(),
        codigo: formData.codigo.trim(),
        nombre: formData.nombre.trim(),
        familiaId: formData.familiaId && formData.familiaId !== '__current__' ? formData.familiaId : undefined,
        familia: formData.familia.trim(),
        precioCompra: parseFloat(formData.precioCompra) || 0,
        precioVenta: parseFloat(formData.precioVenta) || 0,
        revisable: formData.revisable,
        fotoUrl: url
      };

      if (editingArticulo) {
        const updatedArticulos = articulos.map(a => a.id === editingArticulo.id ? newArticulo : a);
        await saveToDb(updatedArticulos);
      } else {
        const updatedArticulos = [...articulos, newArticulo];
        await saveToDb(updatedArticulos);
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error al guardar articulo:', error);
      alert('Hubo un error al guardar el artículo. Por favor, inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (articulo: Articulo) => {
    const duplicatedArticulo: Articulo = {
      ...articulo,
      id: crypto.randomUUID(),
      codigo: `${articulo.codigo}-COPIA`,
      nombre: `${articulo.nombre} (Copia)`
    };
    
    // Insertar justo después del original
    const index = articulos.findIndex(a => a.id === articulo.id);
    const newArticulos = [...articulos];
    if (index !== -1) {
      newArticulos.splice(index + 1, 0, duplicatedArticulo);
    } else {
      newArticulos.push(duplicatedArticulo);
    }
    
    await saveToDb(newArticulos);
  };

  const handleDelete = (id: string) => {
    setArticuloIdToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteArticulo = async () => {
    if (articuloIdToDelete) {
      setIsConfirmModalOpen(false);
      try {
        await deleteArticulo(articuloIdToDelete);
        setArticulos(articulos.filter(a => a.id !== articuloIdToDelete));
        localStorage.setItem('firecheck_db_articulos', JSON.stringify(articulos.filter(a => a.id !== articuloIdToDelete)));
      } catch (error) {
        console.error('Error deleting articulo from Firebase:', error);
        setArticulos(articulos.filter(a => a.id !== articuloIdToDelete));
        localStorage.setItem('firecheck_db_articulos', JSON.stringify(articulos.filter(a => a.id !== articuloIdToDelete)));
      }
      setArticuloIdToDelete(null);
    }
  };

  const articulosList = tab === 'articulos' 
    ? articulos.filter(a => a.revisable)
    : articulos.filter(a => !a.revisable);

  const filteredArticulos = articulosList.filter(a => 
    a.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.familia.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          const datosFinales = [...articulos];

          data.forEach((item: any) => {
            const codigo = String(item.Codigo || item.codigo || item.CODIGO || '').trim();
            if (!codigo) return;

            const parsePrice = (val: any) => {
              if (val === undefined || val === null) return 0;
              if (typeof val === 'number') return val;
              return parseFloat(String(val).replace(',', '.')) || 0;
            };

            let revisable = true;
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
    <div className="min-h-screen bg-blue-50/40 p-4 md:p-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Catálogo</h1>
          <p className="text-sm text-zinc-500 mt-1">{articulos.length} artículos en el inventario.</p>
        </div>

        {/* Pestañas + botones */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setTab('articulos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'articulos'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <Package className="w-4 h-4" />
              Artículos
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                tab === 'articulos' ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {articulos.filter(a => a.revisable).length}
              </span>
            </button>
            <button
              onClick={() => setTab('servicios')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'servicios'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Servicios
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                tab === 'servicios' ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {articulos.filter(a => !a.revisable).length}
              </span>
            </button>
          </div>
          {!isTecnicoMode && (
            <div className="flex flex-wrap items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImport} 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3.5 py-2 rounded-lg font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm"
                title="Importar Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Importar</span>
              </button>
              <button 
                onClick={handleExport}
                className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3.5 py-2 rounded-lg font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm"
                title="Exportar a Excel"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
              <button 
                onClick={() => handleOpenModal()}
                className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nuevo {tab === 'articulos' ? 'Artículo' : 'Servicio'}</span><span className="sm:hidden">Nuevo</span>
              </button>
            </div>
          )}
        </div>

        {/* Buscador */}
        <div className="relative mb-5">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-zinc-400" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-lg border border-zinc-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 outline-none transition-all shadow-sm text-sm text-zinc-900 placeholder-zinc-400"
            placeholder="Buscar por código, nombre o familia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Lista de Artículos */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden overflow-x-auto">
          <div className={`${isTecnicoMode ? 'hidden' : 'hidden md:flex'} items-center bg-[#f9f7f4] border-b-2 border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500`}>
            <div className="w-24 shrink-0">Código</div>
            <div className="flex-1 min-w-0">Artículo</div>
            <div className="w-36 shrink-0">Familia</div>
            {!isTecnicoMode && <div className="w-28 shrink-0 text-right">P. Compra</div>}
            <div className="w-28 shrink-0 text-right">P. Venta</div>
            <div className="w-24 shrink-0 text-center">Revisable</div>
            {!isTecnicoMode && <div className="w-28 shrink-0 text-right">Acciones</div>}
          </div>

          <div className="divide-y divide-zinc-200">
            {filteredArticulos.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 text-blue-200 mx-auto mb-3" />
                <p className="text-blue-900/50 font-medium">No hay artículos registrados</p>
              </div>
            ) : (
              filteredArticulos.map(a => {
                return (
                  <div key={a.id} className="flex flex-col md:flex-row md:items-center px-4 py-3 hover:bg-zinc-50/80 transition-colors group">
                    {/* Vista Móvil / Tarjeta (Forzada para técnico) */}
                    <div 
                      className={`flex ${isTecnicoMode ? '' : 'md:hidden'} flex-col gap-3 w-full ${isTecnicoMode ? 'cursor-pointer' : ''}`}
                      onClick={() => { if (isTecnicoMode) setViewArticuloModal(a); }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">{a.codigo}</span>
                        {!isTecnicoMode && (
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${a.revisable ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                            {a.revisable ? 'Revisable' : 'No revisable'}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-start gap-3">
                        {a.fotoUrl ? (
                          <img src={a.fotoUrl} alt={a.nombre} className="w-14 h-14 rounded-lg object-cover border border-zinc-200 shrink-0 bg-white" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-zinc-100 border border-zinc-200 shrink-0 flex items-center justify-center">
                            <Package className="w-6 h-6 text-zinc-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-900 leading-snug mb-1">{a.nombre}</p>
                          <p className="text-[11px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded w-fit inline-block">{a.familia || 'Sin familia'}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 mt-1 p-2.5 bg-blue-50/50 rounded-xl border border-blue-100/50">
                        {!isTecnicoMode && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500 font-medium">Precio Compra</span>
                            <span className="text-xs font-bold text-zinc-700">{formatMoneda(a.precioCompra)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-900 font-medium">Precio Venta</span>
                          <span className="text-sm font-bold text-blue-700">{formatMoneda(a.precioVenta)}</span>
                        </div>
                      </div>

                      {!isTecnicoMode && (
                        <div className="flex items-center justify-end gap-1.5 mt-2">
                          <button onClick={() => handleDuplicate(a)} className="flex-1 py-2 text-zinc-600 bg-zinc-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5">
                            <Copy className="w-3.5 h-3.5" /> Copiar
                          </button>
                          <button onClick={() => handleOpenModal(a)} className="flex-1 py-2 text-zinc-600 bg-zinc-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5">
                            <Edit className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button onClick={() => handleDelete(a.id)} className="px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Vista Escritorio */}
                    <div className={`${isTecnicoMode ? 'hidden' : 'hidden md:flex'} items-center w-full`}>
                      <div className="w-24 shrink-0">
                        <span className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{a.codigo}</span>
                      </div>
                      <div className="flex-1 min-w-0 pr-2 flex items-center gap-3">
                        {a.fotoUrl ? (
                          <img src={a.fotoUrl} alt={a.nombre} className="w-8 h-8 rounded-lg object-cover border border-zinc-200 shrink-0 bg-white" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 shrink-0 flex items-center justify-center">
                            <Package className="w-4 h-4 text-zinc-400" />
                          </div>
                        )}
                        <p className="text-sm font-bold text-zinc-900 truncate group-hover:text-blue-900 transition-colors">{a.nombre}</p>
                      </div>
                      <div className="w-36 shrink-0 text-sm text-zinc-600 truncate pr-2">{a.familia || '-'}</div>
                      {!isTecnicoMode && <div className="w-28 shrink-0 text-sm text-zinc-600 text-right pr-2">{formatMoneda(a.precioCompra)}</div>}
                      <div className="w-28 shrink-0 text-sm text-zinc-600 text-right pr-2">{formatMoneda(a.precioVenta)}</div>
                      <div className="w-24 shrink-0 text-center">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${a.revisable ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                          {a.revisable ? 'Sí' : 'No'}
                        </span>
                      </div>
                      {!isTecnicoMode && (
                        <div className="w-28 shrink-0 flex items-center justify-end gap-1">
                          <button onClick={() => handleDuplicate(a)} className="p-1.5 text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors" title="Duplicar">
                            <Copy className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleOpenModal(a)} className="p-1.5 text-zinc-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(a.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors" title="Borrar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            </div>
        </div>
      </div>

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-blue-950/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-blue-50/30">
              <h2 className="text-xl font-bold text-blue-950">
                {editingArticulo ? 'Editar Artículo' : 'Nuevo Artículo'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 text-blue-400 hover:text-blue-700 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <label className="text-sm font-medium text-blue-950 w-full">Foto del Artículo</label>
                <div className="relative w-full h-40 bg-blue-50/50 border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center overflow-hidden hover:bg-blue-50 transition-colors group cursor-pointer">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Vista previa" className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="flex flex-col items-center text-blue-400 group-hover:text-blue-600 transition-colors">
                      <ImageIcon className="w-8 h-8 mb-2" />
                      <span className="text-sm font-medium">Subir Imagen</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFotoChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-950">Código</label>
                  <input
                    required
                    type="text"
                    value={formData.codigo}
                    onChange={e => setFormData({...formData, codigo: e.target.value})}
                    className="w-full px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-blue-950"
                    placeholder="Ej: EXT-001"
                  />
                </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-blue-950">Familia</label>
                    <select
                      required
                      value={formData.familiaId || (formData.familia ? '__current__' : '')}
                      disabled={isFamiliasLoading || selectFamiliaOptions.length === 0}
                      onChange={e => handleFamiliaChange(e.target.value)}
                      className="w-full px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-blue-950 disabled:opacity-60 disabled:cursor-not-allowed"
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
                <label className="text-sm font-medium text-blue-950">Nombre / Descripción</label>
                <input
                  required
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className="w-full px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-blue-950"
                  placeholder="Ej: Extintor Polvo ABC 6kg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-950">Precio Compra (€)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioCompra}
                    onChange={e => setFormData({...formData, precioCompra: e.target.value})}
                    className="w-full px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-blue-950"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-950">Precio Venta s/IVA (€)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioVenta}
                    onChange={e => setFormData({...formData, precioVenta: e.target.value})}
                    className="w-full px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-blue-950"
                    placeholder="0.00"
                  />
                </div>
               </div>

               <div className="flex items-center gap-4">
                 <label className="text-sm font-medium text-blue-950">Equipo revisable en los mantenimientos</label>
                 <input
                   type="checkbox"
                   checked={formData.revisable}
                   onChange={e => setFormData({...formData, revisable: e.target.checked})}
                   className="w-4 h-4 text-blue-600"
                 />
               </div>

              <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-200/50 flex justify-between items-center">
                <span className="text-xs font-medium text-blue-700">Precio Final (IVA 21%)</span>
                <span className="text-lg font-bold text-blue-900">
                  {formData.precioVenta ? formatMoneda(parseFloat(formData.precioVenta) * 1.21) : formatMoneda(0)}
                </span>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vista Detalle (Tecnico) */}
      {viewArticuloModal && (
        <div className="fixed inset-0 bg-blue-950/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-blue-50/30">
              <h2 className="text-xl font-bold text-blue-950">
                Información del Artículo
              </h2>
              <button onClick={() => setViewArticuloModal(null)} className="p-2 text-blue-400 hover:text-blue-700 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center gap-3">
                {viewArticuloModal.fotoUrl ? (
                  <div className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden flex items-center justify-center p-2">
                    <img src={viewArticuloModal.fotoUrl} alt={viewArticuloModal.nombre} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col items-center justify-center text-zinc-400">
                    <Package className="w-12 h-12 mb-2 opacity-50" />
                    <span className="text-sm font-medium">Sin imagen</span>
                  </div>
                )}
              </div>

              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Código</label>
                  <p className="text-sm font-mono font-bold text-zinc-800 bg-white px-2 py-1 rounded border border-zinc-200 w-fit">
                    {viewArticuloModal.codigo}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Familia</label>
                  <p className="text-sm font-medium text-zinc-800">
                    {viewArticuloModal.familia || 'Sin familia'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Nombre / Descripción</label>
                  <p className="text-sm font-bold text-zinc-900 leading-relaxed">
                    {viewArticuloModal.nombre}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-blue-900 uppercase tracking-wider block mb-1">Precio Venta</label>
                  <p className="text-xl font-bold text-blue-700">
                    {formatMoneda(viewArticuloModal.precioVenta)}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setViewArticuloModal(null)}
                  className="w-full px-4 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors shadow-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
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
