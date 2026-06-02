import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, Plus, Upload, Download } from 'lucide-react';
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
    <div className="px-4 md:px-8 py-6">
      {/* Cabecera */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Clientes</h1>
        <p className="text-sm text-zinc-500 mt-1">Gestión de clientes y sus centros</p>
      </div>

      {/* Pestañas + botones: en móvil columna, en desktop fila */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        {/* Pestañas estilo Catálogo */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                tab === t.id ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-200 text-zinc-500'
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3 py-2 rounded-lg font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" /> Exportar
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3 py-2 rounded-lg font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Importar
          </button>
          <button
            onClick={() => navigate(tab === 'clientes' ? '/clientes' : '/centros')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-black text-white px-3 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo
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
