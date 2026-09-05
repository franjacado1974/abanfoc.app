import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, Plus, Upload, Download, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import Clientes from './Clientes';
import Centros from './Centros';

export default function ClientesCentros() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'clientes' | 'centros'>('clientes');
  const [clientesCount, setClientesCount] = useState(0);
  const [centrosCount, setCentrosCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem('firecheck_db_clientes');
      setClientesCount(c ? JSON.parse(c).length : 0);
    } catch { setClientesCount(0); }
    try {
      const c = localStorage.getItem('firecheck_db_centros');
      setCentrosCount(c ? JSON.parse(c).length : 0);
    } catch { setCentrosCount(0); }
  }, []);

  const handleExport = () => {
    if (tab === 'clientes') {
      const data = JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]');
      if (!data.length) return alert('No hay clientes para exportar');
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
      XLSX.writeFile(wb, 'clientes_export.xlsx');
    } else {
      const data = JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
      if (!data.length) return alert('No hay centros para exportar');
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Centros');
      XLSX.writeFile(wb, 'centros_export.xlsx');
    }
  };

  const tabs = [
    { id: 'clientes' as const, label: 'Clientes', icon: Users, count: clientesCount },
    { id: 'centros' as const, label: 'Centros', icon: Building2, count: centrosCount },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-6">
      {/* Cabecera */}
      <div className="mb-6 text-center sm:text-left flex flex-col items-center sm:items-start">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
        </button>
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Clientes y Centros</h1>
        <p className="text-xs font-semibold text-zinc-500 mt-1">Gestión integral de las fichas de clientes y sus respectivos centros de trabajo.</p>
      </div>

      {/* Pestañas + botones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        {/* Pestañas */}
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1.5 rounded-2xl w-fit border border-zinc-200/40">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                tab === t.id
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <t.icon className={`w-4 h-4 ${tab === t.id ? 'text-red-600' : 'text-zinc-400'}`} />
              {t.label}
              <span className={`text-[10px] font-black font-sans px-2 py-0.5 rounded-md transition-colors ${
                tab === t.id ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls" className="hidden" />
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-950 px-3.5 py-2.5 rounded-xl font-bold transition-all text-xs shadow-sm cursor-pointer hover:shadow"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-450" /> Exportar
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-950 px-3.5 py-2.5 rounded-xl font-bold transition-all text-xs shadow-sm cursor-pointer hover:shadow"
          >
            <Download className="w-3.5 h-3.5 text-zinc-450" /> Importar
          </button>
          <button
            onClick={() => navigate(tab === 'clientes' ? '/clientes' : '/centros')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all text-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo {tab === 'clientes' ? 'Cliente' : 'Centro'}
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div>
        {tab === 'clientes' ? <Clientes hideHeader /> : <Centros hideHeader />}
      </div>
    </div>
  );
}
