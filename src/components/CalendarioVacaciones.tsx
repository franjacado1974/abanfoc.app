import { useMemo, useState } from 'react';
import {
  CalendarPlus,
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import {
  addVacacionSolicitud,
  updateVacacionSolicitud,
  deleteVacacionSolicitud,
  type VacacionSolicitud
} from '../firebase';

export function SombrillaIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2v2" />
      <path d="M3 13a9 9 0 0 1 18 0Z" />
      <path d="M8.5 13a10 10 0 0 1 3.5-9 10 10 0 0 1 3.5 9" />
      <path d="M12 13v8" />
      <path d="M8 21h8" />
    </svg>
  );
}

interface CalendarioVacacionesProps {
  user?: { id?: string; nombre: string; apellidos?: string; rol?: string; usuario?: string } | null;
  solicitudes: VacacionSolicitud[];
  isSuperAdmin: boolean;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function formatFechaEs(iso: string): string {
  if (!iso || iso.length < 10) return iso || '—';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export default function CalendarioVacaciones({
  user,
  solicitudes,
  isSuperAdmin
}: CalendarioVacacionesProps) {
  const hoy = new Date();
  const [mes, setMes] = useState<number>(hoy.getMonth());
  const [anio, setAnio] = useState<number>(hoy.getFullYear());

  const [tipo, setTipo] = useState<'vacaciones' | 'festivo' | 'puente'>('vacaciones');
  const [fechaInicio, setFechaInicio] = useState<string>(() => hoy.toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState<string>(() => hoy.toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');

  const fullUserName = [user?.nombre, user?.apellidos].filter(Boolean).join(' ').trim() || user?.usuario || 'Usuario';

  const pendientes = useMemo(
    () => solicitudes.filter((s) => s.estado === 'pendiente'),
    [solicitudes]
  );

  const aprobadas = useMemo(
    () => solicitudes.filter((s) => s.estado === 'aprobada'),
    [solicitudes]
  );

  const misSolicitudes = useMemo(
    () =>
      solicitudes
        .filter((s) => (user?.id ? s.usuarioId === user.id : s.usuarioNombre === fullUserName))
        .sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || '')),
    [solicitudes, user?.id, fullUserName]
  );

  const handleEnviarSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaInicio) return;
    const end = fechaFin && fechaFin >= fechaInicio ? fechaFin : fechaInicio;
    setIsSubmitting(true);
    setFeedback('');
    try {
      await addVacacionSolicitud({
        usuarioId: user?.id || '',
        usuarioNombre: fullUserName,
        tipo,
        fechaInicio,
        fechaFin: end,
        motivo: motivo.trim(),
        estado: 'pendiente'
      });
      setMotivo('');
      setFeedback('Solicitud enviada. Pendiente de aprobación por el Super Administrador.');
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      console.error('Error enviando solicitud:', err);
      setFeedback('Error al enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolver = async (sol: VacacionSolicitud, estado: 'aprobada' | 'rechazada') => {
    const id = sol._docId || sol.id;
    if (!id) return;
    await updateVacacionSolicitud(id, {
      estado,
      aprobadoPor: fullUserName,
      fechaResolucion: new Date().toISOString()
    });
  };

  const handleEliminar = async (sol: VacacionSolicitud) => {
    const id = sol._docId || sol.id;
    if (!id) return;
    await deleteVacacionSolicitud(id);
  };

  // Días del mes actual para el calendario visual de vacaciones publicadas
  const calendarDays = useMemo(() => {
    const totalDays = new Date(anio, mes + 1, 0).getDate();
    const firstDay = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const cells: { day: number | null; iso: string; items: VacacionSolicitud[] }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, iso: '', items: [] });

    for (let d = 1; d <= totalDays; d++) {
      const iso = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const items = aprobadas.filter((s) => s.fechaInicio <= iso && (s.fechaFin || s.fechaInicio) >= iso);
      cells.push({ day: d, iso, items });
    }
    return cells;
  }, [anio, mes, aprobadas]);

  const tipoBadge = (t: VacacionSolicitud['tipo']) => {
    if (t === 'festivo') return 'bg-amber-100 text-amber-800 border-amber-300';
    if (t === 'puente') return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  };

  const estadoBadge = (est: VacacionSolicitud['estado']) => {
    if (est === 'aprobada') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (est === 'rechazada') return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-amber-100 text-amber-800 border-amber-300';
  };

  return (
    <div className="space-y-4">
      {/* Panel exclusivo de aprobación para Super Administrador */}
      {isSuperAdmin && (
        <div className="bg-white border border-amber-200 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Solicitudes pendientes de aprobación ({pendientes.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Al aceptar, se publicará automáticamente en Vacaciones y Calendario Laboral
            </span>
          </div>

          {pendientes.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No hay solicitudes pendientes en este momento.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {pendientes.map((sol) => (
                <div
                  key={sol._docId || sol.id}
                  className="flex items-center justify-between gap-3 bg-amber-50/70 border border-amber-200 rounded-xl p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900">{sol.usuarioNombre}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${tipoBadge(sol.tipo)}`}>
                        {sol.tipo}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-700 mt-0.5">
                      {formatFechaEs(sol.fechaInicio)}
                      {sol.fechaFin && sol.fechaFin !== sol.fechaInicio ? ` → ${formatFechaEs(sol.fechaFin)}` : ''}
                    </div>
                    {sol.motivo && (
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate" title={sol.motivo}>
                        {sol.motivo}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleResolver(sol, 'aprobada')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolver(sol, 'rechazada')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna izquierda: Solicitar vacaciones / festivo + Mis solicitudes */}
        <div className="space-y-4">
          <form
            onSubmit={handleEnviarSolicitud}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-900">Solicitar fecha</h3>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'vacaciones' | 'festivo' | 'puente')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="vacaciones">Vacaciones</option>
                <option value="festivo">Día festivo</option>
                <option value="puente">Puente</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Desde</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => {
                    setFechaInicio(e.target.value);
                    if (fechaFin < e.target.value) setFechaFin(e.target.value);
                  }}
                  required
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Hasta</label>
                <input
                  type="date"
                  value={fechaFin}
                  min={fechaInicio}
                  onChange={(e) => setFechaFin(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Motivo / Descripción (opcional)
              </label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Vacaciones verano / Festivo local..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar solicitud al Super Administrador'}
            </button>

            {feedback && (
              <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                {feedback}
              </div>
            )}
          </form>

          {/* Mis solicitudes */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-2.5">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Mis solicitudes ({misSolicitudes.length})
            </h3>
            {misSolicitudes.length === 0 ? (
              <p className="text-xs text-slate-500">Aún no has enviado solicitudes.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {misSolicitudes.map((sol) => (
                  <div
                    key={sol._docId || sol.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${tipoBadge(sol.tipo)}`}>
                          {sol.tipo}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${estadoBadge(sol.estado)}`}>
                          {sol.estado === 'pendiente' && <Clock className="w-2.5 h-2.5" />}
                          {sol.estado === 'aprobada' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {sol.estado === 'rechazada' && <XCircle className="w-2.5 h-2.5" />}
                          {sol.estado}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-1">
                        {formatFechaEs(sol.fechaInicio)}
                        {sol.fechaFin && sol.fechaFin !== sol.fechaInicio ? ` → ${formatFechaEs(sol.fechaFin)}` : ''}
                      </div>
                      {sol.motivo && <div className="text-[11px] text-slate-600 truncate">{sol.motivo}</div>}
                    </div>
                    {(sol.estado === 'pendiente' || isSuperAdmin) && (
                      <button
                        type="button"
                        onClick={() => handleEliminar(sol)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                        title="Eliminar solicitud"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha (2/3): Calendario mensual publicado de Vacaciones y Festivos */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Calendario de Vacaciones y Días Publicados
              </h3>
              <p className="text-[11px] text-slate-500">
                Solo se muestran las solicitudes aceptadas por el Super Administrador.{' '}
                <a
                  href="https://ajuntament.barcelona.cat/calendarifestius/es/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#881322] font-bold hover:underline"
                >
                  <span>Consultar festivos Barcelona (ajuntament.barcelona.cat/calendarifestius/es/)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  if (mes === 0) {
                    setMes(11);
                    setAnio((a) => a - 1);
                  } else {
                    setMes((m) => m - 1);
                  }
                }}
                className="p-1 rounded hover:bg-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-black text-slate-900 min-w-[110px] text-center">
                {MESES[mes]} {anio}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (mes === 11) {
                    setMes(0);
                    setAnio((a) => a + 1);
                  } else {
                    setMes((m) => m + 1);
                  }
                }}
                className="p-1 rounded hover:bg-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black text-slate-600 uppercase">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="py-1 bg-slate-100 rounded">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((cell, idx) => (
              <div
                key={idx}
                className={`min-h-[125px] sm:min-h-[145px] p-1.5 rounded-lg border text-left flex flex-col ${
                  cell.day === null
                    ? 'bg-slate-50/50 border-slate-100'
                    : 'bg-white border-slate-200'
                }`}
              >
                {cell.day !== null && (
                  <>
                    <div className="text-xs font-bold text-slate-700 mb-1.5">{cell.day}</div>
                    <div className="space-y-1 flex-1">
                      {cell.items.map((item, i) => (
                        <div
                          key={`${item._docId || item.id}-${i}`}
                          title={`${item.usuarioNombre}: ${item.tipo}${item.motivo ? ` - ${item.motivo}` : ''}`}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate border ${tipoBadge(item.tipo)}`}
                        >
                          {item.usuarioNombre}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
