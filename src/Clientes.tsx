import { collection, doc, deleteDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useState, useEffect, useRef, useMemo } from 'react';
import ConfirmationModal from './ConfirmationModal';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Building2, Plus, Download, Upload, Users, Search, Edit, Trash2, CreditCard, Phone, Mail, MapPin, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import DetailModal from './components/DetailModal';

// Interfaz del Cliente
interface Cliente {
  id: string;
  nombre: string;
  cif: string;
  direccion: string;
  poblacion: string;
  cp: string;
  provincia: string;
  telefono: string;
  contacto: string;
  correo: string;
  formaPago?: string;
  vencimiento?: string;
  iban?: string;
  notas?: string;
}

// Interfaz para los datos importados del Excel
interface ExcelClienteRow {
  nombre?: string; NOMBRE?: string; cliente?: string; CLIENTE?: string;
  cif?: string; CIF?: string; nif?: string; NIF?: string;
  direccion?: string; DIRECCION?: string; DIRECCIÓN?: string;
  poblacion?: string; POBLACION?: string; POBLACIÓN?: string;
  cp?: string; CP?: string; 'codigo postal'?: string; 'CÓDIGO POSTAL'?: string;
  provincia?: string; PROVINCIA?: string;
  telefono?: string; TELEFONO?: string; TELÉFONO?: string;
  contacto?: string; CONTACTO?: string; ctacto?: string; CTACTO?: string;
  correo?: string; CORREO?: string; email?: string; EMAIL?: string;
  [key: string]: any;
}



const emptyCliente: Cliente = {
  id: '', nombre: '', cif: '', direccion: '', poblacion: '', 
  cp: '', provincia: '', telefono: '', contacto: '', correo: '',
  formaPago: '', vencimiento: '', iban: '', notas: ''
};

export default function Clientes({ hideHeader }: { hideHeader?: boolean } = {}) {
  const navigate = useNavigate();
  const loggedUser = useMemo(() => {
    try {
      const session = sessionStorage.getItem('firecheck_logged_user');
      return session ? JSON.parse(session) : null;
    } catch { return null; }
  }, []);
  const isTecnicoMode = loggedUser?.rol === 'tecnico';
  const isVisualizador = loggedUser?.rol === 'visualizador' || isTecnicoMode;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [_centros, setCentros] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [form, setForm] = useState<Cliente>(emptyCliente);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [clientIdToDelete, setClientIdToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Detail modal state
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showVinculatedCentros, setShowVinculatedCentros] = useState(false);

  const fetchClientes = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "clientes"));
      const clientesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Cliente[];
      setClientes(clientesData);
      localStorage.setItem('firecheck_db_clientes', JSON.stringify(clientesData));
    } catch (error) {
      console.error("Error al obtener clientes:", error);
    }
  };

  useEffect(() => {
    fetchClientes();
    try {
      const storedCentros = localStorage.getItem('firecheck_db_centros');
      if (storedCentros) {
        const parsed = JSON.parse(storedCentros);
        if (Array.isArray(parsed)) setCentros(parsed);
      }
    } catch (error) {
      console.error("Error al cargar centros desde localStorage:", error);
    }
  }, []);

  const saveToDB = (data: Cliente[]) => {
    localStorage.setItem('firecheck_db_clientes', JSON.stringify(data));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim()) return alert('El código de cliente es obligatorio');
    if (!form.nombre.trim()) return alert('El nombre del cliente es obligatorio');

    setIsLoading(true);
    const newId = form.id.trim();
    const newCliente = { ...form, id: newId, nombre: (form.nombre || '').toUpperCase() };

    try {
      await setDoc(doc(db, "clientes", newId), newCliente);
      await fetchClientes();
      setView('list');
      setForm(emptyCliente);
    } catch (error) {
      console.error("Error al guardar en Firestore:", error);
      alert("Error al conectar con la base de datos.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setForm(cliente);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    setClientIdToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteClient = async () => {
    if (!clientIdToDelete) return;
    setIsConfirmModalOpen(false);
    try {
      await deleteDoc(doc(db, "clientes", clientIdToDelete));
      const newData = clientes.filter(c => c.id !== clientIdToDelete);
      saveToDB(newData);
      setClientes(newData);
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
    setClientIdToDelete(null);
  };

  const handleExportExcel = () => {
    if (clientes.length === 0) return alert('No hay clientes para exportar');
    const dataToExport = clientes.map(({ id: _id, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "Directorio_Clientes_FireCheck.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname]; 
      const data = XLSX.utils.sheet_to_json(ws) as ExcelClienteRow[];

      const getStr = (row: any, keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null) return String(row[k]);
        }
        return '';
      };

      let currentMaxNum = 0;
      clientes.forEach(c => {
        if (c.id && c.id.startsWith('CLI')) {
          const num = parseInt(c.id.replace('CLI ', '').replace('CLI', ''), 10);
          if (!isNaN(num) && num > currentMaxNum) currentMaxNum = num;
        }
      });

      const imported: Cliente[] = data.map((row: ExcelClienteRow) => {
        currentMaxNum++;
        return {
          id: `CLI ${String(currentMaxNum).padStart(4, '0')}`,
          nombre: getStr(row, ['nombre', 'NOMBRE', 'cliente', 'CLIENTE']),
          cif: getStr(row, ['cif', 'CIF', 'nif', 'NIF']),
          direccion: getStr(row, ['direccion', 'DIRECCION', 'DIRECCIÓN']),
          poblacion: getStr(row, ['poblacion', 'POBLACION', 'POBLACIÓN']),
          cp: getStr(row, ['cp', 'CP', 'codigo postal', 'CÓDIGO POSTAL']),
          provincia: getStr(row, ['provincia', 'PROVINCIA']),
          telefono: getStr(row, ['telefono', 'TELEFONO', 'TELÉFONO']),
          contacto: getStr(row, ['contacto', 'CONTACTO', 'ctacto', 'CTACTO']),
          correo: getStr(row, ['correo', 'CORREO', 'email', 'EMAIL']),
        };
      }).filter((c: Cliente) => c.nombre);

      try {
        const batch = imported.map(c => setDoc(doc(db, "clientes", c.id), c));
        await Promise.all(batch);
        await fetchClientes();
        alert(`Se han importado ${imported.length} clientes correctamente.`);
      } catch (error) {
        console.error("Error al importar a Firestore:", error);
        alert("Error al importar los datos a la base de datos en la nube.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredClientes = useMemo(() => {
    return (clientes || []).filter(c => 
      (c.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.cif || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.poblacion || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clientes, searchTerm]);

  const handleOpenNewForm = () => {
    let maxNum = 0;
    clientes.forEach(c => {
      if (c.id && c.id.startsWith('CLI')) {
        const num = parseInt(c.id.replace('CLI ', '').replace('CLI', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const suggestedId = `CLI ${String(maxNum + 1).padStart(4, '0')}`;
    setForm({ ...emptyCliente, id: suggestedId });
    setView('form');
  };

  const handleViewDetail = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setShowVinculatedCentros(false);
    setIsDetailOpen(true);
  };

  // ----- RENDERIZADO DE LA LISTA ----- //
  if (view === 'list') {
    return (
      <>
        <div className={hideHeader ? '' : 'px-4 md:px-8 py-6'}>
          {/* Header */}
          {!hideHeader ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-3 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
              </button>
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Directorio de Clientes</h1>
              <p className="text-sm text-zinc-500 mt-1">{clientes.length} registrados en la base de datos.</p>
            </div>
            {!isVisualizador && (
              <div className="flex flex-wrap items-center gap-2">
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3.5 py-2 rounded-lg font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm" title="Importar Excel">
                  <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Importar</span>
                </button>
                <button onClick={handleExportExcel} className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3.5 py-2 rounded-lg font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm" title="Exportar Excel">
                  <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Exportar</span>
                </button>
                <button onClick={handleOpenNewForm} className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10">
                  <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Nuevo Cliente</span><span className="sm:hidden">Nuevo</span>
                </button>
              </div>
            )}
          </div>
          ) : null}

          {/* Buscador */}
          <div className="relative mb-5">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-zinc-400" />
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-lg border border-zinc-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 outline-none transition-all shadow-sm text-sm text-zinc-900 placeholder-zinc-400"
              placeholder="Buscar por nombre, CIF o población..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Tabla de Clientes */}
          {clientes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-zinc-400" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Aún no hay clientes</h3>
              <p className="text-zinc-500 mb-8 max-w-md mx-auto">
                No tienes clientes guardados en la base de datos. Puedes añadir uno manualmente o importar tu lista desde un archivo Excel.
              </p>
              <button onClick={handleOpenNewForm} className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-md">
                <Plus className="w-5 h-5" /> Crear el primer cliente
              </button>
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center shadow-sm">
              <Search className="w-8 h-8 text-zinc-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900 mb-1">No hay resultados</h3>
              <p className="text-zinc-500">No se ha encontrado ningún cliente que coincida con "{searchTerm}".</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden overflow-x-auto">
              {/* Table header */}
              <div className="hidden md:flex items-center bg-[#f9f7f4] border-b-2 border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <div className="w-24 shrink-0">Código</div>
                <div className="flex-1 min-w-0">Cliente</div>
                {!isTecnicoMode && <div className="w-36 shrink-0">CIF / NIF</div>}
                <div className="w-44 shrink-0">Población</div>
                <div className="w-36 shrink-0">Teléfono</div>
                <div className="w-28 shrink-0 text-right">Acciones</div>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-zinc-200">
                {filteredClientes.map((cliente) => {
                  return (
                    <div
                      key={cliente.id}
                      className="flex flex-col md:flex-row md:items-center px-4 py-3.5 hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                      onClick={() => handleViewDetail(cliente)}
                    >
                      {/* Mobile view */}
                      <div className="flex md:hidden items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{cliente.id}</span>
                        <button onClick={(e) => { e.stopPropagation(); handleViewDetail(cliente); }} className="p-1.5 text-zinc-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex md:hidden">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-900 truncate">{cliente.nombre}</p>
                          {cliente.poblacion && <p className="text-xs text-zinc-500 truncate">{cliente.poblacion}</p>}
                        </div>
                      </div>
                      <div className="flex md:hidden items-center gap-3 mt-2">
                        {cliente.telefono && <span className="text-xs text-zinc-500">{cliente.telefono}</span>}
                        {(!isTecnicoMode && cliente.cif) && <span className="text-xs text-zinc-400">{cliente.cif}</span>}
                      </div>

                      {/* Desktop cells */}
                      <div className="hidden md:flex items-center w-full">
                        <div className="w-24 shrink-0">
                          <span className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{cliente.id}</span>
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-sm font-bold text-zinc-900 truncate group-hover:text-blue-900 transition-colors">{cliente.nombre}</p>
                        </div>
                        {!isTecnicoMode && <div className="w-36 shrink-0 text-sm text-zinc-600 truncate pr-2">{cliente.cif || '-'}</div>}
                        <div className="w-44 shrink-0 text-sm text-zinc-600 truncate pr-2 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                          {cliente.poblacion || '-'}
                        </div>
                        <div className="w-36 shrink-0 text-sm text-zinc-600 truncate pr-2">{cliente.telefono || '-'}</div>
                        <div className="w-28 shrink-0 flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewDetail(cliente); }}
                            className="p-1.5 text-zinc-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!isVisualizador && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(cliente); }}
                                className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(cliente.id); }}
                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isConfirmModalOpen && clientIdToDelete && (
            <ConfirmationModal
              isOpen={isConfirmModalOpen}
              onClose={() => { setIsConfirmModalOpen(false); setClientIdToDelete(null); }}
              onConfirm={confirmDeleteClient}
              title="Confirmar Eliminación"
              message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?"
              confirmText="Sí, eliminar"
              cancelText="No, cancelar"
            />
          )}
        </div>

        {/* Detail Modal */}
        <DetailModal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Detalle del Cliente`}
          size="lg"
        >
          {selectedCliente && (
            <div className="space-y-6">
              {/* Header with ID */}
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
                <div className="w-12 h-12 bg-blue-900 rounded-xl flex items-center justify-center text-white">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Cliente</p>
                  <h3 className="text-xl font-bold text-zinc-900">{selectedCliente.nombre}</h3>
                  <p className="text-sm text-zinc-500 font-mono">{selectedCliente.id}</p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Información General</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 font-medium">CIF / NIF</p>
                        <p className="text-sm font-semibold text-zinc-900">{selectedCliente.cif || 'No especificado'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 font-medium">Teléfono</p>
                        <p className="text-sm font-semibold text-zinc-900">{selectedCliente.telefono || 'No especificado'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 font-medium">Correo Electrónico</p>
                        <p className="text-sm font-semibold text-zinc-900">{selectedCliente.correo || 'No especificado'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Dirección y Contacto</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 font-medium">Dirección</p>
                        <p className="text-sm font-semibold text-zinc-900">{selectedCliente.direccion || 'No especificada'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 font-medium">Ubicación</p>
                        <p className="text-sm font-semibold text-zinc-900">
                          {[selectedCliente.poblacion, selectedCliente.cp, selectedCliente.provincia].filter(Boolean).join(', ') || 'No especificada'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 font-medium">Contacto</p>
                        <p className="text-sm font-semibold text-zinc-900">{selectedCliente.contacto || 'No especificado'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Datos Bancarios */}
              {(selectedCliente.formaPago || selectedCliente.iban || selectedCliente.vencimiento) && (
                <div className="pt-4 border-t border-zinc-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                    <CreditCard className="w-3.5 h-4" /> Datos Bancarios
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {selectedCliente.formaPago && (
                      <div className="bg-zinc-50 rounded-xl p-3.5">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Forma de Pago</p>
                        <p className="text-sm font-semibold text-zinc-900 mt-1">{selectedCliente.formaPago}</p>
                      </div>
                    )}
                    {selectedCliente.vencimiento && (
                      <div className="bg-zinc-50 rounded-xl p-3.5">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Vencimiento</p>
                        <p className="text-sm font-semibold text-zinc-900 mt-1">{selectedCliente.vencimiento}</p>
                      </div>
                    )}
                    {selectedCliente.iban && (
                      <div className="bg-zinc-50 rounded-xl p-3.5">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">IBAN</p>
                        <p className="text-sm font-semibold text-zinc-900 mt-1 font-mono">{selectedCliente.iban}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notas */}
              {selectedCliente.notas && (
                <div className="pt-4 border-t border-zinc-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Notas</h4>
                  <p className="text-sm text-zinc-700 bg-zinc-50 rounded-xl p-3.5">{selectedCliente.notas}</p>
                </div>
              )}

              {/* Centros vinculados (Solo visible al pulsar el botón) */}
              {showVinculatedCentros && (
                <div className="pt-4 border-t border-zinc-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
                    <Building2 className="w-3.5 h-4" /> Centros Vinculados
                  </h4>
                  <div className="space-y-2">
                    {(() => {
                      const vinculated = _centros.filter(c => c.clienteId === selectedCliente.id);
                      if (vinculated.length === 0) {
                        return <p className="text-sm text-zinc-500 italic">No hay centros vinculados a este cliente.</p>;
                      }
                      return vinculated.map((c: any) => (
                        <div key={c.id} className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                          <p className="font-bold text-zinc-900 text-sm">{c.nombre}</p>
                          <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" /> {c.direccion}, {c.poblacion}
                          </p>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
                {!isVisualizador && (
                  <button
                    onClick={() => { setIsDetailOpen(false); handleEdit(selectedCliente); }}
                    className="flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Editar Cliente
                  </button>
                )}
                {!isVisualizador ? (
                  <button
                    onClick={() => navigate('/centros', { state: { search: selectedCliente.id } })}
                    className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
                  >
                    <Building2 className="w-4 h-4" /> Ver Centros
                  </button>
                ) : (
                  <button
                    onClick={() => setShowVinculatedCentros(!showVinculatedCentros)}
                    className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
                  >
                    <Building2 className="w-4 h-4" /> {showVinculatedCentros ? 'Ocultar Centros' : 'Ver centros vinculados'}
                  </button>
                )}
              </div>
            </div>
          )}
        </DetailModal>
      </>
    );
  }

  // ----- RENDERIZADO DEL FORMULARIO ----- //
  return (
    <div className="px-4 md:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => { setView('list'); setForm(emptyCliente); }} className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al directorio
        </button>
      </div>

      <div className="mb-8">
        <div className="w-10 h-10 bg-blue-900 text-white rounded-xl flex items-center justify-center mb-4">
          <Building2 className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
          {form.id ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {form.id ? 'Modifica los datos del cliente seleccionado.' : 'Introduce los datos de la empresa o cliente para registrarlo en la base de datos.'}
        </p>
      </div>

      <div className="bg-blue-900 text-white p-4 rounded-xl flex flex-col mb-8">
        <label className="text-[10px] text-blue-300 font-bold mb-1 uppercase">Código de Cliente (Manual)</label>
        <input 
          type="text" 
          value={form.id} 
          onChange={e => setForm({...form, id: e.target.value.toUpperCase()})}
          placeholder="CLI 0000"
          className="bg-transparent border-b border-blue-700 text-lg font-mono font-bold tracking-wider outline-none focus:border-orange-400 transition-colors w-full py-1"
        />
        <p className="text-[10px] text-blue-300 mt-1">Puedes modificar el código sugerido manualmente.</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl border border-zinc-200 shadow-sm">
        <form className="space-y-5" onSubmit={handleSave}>
          {/* Fila 1 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-900 mb-1.5">CLIENTE *</label>
            <input 
              required type="text" 
              value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value.toUpperCase()})}
              className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
              placeholder="Nombre completo o Razón social" 
            />
          </div>

          {/* Fila 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">CIF / NIF</label>
              <input 
                type="text" 
                value={form.cif} onChange={e => setForm({...form, cif: e.target.value})}
                className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
                placeholder="B12345678" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">TELÉFONO</label>
              <input 
                type="tel" 
                value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})}
                className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
                placeholder="Ej. 600 000 000" 
              />
            </div>
          </div>

          {/* Fila 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">CONTACTO (CTACTO)</label>
              <input 
                type="text" 
                value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})}
                className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
                placeholder="Persona de contacto principal" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">CORREO</label>
              <input 
                type="email" 
                value={form.correo} onChange={e => setForm({...form, correo: e.target.value})}
                className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
                placeholder="correo@empresa.com" 
              />
            </div>
          </div>

          <hr className="border-zinc-100 my-6" />

          {/* Fila 4 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-900 mb-1.5">DIRECCIÓN</label>
            <input 
              type="text" 
              value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})}
              className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
              placeholder="Calle, número, piso..." 
            />
          </div>

          {/* Fila 5 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">POBLACIÓN</label>
              <input 
                type="text" 
                value={form.poblacion} onChange={e => setForm({...form, poblacion: e.target.value})}
                className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
                placeholder="Ej. Madrid" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">CÓDIGO POSTAL</label>
              <input 
                type="text" 
                value={form.cp} onChange={e => setForm({...form, cp: e.target.value})}
                className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
                placeholder="Ej. 28001" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">PROVINCIA</label>
              <input 
                type="text" 
                value={form.provincia} onChange={e => setForm({...form, provincia: e.target.value})}
                className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
                placeholder="Ej. Madrid" 
              />
            </div>
          </div>

          <hr className="border-zinc-100 my-6" />

          {/* Sección Datos Bancarios */}
          <div>
            <h2 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wide flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-900" />
              Datos Bancarios
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">FORMA DE PAGO</label>
                <input 
                  type="text" 
                  value={form.formaPago || ''} onChange={e => setForm({...form, formaPago: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
                  placeholder="Ej. Transferencia 30 días" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">VENCIMIENTO</label>
                <input 
                  type="text" 
                  value={form.vencimiento || ''} onChange={e => setForm({...form, vencimiento: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
                  placeholder="Ej. Día 5 de cada mes" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">IBAN</label>
                <input 
                  type="text" 
                  value={form.iban || ''} onChange={e => setForm({...form, iban: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm" 
                  placeholder="ES00 0000..." 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">NOTAS</label>
                <input 
                  type="text" 
                  value={form.notas || ''} onChange={e => setForm({...form, notas: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-blue-900 focus:ring-1 focus:ring-blue-900/10 outline-none transition-all text-zinc-900" 
                  placeholder="Observaciones adicionales..." 
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-6 flex justify-end items-center gap-4">
            {isLoading && <p className="text-sm text-zinc-500">Guardando...</p>}
            <button type="submit" disabled={isLoading} className="bg-blue-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-lg shadow-black/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              <Save className="w-4 h-4" /> {form.id ? 'Guardar Cambios' : 'Guardar en Base de Datos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}