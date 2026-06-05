import { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar, Building2, MapPin, Search, X,
  ChevronRight, Layers, Edit, AlertTriangle, Clock,
  FileText, User as UserIcon, RefreshCw
} from 'lucide-react';
import { subscribePartes, subscribeCentroSistemas, subscribeEquiposInstalados } from './firebase';
import { useNavigate } from 'react-router-dom';
import type { Parte, Centro, Cliente, CentroSistema, EquipoInstalado } from './Centros';
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
  const [centros] = useState<Centro[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'); } catch { return []; }
  });
  const [clientes] = useState<Cliente[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'); } catch { return []; }
  });
  const [tecnicos] = useState<Tecnico[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]'); } catch { return []; }
  });
  const [centroSistemas, setCentroSistemas] = useState<CentroSistema[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]'); } catch { return []; }
  });
  const [equiposInstalados, setEquiposInstalados] = useState<EquipoInstalado[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]'); } catch { return []; }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [parteSeleccionado, setParteSeleccionado] = useState<Parte | null>(null);

  // Suscripción en tiempo real a partes desde Firestore
  useEffect(() => {
    const unsub = subscribePartes((items) => {
      const mapped = items.map((d: any) => ({ ...d })) as Parte[];
      setPartes(mapped);
      localStorage.setItem('firecheck_db_partes', JSON.stringify(mapped));
    });
    return () => unsub();
  }, []);

  // Suscripción a sistemas del centro cuando se selecciona un parte
  useEffect(() => {
    if (!parteSeleccionado?.centroId) return;
    const centroId = parteSeleccionado.centroId;
    const unsub = subscribeCentroSistemas(centroId, (items: CentroSistema[]) => {
      setCentroSistemas(prev => {
        const otrosCentros = prev.filter(s => s.centroId !== centroId);
        return [...otrosCentros, ...items];
      });
    });
    return () => unsub();
  }, [parteSeleccionado?.centroId]);

  // Suscripción a equipos de los sistemas del centro seleccionado
  useEffect(() => {
    if (!parteSeleccionado?.centroId) return;
    const centroId = parteSeleccionado.centroId;
    const sistDelCentro = centroSistemas.filter(s => s.centroId === centroId);
    if (sistDelCentro.length === 0) return;

    const unsubs = sistDelCentro.map(sist => {
      return subscribeEquiposInstalados(centroId, sist.id, (items: EquipoInstalado[]) => {
        setEquiposInstalados(prev => {
          const otrosSistemas = prev.filter(e => e.sistemaId !== sist.id);
          return [...otrosSistemas, ...items];
        });
      });
    });
    return () => unsubs.forEach(u => u());
  }, [parteSeleccionado?.centroId, centroSistemas.length]);

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
    const fechaStr = (p.fechaProgramada || '').replace(/-/g, '/');
    return (
      (centro?.nombre || '').toLowerCase().includes(term) ||
      fechaStr.includes(term) ||
      (p.fechaProgramada || '').includes(term)
    );
  });

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'Planificado':
        return 'bg-blue-100 text-blue-700';
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

  // ─── VISTA DETALLE DEL PARTE ───────────────────────────────────────────────
  if (parteSeleccionado) {
    const centro = centros.find(c => c.id === parteSeleccionado.centroId);
    const cliente = clientes.find(cl => cl.id === parteSeleccionado.clienteId);
    const tecnico = tecnicos.find(t => t.id === parteSeleccionado.tecnicoId || t._docId === parteSeleccionado.tecnicoId);
    const sistDelCentro = centroSistemas.filter(s => s.centroId === parteSeleccionado.centroId);

    return (
      <div className="min-h-screen bg-[#f8f6f3]">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-zinc-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setParteSeleccionado(null)}
            className="p-2 -ml-1 text-zinc-500 hover:text-black transition-colors rounded-xl hover:bg-zinc-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400 font-medium truncate">{cliente?.nombre}</p>
            <h2 className="text-base font-bold text-zinc-900 truncate">{centro?.nombre || 'Centro'}</h2>
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${getEstadoBadge(parteSeleccionado.estado)}`}>
            {parteSeleccionado.estado}
          </span>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {/* Tarjeta principal del parte */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            {/* Cabecera tarjeta */}
            <div className="bg-gradient-to-r from-violet-50 to-blue-50 px-5 py-4 border-b border-zinc-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-zinc-400">{parteSeleccionado.id}</p>
                    <p className="text-sm font-bold text-zinc-800">{parteSeleccionado.tipoTrabajo || 'Mantenimiento'}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${getEstadoBadge(parteSeleccionado.estado)}`}>
                  {parteSeleccionado.estado}
                </span>
              </div>
            </div>

            {/* Datos del parte */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Centro</p>
                  <p className="font-semibold text-zinc-800">{centro?.nombre || 'Desconocido'}</p>
                </div>
              </div>

              {centro?.direccion && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Dirección</p>
                    <p className="text-zinc-600">{centro.direccion}{centro.poblacion ? `, ${centro.poblacion}` : ''}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Fecha programada</p>
                  <p className="font-bold text-blue-700">
                    {parteSeleccionado.fechaProgramada
                      ? parteSeleccionado.fechaProgramada.replace(/-/g, '/')
                      : 'No especificada'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <UserIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Técnico</p>
                  <p className="text-zinc-600">{tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado'}</p>
                </div>
              </div>

              {parteSeleccionado.periodicidad && (
                <div className="flex items-center gap-3 text-sm">
                  <RefreshCw className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Periodicidad</p>
                    <p className="text-zinc-600">{parteSeleccionado.periodicidad}</p>
                  </div>
                </div>
              )}

              {parteSeleccionado.numeroMantenimiento && (
                <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700">Ref. Trabajo</span>
                  <span className="font-mono font-bold text-emerald-900 text-sm">{parteSeleccionado.numeroMantenimiento}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sistemas del centro */}
          {sistDelCentro.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-1 mb-3">Sistemas a revisar</h3>
              <div className="space-y-2">
                {sistDelCentro.map(sist => {
                  const equiposDelSist = equiposInstalados.filter(e => e.sistemaId === sist.id && e.revisable !== false);
                  const revisados = equiposDelSist.filter(e => e.revisado === true).length;
                  const total = equiposDelSist.length;
                  const pct = total > 0 ? Math.round((revisados / total) * 100) : 0;
                  const hasAnomalies = equiposDelSist.some(eq =>
                    Object.keys(eq).some(k => k.startsWith('check') && (eq as any)[k] === false)
                  );

                  return (
                    <button
                      key={sist.id}
                      onClick={() => navigate('/revision-checklist', {
                        state: { centroId: parteSeleccionado.centroId, parteId: parteSeleccionado.id, sistemaId: sist.id }
                      })}
                      className="w-full bg-white rounded-2xl p-4 border border-zinc-200 hover:border-blue-300 active:scale-[0.98] transition-all text-left flex items-center gap-4 shadow-sm"
                    >
                      <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">{sist.familia || sist.tipo}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{total} equipos · {revisados} revisados</p>
                        <div className="mt-2 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasAnomalies && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        <ChevronRight className="w-5 h-5 text-zinc-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Botón iniciar revisión */}
          {parteSeleccionado.estado !== 'Cerrado' && (
            <button
              onClick={() => navigate('/revision-checklist', {
                state: { centroId: parteSeleccionado.centroId, parteId: parteSeleccionado.id }
              })}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all"
            >
              <Edit className="w-5 h-5" /> Iniciar revisión completa
            </button>
          )}
        </div>
      </div>
    );
  }

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
            <h1 className="text-base font-bold text-zinc-900">Lista de Partes</h1>
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
              placeholder="Buscar por centro o fecha (ej: 2026/06)..."
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

      {/* Tabla / Lista */}
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
          <>
            {/* Cabecera tabla (solo desktop) */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Centro</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 text-center w-24">Fecha</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 text-center w-24">Estado</span>
              <span className="w-5" />
            </div>

            {/* Filas */}
            <div className="space-y-2">
              {partesFiltrados.map(parte => {
                const centro = centros.find(c => c.id === parte.centroId);
                const cliente = clientes.find(cl => cl.id === parte.clienteId);
                const sistCount = centroSistemas.filter(s => s.centroId === parte.centroId).length;
                const isPlanificado = parte.estado === 'Planificado';

                return (
                  <button
                    key={parte.id}
                    onClick={() => setParteSeleccionado(parte)}
                    className={`w-full bg-white rounded-2xl border-2 transition-all text-left shadow-sm hover:shadow-md active:scale-[0.99] ${
                      isPlanificado
                        ? 'border-blue-200 hover:border-blue-400'
                        : parte.estado === 'Finalizado'
                        ? 'border-emerald-200 hover:border-emerald-400'
                        : parte.estado === 'Cerrado'
                        ? 'border-zinc-300 hover:border-zinc-500'
                        : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    {/* Vista móvil */}
                    <div className="sm:hidden p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-zinc-400 truncate">{cliente?.nombre}</p>
                          <h3 className="text-sm font-bold text-zinc-900 truncate">{centro?.nombre || 'Centro desconocido'}</h3>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${getEstadoBadge(parte.estado)}`}>
                          {parte.estado === 'Descargado (Offline)' ? 'Offline' : parte.estado}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1 font-bold text-blue-600">
                          <Calendar className="w-3 h-3" />
                          {parte.fechaProgramada ? parte.fechaProgramada.replace(/-/g, '/') : 'Sin fecha'}
                        </span>
                        <span className="text-zinc-300">·</span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {sistCount} sistema{sistCount !== 1 ? 's' : ''}
                        </span>
                        <ChevronRight className="w-4 h-4 text-zinc-400 ml-auto" />
                      </div>
                    </div>

                    {/* Vista desktop (tabla) */}
                    <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="text-[10px] text-zinc-400 truncate">{cliente?.nombre}</p>
                        <p className="text-sm font-bold text-zinc-900 truncate">{centro?.nombre || 'Centro desconocido'}</p>
                        {centro?.poblacion && (
                          <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />{centro.poblacion}
                          </p>
                        )}
                      </div>
                      <div className="w-24 text-center">
                        <span className="text-xs font-bold text-blue-600 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" />
                          {parte.fechaProgramada ? parte.fechaProgramada.replace(/-/g, '/') : '—'}
                        </span>
                      </div>
                      <div className="w-24 flex justify-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${getEstadoBadge(parte.estado)}`}>
                          {parte.estado === 'Descargado (Offline)' ? 'Offline' : parte.estado}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
