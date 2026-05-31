import { collection, doc, deleteDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useState, useEffect, useRef, useMemo } from 'react';
import ConfirmationModal from './ConfirmationModal'; // Import the new modal component
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Building2, Plus, Download, Upload, Users, Search, Edit, Trash2, CreditCard } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  // Añadir aquí cualquier otra columna que pueda venir del Excel
  [key: string]: any; // Permite otras propiedades no definidas explícitamente
}



const emptyCliente: Cliente = {
  id: '', nombre: '', cif: '', direccion: '', poblacion: '', 
  cp: '', provincia: '', telefono: '', contacto: '', correo: '',
  formaPago: '', vencimiento: '', iban: '', notas: ''
};

export default function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [form, setForm] = useState<Cliente>(emptyCliente);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Nuevo estado para el indicador de carga
  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [clientIdToDelete, setClientIdToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Función para obtener clientes de Firestore
  const fetchClientes = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "clientes"));
      const clientesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Cliente[];
      setClientes(clientesData);
      // Sincronizamos con localStorage para que el resto de la app (Partes, Centros) vea los datos
      localStorage.setItem('firecheck_db_clientes', JSON.stringify(clientesData));
    } catch (error) {
      console.error("Error al obtener clientes:", error);
    }
  };

  useEffect(() => {
    fetchClientes();
    // Cargar centros para el conteo de la lista
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

  // Guardar en base de datos local
  const saveToDB = (data: Cliente[]) => {
    localStorage.setItem('firecheck_db_clientes', JSON.stringify(data));
  };

  // ----- ACCIONES ----- //
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim()) return alert('El código de cliente es obligatorio');
    if (!form.nombre.trim()) return alert('El nombre del cliente es obligatorio');

    setIsLoading(true); // Iniciar carga
    const newId = form.id.trim();
    const newCliente = { ...form, id: newId, nombre: (form.nombre || '').toUpperCase() };

    try {
      // Guardamos en Firestore usando el ID personalizado (CLI XXXX) como nombre del documento
      await setDoc(doc(db, "clientes", newId), newCliente);
      await fetchClientes(); // Recargar lista
      setView('list');
      setForm(emptyCliente);
    } catch (error) {
      console.error("Error al guardar en Firestore:", error);
      alert("Error al conectar con la base de datos.");
    } finally {
      setIsLoading(false); // Finalizar carga
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
    // Limpiamos el ID para no exportarlo
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

      // Parseamos los datos del excel mapeando las columnas posibles
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
      }).filter((c: Cliente) => c.nombre); // Filtrar filas vacías

      try {
        // Guardamos cada cliente importado en Firestore
        const batch = imported.map(c => setDoc(doc(db, "clientes", c.id), c));
        await Promise.all(batch);
        await fetchClientes(); // Recargar lista y sincronizar localStorage
        alert(`Se han importado ${imported.length} clientes correctamente.`);
      } catch (error) {
        console.error("Error al importar a Firestore:", error);
        alert("Error al importar los datos a la base de datos en la nube.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtrado de clientes
  const filteredClientes = useMemo(() => {
    return (clientes || []).filter(c => 
      (c.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.cif || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.poblacion || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clientes, searchTerm]);

  // Función para abrir formulario nuevo con ID sugerido
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

  // ----- RENDERIZADO DE LA LISTA ----- //
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-blue-50/40 p-6 md:p-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver al panel
              </button>
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Directorio de Clientes</h1>
              <p className="text-zinc-500 mt-2">{clientes.length} registrados en la base de datos.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
              
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 px-4 py-2.5 rounded-xl font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-sm shadow-sm" title="Importar Excel">
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">Importar Excel</span>
              </button>
              
              <button onClick={handleExportExcel} className="flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 px-4 py-2.5 rounded-xl font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-sm shadow-sm" title="Exportar Excel">
                <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Exportar Excel</span>
              </button>
              
              <button onClick={handleOpenNewForm} className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-medium hover:bg-zinc-800 transition-all text-sm shadow-md shadow-black/10">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo Cliente</span><span className="sm:hidden">Nuevo</span>
              </button>
            </div>
          </div>

          {/* Buscador */}
          {clientes.length > 0 && (
            <div className="relative mb-8">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-zinc-400" />
              </div>
              <input
                type="text"
                className="w-full pl-12 pr-4 py-3.5 bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all shadow-sm text-zinc-900 placeholder-zinc-400"
                placeholder="Buscar por nombre, CIF o población..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          {/* Lista de Clientes */}
          {clientes.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-zinc-200 p-16 text-center shadow-sm">
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
            <div className="bg-white rounded-[2rem] border border-zinc-200 p-12 text-center shadow-sm">
              <Search className="w-8 h-8 text-zinc-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900 mb-1">No hay resultados</h3>
              <p className="text-zinc-500">No se ha encontrado ningún cliente que coincida con "{searchTerm}".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(filteredClientes || []).map((c) => {
                const clientCentrosCount = centros.filter(centro => centro.clienteId === c.id).length;
                
                return (
                  <div key={c.id} className="bg-blue-50/50 p-3.5 rounded-3xl border border-blue-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0 mr-4">
                        <span className="shrink-0 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-mono font-bold rounded block w-max mb-1">
                          {c.id || 'CLI----'}
                        </span>
                        <h3 className="text-base font-bold text-blue-950 truncate" title={c.nombre}>{c.nombre}</h3>
                        {c.cif && <span className="text-xs font-medium text-blue-700/70 truncate" title={c.cif}>{c.cif}</span>}
                      </div>
                    </div>
                    
                    <div className="space-y-0.5 text-xs mb-3">
                      {c.direccion && <p className="text-blue-900/70 truncate">{c.direccion}</p>}
                      <p className="text-blue-900/60 truncate">{c.poblacion ? `${c.poblacion} ${c.cp ? c.cp : ''} ${c.provincia ? `(${c.provincia})` : ''}` : 'Sin ubicación'}</p>
                    </div>
                    
                    <div className="space-y-1 text-xs text-blue-900/80 mb-3 bg-white/60 p-2.5 rounded-2xl border border-white/50">
                      {c.contacto && <p className="truncate"><strong className="text-blue-950 font-medium">Contacto:</strong> {c.contacto}</p>}
                      {c.telefono && <p className="truncate"><strong className="text-blue-950 font-medium">Tel:</strong> {c.telefono}</p>}
                      {c.correo && <p className="truncate"><strong className="text-blue-950 font-medium">Email:</strong> {c.correo}</p>}
                    </div>

                    {/* Botones de acción (Editar / Borrar) */}
                    <div className="flex justify-end gap-0.5 mt-auto">
                      <button onClick={() => handleEdit(c)} className="p-1.5 text-black hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors" title="Editar cliente">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar cliente">
                          <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="pt-3 border-t border-blue-200/50">
                      <button 
                        onClick={() => navigate('/centros', { state: { search: c.id } })}
                        className="w-full flex items-center justify-between text-xs font-medium text-blue-700 hover:text-blue-950 transition-all group"
                      >
                        <span><strong className="text-blue-900 group-hover:text-blue-950">{clientCentrosCount}</strong> centros vinculados</span>
                        <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </button>
                    </div>
                  </div>
                );
              })}
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
      </div>
    );
  }

  // ----- RENDERIZADO DEL FORMULARIO ----- //
  return (
    <div className="min-h-screen bg-blue-50/40 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <button onClick={() => { setView('list'); setForm(emptyCliente); }} className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al directorio
          </button>
        </div>

        <div className="mb-8">
          <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            {form.id ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}
          </h1>
          <p className="text-zinc-500 mt-2">
            {form.id ? 'Modifica los datos del cliente seleccionado.' : 'Introduce los datos de la empresa o cliente para registrarlo en la base de datos.'}
          </p>
        </div>

        <div className="bg-black text-white p-5 rounded-xl flex flex-col mb-8">
          <label className="text-xs text-zinc-400 font-bold mb-1 uppercase">Código de Cliente (Manual)</label>
          <input 
            type="text" 
            value={form.id} 
            onChange={e => setForm({...form, id: e.target.value.toUpperCase()})}
            placeholder="CLI 0000"
            className="bg-transparent border-b border-zinc-700 text-xl font-mono font-bold tracking-wider outline-none focus:border-emerald-500 transition-colors w-full py-1"
          />
          <p className="text-[10px] text-zinc-500 mt-1">Puedes modificar el código sugerido manualmente.</p>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[2rem] border border-zinc-200 shadow-sm">
          <form className="space-y-6" onSubmit={handleSave}>
            {/* Fila 1 */}
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-2">CLIENTE *</label>
              <input 
                required type="text" 
                value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value.toUpperCase()})}
                className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                placeholder="Nombre completo o Razón social" 
              />
            </div>

            {/* Fila 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-2">CIF / NIF</label>
                <input 
                  type="text" 
                  value={form.cif} onChange={e => setForm({...form, cif: e.target.value})}
                  className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                  placeholder="B12345678" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-2">TELÉFONO</label>
                <input 
                  type="tel" 
                  value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})}
                  className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                  placeholder="Ej. 600 000 000" 
                />
              </div>
            </div>

            {/* Fila 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-2">CONTACTO (CTACTO)</label>
                <input 
                  type="text" 
                  value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})}
                  className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                  placeholder="Persona de contacto principal" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-2">CORREO</label>
                <input 
                  type="email" 
                  value={form.correo} onChange={e => setForm({...form, correo: e.target.value})}
                  className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                  placeholder="correo@empresa.com" 
                />
              </div>
            </div>

            <hr className="border-zinc-100 my-8" />

            {/* Fila 4 */}
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-2">DIRECCIÓN</label>
              <input 
                type="text" 
                value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})}
                className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                placeholder="Calle, número, piso..." 
              />
            </div>

            {/* Fila 5 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-2">POBLACIÓN</label>
                <input 
                  type="text" 
                  value={form.poblacion} onChange={e => setForm({...form, poblacion: e.target.value})}
                  className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                  placeholder="Ej. Madrid" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-2">CÓDIGO POSTAL</label>
                <input 
                  type="text" 
                  value={form.cp} onChange={e => setForm({...form, cp: e.target.value})}
                  className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                  placeholder="Ej. 28001" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-2">PROVINCIA</label>
                <input 
                  type="text" 
                  value={form.provincia} onChange={e => setForm({...form, provincia: e.target.value})}
                  className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                  placeholder="Ej. Madrid" 
                />
              </div>
            </div>

            <hr className="border-zinc-100 my-8" />

            {/* Sección Datos Bancarios */}
            <div>
              <h2 className="text-sm font-bold text-zinc-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Datos Bancarios
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-zinc-900 mb-2">FORMA DE PAGO</label>
                  <input 
                    type="text" 
                    value={form.formaPago || ''} onChange={e => setForm({...form, formaPago: e.target.value})}
                    className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                    placeholder="Ej. Transferencia 30 días" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-900 mb-2">VENCIMIENTO</label>
                  <input 
                    type="text" 
                    value={form.vencimiento || ''} onChange={e => setForm({...form, vencimiento: e.target.value})}
                    className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                    placeholder="Ej. Día 5 de cada mes" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-900 mb-2">IBAN</label>
                  <input 
                    type="text" 
                    value={form.iban || ''} onChange={e => setForm({...form, iban: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900" 
                    placeholder="ES00 0000..." 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-900 mb-2">NOTAS</label>
                  <input 
                    type="text" 
                    value={form.notas || ''} onChange={e => setForm({...form, notas: e.target.value})}
                    className="w-full px-4 py-3.5 bg-zinc-50/50 rounded-xl border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900" 
                    placeholder="Observaciones adicionales..." 
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-8 flex justify-end items-center gap-4">
              {isLoading && <p className="text-sm text-zinc-500">Guardando...</p>}
              <button type="submit" disabled={isLoading} className="bg-black text-white px-8 py-4 rounded-xl font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2 shadow-lg shadow-black/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                <Save className="w-5 h-5" /> {form.id ? 'Guardar Cambios' : 'Guardar en Base de Datos'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

}
