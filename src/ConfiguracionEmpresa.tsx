import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Building2, FileText, MapPin, Phone, Mail, 
  Globe, CreditCard, Trash2, ImageIcon, UserCheck, Hash, PenTool, 
  Plus, Pencil, X
} from 'lucide-react';
import { subscribeEmpresas, saveEmpresa, deleteEmpresa, uploadFile } from './firebase';

interface EmpresaData {
  _docId?: string;
  nombre: string;
  cif: string;
  rasic?: string;
  direccion: string;
  codigoPostal: string;
  cp?: string;
  localidad: string;
  poblacion?: string;
  provincia: string;
  telefono: string;
  email: string;
  web: string;
  logoUrl?: string;
  selloUrl?: string;
  ingenieroNombre: string;
  ingenieroApellidos: string;
  ingenieroNif: string;
  ingenieroColegiado: string;
  ingenieroFirmaUrl?: string;
}

const emptyEmpresa: EmpresaData = {
  nombre: '',
  cif: '',
  rasic: '',
  direccion: '',
  codigoPostal: '',
  localidad: '',
  provincia: '',
  telefono: '',
  email: '',
  web: '',
  ingenieroNombre: '',
  ingenieroApellidos: '',
  ingenieroNif: '',
  ingenieroColegiado: ''
};

function EmpresaForm({ empresa, onSave, onCancel }: { 
  empresa: EmpresaData; 
  onSave: (data: any) => Promise<void>; 
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EmpresaData>(empresa);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [selloFile, setSelloFile] = useState<File | null>(null);
  const [firmaFile, setFirmaFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { _docId, ...fields } = { ...form };

      if (logoFile) {
        const logoPath = `empresa/logo_${Date.now()}`;
        fields.logoUrl = await uploadFile(logoFile, logoPath);
      } else if (form.logoUrl) {
        fields.logoUrl = form.logoUrl;
      } else {
        delete fields.logoUrl;
      }

      if (selloFile) {
        const selloPath = `empresa/sello_${Date.now()}`;
        fields.selloUrl = await uploadFile(selloFile, selloPath);
      } else if (form.selloUrl) {
        fields.selloUrl = form.selloUrl;
      } else {
        delete fields.selloUrl;
      }

      if (firmaFile) {
        const firmaPath = `empresa/firma_${Date.now()}`;
        fields.ingenieroFirmaUrl = await uploadFile(firmaFile, firmaPath);
      } else if (form.ingenieroFirmaUrl) {
        fields.ingenieroFirmaUrl = form.ingenieroFirmaUrl;
      } else {
        delete fields.ingenieroFirmaUrl;
      }

      fields.poblacion = fields.localidad;
      fields.cp = fields.codigoPostal;
      fields.rasic = fields.rasic || '';

      await onSave({ _docId: empresa._docId, ...fields });
    } catch (error) {
      console.error("Error al guardar:", error);
      alert('Error al sincronizar con Firestore');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] border border-zinc-200 p-6 md:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-zinc-900">
          {empresa._docId ? 'Editar empresa' : 'Nueva empresa'}
        </h2>
        <button type="button" onClick={onCancel}
          className="p-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mb-8 pb-8 border-b border-zinc-100">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Nombre de la empresa *</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input required type="text" value={form.nombre}
                onChange={e => setForm({...form, nombre: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="Razón social" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">CIF / NIF *</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input required type="text" value={form.cif}
                onChange={e => setForm({...form, cif: e.target.value.toUpperCase()})}
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="B12345678" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">RASIC</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input type="text" value={form.rasic || ''}
                onChange={e => setForm({...form, rasic: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="106001687" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Teléfono</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input type="tel" value={form.telefono}
                onChange={e => setForm({...form, telefono: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="612 345 678" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input type="email" value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="info@empresa.com" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Web</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input type="url" value={form.web}
                onChange={e => setForm({...form, web: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="https://" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Dirección *</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input required type="text" value={form.direccion}
                onChange={e => setForm({...form, direccion: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="Calle, número, piso" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">C.P.</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input type="text" value={form.codigoPostal}
                onChange={e => setForm({...form, codigoPostal: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="28001" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Localidad *</label>
            <input required type="text" value={form.localidad}
              onChange={e => setForm({...form, localidad: e.target.value})}
              className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              placeholder="Madrid" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Provincia *</label>
            <input required type="text" value={form.provincia}
              onChange={e => setForm({...form, provincia: e.target.value})}
              className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              placeholder="Madrid" />
          </div>
        </div>

        {/* Logo */}
        <div className="w-full lg:w-64 flex-shrink-0 space-y-3">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Logotipo</label>
          <div className="flex flex-col items-center gap-3 p-5 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl">
            {(form.logoUrl || logoFile) ? (
              <div className="relative group">
                <img src={logoFile ? URL.createObjectURL(logoFile) : form.logoUrl} alt="Logo" 
                  className="h-24 w-24 object-contain bg-white p-1 rounded-xl border border-zinc-200 shadow-sm" />
                <button type="button" onClick={() => { setLogoFile(null); setForm({...form, logoUrl: ''}); }}
                  className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="h-24 w-24 bg-white rounded-xl border-2 border-dashed border-zinc-300 flex items-center justify-center text-zinc-300">
                <ImageIcon className="w-7 h-7" />
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" id="logo-upload-form"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            <label htmlFor="logo-upload-form"
              className="w-full text-center px-3 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-[11px] font-bold cursor-pointer hover:bg-zinc-50 transition-colors shadow-sm">
              {form.logoUrl || logoFile ? 'Cambiar' : 'Seleccionar'}
            </label>
          </div>
        </div>

        {/* Sello de empresa */}
        <div className="w-full lg:w-64 flex-shrink-0 space-y-3">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Sello de empresa</label>
          <div className="flex flex-col items-center gap-3 p-5 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl">
            {(form.selloUrl || selloFile) ? (
              <div className="relative group">
                <img src={selloFile ? URL.createObjectURL(selloFile) : form.selloUrl} alt="Sello" 
                  className="h-24 w-24 object-contain bg-white p-1 rounded-xl border border-zinc-200 shadow-sm" />
                <button type="button" onClick={() => { setSelloFile(null); setForm({...form, selloUrl: ''}); }}
                  className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="h-24 w-24 bg-white rounded-xl border-2 border-dashed border-zinc-300 flex items-center justify-center text-zinc-300">
                <ImageIcon className="w-7 h-7" />
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" id="sello-upload-form"
              onChange={(e) => setSelloFile(e.target.files?.[0] || null)} />
            <label htmlFor="sello-upload-form"
              className="w-full text-center px-3 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-[11px] font-bold cursor-pointer hover:bg-zinc-50 transition-colors shadow-sm">
              {form.selloUrl || selloFile ? 'Cambiar' : 'Seleccionar'}
            </label>
          </div>
        </div>
      </div>

      {/* Ingeniero + Firma */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1 space-y-4">
          <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2 pb-2 border-b border-zinc-100">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            Ingeniero responsable
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Nombre</label>
              <input type="text" value={form.ingenieroNombre}
                onChange={e => setForm({...form, ingenieroNombre: e.target.value})}
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="Nombre del ingeniero" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Apellidos</label>
              <input type="text" value={form.ingenieroApellidos}
                onChange={e => setForm({...form, ingenieroApellidos: e.target.value})}
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="Apellidos del ingeniero" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">NIF</label>
              <input type="text" value={form.ingenieroNif}
                onChange={e => setForm({...form, ingenieroNif: e.target.value.toUpperCase()})}
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="00000000X" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Nº Colegiado</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input type="text" value={form.ingenieroColegiado}
                  onChange={e => setForm({...form, ingenieroColegiado: e.target.value})}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  placeholder="12345-X" />
              </div>
            </div>
          </div>
        </div>

        {/* Firma */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-3">
          <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2 pb-2 border-b border-zinc-100">
            <PenTool className="w-4 h-4 text-emerald-600" />
            Firma del ingeniero
          </h2>
          <div className="p-4 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl space-y-3">
            {form.ingenieroFirmaUrl && !firmaFile && (
              <div className="relative group">
                <img src={form.ingenieroFirmaUrl} alt="Firma actual" 
                  className="w-full h-20 object-contain bg-white border border-zinc-200 rounded-xl p-2" />
                <button type="button" onClick={() => { setFirmaFile(null); setForm({...form, ingenieroFirmaUrl: ''}); }}
                  className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
            {firmaFile && (
              <div className="relative group">
                <img src={URL.createObjectURL(firmaFile)} alt="Nueva firma" 
                  className="w-full h-20 object-contain bg-white border border-zinc-200 rounded-xl p-2" />
                <button type="button" onClick={() => setFirmaFile(null)}
                  className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex justify-center">
              <label htmlFor="firma-upload-form"
                className="px-5 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-zinc-50 transition-colors shadow-sm inline-block">
                {form.ingenieroFirmaUrl || firmaFile ? 'Cambiar imagen de firma' : 'Seleccionar imagen de firma'}
              </label>
              <input type="file" accept="image/*" className="hidden" id="firma-upload-form"
                onChange={(e) => setFirmaFile(e.target.files?.[0] || null)} />
            </div>
            <p className="text-[10px] text-zinc-400 text-center">Sube una imagen con la firma del ingeniero</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
        <button type="button" onClick={onCancel}
          className="px-6 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 active:scale-95 text-sm">
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

export default function ConfiguracionEmpresa() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaData | null>(null);
  const [crearNueva, setCrearNueva] = useState(false);

  useEffect(() => {
    const unsub = subscribeEmpresas((data) => {
      setEmpresas(data as unknown as EmpresaData[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async (data: any) => {
    const { _docId, ...fields } = data;
    await saveEmpresa(_docId || null, fields);
    alert('Datos guardados correctamente');
    setSelectedEmpresa(null);
    setCrearNueva(false);
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar la empresa "${nombre}"?`)) return;
    try {
      await deleteEmpresa(id);
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert('Error al eliminar la empresa');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50/40 flex items-center justify-center">
        <div className="animate-pulse text-emerald-600 font-medium">Cargando...</div>
      </div>
    );
  }

  // Si estamos editando o creando nueva, mostrar el formulario
  if (selectedEmpresa || crearNueva) {
    return (
      <div className="min-h-screen bg-emerald-50/40 p-4 md:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <button onClick={() => { setSelectedEmpresa(null); setCrearNueva(false); }} 
            className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver a la lista
          </button>
          <div className="mb-6">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-emerald-200">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight">Configuración de Empresa</h1>
            <p className="text-zinc-500 text-sm mt-1">Datos fiscales, logotipo e información del ingeniero responsable.</p>
          </div>
          <EmpresaForm 
            empresa={selectedEmpresa || emptyEmpresa} 
            onSave={handleSave}
            onCancel={() => { setSelectedEmpresa(null); setCrearNueva(false); }}
          />
        </div>
      </div>
    );
  }

  // Vista de lista
  return (
    <div className="min-h-screen bg-emerald-50/40 p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver al panel
        </button>

        <div className="mb-6">
          <div className="w-10 h-10 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-emerald-200">
            <Building2 className="w-5 h-5" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight">Empresas</h1>
          <p className="text-zinc-500 text-sm mt-1">Gestiona las empresas para los informes técnicos.</p>
        </div>

        {/* Botón nueva empresa */}
        <button onClick={() => setCrearNueva(true)}
          className="w-full flex items-center justify-center gap-2 p-4 mb-6 bg-white border-2 border-dashed border-zinc-300 rounded-2xl text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all font-bold text-sm">
          <Plus className="w-5 h-5" />
          Añadir nueva empresa
        </button>

        {/* Lista de empresas */}
        <div className="space-y-3">
          {empresas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center">
              <Building2 className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <p className="text-zinc-400 font-medium">No hay empresas registradas</p>
              <p className="text-zinc-300 text-sm mt-1">Haz clic en "Añadir nueva empresa" para crear la primera.</p>
            </div>
          ) : (
            empresas.map((emp) => (
              <div key={emp._docId} 
                className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-center gap-4 hover:border-emerald-300 hover:shadow-sm transition-all group">
                {/* Logo o icono */}
                <div className="w-14 h-14 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {emp.logoUrl ? (
                    <img src={emp.logoUrl} alt={emp.nombre} className="w-full h-full object-contain p-1" />
                  ) : (
                    <Building2 className="w-6 h-6 text-zinc-400" />
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-zinc-900 truncate">{emp.nombre || 'Sin nombre'}</h3>
                  <p className="text-xs text-zinc-500 truncate">
                    {emp.cif && <span className="mr-3">{emp.cif}</span>}
                    {emp.rasic && <span className="mr-3">RASIC: {emp.rasic}</span>}
                    {(emp.localidad || emp.poblacion) && <span>{emp.localidad || emp.poblacion}</span>}
                  </p>
                  {emp.ingenieroNombre && (
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Ing: {emp.ingenieroNombre} {emp.ingenieroApellidos}
                    </p>
                  )}
                </div>
                {/* Acciones */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => setSelectedEmpresa(emp)}
                    className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                    title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => emp._docId && handleDelete(emp._docId, emp.nombre)}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}