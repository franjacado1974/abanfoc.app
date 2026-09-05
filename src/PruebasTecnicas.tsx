import { useState, useEffect, useMemo, useId } from 'react';
import { 
  Gauge, Droplets, Activity, ChevronRight, Info, ArrowLeft,
  CheckCircle2, AlertTriangle, Save, ShieldCheck, Flame, 
  Building2, Users, Calendar, Clock, FileDown, Wrench,
  History, Trash2, Search, X, FolderOpen
} from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, getDocs, getDoc } from 'firebase/firestore';
import { db, subscribeEmpresas, moverAPapelera } from './firebase';
import { APP_VERSION } from './constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchImageToBase64, optimizarImagenParaPDF, getImageFormat } from './pdfGenerator';

// ─── TIPOS Y NORMATIVA UNE / RIPCI ──────────────────────────────────────────
export type TipoEquipoMedir = 
  | 'bie25'
  | 'bie45'
  | 'hidrante45'
  | 'hidrante70'
  | 'hidrante100';

export interface ReferenciaNorma {
  id: TipoEquipoMedir;
  label: string;
  nombre: string;
  norma: string;
  presionMin: number; // bar
  presionMaxServicio: number; // bar
  presionMaxEstatica: number; // bar
  caudalMin1Eq: number; // l/min
  caudalMin2Eq: number; // l/min
  tiempoAutonomiaMin: number; // min
  descripcion: string;
}

export const REFERENCIAS_NORMATIVA: Record<TipoEquipoMedir, ReferenciaNorma> = {
  bie25: {
    id: 'bie25',
    label: 'Medición en red BIE 25 mm.',
    nombre: 'BIE 25 mm (Ø 25 mm)',
    norma: 'UNE 23500:2021 y Real Decreto 513/2017 de 22 de mayo',
    presionMin: 3.5, // bar en entrada del equipo (manómetro con flujo abierto)
    presionMaxServicio: 5.0, // bar
    presionMaxEstatica: 9.0, // bar
    caudalMin1Eq: 100, // l/min
    caudalMin2Eq: 200, // l/min (2 BIEs simultáneas)
    tiempoAutonomiaMin: 60, // 60 minutos
    descripcion: 'Manguera semirrígida de 25 mm. Caudal mínimo de 100 l/min a 3,5 bar a la entrada del equipo (UNE 23500:2021 / RD 513/2017).',
  },
  bie45: {
    id: 'bie45',
    label: 'Medición en red BIE 45 mm.',
    nombre: 'BIE 45 mm (Ø 45 mm)',
    norma: 'UNE 23500:2021 y Real Decreto 513/2017 de 22 de mayo',
    presionMin: 3.5, // bar en entrada del equipo (manómetro con flujo abierto)
    presionMaxServicio: 5.0, // bar
    presionMaxEstatica: 9.0, // bar
    caudalMin1Eq: 200, // l/min
    caudalMin2Eq: 400, // l/min (2 BIEs simultáneas)
    tiempoAutonomiaMin: 60, // 60 minutos
    descripcion: 'Manguera plana de 45 mm. Caudal mínimo de 200 l/min a 3,5 bar a la entrada del equipo (UNE 23500:2021 / RD 513/2017).',
  },
  hidrante45: {
    id: 'hidrante45',
    label: 'Medición en hidrante 45 mm.',
    nombre: 'Hidrante con salida 45 mm',
    norma: 'UNE 23407 / UNE-EN 14384 / RIPCI',
    presionMin: 5.0, // bar
    presionMaxServicio: 10.0, // bar
    presionMaxEstatica: 16.0, // bar
    caudalMin1Eq: 500, // l/min
    caudalMin2Eq: 1000, // l/min (2 bocas simultáneas)
    tiempoAutonomiaMin: 120, // 120 minutos
    descripcion: 'Boca de hidrante de 45 mm. Caudal mínimo de 500 l/min a 5 bar.',
  },
  hidrante70: {
    id: 'hidrante70',
    label: 'Medición en hidrante 70 mm.',
    nombre: 'Hidrante con salida 70 mm',
    norma: 'UNE 23407 / UNE-EN 14384 / RIPCI',
    presionMin: 7.0, // bar
    presionMaxServicio: 10.0, // bar
    presionMaxEstatica: 16.0, // bar
    caudalMin1Eq: 500, // l/min
    caudalMin2Eq: 1000, // l/min (2 bocas simultáneas)
    tiempoAutonomiaMin: 120, // 120 minutos
    descripcion: 'Boca de hidrante de 70 mm. Caudal mínimo de 500 l/min a 7 bar.',
  },
  hidrante100: {
    id: 'hidrante100',
    label: 'Medición en hidrante 100 mm.',
    nombre: 'Hidrante con salida 100 mm (Boca central)',
    norma: 'UNE 23407 / UNE-EN 14384 / RIPCI',
    presionMin: 7.0, // bar
    presionMaxServicio: 10.0, // bar
    presionMaxEstatica: 16.0, // bar
    caudalMin1Eq: 1000, // l/min
    caudalMin2Eq: 2000, // l/min (2 bocas simultáneas)
    tiempoAutonomiaMin: 120, // 120 minutos
    descripcion: 'Boca principal de 100 mm. Caudal nominal de 1000 l/min a 7 bar.',
  },
};

export interface EnsayoGuardado {
  id: string;
  tipo?: string;
  empresaMantenedora?: string;
  equipoMedicion?: string;
  tipoEquipo?: TipoEquipoMedir;
  equipoAMedirLabel?: string;
  normaAplicable?: string;
  clienteNombre?: string;
  centroNombre?: string;
  fechaEnsayo?: string;
  horaEnsayo?: string;
  tecnicoNombre?: string;
  presionEstatica?: number;
  prueba1?: {
    ubicacion?: string;
    presionDin?: number;
    caudal?: number;
    cumple?: boolean;
  };
  prueba2?: {
    ubicacion?: string;
    presionDin?: number;
    caudal?: number;
    caudalTotalSimultaneo?: number;
    cumple?: boolean;
  };
  variacion?: {
    caidaPresionBar?: number;
    variacionPorcentaje?: number;
    incrementoCaudal?: number;
  };
  evaluacionGlobal?: 'conforme' | 'no_conforme' | 'pendiente';
  observaciones?: string;
  createdAt?: string;
  versionApp?: string;
}

// ─── HELPER FORMATEO DE FECHA (DD/MM/YYYY) ──────────────────────────────────
export function formatFechaEnsayo(fechaStr?: string): string {
  if (!fechaStr) return '--';
  const parts = fechaStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return fechaStr;
}

// ─── COMPONENTE GRÁFICO CURVA DE PRESIÓN Y CAUDAL (P-Q) ─────────────────────
function GraficoCurvaPresionCaudal({
  presionEstatica,
  p1,
  q1,
  p2,
  q2,
  tipoEquipo,
}: {
  presionEstatica: number;
  p1: number;
  q1: number;
  p2: number;
  q2: number;
  tipoEquipo: TipoEquipoMedir;
}) {
  const norma = REFERENCIAS_NORMATIVA[tipoEquipo];
  const chartId = useId();

  // Dimensiones del gráfico SVG
  const width = 600;
  const height = 320;
  const margin = { top: 30, right: 40, bottom: 50, left: 60 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Escalas máximas
  const maxQ = useMemo(() => {
    const vals = [q1, q2, norma.caudalMin2Eq * 1.3, 300];
    if (tipoEquipo === 'bie45') vals.push(500);
    if (tipoEquipo.startsWith('hidrante')) vals.push(2200);
    return Math.max(...vals);
  }, [q1, q2, norma.caudalMin2Eq, tipoEquipo]);

  const maxP = useMemo(() => {
    const vals = [presionEstatica, p1, p2, norma.presionMaxEstatica, 9];
    return Math.max(...vals);
  }, [presionEstatica, p1, p2, norma.presionMaxEstatica]);

  // Funciones de proyección a coordenadas SVG
  const scaleX = (q: number) => margin.left + (q / maxQ) * innerWidth;
  const scaleY = (p: number) => margin.top + innerHeight - (p / maxP) * innerHeight;

  // Curva de presión hidráulica suave interpolada
  const pathD = useMemo(() => {
    if (presionEstatica <= 0) return '';
    const points: [number, number][] = [[0, presionEstatica]];

    if (q1 > 0 && p1 > 0) points.push([q1, p1]);
    if (q2 > 0 && p2 > 0) points.push([q2, p2]);

    points.sort((a, b) => a[0] - b[0]);
    if (points.length < 2) return '';

    if (points.length === 2) {
      const p0 = points[0][1];
      const qA = points[1][0];
      const pA = points[1][1];
      let d = `M ${scaleX(0)} ${scaleY(p0)}`;
      for (let i = 1; i <= 30; i++) {
        const qVal = (qA / 30) * i;
        const pVal = Math.max(0, p0 - ((p0 - pA) / (qA * qA || 1)) * (qVal * qVal));
        d += ` L ${scaleX(qVal)} ${scaleY(pVal)}`;
      }
      return d;
    }

    const p0 = points[0][1];
    const qA = points[1][0];
    const pA = points[1][1];
    const qB = points[2][0];
    const pB = points[2][1];
    const denom = qA * qB * (qA - qB);
    const A = Math.abs(denom) > 1e-4 ? ((pA - p0) * qB - (pB - p0) * qA) / denom : 0;
    const B = Math.abs(denom) > 1e-4 ? ((pB - p0) * qA * qA - (pA - p0) * qB * qB) / denom : 0;

    let d = `M ${scaleX(0)} ${scaleY(p0)}`;
    for (let i = 1; i <= 40; i++) {
      const qVal = (qB / 40) * i;
      const pVal = Math.max(0, A * qVal * qVal + B * qVal + p0);
      d += ` L ${scaleX(qVal)} ${scaleY(pVal)}`;
    }
    return d;
  }, [presionEstatica, p1, q1, p2, q2, scaleX, scaleY]);

  // Marcadores de ejes
  const ticksX = 5;
  const ticksY = 5;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-red-600" />
            Curva de Presión y Caudal (P - Q)
          </h4>
          <p className="text-[11px] text-zinc-500 font-medium">
            Representación de la curva característica de la red vs. requisitos de {norma.norma}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold">
          <span className="flex items-center gap-1.5 text-blue-600">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shrink-0" />
            <span className="flex flex-col leading-tight">
              <span>Presión</span>
              <span className="text-[9px] font-medium text-blue-500">Estática</span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
            <span className="flex flex-col leading-tight">
              <span>Prueba 1</span>
              <span className="text-[9px] font-medium text-emerald-500">(1º equipo)</span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-purple-600">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block shrink-0" />
            <span className="flex flex-col leading-tight">
              <span>Prueba 2</span>
              <span className="text-[9px] font-medium text-purple-500">(2º equipo)</span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-red-600">
            <span className="w-2.5 h-0.5 bg-red-500 inline-block border-b border-dashed border-red-500 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span>Ref.</span>
              <span className="text-[9px] font-medium text-red-500">Norma</span>
            </span>
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[650px] mx-auto select-none"
        >
          <defs>
            <linearGradient id={`${chartId}-curveGrad`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="50%" stopColor="#059669" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
            <pattern id={`${chartId}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F1F5F9" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Cuadrícula de Fondo */}
          <rect
            x={margin.left}
            y={margin.top}
            width={innerWidth}
            height={innerHeight}
            fill={`url(#${chartId}-grid)`}
            stroke="#E2E8F0"
            strokeWidth="1"
          />

          {/* ─── LÍNEAS DE REFERENCIA NORMATIVA (UNE / RIPCI) ─── */}
          {/* 1. Línea Horizontal: Presión Mínima Exigida */}
          <line
            x1={margin.left}
            y1={scaleY(norma.presionMin)}
            x2={margin.left + innerWidth}
            y2={scaleY(norma.presionMin)}
            stroke="#EF4444"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={margin.left + innerWidth - 5}
            y={scaleY(norma.presionMin) - 4}
            textAnchor="end"
            fontSize="9"
            fontWeight="bold"
            fill="#EF4444"
          >
            P. Mínima Norma ({norma.presionMin} bar)
          </text>

          {/* 2. Línea Vertical: Caudal Mínimo 1 Equipo */}
          <line
            x1={scaleX(norma.caudalMin1Eq)}
            y1={margin.top}
            x2={scaleX(norma.caudalMin1Eq)}
            y2={margin.top + innerHeight}
            stroke="#10B981"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={scaleX(norma.caudalMin1Eq) + 3}
            y={margin.top + 12}
            textAnchor="start"
            fontSize="8.5"
            fontWeight="bold"
            fill="#059669"
          >
            Q Mín 1 Eq ({norma.caudalMin1Eq} l/min)
          </text>

          {/* 3. Línea Vertical: Caudal Mínimo 2 Equipos Simultáneos */}
          <line
            x1={scaleX(norma.caudalMin2Eq)}
            y1={margin.top}
            x2={scaleX(norma.caudalMin2Eq)}
            y2={margin.top + innerHeight}
            stroke="#6366F1"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={scaleX(norma.caudalMin2Eq) + 3}
            y={margin.top + 24}
            textAnchor="start"
            fontSize="8.5"
            fontWeight="bold"
            fill="#4F46E5"
          >
            Q Mín 2 Eq ({norma.caudalMin2Eq} l/min)
          </text>

          {/* ─── TRAZO DE LA CURVA MEDIDA (P-Q) ─── */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={`url(#${chartId}-curveGrad)`}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}

          {/* ─── PUNTOS MEDIDOS (Por encima y en 2 líneas) ─── */}
          {/* Punto 0: Presión Estática (Q=0) */}
          {presionEstatica > 0 && (
            <g>
              <circle
                cx={scaleX(0)}
                cy={scaleY(presionEstatica)}
                r="6"
                fill="#2563EB"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <text
                x={scaleX(0) + 8}
                y={scaleY(presionEstatica) - 7}
                fontSize="8.5"
                fontWeight="bold"
                fill="#1E40AF"
              >
                {presionEstatica} bar
              </text>
              <text
                x={scaleX(0) + 8}
                y={scaleY(presionEstatica) + 3}
                fontSize="8"
                fontWeight="normal"
                fill="#3B82F6"
              >
                0 l/min
              </text>
            </g>
          )}

          {/* Punto 1: Prueba 1 Equipo */}
          {q1 > 0 && p1 > 0 && (
            <g>
              <circle
                cx={scaleX(q1)}
                cy={scaleY(p1)}
                r="6.5"
                fill="#059669"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <text
                x={scaleX(q1)}
                y={scaleY(p1) + 14}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="bold"
                fill="#065F46"
              >
                {p1} bar
              </text>
              <text
                x={scaleX(q1)}
                y={scaleY(p1) + 23}
                textAnchor="middle"
                fontSize="8"
                fontWeight="normal"
                fill="#059669"
              >
                {q1} l/min
              </text>
            </g>
          )}

          {/* Punto 2: Prueba 2 Equipos Simultáneos */}
          {q2 > 0 && p2 > 0 && (
            <g>
              <circle
                cx={scaleX(q2)}
                cy={scaleY(p2)}
                r="6.5"
                fill="#7C3AED"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <text
                x={scaleX(q2)}
                y={scaleY(p2) + 14}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="bold"
                fill="#5B21B6"
              >
                {p2} bar
              </text>
              <text
                x={scaleX(q2)}
                y={scaleY(p2) + 23}
                textAnchor="middle"
                fontSize="8"
                fontWeight="normal"
                fill="#7C3AED"
              >
                {q2} l/min
              </text>
            </g>
          )}

          {/* ─── EJES Y ETIQUETAS ─── */}
          {/* Eje Y (Presión) */}
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={margin.top + innerHeight}
            stroke="#64748B"
            strokeWidth="1.5"
          />
          {Array.from({ length: ticksY + 1 }).map((_, i) => {
            const val = (maxP / ticksY) * i;
            const yPos = scaleY(val);
            return (
              <g key={`y-${i}`}>
                <line x1={margin.left - 4} y1={yPos} x2={margin.left} y2={yPos} stroke="#64748B" />
                <text
                  x={margin.left - 7}
                  y={yPos + 3}
                  textAnchor="end"
                  fontSize="8"
                  fill="#64748B"
                  fontWeight="600"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}
          <text
            x={15}
            y={margin.top + innerHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 15 ${margin.top + innerHeight / 2})`}
            fontSize="10"
            fontWeight="bold"
            fill="#334155"
          >
            Presión (bar)
          </text>

          {/* Eje X (Caudal) */}
          <line
            x1={margin.left}
            y1={margin.top + innerHeight}
            x2={margin.left + innerWidth}
            y2={margin.top + innerHeight}
            stroke="#64748B"
            strokeWidth="1.5"
          />
          {Array.from({ length: ticksX + 1 }).map((_, i) => {
            const val = (maxQ / ticksX) * i;
            const xPos = scaleX(val);
            return (
              <g key={`x-${i}`}>
                <line
                  x1={xPos}
                  y1={margin.top + innerHeight}
                  x2={xPos}
                  y2={margin.top + innerHeight + 4}
                  stroke="#64748B"
                />
                <text
                  x={xPos}
                  y={margin.top + innerHeight + 14}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#64748B"
                  fontWeight="600"
                >
                  {Math.round(val)}
                </text>
              </g>
            );
          })}
          <text
            x={margin.left + innerWidth / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fontWeight="bold"
            fill="#334155"
          >
            Caudal Q (l/min)
          </text>
        </svg>
      </div>
    </div>
  );
}

// ─── PANTALLA PRINCIPAL: PRUEBAS TÉCNICAS ────────────────────────────────────
export default function PruebasTecnicas() {
  const [selectedView, setSelectedView] = useState<'menu' | 'red-publica' | 'grupo-presion'>('menu');

  // ─── DATOS GENERALES DEL ENSAYO (UNIFICADOS) ───
  const [empresaMantenedora, setEmpresaMantenedora] = useState('ABANFOC S.L.');
  const [equipoMedicion, setEquipoMedicion] = useState('HoneyWell ISSUE3 PK 80083');
  const [tipoEquipo, setTipoEquipo] = useState<TipoEquipoMedir>('bie25');

  const [clienteNombre, setClienteNombre] = useState('');
  const [centroNombre, setCentroNombre] = useState('');
  const [fechaEnsayo, setFechaEnsayo] = useState(() => new Date().toISOString().split('T')[0]);
  const [horaEnsayo, setHoraEnsayo] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [tecnicoNombre, setTecnicoNombre] = useState(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('firecheck_logged_user') || localStorage.getItem('firecheck_logged_user') || '{}');
      return u.nombre ? `${u.nombre} ${u.apellidos || ''}`.trim() : '';
    } catch {
      return '';
    }
  });

  // ─── MEDICIONES HIDRÁULICAS ───
  const [presionEstatica, setPresionEstatica] = useState<string>(''); // bar

  // Prueba 1 (1 equipo)
  const [equipo1Ubicacion, setEquipo1Ubicacion] = useState('Equipo más desfavorable');
  const [presionDin1, setPresionDin1] = useState<string>(''); // bar
  const [caudal1, setCaudal1] = useState<string>(''); // l/min

  // Prueba 2 (2 equipos simultáneos)
  const [equipo2Ubicacion, setEquipo2Ubicacion] = useState('Segundo equipo simultáneo');
  const [presionDin2, setPresionDin2] = useState<string>(''); // bar
  const [caudal2, setCaudal2] = useState<string>(''); // l/min

  const [observaciones, setObservaciones] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessModal, setSaveSuccessModal] = useState(false);

  // ─── HISTORIAL / RECUPERACIÓN DE ENSAYOS ANTERIORES ───
  const [historialModal, setHistorialModal] = useState(false);
  const [ensayosGuardados, setEnsayosGuardados] = useState<EnsayoGuardado[]>([]);
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  const [filtroTipoHistorial, setFiltroTipoHistorial] = useState('todos');

  // Lista dinámica de empresas cargadas desde Firebase
  const [empresasLista, setEmpresasLista] = useState<any[]>([]);

  // Suscripción a Firestore para empresas en tiempo real
  useEffect(() => {
    try {
      const unsub = subscribeEmpresas((items) => {
        if (items && items.length > 0) {
          setEmpresasLista(items);
        }
      });
      return () => unsub();
    } catch (e) {
      console.error('Error suscribiendo a empresas:', e);
    }
  }, []);

  // Suscripción a Firestore para historial en tiempo real
  useEffect(() => {
    try {
      const q = query(collection(db, 'pruebas_tecnicas'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        const docs: EnsayoGuardado[] = [];
        snap.forEach((d) => {
          docs.push({ id: d.id, ...(d.data() as any) });
        });
        setEnsayosGuardados(docs);
      });
      return () => unsub();
    } catch (err) {
      console.error('Error suscribiendo al historial de pruebas:', err);
    }
  }, []);

  // Cálculos y diagnóstico de variación
  const pEstNum = parseFloat(presionEstatica) || 0;
  const p1Num = parseFloat(presionDin1) || 0;
  const q1Num = parseFloat(caudal1) || 0;
  const p2Num = parseFloat(presionDin2) || 0;
  const q2Num = parseFloat(caudal2) || 0;

  const normaActiva = REFERENCIAS_NORMATIVA[tipoEquipo];

  // Caudal Total Simultáneo al abrir ambos equipos
  // Si el usuario introduce el caudal medido en el 2.º equipo (ej. 100 l/min), el caudal total simultáneo es Q1 + Q2 (200 l/min).
  // Si el usuario introduce directamente el caudal total ya sumado (ej. 200 l/min), se toma como caudal total.
  const qTotalNum = useMemo(() => {
    if (q2Num <= 0) return 0;
    if (q1Num <= 0) return q2Num;
    if (q2Num >= normaActiva.caudalMin2Eq && q2Num >= q1Num * 1.6) {
      return q2Num;
    }
    return q1Num + q2Num;
  }, [q1Num, q2Num, normaActiva.caudalMin2Eq]);

  // Variación entre Prueba 1 y Prueba 2
  const caidaPresion = p1Num > 0 && p2Num > 0 ? (p1Num - p2Num) : 0;
  const variacionPorcentualP = p1Num > 0 && p2Num > 0 ? ((p1Num - p2Num) / p1Num) * 100 : 0;
  const incrementoCaudal = qTotalNum > 0 && q1Num > 0 ? qTotalNum - q1Num : (q2Num > 0 ? q2Num : 0);

  // Evaluación de cumplimiento
  const cumplePrueba1 = p1Num >= normaActiva.presionMin && q1Num >= normaActiva.caudalMin1Eq;
  const cumplePrueba2 = p2Num >= normaActiva.presionMin && (qTotalNum >= normaActiva.caudalMin2Eq || (q1Num >= normaActiva.caudalMin1Eq && q2Num >= normaActiva.caudalMin1Eq));
  const evaluacionGlobal = p1Num > 0 && q1Num > 0 && p2Num > 0 && q2Num > 0
    ? (cumplePrueba1 && cumplePrueba2 ? 'conforme' : 'no_conforme')
    : 'pendiente';

  // ─── CARGAR ENSAYO ANTERIOR EN EL FORMULARIO ───
  const handleCargarEnsayo = (ensayo: EnsayoGuardado) => {
    setEmpresaMantenedora(ensayo.empresaMantenedora || 'ABANFOC S.L.');
    setEquipoMedicion(ensayo.equipoMedicion || 'HoneyWell ISSUE3 PK 80083');
    if (ensayo.tipoEquipo && REFERENCIAS_NORMATIVA[ensayo.tipoEquipo]) {
      setTipoEquipo(ensayo.tipoEquipo);
    }
    setClienteNombre(ensayo.clienteNombre || '');
    setCentroNombre(ensayo.centroNombre || '');
    setFechaEnsayo(ensayo.fechaEnsayo || new Date().toISOString().split('T')[0]);
    setHoraEnsayo(ensayo.horaEnsayo || '10:00');
    setTecnicoNombre(ensayo.tecnicoNombre || '');

    setPresionEstatica(ensayo.presionEstatica !== undefined ? String(ensayo.presionEstatica) : '');
    setEquipo1Ubicacion(ensayo.prueba1?.ubicacion || 'Equipo más desfavorable');
    setPresionDin1(ensayo.prueba1?.presionDin !== undefined ? String(ensayo.prueba1.presionDin) : '');
    setCaudal1(ensayo.prueba1?.caudal !== undefined ? String(ensayo.prueba1.caudal) : '');

    setEquipo2Ubicacion(ensayo.prueba2?.ubicacion || 'Segundo equipo simultáneo');
    setPresionDin2(ensayo.prueba2?.presionDin !== undefined ? String(ensayo.prueba2.presionDin) : '');
    setCaudal2(ensayo.prueba2?.caudal !== undefined ? String(ensayo.prueba2.caudal) : '');

    setObservaciones(ensayo.observaciones || '');
    setSelectedView('red-publica');
    setHistorialModal(false);
  };

  // ─── ELIMINAR ENSAYO GUARDADO (Mover a Papelera) ───
  const handleEliminarEnsayo = async (id: string, cliente: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar el ensayo de "${cliente || 'este cliente'}"? Se moverá a la papelera.`)) {
      return;
    }
    try {
      let dataToSave: any = ensayosGuardados.find(h => h.id === id);
      if (!dataToSave) {
        const snap = await getDoc(doc(db, 'pruebas_tecnicas', id));
        if (snap.exists()) {
          dataToSave = { id: snap.id, ...snap.data() };
        }
      }

      if (dataToSave) {
        await moverAPapelera({
          coleccion: 'pruebas_tecnicas',
          originalDocId: id,
          tipo: 'Prueba Técnica',
          titulo: `Ensayo ${dataToSave.tipoEquipo?.toUpperCase() || 'Hidráulico'} - ${dataToSave.clienteNombre || cliente || 'Cliente'}`,
          clienteNombre: dataToSave.clienteNombre || cliente || '',
          centroNombre: dataToSave.centroNombre || '',
          datos: dataToSave,
          usuario: dataToSave.tecnicoNombre || tecnicoNombre || 'Técnico'
        });
      } else {
        await deleteDoc(doc(db, 'pruebas_tecnicas', id));
      }
    } catch (err) {
      console.error('Error eliminando ensayo:', err);
      alert('No se pudo eliminar el ensayo.');
    }
  };

  // ─── GENERACIÓN Y DESCARGA DE INFORME PDF DEL ENSAYO ───
  const handleExportPDF = async (customEnsayo?: EnsayoGuardado) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Extraer datos del ensayo activo o del ensayo pasado por argumento
      const emp = (customEnsayo?.empresaMantenedora || empresaMantenedora || 'ABANFOC S.L.').trim();

      // Cargar lista completa de empresas desde state, Firestore y localStorage
      let allEmpDocs: any[] = empresasLista && empresasLista.length > 0 ? [...empresasLista] : [];
      try {
        const empSnap = await getDocs(collection(db, 'empresa'));
        if (!empSnap.empty) {
          allEmpDocs = empSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
        }
      } catch (errDb) {
        console.warn('Error leyendo empresas de Firestore:', errDb);
      }

      if (allEmpDocs.length === 0) {
        try {
          const savedEmpRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('firecheck_db_empresas') || localStorage.getItem('firecheck_db_empresa') || localStorage.getItem('firecheck_empresas') : null;
          if (savedEmpRaw) {
            const parsed = JSON.parse(savedEmpRaw);
            allEmpDocs = Array.isArray(parsed) ? parsed : [parsed];
          }
        } catch (_e) {}
      }

      // Buscar la empresa exacta que coincida con la empresa seleccionada 'emp'
      const empTarget = emp.toLowerCase().trim();
      const matchedEmpRaw = allEmpDocs.find((d: any) => 
        d.nombre && d.nombre.trim().toLowerCase() === empTarget
      ) || allEmpDocs.find((d: any) => 
        d.nombre && (
          empTarget.includes(d.nombre.trim().toLowerCase()) ||
          d.nombre.trim().toLowerCase().includes(empTarget)
        )
      ) || allEmpDocs.find((d: any) => {
        const nom = (d.nombre || '').toLowerCase();
        if (empTarget.includes('sertec') && nom.includes('sertec')) return true;
        if (empTarget.includes('colaboraci') && nom.includes('colaboraci')) return true;
        if (empTarget.includes('segupro') && nom.includes('segupro') && !empTarget.includes('abanfoc') && !nom.includes('abanfoc')) return true;
        if (empTarget.includes('arc') && nom.includes('arc')) return true;
        if (empTarget.includes('abanfoc') && nom.includes('abanfoc') && !empTarget.includes('segupro') && !nom.includes('segupro')) return true;
        return false;
      }) || null;

      // Extraer sello/firma ESTRICTAMENTE de ESTA empresa seleccionada (sin préstamos de otras empresas)
      const rawSelloUrl = matchedEmpRaw?.selloUrl || 
                          matchedEmpRaw?.sello || 
                          matchedEmpRaw?.selloBase64 || 
                          matchedEmpRaw?.imagenSello || 
                          matchedEmpRaw?.sello_url || 
                          matchedEmpRaw?.ingenieroFirmaUrl || 
                          matchedEmpRaw?.firmaUrl || 
                          matchedEmpRaw?.firmaIngenieroBase64 || '';

      let selloBase64: string | null = null;
      if (rawSelloUrl) {
        try {
          const rawSello = await fetchImageToBase64(rawSelloUrl);
          if (rawSello) {
            const { base64: optSello } = await optimizarImagenParaPDF(rawSello, 800, 0.75);
            selloBase64 = optSello || rawSello;
          }
        } catch (e) {
          console.error('Error cargando sello de empresa:', e);
        }
      }

      const eqMed = customEnsayo?.equipoMedicion || equipoMedicion;
      const tEq = customEnsayo?.tipoEquipo || tipoEquipo;
      const nAct = REFERENCIAS_NORMATIVA[tEq] || normaActiva;
      const cli = customEnsayo?.clienteNombre || clienteNombre;
      const cen = customEnsayo?.centroNombre || centroNombre;
      const fec = customEnsayo?.fechaEnsayo || fechaEnsayo;
      const hor = customEnsayo?.horaEnsayo || horaEnsayo;
      const tec = customEnsayo?.tecnicoNombre || tecnicoNombre;
      const pEst = customEnsayo ? (customEnsayo.presionEstatica || 0) : pEstNum;
      const u1 = customEnsayo?.prueba1?.ubicacion || equipo1Ubicacion;
      const p1 = customEnsayo ? (customEnsayo.prueba1?.presionDin || 0) : p1Num;
      const q1 = customEnsayo ? (customEnsayo.prueba1?.caudal || 0) : q1Num;
      const u2 = customEnsayo?.prueba2?.ubicacion || equipo2Ubicacion;
      const p2 = customEnsayo ? (customEnsayo.prueba2?.presionDin || 0) : p2Num;
      const q2 = customEnsayo ? (customEnsayo.prueba2?.caudal || 0) : q2Num;
      const qTot = customEnsayo ? (customEnsayo.prueba2?.caudalTotalSimultaneo || (q2 >= nAct.caudalMin2Eq ? q2 : q1 + q2)) : qTotalNum;
      const cPrueba1 = p1 >= nAct.presionMin && q1 >= nAct.caudalMin1Eq;
      const cPrueba2 = p2 >= nAct.presionMin && (qTot >= nAct.caudalMin2Eq || q2 >= nAct.caudalMin1Eq);
      const evalGlob = customEnsayo?.evaluacionGlobal || evaluacionGlobal;
      const cPres = p1 > 0 && p2 > 0 ? (p1 - p2) : 0;
      const varPctP = p1 > 0 && p2 > 0 ? ((p1 - p2) / p1) * 100 : 0;
      const incQ = qTot > 0 && q1 > 0 ? qTot - q1 : (q2 > 0 ? q2 : 0);
      const obs = customEnsayo?.observaciones || observaciones;

      // 1. Cabecera Institucional
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 28, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('INFORME TÉCNICO DE ENSAYO HIDRÁULICO', 14, 12);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Pruebas de Presión y Caudal en Red Pública | ${nAct.norma}`, 14, 18);
      doc.text(`Empresa mantenedora: ${matchedEmpRaw?.nombre || emp}`, 14, 24);

      // 2. Datos Generales del Ensayo (Unificados)
      let currentY = 33;
      autoTable(doc, {
        startY: currentY,
        head: [
          [
            { content: 'DATOS DEL CLIENTE Y EMPRESA', colSpan: 2 },
            { content: 'DATOS TÉCNICOS DEL ENSAYO Y EQUIPOS', colSpan: 2 }
          ]
        ],
        body: [
          ['Cliente / Titular:', cli || 'No especificado', 'Fecha de ensayo:', `${formatFechaEnsayo(fec)}  ${hor}`],
          ['Centro / Instalación:', cen || 'No especificado', 'Técnico responsable:', tec || 'No asignado'],
          ['Empresa mantenedora:', emp, 'Equipo de medición:', eqMed],
          ['Normativa aplicada:', (tEq === 'bie25' || tEq === 'bie45') ? 'UNE 23500:2021 y R.I.P.CI.' : nAct.norma, 'Equipo a medir:', nAct.label]
        ],
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: 2,
          lineColor: [226, 232, 240],
        },
        columnStyles: {
          0: { cellWidth: 34, fontStyle: 'normal', textColor: [100, 116, 139] },
          1: { cellWidth: 57, fontStyle: 'bold', textColor: [15, 23, 42] },
          2: { cellWidth: 29, fontStyle: 'normal', textColor: [100, 116, 139] },
          3: { cellWidth: 62, fontStyle: 'bold', textColor: [15, 23, 42] },
        },
        margin: { left: 14, right: 14 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 4;

      // 3. Tabla de Resultados Hidráulicos (P0, Prueba 1, Prueba 2)
      autoTable(doc, {
        startY: currentY,
        head: [['FASE DE ENSAYO', 'UBICACIÓN / DESCRIPCIÓN', 'PRESIÓN', 'CAUDAL', 'EXIGENCIA NORMA', 'DICTAMEN']],
        body: [
          [
            'Presión Estática (P0)',
            'Red cerrada (Q = 0)',
            pEst > 0 ? `${pEst.toFixed(2)} bar` : '--',
            '0 l/min',
            `Máx: ${nAct.presionMaxEstatica} bar`,
            pEst > 0 ? 'REGISTRADA' : 'PENDIENTE'
          ],
          [
            'Prueba 1 (1 Equipo)',
            u1 || 'Equipo más desfavorable',
            p1 > 0 ? `${p1.toFixed(2)} bar` : '--',
            q1 > 0 ? `${q1.toFixed(0)} l/min` : '--',
            `Mín. ${nAct.presionMin} bar / ${nAct.caudalMin1Eq} l/min`,
            p1 > 0 && q1 > 0 ? (cPrueba1 ? 'CONFORME' : 'NO CONFORME') : 'PENDIENTE'
          ],
          [
            'Prueba 2 (2 Equipos)',
            u2 || '2 equipos simultáneos',
            p2 > 0 ? `${p2.toFixed(2)} bar` : '--',
            q2 > 0 ? `${q2.toFixed(0)} l/m (Tot: ${qTot.toFixed(0)})` : '--',
            `Mín. ${nAct.presionMin} bar / ${nAct.caudalMin2Eq} l/min`,
            p2 > 0 && q2 > 0 ? (cPrueba2 ? 'CONFORME' : 'NO CONFORME') : 'PENDIENTE'
          ]
        ],
        theme: 'striped',
        headStyles: {
          fillColor: [220, 38, 38], // red-600
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          0: { cellWidth: 33 },
          1: { cellWidth: 40 },
          2: { cellWidth: 17 },
          3: { cellWidth: 32 },
          4: { cellWidth: 36 },
          5: { cellWidth: 24 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            if (data.cell.raw === 'CONFORME' || data.cell.raw === 'REGISTRADA') {
              data.cell.styles.textColor = [16, 185, 129];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw === 'NO CONFORME') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: 14, right: 14 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 3.5;

      // 4. Análisis de Variación y Dictamen Global
      const margenBar = (p2 - nAct.presionMin);
      autoTable(doc, {
        startY: currentY,
        head: [['ANÁLISIS DE SIMULTANEIDAD (2 EQUIPOS)', 'VALOR CALCULADO', 'DICTAMEN TÉCNICO GLOBAL']],
        body: [
          [
            'Caída de Presión Dinámica',
            p1 > 0 && p2 > 0 ? `${cPres.toFixed(2)} bar (${varPctP.toFixed(1)}%)` : '--',
            evalGlob === 'conforme' ? 'CONFORME A NORMATIVA UNE / RIPCI' : evalGlob === 'no_conforme' ? 'NO CONFORME (Parámetros insuficientes)' : 'PENDIENTE DE COMPLETAR'
          ],
          [
            'Incremento de Caudal Simultáneo',
            q1 > 0 && q2 > 0 ? `+${incQ.toFixed(0)} l/min (Total red: ${qTot.toFixed(0)} l/min)` : '--',
            evalGlob === 'conforme' ? 'Presión y caudal suficientes en red pública' : evalGlob === 'no_conforme' ? 'Presión o caudal inferior al reglamentario' : 'Sin mediciones completas'
          ],
          [
            `Margen de Presión vs Norma (${nAct.presionMin} bar)`,
            p2 > 0 ? `${margenBar >= 0 ? '+' : ''}${margenBar.toFixed(2)} bar sobre el mínimo` : '--',
            `Autonomía teórica requerida: ${nAct.tiempoAutonomiaMin} minutos`
          ]
        ],
        theme: 'grid',
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          0: { cellWidth: 64 },
          1: { cellWidth: 44 },
          2: { cellWidth: 74 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2 && data.row.index === 0) {
            if (evalGlob === 'conforme') {
              data.cell.styles.textColor = [16, 185, 129];
              data.cell.styles.fontStyle = 'bold';
            } else if (evalGlob === 'no_conforme') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: 14, right: 14 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 4;

      // 5. Gráfico Curva de Presión y Caudal (P - Q)
      const chartBoxHeight = 74;
      if (currentY + chartBoxHeight > doc.internal.pageSize.getHeight() - 42) {
        doc.addPage();
        currentY = 20;
      }

      // Marco y fondo del contenedor del gráfico
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.3);
      doc.roundedRect(14, currentY, 182, chartBoxHeight, 2, 2, 'FD');

      // Título y Leyenda alineados en la misma fila superior
      const headerY = currentY + 5.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text('CURVA CARACTERÍSTICA DE PRESIÓN Y CAUDAL (P - Q)', 18, headerY);

      // Leyenda del gráfico (estructurada en 2 líneas por símbolo)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(51, 65, 85);

      // 1. Presión Estática
      doc.setFillColor(37, 99, 235);
      doc.circle(105, headerY - 0.3, 1.1, 'F');
      doc.text('Presión', 107.5, headerY - 1.2);
      doc.text('Estática', 107.5, headerY + 1.3);

      // 2. Prueba 1 (1º equipo)
      doc.setFillColor(5, 150, 105);
      doc.circle(124, headerY - 0.3, 1.1, 'F');
      doc.text('Prueba 1', 126.5, headerY - 1.2);
      doc.text('(1º equipo)', 126.5, headerY + 1.3);

      // 3. Prueba 2 (2º equipo)
      doc.setFillColor(124, 58, 237);
      doc.circle(147, headerY - 0.3, 1.1, 'F');
      doc.text('Prueba 2', 149.5, headerY - 1.2);
      doc.text('(2º equipo)', 149.5, headerY + 1.3);

      // 4. Ref. Norma
      doc.setDrawColor(239, 68, 68);
      doc.setLineWidth(0.4);
      doc.line(170, headerY - 0.3, 172.5, headerY - 0.3);
      doc.line(173.5, headerY - 0.3, 176, headerY - 0.3);
      doc.text('Ref.', 178, headerY - 1.2);
      doc.text('Norma', 178, headerY + 1.3);

      // Dimensiones del área de trazado (Plot Area) con separación holgada
      const plotLeft = 27;
      const plotRight = 188;
      const plotTop = currentY + 12;
      const plotBottom = currentY + chartBoxHeight - 8.5;
      const plotW = plotRight - plotLeft;
      const plotH = plotBottom - plotTop;

      // Fondo del área de trazado
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(plotLeft, plotTop, plotW, plotH, 'FD');

      // Escalas de cálculo
      const maxQVal = Math.max(
        q1,
        q2,
        qTot,
        nAct.caudalMin2Eq * 1.3,
        tEq === 'bie45' ? 500 : tEq.startsWith('hidrante') ? 2200 : 300
      );
      const maxPVal = Math.max(
        pEst,
        p1,
        p2,
        nAct.presionMaxEstatica,
        9
      );

      const toPlotX = (qVal: number) => plotLeft + (Math.max(0, qVal) / maxQVal) * plotW;
      const toPlotY = (pVal: number) => plotBottom - (Math.max(0, pVal) / maxPVal) * plotH;

      // Cuadrícula y Marcas en Eje Y (Presión)
      const numTicksY = 5;
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      for (let i = 0; i <= numTicksY; i++) {
        const valP = (maxPVal / numTicksY) * i;
        const yCoord = toPlotY(valP);
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(plotLeft, yCoord, plotRight, yCoord);
        doc.setTextColor(100, 116, 139);
        doc.text(`${valP.toFixed(1)} b`, plotLeft - 1.5, yCoord + 1, { align: 'right' });
      }

      // Cuadrícula y Marcas en Eje X (Caudal)
      const numTicksX = 5;
      for (let i = 0; i <= numTicksX; i++) {
        const valQ = (maxQVal / numTicksX) * i;
        const xCoord = toPlotX(valQ);
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(xCoord, plotTop, xCoord, plotBottom);
        doc.setTextColor(100, 116, 139);
        doc.text(`${valQ.toFixed(0)}`, xCoord, plotBottom + 3.5, { align: 'center' });
      }

      // Etiqueta del Eje X
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Caudal Q (l/min)', plotLeft + plotW / 2, plotBottom + 6.5, { align: 'center' });

      // Función auxiliar para trazar líneas discontinuas
      const setDashedPattern = (dashArr: number[]) => {
        if (typeof (doc as any).setLineDashPattern === 'function') (doc as any).setLineDashPattern(dashArr, 0);
        else if (typeof (doc as any).setLineDash === 'function') (doc as any).setLineDash(dashArr, 0);
      };

      // ─── LÍNEAS DE REFERENCIA NORMATIVA (Discontinuas) ───
      // 1. Presión Mínima Exigida (Línea Horizontal Roja)
      if (nAct.presionMin > 0 && nAct.presionMin <= maxPVal) {
        setDashedPattern([1.5, 1.2]);
        doc.setDrawColor(239, 68, 68);
        doc.setLineWidth(0.35);
        const yNormaP = toPlotY(nAct.presionMin);
        doc.line(plotLeft, yNormaP, plotRight, yNormaP);
        setDashedPattern([]);

        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text(`P. Mín. Norma (${nAct.presionMin} bar)`, plotRight - 1.5, yNormaP - 1.2, { align: 'right' });
      }

      // 2. Caudal Mínimo 1 Equipo (Línea Vertical Verde)
      if (nAct.caudalMin1Eq > 0 && nAct.caudalMin1Eq <= maxQVal) {
        setDashedPattern([1.5, 1.2]);
        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(0.35);
        const xNormaQ1 = toPlotX(nAct.caudalMin1Eq);
        doc.line(xNormaQ1, plotTop, xNormaQ1, plotBottom);
        setDashedPattern([]);

        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(`Q1 Mín (${nAct.caudalMin1Eq} l/m)`, xNormaQ1 + 1, plotTop + 4);
      }

      // 3. Caudal Mínimo 2 Equipos Simultáneos (Línea Vertical Morada)
      if (nAct.caudalMin2Eq > 0 && nAct.caudalMin2Eq <= maxQVal) {
        setDashedPattern([1.5, 1.2]);
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.35);
        const xNormaQ2 = toPlotX(nAct.caudalMin2Eq);
        doc.line(xNormaQ2, plotTop, xNormaQ2, plotBottom);
        setDashedPattern([]);

        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text(`Q2 Total Mín (${nAct.caudalMin2Eq} l/m)`, xNormaQ2 + 1, plotTop + 8);
      }

      // ─── CURVA HIDRÁULICA CARACTERÍSTICA P-Q (Suavizada) ───
      const curvePoints: [number, number][] = [];
      if (pEst > 0) curvePoints.push([0, pEst]);
      if (q1 > 0 && p1 > 0) curvePoints.push([q1, p1]);
      if (p2 > 0 && (qTot > 0 || q2 > 0)) curvePoints.push([qTot > 0 ? qTot : q2, p2]);

      curvePoints.sort((a, b) => a[0] - b[0]);

      if (curvePoints.length >= 2) {
        doc.setDrawColor(37, 99, 235); // azul corporativo
        doc.setLineWidth(0.7);

        if (curvePoints.length === 2) {
          const p0 = curvePoints[0][1];
          const qA = curvePoints[1][0];
          const pA = curvePoints[1][1];
          let prevX = toPlotX(0);
          let prevY = toPlotY(p0);
          for (let i = 1; i <= 30; i++) {
            const qVal = (qA / 30) * i;
            const pVal = Math.max(0, p0 - ((p0 - pA) / (qA * qA || 1)) * (qVal * qVal));
            const x = toPlotX(qVal);
            const y = toPlotY(pVal);
            doc.line(prevX, prevY, x, y);
            prevX = x;
            prevY = y;
          }
        } else {
          const p0 = curvePoints[0][1];
          const qA = curvePoints[1][0];
          const pA = curvePoints[1][1];
          const qB = curvePoints[2][0];
          const pB = curvePoints[2][1];
          const denom = qA * qB * (qA - qB);
          const A = Math.abs(denom) > 1e-4 ? ((pA - p0) * qB - (pB - p0) * qA) / denom : 0;
          const B = Math.abs(denom) > 1e-4 ? ((pB - p0) * qA * qA - (pA - p0) * qB * qB) / denom : 0;

          let prevX = toPlotX(0);
          let prevY = toPlotY(p0);
          for (let i = 1; i <= 40; i++) {
            const qVal = (qB / 40) * i;
            const pVal = Math.max(0, A * qVal * qVal + B * qVal + p0);
            const x = toPlotX(qVal);
            const y = toPlotY(pVal);
            doc.line(prevX, prevY, x, y);
            prevX = x;
            prevY = y;
          }
        }
      }

      // ─── PUNTOS MEDIDOS CON ETIQUETAS COMPACTAS POR ENCIMA ───
      const x0 = pEst > 0 ? toPlotX(0) : 0;
      const y0 = pEst > 0 ? toPlotY(pEst) : 0;
      const x1 = q1 > 0 && p1 > 0 ? toPlotX(q1) : 0;
      const y1 = q1 > 0 && p1 > 0 ? toPlotY(p1) : 0;
      const qVal2 = qTot > 0 ? qTot : q2;
      const x2 = p2 > 0 && qVal2 > 0 ? toPlotX(qVal2) : 0;
      const y2 = p2 > 0 && qVal2 > 0 ? toPlotY(p2) : 0;

      // Punto 0: Presión Estática (Q=0, P=pEst) -> Por encima del punto, recto
      if (pEst > 0) {
        doc.setFillColor(37, 99, 235);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.4);
        doc.circle(x0, y0, 1.4, 'FD');

        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text(`${pEst.toFixed(2)} bar`, x0 + 1.5, y0 - 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`0 l/min`, x0 + 1.5, y0 - 1.5);
      }

      // Punto 1: Prueba 1 Equipo (q1, p1) -> Por debajo del punto, centrado, recto
      if (q1 > 0 && p1 > 0) {
        doc.setFillColor(5, 150, 105);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.4);
        doc.circle(x1, y1, 1.5, 'FD');

        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(6, 95, 70);
        doc.text(`${p1.toFixed(2)} bar`, x1, y1 + 3.8, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(`${q1.toFixed(0)} l/min`, x1, y1 + 6.2, { align: 'center' });
      }

      // Punto 2: Prueba 2 Equipos Simultáneos (qVal2, p2) -> Por debajo del punto, centrado, recto
      if (p2 > 0 && qVal2 > 0) {
        doc.setFillColor(124, 58, 237);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.4);
        doc.circle(x2, y2, 1.5, 'FD');

        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(91, 33, 182);
        doc.text(`${p2.toFixed(2)} bar`, x2, y2 + 3.8, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(`${qVal2.toFixed(0)} l/min`, x2, y2 + 6.2, { align: 'center' });
      }

      currentY += chartBoxHeight + 5;

      // 6. Observaciones Técnicas y Dictamen
      if (currentY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('OBSERVACIONES Y CONCLUSIONES TÉCNICAS:', 14, currentY);
      currentY += 4;

      // Dictamen automático destacado
      const esNoConforme = evalGlob === 'no_conforme' || (p1 > 0 && q1 > 0 && p2 > 0 && qTot > 0 && (!cPrueba1 || !cPrueba2));
      const esConforme = evalGlob === 'conforme' || (p1 > 0 && q1 > 0 && p2 > 0 && qTot > 0 && cPrueba1 && cPrueba2);

      if (esNoConforme) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(220, 38, 38); // ROJO
        doc.text('PRUEBA NO CONFORME.', 14, currentY);
        currentY += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(220, 38, 38);
        const normaRefTxt = (tEq === 'bie25' || tEq === 'bie45') ? 'norma UNE 23500:2021 y el Real Decreto 513/2017 de 22 de mayo' : `norma ${nAct.norma}`;
        const txtDetalle = `No se han alcanzado los requisitos de presión y caudal exigidos por la ${normaRefTxt}.`;
        const dictamenLines = doc.splitTextToSize(txtDetalle, pageWidth - 28);
        doc.text(dictamenLines, 14, currentY);
        currentY += (dictamenLines.length * 3.5) + 3;
      } else if (esConforme) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(5, 150, 105); // VERDE
        doc.text('PRUEBA CONFORME.', 14, currentY);
        currentY += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(5, 150, 105);
        const normaRefTxt = (tEq === 'bie25' || tEq === 'bie45') ? 'norma UNE 23500:2021 y el Real Decreto 513/2017 de 22 de mayo' : `norma ${nAct.norma}`;
        const txtDetalle = `La instalación cumple satisfactoriamente con los requisitos mínimos de presión y caudal exigidos por la ${normaRefTxt}.`;
        const dictamenLines = doc.splitTextToSize(txtDetalle, pageWidth - 28);
        doc.text(dictamenLines, 14, currentY);
        currentY += (dictamenLines.length * 3.5) + 3;
      }

      // Observaciones adicionales del técnico (si las hay)
      if (obs && obs.trim() !== '') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(0, 82, 204); // AZUL CORPORATIVO REGLA 16
        const obsLines = doc.splitTextToSize(`Observaciones del técnico: ${obs.trim()}`, pageWidth - 28);
        doc.text(obsLines, 14, currentY);
        currentY += (obsLines.length * 3.5) + 4;
      } else if (!esNoConforme && !esConforme) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(0, 82, 204);
        doc.text('Sin incidencias destacables durante las pruebas de presión y caudal.', 14, currentY);
        currentY += 6;
      } else {
        currentY += 4;
      }

      // 6. Bloque de Firmas y Sello Oficial (Texto a la izquierda, Sello a la derecha)
      if (currentY > doc.internal.pageSize.getHeight() - 45) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('TÉCNICO DE MANTENIMIENTO E INSPECCIÓN', 14, currentY + 3);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Técnico responsable: ${tec || 'Técnico cualificado'}`, 14, currentY + 8);
      doc.text(`Empresa mantenedora: ${matchedEmpRaw?.nombre || emp}`, 14, currentY + 13);
      doc.text('Firma del técnico y sello de empresa:', 14, currentY + 18);

      // Estampar el sello oficial de la empresa en la parte derecha del bloque
      if (selloBase64) {
        try {
          const sProps = doc.getImageProperties(selloBase64);
          const maxSW = 55;
          const maxSH = 28;
          let sW = maxSW;
          let sH = maxSH;
          if (sProps && sProps.width && sProps.height) {
            const ratio = sProps.width / sProps.height;
            if (ratio > maxSW / maxSH) {
              sW = maxSW;
              sH = maxSW / ratio;
            } else {
              sH = maxSH;
              sW = maxSH * ratio;
            }
          }
          const imgFmt = getImageFormat(selloBase64);
          const selloX = 105;
          const selloY = currentY - 1;
          doc.addImage(selloBase64, imgFmt, selloX, selloY, sW, sH);
        } catch (e) {
          console.error('Error insertando sello en PDF:', e);
        }
      }

      // Numeración de páginas
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${i} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: 'center' }
        );
      }

      // Descargar PDF
      const safeCliente = (cli || 'Cliente').replace(/\s+/g, '_');
      doc.save(`Informe_Ensayo_Presion_Caudal_${safeCliente}_${fec}.pdf`);
    } catch (err) {
      console.error('Error generando PDF del ensayo:', err);
      alert('Error al generar el informe PDF.');
    }
  };

  // ─── GUARDAR EN FIREBASE ───
  const handleGuardarPrueba = async () => {
    if (!presionEstatica || !presionDin1 || !caudal1) {
      alert('Por favor, introduce al menos la presión estática y los datos de la Prueba 1.');
      return;
    }

    setIsSaving(true);
    try {
      const docData = {
        tipo: 'red-publica',
        empresaMantenedora,
        equipoMedicion,
        tipoEquipo,
        equipoAMedirLabel: normaActiva.label,
        normaAplicable: normaActiva.norma,
        clienteNombre,
        centroNombre,
        fechaEnsayo,
        horaEnsayo,
        tecnicoNombre,
        presionEstatica: pEstNum,
        prueba1: {
          ubicacion: equipo1Ubicacion,
          presionDin: p1Num,
          caudal: q1Num,
          cumple: cumplePrueba1,
        },
        prueba2: {
          ubicacion: equipo2Ubicacion,
          presionDin: p2Num,
          caudal: q2Num,
          caudalTotalSimultaneo: qTotalNum,
          cumple: cumplePrueba2,
        },
        variacion: {
          caidaPresionBar: Number(caidaPresion.toFixed(2)),
          variacionPorcentaje: Number(variacionPorcentualP.toFixed(1)),
          incrementoCaudal: Number(incrementoCaudal.toFixed(1)),
        },
        evaluacionGlobal,
        observaciones,
        createdAt: new Date().toISOString(),
        versionApp: APP_VERSION,
      };

      await addDoc(collection(db, 'pruebas_tecnicas'), docData);
      setSaveSuccessModal(true);
    } catch (err) {
      console.error('Error guardando prueba técnica:', err);
      alert('Error al guardar la prueba técnica en Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrado de ensayos en el modal de recuperación
  const ensayosFiltrados = useMemo(() => {
    return ensayosGuardados.filter((ensayo) => {
      const matchBusqueda =
        !busquedaHistorial ||
        (ensayo.clienteNombre || '').toLowerCase().includes(busquedaHistorial.toLowerCase()) ||
        (ensayo.centroNombre || '').toLowerCase().includes(busquedaHistorial.toLowerCase()) ||
        (ensayo.tecnicoNombre || '').toLowerCase().includes(busquedaHistorial.toLowerCase()) ||
        (ensayo.equipoAMedirLabel || '').toLowerCase().includes(busquedaHistorial.toLowerCase());

      const matchTipo =
        filtroTipoHistorial === 'todos' || ensayo.tipoEquipo === filtroTipoHistorial;

      return matchBusqueda && matchTipo;
    });
  }, [ensayosGuardados, busquedaHistorial, filtroTipoHistorial]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* ─── CABECERA PRINCIPAL ─── */}
      <div className="bg-white border-b border-zinc-200/80 sticky top-0 z-30 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left flex-1 sm:flex-initial">
            {selectedView !== 'menu' && (
              <button
                onClick={() => setSelectedView('menu')}
                className="flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold py-1.5 px-3 rounded-xl transition-all cursor-pointer mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm shrink-0">
              <Gauge className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">
                  {selectedView === 'menu'
                    ? 'Pruebas Técnicas'
                    : selectedView === 'red-publica'
                    ? 'Presión y Caudal en Red Pública'
                    : 'Presión y Caudal en Grupo de Presión'}
                </h1>
                <span className="bg-red-50 text-red-700 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-red-200">
                  {selectedView === 'menu' ? 'Operaciones' : 'Ensayo Hidráulico'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium hidden sm:block">
                Verificación de presión estática, dinámica y aforo de caudal según UNE 23500:2021 y Real Decreto 513/2017
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Recuperar Ensayos Anteriores */}
            <button
              onClick={() => setHistorialModal(true)}
              className="flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold py-2 px-3.5 rounded-xl border border-zinc-200/80 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
              title="Ver y recuperar ensayos técnicos anteriores guardados en Firestore"
            >
              <History className="w-4 h-4 text-zinc-600" />
              <span className="hidden sm:inline">Recuperar ensayos anteriores</span>
              <span className="sm:hidden">Recuperar</span>
              {ensayosGuardados.length > 0 && (
                <span className="bg-zinc-800 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  {ensayosGuardados.length}
                </span>
              )}
            </button>

            {selectedView === 'red-publica' && (
              <button
                onClick={() => handleExportPDF()}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <FileDown className="w-4 h-4" />
                <span className="hidden sm:inline">Descargar Informe PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
        {/* ─── VISTA 1: MENÚ DE SELECCIÓN DE TARJETAS ─── */}
        {selectedView === 'menu' && (
          <div>
            <div className="mb-6 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white rounded-3xl p-5 sm:p-6 shadow-lg border border-zinc-800 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0 mt-0.5">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Módulo de Ensayos y Verificaciones Hidráulicas
                </h2>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed max-w-2xl">
                  Selecciona el tipo de prueba técnica a realizar o consultar para registrar los valores de manometría, curvas de presión y aforos de caudal.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tarjeta 1: Red Pública */}
              <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between hover:border-blue-300 hover:shadow-blue-500/5">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm bg-blue-50 text-blue-600 border-blue-100">
                      <Droplets className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border bg-blue-100 text-blue-800 border-blue-200">
                      Red General
                    </span>
                  </div>

                  <h3 className="text-base font-black text-zinc-900 leading-snug">
                    Pruebas de presión y caudal en red pública
                  </h3>

                  <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                    Medición de presión estática, presión dinámica y comprobación de caudal nominal en la red general pública con 1 y 2 equipos simultáneos.
                  </p>

                  {/* DESPLEGABLE CON BUSCADOR DE ANTERIORES ENSAYOS DIRECTO EN LA TARJETA */}
                  <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-blue-600" />
                        Recuperar ensayo anterior:
                      </span>
                      {ensayosGuardados.length > 0 && (
                        <span className="text-[9px] text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded-full font-bold">
                          {ensayosGuardados.length} guardados
                        </span>
                      )}
                    </label>

                    <div className="relative">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const found = ensayosGuardados.find((ens) => ens.id === e.target.value);
                          if (found) {
                            handleCargarEnsayo(found);
                          }
                        }}
                        className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-xs transition-all"
                      >
                        <option value="" disabled>
                          {ensayosGuardados.length === 0
                            ? 'No hay ensayos guardados todavía'
                            : '🔍 Desplegar para buscar y cargar ensayo anterior...'}
                        </option>
                        {ensayosGuardados.map((ens) => {
                          const tLabel = REFERENCIAS_NORMATIVA[ens.tipoEquipo || 'bie25']?.nombre || ens.tipoEquipo || 'BIE';
                          const diag = ens.evaluacionGlobal === 'conforme' ? '✓ CONFORME' : '✗ NO CONFORME';
                          return (
                            <option key={ens.id} value={ens.id}>
                              {formatFechaEnsayo(ens.fechaEnsayo)} · {ens.clienteNombre || 'Sin cliente'} ({ens.centroNombre || 'Centro'}) - {tLabel} [{diag}]
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      // Limpiar campos y abrir nuevo ensayo
                      setClienteNombre('');
                      setCentroNombre('');
                      setPresionEstatica('');
                      setPresionDin1('');
                      setCaudal1('');
                      setPresionDin2('');
                      setCaudal2('');
                      setObservaciones('');
                      setSelectedView('red-publica');
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Nuevo Ensayo Hidráulico</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setHistorialModal(true)}
                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    title="Abrir historial detallado"
                  >
                    <History className="w-4 h-4" />
                    <span className="hidden sm:inline">Historial</span>
                  </button>
                </div>
              </div>

              {/* Tarjeta 2: Grupo de Presión */}
              <div
                onClick={() => setSelectedView('grupo-presion')}
                className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer group hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-amber-500/5"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm bg-amber-50 text-amber-600 border-amber-100 group-hover:scale-105 transition-transform">
                      <Activity className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border bg-amber-100 text-amber-800 border-amber-200">
                      Grupo de Bombeo
                    </span>
                  </div>

                  <h3 className="text-base font-black text-zinc-900 leading-snug group-hover:text-amber-600 transition-colors">
                    Pruebas de presión y caudal en grupo de presión
                  </h3>

                  <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                    Evaluación de bombas principales (eléctrica / diésel) y jockey, presiones de arranque/parada y curvas de caudal de abastecimiento.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Ensayos de Bombeo
                  </span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-all group-hover:translate-x-1 text-amber-600 bg-amber-50">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── VISTA 2: FORMULARIO Y CURVA P-Q EN RED PÚBLICA ─── */}
        {selectedView === 'red-publica' && (
          <div className="space-y-6">
            {/* 1. DATOS GENERALES DEL ENSAYO (UNIFICADOS) */}
            <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-red-600" />
                  <h3 className="text-xs sm:text-sm font-black text-zinc-900 uppercase tracking-wider">
                    Datos Generales del Ensayo
                  </h3>
                </div>
                <span className="text-[10px] font-extrabold bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full border border-red-200">
                  {normaActiva.norma}
                </span>
              </div>

              {/* Selector Rápido de Ensayos Anteriores */}
              {ensayosGuardados.length > 0 && (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 text-slate-700 text-xs font-bold shrink-0">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>Cargar datos de ensayo anterior:</span>
                  </div>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const found = ensayosGuardados.find((ens) => ens.id === e.target.value);
                      if (found) {
                        handleCargarEnsayo(found);
                      }
                    }}
                    className="w-full sm:max-w-md px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                  >
                    <option value="" disabled>
                      🔍 Seleccionar ensayo guardado para rellenar...
                    </option>
                    {ensayosGuardados.map((ens) => {
                      const tLabel = REFERENCIAS_NORMATIVA[ens.tipoEquipo || 'bie25']?.nombre || ens.tipoEquipo || 'BIE';
                      const diag = ens.evaluacionGlobal === 'conforme' ? '✓ OK' : '✗ No OK';
                      return (
                        <option key={ens.id} value={ens.id}>
                          {formatFechaEnsayo(ens.fechaEnsayo)} · {ens.clienteNombre || 'Sin cliente'} ({ens.centroNombre || 'Centro'}) - {tLabel} [{diag}]
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Empresa Mantenedora */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" /> Empresa Mantenedora *
                  </label>
                  <select
                    value={empresaMantenedora}
                    onChange={(e) => setEmpresaMantenedora(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 outline-none focus:border-red-500 focus:bg-white cursor-pointer shadow-sm"
                  >
                    {empresasLista && empresasLista.length > 0 ? (
                      empresasLista.map((emp) => (
                        <option key={emp._docId || emp.id || emp.nombre} value={emp.nombre}>
                          {emp.nombre}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="ABANFOC S.L.">ABANFOC S.L.</option>
                        <option value="ARC Seguretat i Serveis">ARC Seguretat i Serveis</option>
                        <option value="SEGUPRO">SEGUPRO</option>
                        <option value="Abanfoc en colaboración con Segupro">Abanfoc en colaboración con Segupro</option>
                        <option value="SERTEC ESPACIO">SERTEC ESPACIO</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 2. Equipo de Medición */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5 text-zinc-400" /> Equipo de Medición *
                  </label>
                  <select
                    value={equipoMedicion}
                    onChange={(e) => setEquipoMedicion(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 outline-none focus:border-red-500 focus:bg-white cursor-pointer shadow-sm"
                  >
                    <option value="HoneyWell ISSUE3 PK 80083">HoneyWell ISSUE3 PK 80083</option>
                  </select>
                </div>

                {/* 3. Equipo a Medir / Red */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-red-500" /> Equipo a Medir *
                  </label>
                  <select
                    value={tipoEquipo}
                    onChange={(e) => setTipoEquipo(e.target.value as TipoEquipoMedir)}
                    className="w-full px-3.5 py-2.5 bg-red-50/60 border border-red-300 rounded-xl text-xs font-black text-red-950 outline-none focus:border-red-500 focus:bg-white cursor-pointer shadow-sm"
                  >
                    {Object.values(REFERENCIAS_NORMATIVA).map((ref) => (
                      <option key={ref.id} value={ref.id}>
                        {ref.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Cliente / Titular */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Cliente / Razón Social *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Centro Comercial Los Alisios"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 outline-none focus:border-red-500 focus:bg-white"
                  />
                </div>

                {/* 5. Centro / Ubicación */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Centro / Edificio / Ubicación *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Nave 4 - Polígono Industrial"
                    value={centroNombre}
                    onChange={(e) => setCentroNombre(e.target.value)}
                    className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 outline-none focus:border-red-500 focus:bg-white"
                  />
                </div>

                {/* 6. Fecha y Hora */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-400" /> Fecha
                    </label>
                    <input
                      type="date"
                      value={fechaEnsayo}
                      onChange={(e) => setFechaEnsayo(e.target.value)}
                      className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 outline-none focus:border-red-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-400" /> Hora
                    </label>
                    <input
                      type="time"
                      value={horaEnsayo}
                      onChange={(e) => setHoraEnsayo(e.target.value)}
                      className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 outline-none focus:border-red-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* 7. Técnico Responsable */}
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3 text-zinc-400" /> Técnico Responsable de la Inspección
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre del técnico"
                    value={tecnicoNombre}
                    onChange={(e) => setTecnicoNombre(e.target.value)}
                    className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 outline-none focus:border-red-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Ficha de exigencias normativas del equipo seleccionado */}
              <div className="mt-4 p-3 bg-red-50/50 rounded-2xl border border-red-200/80 text-[11px] text-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-extrabold text-red-900">{normaActiva.nombre} ({normaActiva.norma}):</span>{' '}
                  Presión mínima: <strong className="text-red-700">{normaActiva.presionMin} bar</strong> | Caudal 1 equipo: <strong className="text-emerald-700">{normaActiva.caudalMin1Eq} l/min</strong> | Caudal 2 equipos simultáneos: <strong className="text-indigo-700">{normaActiva.caudalMin2Eq} l/min</strong>.
                </div>
                <div className="text-[10px] text-zinc-500 font-bold shrink-0">
                  Autonomía mínima: {normaActiva.tiempoAutonomiaMin} min
                </div>
              </div>
            </div>

            {/* 2. Mediciones Hidráulicas: 2 Pruebas (1 Equipo y 2 Equipos Simultáneos) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Columna Izquierda: Entradas de Datos */}
              <div className="lg:col-span-1 space-y-4">
                {/* Presión Estática */}
                <div className="bg-blue-50/70 border border-blue-200 rounded-3xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                      P₀
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-blue-900 uppercase">Presión Estática Inicial</h4>
                      <p className="text-[10px] text-blue-700 font-medium">Red cerrada a caudal cero (Q = 0)</p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Ej. 5.5"
                      value={presionEstatica}
                      onChange={(e) => setPresionEstatica(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-blue-300 rounded-xl text-sm font-black text-blue-950 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-blue-600">
                      bar
                    </span>
                  </div>
                </div>

                {/* Prueba 1: 1 Equipo */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-3xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                        1
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-emerald-950 uppercase">Prueba 1: Un Equipo</h4>
                        <p className="text-[10px] text-emerald-700 font-medium">Equipo más desfavorable</p>
                      </div>
                    </div>
                    {p1Num > 0 && q1Num > 0 && (
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          cumplePrueba1 ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                        }`}
                      >
                        {cumplePrueba1 ? 'Cumple' : 'No cumple'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[9px] font-extrabold text-emerald-800 uppercase mb-0.5">
                        Ubicación Equipo 1
                      </label>
                      <input
                        type="text"
                        value={equipo1Ubicacion}
                        onChange={(e) => setEquipo1Ubicacion(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-medium text-emerald-950 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-extrabold text-emerald-800 uppercase mb-0.5">
                          Presión Dinámica
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Ej. 3.2"
                            value={presionDin1}
                            onChange={(e) => setPresionDin1(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-black text-emerald-950 outline-none"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-700">
                            bar
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-emerald-800 uppercase mb-0.5">
                          Caudal Medido
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            placeholder="Ej. 100"
                            value={caudal1}
                            onChange={(e) => setCaudal1(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-black text-emerald-950 outline-none"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-700">
                            l/min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prueba 2: 2 Equipos Simultáneos */}
                <div className="bg-purple-50/70 border border-purple-200 rounded-3xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs">
                        2
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-purple-950 uppercase">Prueba 2: Dos Equipos</h4>
                        <p className="text-[10px] text-purple-700 font-medium">Apertura simultánea (simultaneidad)</p>
                      </div>
                    </div>
                    {p2Num > 0 && q2Num > 0 && (
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          cumplePrueba2 ? 'bg-purple-200 text-purple-900' : 'bg-red-200 text-red-900'
                        }`}
                      >
                        {cumplePrueba2 ? 'Cumple' : 'No cumple'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[9px] font-extrabold text-purple-800 uppercase mb-0.5">
                        Ubicación Equipo 2
                      </label>
                      <input
                        type="text"
                        value={equipo2Ubicacion}
                        onChange={(e) => setEquipo2Ubicacion(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-xl text-xs font-medium text-purple-950 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-extrabold text-purple-800 uppercase mb-0.5">
                          Presión Dinámica
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Ej. 2.6"
                            value={presionDin2}
                            onChange={(e) => setPresionDin2(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-xl text-xs font-black text-purple-950 outline-none"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-purple-700">
                            bar
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-purple-800 uppercase mb-0.5">
                          Caudal Medido (2.º Eq.)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            placeholder="Ej. 100"
                            value={caudal2}
                            onChange={(e) => setCaudal2(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-xl text-xs font-black text-purple-950 outline-none"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-purple-700">
                            l/min
                          </span>
                        </div>
                      </div>
                    </div>

                    {q1Num > 0 && q2Num > 0 && (
                      <div className="mt-1.5 p-2 bg-purple-100/90 border border-purple-200 rounded-xl text-[10px] font-bold text-purple-950 flex items-center justify-between shadow-xs">
                        <span className="flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5 text-purple-700" />
                          Caudal Total Simultáneo (Q₁ + Q₂):
                        </span>
                        <span className="text-xs font-black text-purple-900 bg-white px-2 py-0.5 rounded-lg border border-purple-300">
                          {qTotalNum} l/min
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Gráfico Curva P-Q y Análisis de Variación */}
              <div className="lg:col-span-2 space-y-4">
                {/* Gráfico Curva P-Q */}
                <GraficoCurvaPresionCaudal
                  presionEstatica={pEstNum}
                  p1={p1Num}
                  q1={q1Num}
                  p2={p2Num}
                  q2={qTotalNum}
                  tipoEquipo={tipoEquipo}
                />

                {/* Tarjeta de Análisis de Variación y Diagnóstico */}
                <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-800 mb-3 flex items-center justify-between">
                    <span>Diagnóstico y Análisis de Variación Hidráulica</span>
                    {evaluacionGlobal === 'conforme' && (
                      <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Conforme UNE / RIPCI
                      </span>
                    )}
                    {evaluacionGlobal === 'no_conforme' && (
                      <span className="text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        No Conforme
                      </span>
                    )}
                    {evaluacionGlobal === 'pendiente' && (
                      <span className="text-[10px] font-bold uppercase bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-full">
                        Datos Pendientes
                      </span>
                    )}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                        Caída de Presión
                      </span>
                      <span
                        className={`text-base font-black ${
                          caidaPresion > 1.5 ? 'text-amber-600' : 'text-zinc-900'
                        }`}
                      >
                        {p1Num > 0 && p2Num > 0 ? `${caidaPresion.toFixed(2)} bar` : '--'}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        {p1Num > 0 && p2Num > 0 ? `Variación: ${variacionPorcentualP.toFixed(1)}%` : 'Diferencia P1 - P2'}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                        Incremento de Caudal
                      </span>
                      <span className="text-base font-black text-zinc-900">
                        {q1Num > 0 && q2Num > 0 ? `+${incrementoCaudal} l/min` : '--'}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        Al abrir el 2.º equipo
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                        Margen vs. Norma Mín.
                      </span>
                      <span
                        className={`text-base font-black ${
                          p2Num >= normaActiva.presionMin ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {p2Num > 0 ? `${(p2Num - normaActiva.presionMin >= 0 ? '+' : '')}${(p2Num - normaActiva.presionMin).toFixed(2)} bar` : '--'}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        Sobre {normaActiva.presionMin} bar mín.
                      </span>
                    </div>
                  </div>

                  {/* Observaciones técnicas con aviso de dictamen */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Observaciones / Conclusiones del Ensayo
                      </label>
                      {evaluacionGlobal === 'no_conforme' && (
                        <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          Prueba No Conforme
                        </span>
                      )}
                      {evaluacionGlobal === 'conforme' && (
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Prueba Conforme
                        </span>
                      )}
                    </div>
                    {evaluacionGlobal === 'no_conforme' && (
                      <div className="mb-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                          <span className="font-black text-red-800">Prueba no conforme.</span>
                          <span className="font-medium text-red-700 text-[11px]">
                            No se han alcanzado los requisitos de presión y caudal exigidos por la {(tipoEquipo === 'bie25' || tipoEquipo === 'bie45') ? 'norma UNE 23500:2021 y el Real Decreto 513/2017 de 22 de mayo' : `norma ${normaActiva.norma}`}.
                          </span>
                        </div>
                      </div>
                    )}
                    <textarea
                      rows={2}
                      placeholder="Anotar detalles adicionales del suministro, pérdidas de carga o incidencias..."
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 outline-none focus:border-red-500 focus:bg-white resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedView('menu')}
                className="px-5 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-bold hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setHistorialModal(true)}
                className="px-4 py-2.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <History className="w-4 h-4 text-zinc-600" />
                <span>Recuperar ensayos anteriores</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportPDF()}
                className="px-5 py-2.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-red-600" />
                <span>Descargar Informe PDF</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleGuardarPrueba}
                className="bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-red-600/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Guardando ensayo...' : 'Guardar Ensayo Hidráulico'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── VISTA 3: GRUPO DE PRESIÓN (PRÓXIMAMENTE) ─── */}
        {selectedView === 'grupo-presion' && (
          <div className="bg-white border border-zinc-200 rounded-3xl p-8 text-center max-w-xl mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-zinc-900 mb-2">
              Pruebas de Presión y Caudal en Grupo de Presión
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed mb-6">
              Módulo de registro y evaluación de bombas eléctricas/diésel, presión de arranque/parada y curvas características de grupo de presión contra incendios.
            </p>
            <button
              onClick={() => setSelectedView('menu')}
              className="bg-zinc-900 hover:bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Volver al selector de pruebas
            </button>
          </div>
        )}
      </div>

      {/* ─── MODAL FLOTANTE: RECUPERAR ENSAYOS ANTERIORES ─── */}
      {historialModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-zinc-100 overflow-hidden">
            {/* Cabecera del modal */}
            <div className="p-5 sm:p-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shadow-sm">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">
                    Recuperar Ensayos Anteriores
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Historial de pruebas de presión y caudal guardadas en Firebase ({ensayosGuardados.length} registros)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistorialModal(false)}
                className="w-9 h-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="p-4 sm:px-6 border-b border-zinc-100 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, centro, técnico..."
                  value={busquedaHistorial}
                  onChange={(e) => setBusquedaHistorial(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 outline-none focus:border-red-500 focus:bg-white"
                />
              </div>

              <div>
                <select
                  value={filtroTipoHistorial}
                  onChange={(e) => setFiltroTipoHistorial(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 outline-none focus:border-red-500 focus:bg-white cursor-pointer"
                >
                  <option value="todos">Todos los equipos</option>
                  <option value="bie25">BIE 25 mm</option>
                  <option value="bie45">BIE 45 mm</option>
                  <option value="hidrante45">Hidrante 45 mm</option>
                  <option value="hidrante70">Hidrante 70 mm</option>
                  <option value="hidrante100">Hidrante 100 mm</option>
                </select>
              </div>
            </div>

            {/* Lista de Ensayos */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 divide-y divide-zinc-100">
              {ensayosFiltrados.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-3">
                    <History className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-700 mb-1">
                    No se encontraron ensayos guardados
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    {ensayosGuardados.length === 0
                      ? 'Aún no se ha guardado ningún ensayo de presión y caudal.'
                      : 'No hay registros que coincidan con los filtros de búsqueda.'}
                  </p>
                </div>
              ) : (
                ensayosFiltrados.map((ensayo) => {
                  const tEq = ensayo.tipoEquipo || 'bie25';
                  const refN = REFERENCIAS_NORMATIVA[tEq];
                  const p1 = ensayo.prueba1?.presionDin || 0;
                  const q1 = ensayo.prueba1?.caudal || 0;
                  const p2 = ensayo.prueba2?.presionDin || 0;
                  const q2 = ensayo.prueba2?.caudal || 0;
                  const qTot = ensayo.prueba2?.caudalTotalSimultaneo || (q2 >= (refN?.caudalMin2Eq || 200) ? q2 : q1 + q2);
                  const esConforme = ensayo.evaluacionGlobal === 'conforme';

                  return (
                    <div
                      key={ensayo.id}
                      className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-200/80 hover:border-red-200 hover:bg-red-50/20 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              esConforme
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-red-100 text-red-800 border-red-200'
                            }`}
                          >
                            {esConforme ? 'Conforme' : 'No Conforme'}
                          </span>

                          <span className="text-[10px] font-extrabold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md">
                            {refN?.nombre || ensayo.equipoAMedirLabel || 'BIE / Hidrante'}
                          </span>

                          <span className="text-[11px] text-zinc-400 font-medium">
                            {formatFechaEnsayo(ensayo.fechaEnsayo)} {ensayo.horaEnsayo && `· ${ensayo.horaEnsayo}`}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-zinc-900">
                          {ensayo.clienteNombre || 'Cliente no indicado'}
                        </h4>

                        <p className="text-xs text-zinc-500 font-medium">
                          {ensayo.centroNombre && `${ensayo.centroNombre} | `}
                          Técnico: <span className="font-semibold text-zinc-700">{ensayo.tecnicoNombre || 'No asignado'}</span>
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1 font-semibold text-zinc-600">
                          <span>P₀: <strong className="text-blue-700">{ensayo.presionEstatica || '--'} bar</strong></span>
                          <span>Prueba 1: <strong className="text-emerald-700">{p1} bar | {q1} l/min</strong></span>
                          <span>Prueba 2: <strong className="text-purple-700">{p2} bar | {qTot} l/min total</strong></span>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => handleCargarEnsayo(ensayo)}
                          className="flex items-center gap-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold py-2 px-3 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                          title="Cargar estos datos en el formulario activo"
                        >
                          <FolderOpen className="w-4 h-4 text-emerald-400" />
                          <span>Cargar</span>
                        </button>

                        <button
                          onClick={() => handleExportPDF(ensayo)}
                          className="flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold py-2 px-2.5 rounded-xl border border-zinc-200 transition-all active:scale-95 cursor-pointer"
                          title="Descargar Informe PDF de este ensayo"
                        >
                          <FileDown className="w-4 h-4 text-red-600" />
                          <span>PDF</span>
                        </button>

                        <button
                          onClick={() => handleEliminarEnsayo(ensayo.id, ensayo.clienteNombre || '')}
                          className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-red-100 hover:text-red-700 text-zinc-400 flex items-center justify-center transition-colors cursor-pointer"
                          title="Eliminar este ensayo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie del modal */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-medium">
                Mostrando {ensayosFiltrados.length} de {ensayosGuardados.length} ensayos
              </span>
              <button
                onClick={() => setHistorialModal(false)}
                className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE ÉXITO AL GUARDAR ─── */}
      {saveSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-zinc-100">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>
            <h3 className="text-lg font-black text-zinc-900 mb-1">
              Ensayo Hidráulico Registrado
            </h3>
            <p className="text-xs text-zinc-500 mb-6">
              Los datos de presión, caudal y la curva P-Q se han guardado correctamente en Firebase Firestore.
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => handleExportPDF()}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-2xl font-bold text-xs shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Descargar Informe PDF</span>
              </button>
              <button
                onClick={() => {
                  setSaveSuccessModal(false);
                  setHistorialModal(true);
                }}
                className="w-full bg-zinc-900 hover:bg-black text-white py-3 rounded-2xl font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <History className="w-4 h-4 text-emerald-400" />
                <span>Ver en Historial de Ensayos</span>
              </button>
              <button
                onClick={() => {
                  setSaveSuccessModal(false);
                  setSelectedView('menu');
                }}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer"
              >
                Aceptar y Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
