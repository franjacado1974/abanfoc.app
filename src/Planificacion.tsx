import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Building2, FileText, AlertTriangle, CheckCheck, MapPin } from 'lucide-react';
import { addParte, updateParte, subscribePartes } from './firebase';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }
};

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
  empresaId?: string;
  observacionesTecnico?: string;
  comentariosPrivados?: string;
}


export default function Planificacion() {
  const [partes, setPartes] = useState<Parte[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchMonth, setSearchMonth] = useState('');
  const [showWeekends, setShowWeekends] = useState(true);


  useEffect(() => {
    const safeParse = (key: string) => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(data) ? data : [];
      } catch (e) { return []; }
    };

    try {
      setTecnicos(safeParse('firecheck_db_tecnicos'));
      setCentros(safeParse('firecheck_db_centros'));
      setClientes(safeParse('firecheck_db_clientes'));
    } catch (e) { console.error("Error loading data:", e); }
  }, []);

  // Suscripción en tiempo real a Firestore (colección "partes")
  useEffect(() => {
    const unsub = subscribePartes((items) => {
      const mapped = items.map((d: any) => ({ ...d })) as Parte[];
      setPartes(mapped);
      localStorage.setItem('firecheck_db_partes', JSON.stringify(mapped));
    });
    return () => unsub();
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

  const isRevisionScheduled = (centroId: string, revisionType: string, mesNombre: string, year: number): boolean => {
    return partes.some(p => {
      if (p.centroId !== centroId) return false;
      if (p.periodicidad !== revisionType) return false;
      if (!p.fechaProgramada) return false;
      
      const parts = p.fechaProgramada.split('-');
      if (parts.length !== 3) return false;
      const pMonthIdx = parseInt(parts[1], 10) - 1;
      const pYear = parseInt(parts[2], 10);
      
      return MESES[pMonthIdx] === mesNombre && pYear === year;
    });
  };

  // Centros con revisión en el mes buscado, excluyendo los ya usados (arrastrados al calendario)
  const centrosConRevision = searchMonth
    ? centros
        .filter(c => {
          const info = getCentroRevisionInfo(c, searchMonth);
          const cId = c._docId || c.id;
          return info && info.tieneRevision && !isRevisionScheduled(cId, info.tipo, searchMonth, currentDate.getFullYear());
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
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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
  const onDrop = async (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const dragType = e.dataTransfer.getData('dragType');
    if (dragType === 'centro') {
      const centroId = e.dataTransfer.getData('centroId');
      const revisionType = e.dataTransfer.getData('revisionType');
      const centro = centros.find(c => c._docId === centroId || c.id === centroId);
      if (!centro) return;

      // Buscar observaciones del último parte del mismo centro para inicializar el nuevo parte con ellas
      let ultimaObs = '';
      if (partes && partes.length > 0) {
        const partesCentro = partes.filter(p => p.centroId === (centro._docId || centro.id));
        if (partesCentro.length > 0) {
          const ordenados = [...partesCentro].sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
          const conObs = ordenados.find(p => p.observacionesTecnico && p.observacionesTecnico.trim() !== '');
          if (conObs) {
            ultimaObs = conObs.observacionesTecnico || '';
          }
        }
      }

      const newParte = {
        id: `PARTE-${generateId().slice(0, 8).toUpperCase()}`,
        centroId: centro._docId || centro.id,
        nombreCentro: centro.nombre || '',
        clienteId: centro.clienteId || '',
        fechaCreacion: new Date().toISOString(),
        tecnicoId: centro.tecnicoId || (tecnicos.length > 0 ? tecnicos[0].id : ''),
        empresaId: centro.empresaId || '',
        periodicidad: revisionType,
        mesesRevision: (centro.mesesRevision || []).join(', '),
        estado: 'Planificado' as const,
        fechaProgramada: dateStr,
        observacionesTecnico: ultimaObs,
      };
      // Guardar en Firestore (la suscripción actualizará el estado local)
      try { await addParte(newParte as any); } catch (err) { console.error('Error creando parte en Firestore:', err); }
    } else {
      // Cambio de fecha: actualizar en Firestore
      const parteId = e.dataTransfer.getData('parteId');
      const parte = partes.find(p => p.id === parteId);
      if (!parte) return;
      const docId = (parte as any)._docId || parteId;
      try { await updateParte(docId, { fechaProgramada: dateStr }); } catch (err) { console.error('Error actualizando fecha en Firestore:', err); }
    }
  };

  const onDropSidebar = async (e: React.DragEvent) => {
    e.preventDefault();
    const dragType = e.dataTransfer.getData('dragType');
    if (dragType === 'parte') {
      const parteId = e.dataTransfer.getData('parteId');
      const parte = partes.find(p => p.id === parteId);
      if (!parte) return;
      const docId = (parte as any)._docId || parteId;
      try {
        await updateParte(docId, { fechaProgramada: '' });
      } catch (err) {
        console.error('Error al quitar del calendario desde barra:', err);
      }
    }
  };

  const getRevisionBadge = (type: string) => {
    switch (type) {
      case 'Anual':
        return { color: 'bg-amber-100 text-amber-900 border-amber-300', label: 'Revisión Anual', icon: CheckCheck };
      case 'Trimestral':
        return { color: 'bg-sky-100 text-sky-900 border-sky-300', label: 'Revisión Trimestral', icon: AlertTriangle };
      case 'Mensual':
        return { color: 'bg-emerald-100 text-emerald-900 border-emerald-300', label: 'Revisión Mensual', icon: Calendar };
      default:
        return { color: 'bg-zinc-100 text-zinc-700 border-zinc-300', label: type, icon: FileText };
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center sm:items-start text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
            <div>
              <h1 className="text-2xl font-black text-zinc-950 tracking-tight flex items-center justify-center sm:justify-start gap-2">
                Planificación de Revisiones
              </h1>
              <p className="text-xs font-semibold text-zinc-500 mt-1">Calendarización y asignación mensual de mantenimientos preventivos a técnicos.</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 cursor-pointer select-none shrink-0">
              <span className="text-[10px]">Mostrar fines de semana</span>
              <div
                onClick={() => setShowWeekends(!showWeekends)}
                className={`relative w-9 h-5 rounded-full transition-all cursor-pointer ${showWeekends ? 'bg-red-650' : 'bg-zinc-300'}`}
              >
                <div className={`absolute w-3.5 h-3.5 bg-white rounded-full top-0.5 transition-all shadow-sm ${showWeekends ? 'left-[18px]' : 'left-[3px]'}`} />
              </div>
            </label>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-180px)]">
          {/* BARRA LATERAL IZQUIERDA: Selector de Meses y Tareas a Planificar */}
          <div 
            onDragOver={onDragOver} 
            onDrop={onDropSidebar} 
            className="w-full lg:w-80 xl:w-88 bg-white rounded-3xl shadow-xl border border-zinc-200/85 flex flex-col overflow-hidden shrink-0 h-[500px] lg:h-full"
          >
            {/* Cabecera del panel lateral: alineada con la cabecera del calendario */}
            <div className="px-5 py-3.5 border-b border-zinc-300 flex items-center justify-between bg-zinc-200/90">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 leading-tight">
                    Tareas a Planificar
                  </h3>
                  <p className="text-[10px] font-semibold text-zinc-500 leading-none mt-0.5">
                    Arrastra centros al calendario
                  </p>
                </div>
              </div>

              {searchMonth && (
                <span 
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black shadow-xs ${
                    centrosConRevision.length > 0 
                      ? 'bg-red-600 text-white' 
                      : 'bg-emerald-600 text-white'
                  }`}
                  title={`${centrosConRevision.length} pendientes`}
                >
                  {centrosConRevision.length}
                </span>
              )}
            </div>

            {/* Selector de Mes con Toque de Color */}
            <div className="px-4 py-2.5 border-b border-zinc-300 bg-zinc-100 flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={searchMonth}
                  onChange={e => setSearchMonth(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-zinc-300 hover:border-red-400 focus:border-red-600 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all shadow-2xs cursor-pointer"
                >
                  <option value="">-- Seleccionar mes a revisar --</option>
                  {MESES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* LISTA VERTICAL DE TAREAS A PLANIFICAR */}
            <div className="flex-1 bg-slate-100/70 p-3.5 overflow-y-auto space-y-2.5">
              {!searchMonth ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-center mb-3 text-red-500">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-zinc-700">Selecciona un mes arriba</p>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-[210px]">
                    Elige el mes para ver los centros pendientes de programar este año.
                  </p>
                </div>
              ) : centrosConRevision.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm flex items-center justify-center mb-3 text-emerald-600">
                    <CheckCheck className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-emerald-800">¡Todo programado!</p>
                  <p className="text-[11px] text-emerald-600/80 mt-1 max-w-[210px]">
                    No quedan centros pendientes de programar en {searchMonth.toLowerCase()}.
                  </p>
                </div>
              ) : (
                centrosConRevision.map(({ centro, cliente, revisionType }) => {
                  const badge = getRevisionBadge(revisionType);
                  const BadgeIcon = badge.icon;
                  const isAnual = revisionType === 'Anual';
                  const isTrim = revisionType === 'Trimestral';

                  const cardAccent = isAnual
                    ? 'border-l-amber-500 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/20 border-amber-200/90 hover:border-amber-400 shadow-amber-500/5'
                    : isTrim
                    ? 'border-l-sky-500 bg-gradient-to-br from-sky-50/80 via-white to-sky-50/20 border-sky-200/90 hover:border-sky-400 shadow-sky-500/5'
                    : 'border-l-emerald-500 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/20 border-emerald-200/90 hover:border-emerald-400 shadow-emerald-500/5';

                  return (
                    <div 
                      key={centro._docId || centro.id} 
                      draggable 
                      onDragStart={(e) => onDragStartCentro(e, centro._docId || centro.id, revisionType)} 
                      className={`p-3 bg-white border border-l-4 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing select-none ${cardAccent}`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md border ${badge.color} inline-flex items-center gap-1 shadow-2xs`}>
                          <BadgeIcon className="w-3 h-3" /> {badge.label}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded border border-zinc-200/70 shadow-2xs">
                          {centro.customIdPart || centro.id}
                        </span>
                      </div>

                      <p className="font-extrabold text-zinc-900 text-xs truncate leading-snug">
                        {centro.nombre}
                      </p>

                      {cliente && (
                        <p className="text-[11px] font-medium text-zinc-600 flex items-center gap-1.5 mt-1 truncate">
                          <Building2 className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="truncate">{cliente.nombre}</span>
                        </p>
                      )}

                      {(centro.poblacion || centro.localidad || centro.direccion) && (
                        <p className="text-[10px] font-normal text-zinc-400 mt-1 truncate flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                          <span className="truncate">{[centro.direccion, centro.poblacion || centro.localidad].filter(Boolean).join(', ')}</span>
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

            {/* CALENDARIO */}
          <div className="flex-1 bg-white rounded-3xl shadow-xl border border-zinc-200/85 flex flex-col overflow-hidden h-[600px] lg:h-full">
            {/* Navegación del mes */}
            <div className="px-6 py-3.5 border-b border-zinc-300 flex items-center justify-center gap-4 bg-zinc-200/90">
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} 
                className="p-1.5 hover:bg-white text-zinc-700 hover:text-zinc-950 rounded-full transition-all border border-transparent hover:border-zinc-300 cursor-pointer shadow-2xs"
                title="Mes anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base md:text-lg font-black text-zinc-800 min-w-[140px] md:min-w-[180px] text-center capitalize tracking-tight select-none">
                {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(currentDate)}
              </h2>
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} 
                className="p-1.5 hover:bg-white text-zinc-700 hover:text-zinc-950 rounded-full transition-all border border-transparent hover:border-zinc-300 cursor-pointer shadow-2xs"
                title="Mes siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            {/* Encabezados de días de la semana - alineados con las columnas del calendario */}
            <div className={`px-2 border-b border-zinc-300 bg-zinc-100 ${showWeekends ? 'grid grid-cols-7' : 'grid grid-cols-5'}`}>
              {(showWeekends
                ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
                : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
              ).map(d => (
                <div key={d} className="py-2.5 text-center text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                  {d}
                </div>
              ))}
            </div>
            <div className={`flex-1 overflow-y-auto px-2 ${showWeekends ? 'grid grid-cols-7' : 'grid grid-cols-5'}`}>
              {getCalendarDays()
                .filter(({ date }) => showWeekends || (date.getDay() !== 0 && date.getDay() !== 6))
                .map(({ date, currentMonth }, idx) => {
                const dateStr = formatDate(date);
                return (
                  <div key={dateStr + idx} onDragOver={onDragOver} onDrop={(e) => onDrop(e, dateStr)} className={`min-h-[80px] md:min-h-[100px] p-1 md:p-2 border border-zinc-100 flex flex-col ${currentMonth ? 'bg-amber-50/20' : 'bg-white opacity-40'}`}>
                    <span className="text-xs font-bold text-zinc-400 mb-1">{date.getDate()}</span>
                    <div className="flex-1 space-y-1">
                      {partes.filter(p => p.fechaProgramada === dateStr && p.estado !== 'Cerrado').map(p => {
                        const centro = centros.find(c => c._docId === p.centroId || c.id === p.centroId);
                        return (
                          <div key={p.id} className="group relative">
                            <div draggable onDragStart={(e) => onDragStart(e, p.id)} className="p-1 bg-sky-100 rounded text-[9px] text-sky-800 font-bold truncate cursor-grab active:cursor-grabbing shadow-sm hover:bg-sky-200 transition-colors">
                              {centro?.nombre || '...'}
                            </div>
                            <button
                              onClick={async () => {
                                const docId = (p as any)._docId || p.id;
                                try { await updateParte(docId, { fechaProgramada: '' }); } catch (err) { console.error(err); }
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
