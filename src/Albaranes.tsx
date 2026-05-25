import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileDigit, Download, Search, CheckCircle2, Circle, Clock } from 'lucide-react';
import { generarAlbaranPDF } from './pdfGenerator';

export default function Albaranes() {
  const navigate = useNavigate();
/* eslint-disable @typescript-eslint/no-explicit-any */
  // Cargar desde localStorage en el estado inicial para evitar setState dentro de useEffect
  const [albaranes, setAlbaranes] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]'));
  const [clientes, setClientes] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'));
  const [centros, setCentros] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'));
  const [equipos, setEquipos] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]'));
  const [tecnicos, setTecnicos] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]'));
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  const pendingCount = useMemo(() => 
    albaranes.filter(alb => !alb.facturado).length,
  [albaranes]);

  useEffect(() => {
    const storedAlbaranes = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
    const storedClientes = JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]');
    const storedCentros = JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
    const storedEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
    const storedTecnicos = JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');

    setAlbaranes(storedAlbaranes);
    setClientes(storedClientes);
    setCentros(storedCentros);
    setEquipos(storedEquipos);
    setTecnicos(storedTecnicos);
  }, []);

  const toggleFacturado = (id: string) => {
    const updated = albaranes.map(alb => 
      alb.id === id ? { ...alb, facturado: !alb.facturado } : alb
    );
    setAlbaranes(updated);
    localStorage.setItem('firecheck_db_albaranes', JSON.stringify(updated));
  };

  const filtered = albaranes.filter(alb => {
    const cliente = clientes.find(c => c.id === alb.clienteId);
    const term = searchTerm.toLowerCase();
    
    const matchesSearch = 
      alb.id.toLowerCase().includes(term) ||
      alb.numeroMantenimiento.toLowerCase().includes(term) ||
      (cliente && cliente.nombre.toLowerCase().includes(term));
      
    const matchesFilter = !showOnlyPending || !alb.facturado;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 bg-white rounded-full border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-colors shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-3">
              <FileDigit className="w-8 h-8 text-violet-500" />
              Registro de Albaranes
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-[11px] font-bold rounded-full border border-amber-200 shadow-sm animate-in fade-in zoom-in duration-300">
                  {pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="text"
              placeholder="Buscar por número, mantenimiento o cliente..."
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-violet-500/20 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowOnlyPending(!showOnlyPending)}
            className={`px-6 py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 border shadow-sm ${
              showOnlyPending 
              ? 'bg-amber-100 border-amber-200 text-amber-700' 
              : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            {showOnlyPending ? 'Viendo solo pendientes' : 'Ver solo pendientes'}
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          {/* Cabecera de la lista */}
          <div className="hidden md:flex items-center gap-4 px-6 py-4 bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-wider">
            <div className="w-32">Nº Albarán</div>
            <div className="w-40">Mantenimiento</div>
            <div className="w-32">Fecha</div>
            <div className="flex-1">Cliente</div>
            <div className="w-40 text-center">Estado Facturación</div>
            <div className="w-24 text-right">PDF</div>
          </div>

          <div className="divide-y divide-zinc-100">
            {filtered.length === 0 ? (
              <div className="p-20 text-center text-zinc-400">
                No se han encontrado albaranes generados.
              </div>
            ) : (
              filtered.map((alb) => {
                const cliente = clientes.find(c => c.id === alb.clienteId);
                const centro = centros.find(c => c.id === alb.centroId);
                const tech = tecnicos.find(t => t.id === alb.tecnicoId);
                const nombreTecnico = tech ? `${tech.nombre} ${tech.apellidos}` : 'N/A';

                return (
                  <div key={alb.id} className="flex flex-col md:flex-row md:items-center gap-4 px-6 py-5 hover:bg-zinc-50/50 transition-colors">
                    <div className="w-32 font-mono font-bold text-zinc-900 text-sm">{alb.id}</div>
                    <div className="w-40">
                      <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded-lg text-[10px] font-bold border border-violet-100 uppercase">
                        {alb.numeroMantenimiento}
                      </span>
                    </div>
                    <div className="w-32 text-zinc-500 text-sm flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(alb.fechaCreacion).toLocaleDateString()}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-zinc-900 text-sm leading-tight">{cliente?.nombre || 'Desconocido'}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{centro?.nombre || 'Sin centro'}</p>
                    </div>
                    <div className="w-40 flex justify-center">
                      <button
                        onClick={() => toggleFacturado(alb.id)}
                        className={`w-full max-w-[140px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-2 border ${
                          alb.facturado 
                          ? 'bg-blue-600 border-blue-700 text-white shadow-sm' 
                          : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                        }`}
                      >
                        {alb.facturado ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                        {alb.facturado ? 'Facturado' : 'Sin Facturar'}
                      </button>
                    </div>
                    <div className="w-24 flex justify-end">
                      <button 
                        onClick={() => {
                          const eqsDelCentro = equipos.filter(e => e.centroId === alb.centroId);
                          generarAlbaranPDF(
                            cliente, 
                            centro, 
                            eqsDelCentro, 
                            alb.numeroMantenimiento, 
                            nombreTecnico,
                            alb.firmaCliente,
                            alb.firmaTecnico,
                            alb.nombreFirmante
                          );
                        }}
                        className="p-2.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}