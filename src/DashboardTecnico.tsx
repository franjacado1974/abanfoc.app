import { useState, useMemo } from 'react';
import { FileText, Package, Users, Power, LogOut } from 'lucide-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PartesTecnico from './PartesTecnico';
import RevisionChecklist from './RevisionChecklist';

interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  rol: string;
}

interface DashboardTecnicoProps {
  loggedUser: Usuario;
  onLogout: () => void;
}

type TecnicoView = 'dashboard' | 'partes';

// ─── PANTALLA PRINCIPAL DEL TÉCNICO ──────────────────────────────────────────
function DashboardHome({ loggedUser, onLogout, onNavigate }: DashboardTecnicoProps & { onNavigate: (view: TecnicoView) => void }) {
  const [appLogo] = useState(() => {
    try {
      return localStorage.getItem('firecheck_db_logo') || '/favicon.png';
    } catch {
      return '/favicon.png';
    }
  });

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que quieres cerrar la sesión?')) {
      sessionStorage.removeItem('firecheck_logged_user');
      onLogout();
    }
  };

  const stats = useMemo(() => {
    let partes = 0;
    let partesPendientes = 0;
    let catalogo = 0;
    let clientes = 0;
    let centros = 0;

    try {
      const savedPartes = localStorage.getItem('firecheck_db_partes');
      if (savedPartes) {
        const parsed = JSON.parse(savedPartes);
        partes = Array.isArray(parsed) ? parsed.length : 0;
        partesPendientes = Array.isArray(parsed)
          ? parsed.filter((p: any) => p.estado === 'Planificado' || p.estado === 'En Proceso').length
          : 0;
      }

      const savedArticulos = localStorage.getItem('firecheck_db_articulos');
      const articulosCount = savedArticulos
        ? (Array.isArray(JSON.parse(savedArticulos)) ? JSON.parse(savedArticulos).length : 0)
        : 0;
      const savedServicios = localStorage.getItem('firecheck_db_servicios');
      const serviciosCount = savedServicios
        ? (Array.isArray(JSON.parse(savedServicios)) ? JSON.parse(savedServicios).length : 0)
        : 0;
      catalogo = articulosCount + serviciosCount;

      const savedClientes = localStorage.getItem('firecheck_db_clientes');
      if (savedClientes) {
        const parsed = JSON.parse(savedClientes);
        clientes = Array.isArray(parsed) ? parsed.length : 0;
      }

      const savedCentros = localStorage.getItem('firecheck_db_centros');
      if (savedCentros) {
        const parsed = JSON.parse(savedCentros);
        centros = Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch { /* ignore */ }

    return { partes, partesPendientes, catalogo, clientes, centros };
  }, []);

  const cards = [
    {
      id: 'partes' as TecnicoView,
      title: 'Partes de Trabajo',
      description: 'Consulta tus partes de trabajo asignados',
      icon: FileText,
      bgColor: 'bg-violet-50',
      iconColor: 'text-violet-600',
      borderColor: 'border-violet-200',
      hoverBorder: 'hover:border-violet-400',
      textColor: 'text-violet-900',
      badgeBg: 'bg-violet-100',
      badgeText: 'text-violet-700',
      badgeLabel: 'Operaciones',
      clickable: true,
      stats: [
        { label: 'Total partes', value: stats.partes },
        { label: 'Pendientes', value: stats.partesPendientes },
      ],
    },
    {
      id: 'catalogo' as TecnicoView,
      title: 'Catálogo',
      description: 'Consulta artículos y servicios disponibles',
      icon: Package,
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      borderColor: 'border-orange-200',
      hoverBorder: 'hover:border-orange-400',
      textColor: 'text-orange-900',
      badgeBg: 'bg-orange-100',
      badgeText: 'text-orange-700',
      badgeLabel: 'Recursos',
      clickable: false,
      stats: [
        { label: 'Artículos y servicios', value: stats.catalogo },
      ],
    },
    {
      id: 'clientes-centros' as TecnicoView,
      title: 'Clientes y Centros',
      description: 'Consulta clientes e instalaciones',
      icon: Users,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      hoverBorder: 'hover:border-blue-400',
      textColor: 'text-blue-900',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-700',
      badgeLabel: 'Gestión',
      clickable: false,
      stats: [
        { label: 'Clientes', value: stats.clientes },
        { label: 'Centros', value: stats.centros },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f6f3]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200/60 shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <img
              src={appLogo}
              alt="Logo"
              className="h-9 w-9 object-contain rounded-xl ring-2 ring-orange-400/30"
              onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }}
            />
            <div>
              <p className="text-sm font-bold text-zinc-900 leading-tight">Panel Técnico</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Sistema de Gestión</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-xs font-bold text-orange-600 border border-orange-200">
                {loggedUser.nombre.charAt(0)}{loggedUser.apellidos.charAt(0)}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-800 leading-tight">
                  {loggedUser.nombre} {loggedUser.apellidos}
                </p>
                <p className="text-[10px] text-orange-500 uppercase font-bold tracking-wider">
                  {loggedUser.rol}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-600 text-xs font-bold transition-all border border-zinc-200 hover:border-red-200"
              title="Cerrar sesión"
            >
              <Power className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900">
            Hola, {loggedUser.nombre} 👋
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Aquí tienes un resumen de tu área de trabajo.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={card.clickable ? () => onNavigate(card.id) : undefined}
                role={card.clickable ? 'button' : undefined}
                tabIndex={card.clickable ? 0 : undefined}
                onKeyDown={card.clickable ? (e) => { if (e.key === 'Enter') onNavigate(card.id); } : undefined}
                className={`bg-white rounded-2xl border ${card.borderColor} ${card.hoverBorder} shadow-sm hover:shadow-md transition-all duration-200 p-6 flex flex-col gap-4 ${card.clickable ? 'cursor-pointer active:scale-[0.97] select-none' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-2xl ${card.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${card.iconColor}`} />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${card.badgeBg} ${card.badgeText}`}>
                    {card.badgeLabel}
                  </span>
                </div>

                <div>
                  <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    {card.title}
                    {card.clickable && (
                      <span className="text-[10px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-md">Ver →</span>
                    )}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">{card.description}</p>
                </div>

                <div className="flex gap-4 pt-2 border-t border-zinc-100">
                  {card.stats.map((stat) => (
                    <div key={stat.label}>
                      <p className={`text-2xl font-black ${card.textColor} leading-none`}>{stat.value}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs text-zinc-400">
            Sesión activa como <span className="font-semibold text-zinc-600">{loggedUser.nombre} {loggedUser.apellidos}</span>
            {' · '}
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-600 font-semibold transition-colors inline-flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              Cerrar sesión
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── WRAPPER PRINCIPAL CON ESTADO DE NAVEGACIÓN ───────────────────────────────
function TecnicoApp({ loggedUser, onLogout }: DashboardTecnicoProps) {
  const [currentView, setCurrentView] = useState<TecnicoView>('dashboard');

  if (currentView === 'partes') {
    return (
      <PartesTecnico
        loggedUser={loggedUser}
        onBack={() => setCurrentView('dashboard')}
      />
    );
  }

  return (
    <DashboardHome
      loggedUser={loggedUser}
      onLogout={onLogout}
      onNavigate={setCurrentView}
    />
  );
}

// ─── EXPORT CON ROUTER (para que RevisionChecklist pueda usar useNavigate) ────
export default function DashboardTecnico({ loggedUser, onLogout }: DashboardTecnicoProps) {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<TecnicoApp loggedUser={loggedUser} onLogout={onLogout} />} />
        <Route path="/revision-checklist" element={<RevisionChecklist />} />
      </Routes>
    </BrowserRouter>
  );
}
