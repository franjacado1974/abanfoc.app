import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Calendar, User as UserIcon, ArrowLeft, Briefcase } from 'lucide-react';
import { subscribePartes, subscribeCentros, subscribeClientes, subscribeTecnicos } from './firebase';

export default function PartesMovil() {
  const navigate = useNavigate();
  const [partes, setPartes] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [appLogo, setAppLogo] = useState('/logo.png');

  useEffect(() => {
    // 1. Carga inicial rápida de caché local
    try {
      const storedPartes = localStorage.getItem('firecheck_db_partes');
      if (storedPartes) setPartes(JSON.parse(storedPartes));
      
      const storedTecnicos = localStorage.getItem('firecheck_db_tecnicos');
      if (storedTecnicos) setTecnicos(JSON.parse(storedTecnicos));

      const storedCentros = localStorage.getItem('firecheck_db_centros');
      if (storedCentros) setCentros(JSON.parse(storedCentros));

      const storedClientes = localStorage.getItem('firecheck_db_clientes');
      if (storedClientes) setClientes(JSON.parse(storedClientes));

      const storedLogo = localStorage.getItem('firecheck_db_logo');
      if (storedLogo) setAppLogo(storedLogo);
    } catch (e) { console.error("Error loading cached data:", e); }

    // 2. Suscripciones en tiempo real con Firestore
    const unsubPartes = subscribePartes((items) => {
      setPartes(items);
      localStorage.setItem('firecheck_db_partes', JSON.stringify(items));
    });
    const unsubCentros = subscribeCentros((items) => {
      setCentros(items);
      localStorage.setItem('firecheck_db_centros', JSON.stringify(items));
    });
    const unsubClientes = subscribeClientes((items) => {
      setClientes(items);
      localStorage.setItem('firecheck_db_clientes', JSON.stringify(items));
    });
    const unsubTecnicos = subscribeTecnicos((items) => {
      setTecnicos(items);
      localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(items));
    });

    return () => {
      unsubPartes();
      unsubCentros();
      unsubClientes();
      unsubTecnicos();
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      {/* Header Sticky para Móvil */}
      <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-zinc-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 text-zinc-400 hover:text-black transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <img src={appLogo} alt="Logo" className="h-10 max-w-[150px] object-contain" />
          <div className="w-10" />
        </div>
        <h1 className="text-xl font-black text-zinc-900 mt-2 px-1">Tareas Asignadas</h1>
      </div>

      <div className="p-4 space-y-4">
        {partes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Briefcase className="w-16 h-16 mb-4 opacity-10" />
            <p className="font-medium text-sm text-center">No hay tareas planificadas.</p>
          </div>
        ) : (
          partes.map(parte => {
            const centro = centros.find(c => c._docId === parte.centroId || c.id === parte.centroId);
            const cliente = clientes.find(c => c.id === parte.clienteId);
            const tecnico = tecnicos.find(t => t.id === parte.tecnicoId);
            
            return (
              <div key={parte.id} className="bg-white rounded-[2rem] p-5 border border-zinc-100 shadow-sm active:scale-[0.98] transition-all">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[9px] font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full uppercase tracking-widest border border-indigo-100">
                    {parte.estado}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-zinc-300">{parte.id}</span>
                </div>

                <div className="mb-5">
                  <h3 className="font-black text-zinc-900 text-lg leading-tight mb-1">
                    {centro?.nombre || 'Centro Desconocido'}
                  </h3>
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold truncate">{cliente?.nombre || 'Cliente'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-50">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-black text-zinc-800">
                      {parte.fechaProgramada ? parte.fechaProgramada.split('-').reverse().join('/') : '--/--/--'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <UserIcon className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-black text-zinc-800 truncate">
                      {tecnico ? tecnico.nombre : 'Sin asignar'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}