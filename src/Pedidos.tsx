import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Plus, Building2, Calendar, Clock, CheckCircle, FileText, Trash2, Edit, Save, ChevronDown, ArrowLeft } from 'lucide-react';
import { subscribePedidos, addPedido, updatePedido, deletePedido, subscribeClientes, subscribeCentros, subscribePresupuestos, type Pedido, type Presupuesto, type Cliente, type Centro } from './firebase';

const ESTADOS = [
  { valor: 'Pendiente' as const, color: 'bg-amber-100 text-amber-700 border-amber-200', icono: Clock },
  { valor: 'En Proceso' as const, color: 'bg-sky-100 text-sky-700 border-zinc-300', icono: Clock },
  { valor: 'Completado' as const, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icono: CheckCircle },
];

const formatMoneda = (valor: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(valor || 0);

export default function Pedidos() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [view, setView] = useState<'list' | 'form'>('list');
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<Pedido>({
    id: '',
    empresaId: '',
    clienteId: '',
    centroId: '',
    fechaCreacion: new Date().toISOString(),
    titulo: '',
    numeroPedido: '',
    items: [],
    estado: 'Pendiente',
    presupuestoId: ''
  });

  useEffect(() => {
    const unsubPedidos = subscribePedidos(setPedidos);
    const unsubClientes = subscribeClientes(setClientes);
    const unsubCentros = subscribeCentros(setCentros);
    const unsubPresupuestos = subscribePresupuestos(setPresupuestos);
    return () => { unsubPedidos(); unsubClientes(); unsubCentros(); unsubPresupuestos(); };
  }, []);

  const presupuestosAprobados = useMemo(() =>
    presupuestos.filter(p => p.estado === 'Aprobado' && !pedidos.some(ped => ped.presupuestoId === p.id)),
    [presupuestos, pedidos]
  );

  const filteredPedidos = useMemo(() => {
    let result = pedidos;
    if (statusFilter !== 'Todos') {
      result = result.filter(p => p.estado === statusFilter);
    }
    if (!searchTerm.trim()) return result;
    const term = searchTerm.toLowerCase();
    return result.filter(p =>
      p.titulo.toLowerCase().includes(term) ||
      (p.numeroPedido || '').toLowerCase().includes(term) ||
      clientes.find(c => c.id === p.clienteId)?.nombre?.toLowerCase().includes(term)
    );
  }, [pedidos, searchTerm, clientes, statusFilter]);

  const getEstadoInfo = (estado: string) => ESTADOS.find(e => e.valor === estado) || ESTADOS[0];

  const handleNuevo = () => {
    setEditingId(null);
    setForm({
      id: '',
      empresaId: '',
      clienteId: '',
      centroId: '',
      titulo: '',
      fechaCreacion: new Date().toISOString(),
      fechaPrevista: '',
      items: [{ cantidad: 1, concepto: 'Trabajo', descripcion: '', precioUnidad: 0, subtotal: 0 }],
      estado: 'Pendiente',
      presupuestoId: '',
      numeroPedido: `PED-${new Date().getFullYear().toString().slice(-2)}-${String(pedidos.length + 1).padStart(3, '0')}`,
      notas: '',
    });
    setView('form');
  };

  const handleCrearDesdePresupuesto = (p: Presupuesto) => {
    setEditingId(null);
    setForm({
      id: '',
      empresaId: '',
      clienteId: p.clienteId,
      centroId: '',
      titulo: p.titulo,
      fechaCreacion: new Date().toISOString(),
      fechaPrevista: '',
      items: p.lineas.map(l => ({ cantidad: l.cantidad, concepto: l.concepto, descripcion: l.descripcion || '', precioUnidad: l.precioUnidad, subtotal: l.subtotal })),
      estado: 'Pendiente',
      presupuestoId: p.id,
      numeroPedido: `PED-${new Date().getFullYear().toString().slice(-2)}-${String(pedidos.length + 1).padStart(3, '0')}`,
      notas: `Pedido creado desde presupuesto: ${p.numeroPresupuesto || p.id}`,
    });
    setView('form');
  };

  const handleEdit = (ped: Pedido) => {
    setEditingId(ped.id || null);
    setForm({ ...ped });
    setView('form');
  };

  // Guarda el pedido en Firebase (colección "pedidos")
  const handleSave = async () => {
    if (!form.titulo.trim() || !form.clienteId) {
      alert('Rellena el título y selecciona un cliente.');
      return;
    }
    try {
      if (editingId) {
        const docId = (form as any)._docId || editingId;
        await updatePedido(docId, form as Partial<Pedido>);
      } else {
        await addPedido(form);
      }
      setView('list');
      setEditingId(null);
    } catch (e) {
      console.error('Error guardando pedido en Firebase:', e);
      alert('Error al guardar el pedido.');
    }
  };

  const handleDelete = async (ped: Pedido) => {
    if (!confirm(`¿Eliminar el pedido "${ped.titulo}"?`)) return;
    const docId = (ped as any)._docId || ped.id;
    try { await deletePedido(docId); } catch (e) { console.error(e); }
  };

  const handleCambiarEstado = async (ped: Pedido, estado: Pedido['estado']) => {
    const docId = (ped as any)._docId || ped.id;
    try { await updatePedido(docId, { estado } as Partial<Pedido>); } catch (e) { console.error(e); }
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { cantidad: 1, concepto: 'Trabajo', descripcion: '', precioUnidad: 0, subtotal: 0 }] });
  };

  const removeItem = (index: number) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const items = form.items.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value };
        if (field === 'cantidad' || field === 'precioUnidad') {
          updated.subtotal = (updated.cantidad || 0) * (updated.precioUnidad || 0);
        }
        return updated;
      }
      return item;
    });
    setForm({ ...form, items });
  };

  if (view === 'list') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
          </button>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Pedidos de Clientes</h1>
          <p className="text-xs font-semibold text-zinc-500 mt-1">Gestión y control de pedidos y trabajos aprobados en ejecución.</p>
        </div>

        {/* Pestañas + botones */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          {/* Pestañas */}
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1.5 rounded-2xl w-fit border border-zinc-200/40">
            <button
              onClick={() => setStatusFilter('Todos')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                statusFilter === 'Todos'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <FileText className={`w-4 h-4 ${statusFilter === 'Todos' ? 'text-red-600' : 'text-zinc-400'}`} />
              Todos
              <span className={`text-[10px] font-black font-sans px-2 py-0.5 rounded-md transition-colors ${
                statusFilter === 'Todos' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {pedidos.length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('Pendiente')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                statusFilter === 'Pendiente'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <Clock className={`w-4 h-4 ${statusFilter === 'Pendiente' ? 'text-red-600' : 'text-zinc-400'}`} />
              Pendientes
              <span className={`text-[10px] font-black font-sans px-2 py-0.5 rounded-md transition-colors ${
                statusFilter === 'Pendiente' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-250 text-zinc-500'
              }`}>
                {pedidos.filter(p => p.estado === 'Pendiente').length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('En Proceso')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                statusFilter === 'En Proceso'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <Clock className={`w-4 h-4 ${statusFilter === 'En Proceso' ? 'text-red-650' : 'text-zinc-400'}`} />
              En Proceso
              <span className={`text-[10px] font-black font-sans px-2 py-0.5 rounded-md transition-colors ${
                statusFilter === 'En Proceso' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-250 text-zinc-500'
              }`}>
                {pedidos.filter(p => p.estado === 'En Proceso').length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('Completado')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                statusFilter === 'Completado'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <CheckCircle className={`w-4 h-4 ${statusFilter === 'Completado' ? 'text-red-600' : 'text-zinc-400'}`} />
              Completados
              <span className={`text-[10px] font-black font-sans px-2 py-0.5 rounded-md transition-colors ${
                statusFilter === 'Completado' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-250 text-zinc-500'
              }`}>
                {pedidos.filter(p => p.estado === 'Completado').length}
              </span>
            </button>
          </div>

          {/* Botón de nuevo */}
          <button 
            onClick={handleNuevo} 
            className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all text-xs cursor-pointer w-full lg:w-auto"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo Pedido
          </button>
        </div>

        {presupuestosAprobados.length > 0 && (
          <div className="mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <p className="text-xs font-bold text-emerald-700 uppercase mb-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Presupuestos aprobados pendientes de pedido
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {presupuestosAprobados.map(p => (
                <button key={p.id} onClick={() => handleCrearDesdePresupuesto(p)} className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-800 truncate">{p.titulo}</p>
                    <p className="text-[10px] text-zinc-500">{p.nombreCliente} — {formatMoneda(p.total)}</p>
                  </div>
                  <Plus className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input type="text" className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none text-sm" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {filteredPedidos.length === 0 ? (
          <div className="bg-white rounded-3xl border border-zinc-200 p-16 text-center">
            <FileText className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900 mb-2">{searchTerm ? 'Sin resultados' : 'No hay pedidos'}</h3>
            <p className="text-zinc-500 text-sm">Crea un nuevo pedido o convierte un presupuesto aprobado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPedidos.map(ped => {
              const estadoInfo = getEstadoInfo(ped.estado);
              const EstadoIcono = estadoInfo.icono;
              const cliente = clientes.find(c => c.id === ped.clienteId);
              const subtotal = ped.items.reduce((s, i) => s + i.subtotal, 0);
              return (
                <div key={ped.id || ped._docId} className="bg-white rounded-xl border border-zinc-200 p-4 hover:shadow-sm transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-zinc-900 truncate">{ped.titulo}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${estadoInfo.color}`}>
                          <EstadoIcono className="w-3 h-3" /> {estadoInfo.valor}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                        <span className="font-mono font-bold text-zinc-400">{ped.numeroPedido || ped.id}</span>
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{cliente?.nombre || 'Cliente'}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(ped.fechaCreacion).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">{ped.items.length} línea(s) — <span className="font-bold">{formatMoneda(subtotal)}</span></div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {ped.estado !== 'Completado' && (
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenStatusMenuId(openStatusMenuId === (ped.id || ped._docId || '') ? null : (ped.id || ped._docId || ''));
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-650 hover:bg-red-50 rounded-xl"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          {openStatusMenuId === (ped.id || ped._docId || '') && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenStatusMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-zinc-200 py-1 min-w-[130px] z-50 animate-in fade-in zoom-in-95 duration-100">
                                {ESTADOS.filter(e => e.valor !== ped.estado).map(e => {
                                  const Icono = e.icono;
                                  return (
                                    <button 
                                      key={e.valor} 
                                      onClick={() => {
                                        handleCambiarEstado(ped, e.valor);
                                        setOpenStatusMenuId(null);
                                      }} 
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
                                    >
                                      <Icono className="w-3.5 h-3.5" /> {e.valor}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <button onClick={() => handleEdit(ped)} className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(ped)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const filteredCentros = centros.filter(c => c.clienteId === form.clienteId);

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => { setView('list'); setEditingId(null); }} className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 md:p-8">
          <h2 className="text-lg font-bold text-zinc-900 mb-6">{editingId ? 'Editar Pedido' : 'Nuevo Pedido'}</h2>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Título *</label>
                <input type="text" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/10 focus:border-red-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Nº Pedido</label>
                <input type="text" value={form.numeroPedido || ''} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold outline-none" readOnly />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Cliente *</label>
                <select value={form.clienteId} onChange={e => setForm({ ...form, clienteId: e.target.value, centroId: '' })} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm outline-none">
                  <option value="">Selecciona...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Centro</label>
                <select value={form.centroId} onChange={e => setForm({ ...form, centroId: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm outline-none" disabled={!form.clienteId}>
                  <option value="">Sin centro</option>
                  {filteredCentros.map(c => <option key={c._docId || c.id} value={c._docId || c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Fecha prevista</label>
                <input type="date" value={form.fechaPrevista || ''} onChange={e => setForm({ ...form, fechaPrevista: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Estado</label>
                <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as Pedido['estado'] })} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm outline-none">
                  {ESTADOS.map(e => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
                </select>
              </div>
            </div>

            {form.presupuestoId && (
              <div className="p-3 bg-red-50 rounded-xl border border-blue-200 text-xs text-red-650">
                Creado desde presupuesto: {presupuestos.find(p => p.id === form.presupuestoId)?.numeroPresupuesto || form.presupuestoId}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-zinc-500 uppercase">Líneas de trabajo</label>
                <button type="button" onClick={addItem} className="text-xs font-bold text-red-650 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Añadir</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-900 text-white uppercase font-bold">
                      <th className="px-3 py-2 text-left w-14">Cant.</th>
                      <th className="px-3 py-2 text-left w-48">Concepto</th>
                      <th className="px-3 py-2 text-left">Descripción</th>
                      <th className="px-3 py-2 text-right w-28">P. Unidad</th>
                      <th className="px-3 py-2 text-right w-28">Subtotal</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {form.items.map((item, index) => (
                      <tr key={index} className="group">
                        <td className="p-1"><input type="number" min="1" value={item.cantidad} onChange={e => updateItem(index, 'cantidad', parseInt(e.target.value))} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1 text-center" /></td>
                        <td className="p-1"><input type="text" value={item.concepto} onChange={e => updateItem(index, 'concepto', e.target.value)} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1" /></td>
                        <td className="p-1"><input type="text" value={item.descripcion} onChange={e => updateItem(index, 'descripcion', e.target.value)} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1" /></td>
                        <td className="p-1"><input type="number" step="0.01" min="0" value={item.precioUnidad} onChange={e => updateItem(index, 'precioUnidad', parseFloat(e.target.value))} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1 text-right" /></td>
                        <td className="px-3 py-2 text-right font-bold text-zinc-800">{formatMoneda(item.subtotal)}</td>
                        <td className="p-1"><button type="button" onClick={() => removeItem(index)} className="p-1 text-zinc-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-3 text-sm">
                <span className="font-bold text-zinc-800">Total: {formatMoneda(form.items.reduce((s, i) => s + i.subtotal, 0))}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Notas</label>
              <textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm outline-none resize-none" />
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-100">
              <button onClick={handleSave} className="flex items-center gap-2 bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95">
                <Save className="w-4 h-4" /> {editingId ? 'Actualizar Pedido' : 'Crear Pedido'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}