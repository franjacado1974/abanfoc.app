import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Plus, Search, Edit, Trash2, X, Download, Upload } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import * as XLSX from 'xlsx';

export interface Servicio {
  id: string;
  codigo: string;
  nombre: string;
  familia: string;
  precioCompra: number;
  precioVenta: number;
}

export default function Servicios() {
  const navigate = useNavigate();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Familia dropdown state
  const [familiaOptions, setFamiliaOptions] = useState<string[]>([]);
  const [filteredFamiliaOptions, setFilteredFamiliaOptions] = useState<string[]>([]);
  const [showFamiliaDropdown, setShowFamiliaDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const familiaInputRef = useRef<HTMLInputElement>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServicio, setEditingServicio] = useState<Servicio | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    familia: '',
    precioCompra: '',
    precioVenta: ''
  });
  
  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [servicioIdToDelete, setServicioIdToDelete] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('firecheck_db_servicios');
    if (saved) {
      setServicios(JSON.parse(saved));
    }
  }, []);

  // Update familia options when servicios change
  useEffect(() => {
    // Extract unique familia values from servicios
    const familiaValues = [...new Set(servicios.map(s => s.familia).filter(familia => familia.trim() !== ''))];
    setFamiliaOptions(familiaValues);
  }, [servicios]);

  // Filter familia options based on current form value
  useEffect(() => {
    if (!formData.familia) {
      setFilteredFamiliaOptions(familiaOptions);
      return;
    }
    const filtered = familiaOptions.filter(option => 
      option.toLowerCase().includes(formData.familia.toLowerCase())
    );
    setFilteredFamiliaOptions(filtered);
    // Reset highlighted index when filtering
    setHighlightedIndex(-1);
  }, [formData.familia, familiaOptions]);

  const saveToDb = (data: Servicio[]) => {
    setServicios(data);
    localStorage.setItem('firecheck_db_servicios', JSON.stringify(data));
  };

  const handleOpenModal = (servicio?: Servicio) => {
    if (servicio) {
      setEditingServicio(servicio);
      setFormData({
        codigo: servicio.codigo,
        nombre: servicio.nombre,
        familia: servicio.familia,
        precioCompra: servicio.precioCompra.toString(),
        precioVenta: servicio.precioVenta.toString()
      });
    } else {
      setEditingServicio(null);
      setFormData({ codigo: '', nombre: '', familia: '', precioCompra: '', precioVenta: '' });
      // Reset familia dropdown when opening new modal
      setShowFamiliaDropdown(false);
      setHighlightedIndex(-1);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingServicio(null);
    // Reset familia dropdown when closing modal
    setShowFamiliaDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newServicio: Servicio = {
      id: editingServicio ? editingServicio.id : crypto.randomUUID(),
      codigo: formData.codigo.trim(),
      nombre: formData.nombre.trim(),
      familia: formData.familia.trim(),
      precioCompra: parseFloat(formData.precioCompra) || 0,
      precioVenta: parseFloat(formData.precioVenta) || 0,
    };

    if (editingServicio) {
      saveToDb(servicios.map(s => s.id === editingServicio.id ? newServicio : s));
    } else {
      saveToDb([...servicios, newServicio]);
    }
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    setServicioIdToDelete(id);
    setIsConfirmModalOpen(true);
  };

    const confirmDeleteServicio = () => {
      if (servicioIdToDelete) {
        setIsConfirmModalOpen(false);
        saveToDb(servicios.filter(s => s.id !== servicioIdToDelete));
        setServicioIdToDelete(null);
      }
    };

    // Helper functions for familia dropdown
    const selectFamiliaOption = (option: string) => {
      setFormData({...formData, familia: option});
      setShowFamiliaDropdown(false);
      setHighlightedIndex(-1);
      // Focus the input after selecting
      familiaInputRef.current?.focus();
    };

    const updateFilteredOptions = (searchValue: string) => {
      if (!searchValue) {
        setFilteredFamiliaOptions(familiaOptions);
        return;
      }
      const filtered = familiaOptions.filter(option => 
        option.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredFamiliaOptions(filtered);
      // Reset highlighted index when filtering
      setHighlightedIndex(-1);
    };

    const filteredServicios = servicios.filter(s => 
      s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.familia.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (servicios.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(servicios.map(item => ({
      Codigo: item.codigo,
      Familia: item.familia,
      Nombre: item.nombre,
      PrecioCompra: item.precioCompra,
      PrecioVenta: item.precioVenta
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Servicios");
    XLSX.writeFile(workbook, "Servicios.xlsx");
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
        const datosFinales = [...servicios];

        data.forEach((item: any) => {
          const codigo = String(item.Codigo || item.codigo || item.CODIGO || '').trim();
          if (!codigo) return;

          const parsePrice = (val: any) => {
            if (val === undefined || val === null) return 0;
            if (typeof val === 'number') return val;
            return parseFloat(String(val).replace(',', '.')) || 0;
          };

          const nuevoItem = {
            id: crypto.randomUUID(),
            codigo: codigo,
            nombre: String(item.Nombre || item.nombre || item.NOMBRE || ''),
            familia: String(item.Familia || item.familia || item.FAMILIA || ''),
            precioCompra: parsePrice(item.PrecioCompra || item.precioCompra || item.PRECIOCOMPRA),
            precioVenta: parsePrice(item.PrecioVenta || item.precioVenta || item.PRECIOVENTA),
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
        alert(`¡Importación completada!\\nNuevos añadidos: ${importados}\\nActualizados: ${actualizados}`);
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
        <button onClick={() => navigate('/catalogo')} className="text-sm font-medium text-fuchsia-600 hover:text-fuchsia-950 mb-8 flex items-center gap-2 transition-colors">
          ← Volver a Catálogo
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-fuchsia-950 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-xl flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
              Servicios
            </h1>
            <p className="text-fuchsia-900/60 mt-1">Gestiona mantenimientos, desplazamientos y mano de obra</p>
          </div>
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
              className="flex items-center justify-center gap-2 bg-white border border-fuchsia-200 hover:border-fuchsia-300 text-fuchsia-700 px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
              title="Importar Excel"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-2 bg-white border border-fuchsia-200 hover:border-fuchsia-300 text-fuchsia-700 px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
              title="Exportar a Excel"
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="flex items-center justify-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Nuevo
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="bg-white p-2 rounded-2xl border border-fuchsia-100 shadow-sm mb-6 flex items-center">
          <div className="pl-4 pr-2 text-fuchsia-300">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Buscar por código, nombre o familia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 py-2 px-2 outline-none text-fuchsia-950 placeholder:text-fuchsia-900/30 bg-transparent"
          />
        </div>

        {/* Lista de Servicios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredServicios.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-fuchsia-100 border-dashed">
              <Wrench className="w-12 h-12 text-fuchsia-200 mx-auto mb-3" />
              <p className="text-fuchsia-900/50 font-medium">No hay servicios registrados</p>
            </div>
          ) : (
            filteredServicios.map(s => {
              const pVentaConIva = s.precioVenta * 1.21;
              return (
                <div key={s.id} className="bg-white p-5 rounded-3xl border border-fuchsia-100 shadow-sm hover:shadow-md hover:border-fuchsia-200 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col gap-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-fuchsia-50 text-fuchsia-700 text-xs font-mono font-bold rounded-lg border border-fuchsia-100">
                          {s.codigo}
                        </span>
                        <span className="text-xs font-medium text-fuchsia-900/50 uppercase tracking-wider">{s.familia}</span>
                      </div>
                      <h3 className="text-lg font-bold text-fuchsia-950 truncate" title={s.nombre}>{s.nombre}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
<button onClick={() => handleOpenModal(s)} className="p-1.5 text-black hover:text-fuchsia-700 hover:bg-fuchsia-50 rounded-lg transition-colors">
  <Edit className="w-4 h-4" />
</button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-fuchsia-50">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-fuchsia-900/40 mb-0.5">Precio Coste</p>
                      <p className="font-medium text-fuchsia-950">{s.precioCompra.toFixed(2)} €</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-fuchsia-900/40 mb-0.5">Precio Venta <span className="lowercase normal-case font-normal">(Base)</span></p>
                      <p className="font-medium text-fuchsia-950">{s.precioVenta.toFixed(2)} €</p>
                    </div>
                    <div className="col-span-2 bg-fuchsia-50/50 p-2.5 rounded-xl border border-fuchsia-100/50 flex justify-between items-center mt-1">
                      <p className="text-xs font-semibold text-fuchsia-800">P.V.P (IVA 21% inc.)</p>
                      <p className="font-bold text-fuchsia-700 text-lg">{pVentaConIva.toFixed(2)} €</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-fuchsia-950/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-fuchsia-100 flex items-center justify-between bg-fuchsia-50/30">
              <h2 className="text-xl font-bold text-fuchsia-950">
                {editingServicio ? 'Editar Servicio' : 'Nuevo Servicio'}
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
                    placeholder="Ej: SER-001"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-fuchsia-950">Familia</label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      value={formData.familia}
                      onChange={e => {
                        const value = e.target.value;
                        setFormData({...formData, familia: value});
                        // Update filtered options when typing
                        updateFilteredOptions(value);
                        setShowFamiliaDropdown(true);
                      }}
                      onBlur={() => {
                        // Hide dropdown after a delay to allow click events
                        setTimeout(() => setShowFamiliaDropdown(false), 200);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && highlightedIndex >= 0) {
                          e.preventDefault();
                          selectFamiliaOption(filteredFamiliaOptions[highlightedIndex]);
                        } else if (e.key === 'Escape') {
                          setShowFamiliaDropdown(false);
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedIndex(prev => {
                            if (prev < filteredFamiliaOptions.length - 1) {
                              return prev + 1;
                            }
                            return 0;
                          });
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedIndex(prev => {
                            if (prev > 0) {
                              return prev - 1;
                            }
                            return filteredFamiliaOptions.length - 1;
                          });
                        }
                      }}
                      ref={familiaInputRef}
                      className="w-full px-4 py-2.5 bg-fuchsia-50/50 border border-fuchsia-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all text-fuchsia-950"
                      placeholder="Ej: Mano de obra"
                      list="familia-list"
                    />
                    <datalist id="familia-list">
                      {filteredFamiliaOptions.map(option => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                    {showFamiliaDropdown && filteredFamiliaOptions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-fuchsia-100 rounded-xl shadow-lg z-10 max-h-[200px] overflow-y-auto">
                        {filteredFamiliaOptions.map((option, index) => (
                          <div
                            key={option}
                            className={`px-4 py-2 cursor-pointer text-sm ${index === highlightedIndex ? 'bg-fuchsia-50' : ''} ${formData.familia.toLowerCase() === option.toLowerCase() ? 'font-medium' : ''}`}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onClick={() => selectFamiliaOption(option)}
                          >
                            {option}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                  placeholder="Ej: Hora Oficial 1ª"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-fuchsia-950">Coste interno (€)</label>
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

              {/* Previsualización del IVA */}
              <div className="mt-2 p-3 bg-fuchsia-50 rounded-xl border border-fuchsia-200/50 flex justify-between items-center">
                <span className="text-xs font-medium text-fuchsia-700">Precio Final (IVA 21%)</span>
                <span className="text-lg font-bold text-fuchsia-900">
                  {formData.precioVenta ? (parseFloat(formData.precioVenta) * 1.21).toFixed(2) : '0.00'} €
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
      {isConfirmModalOpen && servicioIdToDelete && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={confirmDeleteServicio}
          title="Confirmar Eliminación"
          message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?"
          confirmText="Sí, eliminar"
          cancelText="No, cancelar"
        />
      )}
    </div>
  );
}
