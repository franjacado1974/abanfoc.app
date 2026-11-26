import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Building2,
  Plus,
  Users,
  Search,
  Edit,
  Trash2,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Eye,
  X
} from 'lucide-react';
import {
  subscribeClientesPotenciales,
  addClientePotencial,
  updateClientePotencial,
  deleteClientePotencial,
  type ClientePotencial
} from './firebase';
import ConfirmationModal from './ConfirmationModal';
import DetailModal from './components/DetailModal';
import { HandOptionsIcon } from './components/HandOptionsIcon';

const emptyPotencial: ClientePotencial = {
  id: '',
  nombre: '',
  cif: '',
  direccion: '',
  poblacion: '',
  cp: '',
  provincia: '',
  telefono: '',
  contacto: '',
  correo: '',
  correoGeneral: '',
  correoAdministracion: '',
  correoFacturacion: '',
  correoMantenimiento: '',
  correoCompras: '',
  correoPedidos: '',
  correoOtro: '',
  formaPago: '',
  vencimiento: '',
  iban: '',
  notas: ''
};

export default function ClientesPotenciales() {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [potenciales, setPotenciales] = useState<ClientePotencial[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [limite, setLimite] = useState<number | 'todos'>(15);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientePotencial>(emptyPotencial);
  const [isLoading, setIsLoading] = useState(false);

  const [accionesModalItem, setAccionesModalItem] = useState<ClientePotencial | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDetalle, setSelectedDetalle] = useState<ClientePotencial | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [potToDelete, setPotToDelete] = useState<ClientePotencial | null>(null);

  useEffect(() => {
    const unsub = subscribeClientesPotenciales((items) => setPotenciales(items));
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return potenciales;
    return potenciales.filter(
      (c) =>
        (c.nombre || '').toLowerCase().includes(term) ||
        (c.cif || '').toLowerCase().includes(term) ||
        (c.id || '').toLowerCase().includes(term) ||
        (c.poblacion || '').toLowerCase().includes(term) ||
        (c.telefono || '').toLowerCase().includes(term)
    );
  }, [potenciales, searchTerm]);

  const aMostrar = useMemo(() => {
    if (limite === 'todos') return filtered;
    return filtered.slice(0, limite);
  }, [filtered, limite]);

  const handleOpenNewForm = () => {
    setEditingDocId(null);
    setForm({
      ...emptyPotencial,
      id: `POT-${Date.now().toString().slice(-6)}`
    });
    setView('form');
  };

  const handleEdit = (c: ClientePotencial) => {
    setEditingDocId(c._docId || c.id);
    setForm({ ...emptyPotencial, ...c });
    setView('form');
  };

  const handleViewDetail = (c: ClientePotencial) => {
    setSelectedDetalle(c);
    setIsDetailOpen(true);
  };

  const handleDelete = (c: ClientePotencial) => {
    setPotToDelete(c);
    setIsConfirmModalOpen(true);
  };

  const confirmDeletePotencial = async () => {
    if (!potToDelete) return;
    try {
      await deleteClientePotencial(potToDelete._docId || potToDelete.id);
    } catch (err) {
      console.error('Error eliminando cliente potencial:', err);
    } finally {
      setIsConfirmModalOpen(false);
      setPotToDelete(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim()) return alert('El código de cliente potencial es obligatorio');
    if (!form.nombre.trim()) return alert('El nombre del cliente potencial es obligatorio');

    setIsLoading(true);
    try {
      const payload: ClientePotencial = {
        ...form,
        id: form.id.trim(),
        nombre: (form.nombre || '').toUpperCase()
      };
      if (editingDocId) {
        await updateClientePotencial(editingDocId, payload);
      } else {
        await addClientePotencial(payload);
      }
      setView('list');
      setForm(emptyPotencial);
      setEditingDocId(null);
    } catch (err) {
      console.error('Error al guardar en Firestore:', err);
      alert('Error al conectar con la base de datos.');
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'list') {
    return (
      <>
        <div className="px-4 md:px-8 py-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="text-center md:text-left flex flex-col items-center md:items-start">
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
                Directorio de Clientes Potenciales
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {potenciales.length} registrados para presupuestos (pasan automáticamente a Clientes al aceptar un pedido).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-60 lg:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <input
                  type="text"
                  className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none transition-all shadow-xs text-xs text-zinc-900 placeholder-zinc-400"
                  placeholder="Buscar clientes potenciales por nombre, CIF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={handleOpenNewForm}
                className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-xl font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />{' '}
                <span className="hidden sm:inline">Nuevo Cliente Potencial</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            </div>
          </div>

          {/* Tabla de Clientes Potenciales (mismo formato que Clientes) */}
          {potenciales.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 p-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-zinc-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-zinc-400" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Aún no hay clientes potenciales</h3>
              <p className="text-zinc-500 mb-8 max-w-md mx-auto">
                No tienes clientes potenciales guardados en la base de datos. Añade uno para poder asignarlo a presupuestos.
              </p>
              <button
                onClick={handleOpenNewForm}
                className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-5 h-5" /> Crear el primer cliente potencial
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center shadow-sm">
              <Search className="w-8 h-8 text-zinc-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900 mb-1">No hay resultados</h3>
              <p className="text-zinc-500">
                No se ha encontrado ningún cliente potencial que coincida con "{searchTerm}".
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden overflow-x-auto">
              {/* Table header */}
              <div className="hidden md:flex items-center w-full bg-zinc-200/90 border-b border-zinc-300 px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                <div className="w-24 shrink-0 pr-3">Código</div>
                <div className="flex-[1.5] min-w-0 pr-4">Cliente</div>
                <div className="w-28 lg:w-32 shrink-0 pr-4">CIF / NIF</div>
                <div className="flex-[1.5] min-w-0 pr-4">Dirección</div>
                <div className="flex-1 min-w-0 pr-4">Población</div>
                <div className="w-32 lg:w-36 shrink-0">Teléfono</div>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-zinc-200">
                {aMostrar.map((cliente, index) => (
                  <div
                    key={cliente._docId || cliente.id}
                    className={`flex flex-col md:flex-row md:items-center px-4 py-2.5 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'
                    } hover:bg-amber-100/90 hover:shadow-xs transition-colors cursor-pointer group`}
                    onClick={() => setAccionesModalItem(cliente)}
                  >
                    {/* Mobile view */}
                    <div className="flex md:hidden items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-zinc-600 bg-white/90 border border-zinc-200/80 px-2 py-0.5 rounded shadow-2xs">
                        {cliente.id}
                      </span>
                    </div>
                    <div className="flex md:hidden">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{cliente.nombre}</p>
                        {cliente.direccion && <p className="text-xs text-zinc-500 truncate">{cliente.direccion}</p>}
                        {cliente.poblacion && <p className="text-xs text-zinc-500 truncate">{cliente.poblacion}</p>}
                      </div>
                    </div>
                    <div className="flex md:hidden items-center gap-3 mt-2">
                      {cliente.telefono && <span className="text-xs text-zinc-500">{cliente.telefono}</span>}
                      {cliente.cif && <span className="text-xs text-zinc-400">{cliente.cif}</span>}
                    </div>

                    {/* Desktop cells */}
                    <div className="hidden md:flex items-center w-full">
                      <div className="w-24 shrink-0 pr-3">
                        <span className="text-[11px] font-mono font-bold text-zinc-600 bg-white/90 border border-zinc-200/80 px-2 py-0.5 rounded-md shadow-2xs">
                          {cliente.id}
                        </span>
                      </div>
                      <div className="flex-[1.5] min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                          <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-900 transition-colors">
                            {cliente.nombre}
                          </p>
                        </div>
                      </div>
                      <div className="w-28 lg:w-32 shrink-0 text-xs font-mono text-slate-600 truncate pr-4">
                        {cliente.cif || '—'}
                      </div>
                      <div className="flex-[1.5] min-w-0 text-xs text-slate-600 truncate pr-4">
                        <span className="truncate">{cliente.direccion || '—'}</span>
                      </div>
                      <div className="flex-1 min-w-0 text-xs text-slate-600 truncate pr-4 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{cliente.poblacion || '—'}</span>
                      </div>
                      <div className="w-32 lg:w-36 shrink-0 text-xs text-slate-600 truncate">
                        {cliente.telefono ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                            <span className="truncate">{cliente.telefono}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selector de paginación */}
          {filtered.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 bg-white px-5 py-3.5 rounded-2xl border border-zinc-200/80 shadow-xs">
              <div className="font-bold text-zinc-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                {limite === 'todos' ? (
                  <span>Mostrando todos los clientes potenciales ({filtered.length} en total)</span>
                ) : (
                  <span>
                    Mostrando los {Math.min(Number(limite), filtered.length)} primeros clientes potenciales
                    {filtered.length > Number(limite) && (
                      <span className="text-zinc-400 font-normal ml-1">
                        (de {filtered.length} en total)
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 font-semibold uppercase text-[11px] tracking-wider">Mostrar:</span>
                <select
                  value={limite}
                  onChange={(e) => setLimite(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                  className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold rounded-xl px-3.5 py-1.5 outline-none focus:border-blue-500 focus:bg-white cursor-pointer transition-colors shadow-2xs"
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
            </div>
          )}

          {/* Modal de Acciones */}
          {accionesModalItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200">
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                      <HandOptionsIcon className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black tracking-wide uppercase truncate">Opciones de Cliente Potencial</h3>
                      <p className="text-[11px] text-slate-400 font-medium truncate">
                        Cód. {accionesModalItem.id} · {accionesModalItem.nombre}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAccionesModalItem(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
                    <div className="font-medium text-slate-800 text-sm">{accionesModalItem.nombre}</div>
                    <div className="flex items-center gap-4 text-slate-500 flex-wrap">
                      {accionesModalItem.poblacion && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {accionesModalItem.poblacion}
                        </span>
                      )}
                      {accionesModalItem.telefono && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {accionesModalItem.telefono}
                        </span>
                      )}
                      {(accionesModalItem.correoGeneral || accionesModalItem.correo) && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {accionesModalItem.correoGeneral || accionesModalItem.correo}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        const cli = accionesModalItem;
                        setAccionesModalItem(null);
                        handleViewDetail(cli);
                      }}
                      className="w-full p-3 rounded-2xl bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200/80 flex items-center gap-3.5 transition-all text-left cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                        <Eye className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-blue-900">Ver Ficha Completa</div>
                        <div className="text-[11px] text-blue-700/80">Información detallada y contactos</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        const cli = accionesModalItem;
                        setAccionesModalItem(null);
                        handleEdit(cli);
                      }}
                      className="w-full p-3 rounded-2xl bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-200/80 flex items-center gap-3.5 transition-all text-left cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                        <Edit className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-emerald-900">Editar Cliente Potencial</div>
                        <div className="text-[11px] text-emerald-700/80">Modificar datos fiscales, direcciones, teléfonos y notas</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        const cli = accionesModalItem;
                        setAccionesModalItem(null);
                        handleDelete(cli);
                      }}
                      className="w-full p-3 rounded-2xl bg-red-50/60 hover:bg-red-100/80 border border-red-200/80 flex items-center gap-3.5 transition-all text-left cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-red-900">Eliminar Cliente Potencial</div>
                        <div className="text-[11px] text-red-700/80">Dar de baja de la lista de clientes potenciales</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setAccionesModalItem(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {isConfirmModalOpen && potToDelete && (
            <ConfirmationModal
              isOpen={isConfirmModalOpen}
              onClose={() => {
                setIsConfirmModalOpen(false);
                setPotToDelete(null);
              }}
              onConfirm={confirmDeletePotencial}
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
          title="Detalle del Cliente Potencial"
          size="lg"
        >
          {selectedDetalle && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
                <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Cliente Potencial</p>
                  <h3 className="text-xl font-bold text-zinc-900">{selectedDetalle.nombre}</h3>
                  <p className="text-sm text-zinc-500 font-mono">{selectedDetalle.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-zinc-700">
                <div className="space-y-2">
                  <div><strong>CIF / NIF:</strong> {selectedDetalle.cif || '—'}</div>
                  <div><strong>Teléfono:</strong> {selectedDetalle.telefono || '—'}</div>
                  <div><strong>Contacto:</strong> {selectedDetalle.contacto || '—'}</div>
                  <div><strong>Dirección:</strong> {[selectedDetalle.direccion, selectedDetalle.cp, selectedDetalle.poblacion, selectedDetalle.provincia].filter(Boolean).join(', ') || '—'}</div>
                </div>
                <div className="space-y-2">
                  <div><strong>Correo General:</strong> {selectedDetalle.correoGeneral || selectedDetalle.correo || '—'}</div>
                  <div><strong>Correo Administración:</strong> {selectedDetalle.correoAdministracion || '—'}</div>
                  <div><strong>Correo Facturación:</strong> {selectedDetalle.correoFacturacion || '—'}</div>
                  <div><strong>Correo Mantenimiento:</strong> {selectedDetalle.correoMantenimiento || '—'}</div>
                  <div><strong>Forma de pago:</strong> {selectedDetalle.formaPago || '—'}</div>
                  <div><strong>IBAN:</strong> {selectedDetalle.iban || '—'}</div>
                </div>
              </div>
              {selectedDetalle.notas && (
                <div className="pt-3 border-t border-zinc-200 text-sm text-zinc-700">
                  <strong>Notas:</strong>
                  <p className="mt-1 text-zinc-600 whitespace-pre-wrap">{selectedDetalle.notas}</p>
                </div>
              )}
            </div>
          )}
        </DetailModal>
      </>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => {
            setView('list');
            setForm(emptyPotencial);
            setEditingDocId(null);
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al directorio
        </button>
      </div>

      <div className="mb-8">
        <div className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center mb-4">
          <Building2 className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
          {editingDocId ? 'Editar Cliente Potencial' : 'Añadir Nuevo Cliente Potencial'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {editingDocId
            ? 'Modifica los datos del cliente potencial seleccionado.'
            : 'Introduce los datos de la empresa o contacto para poder hacerle presupuestos.'}
        </p>
      </div>

      <div className="bg-zinc-900 text-white p-4 rounded-xl flex flex-col mb-8 border border-red-600">
        <label className="text-[10px] text-red-500 font-bold mb-1 uppercase">Código de Cliente Potencial (Manual)</label>
        <input
          type="text"
          value={form.id}
          onChange={(e) => setForm({ ...form, id: e.target.value.toUpperCase() })}
          disabled={Boolean(editingDocId)}
          placeholder="POT-000000"
          className="bg-transparent border-b border-red-600 text-lg font-mono font-bold tracking-wider outline-none focus:border-red-400 transition-colors w-full py-1 disabled:opacity-70"
        />
        <p className="text-[10px] text-zinc-400 mt-1">Puedes modificar el código sugerido manualmente.</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-3xl border border-zinc-200 shadow-sm">
        <form className="space-y-5" onSubmit={handleSave}>
          {/* Fila 1 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-900 mb-1.5">CLIENTE POTENCIAL *</label>
            <input
              required
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })}
              className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
              placeholder="Nombre completo o Razón social"
            />
          </div>

          {/* Fila 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">CIF / NIF</label>
              <input
                type="text"
                value={form.cif || ''}
                onChange={(e) => setForm({ ...form, cif: e.target.value })}
                className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
                placeholder="B12345678"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">TELÉFONO</label>
              <input
                type="tel"
                value={form.telefono || ''}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
                placeholder="Ej. 600 000 000"
              />
            </div>
          </div>

          {/* Fila 3: Contacto */}
          <div>
            <label className="block text-sm font-semibold text-zinc-900 mb-1.5">CONTACTO (CTACTO)</label>
            <input
              type="text"
              value={form.contacto || ''}
              onChange={(e) => setForm({ ...form, contacto: e.target.value })}
              className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
              placeholder="Persona de contacto principal"
            />
          </div>

          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-150 space-y-3 my-4">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-red-600" /> Cuentas de Correo Electrónico
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">General</label>
                <input
                  type="email"
                  value={form.correoGeneral || form.correo || ''}
                  onChange={(e) => setForm({ ...form, correo: e.target.value, correoGeneral: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-200 focus:border-red-500 outline-none text-zinc-900 text-xs"
                  placeholder="general@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Administración</label>
                <input
                  type="email"
                  value={form.correoAdministracion || ''}
                  onChange={(e) => setForm({ ...form, correoAdministracion: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-200 focus:border-red-500 outline-none text-zinc-900 text-xs"
                  placeholder="administracion@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Facturación</label>
                <input
                  type="email"
                  value={form.correoFacturacion || ''}
                  onChange={(e) => setForm({ ...form, correoFacturacion: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-200 focus:border-red-500 outline-none text-zinc-900 text-xs"
                  placeholder="facturacion@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Mantenimiento</label>
                <input
                  type="email"
                  value={form.correoMantenimiento || ''}
                  onChange={(e) => setForm({ ...form, correoMantenimiento: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-200 focus:border-red-500 outline-none text-zinc-900 text-xs"
                  placeholder="mantenimiento@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Compras</label>
                <input
                  type="email"
                  value={form.correoCompras || ''}
                  onChange={(e) => setForm({ ...form, correoCompras: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-200 focus:border-red-500 outline-none text-zinc-900 text-xs"
                  placeholder="compras@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Pedidos</label>
                <input
                  type="email"
                  value={form.correoPedidos || ''}
                  onChange={(e) => setForm({ ...form, correoPedidos: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-200 focus:border-red-500 outline-none text-zinc-900 text-xs"
                  placeholder="pedidos@empresa.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Otro</label>
                <input
                  type="email"
                  value={form.correoOtro || ''}
                  onChange={(e) => setForm({ ...form, correoOtro: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-zinc-200 focus:border-red-500 outline-none text-zinc-900 text-xs"
                  placeholder="otro@empresa.com"
                />
              </div>
            </div>
          </div>

          <hr className="border-zinc-100 my-6" />

          {/* Fila 4 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-900 mb-1.5">DIRECCIÓN</label>
            <input
              type="text"
              value={form.direccion || ''}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
              placeholder="Calle, número, piso..."
            />
          </div>

          {/* Fila 5 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">POBLACIÓN</label>
              <input
                type="text"
                value={form.poblacion || ''}
                onChange={(e) => setForm({ ...form, poblacion: e.target.value })}
                className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
                placeholder="Ej. Madrid"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">CÓDIGO POSTAL</label>
              <input
                type="text"
                value={form.cp || ''}
                onChange={(e) => setForm({ ...form, cp: e.target.value })}
                className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
                placeholder="Ej. 28001"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">PROVINCIA</label>
              <input
                type="text"
                value={form.provincia || ''}
                onChange={(e) => setForm({ ...form, provincia: e.target.value })}
                className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
                placeholder="Ej. Madrid"
              />
            </div>
          </div>

          <hr className="border-zinc-100 my-6" />

          {/* Sección Datos Bancarios */}
          <div>
            <h2 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wide flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-red-600" />
              Datos Bancarios
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">FORMA DE PAGO</label>
                <input
                  type="text"
                  value={form.formaPago || ''}
                  onChange={(e) => setForm({ ...form, formaPago: e.target.value })}
                  className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
                  placeholder="Ej. Transferencia 30 días"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">VENCIMIENTO</label>
                <input
                  type="text"
                  value={form.vencimiento || ''}
                  onChange={(e) => setForm({ ...form, vencimiento: e.target.value })}
                  className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
                  placeholder="Ej. Día 5 de cada mes"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">IBAN</label>
                <input
                  type="text"
                  value={form.iban || ''}
                  onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900 placeholder-zinc-400 text-sm"
                  placeholder="ES00 0000..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">NOTAS</label>
                <input
                  type="text"
                  value={form.notas || ''}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="w-full px-4 py-3 bg-white rounded-xl border border-zinc-200 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/10 outline-none transition-all text-zinc-900"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-6 flex justify-end items-center gap-4">
            {isLoading && <p className="text-sm text-zinc-500">Guardando...</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="bg-red-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-lg shadow-black/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
            >
              <Save className="w-4 h-4" /> {editingDocId ? 'Guardar Cambios' : 'Guardar en Base de Datos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
