import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Building2, FileText, AlertTriangle, CheckCheck } from 'lucide-react';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface Parte {
  id: string;
  centroId: string;
  clienteId: string;
  fechaCreacion: string;
  tecnicoId: string;
  periodicidad: string;
  mesesRevision: string;
  estado: 'Planificado' | 'Descargado (Offline)' | 'Finalizado' | 'Cerrado';
  numeroMantenimiento?: string;
  fechaProgramada?: string; // ISO YYYY-MM-DD
}


export default function Planificacion() {
  const navigate = useNavigate();
  const [partes, setPartes] = useState<Parte[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchMonth, setSearchMonth] = useState('');
  const [showWeekends, setShowWeekends] = useState(true);
  // Track which centros have already been dragged to the calendar (avoid duplicates)
  const [usedCentroIds, setUsedCentroIds] = useState<string[]>([]);

  useEffect(() => {
    const safeParse = (key: string) => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(data) ? data : [];
      } catch (e) { return []; }
    };

    try {
      setPartes(safeParse('firecheck_db_partes'));
      setTecnicos(safeParse('firecheck_db_tecnicos'));
      setCentros(safeParse('firecheck_db_centros'));
      setClientes(safeParse('firecheck_db_clientes'));
    } catch (e) { console.error("Error loading data:", e); }
  }, []);

  // Determinar qué tipo de revisión tiene un centro en un mes dado
  const getCentroRevisionInfo = (centro: any, mesNombre: string): { tieneRevision: boolean; tipo: string } | null => {
    const periodicidad = centro.periodicidad || [];
    const mesesRevision = centro.mesesRevision || [];
    const mesRef = mesesRevision[0] || '';
    
    if (periodicidad.length === 0) return null;

    const idxRef = MESES.indexOf(mesRef);
    const idxSearch = MESES.indexOf(mesNombre);
    if (idxRef === -1 || idxSearch === -1) return null;

    const resultados: { tieneRevision: boolean; tipo: string }[] = [];

    // Mensual: siempre tiene revisión
    if (periodicidad.includes('Mensual')) {
      resultados.push({ tieneRevision: true, tipo: 'Mensual' });
    }

    // Anual: solo el mes de referencia
    if (periodicidad.includes('Anual') && mesRef) {
      if (idxSearch === idxRef) {
        resultados.push({ tieneRevision: true, tipo: 'Anual' });
      }
    }

    // Trimestral: mesRef +3, +6, +9 (excluyendo el propio mesRef que ya es Anual)
    if (periodicidad.includes('Trimestral') && mesRef) {
      const trimestres = [3, 6, 9].map(offset => (idxRef + offset) % 12);
      if (trimestres.includes(idxSearch)) {
        resultados.push({ tieneRevision: true, tipo: 'Trimestral' });
      }
    }

    if (resultados.length > 0) {
      const prioridad = resultados.find(r => r.tipo === 'Anual') || 
                        resultados.find(r => r.tipo === 'Trimestral') || 
                        resultados.find(r => r.tipo === 'Mensual');
      if (prioridad) return prioridad;
    }

    return null;
  };

  // Centros con revisión en el mes buscado, excluyendo los ya usados (arrastrados al calendario)
  const centrosConRevision = searchMonth
    ? centros
        .filter(c => {
          const info = getCentroRevisionInfo(c, searchMonth);
          return info && info.tieneRevision && !usedCentroIds.includes(c.id);
        })
        .map(c => {
          const info = getCentroRevisionInfo(c, searchMonth)!;
          const cli = clientes.find(cl => cl.id === c.clienteId);
          return { centro: c, cliente: cli, revisionType: info.tipo as 'Anual' | 'Trimestral' | 'Mensual', mesTexto: searchMonth };
        })
        .sort((a, b) => {
          const order = { Anual: 0, Trimestral: 1, Mensual: 2 };
          return (order[a.revisionType] || 99) - (order[b.revisionType] || 99);
        })
    : [];

  const savePartes = (updatedPartes: Parte[]) => {
    setPartes(updatedPartes);
    localStorage.setItem('firecheck_db_partes', JSON.stringify(updatedPartes));
  };

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = startDayOffset - 1; i >= 0; i--) days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), currentMonth: false });
    for (let i = 1; i <= daysInMonth; i++) days.push({ date: new Date(year, month, i), currentMonth: true });
    while (days.length < 42) days.push({ date: new Date(year, month + 1, days.length - (startDayOffset + daysInMonth) + 1), currentMonth: false });
    return days;
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const onDragStart = (e: React.DragEvent, parteId: string) => {
    e.dataTransfer.setData('parteId', parteId);
    e.dataTransfer.setData('dragType', 'parte');
  };
  const onDragStartCentro = (e: React.DragEvent, centroId: string, revisionType: string) => {
    e.dataTransfer.setData('centroId', centroId);
    e.dataTransfer.setData('revisionType', revisionType);
    e.dataTransfer.setData('dragType', 'centro');
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const dragType = e.dataTransfer.getData('dragType');
    if (dragType === 'centro') {
      const centroId = e.dataTransfer.getData('centroId');
      const revisionType = e.dataTransfer.getData('revisionType');
      const centro = centros.find(c => c.id === centroId);
      if (!centro) return;
      const newParte: Parte = {
        id: `PARTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        centroId: centro.id,
        clienteId: centro.clienteId || '',
        fechaCreacion: new Date().toISOString(),
        tecnicoId: tecnicos.length > 0 ? tecnicos[0].id : '',
        periodicidad: revisionType,
        mesesRevision: (centro.mesesRevision || []).join(', '),
        estado: 'Planificado',
        fechaProgramada: dateStr,
      };
      const updated = [...partes, newParte];
      savePartes(updated);
      // Mark this centro as used so it can only be dragged once
      setUsedCentroIds(prev => [...prev, centroId]);
    } else {
      const parteId = e.dataTransfer.getData('parteId');
      const updated = partes.map(p => p.id === parteId ? { ...p, fechaProgramada: dateStr } : p);
      savePartes(updated);
    }
  };

  const getRevisionBadge = (type: string) => {
    switch (type) {
      case 'Anual':
        return { color: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Revisión Anual', icon: CheckCheck };
      case 'Trimestral':
        return { color: 'bg-sky-100 text-sky-800 border-sky-200', label: 'Revisión Trimestral', icon: AlertTriangle };
      case 'Mensual':
        return { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Revisión Mensual', icon: Calendar };
      default:
        return { color: 'bg-zinc-100 text-zinc-600 border-zinc-200', label: type, icon: FileText };
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/')} className="p-2 bg-white rounded-full border border-sky-100 hover:bg-sky-50 text-sky-600 transition-colors shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-sky-950 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-sky-500" /> Planificación
          </h1>
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 cursor-pointer select-none shrink-0 ml-auto">
            <span className="text-[10px]">Fines de semana</span>
            <div
              onClick={() => setShowWeekends(!showWeekends)}
              className={`relative w-9 h-5 rounded-full transition-all cursor-pointer ${showWeekends ? 'bg-sky-500' : 'bg-zinc-300'}`}
            >
              <div className={`absolute w-3.5 h-3.5 bg-white rounded-full top-0.5 transition-all shadow-sm ${showWeekends ? 'left-[18px]' : 'left-[3px]'}`} />
            </div>
          </label>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-180px)]">
          {/* BARRA LATERAL IZQUIERDA */}
          <div className="w-full lg:w-80 bg-white rounded-3xl p-6 shadow-xl border border-sky-100 flex flex-col shrink-0 h-[400px] lg:h-full">
            {/* FILTRO DE BÚSQUEDA POR MES */}
            <div className="mb-5">
              <div className="relative">
                <select
                  value={searchMonth}
                  onChange={e => setSearchMonth(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-zinc-900"
                >
                  <option value="">-- Seleccionar mes --</option>
                  {MESES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* RESULTADOS DE BÚSQUEDA */}
            {searchMonth && (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3">
                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                  {centrosConRevision.length === 0 ? (
                    <div className="text-center py-6 bg-zinc-50 rounded-xl border border-zinc-100">
                      <Calendar className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                      <p className="text-sm text-zinc-400">No hay centros pendientes de programar en {searchMonth.toLowerCase()}</p>
                    </div>
                  ) : (
                    centrosConRevision.map(({ centro, cliente, revisionType }) => {
                      const badge = getRevisionBadge(revisionType);
                      const BadgeIcon = badge.icon;
                      return (
                        <div key={centro.id} draggable onDragStart={(e) => onDragStartCentro(e, centro.id, revisionType)} className="p-3.5 bg-white border-2 border-sky-300 rounded-2xl shadow-md hover:shadow-xl transition-all cursor-grab active:cursor-grabbing">
                          <div className="flex flex-col gap-2 mb-3">
                            <span className={`w-fit px-2 py-1 text-[10px] font-bold rounded-full border ${badge.color} flex items-center gap-1`}>
                              <BadgeIcon className="w-3 h-3" /> {badge.label}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-zinc-900 text-sm truncate">{centro.nombre}</p>
                              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{centro.id}</p>
                            </div>
                          </div>
                          {cliente && (
                            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                              <Building2 className="w-3 h-3" /> {cliente.nombre}
                            </p>
                          )}
                          {centro.direccion && (
                            <p className="text-xs text-zinc-400 mt-1 truncate">{centro.direccion}, {centro.poblacion || ''}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CALENDARIO */}
          <div className="flex-1 bg-white rounded-3xl shadow-xl border border-sky-100 flex flex-col overflow-hidden h-[600px] lg:h-full">
            <div className="p-6 border-b border-sky-50 flex items-center justify-between bg-sky-50/20">
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-white rounded-full transition-all border border-transparent hover:border-sky-100"><ChevronLeft/></button>
                <h2 className="text-lg md:text-xl font-bold text-sky-950 min-w-[120px] md:min-w-[150px] text-center capitalize">
                  {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(currentDate)}
                </h2>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-white rounded-full transition-all border border-transparent hover:border-sky-100"><ChevronRight/></button>
              </div>
              <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} w-full max-w-xl text-center text-[10px] md:text-xs font-bold text-sky-400 ml-4`}>
                {showWeekends
                  ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d}>{d}</div>)
                  : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map(d => <div key={d}>{d}</div>)
                }
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto ${showWeekends ? 'grid grid-cols-7' : 'grid grid-cols-5'}`}>
              {getCalendarDays()
                .filter(({ date }) => showWeekends || (date.getDay() !== 0 && date.getDay() !== 6))
                .map(({ date, currentMonth }, idx) => {
                const dateStr = formatDate(date);
                return (
                  <div key={dateStr + idx} onDragOver={onDragOver} onDrop={(e) => onDrop(e, dateStr)} className={`min-h-[80px] md:min-h-[100px] p-1 md:p-2 border border-sky-50 flex flex-col ${currentMonth ? 'bg-white' : 'bg-zinc-50/50 opacity-40'}`}>
                    <span className="text-xs font-bold text-zinc-400 mb-1">{date.getDate()}</span>
                    <div className="flex-1 space-y-1">
                      {partes.filter(p => p.fechaProgramada === dateStr).map(p => {
                        const centro = centros.find(c => c.id === p.centroId);
                        return (
                          <div key={p.id} className="group relative">
                            <div draggable onDragStart={(e) => onDragStart(e, p.id)} className="p-1 bg-sky-100 rounded text-[9px] text-sky-800 font-bold truncate cursor-grab active:cursor-grabbing shadow-sm hover:bg-sky-200 transition-colors">
                              {centro?.nombre || '...'}
                            </div>
                            <button
                              onClick={() => {
                                const updated = partes.map(part => part.id === p.id ? { ...part, fechaProgramada: undefined } : part);
                                savePartes(updated);
                                // Allow centro to appear again in search results
                                if (p.centroId) {
                                  setUsedCentroIds(prev => prev.filter(id => id !== p.centroId));
                                }
                              }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                              title="Quitar del calendario y volver a la barra"
                            >
                              <span className="text-[8px] font-bold leading-none">×</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}