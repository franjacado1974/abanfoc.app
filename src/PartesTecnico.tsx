import { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar, Search, X,
  ChevronRight, Layers, Clock, Filter,
  DownloadCloud, CheckCircle2, RefreshCw, HardDrive, Database
} from 'lucide-react';
import { subscribePartes, subscribeCentroSistemas, subscribeClientes, subscribeCentros, updateParte, getEquiposInstalados } from './firebase';
import { getPlantillas } from './plantillas';
import { saveParteOfflineBundle, getParteOfflineBundle, getOfflineDiagnostics, type OfflineParteBundle } from './offlineDB';
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('TODOS');
  const [downloadingParteId, setDownloadingParteId] = useState<string | null>(null);
  const [downloadedPartesMap, setDownloadedPartesMap] = useState<Record<string, boolean>>({});
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [diagInfo, setDiagInfo] = useState<any>(null);

  // Cargar mapa de partes descargados en IndexedDB
  useEffect(() => {
    const checkDownloaded = async () => {
      const map: Record<string, boolean> = {};
      for (const p of partes) {
        try {
          const bundle = await getParteOfflineBundle(p.id);
          if (bundle) map[p.id] = true;
        } catch { /* ignore */ }
      }
      setDownloadedPartesMap(map);
    };
    if (partes.length > 0) {
      checkDownloaded();
    }
  }, [partes]);

  const handleDescargarParteOffline = async (parteToDownload: Parte, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingParteId(parteToDownload.id);

    try {
      const centro = centros.find(c => c._docId === parteToDownload.centroId || c.id === parteToDownload.centroId);
      const cliente = clientes.find(cl => cl.id === parteToDownload.clienteId);
      const sistemas = centroSistemas.filter(s => s.centroId === parteToDownload.centroId || (centro && s.centroId === centro.id));

      const equiposInstalados: any[] = [];
      for (const sist of sistemas) {
        try {
          const eqList = await getEquiposInstalados(parteToDownload.centroId, sist.id);
          equiposInstalados.push(...eqList);
        } catch (err) {
          console.warn('Error cargando equipos para offline:', sist.id, err);
        }
      }

      let plantillas: any[] = [];
      try {
        plantillas = await getPlantillas();
      } catch { /* ignore */ }

      const bundle: OfflineParteBundle = {
        parteId: parteToDownload.id,
        centroId: parteToDownload.centroId,
        clienteId: parteToDownload.clienteId,
        parte: parteToDownload,
        cliente: cliente || null,
        centro: centro || null,
        sistemasDelCentro: sistemas,
        equiposInstalados,
        checklistItemsPorSistema: {},
        plantillas,
        categoriasSistema: [],
        equiposCatalogo: [],
        downloadedAt: new Date().toISOString(),
        syncStatus: 'downloaded'
      };

      await saveParteOfflineBundle(bundle);
      try {
        await updateParte(parteToDownload.id, { estado: 'Descargado (Offline)' } as any);
      } catch { /* offline mode ignore */ }

      setDownloadedPartesMap(prev => ({ ...prev, [parteToDownload.id]: true }));
      alert(`✅ Parte "${parteToDownload.numeroMantenimiento || parteToDownload.id}" descargado con éxito en IndexedDB para trabajo Offline.`);
    } catch (err) {
      console.error('Error descargando parte offline:', err);
      alert('Error guardando el parte en IndexedDB.');
    } finally {
      setDownloadingParteId(null);
    }
  };

  const handleOpenDiag = async () => {
    try {
      const diag = await getOfflineDiagnostics();
      setDiagInfo(diag);
      setShowDiagModal(true);
    } catch (err) {
      alert('Error cargando diagnóstico: ' + err);
    }
  };

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

  // Filtrar partes asignados a este técnico (excluir Cerrado y Finalizado)
  const partesDelTecnico = partes.filter(p =>
    p.estado !== 'Cerrado' &&
    (tecnicoLogueado ? (p.tecnicoId === tecnicoLogueado.id || p.tecnicoId === tecnicoLogueado._docId) : true)
  ).sort((a, b) => {
    const fa = a.fechaProgramada || a.fechaCreacion || '';
    const fb = b.fechaProgramada || b.fechaCreacion || '';
    return fa.localeCompare(fb);
  });

  // Filtrar por estado, buscador (fecha o nombre de centro) y rango de fechas
  const partesFiltrados = partesDelTecnico.filter(p => {
    if (estadoFilter !== 'TODOS') {
      const st = (p.estado || '').trim();
      if (estadoFilter === 'Abierto') {
        if (st !== 'Abierto' && st !== 'Planificado' && st !== '') return false;
      } else if (estadoFilter === 'En revisión') {
        if (st !== 'En revisión' && st !== 'En curso') return false;
      } else if (estadoFilter === 'Finalizado') {
        if (st !== 'Finalizado') return false;
      } else if (estadoFilter === 'Pre-Cerrado') {
        if (st !== 'Pre-Cerrado') return false;
      } else if (estadoFilter === 'Cerrado') {
        if (st !== 'Cerrado') return false;
      }
    }

    let matchesSearch = true;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const centro = centros.find(c => c._docId === p.centroId || c.id === p.centroId);
      const cliente = clientes.find(cl => cl.id === p.clienteId);
      const fechaStr = (p.fechaProgramada || '').replace(/-/g, '/');
      matchesSearch = (
        (centro?.nombre || '').toLowerCase().includes(term) ||
        (cliente?.nombre || '').toLowerCase().includes(term) ||
        fechaStr.includes(term) ||
        (p.fechaProgramada || '').includes(term)
      );
    }
    
    if (!matchesSearch) return false;

    // Date range match
    if (!startDate && !endDate) return true;
    if (!p.fechaProgramada) return false;
    
    const [d, m, y] = p.fechaProgramada.split('-').map(Number);
    const dateNum = y * 10000 + m * 100 + d;
    
    if (startDate) {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const startNum = sy * 10000 + sm * 100 + sd;
      if (dateNum < startNum) return false;
    }
    if (endDate) {
      const [ey, em, ed] = endDate.split('-').map(Number);
      const endNum = ey * 10000 + em * 100 + ed;
      if (dateNum > endNum) return false;
    }
    
    return true;
  });

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'Planificado':
        return 'bg-zinc-200 text-zinc-700 border border-zinc-300';
      case 'Abierto':
      case 'En curso':
      case 'En revisión':
        return 'bg-amber-100 text-amber-700';
      case 'Descargado (Offline)':
        return 'bg-sky-100 text-sky-700';
      case 'Finalizado':
        return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'Pre-Cerrado':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
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
    <div className="min-h-screen bg-zinc-50 pb-12">
      {/* Header Fijo */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-zinc-200 shadow-sm">
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

        {/* Buscador, Filtro de Estado y Rango de fechas */}
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-red-500/80 shadow-sm">
            <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="text-sm outline-none text-zinc-600 bg-transparent flex-1"
            />
            <span className="text-zinc-400 text-sm">a</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="text-sm outline-none text-zinc-600 bg-transparent flex-1"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-1 text-zinc-400 hover:text-red-500 rounded-md transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none z-10" />
              <select
                value={estadoFilter}
                onChange={e => setEstadoFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-red-500/80 rounded-xl text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-500/10 transition-all shadow-sm text-zinc-950 appearance-none font-medium cursor-pointer"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="Abierto">Abierto / Planificado</option>
                <option value="En revisión">En revisión / En curso</option>
                <option value="Finalizado">Parte Finalizado / Firmado</option>
                <option value="Pre-Cerrado">Pre-cerrado</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, centro o fecha..."
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-red-500/80 rounded-xl text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-500/10 transition-all shadow-sm text-zinc-950"
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
      <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-4">
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
              const centro = centros.find(c => c._docId === parte.centroId || c.id === parte.centroId);
              const cliente = clientes.find(cl => cl.id === parte.clienteId);
              const sistCount = centroSistemas.filter(s => s.centroId === parte.centroId || (centro && s.centroId === centro.id)).length;
              const isPlanificado = parte.estado === 'Planificado';

              return (
                <button
                  key={parte.id}
                  onClick={() => handleAbrirParte(parte)}
                  className={`w-full bg-white rounded-3xl border transition-all text-left shadow-sm hover:shadow-md hover:border-zinc-350 active:scale-[0.98] ${
                    isPlanificado
                      ? 'border-zinc-200 hover:border-zinc-400'
                      : parte.estado === 'Abierto'
                      ? 'border-amber-200 hover:border-amber-400'
                      : parte.estado === 'Finalizado'
                      ? 'border-blue-200 hover:border-blue-400'
                      : parte.estado === 'Pre-Cerrado'
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
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          <span className="text-blue-600 font-bold">Parte: {parte.numeroMantenimiento || parte.id}</span>
                        </p>
                      </div>
                      {parte.retirarExtintoresRetimbrado && !parte.retimbradoReiniciado && (
                        <span 
                          className="text-lg animate-pulse mr-1.5 shrink-0 select-none"
                          title="Extintores retirados para retimbrado (Pendiente)"
                        >
                          🧯
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 mt-0.5 ${getEstadoBadge(parte.estado)}`}>
                        {parte.estado === 'Descargado (Offline)' ? 'Offline' : parte.estado === 'Finalizado' ? 'Parte Finalizado' : parte.estado === 'Pre-Cerrado' ? 'Pre-cerrado' : parte.estado}
                      </span>
                    </div>

                    {/* Fecha programada, recuento de sistemas y periodicidad */}
                    <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 pt-2.5 border-t border-zinc-100">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
                          <Calendar className="w-3.5 h-3.5" />
                          {parte.fechaProgramada
                            ? parte.fechaProgramada.replace(/-/g, '/')
                            : 'Sin fecha'}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                          {parte.periodicidad || 'Revisión'}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                          <Layers className="w-3.5 h-3.5 text-zinc-400" />
                          {sistCount} sist.
                        </span>
                      </div>

                      {/* Botón Descargar Parte Completo Offline */}
                      <button
                        type="button"
                        onClick={(e) => handleDescargarParteOffline(parte, e)}
                        disabled={downloadingParteId === parte.id}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                          downloadedPartesMap[parte.id]
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                            : 'bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-100 active:scale-95'
                        }`}
                        title="Guardar cliente, centro, equipos y plantillas en IndexedDB para trabajar offline sin red"
                      >
                        {downloadingParteId === parte.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                            <span>Descargando...</span>
                          </>
                        ) : downloadedPartesMap[parte.id] ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Descargado</span>
                          </>
                        ) : (
                          <>
                            <DownloadCloud className="w-3.5 h-3.5 text-sky-600" />
                            <span>Descargar parte</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Vista desktop */}
                  <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-500 truncate">{cliente?.nombre || '—'}</p>
                      <p className="text-sm font-bold text-zinc-900 truncate">{centro?.nombre || 'Centro desconocido'}</p>
                      <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                        <span className="text-blue-600 font-bold">Parte: {parte.numeroMantenimiento || parte.id}</span>{centro?.poblacion ? ` - ${centro.poblacion}` : ''}
                      </p>
                    </div>
                    <div className="w-24 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-1 rounded-md inline-block whitespace-nowrap">
                        {parte.periodicidad || 'Revisión'}
                      </span>
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
                    <div>
                      <button
                        type="button"
                        onClick={(e) => handleDescargarParteOffline(parte, e)}
                        disabled={downloadingParteId === parte.id}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                          downloadedPartesMap[parte.id]
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                            : 'bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-100 active:scale-95'
                        }`}
                      >
                        {downloadingParteId === parte.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                            <span>Descargando...</span>
                          </>
                        ) : downloadedPartesMap[parte.id] ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Descargado</span>
                          </>
                        ) : (
                          <>
                            <DownloadCloud className="w-3.5 h-3.5 text-sky-600" />
                            <span>Descargar</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {parte.retirarExtintoresRetimbrado && !parte.retimbradoReiniciado && (
                        <span 
                          className="text-lg animate-pulse mr-1 shrink-0 select-none"
                          title="Extintores retirados para retimbrado (Pendiente)"
                        >
                          🧯
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${getEstadoBadge(parte.estado)}`}>
                        {parte.estado === 'Descargado (Offline)' ? 'Offline' : parte.estado === 'Finalizado' ? 'Parte Finalizado' : parte.estado === 'Pre-Cerrado' ? 'Pre-cerrado' : parte.estado}
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

      {/* Botón Flotante Diagnóstico Administrador */}
      {(loggedUser.rol === 'super-administrador' || loggedUser.rol === 'administrador') && (
        <button
          onClick={handleOpenDiag}
          className="fixed bottom-4 right-4 z-40 bg-zinc-900 hover:bg-black text-white text-xs font-bold px-3 py-2 rounded-2xl shadow-xl border border-zinc-700 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          title="Panel Diagnóstico Offline IndexedDB"
        >
          <Database className="w-4 h-4 text-sky-400" />
          <span>Diagnóstico DB</span>
        </button>
      )}

      {/* Modal Diagnóstico de Emergencia IndexedDB */}
      {showDiagModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-zinc-900">Diagnóstico IndexedDB (Offline)</h3>
              </div>
              <button onClick={() => setShowDiagModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            {diagInfo && (
              <div className="space-y-3 text-xs font-mono text-zinc-700">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                  <p><strong>Base de Datos:</strong> {diagInfo.dbName}</p>
                  <p><strong>Esquema Versión:</strong> v{diagInfo.dbVersion}</p>
                  <p><strong>Partes Descargados:</strong> {diagInfo.partesCount}</p>
                  <p><strong>Fotos Binarias (Blobs):</strong> {diagInfo.photosCount}</p>
                  <p><strong>Cola Pendiente (Idempotente):</strong> {diagInfo.pendingQueueCount}</p>
                </div>
                {diagInfo.storageEstimate && (
                  <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-sky-900 space-y-1">
                    <p><strong>Uso de Almacenamiento:</strong> {(diagInfo.storageEstimate.usage / (1024 * 1024)).toFixed(2)} MB</p>
                    <p><strong>Cuota Disponible:</strong> {(diagInfo.storageEstimate.quota / (1024 * 1024)).toFixed(0)} MB</p>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowDiagModal(false)}
              className="mt-6 w-full bg-zinc-900 hover:bg-black text-white py-3 rounded-2xl font-bold text-xs shadow-md"
            >
              Cerrar Diagnóstico
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
