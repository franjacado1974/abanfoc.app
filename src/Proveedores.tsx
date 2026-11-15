import { useState, useEffect, useMemo } from 'react';
import {
  Building2, Plus, Search, Pencil, Trash2, X,
  Phone, Mail, User, AlertTriangle
} from 'lucide-react';
import {
  type Proveedor,
  subscribeProveedores, addProveedor, updateProveedor, deleteProveedor
} from './firebase';

export const TIPOS_COMERCIO_SUGERIDOS = [
  'Material PCI',
  'Ferretería',
  'Gasolinera',
  'Herramientas',
  'Suministros Industriales',
  'Almacén Eléctrico',
  'Taller / Automoción',
  'Otros'
];

export function generarSiguienteReferenciaProveedor(proveedores: Proveedor[]): string {
  let maxNum = 0;
  for (const p of proveedores) {
    const match = String(p.referencia || '').match(/PROV\.?\s*(\d+)/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `PROV.${String(maxNum + 1).padStart(5, '0')}`;
}

interface ProveedorFormModalProps {
  isOpen: boolean;
  editingProveedor: Proveedor | null;
  proveedores: Proveedor[];
  onClose: () => void;
  onSaved?: (saved: Proveedor) => void;
}

export function ProveedorFormModal({
  isOpen,
  editingProveedor,
  proveedores,
  onClose,
  onSaved
}: ProveedorFormModalProps) {
  const [form, setForm] = useState<Proveedor>({
    referencia: 'PROV.00001',
    proveedor: '',
    nombreComercial: '',
    tipoComercio: '',
    nif: '',
    telefono: '',
    email: '',
    contacto: '',
    notas: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingProveedor) {
      setForm({ ...editingProveedor });
    } else {
      setForm({
        referencia: generarSiguienteReferenciaProveedor(proveedores),
        proveedor: '',
        nombreComercial: '',
        tipoComercio: '',
        nif: '',
        telefono: '',
        email: '',
        contacto: '',
        notas: ''
      });
    }
  }, [isOpen, editingProveedor, proveedores]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.proveedor.trim()) return;
    setSaving(true);
    try {
      const payload: Proveedor = {
        ...form,
        referencia: form.referencia.trim() || generarSiguienteReferenciaProveedor(proveedores),
        proveedor: form.proveedor.trim().toUpperCase(),
        nombreComercial: form.nombreComercial.trim(),
        tipoComercio: form.tipoComercio.trim(),
        nif: form.nif.trim().toUpperCase(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        contacto: form.contacto.trim()
      };

      let savedResult: Proveedor;
      if (editingProveedor && (editingProveedor._docId || editingProveedor.id)) {
        const docId = editingProveedor._docId || editingProveedor.id!;
        await updateProveedor(docId, payload);
        savedResult = { ...editingProveedor, ...payload, _docId: docId, id: editingProveedor.id || docId };
      } else {
        const created = await addProveedor(payload);
        savedResult = created as Proveedor;
      }

      if (onSaved) onSaved(savedResult);
      onClose();
    } catch (err) {
      console.error('Error guardando proveedor:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-bold">
              {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Ref. Proveedor *</label>
              <input
                type="text"
                required
                value={form.referencia}
                onChange={(e) => setForm(prev => ({ ...prev, referencia: e.target.value }))}
                className="w-full px-3 py-2 text-xs font-mono font-bold text-zinc-900 bg-zinc-50 rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Proveedor (Razón Social) *</label>
              <input
                type="text"
                required
                value={form.proveedor}
                onChange={(e) => setForm(prev => ({ ...prev, proveedor: e.target.value.toUpperCase() }))}
                placeholder="Ej. SUMINISTROS INDUSTRIALES GARCÍA S.L."
                className="w-full px-3 py-2 text-xs uppercase rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Nombre Comercial</label>
              <input
                type="text"
                value={form.nombreComercial}
                onChange={(e) => setForm(prev => ({ ...prev, nombreComercial: e.target.value }))}
                placeholder="Ej. Ferretería García"
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Tipo Comercio</label>
              <input
                type="text"
                list="tipos-comercio-list-shared"
                value={form.tipoComercio}
                onChange={(e) => setForm(prev => ({ ...prev, tipoComercio: e.target.value }))}
                placeholder="Ej. Ferretería, Gasolinera, Material PCI..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
              />
              <datalist id="tipos-comercio-list-shared">
                {TIPOS_COMERCIO_SUGERIDOS.map(t => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">NIF / CIF</label>
              <input
                type="text"
                value={form.nif}
                onChange={(e) => setForm(prev => ({ ...prev, nif: e.target.value.toUpperCase() }))}
                placeholder="B12345678"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Teléfono</label>
              <input
                type="text"
                value={form.telefono}
                onChange={(e) => setForm(prev => ({ ...prev, telefono: e.target.value }))}
                placeholder="930 000 000"
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="compras@proveedor.es"
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Persona de Contacto</label>
            <input
              type="text"
              value={form.contacto}
              onChange={(e) => setForm(prev => ({ ...prev, contacto: e.target.value }))}
              placeholder="Nombre de la persona de contacto"
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-black text-white hover:bg-zinc-800 disabled:opacity-50 shadow-md shadow-black/10"
            >
              {saving ? 'Guardando...' : (editingProveedor ? 'Guardar Cambios' : 'Crear Proveedor')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_proveedores');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const unsub = subscribeProveedores((items) => setProveedores(items));
    return () => unsub();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [tipoComercioFiltro, setTipoComercioFiltro] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [accionesModalItem, setAccionesModalItem] = useState<Proveedor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const tiposComercioDisponibles = useMemo(() => {
    const setTipos = new Set<string>();
    proveedores.forEach(p => {
      if (p.tipoComercio && p.tipoComercio.trim()) setTipos.add(p.tipoComercio.trim());
    });
    return Array.from(setTipos).sort((a, b) => a.localeCompare(b));
  }, [proveedores]);

  const proveedoresFiltrados = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return proveedores.filter(p => {
      if (tipoComercioFiltro !== 'all' && (p.tipoComercio || '').trim() !== tipoComercioFiltro) return false;
      if (q) {
        const hay = [
          p.referencia,
          p.proveedor,
          p.nombreComercial,
          p.tipoComercio,
          p.nif,
          p.telefono,
          p.email,
          p.contacto
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [proveedores, tipoComercioFiltro, searchTerm]);

  const handleProveedorSaved = (saved: Proveedor) => {
    setProveedores(prev => {
      const docId = saved._docId || saved.id;
      const exists = prev.some(p => (p._docId || p.id) === docId);
      const next = exists
        ? prev.map(p => ((p._docId || p.id) === docId ? saved : p))
        : [...prev, saved];
      next.sort((a, b) => (a.referencia || '').localeCompare(b.referencia || ''));
      try { localStorage.setItem('firecheck_db_proveedores', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const docId = deleteTarget._docId || deleteTarget.id;
    if (!docId) return;
    setIsDeleting(true);
    try {
      await deleteProveedor(docId);
      setProveedores(prev => {
        const next = prev.filter(p => p._docId !== docId && p.id !== docId);
        try { localStorage.setItem('firecheck_db_proveedores', JSON.stringify(next)); } catch {}
        return next;
      });
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error eliminando proveedor:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="px-4 md:px-8 py-6 w-full">
      {/* Cabecera estilo Gestión */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="text-center md:text-left flex flex-col items-center md:items-start">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Directorio de Proveedores</h1>
          <p className="text-sm text-zinc-500 mt-1">{proveedores.length} registrados en la base de datos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-52 sm:w-64 lg:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <input
              type="text"
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-zinc-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none transition-all shadow-xs text-xs text-zinc-900 placeholder-zinc-400"
              placeholder="Buscar PROV.00001, proveedor, NIF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={tipoComercioFiltro}
            onChange={(e) => setTipoComercioFiltro(e.target.value)}
            className="bg-white border border-zinc-200 text-zinc-700 px-3 py-2 rounded-xl font-medium text-xs shadow-xs outline-none focus:border-red-500"
          >
            <option value="all">Todos los comercios</option>
            {tiposComercioDisponibles.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={() => { setEditingProveedor(null); setIsModalOpen(true); }}
            className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-xl font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* Tabla ancho completo */}
      {proveedores.length === 0 ? (
        <div className="bg-white rounded-3xl border border-zinc-200 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-zinc-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 mb-2">Aún no hay proveedores</h3>
          <p className="text-zinc-500 mb-8 max-w-md mx-auto text-sm">
            Crea tu catálogo de proveedores (materiales, gasolineras, ferreterías...) para seleccionarlos rápidamente al registrar compras y gastos.
          </p>
          <button
            onClick={() => { setEditingProveedor(null); setIsModalOpen(true); }}
            className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-md text-sm"
          >
            <Plus className="w-4 h-4" /> Crear el primer proveedor
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-200/90 border-b border-zinc-300 text-[11px] font-extrabold text-zinc-700 uppercase tracking-wider">
                  <th className="py-3 px-4">Ref. Proveedor</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4">Nombre Comercial</th>
                  <th className="py-3 px-4">Tipo Comercio</th>
                  <th className="py-3 px-4">NIF</th>
                  <th className="py-3 px-4">Teléfono</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Contacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs">
                {proveedoresFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-400 font-medium">
                      No se encontraron proveedores con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  proveedoresFiltrados.map((p, idx) => (
                    <tr
                      key={p._docId || p.id || idx}
                      onClick={() => setAccionesModalItem(p)}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'} hover:bg-amber-100/90 transition-colors cursor-pointer`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md bg-white/90 text-zinc-700 border border-zinc-200/80 font-mono text-[11px] font-bold shadow-2xs">
                          {p.referencia || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 uppercase">
                        {p.proveedor ? p.proveedor.toUpperCase() : '-'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {p.nombreComercial || '-'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {p.tipoComercio ? (
                          <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-zinc-200/70 text-slate-700 text-[11px] font-semibold">
                            {p.tipoComercio}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                        {p.nif || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {p.telefono ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3 text-zinc-400" />
                            {p.telefono}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3 text-zinc-400" />
                            {p.email}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.contacto ? (
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3 text-zinc-400" />
                            {p.contacto}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Opciones al tocar la línea */}
      {accionesModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setAccionesModalItem(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-800">Opciones del Proveedor</h3>
                  <p className="text-xs text-slate-500 truncate">{accionesModalItem.proveedor}</p>
                </div>
              </div>
              <button
                onClick={() => setAccionesModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {accionesModalItem.referencia}
                  </span>
                  {accionesModalItem.tipoComercio && (
                    <span className="font-semibold text-slate-600">{accionesModalItem.tipoComercio}</span>
                  )}
                </div>
                {accionesModalItem.nombreComercial && (
                  <p className="text-slate-700 font-semibold">{accionesModalItem.nombreComercial}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500">
                  {accionesModalItem.nif && <span>NIF: {accionesModalItem.nif}</span>}
                  {accionesModalItem.telefono && <span>Tel: {accionesModalItem.telefono}</span>}
                  {accionesModalItem.email && <span>{accionesModalItem.email}</span>}
                  {accionesModalItem.contacto && <span>Contacto: {accionesModalItem.contacto}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    const item = accionesModalItem;
                    setAccionesModalItem(null);
                    setEditingProveedor(item);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Editar Proveedor
                </button>
                <button
                  onClick={() => {
                    const item = accionesModalItem;
                    setAccionesModalItem(null);
                    setDeleteTarget(item);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 text-red-600 border border-red-200 text-xs font-bold hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Proveedor */}
      <ProveedorFormModal
        isOpen={isModalOpen}
        editingProveedor={editingProveedor}
        proveedores={proveedores}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleProveedorSaved}
      />

      {/* Modal Confirmar Eliminar */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Eliminar proveedor</h3>
                <p className="text-xs text-zinc-500">Se moverá a la Papelera de reciclaje.</p>
              </div>
            </div>
            <p className="text-xs font-semibold text-zinc-700 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
              {deleteTarget.referencia} - {deleteTarget.proveedor}
            </p>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
