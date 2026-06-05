import { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar, MapPin, Search, X,
  ChevronRight, Layers, Clock
} from 'lucide-react';
import { subscribePartes, subscribeCentroSistemas, subscribeClientes, subscribeCentros, updateParte } from './firebase';
import { useNavigate } from 'react-router-dom';
import type { Parte, Centro, Cliente, CentroSistema } from './Centros';
import type { Tecnico } from './firebase';

interface PartesTecnicoProps {
  loggedUser: { id: string; nombre: string; apellidos: string; rol: string };
  onBack: () => void;
}

export default function PartesTecnico({ loggedUser, onBack }: PartesTecnicoProps) {
  const navigate = useNavigate();

  const [partes, setPartes] = useState<Parte[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]'); } catch { return []; }
  });
  const [centros, setCentros] = useState<Centro[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'); } catch { return []; }
  });
  const [clientes, setClientes] = useState<Cliente[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'); } catch { return []; }
  });
  const [tecnicos] = useState<Tecnico[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]'); } catch { return []; }
  });
  const [centroSistemas, setCentroSistemas] = useState<CentroSistema[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]'); } catch { return []; }
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Suscripción en tiempo real a partes desde Firestore
  useEffect(() => {
    const unsub = subscribePartes((items) => {
      const mapped = items.map((d: any) => ({ ...d })) as Parte[];
      setPartes(mapped);
      localStorage.setItem('firecheck_db_partes', JSON.stringify(mapped));
    });
    return () => unsub();
  }, []);

  // Suscripción en tiempo real a clientes desde Firestore
  useEffect(() => {
    const unsub = subscribeClientes((items) => {
      setClientes(items as Cliente[]);
      localStorage.setItem('firecheck_db_clientes', JSON.stringify(items));
    });
    return () => unsub();
  }, []);

  // Suscripción en tiempo real a centros desde Firestore
  useEffect(() => {
    const unsub = subscribeCentros((items) => {
      setCentros(items as Centro[]);
      localStorage.setItem('firecheck_db_centros', JSON.stringify(items));
    });
    return () => unsub();
  }, []);

  // Suscripción a todos los sistemas de centros que aparecen en los partes del técnico
  useEffect(() => {
    const centroIds = [...new Set(partes.map(p => p.centroId).filter(Boolean))];
    if (centroIds.length === 0) return;

    const unsubs = centroIds.map(centroId =>
      subscribeCentroSistemas(centroId, (items: CentroSistema[]) => {
        setCentroSistemas(prev => {
          const otros = prev.filter(s => s.centroId !== centroId);
          return [...otros, ...items];
        });
      })
    );
    return () => unsubs.forEach(u => u());
  }, [partes.length]);

  // Buscar el técnico que corresponde al usuario logueado (por nombre)
  const tecnicoLogueado = tecnicos.find(t =>
    t.nombre?.toLowerCase() === loggedUser?.nombre?.toLowerCase()
  );

  // Filtrar partes asignados a este técnico (todos los estados)
  const partesDelTecnico = partes.filter(p =>
    tecnicoLogueado
      ? (p.tecnicoId === tecnicoLogueado.id || p.tecnicoId === tecnicoLogueado._docId)
      : true
  ).sort((a, b) => {
    const fa = a.fechaProgramada || a.fechaCreacion || '';
    const fb = b.fechaProgramada || b.fechaCreacion || '';
    return fa.localeCompare(fb);
  });

  // Filtrar por buscador (fecha o nombre de centro)
  const partesFiltrados = partesDelTecnico.filter(p => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const centro = centros.find(c => c.id === p.centroId);
    const cliente = clientes.find(cl => cl.id === p.clienteId);
    const fechaStr = (p.fechaProgramada || '').replace(/-/g, '/');
    return (
      (centro?.nombre || '').toLowerCase().includes(term) ||
      (cliente?.nombre || '').toLowerCase().includes(term) ||
      fechaStr.includes(term) ||
      (p.fechaProgramada || '').includes(term)
    );
  });

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'Planificado':
        return 'bg-blue-100 text-blue-700';
      case 'Abierto':
        return 'bg-amber-100 text-amber-700';
      case 'Descargado (Offline)':
        return 'bg-sky-100 text-sky-700';
      case 'Finalizado':
        return 'bg-emerald-100 text-emerald-700';
      case 'Cerrado':
        return 'bg-zinc-900 text-white';
      default:
        return 'bg-zinc-100 text-zinc-600';
    }
  };

  // Al pulsar un parte → cambiar estado a Abierto si estaba Planificado, luego ir a revisión
  const handleAbrirParte = async (parte: Parte) => {
    if (parte.estado === 'Planificado') {
      try {
        await updateParte(parte.id, { estado: 'Abierto' } as any);
        // Actualizar también en localStorage
        const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
        const updatedPartes = storedPartes.map((p: any) =>
          p.id === parte.id ? { ...p, estado: 'Abierto' } : p
        );
        localStorage.setItem('firecheck_db_partes', JSON.stringify(updatedPartes));
      } catch (err) {
        console.error('Error actualizando estado del parte:', err);
      }
    }
    navigate('/revision-checklist', {
      state: { centroId: parte.centroId, parteId: parte.id }
    });
  };

  // ─── VISTA LISTA DE PARTES ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6f3]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 -ml-1 text-zinc-500 hover:text-black transition-colors rounded-xl hover:bg-zinc-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-zinc-900">Mis Partes</h1>
            <p className="text-[11px] text-zinc-500">
              {tecnicoLogueado
                ? `${tecnicoLogueado.nombre} ${tecnicoLogueado.apellidos}`
                : loggedUser.nombre}
              {' · '}{partesFiltrados.length} parte{partesFiltrados.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Buscador */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, centro o fecha..."
              className="w-full pl-9 pr-9 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-violet-400 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Lista de partes */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {partesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Calendar className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold text-sm text-center text-zinc-500">
              {searchTerm ? 'Sin resultados para tu búsqueda' : 'No tienes partes asignados'}
            </p>
            <p className="text-xs text-center mt-1 text-zinc-400">
              {searchTerm ? 'Prueba con otro término' : 'Cuando se te asigne un parte aparecerá aquí'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {partesFiltrados.map(parte => {
              const centro = centros.find(c => c.id === parte.centroId);
              const cliente = clientes.find(cl => cl.id === parte.clienteId);
              const sistCount = centroSistemas.filter(s => s.centroId === parte.centroId).length;
              const isPlanificado = parte.estado === 'Planificado';

              return (
                <button
                  key={parte.id}
                  onClick={() => handleAbrirParte(parte)}
                  className={`w-full bg-white rounded-2xl border-2 transition-all text-left shadow-sm hover:shadow-md active:scale-[0.98] ${
                    isPlanificado
                      ? 'border-blue-200 hover:border-blue-400'
                      : parte.estado === 'Abierto'
                      ? 'border-amber-200 hover:border-amber-400'
                      : parte.estado === 'Finalizado'
                      ? 'border-emerald-200 hover:border-emerald-400'
                      : parte.estado === 'Cerrado'
                      ? 'border-zinc-300 hover:border-zinc-500'
                      : 'border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {/* Vista móvil */}
                  <div className="sm:hidden p-4">
                    {/* Nombre cliente y centro */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-500 truncate">
                          {cliente?.nombre || '—'}
                        </p>
                        <h3 className="text-base font-black text-zinc-900 truncate leading-tight mt-0.5">
                          {centro?.nombre || 'Centro desconocido'}
                        </h3>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 mt-0.5 ${getEstadoBadge(parte.estado)}`}>
                        {parte.estado === 'Descargado (Offline)' ? 'Offline' : parte.estado}
                      </span>
                    </div>

                    {/* Fecha programada y recuento de sistemas */}
                    <div className="flex items-center gap-4 pt-2.5 border-t border-zinc-100">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
                        <Calendar className="w-3.5 h-3.5" />
                        {parte.fechaProgramada
                          ? parte.fechaProgramada.replace(/-/g, '/')
                          : 'Sin fecha'}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                        <Layers className="w-3.5 h-3.5 text-zinc-400" />
                        {sistCount} sistema{sistCount !== 1 ? 's' : ''}
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-400 ml-auto" />
                    </div>
                  </div>

                  {/* Vista desktop */}
                  <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-500 truncate">{cliente?.nombre || '—'}</p>
                      <p className="text-sm font-bold text-zinc-900 truncate">{centro?.nombre || 'Centro desconocido'}</p>
                      {centro?.poblacion && (
                        <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />{centro.poblacion}
                        </p>
                      )}
                    </div>
                    <div className="w-28 text-center">
                      <span className="text-xs font-bold text-blue-600 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        {parte.fechaProgramada ? parte.fechaProgramada.replace(/-/g, '/') : '—'}
                      </span>
                    </div>
                    <div className="w-20 text-center">
                      <span className="text-xs text-zinc-500 flex items-center justify-center gap-1">
                        <Layers className="w-3 h-3 text-zinc-400" />
                        {sistCount} sist.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${getEstadoBadge(parte.estado)}`}>
                        {parte.estado === 'Descargado (Offline)' ? 'Offline' : parte.estado}
                      </span>
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
