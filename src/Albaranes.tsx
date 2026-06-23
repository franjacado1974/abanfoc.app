import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, FileDigit, Download, Search, CheckCircle2, Circle, Clock, Trash2, Plus, Building2, MapPin, Save, Trash, Edit, Copy, Maximize2, X } from 'lucide-react';
import { addAlbaran, updateAlbaran, deleteAlbaran, subscribeAlbaranes, subscribeEmpresas, subscribeTecnicos, subscribeCentros, subscribeClientes, subscribeTrabajos, db, type Albaran, type Cliente, type Centro, type Equipo, type Tecnico, type Empresa, type TrabajoConfig } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { generarAlbaranPDF } from './pdfGenerator';
import ConfirmationModal from './ConfirmationModal';

const formatMoneda = (valor: any) => {
  const num = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : Number(valor);
  if (isNaN(num)) return '0,00 €';
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${parts.join(',')} €`;
};

interface AlbaranesProps {
  isTecnicoMode?: boolean;
}

export default function Albaranes({ isTecnicoMode = false }: AlbaranesProps) {
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
  const [trabajosConfig, setTrabajosConfig] = useState<TrabajoConfig[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_trabajos') || '[]'); } catch { return []; } });
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDescriptionIndex, setEditingDescriptionIndex] = useState<number | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);

  const [form, setForm] = useState<Albaran>({
    id: '',
    empresaId: '',
    clienteId: '',
    centroId: '',
    fechaCreacion: new Date().toISOString(),
    items: [{ cantidad: 1, concepto: '', descripcion: '', precioUnidad: 0, subtotal: 0 }],
    nombreFirmante: '',
    tecnicoId: '',
    facturado: false,
    numeroPedido: ''
  });

  const canvasClienteRef = useRef<HTMLCanvasElement>(null);
  const canvasTecnicoRef = useRef<HTMLCanvasElement>(null);

  // Column resizing state
  const [colWidths, setColWidths] = useState<Record<string, number | string>>({
    albaran: 100,
    fecha: 90,
    pedido: 90,
    centro: 160,
    titulo: 200,
    estado: 100,
    acciones: 120,
  });
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { key, startX, startWidth } = resizingRef.current;
      const delta = e.clientX - startX;
      setColWidths(prev => ({ ...prev, [key]: Math.max(40, startWidth + delta) }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDownResize = (key: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const parent = e.currentTarget.parentElement;
    const startWidth = parent ? parent.offsetWidth : (typeof colWidths[key] === 'number' ? colWidths[key] as number : 100);
    resizingRef.current = { key, startX: e.clientX, startWidth };
  };

  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [albaranIdToDelete, setAlbaranIdToDelete] = useState<string | null>(null);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [signingRole, setSigningRole] = useState<'cliente' | 'tecnico' | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

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

    const unsubTrabajos = subscribeTrabajos((firebaseTrabajos) => {
      setTrabajosConfig(firebaseTrabajos);
      localStorage.setItem('firecheck_db_trabajos', JSON.stringify(firebaseTrabajos));
    });

    return () => {
      unsubAlbaranes();
      unsubEmpresas();
      unsubTecnicos();
      unsubCentros();
      unsubClientes();
      unsubTrabajos();
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

  const handleDuplicateAlbaran = (alb: Albaran) => {
    // Usar el generador de IDs existente para mantener formato ALB-YY-XXX
    const newId = generateNextAlbaranId();

    // Copiar albarán con nuevo ID y limpiar firmas
    const duplicatedAlbaran: Albaran = {
      ...alb,
      id: newId,
      firmaCliente: undefined,
      firmaTecnico: undefined,
      nombreFirmante: '',
      fechaCreacion: new Date().toISOString(),
    };

    setForm(duplicatedAlbaran);
    setEditingId(null);
    setView('form');
  };

  const filtered = albaranes.filter(alb => {
    if (isTecnicoMode && alb.facturado) return false;
    
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
      items: [...form.items, { cantidad: 1, concepto: '', descripcion: '', precioUnidad: 0, subtotal: 0 }]
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
      
      return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
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

  useEffect(() => {
    if (signingRole !== null) {
      setTimeout(() => {
        initDraw(modalCanvasRef.current);
      }, 50);
    }
  }, [signingRole]);

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
      <div className={`px-4 md:px-8 py-6 ${isTecnicoMode ? 'max-w-4xl mx-auto' : ''}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center justify-center md:justify-start gap-3">
              Registro de Albaranes
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200">
                  {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                </span>
              )}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">{albaranes.length} albaranes en el sistema.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isTecnicoMode && (
              <button
                onClick={() => setShowOnlyPending(!showOnlyPending)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-medium transition-all text-xs shadow-sm border ${
                  showOnlyPending ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {showOnlyPending ? 'Pendientes' : 'Todos'}
              </button>
            )}
            {!isVisualizador && (
              <button
                onClick={() => {
                  setEditingId(null);
                  const nextId = generateNextAlbaranId();
                  setForm({ id: nextId, empresaId: '', clienteId: '', centroId: '', fechaCreacion: new Date().toISOString(), items: [{ cantidad: 1, concepto: '', descripcion: '', precioUnidad: 0, subtotal: 0 }], nombreFirmante: '', tecnicoId: '', facturado: false, numeroPedido: '' });
                  setView('form');
                }}
                className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo Albarán
              </button>
            )}
          </div>
        </div>

        <div className="relative mb-5">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search className="w-4 h-4 text-zinc-400" /></div>
          <input type="text" className="w-full pl-10 pr-4 py-2.5 bg-white rounded-lg border border-zinc-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 outline-none transition-all shadow-sm text-sm text-zinc-900 placeholder-zinc-400" placeholder="Buscar por número, tipo trabajo o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center shadow-sm">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-6"><FileDigit className="w-8 h-8 text-zinc-400" /></div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">No hay albaranes</h3>
            <p className="text-zinc-500 mb-8 max-w-md mx-auto">No se han encontrado albaranes{searchTerm ? ` que coincidan con "${searchTerm}"` : ' generados'}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="hidden md:flex items-center bg-[#f9f7f4] border-b-2 border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <div className="relative pr-3 select-none" style={{ width: colWidths.albaran }}>
                <div>Nº Albarán</div>
                <div className="absolute top-0 right-0 h-full w-4 -mr-2 cursor-col-resize border-l-2 border-dashed border-zinc-600" onMouseDown={(e) => handleMouseDownResize('albaran', e)} />
              </div>
              <div className="relative pr-3 select-none" style={{ width: colWidths.fecha }}>
                <div>Fecha</div>
                <div className="absolute top-0 right-0 h-full w-4 -mr-2 cursor-col-resize border-l-2 border-dashed border-zinc-600" onMouseDown={(e) => handleMouseDownResize('fecha', e)} />
              </div>
              <div className="relative pr-3 select-none" style={{ width: colWidths.pedido }}>
                <div>Nº Pedido</div>
                <div className="absolute top-0 right-0 h-full w-4 -mr-2 cursor-col-resize border-l-2 border-dashed border-zinc-600" onMouseDown={(e) => handleMouseDownResize('pedido', e)} />
              </div>
              <div className="relative pr-3 select-none" style={{ width: colWidths.centro }}>
                <div>Centro</div>
                <div className="absolute top-0 right-0 h-full w-4 -mr-2 cursor-col-resize border-l-2 border-dashed border-zinc-600" onMouseDown={(e) => handleMouseDownResize('centro', e)} />
              </div>
              <div className="relative pr-3 select-none" style={{ width: colWidths.titulo }}>
                <div>Título</div>
                <div className="absolute top-0 right-0 h-full w-4 -mr-2 cursor-col-resize border-l-2 border-dashed border-zinc-600" onMouseDown={(e) => handleMouseDownResize('titulo', e)} />
              </div>
              <div className="flex-1 min-w-0"></div>
              {!isTecnicoMode && (
                <div className="relative text-center pr-3 select-none" style={{ width: colWidths.estado }}>
                  <div>Estado</div>
                  <div className="absolute top-0 right-0 h-full w-4 -mr-2 cursor-col-resize border-l-2 border-dashed border-zinc-600" onMouseDown={(e) => handleMouseDownResize('estado', e)} />
                </div>
              )}
              <div className="relative text-center select-none" style={{ width: colWidths.acciones }}>
                <div>Acciones</div>
              </div>
            </div>
            <div className="divide-y divide-zinc-100">
              {filtered.map((alb) => {
                const cliente = clientes.find(c => c.id === alb.clienteId);
                const centro = centros.find(c => c._docId === alb.centroId || c.id === alb.centroId);
                return (
                  <div key={alb.id} className="flex flex-col md:flex-row md:items-center px-4 py-3.5 hover:bg-zinc-50/80 transition-colors group">
                    <div className="flex md:hidden items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{alb.id}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={async () => {
                          const eqsDelCentro = equipos.filter(e => e.centroId === alb.centroId);
                          const empId = alb.empresaId || centro?.empresaId;
                          let empresa = empresas.find(e => e._docId === empId || e.id === empId);
                          if (!empresa && empId) {
                            try {
                                const docSnap = await getDoc(doc(db, 'empresa', empId));
                                if (docSnap.exists()) empresa = { _docId: docSnap.id, ...(docSnap.data() as any) };
                            } catch(e){}
                          }
                          const tecnico = tecnicos.find(t => t.id === alb.tecnicoId);
                          const tecnicoNombre = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : '';
                          await generarAlbaranPDF(cliente as any || null, centro as any || null, eqsDelCentro as any[], alb.numeroMantenimiento || alb.id, tecnicoNombre, alb.firmaCliente, alb.firmaTecnico, alb.nombreFirmante, alb.items, empresa as any, false, alb.titulo, alb.periodicidad);
                        }} className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors" title="Descargar PDF"><Download className="w-4 h-4" /></button>
                        <button onClick={() => handleEditAlbaran(alb)} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="flex md:hidden">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">{cliente?.nombre || 'Desconocido'}</p>
                        <p className="text-xs text-zinc-500">{new Date(alb.fechaCreacion).toLocaleDateString()}</p>
                      </div>
                    </div>
                      <div className="hidden md:flex items-center w-full">
                      <div className="pr-3" style={{ width: colWidths.albaran }}><span className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{alb.id}</span></div>
                      <div className="pr-3 text-sm text-zinc-600" style={{ width: colWidths.fecha }}>{new Date(alb.fechaCreacion).toLocaleDateString()}</div>
                      <div className="pr-3 text-sm text-zinc-600 truncate" style={{ width: colWidths.pedido }}>{alb.numeroPedido || '-'}</div>
                      <div className="pr-3 text-sm text-zinc-600 truncate flex items-center gap-1" style={{ width: colWidths.centro }}><MapPin className="w-3 h-3 text-zinc-400 shrink-0" />{centro?.nombre || cliente?.nombre || 'Desconocido'}</div>
                      <div className="pr-3 min-w-0" style={{ width: colWidths.titulo }}><p className="text-sm font-bold text-zinc-900 truncate">{alb.titulo || '-'}</p></div>
                      <div className="flex-1 min-w-0"></div>
                      {!isTecnicoMode && (
                        <div className="flex justify-center pr-2" style={{ width: colWidths.estado }}>
                          <button onClick={() => toggleFacturado(alb.id)} className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 ${
                            alb.facturado ? 'bg-blue-600 border-blue-700 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                          }`}>
                            {alb.facturado ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                            {alb.facturado ? 'Facturado' : 'Pendiente'}
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-1" style={{ width: colWidths.acciones }}>
                        <button onClick={async () => {
                          const eqsDelCentro = equipos.filter(e => e.centroId === alb.centroId);
                          const empId = alb.empresaId || centro?.empresaId;
                          let empresa = empresas.find(e => e._docId === empId || e.id === empId);
                          if (!empresa && empId) {
                            try {
                                const docSnap = await getDoc(doc(db, 'empresa', empId));
                                if (docSnap.exists()) empresa = { _docId: docSnap.id, ...(docSnap.data() as any) };
                            } catch(e){}
                          }
                          const tecnico = tecnicos.find(t => t.id === alb.tecnicoId);
                          const tecnicoNombre = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : '';
                          await generarAlbaranPDF(cliente as any || null, centro as any || null, eqsDelCentro as any[], alb.numeroMantenimiento || alb.id, tecnicoNombre, alb.firmaCliente, alb.firmaTecnico, alb.nombreFirmante, alb.items, empresa as any, false, alb.titulo, alb.periodicidad);
                        }} className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors" title="Descargar PDF"><Download className="w-4 h-4" /></button>
                        {!isVisualizador && <button onClick={() => handleEditAlbaran(alb)} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Editar"><Edit className="w-4 h-4" /></button>}
                        {!isVisualizador && !isTecnicoMode && <button onClick={() => handleDuplicateAlbaran(alb)} className="p-1.5 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Duplicar"><Copy className="w-4 h-4" /></button>}
                        {!isVisualizador && !isTecnicoMode && <button onClick={() => handleDeleteAlbaran(alb.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isConfirmModalOpen && albaranIdToDelete && (
          <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={confirmDeleteAlbaran} title="Confirmar Eliminación" message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?" confirmText="Sí, eliminar" cancelText="No, cancelar" />
        )}
      </div>
    );
  }

  const selectedEmpresa = empresas.find(e => e._docId === form.empresaId); // Removed type assertion
  const selectedCliente = clientes.find(c => c.id === form.clienteId); // Removed type assertion
  const selectedCentro = centros.find(c => c._docId === form.centroId || c.id === form.centroId); // Removed type assertion
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
                  <div className="space-y-2 relative">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Cliente *</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Escribe para buscar cliente..."
                        value={showClienteDropdown ? clienteSearchTerm : (clientes.find(c => c.id === form.clienteId)?.nombre || '')}
                        onFocus={() => {
                          setShowClienteDropdown(true);
                          setClienteSearchTerm('');
                        }}
                        onChange={(e) => {
                          setClienteSearchTerm(e.target.value);
                          setShowClienteDropdown(true);
                        }}
                        className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500/20"
                      />
                      {showClienteDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                          {clientes.filter(c => c.nombre.toLowerCase().includes(clienteSearchTerm.toLowerCase())).map(cli => (
                            <div 
                              key={cli.id} 
                              className="px-4 py-3 hover:bg-zinc-50 cursor-pointer text-sm font-medium border-b border-zinc-50 last:border-0"
                              onClick={() => {
                                setForm({...form, clienteId: cli.id, centroId: ''});
                                setShowClienteDropdown(false);
                              }}
                            >
                              {cli.nombre}
                            </div>
                          ))}
                          {clientes.filter(c => c.nombre.toLowerCase().includes(clienteSearchTerm.toLowerCase())).length === 0 && (
                            <div className="px-4 py-3 text-sm text-zinc-500 italic">No se encontraron clientes</div>
                          )}
                        </div>
                      )}
                    </div>
                    {showClienteDropdown && (
                      <div className="fixed inset-0 z-40" onClick={() => setShowClienteDropdown(false)} />
                    )}
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
                      {filteredCentros.map(cen => <option key={cen._docId || cen.id} value={cen._docId || cen.id}>{cen.nombre}</option>)}
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

              {/* Número Documento y Título */}
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

                <div className="flex-1 max-w-xs space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Título</label>
                  <input 
                    type="text"
                    value={form.titulo || ''}
                    onChange={e => setForm({...form, titulo: e.target.value})}
                    placeholder="Ej: Revisión anual centro comercial"
                    className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-bold text-sm"
                  />
                </div>
              </div>

              {/* Tabla de Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Líneas del Albarán</label>
                  <button type="button" onClick={addItem} className="hidden md:flex text-xs font-bold text-violet-600 hover:underline items-center gap-1">
                    <Plus className="w-3 h-3" /> Añadir línea
                  </button>
                </div>
                
                {/* Vista Escritorio */}
                <div className="overflow-x-auto hidden md:block">
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
                              <option value="">Seleccionar concepto...</option>
                              {trabajosConfig.length > 0 ? (
                                trabajosConfig.map(tc => (
                                  <optgroup key={tc.id} label={tc.id}>
                                    {tc.opciones.map(opt => <option key={`${tc.id}-${opt}`} value={opt}>{opt}</option>)}
                                  </optgroup>
                                ))
                              ) : (
                                ['Nuevo', 'Revisión', 'Reparación', 'Instalación', 'Suministro', 'Visita técnica'].map(opt => <option key={opt} value={opt}>{opt}</option>)
                              )}
                            </select>
                          </td>
                          <td className="p-2 relative">
                            <div className="flex items-center gap-1">
                              <input type="text" value={item.descripcion} onChange={e => updateItem(index, 'descripcion', e.target.value)} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1" placeholder="Detalle del trabajo..." />
                              <button type="button" onClick={() => setEditingDescriptionIndex(index)} className="p-1.5 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Ampliar descripción">
                                <Maximize2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="p-2"><input type="number" step="0.01" value={item.precioUnidad} onChange={e => updateItem(index, 'precioUnidad', parseFloat(e.target.value))} className="w-full text-right bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1" /></td>
                          <td className="px-4 py-2 text-right font-bold text-zinc-900">{formatMoneda(item.subtotal)}</td>
                          <td className="p-2"><button type="button" onClick={() => removeItem(index)} className="p-1 text-zinc-300 hover:text-red-500 transition-colors"><Trash className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vista Móvil */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {form.items.map((item, index) => (
                    <div key={index} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex flex-col gap-2 relative">
                      <div className="flex justify-between items-start">
                        <div className="pr-4">
                          <span className="text-[10px] font-bold text-white bg-violet-600 px-2 py-0.5 rounded-md uppercase tracking-wider">{item.concepto || 'Sin concepto'}</span>
                          <p className="text-sm font-bold text-zinc-900 mt-1.5 leading-snug">{item.descripcion || <span className="text-zinc-400 font-normal italic">Sin descripción</span>}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-zinc-900">{formatMoneda(item.subtotal)}</p>
                          <p className="text-[11px] font-medium text-zinc-500 mt-0.5">{item.cantidad} x {formatMoneda(item.precioUnidad)}</p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-zinc-100">
                        <button type="button" onClick={() => setEditingLineIndex(index)} className="px-3 py-1.5 text-zinc-600 hover:text-violet-700 bg-zinc-100 hover:bg-violet-100 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold">
                          <Edit className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button type="button" onClick={() => removeItem(index)} className="px-3 py-1.5 text-zinc-600 hover:text-red-600 bg-zinc-100 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold">
                          <Trash className="w-3.5 h-3.5" /> Borrar
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => {
                    const nextIndex = form.items.length;
                    addItem();
                    setTimeout(() => setEditingLineIndex(nextIndex), 0);
                  }} className="w-full py-3.5 border-2 border-dashed border-zinc-300 text-zinc-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-50 hover:text-violet-600 hover:border-violet-300 transition-colors mt-2">
                    <Plus className="w-4 h-4" /> Añadir Nueva Línea
                  </button>
                </div>
              </div>

              {/* Firmas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-zinc-100">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Firma del Cliente</label>
                  <div className="space-y-2">
                    <input type="text" value={form.nombreFirmante} onChange={e => setForm({...form, nombreFirmante: e.target.value})} placeholder="Nombre del receptor" className="w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none" />
                    <canvas ref={canvasClienteRef} width={600} height={200} className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-2xl touch-none shadow-inner" />
                    <div className="flex justify-between items-center px-1">
                      <button type="button" onClick={() => canvasClienteRef.current?.getContext('2d')?.clearRect(0,0,2000,2000)} className="text-[10px] text-zinc-400 underline p-1">Limpiar firma</button>
                      <button type="button" onClick={() => setSigningRole('cliente')} className="text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"><Maximize2 className="w-3 h-3"/> Pantalla completa</button>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Firma del Técnico</label>
                  <div className="space-y-2">
                    <select value={form.tecnicoId} onChange={e => setForm({...form, tecnicoId: e.target.value})} className="w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none">
                      <option value="">Selecciona Técnico...</option>
                      {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre} {t.apellidos}</option>)}
                    </select>
                    <canvas ref={canvasTecnicoRef} width={600} height={200} className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-2xl touch-none shadow-inner" />
                    <div className="flex justify-between items-center px-1">
                      <button type="button" onClick={() => canvasTecnicoRef.current?.getContext('2d')?.clearRect(0,0,2000,2000)} className="text-[10px] text-zinc-400 underline p-1">Limpiar firma</button>
                      <button type="button" onClick={() => setSigningRole('tecnico')} className="text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"><Maximize2 className="w-3 h-3"/> Pantalla completa</button>
                    </div>
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

        {/* Modal de Descripción Ampliada */}
        {editingDescriptionIndex !== null && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                   <h3 className="font-bold text-zinc-800">Descripción del trabajo</h3>
                   <button onClick={() => setEditingDescriptionIndex(null)} className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors"><X className="w-5 h-5 text-zinc-500"/></button>
                </div>
                <div className="p-5">
                   <textarea
                     autoFocus
                     className="w-full h-48 p-4 bg-zinc-50 border border-zinc-200 rounded-xl resize-none outline-none focus:ring-2 focus:ring-violet-500/20 text-sm"
                     value={form.items[editingDescriptionIndex].descripcion}
                     onChange={e => updateItem(editingDescriptionIndex, 'descripcion', e.target.value)}
                     placeholder="Escribe la descripción detallada del trabajo realizado..."
                   />
                </div>
                <div className="px-5 py-4 border-t border-zinc-100 flex justify-end bg-zinc-50">
                   <button type="button" onClick={() => setEditingDescriptionIndex(null)} className="px-6 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-zinc-800 transition-colors shadow-lg active:scale-95">Aceptar</button>
                </div>
             </div>
          </div>
        )}
      </div>

        {/* Modal de Firma en Pantalla Completa */}
        {signingRole !== null && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-6">
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <h3 className="font-bold text-zinc-800 text-lg">
                  {signingRole === 'cliente' ? 'Firma del Cliente' : 'Firma del Técnico'}
                </h3>
                <button type="button" onClick={() => setSigningRole(null)} className="p-2 hover:bg-zinc-200 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-zinc-500" />
                </button>
              </div>
              
              <div className="p-4 sm:p-8 bg-zinc-100/50 flex-1 flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-full bg-white p-2 rounded-2xl shadow-sm border border-zinc-200">
                  <canvas 
                    ref={modalCanvasRef} 
                    width={800} 
                    height={400} 
                    className="w-full h-[40vh] sm:h-80 bg-white rounded-xl touch-none" 
                  />
                </div>
              </div>

              <div className="px-6 py-5 border-t border-zinc-100 flex justify-between items-center bg-white">
                <button 
                  type="button" 
                  onClick={() => modalCanvasRef.current?.getContext('2d')?.clearRect(0,0,2000,2000)} 
                  className="px-6 py-3 text-sm font-bold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Limpiar
                </button>
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setSigningRole(null)} 
                    className="px-6 py-3 text-sm font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      const dataUrl = modalCanvasRef.current?.toDataURL('image/png');
                      const targetCanvas = signingRole === 'cliente' ? canvasClienteRef.current : canvasTecnicoRef.current;
                      if (dataUrl && targetCanvas) {
                        const img = new Image();
                        img.onload = () => {
                          const ctx = targetCanvas.getContext('2d');
                          ctx?.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                          ctx?.drawImage(img, 0, 0, targetCanvas.width, targetCanvas.height);
                        };
                        img.src = dataUrl;
                      }
                      setSigningRole(null);
                    }} 
                    className="px-8 py-3 text-sm font-bold text-white bg-black hover:bg-zinc-800 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Guardar Firma
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edición de Línea */}
        {editingLineIndex !== null && form.items[editingLineIndex] && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                   <h3 className="font-bold text-zinc-800">Detalles de la línea</h3>
                   <button onClick={() => setEditingLineIndex(null)} className="p-1.5 hover:bg-zinc-200 rounded-lg transition-colors"><X className="w-5 h-5 text-zinc-500"/></button>
                </div>
                <div className="p-5 space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                       <label className="text-xs font-bold text-zinc-500 uppercase">Cantidad</label>
                       <input type="number" min="1" value={form.items[editingLineIndex].cantidad} onChange={e => updateItem(editingLineIndex, 'cantidad', parseInt(e.target.value))} className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20" />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-xs font-bold text-zinc-500 uppercase">Concepto</label>
                       <select value={form.items[editingLineIndex].concepto} onChange={e => updateItem(editingLineIndex, 'concepto', e.target.value)} className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 text-sm">
                          <option value="">Seleccionar...</option>
                          {trabajosConfig.length > 0 ? (
                            trabajosConfig.map(tc => (
                              <optgroup key={tc.id} label={tc.id}>
                                {tc.opciones.map(opt => <option key={`${tc.id}-${opt}`} value={opt}>{opt}</option>)}
                              </optgroup>
                            ))
                          ) : (
                            ['Nuevo', 'Revisión', 'Reparación', 'Instalación', 'Suministro', 'Visita técnica'].map(opt => <option key={opt} value={opt}>{opt}</option>)
                          )}
                        </select>
                     </div>
                   </div>
                   
                   <div className="space-y-1.5">
                     <label className="text-xs font-bold text-zinc-500 uppercase">Descripción</label>
                     <textarea
                       className="w-full h-28 p-3 bg-zinc-50 border border-zinc-200 rounded-xl resize-none outline-none focus:ring-2 focus:ring-violet-500/20 text-sm"
                       value={form.items[editingLineIndex].descripcion}
                       onChange={e => updateItem(editingLineIndex, 'descripcion', e.target.value)}
                       placeholder="Detalle del trabajo o materiales..."
                     />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                       <label className="text-xs font-bold text-zinc-500 uppercase">Precio Unidad</label>
                       <input type="number" step="0.01" value={form.items[editingLineIndex].precioUnidad} onChange={e => updateItem(editingLineIndex, 'precioUnidad', parseFloat(e.target.value))} className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 text-right font-bold" />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-xs font-bold text-zinc-500 uppercase">Subtotal</label>
                       <div className="w-full px-3 py-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-right font-bold text-zinc-700">
                         {formatMoneda(form.items[editingLineIndex].subtotal)}
                       </div>
                     </div>
                   </div>
                </div>
                <div className="px-5 py-4 border-t border-zinc-100 flex justify-end bg-white">
                   <button type="button" onClick={() => setEditingLineIndex(null)} className="px-6 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-zinc-800 transition-colors shadow-md active:scale-95">Guardar Línea</button>
                </div>
             </div>
          </div>
        )}
    </div>
  );
}