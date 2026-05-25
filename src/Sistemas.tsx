import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layers, ArrowLeft, Plus, Edit, Trash2, X, FileBox, LayoutList, Droplets, BellRing, Wind, Download, Upload, Copy, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface SistemaCategoria {
  id: string;
  nombre: string;
}

export interface SistemaEquipo {
  id: string;
  idCategoria: string;
  codigo: string;
  nombre: string;
  familia: string;
}

export const CATEGORIAS_POR_DEFECTO: SistemaCategoria[] = [
  { id: 'cat-1', nombre: 'SISTEMA EXTINTORES' },
  { id: 'cat-2', nombre: 'SISTEMA BIES' },
  { id: 'cat-3', nombre: 'SISTEMA HIDRANTES Y CASETAS' },
  { id: 'cat-4', nombre: 'SISTEMA DETECCION AUTOMATICA' },
  { id: 'cat-5', nombre: 'SISTEMA HIDRANTES' }
];

export const getIconForSistema = (nombre: string) => {
  const n = nombre.toLowerCase();
  if (n.includes('extintor')) return '/extintor-icon.png';
  if (n.includes('bie')) return '/bie-icon.png';
  if (n.includes('hidrante') || n.includes('agua') || n.includes('rociador')) return Droplets;
  if (n.includes('deteccion') || n.includes('detección') || n.includes('alarma')) return BellRing;
  if (n.includes('gas') || n.includes('co2')) return Wind;
  return FileBox;
};

export default function Sistemas() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Variables de modo selección desde Centros
  const selectForCentroId = location.state?.selectForCentro;
  const selectForCentroNombre = location.state?.centroNombre;

  const [categorias, setCategorias] = useState<SistemaCategoria[]>([]);
  const [equipos, setEquipos] = useState<SistemaEquipo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<SistemaCategoria | null>(null);

  // Estados modales
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isEquipoModalOpen, setIsEquipoModalOpen] = useState(false);
  
  // Formularios
  const [catNombre, setCatNombre] = useState('');
  const [editCatId, setEditCatId] = useState<string | null>(null);
  
  const [formEquipo, setFormEquipo] = useState({ id: '', codigo: '', nombre: '', familia: '' });

  useEffect(() => {
    // Cargar o Inicializar Categorías
    const savedCats = localStorage.getItem('firecheck_db_sistemas_categorias');
    if (savedCats) {
      setCategorias(JSON.parse(savedCats));
    } else {
      setCategorias(CATEGORIAS_POR_DEFECTO);
      localStorage.setItem('firecheck_db_sistemas_categorias', JSON.stringify(CATEGORIAS_POR_DEFECTO));
    }

    // Cargar Equipos
    const savedEquipos = localStorage.getItem('firecheck_db_sistemas_equipos');
    if (savedEquipos) {
      setEquipos(JSON.parse(savedEquipos));
    }
  }, []);

  const saveCats = (data: SistemaCategoria[]) => {
    setCategorias(data);
    localStorage.setItem('firecheck_db_sistemas_categorias', JSON.stringify(data));
  };

  const saveEquipos = (data: SistemaEquipo[]) => {
    setEquipos(data);
    localStorage.setItem('firecheck_db_sistemas_equipos', JSON.stringify(data));
  };

  // ----- LOGICA CATEGORÍAS -----
  const handleSaveCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNombre.trim()) return;

    if (editCatId) {
      saveCats(categorias.map(c => c.id === editCatId ? { ...c, nombre: catNombre.toUpperCase() } : c));
    } else {
      saveCats([...categorias, { id: crypto.randomUUID(), nombre: catNombre.toUpperCase() }]);
    }
    setIsCatModalOpen(false);
    setCatNombre('');
    setEditCatId(null);
  };

  const handleDeleteCat = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este sistema? Se eliminarán también todos los equipos de su interior.')) {
      saveCats(categorias.filter(c => c.id !== id));
      saveEquipos(equipos.filter(e => e.idCategoria !== id));
    }
  };

  // ----- LOGICA EQUIPOS -----
  const handleSaveEquipo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoria) return;

    const newEquipo: SistemaEquipo = {
      id: formEquipo.id || crypto.randomUUID(),
      idCategoria: selectedCategoria.id,
      codigo: formEquipo.codigo.toUpperCase(),
      nombre: formEquipo.nombre,
      familia: selectedCategoria.nombre.toUpperCase()
    };

    if (formEquipo.id) {
      saveEquipos(equipos.map(eq => eq.id === formEquipo.id ? newEquipo : eq));
    } else {
      saveEquipos([...equipos, newEquipo]);
    }
    setIsEquipoModalOpen(false);
  };

  const handleDeleteEquipo = (id: string) => {
    if (confirm('¿Eliminar este equipo?')) {
      saveEquipos(equipos.filter(e => e.id !== id));
    }
  };

  const handleDuplicateEquipo = (eq: SistemaEquipo) => {
    const newEquipo = {
      ...eq,
      id: crypto.randomUUID(),
      codigo: `${eq.codigo}-COPIA`
    };
    saveEquipos([...equipos, newEquipo]);
  };

  const equiposDelSistema = selectedCategoria ? equipos.filter(e => e.idCategoria === selectedCategoria.id) : [];

  const handleAddToCentro = (cat: SistemaCategoria) => {
    if (!selectForCentroId) return;
    
    // Guardar el sistema
    const saved = localStorage.getItem('firecheck_db_centro_sistemas');
    const db = saved ? JSON.parse(saved) : [];
    
    const newSysId = crypto.randomUUID();
    const newSys = {
      id: newSysId,
      centroId: selectForCentroId,
      tipo: cat.nombre,
      familia: cat.nombre,
      descripcion: ''
    };
    db.push(newSys);
    localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(db));

    alert(`Sistema ${cat.nombre} añadido correctamente a ${selectForCentroNombre}. Ahora puedes entrar al sistema para añadirle modelos y cantidades.`);
  };

  // ----- IMPORTAR / EXPORTAR CATEGORÍAS (SISTEMAS) -----
  const fileInputCatsRef = useRef<HTMLInputElement>(null);

  const handleExportCats = () => {
    if (categorias.length === 0) {
      alert('No hay sistemas para exportar.');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(categorias.map(item => ({
      Nombre: item.nombre
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CatálogoSistemas");
    XLSX.writeFile(workbook, `Sistemas_Catalogo.xlsx`);
  };

  const handleImportCats = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          alert('El archivo Excel está vacío o no se pudo leer.');
          targetInput.value = '';
          return;
        }

        let importados = 0;
        const datosFinales = [...categorias];

        data.forEach((item: any) => {
          const nombre = String(item.Nombre || item.nombre || item.NOMBRE || '').trim().toUpperCase();
          if (!nombre) return;

          const existe = datosFinales.find(x => x.nombre === nombre);
          if (!existe) {
            datosFinales.push({
              id: crypto.randomUUID(),
              nombre: nombre
            });
            importados++;
          }
        });

        saveCats(datosFinales);
        alert(`¡Importación de Sistemas completada!\nNuevos añadidos: ${importados}`);
      } catch (error) {
        console.error(error);
        alert('Error al importar el archivo Excel de sistemas.');
      }
      targetInput.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (equiposDelSistema.length === 0) {
      alert('No hay equipos para exportar en este sistema.');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(equiposDelSistema.map(item => ({
      Codigo: item.codigo,
      Familia: item.familia,
      Nombre: item.nombre
    })));
    const workbook = XLSX.utils.book_new();
    const sheetName = selectedCategoria ? selectedCategoria.nombre.substring(0, 31) : "Equipos";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `Sistemas_${sheetName}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCategoria) return;

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
        const datosFinales = [...equipos];

        data.forEach((item: any) => {
          const codigo = String(item.Codigo || item.codigo || item.CODIGO || '').trim();
          if (!codigo) return;

          const nuevoItem: SistemaEquipo = {
            id: crypto.randomUUID(),
            idCategoria: selectedCategoria.id,
            codigo: codigo.toUpperCase(),
            familia: selectedCategoria.nombre.toUpperCase(),
            nombre: String(item.Nombre || item.nombre || item.NOMBRE || '')
          };

          const indexExistente = datosFinales.findIndex(x => x.codigo === codigo && x.idCategoria === selectedCategoria.id);
          
          if (indexExistente >= 0) {
            datosFinales[indexExistente] = { ...datosFinales[indexExistente], ...nuevoItem, id: datosFinales[indexExistente].id };
            actualizados++;
          } else {
            datosFinales.push(nuevoItem);
            importados++;
          }
        });

        saveEquipos(datosFinales);
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
        <button 
          onClick={() => selectedCategoria ? setSelectedCategoria(null) : navigate('/')} 
          className="text-sm font-medium text-fuchsia-600 hover:text-fuchsia-950 mb-8 flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> 
          {selectedCategoria ? 'Volver a Sistemas' : 'Volver al panel'}
        </button>

        {selectForCentroId && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl mb-8 flex justify-between items-center shadow-sm">
            <div>
              <span className="font-bold uppercase text-xs tracking-wider opacity-70 block mb-0.5">Modo Selección</span>
              <span className="font-medium text-sm">Añadiendo sistemas al centro: <b>{selectForCentroNombre}</b></span>
            </div>
            <button onClick={() => navigate(-1)} className="text-sm bg-white text-emerald-700 px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-emerald-50 transition-colors">
              Terminar y Volver
            </button>
          </div>
        )}

        {!selectedCategoria ? (
          /* VISTA: LISTA DE SISTEMAS (CATEGORÍAS) */
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-fuchsia-950 tracking-tight flex items-center gap-3">
                  <div className="w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-xl flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  Equipamientos
                </h1>
                <p className="text-fuchsia-900/60 mt-1">
                  Gestión de sistemas y equipos contra incendios.
                </p>
              </div>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputCatsRef} 
                  onChange={handleImportCats} 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputCatsRef.current?.click()}
                  className="flex items-center justify-center gap-2 bg-white border border-fuchsia-200 hover:bg-fuchsia-50 text-fuchsia-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
                  title="Importar Excel"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Importar</span>
                </button>
                <button 
                  onClick={handleExportCats}
                  className="flex items-center justify-center gap-2 bg-white border border-fuchsia-200 hover:bg-fuchsia-50 text-fuchsia-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
                  title="Exportar a Excel"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar</span>
                </button>
                <button 
                  onClick={() => { setEditCatId(null); setCatNombre(''); setIsCatModalOpen(true); }}
                  className="flex items-center justify-center gap-2 bg-white border border-fuchsia-200 hover:border-fuchsia-300 text-fuchsia-700 px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Añadir sistemas</span>
                  <span className="sm:hidden">Añadir</span>
                </button>
              </div>
            </div>

            {/* Buscador de Sistemas */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-fuchsia-400" />
              </div>
              <input
                type="text"
                className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-fuchsia-100 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 outline-none transition-all shadow-sm text-fuchsia-950 placeholder-fuchsia-300"
                placeholder="Buscar sistema por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categorias.filter(cat => cat.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(cat => {
                const count = equipos.filter(e => e.idCategoria === cat.id).length;
                const IconoCategoria = getIconForSistema(cat.nombre);

                return (
                  <div
                    key={cat.id}
                    className="bg-white p-5 rounded-3xl border border-fuchsia-100 shadow-sm hover:shadow-md hover:border-fuchsia-200 transition-all group flex flex-col h-full"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div
                        onClick={() => setSelectedCategoria(cat)}
                        className="w-12 h-12 bg-fuchsia-50 rounded-2xl flex items-center justify-center text-fuchsia-500 hover:scale-110 hover:bg-fuchsia-100 hover:text-fuchsia-600 transition-all overflow-hidden cursor-pointer"
                        title="Ver detalles del sistema"
                      >
                        {typeof IconoCategoria === 'string' ? (
                          <img src={IconoCategoria} alt="Icon" className="w-8 h-8 object-contain opacity-80" />
                        ) : (
                          <IconoCategoria className="w-6 h-6" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => { setEditCatId(cat.id); setCatNombre(cat.nombre); setIsCatModalOpen(true); }} 
                          className="p-1.5 text-fuchsia-400 hover:text-fuchsia-700 hover:bg-fuchsia-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCat(cat.id)} 
                          className="p-1.5 text-fuchsia-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h3
                      className="text-lg font-bold text-fuchsia-950 mb-1 leading-tight cursor-pointer hover:text-fuchsia-600 transition-colors"
                      onClick={() => setSelectedCategoria(cat)}
                    >
                      {cat.nombre}
                    </h3>
                    
                    {selectForCentroId ? (
                      <div className="mt-auto pt-4 flex gap-2 border-t border-fuchsia-50">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleAddToCentro(cat); }}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Añadir al Centro
                        </button>
                      </div>
                    ) : (
                      <div className="mt-auto pt-4 flex items-center gap-2 text-sm text-fuchsia-700 font-medium border-t border-fuchsia-50">
                        <LayoutList className="w-4 h-4" />
                        {count} {count === 1 ? 'equipo registrado' : 'equipos registrados'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* VISTA: EQUIPOS DENTRO DE UN SISTEMA */
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-bold text-fuchsia-600 uppercase tracking-wider mb-1 block">Plantilla de Sistema</span>
                <h1 className="text-3xl font-bold text-fuchsia-950 tracking-tight flex items-center gap-3">
                  {selectedCategoria.nombre}
                </h1>
                <p className="text-fuchsia-900/60 mt-1">Configura la lista de equipos por defecto (Código, Familia, Nombre)</p>
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
                  onClick={() => { setFormEquipo({ id: '', codigo: '', nombre: '', familia: '' }); setIsEquipoModalOpen(true); }}
                  className="flex items-center justify-center gap-2 bg-white border border-fuchsia-200 hover:border-fuchsia-300 text-fuchsia-700 px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  Añadir
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-fuchsia-100 shadow-sm overflow-hidden">
              {equiposDelSistema.length === 0 ? (
                <div className="p-12 text-center">
                  <LayoutList className="w-12 h-12 text-fuchsia-200 mx-auto mb-3" />
                  <p className="text-fuchsia-900/50 font-medium">No hay equipos creados en este sistema</p>
                </div>
              ) : (
                <div className="divide-y divide-fuchsia-50">
                  {equiposDelSistema.map((eq, i) => (
                    <div key={eq.id} className="p-4 md:p-5 flex items-start justify-between hover:bg-fuchsia-50/50 transition-colors">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="px-2 py-0.5 bg-fuchsia-100 text-fuchsia-800 text-[10px] font-mono font-bold rounded">
                              {eq.codigo || 'SIN-CODIGO'}
                            </span>
                            <span className="text-[10px] font-medium text-fuchsia-900/50 uppercase tracking-wider">
                              {eq.familia || 'SIN FAMILIA'}
                            </span>
                          </div>
                          <h4 className="font-bold text-fuchsia-950 text-base">{eq.nombre}</h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-4">
                        <button 
                          onClick={() => { setFormEquipo(eq); setIsEquipoModalOpen(true); }} 
                          className="p-2 text-fuchsia-400 hover:text-fuchsia-700 hover:bg-fuchsia-100 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDuplicateEquipo(eq)} 
                          className="p-2 text-fuchsia-400 hover:text-fuchsia-700 hover:bg-fuchsia-100 rounded-lg transition-colors"
                          title="Duplicar equipo"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteEquipo(eq.id)} 
                          className="p-2 text-fuchsia-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODAL CATEGORÍA */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-fuchsia-950/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-fuchsia-100 flex items-center justify-between bg-fuchsia-50/30">
              <h2 className="text-lg font-bold text-fuchsia-950">
                {editCatId ? 'Editar Sistema' : 'Nuevo Sistema'}
              </h2>
              <button onClick={() => setIsCatModalOpen(false)} className="p-2 text-fuchsia-400 hover:text-fuchsia-700 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCat} className="p-6">
              <div className="space-y-1.5 mb-6">
                <label className="text-sm font-semibold text-fuchsia-950">Nombre del Sistema</label>
                <input
                  required autoFocus type="text" value={catNombre} onChange={e => setCatNombre(e.target.value)}
                  className="w-full px-4 py-2.5 bg-fuchsia-50/50 border border-fuchsia-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all text-fuchsia-950 uppercase"
                  placeholder="Ej: SISTEMA ROCIADORES"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsCatModalOpen(false)} className="flex-1 px-4 py-2.5 text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 rounded-xl font-medium transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl font-medium transition-colors shadow-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EQUIPO */}
      {isEquipoModalOpen && (
        <div className="fixed inset-0 bg-fuchsia-950/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-fuchsia-100 flex items-center justify-between bg-fuchsia-50/30">
              <h2 className="text-lg font-bold text-fuchsia-950">
                {formEquipo.id ? 'Editar Equipo' : 'Añadir Equipo'}
              </h2>
              <button onClick={() => setIsEquipoModalOpen(false)} className="p-2 text-fuchsia-400 hover:text-fuchsia-700 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEquipo} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-fuchsia-950">Código *</label>
                  <input
                    required autoFocus type="text" value={formEquipo.codigo} onChange={e => setFormEquipo({...formEquipo, codigo: e.target.value})}
                    className="w-full px-4 py-2.5 bg-fuchsia-50/50 border border-fuchsia-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all text-fuchsia-950 uppercase"
                    placeholder="Ej: EXT-001"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-fuchsia-950">Nombre del equipo *</label>
                <input
                  required type="text" value={formEquipo.nombre} onChange={e => setFormEquipo({...formEquipo, nombre: e.target.value})}
                  className="w-full px-4 py-3 bg-fuchsia-50/50 border border-fuchsia-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all text-fuchsia-950"
                  placeholder="Ej: Extintor Polvo ABC 6Kg"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsEquipoModalOpen(false)} className="flex-1 px-4 py-2.5 text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 rounded-xl font-medium transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl font-medium transition-colors shadow-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}