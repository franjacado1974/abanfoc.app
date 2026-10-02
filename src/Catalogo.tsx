import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Wrench, Plus, Search, Edit, Trash2, X, Download, Upload, Image as ImageIcon, Copy, ArrowLeft, Check, Minus } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import * as XLSX from 'xlsx';
import { 
  subscribeArticulos, 
  saveArticulo, 
  deleteArticulo, 
  getArticulos,
  subscribeSistemasCategorias,
  uploadFile,
  registrarAvisoStock,
  desactivarAvisoStock
} from './firebase';
import { type SistemaCategoria } from './Sistemas';
import { removeWhiteBackground } from './pdfGenerator';

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
  tipo?: string;
  modelo?: string;
  cantidad?: number;
  estado?: 'Nuevo' | 'Usado' | 'Reparado' | string;
  observaciones?: string;
}

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

const ESTADOS_ARTICULO: Record<string, { label: string; badge: string; dot: string }> = {
  'Nuevo': {
    label: 'Nuevo',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
    dot: 'bg-emerald-500'
  },
  'Usado': {
    label: 'Usado',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
    dot: 'bg-amber-500'
  },
  'Reparado': {
    label: 'Reparado',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
    dot: 'bg-blue-500'
  }
};

const getEstadoCfg = (estado?: string) => {
  if (estado && ESTADOS_ARTICULO[estado]) return ESTADOS_ARTICULO[estado];
  return ESTADOS_ARTICULO['Nuevo'];
};

const formatMoneda = (valor: any) => {
  const num = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : Number(valor);
  if (isNaN(num)) return '0,00 €';
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${parts.join(',')} €`;
};

interface CatalogoProps {
  isTecnicoMode?: boolean;
  userRole?: string;
  user?: { rol?: string; nombre?: string; [key: string]: any } | null;
}

export default function Catalogo({ isTecnicoMode = false, userRole, user }: CatalogoProps) {
  const navigate = useNavigate();

  // Determinar rol efectivo
  const currentRole = (() => {
    if (userRole) return userRole;
    if (user?.rol) return user.rol;
    try {
      const saved = localStorage.getItem('firecheck_logged_user') || sessionStorage.getItem('firecheck_logged_user');
      if (saved) {
        const u = JSON.parse(saved);
        return u?.rol;
      }
    } catch { /* ignore */ }
    return undefined;
  })();

  const isTecnico = isTecnicoMode || currentRole === 'tecnico';

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
    fotoUrl: '',
    tipo: 'Repuesto',
    modelo: '',
    cantidad: '',
    estado: 'Nuevo',
    observaciones: ''
  });
  
  // State for view modal (Tecnico mode)
  const [viewArticuloModal, setViewArticuloModal] = useState<Articulo | null>(null);

  // Estados para ajuste de stock exclusivo para rol de técnico
  const [stockInputValue, setStockInputValue] = useState<string>('');
  const [isSavingStock, setIsSavingStock] = useState<boolean>(false);
  const [stockSuccessFeedback, setStockSuccessFeedback] = useState<boolean>(false);

  useEffect(() => {
    if (viewArticuloModal) {
      setStockInputValue(
        viewArticuloModal.cantidad !== undefined && viewArticuloModal.cantidad !== null
          ? String(viewArticuloModal.cantidad)
          : ''
      );
      setStockSuccessFeedback(false);
    }
  }, [viewArticuloModal]);

  const handleUpdateStockOnly = async (articulo: Articulo, nuevoStockStr: string) => {
    const rawVal = nuevoStockStr.trim();
    const cantNum = rawVal === '' ? undefined : parseInt(rawVal, 10);
    const validCant = (cantNum !== undefined && !isNaN(cantNum)) ? Math.max(0, cantNum) : undefined;

    const updatedArticulo: Articulo = {
      ...articulo,
      cantidad: validCant
    };

    try {
      await saveArticulo(updatedArticulo);
      if (validCant === 0) {
        await registrarAvisoStock({
          id: updatedArticulo.id,
          articuloId: updatedArticulo.id,
          codigo: updatedArticulo.codigo,
          nombre: updatedArticulo.nombre,
          familia: updatedArticulo.familia,
          tipo: updatedArticulo.tipo,
          modelo: updatedArticulo.modelo,
          fotoUrl: updatedArticulo.fotoUrl,
          observaciones: updatedArticulo.observaciones,
          fecha: new Date().toISOString(),
          timestamp: Date.now(),
          activo: true
        });
      } else {
        await desactivarAvisoStock(updatedArticulo.id);
      }

      const updatedList = articulos.map(a => a.id === updatedArticulo.id ? updatedArticulo : a);
      setArticulos(updatedList);
      localStorage.setItem('firecheck_db_articulos', JSON.stringify(updatedList));

      if (viewArticuloModal && viewArticuloModal.id === updatedArticulo.id) {
        setViewArticuloModal(updatedArticulo);
      }
    } catch (err) {
      console.error('Error al actualizar stock:', err);
      alert('Error al actualizar el stock del artículo.');
    }
  };

  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [articuloIdToDelete, setArticuloIdToDelete] = useState<string | null>(null);

  // Firebase subscription
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const firebaseArticulos = await getArticulos();
        
        // Asegurar que todos los artículos comiencen con el stock en blanco tras la petición del usuario
        const hasRunStockReset = localStorage.getItem('firecheck_stock_reset_blank_v1') === 'true';
        if (!hasRunStockReset && Array.isArray(firebaseArticulos) && firebaseArticulos.length > 0) {
          const articulosConStockCero = firebaseArticulos.filter(a => a.cantidad === 0);
          if (articulosConStockCero.length > 0) {
            for (const a of articulosConStockCero) {
              const cleaned = { ...a };
              delete cleaned.cantidad;
              if (cleaned.estado === 'Agotado') cleaned.estado = 'Disponible';
              try {
                await saveArticulo(cleaned);
                await desactivarAvisoStock(cleaned.id);
              } catch { /* ignore */ }
            }
          }
          localStorage.setItem('firecheck_stock_reset_blank_v1', 'true');
        }

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
    if (isTecnico) {
      if (articulo) setViewArticuloModal(articulo);
      return;
    }
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
        fotoUrl: articulo.fotoUrl || '',
        tipo: articulo.tipo || 'Repuesto',
        modelo: articulo.modelo || '',
        cantidad: (articulo.cantidad !== undefined && articulo.cantidad !== null) 
          ? String(articulo.cantidad) 
          : '',
        estado: (articulo.estado === 'Usado' || articulo.estado === 'Reparado') ? articulo.estado : 'Nuevo',
        observaciones: articulo.observaciones || ''
      });
      setFotoPreview(articulo.fotoUrl || '');
    } else {
      setEditingArticulo(null);
      setFormData({ 
        codigo: '', 
        nombre: '', 
        familiaId: '', 
        familia: '', 
        precioCompra: '', 
        precioVenta: '', 
        revisable: true, 
        fotoUrl: '',
        tipo: 'Repuesto',
        modelo: '',
        cantidad: '',
        estado: 'Nuevo',
        observaciones: ''
      });
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
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        try {
          // Eliminar fondo blanco/claro automáticamente al cargar la foto
          const sinFondoBase64 = await removeWhiteBackground(rawBase64, 800);
          setFotoPreview(sinFondoBase64);
          // Convertir el base64 sin fondo (PNG) a File para subir a Firebase Storage
          const res = await fetch(sinFondoBase64);
          const blob = await res.blob();
          const cleanFile = new File([blob], `${file.name.replace(/\.[^/.]+$/, '')}_nobg.png`, { type: 'image/png' });
          setFotoFile(cleanFile);
        } catch {
          setFotoFile(file);
          setFotoPreview(rawBase64);
        }
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

      const cantTrim = formData.cantidad.trim();
      const hasStock = cantTrim !== '' && !isNaN(Number(cantTrim));
      const cantNum = hasStock ? Math.max(0, parseInt(cantTrim, 10)) : undefined;

      const estadoFinal = (formData.estado === 'Usado' || formData.estado === 'Reparado') ? formData.estado : 'Nuevo';

      const newArticulo: Articulo = {
        id: editingArticulo ? editingArticulo.id : crypto.randomUUID(),
        codigo: formData.codigo.trim(),
        nombre: formData.nombre.trim(),
        familiaId: formData.familiaId && formData.familiaId !== '__current__' ? formData.familiaId : undefined,
        familia: formData.familia.trim(),
        precioCompra: parseFloat(formData.precioCompra) || 0,
        precioVenta: parseFloat(formData.precioVenta) || 0,
        revisable: formData.revisable,
        fotoUrl: url,
        tipo: formData.tipo.trim(),
        modelo: formData.modelo.trim(),
        cantidad: cantNum,
        estado: estadoFinal,
        observaciones: formData.observaciones.trim()
      };

      await saveArticulo(newArticulo);

      // Gestionar aviso de rotura de stock a todos los dispositivos
      if (cantNum === 0) {
        await registrarAvisoStock({
          id: newArticulo.id,
          articuloId: newArticulo.id,
          codigo: newArticulo.codigo,
          nombre: newArticulo.nombre,
          familia: newArticulo.familia,
          tipo: newArticulo.tipo,
          modelo: newArticulo.modelo,
          fotoUrl: newArticulo.fotoUrl,
          observaciones: newArticulo.observaciones,
          fecha: new Date().toISOString(),
          timestamp: Date.now(),
          activo: true
        });
      } else {
        await desactivarAvisoStock(newArticulo.id);
      }

      const updatedArticulos = editingArticulo 
        ? articulos.map(a => a.id === editingArticulo.id ? newArticulo : a) 
        : [...articulos, newArticulo];
      setArticulos(updatedArticulos);
      localStorage.setItem('firecheck_db_articulos', JSON.stringify(updatedArticulos));
      handleCloseModal();
    } catch (error) {
      console.error('Error al guardar articulo:', error);
      alert('Hubo un error al guardar el artículo. Por favor, inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (articulo: Articulo) => {
    if (isTecnico) return;
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
    if (isTecnico) return;
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

  const filteredArticulos = articulosList.filter(a => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (a.nombre || '').toLowerCase().includes(q) ||
      (a.codigo || '').toLowerCase().includes(q) ||
      (a.familia || '').toLowerCase().includes(q) ||
      (a.tipo || '').toLowerCase().includes(q) ||
      (a.modelo || '').toLowerCase().includes(q) ||
      (a.estado || '').toLowerCase().includes(q) ||
      (a.observaciones || '').toLowerCase().includes(q)
    );
  });

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
      Articulo: item.nombre,
      Tipo: item.tipo || 'Repuesto',
      Modelo: item.modelo || '',
      Familia: item.familia,
      Estado: item.estado || 'Disponible',
      Cantidad: (item.cantidad !== undefined && item.cantidad !== null) ? item.cantidad : '',
      PrecioCompra: item.precioCompra,
      PrecioVenta: item.precioVenta,
      Revisable: item.revisable ? 'Sí' : 'No',
      Observaciones: item.observaciones || ''
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
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 text-center sm:text-left flex flex-col items-center sm:items-start">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
          </button>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Catálogo de Artículos y Servicios</h1>
          <p className="text-xs font-semibold text-zinc-500 mt-1">Gestión del inventario de equipos revisables y tarifas de servicios asociados.</p>
        </div>

        {/* Pestañas + botones */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          {/* Pestañas */}
          <div className="flex items-center gap-1.5 bg-zinc-100 p-1.5 rounded-2xl w-fit border border-zinc-200/40">
            <button
              onClick={() => setTab('articulos')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                tab === 'articulos'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <Package className={`w-4 h-4 ${tab === 'articulos' ? 'text-red-600' : 'text-zinc-400'}`} />
              Artículos
              <span className={`text-[10px] font-black font-sans px-2 py-0.5 rounded-md transition-colors ${
                tab === 'articulos' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {articulos.filter(a => a.revisable).length}
              </span>
            </button>
            <button
              onClick={() => setTab('servicios')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                tab === 'servicios'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <Wrench className={`w-4 h-4 ${tab === 'servicios' ? 'text-red-650' : 'text-zinc-400'}`} />
              Servicios
              <span className={`text-[10px] font-black font-sans px-2 py-0.5 rounded-md transition-colors ${
                tab === 'servicios' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {articulos.filter(a => !a.revisable).length}
              </span>
            </button>
          </div>

          {/* Botones de acción */}
          {!isTecnico && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImport} 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-950 px-3.5 py-2.5 rounded-xl font-bold transition-all text-xs shadow-sm cursor-pointer hover:shadow"
                title="Importar Excel"
              >
                <Download className="w-3.5 h-3.5 text-zinc-450" />
                Importar
              </button>
              <button 
                onClick={handleExport}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-950 px-3.5 py-2.5 rounded-xl font-bold transition-all text-xs shadow-sm cursor-pointer hover:shadow"
                title="Exportar a Excel"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-450" />
                Exportar
              </button>
              <button 
                onClick={() => handleOpenModal()}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo {tab === 'articulos' ? 'Artículo' : 'Servicio'}
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
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none transition-all shadow-sm text-sm text-zinc-900 placeholder-zinc-400"
            placeholder="Buscar por código, nombre o familia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Lista de Artículos */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden overflow-x-auto">
          <div className={`${isTecnicoMode ? 'hidden' : 'hidden md:flex'} items-center bg-zinc-50 border-b border-zinc-200/80 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500`}>
            <div className="w-20 shrink-0">Código</div>
            <div className="flex-1 min-w-[180px]">Artículo</div>
            <div className="w-24 shrink-0">Tipo</div>
            <div className="w-28 shrink-0">Modelo</div>
            <div className="w-36 shrink-0">Familia</div>
            <div className="w-24 shrink-0 text-center">Estado</div>
            <div className="w-20 shrink-0 text-center">Stock</div>
            <div className="w-24 shrink-0 text-right">P. Venta</div>
            <div className="w-24 shrink-0 text-right">Acciones</div>
          </div>

          <div className="divide-y divide-zinc-200">
            {filteredArticulos.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 text-blue-200 mx-auto mb-3" />
                <p className="text-red-600/50 font-medium">No hay artículos registrados</p>
              </div>
            ) : (
              filteredArticulos.map(a => {
                const isStockTracked = a.cantidad !== undefined && a.cantidad !== null;
                const cantNum = isStockTracked ? Number(a.cantidad) : undefined;
                const estadoCfg = getEstadoCfg(a.estado);

                return (
                  <div key={a.id} className="flex flex-col md:flex-row md:items-center px-4 py-3 hover:bg-zinc-50/80 transition-colors group">
                    {/* Vista Móvil / Tarjeta */}
                    <div 
                      className={`flex ${isTecnicoMode ? '' : 'md:hidden'} flex-col gap-2.5 w-full cursor-pointer`}
                      onClick={() => {
                        if (isTecnicoMode) setViewArticuloModal(a);
                        else handleOpenModal(a);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{a.codigo}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${estadoCfg.badge}`}>
                            {estadoCfg.label}
                          </span>
                          {isStockTracked && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                              cantNum === 0 
                                ? 'bg-red-100 text-red-700 border border-red-200' 
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              Stock: {cantNum}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        {a.fotoUrl ? (
                          <img src={a.fotoUrl} alt={a.nombre} className="w-14 h-14 rounded-xl object-cover border border-zinc-200 shrink-0 bg-white img-no-bg" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-zinc-100 border border-zinc-200 shrink-0 flex items-center justify-center">
                            <Package className="w-6 h-6 text-zinc-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 leading-snug mb-1 hover:text-blue-600 transition-colors">
                            {a.nombre}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded">{a.familia || 'Sin familia'}</span>
                            {a.tipo && <span className="bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">{a.tipo}</span>}
                            {a.modelo && <span className="text-slate-400 font-medium">Mod: {a.modelo}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200/60 text-xs">
                        <span className="text-slate-500 font-medium">Precio Venta</span>
                        <span className="font-bold text-slate-800">{formatMoneda(a.precioVenta)}</span>
                      </div>

                      {isTecnico ? (
                        <div className="flex items-center justify-end mt-1" onClick={(e) => e.stopPropagation()}>
                          <button 
                            type="button"
                            onClick={() => setViewArticuloModal(a)} 
                            className="w-full py-2 px-3 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            <Package className="w-4 h-4 text-blue-600" />
                            <span>Modificar Stock ({isStockTracked ? `${cantNum} uds` : 'Sin asignar'})</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleDuplicate(a)} className="flex-1 py-1.5 text-zinc-600 bg-zinc-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                            <Copy className="w-3.5 h-3.5" /> Copiar
                          </button>
                          <button onClick={() => handleOpenModal(a)} className="flex-1 py-1.5 text-zinc-600 bg-zinc-100 hover:bg-blue-50 hover:text-blue-600 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                            <Edit className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button onClick={() => handleDelete(a.id)} className="px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Vista Escritorio */}
                    <div className={`${isTecnicoMode ? 'hidden' : 'hidden md:flex'} items-center w-full`}>
                      {/* Código */}
                      <div 
                        onClick={() => handleOpenModal(a)}
                        className="w-20 shrink-0 cursor-pointer"
                        title="Clic para editar artículo"
                      >
                        <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 px-1.5 py-0.5 rounded transition-colors">{a.codigo}</span>
                      </div>

                      {/* Artículo (Texto suave y clicable para abrir modal) */}
                      <div 
                        onClick={() => handleOpenModal(a)}
                        className="flex-1 min-w-[180px] pr-2 flex items-center gap-3 cursor-pointer group/title"
                        title="Clic para editar artículo"
                      >
                        {a.fotoUrl ? (
                          <img src={a.fotoUrl} alt={a.nombre} className="w-8 h-8 rounded-xl object-cover border border-zinc-200 shrink-0 bg-white img-no-bg" />
                        ) : (
                          <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200 shrink-0 flex items-center justify-center">
                            <Package className="w-4 h-4 text-zinc-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate group-hover/title:text-blue-600 transition-colors">
                            {a.nombre}
                          </p>
                          {a.observaciones && (
                            <p className="text-[11px] text-slate-400 truncate max-w-xs">{a.observaciones}</p>
                          )}
                        </div>
                      </div>

                      {/* Tipo */}
                      <div className="w-24 shrink-0 pr-2">
                        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md truncate inline-block max-w-full">
                          {a.tipo || 'Repuesto'}
                        </span>
                      </div>

                      {/* Modelo */}
                      <div className="w-28 shrink-0 text-xs font-medium text-slate-600 truncate pr-2" title={a.modelo}>
                        {a.modelo || <span className="text-slate-300 italic">—</span>}
                      </div>

                      {/* Familia (Sistema) */}
                      <div className="w-36 shrink-0 text-xs font-semibold text-slate-700 truncate pr-2" title={a.familia}>
                        {a.familia || '-'}
                      </div>

                      {/* Estado */}
                      <div className="w-24 shrink-0 text-center pr-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${estadoCfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${estadoCfg.dot}`} />
                          {estadoCfg.label}
                        </span>
                      </div>

                      {/* Stock / Cantidad */}
                      <div className="w-20 shrink-0 text-center pr-2">
                        {isStockTracked ? (
                          <span className={`text-xs font-bold ${
                            cantNum === 0 
                              ? 'text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md' 
                              : cantNum !== undefined && cantNum <= 2 
                              ? 'text-amber-600 font-bold' 
                              : 'text-slate-800'
                          }`}>
                            {cantNum} uds
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs italic font-normal">—</span>
                        )}
                      </div>

                      {/* P. Venta */}
                      <div className="w-24 shrink-0 text-xs font-semibold text-slate-700 text-right pr-2">
                        {formatMoneda(a.precioVenta)}
                      </div>

                      {/* Acciones */}
                      {isTecnico ? (
                        <div className="w-24 shrink-0 flex items-center justify-end">
                          <button 
                            type="button"
                            onClick={() => setViewArticuloModal(a)} 
                            className="px-2.5 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/70 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            title="Modificar stock"
                          >
                            <Package className="w-3.5 h-3.5 text-blue-600" /> Stock
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 shrink-0 flex items-center justify-end gap-1">
                          <button onClick={() => handleDuplicate(a)} className="p-1.5 text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer" title="Duplicar">
                            <Copy className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleOpenModal(a)} className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(a.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-colors cursor-pointer" title="Borrar">
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
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-red-50/30 shrink-0">
              <h2 className="text-xl font-bold text-blue-950">
                {editingArticulo ? 'Editar Artículo' : 'Nuevo Artículo'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 text-blue-400 hover:text-red-650 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div className="flex flex-col items-center gap-3">
                <label className="text-sm font-medium text-blue-950 w-full">Foto del Artículo</label>
                <div className="relative w-full h-36 bg-red-50/50 border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center overflow-hidden hover:bg-red-50 transition-colors group cursor-pointer">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Vista previa" className="w-full h-full object-contain p-2 img-no-bg" />
                  ) : (
                    <div className="flex flex-col items-center text-blue-400 group-hover:text-red-650 transition-colors">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-950">Código</label>
                  <input
                    required
                    type="text"
                    value={formData.codigo}
                    onChange={e => setFormData({...formData, codigo: e.target.value})}
                    className="w-full px-4 py-2 bg-red-50/50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all text-blue-950 text-sm"
                    placeholder="Ej: EXT-001"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-950">Familia (Sistema)</label>
                  <select
                    required
                    value={formData.familiaId || (formData.familia ? '__current__' : '')}
                    disabled={isFamiliasLoading || selectFamiliaOptions.length === 0}
                    onChange={e => handleFamiliaChange(e.target.value)}
                    className="w-full px-4 py-2 bg-red-50/50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all text-blue-950 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
                <label className="text-sm font-medium text-blue-950">Artículo (Nombre / Descripción)</label>
                <input
                  required
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className="w-full px-4 py-2 bg-red-50/50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all text-blue-950 text-sm"
                  placeholder="Ej: Extintor Polvo ABC 6kg"
                />
              </div>

              {/* Sección Taller & Inventario */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  <span>Datos de Taller e Inventario</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Tipo de Material</label>
                    <select
                      value={formData.tipo}
                      onChange={e => setFormData({...formData, tipo: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    >
                      {TIPOS_ARTICULO.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Modelo / Referencia Taller</label>
                    <input
                      type="text"
                      value={formData.modelo}
                      onChange={e => setFormData({...formData, modelo: e.target.value})}
                      placeholder="Ej: Mod. EX-2024 / Ref: 4402"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Estado del Material</label>
                    <select
                      value={formData.estado || 'Nuevo'}
                      onChange={e => setFormData({...formData, estado: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-semibold"
                    >
                      <option value="Nuevo">Nuevo</option>
                      <option value="Usado">Usado</option>
                      <option value="Reparado">Reparado</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Cantidad (Stock)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.cantidad}
                      onChange={e => setFormData({...formData, cantidad: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-semibold"
                      placeholder="Dejar en blanco si no aplica stock"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Observaciones / Ubicación en Taller</label>
                  <textarea
                    rows={2}
                    value={formData.observaciones}
                    onChange={e => setFormData({...formData, observaciones: e.target.value})}
                    placeholder="Ej: Estantería B-3, Balda 2. Revisado para sustitución rápida..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 resize-none"
                  />
                </div>
              </div>

              {/* Precios */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-blue-950">Precio Compra (€)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioCompra}
                    onChange={e => setFormData({...formData, precioCompra: e.target.value})}
                    className="w-full px-4 py-2 bg-red-50/50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all text-blue-950 text-sm"
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
                    className="w-full px-4 py-2 bg-red-50/50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all text-blue-950 text-sm"
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
                  className="w-4 h-4 text-red-650 rounded"
                />
              </div>

              <div className="p-3 bg-red-50 rounded-xl border border-blue-200/50 flex justify-between items-center">
                <span className="text-xs font-medium text-red-650">Precio Final (IVA 21%)</span>
                <span className="text-lg font-bold text-red-600">
                  {formData.precioVenta ? formatMoneda(parseFloat(formData.precioVenta) * 1.21) : formatMoneda(0)}
                </span>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2.5 text-red-650 bg-red-50 hover:bg-red-100 rounded-xl font-medium transition-colors"
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
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-red-50/30 shrink-0">
              <h2 className="text-xl font-bold text-blue-950">
                Información del Artículo
              </h2>
              <button onClick={() => setViewArticuloModal(null)} className="p-2 text-blue-400 hover:text-red-650 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="flex flex-col items-center gap-3">
                {viewArticuloModal.fotoUrl ? (
                  <div className="w-full h-44 bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden flex items-center justify-center p-2">
                    <img src={viewArticuloModal.fotoUrl} alt={viewArticuloModal.nombre} className="w-full h-full object-contain img-no-bg" />
                  </div>
                ) : (
                  <div className="w-full h-36 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col items-center justify-center text-zinc-400">
                    <Package className="w-10 h-10 mb-1 opacity-50" />
                    <span className="text-xs font-medium">Sin imagen</span>
                  </div>
                )}
              </div>

              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Código</label>
                    <p className="text-sm font-mono font-bold text-zinc-800 bg-white px-2 py-1 rounded border border-zinc-200 w-fit">
                      {viewArticuloModal.codigo}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Familia</label>
                    <p className="text-sm font-medium text-zinc-800">
                      {viewArticuloModal.familia || 'Sin familia'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Artículo / Descripción</label>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">
                    {viewArticuloModal.nombre}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-200/60">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">Tipo</label>
                    <span className="text-xs font-semibold text-slate-700">{viewArticuloModal.tipo || 'Repuesto'}</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">Modelo</label>
                    <span className="text-xs font-mono text-slate-700">{viewArticuloModal.modelo || '—'}</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">Estado</label>
                    {(() => {
                      const cfg = getEstadoCfg(viewArticuloModal.estado);
                      return (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">Stock</label>
                    <span className={`text-xs font-bold ${
                      viewArticuloModal.cantidad !== undefined && viewArticuloModal.cantidad !== null
                        ? Number(viewArticuloModal.cantidad) === 0 ? 'text-red-600' : 'text-slate-800'
                        : 'text-slate-400 italic font-normal'
                    }`}>
                      {viewArticuloModal.cantidad !== undefined && viewArticuloModal.cantidad !== null
                        ? `${viewArticuloModal.cantidad} uds`
                        : '— (No asignado)'}
                    </span>
                  </div>
                </div>

                {viewArticuloModal.observaciones && (
                  <div className="pt-2 border-t border-zinc-200/60">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Observaciones / Taller</label>
                    <p className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-zinc-200 whitespace-pre-wrap">
                      {viewArticuloModal.observaciones}
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-200/60">
                  <label className="text-[10px] font-bold text-red-600 uppercase tracking-wider block mb-1">Precio Venta</label>
                  <p className="text-xl font-bold text-red-650">
                    {formatMoneda(viewArticuloModal.precioVenta)}
                  </p>
                </div>
              </div>

              {/* Sección de Modificación de Stock exclusiva para Técnico */}
              {isTecnico && (
                <div className="bg-blue-50/80 border-2 border-blue-200/90 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 shadow-sm">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                        Modificar Stock en Inventario
                      </h4>
                      <p className="text-[11px] text-blue-700 font-medium">
                        Como técnico, puedes actualizar las unidades disponibles. Los demás datos son de solo lectura.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-inner flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          const current = parseInt(stockInputValue, 10);
                          const next = isNaN(current) || current <= 0 ? 0 : current - 1;
                          setStockInputValue(String(next));
                          setStockSuccessFeedback(false);
                        }}
                        className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold transition-colors cursor-pointer"
                        title="Restar 1 unidad"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div className="flex-1 text-center">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={stockInputValue}
                          onChange={(e) => {
                            setStockInputValue(e.target.value);
                            setStockSuccessFeedback(false);
                          }}
                          placeholder="0"
                          className="w-full text-center font-black text-lg text-slate-800 outline-none bg-transparent"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Unidades</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const current = parseInt(stockInputValue, 10);
                          const next = isNaN(current) ? 1 : current + 1;
                          setStockInputValue(String(next));
                          setStockSuccessFeedback(false);
                        }}
                        className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold transition-colors cursor-pointer"
                        title="Sumar 1 unidad"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isSavingStock}
                      onClick={async () => {
                        setIsSavingStock(true);
                        try {
                          await handleUpdateStockOnly(viewArticuloModal, stockInputValue);
                          setStockSuccessFeedback(true);
                          setTimeout(() => setStockSuccessFeedback(false), 2500);
                        } finally {
                          setIsSavingStock(false);
                        }
                      }}
                      className={`px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                        stockSuccessFeedback
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-blue-500/20'
                      } disabled:opacity-50`}
                    >
                      {isSavingStock ? (
                        'Guardando...'
                      ) : stockSuccessFeedback ? (
                        <>
                          <Check className="w-4 h-4" /> Guardado
                        </>
                      ) : (
                        'Guardar Stock'
                      )}
                    </button>
                  </div>

                  {stockSuccessFeedback && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-in fade-in">
                      <Check className="w-3.5 h-3.5" /> Stock actualizado en base de datos.
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setViewArticuloModal(null)}
                  className="w-full px-4 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors shadow-sm"
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
