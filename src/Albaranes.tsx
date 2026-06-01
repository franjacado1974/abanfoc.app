import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileDigit, Download, Search, CheckCircle2, Circle, Clock, Trash2, Plus, Building2, MapPin, Save, Trash, Edit, Eye } from 'lucide-react'; // Removed unused X
import { addAlbaran, updateAlbaran, deleteAlbaran, subscribeAlbaranes, subscribeEmpresas, subscribeTecnicos, subscribeCentros, subscribeClientes, type Albaran, type Cliente, type Centro, type Equipo, type Tecnico, type Empresa } from './firebase';
import { generarAlbaranPDF } from './pdfGenerator';
import ConfirmationModal from './ConfirmationModal';

export default function Albaranes() {
  const navigate = useNavigate();

  // Obtener rol del usuario logueado
  const loggedUser = useMemo(() => {
    try {
      const session = sessionStorage.getItem('firecheck_logged_user');
      return session ? JSON.parse(session) : null;
    } catch { return null; }
  }, []);
  const isVisualizador = loggedUser?.rol === 'visualizador';

  // Cargar desde localStorage en el estado inicial para evitar setState dentro de useEffect
  const [albaranes, setAlbaranes] = useState<Albaran[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]'); } catch { return []; } });
  const [clientes, setClientes] = useState<Cliente[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'); } catch { return []; } });
  const [centros, setCentros] = useState<Centro[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'); } catch { return []; } });
  const [equipos] = useState<Equipo[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]'); } catch { return []; } });
  const [tecnicos, setTecnicos] = useState<Tecnico[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]'); } catch { return []; } });
  const [empresas, setEmpresas] = useState<Empresa[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_empresas') || '[]'); } catch { return []; } });
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<Albaran>({
    id: '',
    empresaId: '',
    clienteId: '',
    centroId: '',
    fechaCreacion: new Date().toISOString(),
    items: [{ cantidad: 1, concepto: 'Revisión', descripcion: '', precioUnidad: 0, subtotal: 0 }],
    nombreFirmante: '',
    tecnicoId: '',
    facturado: false,
    numeroPedido: ''
  });

  const canvasClienteRef = useRef<HTMLCanvasElement>(null);
  const canvasTecnicoRef = useRef<HTMLCanvasElement>(null);

  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [albaranIdToDelete, setAlbaranIdToDelete] = useState<string | null>(null);

  const pendingCount = useMemo(() => 
    albaranes.filter(alb => !alb.facturado).length,
  [albaranes]);

  useEffect(() => {
    const unsubAlbaranes = subscribeAlbaranes((firebaseAlbaranes) => {
      setAlbaranes(firebaseAlbaranes);
      localStorage.setItem('firecheck_db_albaranes', JSON.stringify(firebaseAlbaranes)); // Keep localStorage updated as a cache
    });

    const unsubEmpresas = subscribeEmpresas((firebaseEmpresas) => {
      setEmpresas(firebaseEmpresas);
      localStorage.setItem('firecheck_db_empresas', JSON.stringify(firebaseEmpresas));
    });

    const unsubTecnicos = subscribeTecnicos((firebaseTecnicos) => {
      setTecnicos(firebaseTecnicos);
      localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(firebaseTecnicos));
    });

    const unsubCentros = subscribeCentros((firebaseCentros) => {
      setCentros(firebaseCentros);
      localStorage.setItem('firecheck_db_centros', JSON.stringify(firebaseCentros));
    });

    const unsubClientes = subscribeClientes((firebaseClientes) => {
      setClientes(firebaseClientes);
      localStorage.setItem('firecheck_db_clientes', JSON.stringify(firebaseClientes));
    });

    return () => {
      unsubAlbaranes();
      unsubEmpresas();
      unsubTecnicos();
      unsubCentros();
      unsubClientes();
    };
  }, []);

  const toggleFacturado = async (id: Albaran['id']) => {
    const albaranToUpdate = albaranes.find(alb => alb.id === id);
    if (albaranToUpdate) {
      await updateAlbaran({ ...albaranToUpdate, facturado: !albaranToUpdate.facturado });
    }
  };

  const handleEditAlbaran = (alb: any) => {
    setForm({ ...alb as Albaran });
    setEditingId(alb.id);
    setView('form');
  };

  const handleDeleteAlbaran = (id: Albaran['id']) => {
    setAlbaranIdToDelete(id); // Removed type assertion as id is already string
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteAlbaran = async () => {
    if (!albaranIdToDelete) return;
    setIsConfirmModalOpen(false);
    await deleteAlbaran(albaranIdToDelete);
    setAlbaranIdToDelete(null);
  };

  const filtered = albaranes.filter(alb => {
    const cliente = clientes.find(c => c.id === alb.clienteId); // Removed type assertion
    const term = searchTerm.toLowerCase();
    
    const matchesSearch = 
      alb.id.toLowerCase().includes(term) ||
      (alb.numeroMantenimiento && String(alb.numeroMantenimiento).toLowerCase().includes(term)) ||
      (alb.numeroPedido && String(alb.numeroPedido).toLowerCase().includes(term)) ||
      (cliente && cliente.nombre.toLowerCase().includes(term));
      
    const matchesFilter = !showOnlyPending || !alb.facturado;
    
    return matchesSearch && matchesFilter;
  });

  const generateNextAlbaranId = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `ALB-${year}-`;
    const yearAlbaranes = albaranes.filter(alb => alb.id?.startsWith(prefix));
    
    let nextNum = 1;
    if (yearAlbaranes.length > 0) {
      const nums = yearAlbaranes.map(alb => {
        const parts = alb.id.split('-');
        return parseInt(parts[parts.length - 1]);
      }).filter(n => !isNaN(n));
      if (nums.length > 0) nextNum = Math.max(...nums) + 1;
    }
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { cantidad: 1, concepto: 'Revisión', descripcion: '', precioUnidad: 0, subtotal: 0 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  const updateItem = (index: number, field: keyof Albaran['items'][0], value: string | number) => {
    const newItems = form.items.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value } as Albaran['items'][0];
        if (field === 'cantidad' || field === 'precioUnidad') {
          updatedItem.subtotal = (updatedItem.cantidad || 0) * (updatedItem.precioUnidad || 0);
        }
        return updatedItem;
      }
      return item;
    });
    setForm({ ...form, items: newItems });
  };

  const initDraw = (canvas: HTMLCanvasElement | null) => { // Removed type assertion
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    let drawing = false;
    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;
      
      if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = 0;
        clientY = 0;
      }
      
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    canvas.onmousedown = (e) => { drawing = true; const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); };
    canvas.onmousemove = (e) => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); };
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.ontouchstart = (e) => { drawing = true; const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); };
    canvas.ontouchmove = (e) => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); };
    canvas.ontouchend = () => { drawing = false; };
  };

  useEffect(() => {
    if (view === 'form') {
      setTimeout(() => {
        initDraw(canvasClienteRef.current);
        initDraw(canvasTecnicoRef.current);

        if (editingId) {
          const alb = albaranes.find(a => a.id === editingId);
          if (alb?.firmaCliente) {
            const imgC = new Image();
            imgC.onload = () => {
              const ctx = canvasClienteRef.current?.getContext('2d');
              ctx?.drawImage(imgC, 0, 0);
            };
            imgC.src = alb.firmaCliente; // Removed type assertion
          }
          if (alb?.firmaTecnico) {
            const imgT = new Image();
            imgT.onload = () => {
              const ctx = canvasTecnicoRef.current?.getContext('2d');
              ctx?.drawImage(imgT, 0, 0);
            };
            imgT.src = alb.firmaTecnico; // Removed type assertion
          }
        }
      }, 100);
    }
  }, [view, editingId, albaranes]);

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (!form.id || !form.empresaId || !form.clienteId) {
      alert('Por favor, rellena los campos obligatorios.');
      return;
    }

    const firmaCliente = canvasClienteRef.current?.toDataURL('image/png') || '';
    const firmaTecnico = canvasTecnicoRef.current?.toDataURL('image/png') || '';

    const albaranToSave: Albaran = { // Removed type assertion
      ...form,
      firmaCliente,
      firmaTecnico,
      fechaCreacion: editingId ? form.fechaCreacion : new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateAlbaran(albaranToSave);
      } else {
        await addAlbaran(albaranToSave);
      }
    } catch (error) {
      console.error("Error saving albaran to Firebase:", error);
      alert("Error al guardar el albarán. Por favor, inténtalo de nuevo.");
      return;
    }
    
    setView('list');
    setEditingId(null);
    setForm({ // Removed type assertion
      id: '',
      empresaId: '',
      clienteId: '',
      centroId: '',
      fechaCreacion: new Date().toISOString(),
      items: [{ cantidad: 1, concepto: 'Revisión', descripcion: '', precioUnidad: 0, subtotal: 0 }],
      nombreFirmante: '',
      tecnicoId: '',
      facturado: false,
      numeroPedido: ''
    });
  };

  if (view === 'list') {
    return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 bg-white rounded-full border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-colors shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-3">
              <FileDigit className="w-8 h-8 text-violet-500" />
              Registro de Albaranes
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-[11px] font-bold rounded-full border border-amber-200 shadow-sm animate-in fade-in zoom-in duration-300">
                  {pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="text"
              placeholder="Buscar por número, tipo trabajo o cliente..."
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-violet-500/20 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {!isVisualizador && (
            <button
              onClick={() => {
                setEditingId(null);
                const nextId = generateNextAlbaranId();
                setForm({
                  id: nextId,
                  empresaId: '',
                  clienteId: '',
                  centroId: '',
                  fechaCreacion: new Date().toISOString(),
                  items: [{ cantidad: 1, concepto: 'Revisión', descripcion: '', precioUnidad: 0, subtotal: 0 }],
                  nombreFirmante: '',
                  tecnicoId: '',
                  facturado: false,
                  numeroPedido: ''
                });
                setView('form');
              }}
              className="px-6 py-3.5 bg-black text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10 active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" /> Nuevo Albarán
            </button>
          )}
          <button
            onClick={() => setShowOnlyPending(!showOnlyPending)}
            className={`px-6 py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 border shadow-sm ${
              showOnlyPending 
              ? 'bg-amber-100 border-amber-200 text-amber-700' 
              : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            {showOnlyPending ? 'Viendo solo pendientes' : 'Ver solo pendientes'}
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          {/* Cabecera de la lista */}
          <div className="hidden md:flex items-center gap-4 px-6 py-4 bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-wider">
            <div className="w-32">Nº Albarán</div>
            <div className="w-24">Nº Pedido</div>
            <div className="w-40">Tipo Trabajo</div>
            <div className="w-32">Fecha</div>
            <div className="flex-1">Cliente</div>
            <div className="w-40 text-center">Estado Facturación</div>
            <div className="w-44 text-right">Acciones</div>
          </div>

          <div className="divide-y divide-zinc-200">
            {filtered.length === 0 ? (
              <div className="p-20 text-center text-zinc-400">
                No se han encontrado albaranes generados.
              </div>
            ) : (
              filtered.map((alb) => {
                const cliente = clientes.find(c => c.id === alb.clienteId);
                const centro = centros.find(c => c.id === alb.centroId); // Removed type assertion
                const tech = tecnicos.find(t => t.id === alb.tecnicoId); // Removed type assertion
                const nombreTecnico = tech ? `${tech.nombre} ${tech.apellidos}` : 'N/A'; // Removed type assertion

                return (
                  <div key={alb.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-4 md:px-6 py-4 md:py-5 hover:bg-zinc-50/50 transition-colors">
                    <div className="w-full md:w-32 flex justify-between items-center md:block">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase md:hidden tracking-wider">Nº Albarán</span>
                      <div className="font-mono font-bold text-zinc-900 text-sm">{alb.id}</div>
                    </div>
                    <div className="w-full md:w-24 flex justify-between items-center md:block">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase md:hidden tracking-wider">Nº Pedido</span>
                      <div className="text-zinc-600 text-sm">{alb.numeroPedido || '-'}</div>
                    </div>
                    <div className="w-full md:w-40 flex justify-between items-center md:block">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase md:hidden tracking-wider">Tipo Trabajo</span>
                      <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded-lg text-[10px] font-bold border border-violet-100 uppercase">
                        {alb.numeroMantenimiento || (alb.items && alb.items.length > 0 ? alb.items[0].concepto : 'MANUAL')}
                      </span>
                    </div>
                    <div className="w-full md:w-32 text-zinc-500 text-sm flex justify-between items-center md:justify-start md:gap-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase md:hidden tracking-wider">Fecha</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(alb.fechaCreacion).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="w-full md:flex-1 py-2 md:py-0 border-y md:border-none border-zinc-50/50 my-1 md:my-0">
                      <p className="font-bold text-zinc-900 text-sm leading-tight">{cliente?.nombre || 'Desconocido'}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{centro?.nombre || 'Sin centro'}</p>
                    </div>
                    <div className="w-full md:w-40 flex justify-between md:justify-center items-center py-1 md:py-0">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase md:hidden tracking-wider">Estado</span>
                      <button
                        onClick={() => toggleFacturado(alb.id)}
                        className={`w-full max-w-[140px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-2 border ${
                          alb.facturado 
                          ? 'bg-blue-600 border-blue-700 text-white shadow-sm' 
                          : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                        }`}
                      >
                        {alb.facturado ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                        {alb.facturado ? 'Facturado' : 'Sin Facturar'}
                      </button>
                    </div>
                    <div className="w-full md:w-44 flex justify-center md:justify-end gap-1 pt-2 md:pt-0">
                      <button 
                        onClick={() => handleEditAlbaran(alb)}
                        className="p-2.5 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all"
                        title="Ver albarán"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={async () => {
                          const eqsDelCentro = equipos.filter(e => e.centroId === alb.centroId); // Removed type assertion
                          if (!cliente) {
                            alert('No se puede generar el PDF: cliente no encontrado');
                            return;
                          }
                          if (!centro) {
                            alert('No se puede generar el PDF: centro no encontrado');
                            return;
                          }
                          const empresa = empresas.find(e => e._docId === alb.empresaId);
                          await generarAlbaranPDF(
                            cliente as Record<string, any>, 
                            centro as Record<string, any>, 
                            eqsDelCentro as Record<string, any>[], 
                            alb.numeroMantenimiento || alb.id, 
                            nombreTecnico,
                            alb.firmaCliente,
                            alb.firmaTecnico,
                            alb.nombreFirmante,
                            alb.items,
                            empresa as Record<string, any>
                          );
                        }}
                        className="p-2.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      {!isVisualizador && (
                        <button 
                          onClick={() => handleEditAlbaran(alb)}
                          className="p-2.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Editar albarán"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      )}
                      {!isVisualizador && (
                        <button 
                          onClick={() => handleDeleteAlbaran(alb.id)}
                          className="p-2.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar albarán"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && albaranIdToDelete && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={confirmDeleteAlbaran}
          title="Confirmar Eliminación"
          message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?"
          confirmText="Sí, eliminar"
          cancelText="No, cancelar"
        />
      )}

    </div>
    );
  }

  const selectedEmpresa = empresas.find(e => e._docId === form.empresaId); // Removed type assertion
  const selectedCliente = clientes.find(c => c.id === form.clienteId); // Removed type assertion
  const selectedCentro = centros.find(c => c.id === form.centroId); // Removed type assertion
  const filteredCentros = centros.filter(c => c.clienteId === form.clienteId);

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => { setView('list'); setEditingId(null); }} className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al registro
          </button>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl border border-zinc-200 overflow-hidden">
          <div className="p-8 md:p-12">
            <form onSubmit={handleSaveForm} className="space-y-10">
              
              {/* Header con Empresa y Logo */}
              <div className="flex flex-col md:flex-row gap-8 items-start justify-between border-b border-zinc-100 pb-10">
                <div className="flex-1 space-y-4 w-full">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Empresa Mantenedora *</label>
                  <select 
                    required
                    value={form.empresaId}
                    onChange={e => setForm({...form, empresaId: e.target.value})}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    <option value="">Selecciona Empresa...</option>
                    {empresas.map(emp => <option key={emp._docId} value={emp._docId}>{emp.nombre}</option>)}
                  </select>
                  {selectedEmpresa && (
                    <div className="p-4 bg-violet-50/50 rounded-2xl border border-violet-100 text-sm text-zinc-600 animate-in fade-in slide-in-from-top-2">
                      <p className="font-bold text-violet-900">{selectedEmpresa.nombre}</p>
                      <p>{selectedEmpresa.direccion}, {selectedEmpresa.localidad}</p>
                      <p>CIF: {selectedEmpresa.cif}</p>
                    </div>
                  )}
                </div>
                <div className="w-full md:w-48 h-32 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden p-4">
                  {selectedEmpresa?.logoUrl ? (
                    <img src={selectedEmpresa.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Building2 className="w-10 h-10 text-zinc-300" />
                  )}
                </div>
              </div>

              {/* Vinculación y Datos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Cliente *</label>
                    <select 
                      required
                      value={form.clienteId}
                      onChange={e => setForm({...form, clienteId: e.target.value, centroId: ''})}
                      className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none"
                    >
                      <option value="">Selecciona Cliente...</option>
                      {clientes.map(cli => <option key={cli.id} value={cli.id}>{cli.nombre}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Centro de Trabajo</label>
                    <select 
                      value={form.centroId}
                      onChange={e => setForm({...form, centroId: e.target.value})}
                      className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none disabled:opacity-50"
                      disabled={!form.clienteId}
                    >
                      <option value="">Sin centro (Usar datos cliente)</option>
                      {filteredCentros.map(cen => <option key={cen.id} value={cen.id}>{cen.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div className="p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 space-y-3">
                  <div className="flex items-center gap-2 text-violet-600 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Datos de Ubicación</span>
                  </div>
                  {form.clienteId ? (
                    <div className="text-sm space-y-1">
                      <p className="font-bold text-zinc-900">{selectedCentro?.nombre || selectedCliente?.nombre}</p>
                      <p>{selectedCentro?.direccion || selectedCliente?.direccion}</p>
                      <p>{selectedCentro?.poblacion || selectedCliente?.poblacion} ({selectedCentro?.provincia || selectedCliente?.provincia})</p>
                      <p>Tel: {selectedCentro?.telefono || selectedCliente?.telefono}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 italic">Selecciona un cliente para ver los datos.</p>
                  )}
                </div>
              </div>

              {/* Numero Documento */}
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 max-w-xs space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Número de Albarán *</label>
                  <input 
                    required
                    type="text"
                    value={form.id}
                    readOnly
                    className="w-full px-5 py-3.5 bg-black text-white font-mono font-bold rounded-2xl outline-none border border-zinc-800"
                  />
                </div>
                
                <div className="flex-1 max-w-xs space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Número de Pedido</label>
                  <input 
                    type="text"
                    value={form.numeroPedido || ''}
                    onChange={e => setForm({...form, numeroPedido: e.target.value.toUpperCase()})}
                    placeholder="OPCIONAL"
                    className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-bold text-sm"
                  />
                </div>
              </div>

              {/* Tabla de Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Líneas del Albarán</label>
                  <button type="button" onClick={addItem} className="text-xs font-bold text-violet-600 hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Añadir línea
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-900 text-white text-[10px] uppercase font-bold">
                        <th className="px-4 py-3 text-left rounded-l-xl w-20">Cant.</th>
                        <th className="px-4 py-3 text-left w-48">Concepto</th>
                        <th className="px-4 py-3 text-left">Descripción</th>
                        <th className="px-4 py-3 text-right w-32">P. Unidad</th>
                        <th className="px-4 py-3 text-right w-32">Subtotal</th>
                        <th className="px-2 py-3 rounded-r-xl w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {form.items.map((item, index) => (
                        <tr key={index} className="group">
                          <td className="p-2"><input type="number" min="1" value={item.cantidad} onChange={e => updateItem(index, 'cantidad', parseInt(e.target.value))} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1" /></td>
                          <td className="p-2">
                            <select value={item.concepto} onChange={e => updateItem(index, 'concepto', e.target.value)} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1">
                              {['Nuevo', 'Revisión', 'Reparación', 'Instalación', 'Suministro', 'Visita técnica'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </td>
                          <td className="p-2"><input type="text" value={item.descripcion} onChange={e => updateItem(index, 'descripcion', e.target.value)} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1" placeholder="Detalle del trabajo..." /></td>
                          <td className="p-2"><input type="number" step="0.01" value={item.precioUnidad} onChange={e => updateItem(index, 'precioUnidad', parseFloat(e.target.value))} className="w-full text-right bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1" /></td>
                          <td className="px-4 py-2 text-right font-bold text-zinc-900">{item.subtotal.toFixed(2)}€</td>
                          <td className="p-2"><button type="button" onClick={() => removeItem(index)} className="p-1 text-zinc-300 hover:text-red-500 transition-colors"><Trash className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Firmas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-zinc-100">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Firma del Cliente</label>
                  <div className="space-y-2">
                    <input type="text" value={form.nombreFirmante} onChange={e => setForm({...form, nombreFirmante: e.target.value})} placeholder="Nombre del receptor" className="w-full px-4 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none" />
                    <canvas ref={canvasClienteRef} width={400} height={120} className="w-full h-32 bg-zinc-50 border border-zinc-200 rounded-2xl touch-none shadow-inner" />
                    <button type="button" onClick={() => canvasClienteRef.current?.getContext('2d')?.clearRect(0,0,1000,1000)} className="text-[10px] text-zinc-400 underline">Limpiar firma</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Firma del Técnico</label>
                  <div className="space-y-2">
                    <select value={form.tecnicoId} onChange={e => setForm({...form, tecnicoId: e.target.value})} className="w-full px-4 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none">
                      <option value="">Selecciona Técnico...</option>
                      {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre} {t.apellidos}</option>)}
                    </select>
                    <canvas ref={canvasTecnicoRef} width={400} height={120} className="w-full h-32 bg-zinc-50 border border-zinc-200 rounded-2xl touch-none shadow-inner" />
                    <button type="button" onClick={() => canvasTecnicoRef.current?.getContext('2d')?.clearRect(0,0,1000,1000)} className="text-[10px] text-zinc-400 underline">Limpiar firma</button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-8">
                <button type="submit" className="flex items-center gap-2 bg-black text-white px-10 py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95">
                  <Save className="w-5 h-5" /> {editingId ? 'Actualizar Albarán' : 'Generar y Guardar Albarán'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}