import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Building2, Image as ImageIcon, PenTool } from 'lucide-react';
import { guardarDatosEmpresa, cargaDatosEmpresa } from '../../recursos-compartidos/services/pdfGenerator';

export default function GestionEmpresa() {
  const navigate = useNavigate();
  const [empData, setEmpData] = useState({
    nombre: '',
    cif: '',
    rasic: '',
    direccion: '',
    poblacion: '',
    provincia: '',
    cp: '',
    telefono: '',
    tecnicoTitulado: '',
    numTecnicoTitulado: '',
    nifTecnico: '',
    firmaIngenieroBase64: ''
  });
  
  const [logoBase64, setLogoBase64] = useState<string>('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const initDraw = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    let drawing = false;
    
    const getPos = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || e.touches?.[0]?.clientX;
      const clientY = e.clientY || e.touches?.[0]?.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDraw = (e: any) => {
        drawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const moveDraw = (e: any) => {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const endDraw = () => {
        drawing = false;
    };

    canvas.onmousedown = startDraw;
    canvas.onmousemove = moveDraw;
    const onMouseUpGlobal = () => endDraw();
    window.addEventListener('mouseup', onMouseUpGlobal);
    
    canvas.ontouchstart = startDraw;
    canvas.ontouchmove = moveDraw;
    canvas.ontouchend = endDraw;

    return () => { window.removeEventListener('mouseup', onMouseUpGlobal); };
  };

  useEffect(() => {
    const data = cargaDatosEmpresa();
    if (data) {
      setEmpData(prev => ({ ...prev, ...data }));
    }
    const savedLogo = localStorage.getItem('firecheck_db_logo');
    if (savedLogo) {
      setLogoBase64(savedLogo);
    }
    
    const canvas = canvasRef.current;
    if (canvas) {
        const cleanup = initDraw(canvas);
        if (data?.firmaIngenieroBase64) {
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
            };
            img.src = data.firmaIngenieroBase64;
        }
        return cleanup;
    }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        setLogoBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    let signature = empData.firmaIngenieroBase64;
    if (canvas) {
        signature = canvas.toDataURL('image/png');
    }

    const finalData = {
      ...empData,
      firmaIngenieroBase64: signature
    };
    
    guardarDatosEmpresa(finalData);
    localStorage.setItem('firecheck_db_logo', logoBase64);
    alert('Configuración de empresa guardada correctamente.');
    navigate('/');
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-start justify-center p-4 md:p-8">
      <div className="max-w-4xl w-full">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-colors shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            Configuración de Empresa
          </h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-zinc-800 border-b border-zinc-100 pb-3">Información General</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase">Nombre de la Empresa</label>
                <input type="text" value={empData.nombre} onChange={e => setEmpData({...empData, nombre: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase">CIF</label>
                <input type="text" value={empData.cif} onChange={e => setEmpData({...empData, cif: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase">N.º RASIC</label>
                <input type="text" value={empData.rasic} onChange={e => setEmpData({...empData, rasic: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase">Teléfono</label>
                <input type="text" value={empData.telefono} onChange={e => setEmpData({...empData, telefono: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase">Dirección</label>
              <input type="text" value={empData.direccion} onChange={e => setEmpData({...empData, direccion: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" value={empData.poblacion} onChange={e => setEmpData({...empData, poblacion: e.target.value})} placeholder="Población" className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" />
                <input type="text" value={empData.provincia} onChange={e => setEmpData({...empData, provincia: e.target.value})} placeholder="Provincia" className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" />
                <input type="text" value={empData.cp} onChange={e => setEmpData({...empData, cp: e.target.value})} placeholder="C.P." className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-zinc-800 border-b border-zinc-100 pb-3 flex items-center gap-2"><ImageIcon className="w-5 h-5"/> Logotipo</h2>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-full h-32 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl flex items-center justify-center overflow-hidden p-4">
                        {logoBase64 ? <img src={logoBase64} alt="Logo" className="max-w-full max-h-full object-contain" /> : <ImageIcon className="w-8 h-8 text-zinc-300" />}
                    </div>
                    <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" />
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl">Subir Logotipo</button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-zinc-800 border-b border-zinc-100 pb-3 flex items-center gap-2"><PenTool className="w-5 h-5"/> Firma del Ingeniero</h2>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Nombre Técnico Titulado</label>
                        <input type="text" value={empData.tecnicoTitulado} onChange={e => setEmpData({...empData, tecnicoTitulado: e.target.value})} className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">N.º Colegiado</label>
                            <input type="text" value={empData.numTecnicoTitulado} onChange={e => setEmpData({...empData, numTecnicoTitulado: e.target.value})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">NIF</label>
                            <input type="text" value={empData.nifTecnico} onChange={e => setEmpData({...empData, nifTecnico: e.target.value})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">Firma Digital</label>
                            <button type="button" onClick={clearCanvas} className="text-[9px] text-red-400 underline">Borrar</button>
                        </div>
                        <canvas ref={canvasRef} width={400} height={120} className="w-full h-24 bg-zinc-50 border border-zinc-200 rounded-xl touch-none" />
                    </div>
                </div>
              </div>
          </div>

          <div className="flex justify-end pt-4 pb-12">
            <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-bold shadow-xl transition-all active:scale-95">
              <Save className="w-5 h-5" /> Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}