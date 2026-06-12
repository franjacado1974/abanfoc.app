import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Download, Edit, Send, Trash2, Save, Package, Wrench, Type, Calculator, CheckCircle, Clock, Ban, ChevronDown, FileText } from 'lucide-react';
import { subscribePresupuestos, addPresupuesto, updatePresupuesto, deletePresupuesto, subscribeClientes, subscribeArticulos, subscribeCentros, subscribeImpuestos } from './firebase';
import type { Presupuesto, PresupuestoLinea, Cliente, Articulo, Centro } from './firebase';
import { generarPresupuestoPDF } from './pdfGenerator';

const ESTADOS: { valor: Presupuesto['estado']; etiqueta: string; color: string; bg: string; icono: React.ElementType }[] = [
  { valor: 'Borrador', etiqueta: 'Borrador', color: 'text-zinc-600', bg: 'bg-zinc-100', icono: FileText },
  { valor: 'Enviado', etiqueta: 'Enviado', color: 'text-sky-600', bg: 'bg-sky-100', icono: Send },
  { valor: 'En espera', etiqueta: 'En espera', color: 'text-amber-600', bg: 'bg-amber-100', icono: Clock },
  { valor: 'Aprobado', etiqueta: 'Aprobado', color: 'text-emerald-600', bg: 'bg-emerald-100', icono: CheckCircle },
  { valor: 'Rechazado', etiqueta: 'Rechazado', color: 'text-red-600', bg: 'bg-red-100', icono: Ban },
];

const generateId = () => crypto.randomUUID?.()?.slice(0, 8)?.toUpperCase() || Math.random().toString(36).slice(2, 10).toUpperCase();

function formatMoneda(valor: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(Number(valor) || 0);
}

// La función formatDecimal no se usa actualmente y se ha eliminado para evitar errores de compilación.

function formatDecimalInput(valor: number): string {
  if (valor === 0) return '0';
  return String(valor).replace('.', ',');
}

function parseDecimal(valor: string): number {
  return Number(String(valor).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
}

function formatFecha(fecha: string): string {
  if (!fecha) return '—';
  try {
    return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return fecha;
  }
}

// Componente para el menú de estados que se posiciona a la derecha del botón
function EstadoMenu({ 
  p, 
  openStatusMenuId, 
  setOpenStatusMenuId,
  handleCambiarEstado 
}: { 
  p: Presupuesto; 
  openStatusMenuId: string | null; 
  setOpenStatusMenuId: (id: string | null) => void;
  handleCambiarEstado: (p: Presupuesto, nuevoEstado: Presupuesto['estado']) => void;
}) {
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 400; // ancho aproximado del menú horizontal
    const menuHeight = 48; // alto aproximado del menú
    let left = rect.right + 8;
    let top = rect.top;
    // Si se sale por la derecha, mostrar a la izquierda
    if (left + menuWidth > window.innerWidth) {
      left = rect.left - menuWidth - 8;
    }
    // Si se sale por la izquierda, mostrar a la derecha
    if (left < 0) {
      left = 8;
    }
    // Si se sale por abajo, mostrar hacia arriba
    if (top + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 8;
    }
    // Si se sale por arriba, mostrar abajo
    if (top < 0) {
      top = 8;
    }
    setMenuPos({ top, left });
    setOpenStatusMenuId(openStatusMenuId === p.id ? null : p.id);
  };

  return (
    <div className="relative inline-block">
      <button 
        onClick={handleClick}
        className="p-1.5 text-zinc-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all" 
        title="Cambiar estado"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {openStatusMenuId === p.id && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenStatusMenuId(null)} />
          <div 
            className="fixed z-50 bg-white rounded-xl shadow-xl border border-zinc-200 py-2 px-3 flex items-center gap-2"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {ESTADOS.filter(e => e.valor !== p.estado && e.valor !== 'Borrador').map(e => {
              const Icono = e.icono;
              return (
                <button
                  key={e.valor}
                  onClick={() => {
                    handleCambiarEstado(p, e.valor);
                    setOpenStatusMenuId(null);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 ${e.color} ${e.bg} hover:opacity-80`}
                >
                  <Icono className="w-4 h-4" /> {e.etiqueta}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [servicios, setServicios] = useState<Articulo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPresupuesto, setEditingPresupuesto] = useState<Presupuesto | null>(null);
  const [showDetail, setShowDetail] = useState<Presupuesto | null>(null);
  const [showCatalogo, setShowCatalogo] = useState<'articulo' | 'servicio' | null>(null);
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const [catalogoSearch, setCatalogoSearch] = useState('');

  // Form state
  const [formTitulo, setFormTitulo] = useState('');
  const [formClienteId, setFormClienteId] = useState('');
  const [formClienteSearch, setFormClienteSearch] = useState('');
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [formFechaValidez, setFormFechaValidez] = useState('');
  const [formNotas, setFormNotas] = useState('');
  const getDefaultIva = () => {
    try {
      const config = JSON.parse(localStorage.getItem('firecheck_impuestos_config') || '{}');
      return config.iva || 21;
    } catch { return 21; }
  };
  const [formIva, setFormIva] = useState(getDefaultIva());
  const [formIvaExento, setFormIvaExento] = useState(false);
  const [formCentroId, setFormCentroId] = useState('');
  const [centros, setCentros] = useState<Centro[]>([]);
  
  // Definimos una interfaz extendida para las líneas del formulario
  interface EditablePresupuestoLinea extends PresupuestoLinea {
    precioUnidadInput?: string; // Para manejar el input de texto mientras se edita
  }
  const [formLineas, setFormLineas] = useState<EditablePresupuestoLinea[]>([]);
  const [formNewLinea, setFormNewLinea] = useState({ concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0 });
  const [usuarioActual, setUsuarioActual] = useState<{ nombre: string; apellidos?: string } | null>(null);

  // Obtener usuario actual
  useEffect(() => {
    try {
      const session = sessionStorage.getItem('firecheck_logged_user');
      if (session) {
        const user = JSON.parse(session);
        setUsuarioActual(user);
      }
    } catch (e) {
      console.error('Error obteniendo usuario actual:', e);
    }
  }, []);

  const filteredClientes = useMemo(() => {
    const term = formClienteSearch.trim().toLowerCase();
    if (!term) return clientes;
    return clientes.filter(c => c.nombre?.toLowerCase().includes(term) || String(c.id).toLowerCase().includes(term));
  }, [clientes, formClienteSearch]);

  const selectedCliente = clientes.find(c => c.id === formClienteId);

  const centrosFiltrados = useMemo(() => {
    if (!formClienteId) return [];
    return centros.filter(c => c.clienteId === formClienteId);
  }, [centros, formClienteId]);

  // Cargar datos
  useEffect(() => {
    const unsub1 = subscribePresupuestos(items => {
      setPresupuestos(items);
      localStorage.setItem('firecheck_db_presupuestos', JSON.stringify(items));
    });
    const unsub2 = subscribeClientes(items => {
      try { setClientes(Array.isArray(items) ? items : []); } catch {}
    });
    const unsub3 = subscribeArticulos(items => {
      try {
        const arr = Array.isArray(items) ? items : [];
        setArticulos(arr.filter(a => a && a.revisable !== false));
        setServicios(arr.filter(a => a && (a.revisable === false || a.revisable === undefined)));
      } catch {}
    });
    const unsub4 = subscribeCentros(items => {
      try { setCentros(Array.isArray(items) ? items : []); } catch {}
    });
    const unsub5 = subscribeImpuestos((config) => {
      if (config) {
        localStorage.setItem('firecheck_impuestos_config', JSON.stringify({ iva: config.iva, exento: config.exento }));
      }
    });

    // Cargar desde localStorage como fallback
    try {
      const saved = localStorage.getItem('firecheck_db_presupuestos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPresupuestos(parsed);
      }
    } catch {}

    return () => { try { unsub1(); } catch {} try { unsub2(); } catch {} try { unsub3(); } catch {} try { unsub4(); } catch {} try { unsub5(); } catch {} };
  }, []);

  // Filtrar presupuestos
  const filteredPresupuestos = useMemo(() => {
    if (!searchTerm.trim()) return presupuestos;
    const term = searchTerm.toLowerCase().trim();
    return presupuestos.filter(p =>
      p.titulo.toLowerCase().includes(term) ||
      (p.nombreCliente || '').toLowerCase().includes(term) ||
      p.fechaCreacion.includes(term) ||
      p.id.toLowerCase().includes(term) ||
      (p.numeroPresupuesto || '').toLowerCase().includes(term)
    );
  }, [presupuestos, searchTerm]);

  // Calcular totales del formulario
  const formSubtotal = useMemo(() =>
    formLineas.reduce((sum, l) => sum + (l.cantidad * l.precioUnidad), 0),
    [formLineas]
  );
  const formTotal = formSubtotal + (formSubtotal * formIva / 100);

  // Filtrar items del catálogo
  const filteredCatalogoItems = useMemo(() => {
    const items = showCatalogo === 'articulo' ? articulos : servicios;
    if (!catalogoSearch.trim()) return items;
    const term = catalogoSearch.toLowerCase().trim();
    return items.filter(item =>
      (item.nombre || '').toLowerCase().includes(term) ||
      (item.codigo || '').toLowerCase().includes(term) ||
      (item.familia || '').toLowerCase().includes(term)
    );
  }, [showCatalogo, articulos, servicios, catalogoSearch]);

  // Abrir formulario para nuevo presupuesto
  const handleNuevo = () => {
    setEditingPresupuesto(null);
    setFormTitulo('');
    setFormClienteId('');
    setFormFechaValidez('');
    setFormNotas('');
    setFormIva(getDefaultIva());
    setFormIvaExento(false);
    setFormLineas([]); // Reiniciar las líneas
    setFormNewLinea({ concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0 });
    setShowForm(true);
  };

  // Abrir formulario para editar
  const handleEditar = (p: Presupuesto) => {
    setEditingPresupuesto(p);
    setFormTitulo(p.titulo);
    setFormClienteId(p.clienteId);
    setFormCentroId(p.centroId || '');
    setFormFechaValidez(p.fechaValidez || '');
    setFormNotas(p.notas || '');
    setFormIva(p.iva);
    setFormLineas([...p.lineas.map(line => ({ ...line, precioUnidadInput: formatDecimalInput(line.precioUnidad) }))]); // Inicializar el input string
    setFormNewLinea({ concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0 });
    setShowForm(true);
  };

  // Añadir artículo/servicio desde catálogo
  const handleAddFromCatalogo = (item: Articulo, tipo: 'articulo' | 'servicio') => {
    const nuevaLinea: EditablePresupuestoLinea = {
      id: `L-${generateId()}`,
      tipo,
      codigo: item.codigo,
      concepto: item.nombre,
      cantidad: 1,
      precioUnidad: item.precioVenta,
      subtotal: item.precioVenta, // Se recalculará al cambiar cantidad/precio
      precioUnidadInput: formatDecimalInput(item.precioVenta), // Inicializar el input string
    };
    setFormLineas(prev => [...prev, nuevaLinea]);
    setShowCatalogo(null);
  };

  // Añadir línea manual
  const handleAddManual = () => {
    if (!formNewLinea.concepto.trim()) return;
    const nuevaLinea: EditablePresupuestoLinea = {
      id: `L-${generateId()}`,
      tipo: 'manual',
      concepto: formNewLinea.concepto,
      descripcion: formNewLinea.descripcion,
      cantidad: formNewLinea.cantidad,
      precioUnidad: formNewLinea.precioUnidad,
      subtotal: formNewLinea.cantidad * formNewLinea.precioUnidad, // Se recalculará al cambiar cantidad/precio
      precioUnidadInput: formatDecimalInput(formNewLinea.precioUnidad), // Inicializar el input string
    };
    setFormLineas(prev => [...prev, nuevaLinea]);
    setFormNewLinea({ concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0 });
  };

  // Eliminar línea del formulario
  const handleRemoveLinea = (id: string) => {
    setFormLineas(prev => prev.filter(l => l.id !== id));
  };

  // Guardar presupuesto
  const handleGuardar = async () => {
    if (!formTitulo.trim()) return alert('Introduce un título para el presupuesto.');
    if (!formClienteId) return alert('Selecciona un cliente.');
    if (formLineas.length === 0) return alert('Añade al menos una línea al presupuesto.');

    const cliente = clientes.find(c => c.id === formClienteId);
    const subtotal = formSubtotal;
    const total = formTotal;

    const presupuestoData: Presupuesto = {
      id: editingPresupuesto?.id || `PRE-${generateId()}`,
      titulo: formTitulo.trim(),
      clienteId: formClienteId,
      nombreCliente: cliente?.nombre || 'Cliente',
      centroId: formCentroId || undefined,
      fechaCreacion: editingPresupuesto?.fechaCreacion || new Date().toISOString(),
      fechaValidez: formFechaValidez || undefined,
      estado: editingPresupuesto?.estado || 'Borrador',
      lineas: formLineas.map(l => ({ ...l, subtotal: l.cantidad * l.precioUnidad })),
      subtotal,
      iva: formIva,
      total,
      notas: formNotas,
      usuarioRealizado: usuarioActual ? `${usuarioActual.nombre}${usuarioActual.apellidos ? ' ' + usuarioActual.apellidos : ''}` : undefined,
    };

    try {
      if (editingPresupuesto) {
        const docId = (editingPresupuesto as any)._docId || editingPresupuesto.id;
        await updatePresupuesto(docId, presupuestoData as any);
      } else {
        await addPresupuesto(presupuestoData as any);
      }
      setShowForm(false);
      setEditingPresupuesto(null);
    } catch (e) {
      console.error('Error guardando presupuesto:', e);
      alert('Error al guardar el presupuesto.');
    }
  };

  // Cambiar estado
  const handleCambiarEstado = async (p: Presupuesto, nuevoEstado: Presupuesto['estado']) => {
    const docId = (p as any)._docId || p.id;
    try {
      await updatePresupuesto(docId, { estado: nuevoEstado } as any);
    } catch (e) {
      console.error('Error actualizando estado:', e);
    }
  };

  // Eliminar presupuesto
  const handleEliminar = async (p: Presupuesto) => {
    if (!confirm(`¿Eliminar el presupuesto "${p.titulo}"? Esta acción no se puede deshacer.`)) return;
    if (!confirm('CONFIRMACIÓN: ¿Estás seguro de querer eliminar este presupuesto definitivamente?')) return;
    const docId = (p as any)._docId || p.id;
    try {
      await deletePresupuesto(docId);
    } catch (e) {
      console.error('Error eliminando presupuesto:', e);
    }
  };

  // Descargar PDF
  const handleDescargar = (p: Presupuesto) => {
    generarPresupuestoPDF({
      titulo: p.titulo,
      numeroPresupuesto: p.numeroPresupuesto,
      nombreCliente: p.nombreCliente || 'Cliente',
      fechaCreacion: p.fechaCreacion,
      fechaValidez: p.fechaValidez,
      estado: p.estado,
      lineas: p.lineas.map(l => ({
        concepto: l.concepto,
        codigo: l.codigo,
        cantidad: l.cantidad,
        precioUnidad: l.precioUnidad,
        subtotal: l.subtotal,
      })),
      subtotal: p.subtotal,
      iva: p.iva,
      total: p.total,
      notas: p.notas,
    });
  };

  // Obtener info del estado
  const getEstadoInfo = (estado: Presupuesto['estado']) => ESTADOS.find(e => e.valor === estado) || ESTADOS[0];

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-6">
      <div className="w-full">
        {/* HEADER */}
        <div className="mb-10 flex flex-col items-center text-center space-y-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-zinc-900 tracking-tight">Presupuestos</h1>
            <p className="text-sm text-zinc-500 mt-1">{filteredPresupuestos.length} presupuesto{filteredPresupuestos.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
            {/* Buscador */}
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por título, cliente, fecha..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-700 placeholder-zinc-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all shadow-sm"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={handleNuevo}
              className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold shadow-lg shadow-orange-200 transition-all active:scale-95 shrink-0"
            >
              +Nuevo
            </button>
          </div>
        </div>

        {/* LISTA DE PRESUPUESTOS */}
        {filteredPresupuestos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-zinc-200 border-dashed">
            <Calculator className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900 mb-2">
              {searchTerm ? 'Sin resultados' : 'No hay presupuestos'}
            </h3>
            <p className="text-zinc-500 text-sm">
              {searchTerm ? 'No se encontraron presupuestos que coincidan con tu búsqueda.' : 'Crea tu primer presupuesto para empezar.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider text-xs">
                  <th className="px-4 py-3 text-left">Referencia</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Centro</th>
                  <th className="px-4 py-3 text-left">Título</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-right">Importe</th>
                  <th className="px-4 py-3 text-center">Actividad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredPresupuestos.map(p => {
                  const estadoInfo = getEstadoInfo(p.estado);
                  const EstadoIcono = estadoInfo.icono;
                  const nombreCentro = centros.find(c => c.id === p.centroId)?.nombre || '';
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono font-bold text-zinc-800">PDV-{p.numeroPresupuesto || p.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-zinc-800">{p.nombreCliente || 'Cliente'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-zinc-600">{nombreCentro || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-zinc-900 truncate max-w-[180px]">{p.titulo}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1 ${estadoInfo.bg} ${estadoInfo.color}`}>
                          <EstadoIcono className="w-3 h-3" />
                          {estadoInfo.etiqueta}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-zinc-500">{formatFecha(p.fechaCreacion)}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-zinc-900">{formatMoneda(p.total)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEditar(p)} className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Editar">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleCambiarEstado(p, 'Enviado')} className="p-1.5 text-zinc-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all" title="Enviar">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDescargar(p)} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Descargar">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleEliminar(p)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {/* Menú de estado en ventana horizontal */}
                          <EstadoMenu 
                            p={p} 
                            openStatusMenuId={openStatusMenuId} 
                            setOpenStatusMenuId={setOpenStatusMenuId}
                            handleCambiarEstado={handleCambiarEstado}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DETALLE */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900">{showDetail.titulo}</h2>
              <button onClick={() => setShowDetail(null)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Info general */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase">Cliente</p>
                  <p className="text-sm font-bold text-zinc-800">{showDetail.nombreCliente || 'Cliente'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase">Nº Presupuesto</p>
                  <p className="text-sm font-bold text-zinc-800 font-mono">{showDetail.numeroPresupuesto || showDetail.id}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase">Fecha creación</p>
                  <p className="text-sm text-zinc-700">{formatFecha(showDetail.fechaCreacion)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase">Validez</p>
                  <p className="text-sm text-zinc-700">{showDetail.fechaValidez ? formatFecha(showDetail.fechaValidez) : '—'}</p>
                </div>
              </div>

              {/* Líneas */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Líneas del presupuesto</h3>
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider">
                        <th className="px-3 py-2 text-left">Concepto</th>
                        <th className="px-3 py-2 text-center">Cant.</th>
                        <th className="px-3 py-2 text-right">Precio</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showDetail.lineas.map((l, i) => (
                        <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}>
                          <td className="px-3 py-2 text-zinc-800 font-medium">{l.concepto}{l.codigo ? <span className="text-zinc-400 font-mono ml-1">({l.codigo})</span> : ''}</td>
                          <td className="px-3 py-2 text-center text-zinc-600">{l.cantidad}</td>
                          <td className="px-3 py-2 text-right text-zinc-600">{formatMoneda(l.precioUnidad)}</td>
                          <td className="px-3 py-2 text-right font-bold text-zinc-800">{formatMoneda(l.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales */}
              <div className="border-t border-zinc-100 pt-4 flex flex-col items-end gap-1">
                <div className="text-sm text-zinc-500">Subtotal: <span className="font-bold text-zinc-800">{formatMoneda(showDetail.subtotal)}</span></div>
                <div className="text-sm text-zinc-500">IVA ({showDetail.iva}%): <span className="font-bold text-zinc-800">{formatMoneda(showDetail.subtotal * showDetail.iva / 100)}</span></div>
                <div className="text-lg font-black text-zinc-900">TOTAL: {formatMoneda(showDetail.total)}</div>
              </div>

              {/* Notas */}
              {showDetail.notas && (
                <div className="bg-zinc-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Notas</p>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap">{showDetail.notas}</p>
                </div>
              )}

              {/* Usuario */}
              {showDetail.usuarioRealizado && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-bold text-blue-600 uppercase mb-1">Realizado por</p>
                  <p className="text-sm font-semibold text-blue-900">{showDetail.usuarioRealizado}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex justify-end shrink-0">
              <button onClick={() => setShowDetail(null)} className="px-6 py-2.5 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORMULARIO (CREAR/EDITAR) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900">
                {editingPresupuesto ? 'Editar presupuesto' : 'Nuevo presupuesto'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Datos generales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Cliente *</label>
                  <input
                    type="text"
                    value={formClienteSearch || selectedCliente?.nombre || ''}
                    onChange={(e) => {
                      setFormClienteSearch(e.target.value);
                      setClienteDropdownOpen(true);
                      setFormClienteId('');
                    }}
                    onFocus={() => setClienteDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setClienteDropdownOpen(false), 150)}
                    placeholder="Escribe el nombre del cliente..."
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                  />
                  {clienteDropdownOpen && (
                    <div className="absolute z-20 mt-2 w-full rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
                      <div className="max-h-64 overflow-y-auto">
                        {filteredClientes.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-zinc-500">No hay clientes que coincidan.</div>
                        ) : (
                          filteredClientes.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormClienteId(c.id);
                                setFormClienteSearch(c.nombre || '');
                                setClienteDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-zinc-800 hover:bg-orange-50 transition-colors"
                            >
                              {c.nombre}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Centro</label>
                  <select
                    value={formCentroId}
                    onChange={(e) => setFormCentroId(e.target.value)}
                    disabled={!formClienteId}
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Selecciona un centro...</option>
                    {centrosFiltrados.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Título *</label>
                  <input
                    type="text"
                    value={formTitulo}
                    onChange={(e) => setFormTitulo(e.target.value.toUpperCase())}
                    placeholder="Ej: PRESUPUESTO MANTENIMIENTO ANUAL"
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 uppercase focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Fecha de validez</label>
                  <input
                    type="date"
                    value={formFechaValidez}
                    onChange={(e) => setFormFechaValidez(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Líneas del presupuesto */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase">Líneas del presupuesto</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowCatalogo('articulo')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors">
                      <Package className="w-3.5 h-3.5" /> Añadir artículo
                    </button>
                    <button onClick={() => setShowCatalogo('servicio')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors">
                      <Wrench className="w-3.5 h-3.5" /> Añadir servicio
                    </button>
                  </div>
                </div>

                {/* Tabla de líneas */}
                {formLineas.length > 0 ? (
                  <div className="border border-zinc-200 rounded-xl overflow-hidden mb-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider">
                          <th className="px-3 py-2 text-left w-8">Tipo</th>
                          <th className="px-3 py-2 text-left">Concepto</th>
                          <th className="px-3 py-2 text-center w-16">Cant.</th>
                          <th className="px-3 py-2 text-right w-28">Precio</th>
                          <th className="px-3 py-2 text-right w-28">Subtotal</th>
                          <th className="px-3 py-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formLineas.map((l, i) => (
                          <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'}>
                            <td className="px-3 py-2">
                              {l.tipo === 'articulo' ? <Package className="w-3.5 h-3.5 text-orange-500" /> :
                               l.tipo === 'servicio' ? <Wrench className="w-3.5 h-3.5 text-blue-500" /> :
                               <Type className="w-3.5 h-3.5 text-zinc-400" />}
                            </td>
                            <td className="px-3 py-2">
                              <p className="text-zinc-800 font-medium truncate max-w-[300px]">{l.concepto}</p>
                              {l.codigo && <p className="text-[10px] text-zinc-400 font-mono">{l.codigo}</p>}
                              {l.descripcion && <p className="text-[10px] text-zinc-400">{l.descripcion}</p>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="number"
                                value={l.cantidad}
                                onChange={(e) => {
                                  const nuevaCant = Math.max(0, Number(e.target.value));
                                  setFormLineas(prev => prev.map(li => li.id === l.id ? { ...li, cantidad: nuevaCant, subtotal: nuevaCant * li.precioUnidad } : li));
                                }}
                                min={0}
                                className="w-16 px-2 py-1 text-center text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={l.precioUnidadInput !== undefined ? l.precioUnidadInput : formatDecimalInput(l.precioUnidad)}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  setFormLineas(prev => prev.map(li => li.id === l.id ? { ...li, precioUnidadInput: inputValue, precioUnidad: parseDecimal(inputValue), subtotal: li.cantidad * parseDecimal(inputValue) } : li));
                                }}
                                onBlur={(e) => {
                                  const inputValue = e.target.value;
                                  const nuevoPrecio = Math.max(0, parseDecimal(inputValue));
                                  setFormLineas(prev => prev.map(li => li.id === l.id ? { ...li, precioUnidad: nuevoPrecio, precioUnidadInput: undefined, subtotal: li.cantidad * nuevoPrecio } : li));
                                }}
                                min={0}
                                className="w-24 px-2 py-1 text-right text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-zinc-800">{formatMoneda(l.cantidad * l.precioUnidad)}</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => handleRemoveLinea(l.id)} className="p-1 text-zinc-300 hover:text-red-500 rounded transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 mb-3">
                    <p className="text-sm text-zinc-400">No hay líneas añadidas. Usa los botones superiores para añadir artículos, servicios o una línea manual.</p>
                  </div>
                )}

                {/* Línea manual */}
                <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <input
                    type="text"
                    value={formNewLinea.concepto}
                    onChange={(e) => setFormNewLinea(prev => ({ ...prev, concepto: e.target.value }))}
                    placeholder="Concepto (línea manual)..."
                    className="flex-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                  />
                  <input
                    type="number"
                    value={formNewLinea.cantidad}
                    onChange={(e) => setFormNewLinea(prev => ({ ...prev, cantidad: Math.max(1, Number(e.target.value)) }))}
                    min={1}
                    className="w-16 px-2 py-1.5 text-center bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                    placeholder="Cant"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatDecimalInput(formNewLinea.precioUnidad)}
                    onChange={(e) => setFormNewLinea(prev => ({ ...prev, precioUnidad: Math.max(0, parseDecimal(e.target.value)) }))}
                    min={0}
                    className="w-24 px-2 py-1.5 text-right bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                    placeholder="0,00"
                  />
                  <button
                    onClick={handleAddManual}
                    disabled={!formNewLinea.concepto.trim()}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-300 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Añadir
                  </button>
                </div>
              </div>

              {/* IVA / Impuestos */}
              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Tipo de IVA</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setFormIvaExento(false); setFormIva(getDefaultIva()); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        !formIvaExento 
                          ? 'bg-orange-500 text-white shadow-sm' 
                          : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                      }`}
                    >
                      IVA {getDefaultIva()}%
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFormIvaExento(true); setFormIva(0); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        formIvaExento 
                          ? 'bg-orange-500 text-white shadow-sm' 
                          : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                      }`}
                    >
                      Exento
                    </button>
                  </div>
                </div>
                {formIvaExento && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-[11px] text-amber-800 italic leading-relaxed">
                      Factura exenta de IVA por inversión del sujeto pasivo de acuerdo con el artículo 84 letra f-Uno. 2º - Ley 37/1992 - art. 5 Ley 7/2012
                    </p>
                  </div>
                )}
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Notas</label>
                <textarea
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  rows={3}
                  placeholder="Condiciones, observaciones..."
                  className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none"
                />
                {usuarioActual && (
                  <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-100">
                    Presupuesto realizado por: <span className="font-semibold text-zinc-700">{usuarioActual.nombre}{usuarioActual.apellidos ? ' ' + usuarioActual.apellidos : ''}</span>
                  </div>
                )}
              </div>

              {/* Totales */}
              <div className="border-t border-zinc-100 pt-4 flex flex-col items-end gap-1">
                <div className="text-sm text-zinc-500">Subtotal: <span className="font-bold text-zinc-800">{formatMoneda(formSubtotal)}</span></div>
                {formIvaExento ? (
                  <div className="text-sm text-zinc-500">IVA: <span className="font-bold text-zinc-800">Exento (0%)</span></div>
                ) : (
                  <div className="text-sm text-zinc-500">IVA ({formIva}%): <span className="font-bold text-zinc-800">{formatMoneda(formSubtotal * formIva / 100)}</span></div>
                )}
                <div className="text-lg font-black text-orange-600">TOTAL: {formatMoneda(formTotal)}</div>
                {formIvaExento && (
                  <div className="text-[10px] text-zinc-400 italic text-right max-w-xs mt-1">
                    Factura exenta de IVA por inversión del sujeto pasivo de acuerdo con el artículo 84 letra f-Uno. 2º - Ley 37/1992 - art. 5 Ley 7/2012
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between gap-3 shrink-0">
              <button onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleGuardar} className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-lg shadow-orange-200 transition-all">
                <Save className="w-4 h-4" /> {editingPresupuesto ? 'Guardar cambios' : 'Crear presupuesto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CATÁLOGO (seleccionar artículo/servicio) */}
      {showCatalogo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                {showCatalogo === 'articulo' ? <Package className="w-5 h-5 text-orange-500" /> : <Wrench className="w-5 h-5 text-blue-500" />}
                {showCatalogo === 'articulo' ? 'Seleccionar artículo' : 'Seleccionar servicio'}
              </h2>
              <button onClick={() => { setShowCatalogo(null); setCatalogoSearch(''); }} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Buscador dentro del catálogo */}
            <div className="px-4 pt-2 pb-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={catalogoSearch}
                  onChange={(e) => setCatalogoSearch(e.target.value)}
                  placeholder="Buscar por nombre, código o familia..."
                  className="w-full pl-9 pr-8 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-700 placeholder-zinc-400 focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                />
                {catalogoSearch && (
                  <button onClick={() => setCatalogoSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 overflow-y-auto space-y-2">
              {(showCatalogo === 'articulo' ? articulos : servicios).length === 0 ? (
                <p className="text-center text-sm text-zinc-400 py-8">No hay {showCatalogo === 'articulo' ? 'artículos' : 'servicios'} disponibles en el catálogo.</p>
              ) : filteredCatalogoItems.length === 0 ? (
                <p className="text-center text-sm text-zinc-400 py-8">No se encontraron resultados para "{catalogoSearch}"</p>
              ) : (
                filteredCatalogoItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleAddFromCatalogo(item, showCatalogo)}
                    className="w-full flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-xl hover:border-orange-300 hover:bg-orange-50/30 transition-all text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-800 truncate">{item.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.codigo && <span className="text-[10px] font-mono text-zinc-400">{item.codigo}</span>}
                        {item.familia && <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{item.familia}</span>}
                      </div>
                    </div>
                    <span className="text-sm font-black text-zinc-900 ml-3">{formatMoneda(item.precioVenta)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}