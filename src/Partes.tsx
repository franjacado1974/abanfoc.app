import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Building2, MapPin, CalendarDays, Search, MoreVertical, ExternalLink, Trash2 } from 'lucide-react';
import { subscribePartes, subscribeCentros, subscribeClientes, deleteParte } from './firebase';

interface ParteItem {
  id: string;
  centroId: string;
  nombreCentro?: string;
  clienteId: string;
  fechaCreacion: string;
  tecnicoId: string;
  empresaId?: string;
  periodicidad: string;
  mesesRevision: string;
  estado: string;
  fechaProgramada?: string;
  _docId?: string;
}

interface Cliente {
  id: string;
  nombre: string;
  cif?: string;
  direccion?: string;
  poblacion?: string;
}

interface Centro {
  id: string;
  clienteId: string;
  nombre: string;
  direccion?: string;
  poblacion?: string;
  provincia?: string;
}

export default function Partes() {
  const navigate = useNavigate();
  const [partes, setPartes] = useState<ParteItem[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubPartes = subscribePartes((items) => {
      setPartes(items.map((d: any) => ({ ...d })) as ParteItem[]);
    });
    const unsubCentros = subscribeCentros((items) => {
      setCentros(items);
    });
    const unsubClientes = subscribeClientes((items) => {
      setClientes(items);
    });
    return () => {
      unsubPartes();
      unsubCentros();
      unsubClientes();
    };
  }, []);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCliente = (clienteId: string) => clientes.find(c => c.id === clienteId);
  const getCentro = (centroId: string) => centros.find(c => c.id === centroId);

  const getTipoRevision = (periodicidad: string): string => {
    if (periodicidad.toLowerCase().includes('trimestral')) return 'Revisión Trimestral';
    if (periodicidad.toLowerCase().includes('anual')) return 'Revisión Anual';
    if (periodicidad.toLowerCase().includes('mensual')) return 'Revisión Mensual';
    return periodicidad;
  };

  const getRevisionColor = (periodicidad: string): string => {
    if (periodicidad.toLowerCase().includes('trimestral')) return 'bg-sky-100 text-sky-800 border-sky-200';
    if (periodicidad.toLowerCase().includes('anual')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (periodicidad.toLowerCase().includes('mensual')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  };

  const formatFecha = (fecha?: string) => {
    if (!fecha) return '—';
    try {
      const [dia, mes, anio] = fecha.split('-');
      return `${dia}/${mes}/${anio}`;
    } catch {
      return fecha;
    }
  };

  const irARevision = (parte: ParteItem) => {
    setMenuOpenId(null);
    navigate('/revision-checklist', {
      state: {
        parteId: parte.id,
        centroId: parte.centroId,
        clienteId: parte.clienteId,
        periodicidad: parte.periodicidad,
        fechaProgramada: parte.fechaProgramada,
      }
    });
  };

  const eliminarParte = async (parte: ParteItem) => {
    setMenuOpenId(null);
    if (!confirm('¿Estás seguro de eliminar este parte de trabajo?')) return;
    try {
      const docId = (parte as any)._docId || parte.id;
      await deleteParte(docId);
    } catch (err) {
      console.error('Error eliminando parte:', err);
    }
  };

  const partesFiltrados = search
    ? partes.filter(p => {
        const centro = getCentro(p.centroId);
        const cliente = getCliente(p.clienteId);
        const text = `${centro?.nombre || ''} ${cliente?.nombre || ''} ${centro?.poblacion || ''} ${getTipoRevision(p.periodicidad)}`.toLowerCase();
        return text.includes(search.toLowerCase());
      })
    : partes;

  // Only show parts that have a fechaProgramada (planified)
  const partesPlanificados = partesFiltrados.filter(
    p => p.fechaProgramada && p.fechaProgramada.trim() !== ''
  ).sort((a, b) => {
    if (!a.fechaProgramada) return 1;
    if (!b.fechaProgramada) return -1;
    const [da, ma, ya] = a.fechaProgramada.split('-').map(Number);
    const [db, mb, yb] = b.fechaProgramada.split('-').map(Number);
    return (ya * 10000 + ma * 100 + da) - (yb * 10000 + mb * 100 + db);
  });

  return (
    <div className="min-h-screen bg-amber-50/40 p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-sky-950 flex items-center gap-3">
            <FileText className="w-8 h-8 text-sky-500" /> Partes de Trabajo
          </h1>
          <div className="ml-auto relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar partes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-sky-100 overflow-hidden">
          {partesPlanificados.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <p className="text-zinc-500 font-medium">No hay partes de trabajo planificados</p>
              <p className="text-zinc-400 text-sm mt-1">
                Los partes aparecerán aquí cuando se programen trabajos en el calendario de Planificación
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-sky-100 bg-sky-50/30">
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Cliente
                      </div>
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Centro
                      </div>
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Población
                      </div>
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Fecha Planificada
                      </div>
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Tipo Revisión
                      </div>
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-bold uppercase tracking-wider text-sky-600 w-20">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-50">
                  {partesPlanificados.map(parte => {
                    const centro = getCentro(parte.centroId);
                    const cliente = getCliente(parte.clienteId);
                    const docId = (parte as any)._docId || parte.id;
                    return (
                      <tr key={parte.id} className="hover:bg-amber-50/40 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-bold text-zinc-900 text-sm">
                            {cliente?.nombre || '—'}
                          </p>
                          {cliente?.cif && (
                            <p className="text-[10px] text-zinc-400 mt-0.5">{cliente.cif}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-800 text-sm">
                            {centro?.nombre || parte.nombreCentro || '—'}
                          </p>
                          {centro?.id && (
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{centro.id}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-zinc-600">
                            {centro?.poblacion || '—'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-zinc-800">
                            {formatFecha(parte.fechaProgramada)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-3 py-1 text-[11px] font-bold rounded-full border ${getRevisionColor(parte.periodicidad)}`}>
                            {getTipoRevision(parte.periodicidad)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center relative">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === docId ? null : docId)}
                            className="p-2 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-700"
                            title="Acciones"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {menuOpenId === docId && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-12 z-50 w-52 bg-white rounded-2xl shadow-2xl border border-sky-100 overflow-hidden"
                            >
                              <button
                                onClick={() => irARevision(parte)}
                                className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-sky-700 hover:bg-sky-50 transition-colors text-left"
                              >
                                <ExternalLink className="w-4 h-4 text-sky-500" />
                                Ir a Revisión
                              </button>
                              <div className="border-t border-sky-50" />
                              <button
                                onClick={() => eliminarParte(parte)}
                                className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                                Eliminar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
          <span>Total: {partesPlanificados.length} parte{partesPlanificados.length !== 1 ? 's' : ''} planificado{partesPlanificados.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}