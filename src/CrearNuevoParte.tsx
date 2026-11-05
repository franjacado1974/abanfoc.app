import { useNavigate } from 'react-router-dom';
import { Wrench, HardHat, Gauge, AlertTriangle, FilePlus2, ChevronRight } from 'lucide-react';

interface OpcionParte {
  id: string;
  titulo: string;
  descripcion: string;
  ruta: string;
  Icon: typeof Wrench;
  color: string;
  iconBg: string;
}

const OPCIONES: OpcionParte[] = [
  {
    id: 'crear-reparacion',
    titulo: 'Crear nuevo parte de reparación',
    descripcion: 'Reparaciones y averías en equipos del cliente.',
    ruta: '/reparaciones',
    Icon: Wrench,
    color: 'hover:border-sky-400 hover:shadow-sky-500/10',
    iconBg: 'bg-sky-100 text-sky-700'
  },
  {
    id: 'crear-instalacion',
    titulo: 'Crear nuevo parte de instalación',
    descripcion: 'Instalaciones y montajes de nuevos sistemas.',
    ruta: '/instalaciones',
    Icon: HardHat,
    color: 'hover:border-red-400 hover:shadow-red-500/10',
    iconBg: 'bg-red-100 text-red-700'
  },
  {
    id: 'crear-prueba-tecnica',
    titulo: 'Crear nuevo parte de prueba técnica',
    descripcion: 'Ensayos hidráulicos de presión y caudal.',
    ruta: '/pruebas-tecnicas',
    Icon: Gauge,
    color: 'hover:border-emerald-400 hover:shadow-emerald-500/10',
    iconBg: 'bg-emerald-100 text-emerald-700'
  },
  {
    id: 'crear-aviso-urgencia',
    titulo: 'Crear nuevo parte de aviso/urgencia',
    descripcion: 'Avisos urgentes y atención inmediata.',
    ruta: '/urgencias',
    Icon: AlertTriangle,
    color: 'hover:border-amber-400 hover:shadow-amber-500/10',
    iconBg: 'bg-amber-100 text-amber-700'
  }
];

export default function CrearNuevoParte() {
  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
          <FilePlus2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Crear nuevo parte</h1>
          <p className="text-xs sm:text-sm text-slate-500">Selecciona el tipo de parte de trabajo que quieres crear.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {OPCIONES.map(({ id, titulo, descripcion, ruta, Icon, color, iconBg }) => (
          <button
            key={id}
            id={id}
            type="button"
            onClick={() => navigate(ruta, { state: { abrirCrear: true } })}
            className={`group text-left bg-white border-2 border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-lg transition-all cursor-pointer ${color}`}
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
              <Icon className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm sm:text-base">{titulo}</p>
              <p className="text-xs text-slate-500 mt-0.5">{descripcion}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>
        ))}
      </div>
    </div>
  );
}
