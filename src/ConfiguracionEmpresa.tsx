import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Building2, FileText, MapPin, Phone, Mail, 
  Globe, CreditCard, Trash2, ImageIcon, UserCheck, Hash, PenTool 
} from 'lucide-react';
import { subscribeEmpresa, saveEmpresa, uploadFile } from './firebase';

interface EmpresaData {
  _docId?: string;
  nombre: string;
  cif: string;
  direccion: string;
  codigoPostal: string;
  localidad: string;
  provincia: string;
  telefono: string;
  email: string;
  web: string;
  logoUrl?: string;
  // Ingeniero
  ingenieroNombre: string;
  ingenieroApellidos: string;
  ingenieroNif: string;
  ingenieroColegiado: string;
  ingenieroFirmaUrl?: string;
}

const emptyEmpresa: EmpresaData = {
  nombre: '',
  cif: '',
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

export default function ConfiguracionEmpresa() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EmpresaData>(emptyEmpresa);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [firmaFile, setFirmaFile] = useState<File | null>(null);
  const [firmaPreview, setFirmaPreview] = useState<string | null>(null);
  const firmaCanvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  // Sincronización en tiempo real con Firestore
  useEffect(() => {
    const unsub = subscribeEmpresa((data) => {
      if (data) {
        setForm(data);
        if (data.ingenieroFirmaUrl) {
          setFirmaPreview(data.ingenieroFirmaUrl);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Canvas de firma
  useEffect(() => {
    const canvas = firmaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDraw = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      setDrawing(true);
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const moveDraw = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!drawing) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const endDraw = () => setDrawing(false);

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', moveDraw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', moveDraw, { passive: false });
    canvas.addEventListener('touchend', endDraw);

    // Cargar firma existente si hay
    if (form.ingenieroFirmaUrl && !firmaPreview?.startsWith('data:')) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = form.ingenieroFirmaUrl;
    }

    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', moveDraw);
      canvas.removeEventListener('mouseup', endDraw);
      canvas.removeEventListener('mouseleave', endDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', moveDraw);
      canvas.removeEventListener('touchend', endDraw);
    };
  }, [form.ingenieroFirmaUrl, drawing]);

  const clearFirma = () => {
    const canvas = firmaCanvasRef.current;
    if (canvas) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setFirmaPreview(null);
    setFirmaFile(null);
  };

  const getFirmaDataUrl = (): string | null => {
    const canvas = firmaCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Verificar si hay algo dibujado
    const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasDrawing = pixelData.some((val, i) => i % 4 === 3 && val > 0);
    return hasDrawing ? canvas.toDataURL('image/png') : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { _docId, ...fields } = { ...form };

      // Subir logo si hay uno nuevo
      if (logoFile) {
        const logoPath = `empresa/logo_${Date.now()}`;
        fields.logoUrl = await uploadFile(logoFile, logoPath);
      } else if (form.logoUrl) {
        fields.logoUrl = form.logoUrl;
      } else {
        delete fields.logoUrl;
      }

      // Subir firma si se dibujó una nueva o se subió imagen
      const firmaDataUrl = getFirmaDataUrl();
      if (firmaDataUrl) {
        // Convertir dataUrl a Blob para subir a Storage
        const blob = await (await fetch(firmaDataUrl)).blob();
        const firmaPath = `empresa/firma_${Date.now()}`;
        const fakeFile = new File([blob], 'firma.png', { type: 'image/png' });
        fields.ingenieroFirmaUrl = await uploadFile(fakeFile, firmaPath);
      } else if (firmaFile) {
        const firmaPath = `empresa/firma_${Date.now()}`;
        fields.ingenieroFirmaUrl = await uploadFile(firmaFile, firmaPath);
      } else if (form.ingenieroFirmaUrl) {
        fields.ingenieroFirmaUrl = form.ingenieroFirmaUrl;
      } else {
        delete fields.ingenieroFirmaUrl;
      }

      await saveEmpresa(_docId || null, fields);
      alert('Datos guardados correctamente');
      setLogoFile(null);
      setFirmaFile(null);
    } catch (error) {
      console.error("Error al guardar:", error);
      alert('Error al sincronizar con Firestore');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50/40 flex items-center justify-center">
        <div className="animate-pulse text-emerald-600 font-medium">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-emerald-50/40 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al panel
        </button>

        <div className="mb-6">
          <div className="w-10 h-10 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-emerald-200">
            <Building2 className="w-5 h-5" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight">Configuración de Empresa</h1>
          <p className="text-zinc-500 text-sm mt-1">Datos fiscales, logotipo e información del ingeniero responsable.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] border border-zinc-200 p-6 md:p-8 shadow-sm">
          
          {/* === FILA 1: Datos empresa + Logo === */}
          <div className="flex flex-col lg:flex-row gap-6 mb-8 pb-8 border-b border-zinc-100">
            
            {/* Datos empresa (izquierda) */}
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

            {/* Logo (derecha) */}
            <div className="w-full lg:w-64 flex-shrink-0 space-y-3">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Logotipo</label>
              <div className="flex flex-col items-center gap-3 p-5 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl">
                {(form.logoUrl || logoFile) ? (
                  <div className="relative group">
                    <img 
                      src={logoFile ? URL.createObjectURL(logoFile) : form.logoUrl} 
                      alt="Logo" 
                      className="h-24 w-24 object-contain bg-white p-1 rounded-xl border border-zinc-200 shadow-sm" 
                    />
                    <button type="button"
                      onClick={() => { setLogoFile(null); setForm({...form, logoUrl: ''}); }}
                      className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-24 bg-white rounded-xl border-2 border-dashed border-zinc-300 flex items-center justify-center text-zinc-300">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" id="logo-upload"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                <label htmlFor="logo-upload"
                  className="w-full text-center px-3 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-[11px] font-bold cursor-pointer hover:bg-zinc-50 transition-colors shadow-sm">
                  {form.logoUrl || logoFile ? 'Cambiar' : 'Seleccionar'}
                </label>
              </div>
            </div>
          </div>

          {/* === FILA 2: Datos del Ingeniero + Firma === */}
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Datos ingeniero (izquierda) */}
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

            {/* Firma (derecha) */}
            <div className="w-full lg:w-80 flex-shrink-0 space-y-3">
              <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2 pb-2 border-b border-zinc-100">
                <PenTool className="w-4 h-4 text-emerald-600" />
                Firma digital
              </h2>
              <div className="p-4 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl space-y-3">
                <canvas 
                  ref={firmaCanvasRef} 
                  width={400} 
                  height={120} 
                  className="w-full h-24 bg-white border border-zinc-200 rounded-xl touch-none cursor-crosshair"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={clearFirma}
                    className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[11px] font-bold hover:bg-red-100 transition-colors">
                    Borrar firma
                  </button>
                  <label htmlFor="firma-upload"
                    className="flex-1 text-center px-3 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-[11px] font-bold cursor-pointer hover:bg-zinc-50 transition-colors shadow-sm">
                    Subir imagen
                  </label>
                  <input type="file" accept="image/*" className="hidden" id="firma-upload"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setFirmaFile(f);
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const dataUrl = ev.target?.result as string;
                          setFirmaPreview(dataUrl);
                          const img = new Image();
                          img.onload = () => {
                            const canvas = firmaCanvasRef.current;
                            if (canvas) {
                              const ctx = canvas.getContext('2d');
                              ctx?.clearRect(0, 0, canvas.width, canvas.height);
                              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                            }
                          };
                          img.src = dataUrl;
                        };
                        reader.readAsDataURL(f);
                      }
                    }} />
                </div>
                <p className="text-[10px] text-zinc-400 text-center">Dibuja tu firma o súbela como imagen</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex justify-end">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 active:scale-95 text-sm">
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar y Sincronizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}