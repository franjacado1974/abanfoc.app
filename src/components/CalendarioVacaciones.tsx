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
  ExternalLink,
  Edit,
  Save
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

function SpanishDateSelect({
  value,
  onChange,
  minIso
}: {
  value: string;
  onChange: (nextIso: string) => void;
  minIso?: string;
}) {
  const nowYear = new Date().getFullYear();
  const [yStr, mStr, dStr] = (value || new Date().toISOString().slice(0, 10)).split('-');
  const y = Number(yStr) || nowYear;
  const m = Number(mStr) || 1;
  const d = Number(dStr) || 1;

  const daysInMonth = new Date(y, m, 0).getDate();
  const years = [nowYear - 1, nowYear, nowYear + 1, nowYear + 2];

  const emit = (ny: number, nm: number, nd: number) => {
    const maxD = new Date(ny, nm, 0).getDate();
    const clampedD = Math.min(nd, maxD);
    let next = `${ny}-${String(nm).padStart(2, '0')}-${String(clampedD).padStart(2, '0')}`;
    if (minIso && next < minIso) next = minIso;
    onChange(next);
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={Math.min(d, daysInMonth)}
        onChange={(e) => emit(y, m, Number(e.target.value))}
        aria-label="Día"
        className="w-12 px-1 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-center"
      >
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => (
          <option key={dayNum} value={dayNum}>
            {String(dayNum).padStart(2, '0')}
          </option>
        ))}
      </select>
      <span className="text-slate-400 text-xs font-bold">/</span>
      <select
        value={m}
        onChange={(e) => emit(y, Number(e.target.value), d)}
        aria-label="Mes"
        className="w-12 px-1 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-center"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((monthNum) => (
          <option key={monthNum} value={monthNum}>
            {String(monthNum).padStart(2, '0')}
          </option>
        ))}
      </select>
      <span className="text-slate-400 text-xs font-bold">/</span>
      <select
        value={y}
        onChange={(e) => emit(Number(e.target.value), m, d)}
        aria-label="Año"
        className="flex-1 min-w-[60px] px-1 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-center"
      >
        {years.map((yr) => (
          <option key={yr} value={yr}>
            {yr}
          </option>
        ))}
      </select>
    </div>
  );
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

  // Gestión exclusiva del Super Administrador (lista general, edición y eliminación)
  const [adminFilterEstado, setAdminFilterEstado] = useState<'todas' | 'pendiente' | 'aprobada' | 'rechazada'>('todas');
  const [editingSol, setEditingSol] = useState<VacacionSolicitud | null>(null);
  const [editTipo, setEditTipo] = useState<'vacaciones' | 'festivo' | 'puente'>('vacaciones');
  const [editInicio, setEditInicio] = useState<string>('');
  const [editFin, setEditFin] = useState<string>('');
  const [editMotivo, setEditMotivo] = useState<string>('');
  const [editEstado, setEditEstado] = useState<'pendiente' | 'aprobada' | 'rechazada'>('aprobada');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [confirmDeleteSol, setConfirmDeleteSol] = useState<VacacionSolicitud | null>(null);

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

  const handleOpenEdit = (sol: VacacionSolicitud) => {
    if (!isSuperAdmin) return;
    setEditingSol(sol);
    setEditTipo(sol.tipo || 'vacaciones');
    setEditInicio(sol.fechaInicio || new Date().toISOString().slice(0, 10));
    setEditFin(sol.fechaFin || sol.fechaInicio || new Date().toISOString().slice(0, 10));
    setEditMotivo(sol.motivo || '');
    setEditEstado(sol.estado || 'pendiente');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !editingSol) return;
    const id = editingSol._docId || editingSol.id;
    if (!id) return;
    setIsSavingEdit(true);
    try {
      const end = editFin && editFin >= editInicio ? editFin : editInicio;
      await updateVacacionSolicitud(id, {
        tipo: editTipo,
        fechaInicio: editInicio,
        fechaFin: end,
        motivo: editMotivo.trim(),
        estado: editEstado,
        aprobadoPor: fullUserName,
        fechaResolucion: new Date().toISOString()
      });
      setEditingSol(null);
    } catch (err) {
      console.error('Error editando solicitud:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const allSolicitudesAdmin = useMemo(() => {
    const sorted = [...solicitudes].sort((a, b) =>
      (b.fechaInicio || b.fechaCreacion || '').localeCompare(a.fechaInicio || a.fechaCreacion || '')
    );
    if (adminFilterEstado === 'todas') return sorted;
    return sorted.filter((s) => s.estado === adminFilterEstado);
  }, [solicitudes, adminFilterEstado]);

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

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Desde (DD/MM/AAAA)
                </label>
                <SpanishDateSelect
                  value={fechaInicio}
                  onChange={(nextIso) => {
                    setFechaInicio(nextIso);
                    if (fechaFin < nextIso) setFechaFin(nextIso);
                  }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Hasta (DD/MM/AAAA)
                </label>
                <SpanishDateSelect
                  value={fechaFin}
                  minIso={fechaInicio}
                  onChange={(nextIso) => setFechaFin(nextIso)}
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
                          onClick={() => isSuperAdmin && handleOpenEdit(item)}
                          title={
                            isSuperAdmin
                              ? `${item.usuarioNombre}: ${item.tipo}${item.motivo ? ` - ${item.motivo}` : ''} (Clic para editar o quitar)`
                              : `${item.usuarioNombre}: ${item.tipo}${item.motivo ? ` - ${item.motivo}` : ''}`
                          }
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate border ${tipoBadge(item.tipo)} ${
                            isSuperAdmin ? 'cursor-pointer hover:opacity-80' : ''
                          }`}
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

      {/* Lista general de solicitudes y vacaciones (solo Super Administrador) */}
      {isSuperAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-slate-900" />
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Gestión de Solicitudes y Vacaciones ({allSolicitudesAdmin.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Control exclusivo del Super Administrador para editar o eliminar vacaciones/festivos de cualquier usuario.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'todas', label: 'Todas' },
                  { id: 'pendiente', label: 'Pendientes' },
                  { id: 'aprobada', label: 'Aprobadas' },
                  { id: 'rechazada', label: 'Rechazadas' }
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAdminFilterEstado(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    adminFilterEstado === f.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {allSolicitudesAdmin.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No hay solicitudes en esta categoría.</p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Fechas</th>
                    <th className="py-2.5 px-3">Motivo</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allSolicitudesAdmin.map((sol) => (
                    <tr key={sol._docId || sol.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{sol.usuarioNombre}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${tipoBadge(sol.tipo)}`}>
                          {sol.tipo}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                        {formatFechaEs(sol.fechaInicio)}
                        {sol.fechaFin && sol.fechaFin !== sol.fechaInicio ? ` → ${formatFechaEs(sol.fechaFin)}` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={sol.motivo || ''}>
                        {sol.motivo || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${estadoBadge(sol.estado)}`}>
                          {sol.estado}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(sol)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold cursor-pointer"
                            title="Editar solicitud / fechas"
                          >
                            <Edit className="w-3 h-3" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSol(sol)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold cursor-pointer"
                            title="Eliminar solicitud / vacación"
                          >
                            <Trash2 className="w-3 h-3" />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Edición (solo Super Administrador) */}
      {isSuperAdmin && editingSol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide">Editar Vacación / Solicitud</h3>
                <p className="text-[11px] text-slate-300">{editingSol.usuarioNombre}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSol(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tipo</label>
                  <select
                    value={editTipo}
                    onChange={(e) => setEditTipo(e.target.value as 'vacaciones' | 'festivo' | 'puente')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="vacaciones">Vacaciones</option>
                    <option value="festivo">Día festivo</option>
                    <option value="puente">Puente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Estado</label>
                  <select
                    value={editEstado}
                    onChange={(e) => setEditEstado(e.target.value as 'pendiente' | 'aprobada' | 'rechazada')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="aprobada">Aprobada</option>
                    <option value="rechazada">Rechazada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Desde (DD/MM/AAAA)
                </label>
                <SpanishDateSelect
                  value={editInicio}
                  onChange={(nextIso) => {
                    setEditInicio(nextIso);
                    if (editFin < nextIso) setEditFin(nextIso);
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Hasta (DD/MM/AAAA)
                </label>
                <SpanishDateSelect
                  value={editFin}
                  minIso={editInicio}
                  onChange={(nextIso) => setEditFin(nextIso)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Motivo</label>
                <input
                  type="text"
                  value={editMotivo}
                  onChange={(e) => setEditMotivo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  placeholder="Motivo o comentario..."
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const sol = editingSol;
                    setEditingSol(null);
                    setConfirmDeleteSol(sol);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSol(null)}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSavingEdit ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación (solo Super Administrador) */}
      {isSuperAdmin && confirmDeleteSol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase">Eliminar vacación / solicitud</h3>
            <p className="text-xs text-slate-600">
              ¿Seguro que deseas eliminar las fechas de <strong>{confirmDeleteSol.usuarioNombre}</strong> (
              {formatFechaEs(confirmDeleteSol.fechaInicio)}
              {confirmDeleteSol.fechaFin && confirmDeleteSol.fechaFin !== confirmDeleteSol.fechaInicio
                ? ` → ${formatFechaEs(confirmDeleteSol.fechaFin)}`
                : ''}
              )? Se quitarán del Calendario de Vacaciones y del Calendario Laboral.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteSol(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleEliminar(confirmDeleteSol);
                  setConfirmDeleteSol(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
