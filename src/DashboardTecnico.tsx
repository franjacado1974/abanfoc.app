import { useState, useMemo, useEffect } from 'react';
import { FileText, Package, Users, Power, LogOut, FileCheck, Inbox } from 'lucide-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import PartesTecnico from './PartesTecnico';
import RevisionChecklist from './RevisionChecklist';
import Albaranes from './Albaranes';
import Clientes from './Clientes';
import Centros from './Centros';
import Catalogo from './Catalogo';
import Buzon from './Buzon';
import { APP_VERSION } from './constants';

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

type TecnicoView = 'dashboard' | 'partes' | 'albaranes' | 'clientes' | 'centros' | 'catalogo' | 'buzon';

// ─── PANTALLA PRINCIPAL DEL TÉCNICO ──────────────────────────────────────────
function DashboardHome({ loggedUser, onLogout, onNavigate }: DashboardTecnicoProps & { onNavigate: (view: TecnicoView) => void }) {
  const [appLogo] = useState(() => {
    try {
      return localStorage.getItem('firecheck_db_logo') || '/favicon.png';
    } catch {
      return '/favicon.png';
    }
  });

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [hasUnreadBuzon, setHasUnreadBuzon] = useState(false);

  // Escuchar novedades del buzon para el técnico
  useEffect(() => {
    try {
      const q = query(collection(db, 'buzon'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const lastSeenStr = localStorage.getItem('firecheck_buzon_last_seen');
        const lastSeen = lastSeenStr ? parseInt(lastSeenStr, 10) : 0;

        let unread = false;
        snapshot.docs.forEach((d) => {
          const data = d.data();
          let docTime = 0;
          if (data.updatedAt) {
            docTime = typeof data.updatedAt.toMillis === 'function' ? data.updatedAt.toMillis() : Number(data.updatedAt);
          } else if (data.createdAt) {
            docTime = typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : Number(data.createdAt);
          }

          if (Array.isArray(data.comentarios) && data.comentarios.length > 0) {
            data.comentarios.forEach((c: any) => {
              if (c.id) {
                const parts = c.id.split('_');
                if (parts[1]) {
                  const cTime = parseInt(parts[1], 10);
                  if (!isNaN(cTime) && cTime > docTime) docTime = cTime;
                }
              }
            });
          }

          if (docTime > lastSeen) {
            unread = true;
          }
        });

        setHasUnreadBuzon(unread);
      }, (err) => {
        console.warn('Error escuchando buzon en DashboardHome:', err);
      });
      return () => unsub();
    } catch (err) {
      console.warn('Error configurando listener buzon en DashboardHome:', err);
    }
  }, []);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleCardClick = (cardId: TecnicoView) => {
    if (cardId === 'buzon') {
      localStorage.setItem('firecheck_buzon_last_seen', String(Date.now()));
      setHasUnreadBuzon(false);
    }
    onNavigate(cardId);
  };

  const stats = useMemo(() => {
    let partes = 0;
    let partesPendientes = 0;
    let catalogo = 0;
    let clientes = 0;
    let centros = 0;
    let albaranes = 0;

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

      const savedAlbaranes = localStorage.getItem('firecheck_db_albaranes');
      if (savedAlbaranes) {
        const parsed = JSON.parse(savedAlbaranes);
        albaranes = Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch { /* ignore */ }

    return { partes, partesPendientes, catalogo, clientes, centros, albaranes };
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
      id: 'albaranes' as TecnicoView,
      title: 'Albaranes',
      description: 'Consulta y gestiona albaranes',
      icon: FileCheck,
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderColor: 'border-emerald-200',
      hoverBorder: 'hover:border-emerald-400',
      textColor: 'text-emerald-900',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-700',
      badgeLabel: 'Documentos',
      clickable: true,
      stats: [
        { label: 'Albaranes', value: stats.albaranes },
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
      clickable: true,
      stats: [
        { label: 'Artículos y servicios', value: stats.catalogo },
      ],
    },
    {
      id: 'clientes' as TecnicoView,
      title: 'Clientes',
      description: 'Consulta el listado de clientes',
      icon: Users,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      hoverBorder: 'hover:border-blue-400',
      textColor: 'text-blue-900',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-700',
      badgeLabel: 'Gestión',
      clickable: true,
      stats: [
        { label: 'Clientes', value: stats.clientes },
      ],
    },
    {
      id: 'centros' as TecnicoView,
      title: 'Centros',
      description: 'Consulta los centros de trabajo',
      icon: Users,
      bgColor: 'bg-sky-50',
      iconColor: 'text-sky-600',
      borderColor: 'border-sky-200',
      hoverBorder: 'hover:border-sky-400',
      textColor: 'text-sky-900',
      badgeBg: 'bg-sky-100',
      badgeText: 'text-sky-700',
      badgeLabel: 'Instalaciones',
      clickable: true,
      stats: [
        { label: 'Centros', value: stats.centros },
      ],
    },
    {
      id: 'buzon' as TecnicoView,
      title: 'Buzón',
      description: 'Sugerencias y reporte de fallos detectados',
      icon: Inbox,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      hoverBorder: 'hover:border-purple-400',
      textColor: 'text-purple-900',
      badgeBg: 'bg-purple-100',
      badgeText: 'text-purple-700',
      badgeLabel: 'Comunicaciones',
      clickable: true,
      stats: [
        { label: 'Sugerencias y fallos', value: 'Buzón' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#DCE1E5]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200/60 shadow-sm relative">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <img
              src={appLogo}
              alt="Logo"
              className="h-11 w-11 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }}
            />
            <div>
              <p className="text-sm font-bold text-zinc-900 leading-tight">Panel Técnico</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Sistema de Gestión</p>
              <p className="text-[10px] font-semibold text-red-600 mt-0.5">{APP_VERSION}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCardClick('buzon')}
              className="relative p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 transition-all border border-purple-200 cursor-pointer"
              title="Buzón de sugerencias y fallos"
            >
              <Inbox className="w-4 h-4" />
              {hasUnreadBuzon && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.9)] border-2 border-white" />
              )}
            </button>
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
        <div className="h-0.5 bg-red-600 w-full" />
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card) => {
            const Icon = card.icon;
            const isBuzonUnread = card.id === 'buzon' && hasUnreadBuzon;
            return (
              <div
                key={card.id}
                onClick={card.clickable ? () => handleCardClick(card.id) : undefined}
                role={card.clickable ? 'button' : undefined}
                tabIndex={card.clickable ? 0 : undefined}
                onKeyDown={card.clickable ? (e) => { if (e.key === 'Enter') handleCardClick(card.id); } : undefined}
                className={`bg-white rounded-2xl border ${isBuzonUnread ? 'border-red-400 shadow-red-100 ring-2 ring-red-400/20' : `${card.borderColor} ${card.hoverBorder}`} shadow-sm hover:shadow-md transition-all duration-200 p-6 flex flex-col gap-4 ${card.clickable ? 'cursor-pointer active:scale-[0.97] select-none' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`relative w-12 h-12 rounded-2xl ${card.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${card.iconColor}`} />
                    {isBuzonUnread && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.9)] border-2 border-white" />
                    )}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${
                    isBuzonUnread
                      ? 'bg-red-600 text-white animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.7)]'
                      : `${card.badgeBg} ${card.badgeText}`
                  }`}>
                    {isBuzonUnread ? '¡Novedades!' : card.badgeLabel}
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

      {/* MODAL FLOTANTE CONFIRMACIÓN DE CERRAR SESIÓN */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden text-left">
            <div className="px-6 py-5 bg-red-50 border-b border-red-100 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-red-600 shadow-sm">
                <Power className="w-7 h-7 stroke-[2.5]" />
              </div>
              <h2 className="text-lg font-bold text-red-950">¿Cerrar sesión?</h2>
              <p className="text-sm text-red-600 mt-1">¿Estás seguro de que quieres cerrar la sesión actual?</p>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  sessionStorage.removeItem('firecheck_logged_user');
                  onLogout();
                }}
                className="w-full px-4 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
              >
                Sí, cerrar sesión
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-full px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
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

  if (currentView === 'albaranes') {
    return (
      <div className="min-h-screen bg-zinc-50 relative">
        {/* Cabecera para volver */}
        <div className="sticky top-0 z-50 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center gap-2 text-zinc-600 font-semibold"
          >
            <span className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
              ←
            </span>
            Volver
          </button>
        </div>
        {/* Renderizamos Albaranes (que ya controla su propio layout/scroll) */}
        <div className="pb-20">
          <Albaranes isTecnicoMode={true} />
        </div>
      </div>
    );
  }

  if (currentView === 'catalogo') {
    return (
      <div className="min-h-screen bg-zinc-50 relative">
        <div className="sticky top-0 z-50 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center gap-2 text-zinc-600 font-semibold"
          >
            <span className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">←</span>
            Volver
          </button>
        </div>
        <div className="pb-20">
          <Catalogo isTecnicoMode={true} />
        </div>
      </div>
    );
  }

  if (currentView === 'clientes') {
    return (
      <div className="min-h-screen bg-zinc-50 relative">
        <div className="sticky top-0 z-50 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center gap-2 text-zinc-600 font-semibold"
          >
            <span className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">←</span>
            Volver
          </button>
          <h1 className="text-lg font-bold text-zinc-900">Directorio de Clientes</h1>
        </div>
        <div className="p-4 sm:p-6 pb-20">
          <Clientes hideHeader={true} />
        </div>
      </div>
    );
  }

  if (currentView === 'centros') {
    return (
      <div className="min-h-screen bg-zinc-50 relative">
        <div className="sticky top-0 z-50 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center gap-2 text-zinc-600 font-semibold"
          >
            <span className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">←</span>
            Volver
          </button>
          <h1 className="text-lg font-bold text-zinc-900">Directorio de Centros</h1>
        </div>
        <div className="p-4 sm:p-6 pb-20">
          <Centros hideHeader={true} />
        </div>
      </div>
    );
  }

  if (currentView === 'buzon') {
    return <Buzon isTecnicoMode={true} onBack={() => setCurrentView('dashboard')} />;
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
        <Route path="/buzon" element={<Buzon isTecnicoMode={true} />} />
        <Route path="/revision-checklist" element={<RevisionChecklist />} />
      </Routes>
    </BrowserRouter>
  );
}
