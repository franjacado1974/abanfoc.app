import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Printer } from 'lucide-react';
import type { VacacionSolicitud } from '../firebase';

interface CalendarioLaboralProps {
  workerName: string;
  vacacionesAprobadas: VacacionSolicitud[];
}

type DayCategory = 'festivo' | 'puente' | 'vacaciones' | 'fin_semana' | 'jornada_reducida';

interface MarkedDay {
  day: number;
  category: DayCategory;
  label: string;
}

const MESES_UPPER = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Calcula el domingo de Pascua (algoritmo gregoriano anónimo) para adaptar Viernes Santo y Lunes de Pascua a cualquier año. */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Marzo, 4=Abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const BARCELONA_FESTIVOS_OFICIALES: Record<number, { m: number; d: number; label: string }[]> = {
  2025: [
    { m: 1, d: 1, label: 'Año nuevo' },
    { m: 1, d: 6, label: 'Reyes' },
    { m: 4, d: 18, label: 'Viernes santo' },
    { m: 4, d: 21, label: 'Lunes de pascua' },
    { m: 5, d: 1, label: 'Día del trabajador' },
    { m: 6, d: 9, label: 'Segunda pascua' },
    { m: 6, d: 24, label: 'Sant Joan' },
    { m: 8, d: 15, label: 'Sta. Asunción' },
    { m: 9, d: 11, label: 'Diada Catalunya' },
    { m: 9, d: 24, label: 'Mare de Déu de la Mercè' },
    { m: 10, d: 12, label: 'La Hispanidad' },
    { m: 11, d: 1, label: 'Todos los santos' },
    { m: 12, d: 6, label: 'La Constitución' },
    { m: 12, d: 8, label: 'La Purísima Inmaculada' },
    { m: 12, d: 25, label: 'Navidad' },
    { m: 12, d: 26, label: 'San Esteban' }
  ],
  2026: [
    { m: 1, d: 1, label: 'Año nuevo' },
    { m: 1, d: 6, label: 'Reyes' },
    { m: 4, d: 3, label: 'Viernes santo' },
    { m: 4, d: 6, label: 'Lunes de pascua' },
    { m: 5, d: 1, label: 'Día del trabajador' },
    { m: 5, d: 25, label: 'Segunda pascua' },
    { m: 6, d: 24, label: 'Sant Joan' },
    { m: 8, d: 15, label: 'Sta. Asunción' },
    { m: 9, d: 11, label: 'Diada Catalunya' },
    { m: 9, d: 24, label: 'Mare de Déu de la Mercè' },
    { m: 10, d: 12, label: 'La Hispanidad' },
    { m: 11, d: 1, label: 'Todos los santos' },
    { m: 12, d: 6, label: 'La Constitución' },
    { m: 12, d: 8, label: 'La Purísima Inmaculada' },
    { m: 12, d: 25, label: 'Navidad' },
    { m: 12, d: 26, label: 'San Esteban' }
  ],
  2027: [
    { m: 1, d: 1, label: 'Año nuevo' },
    { m: 1, d: 6, label: 'Reyes' },
    { m: 3, d: 26, label: 'Viernes santo' },
    { m: 3, d: 29, label: 'Lunes de pascua' },
    { m: 5, d: 1, label: 'Día del trabajador' },
    { m: 5, d: 17, label: 'Segunda pascua' },
    { m: 6, d: 24, label: 'Sant Joan' },
    { m: 9, d: 11, label: 'Diada Catalunya' },
    { m: 9, d: 24, label: 'Mare de Déu de la Mercè' },
    { m: 10, d: 12, label: 'La Hispanidad' },
    { m: 11, d: 1, label: 'Todos los santos' },
    { m: 12, d: 6, label: 'La Constitución' },
    { m: 12, d: 8, label: 'La Purísima Inmaculada' },
    { m: 12, d: 25, label: 'Navidad' }
  ]
};

function getDefaultFestivosForYear(year: number): Record<string, { category: DayCategory; label: string }> {
  const map: Record<string, { category: DayCategory; label: string }> = {};
  const add = (m: number, d: number, label: string, category: DayCategory = 'festivo') => {
    const key = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    map[key] = { category, label };
  };

  const oficial = BARCELONA_FESTIVOS_OFICIALES[year];
  if (oficial) {
    oficial.forEach((f) => add(f.m, f.d, f.label));
    return map;
  }

  // Fallback automático para años futuros según festivos fijos + Pascua de Barcelona / Cataluña
  add(1, 1, 'Año nuevo');
  add(1, 6, 'Reyes');
  add(5, 1, 'Día del trabajador');
  add(6, 24, 'Sant Joan');
  add(8, 15, 'Sta. Asunción');
  add(9, 11, 'Diada Catalunya');
  add(9, 24, 'Mare de Déu de la Mercè');
  add(10, 12, 'La Hispanidad');
  add(11, 1, 'Todos los santos');
  add(12, 6, 'La Constitución');
  add(12, 8, 'La Purísima Inmaculada');
  add(12, 25, 'Navidad');
  add(12, 26, 'San Esteban');

  // Festivos móviles ligados a Pascua (Viernes Santo, Lunes de Pascua, Segunda Pascua)
  const easter = getEasterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  const pentecostMonday = new Date(easter);
  pentecostMonday.setDate(easter.getDate() + 50);

  map[toIsoDate(goodFriday)] = { category: 'festivo', label: 'Viernes santo' };
  map[toIsoDate(easterMonday)] = { category: 'festivo', label: 'Lunes de pascua' };
  map[toIsoDate(pentecostMonday)] = { category: 'festivo', label: 'Segunda pascua' };

  return map;
}

const CATEGORY_CELL_CLASS: Record<DayCategory, string> = {
  festivo: 'bg-[#eab308] text-slate-950 font-extrabold',
  puente: 'bg-[#b91c1c] text-white font-extrabold',
  vacaciones: 'bg-[#65a30d] text-white font-extrabold',
  fin_semana: 'bg-[#a3a3a3] text-slate-900',
  jornada_reducida: 'bg-[#6495b5] text-slate-950 font-semibold'
};

const CATEGORY_BADGE_CLASS: Record<DayCategory, string> = {
  festivo: 'bg-[#eab308] text-slate-950',
  puente: 'bg-[#b91c1c] text-white',
  vacaciones: 'bg-[#65a30d] text-white',
  fin_semana: 'bg-[#a3a3a3] text-slate-900',
  jornada_reducida: 'bg-[#6495b5] text-white'
};

export default function CalendarioLaboral({ workerName, vacacionesAprobadas }: CalendarioLaboralProps) {
  const [year, setYear] = useState<number>(() => new Date().getFullYear());

  const { dayEventsByIso } = useMemo(() => {
    const events: Record<string, { category: DayCategory; label: string }> = getDefaultFestivosForYear(year);

    // Superponer vacaciones / festivos / puentes aprobados por Super Administrador
    vacacionesAprobadas.forEach((sol) => {
      if (sol.estado !== 'aprobada' || !sol.fechaInicio) return;
      const start = new Date(`${sol.fechaInicio}T00:00:00`);
      const end = new Date(`${(sol.fechaFin || sol.fechaInicio)}T00:00:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

      const cur = new Date(start);
      while (cur <= end) {
        if (cur.getFullYear() === year) {
          const iso = toIsoDate(cur);
          const wd = cur.getDay(); // 0=Dom, 6=Sab
          if (sol.tipo === 'vacaciones') {
            if (wd !== 0 && wd !== 6 && !events[iso]) {
              events[iso] = {
                category: 'vacaciones',
                label: sol.motivo?.trim() ? `Vacaciones (${sol.usuarioNombre}): ${sol.motivo}` : `Vacaciones (${sol.usuarioNombre})`
              };
            }
          } else {
            events[iso] = {
              category: sol.tipo === 'puente' ? 'puente' : 'festivo',
              label: sol.motivo?.trim() || (sol.tipo === 'puente' ? 'Puente' : 'Festivo')
            };
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    });

    return { dayEventsByIso: events };
  }, [year, vacacionesAprobadas]);

  const monthsData = useMemo(() => {
    return MESES_UPPER.map((monthName, monthIdx) => {
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      const firstJsDay = new Date(year, monthIdx, 1).getDay(); // 0=Dom..6=Sab
      const leadingEmpty = (firstJsDay + 6) % 7; // Lunes=0..Domingo=6

      const cells: { day: number | null; category: DayCategory | null; title?: string }[] = [];
      for (let i = 0; i < leadingEmpty; i++) {
        cells.push({ day: null, category: null });
      }

      let workingDays = 0;
      const markedList: MarkedDay[] = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(year, monthIdx, d);
        const jsDay = dt.getDay();
        const iso = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const customEvent = dayEventsByIso[iso];

        let category: DayCategory | null = null;
        if (customEvent) {
          category = customEvent.category;
          markedList.push({ day: d, category: customEvent.category, label: customEvent.label });
        } else if (jsDay === 0 || jsDay === 6) {
          category = 'fin_semana';
        } else if (jsDay === 5) {
          category = 'jornada_reducida';
          workingDays += 1;
        } else {
          workingDays += 1;
        }

        cells.push({
          day: d,
          category,
          title: customEvent?.label
        });
      }

      while (cells.length % 7 !== 0) {
        cells.push({ day: null, category: null });
      }

      return {
        monthName,
        workingDays,
        cells,
        markedList
      };
    });
  }, [year, dayEventsByIso]);

  return (
    <div className="max-w-[95%] mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 space-y-3.5">
      {/* Cabecera corporativa estilo hoja anual */}
      <div className="flex flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#881322] text-white flex items-center justify-center font-black text-base sm:text-lg shadow-xs shrink-0">
            A
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-[22px] font-black tracking-tight text-slate-900 leading-none">
              ABANFOC
            </div>
            <div className="text-[9px] sm:text-[10px] font-bold tracking-widest text-slate-600 uppercase mt-0.5 truncate">
              PROTECCIÓN CONTRA INCENDIOS
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:block text-xs sm:text-sm text-slate-700">
            Trabajador: <strong className="text-slate-950">{workerName || 'Usuario'}</strong>
          </div>
          <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1 print:hidden">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="p-1 rounded hover:bg-white text-slate-700 cursor-pointer"
              title="Año anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-black text-slate-900">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="p-1 rounded hover:bg-white text-slate-700 cursor-pointer"
              title="Año siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Leyenda de colores */}
      {(() => {
        const leyendaItems = [
          { label: 'Festivo', cls: 'bg-[#eab308]' },
          { label: 'Puente', cls: 'bg-[#b91c1c]' },
          { label: 'Vacaciones', cls: 'bg-[#65a30d]' },
          { label: 'Fin de semana', cls: 'bg-[#a3a3a3]' },
          { label: 'Jornada reducida', cls: 'bg-[#6495b5]' }
        ];
        return (
          <>
            <div className="flex md:hidden flex-nowrap items-center justify-between sm:justify-center gap-x-2.5 sm:gap-x-5 px-1 overflow-x-auto scrollbar-none">
              {leyendaItems.map((item) => (
                <div key={item.label} className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">
                  <span className={`w-3 h-3 border border-slate-400/70 inline-block shrink-0 ${item.cls}`} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="hidden md:flex flex-nowrap items-center justify-center gap-x-10 px-1">
              {leyendaItems.map((item) => (
                <div key={item.label} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">
                  <span className={`w-3.5 h-3.5 border border-slate-400/70 inline-block shrink-0 ${item.cls}`} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* Banda granate título del año */}
      <div className="bg-[#881322] text-white px-4 py-1.5 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <span className="font-black text-sm tracking-wide uppercase">
          CALENDARIO LABORAL AÑO {year}
        </span>
        <a
          href="https://ajuntament.barcelona.cat/calendarifestius/es/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-white/90 hover:text-white underline-offset-2 hover:underline"
        >
          <span>info: https://ajuntament.barcelona.cat/calendarifestius/es/</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Cuadrícula de 12 meses (3 filas de 4 meses en escritorio) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {monthsData.map((m) => (
          <div key={m.monthName} className="flex flex-col">
            <div className="flex items-baseline justify-center gap-2 mb-1">
              <span className="text-sm font-black tracking-wide text-slate-900">{m.monthName}</span>
              <span className="text-xs font-bold text-slate-500" title="Días laborables">
                {m.workingDays}
              </span>
            </div>

            <div className="border border-slate-700 overflow-hidden rounded-sm">
              <div className="grid grid-cols-7 bg-slate-950 text-white text-[11px] font-black text-center">
                {WEEKDAYS_SHORT.map((wd, idx) => (
                  <div key={idx} className="py-1 border-r last:border-r-0 border-slate-700">
                    {wd}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 text-xs text-center">
                {m.cells.map((cell, idx) => (
                  <div
                    key={idx}
                    title={cell.title}
                    className={`h-[30px] flex items-center justify-center border-t border-r [&:nth-child(7n)]:border-r-0 border-slate-300 ${
                      cell.day === null
                        ? 'bg-slate-50 text-transparent'
                        : cell.category
                        ? CATEGORY_CELL_CLASS[cell.category]
                        : 'bg-white text-slate-900 font-medium'
                    }`}
                  >
                    {cell.day ?? ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Lista de festivos / vacaciones del mes */}
            {m.markedList.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {m.markedList.map((ev, i) => (
                  <div key={`${ev.day}-${i}`} className="flex items-start gap-1.5 text-[11px] leading-tight">
                    <span
                      className={`inline-flex items-center justify-center min-w-[19px] h-[17px] px-1 rounded-[2px] font-bold border border-slate-400/60 shrink-0 ${CATEGORY_BADGE_CLASS[ev.category]}`}
                    >
                      {ev.day}
                    </span>
                    <span className="text-slate-700 font-medium truncate" title={ev.label}>
                      {ev.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
