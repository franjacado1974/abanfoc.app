import { useState, useEffect } from 'react';
import { FileText, Package, Power, LogOut, FileCheck, Inbox, Gauge, Calendar, AlertTriangle, Building2 } from 'lucide-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { 
  db, 
  subscribePartes, 
  subscribeCentros, 
  subscribeAlbaranes, 
  subscribeArticulos, 
  subscribeClientes 
} from './firebase';
import PartesTecnico from './PartesTecnico';
import RevisionChecklist from './RevisionChecklist';
import Albaranes from './Albaranes';
import Clientes from './Clientes';
import Centros from './Centros';
import Catalogo from './Catalogo';
import Buzon from './Buzon';
import PruebasTecnicas from './PruebasTecnicas';
import Calendario from './Calendario';
import Urgencias from './Urgencias';
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

type TecnicoView = 'dashboard' | 'partes' | 'albaranes' | 'clientes' | 'centros' | 'catalogo' | 'buzon' | 'pruebas-tecnicas' | 'calendario' | 'urgencias';

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

  // Función para calcular estadísticas desde localStorage o estado inicial
  const calculateLocalStats = () => {
    let partes = 0;
    let partesPendientes = 0;
    let catalogo = 0;
    let clientes = 0;
    let centros = 0;
    let albaranes = 0;
    let urgencias = 0;
    let urgenciasPendientes = 0;

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

      const savedUrgencias = localStorage.getItem('firecheck_db_urgencias');
      if (savedUrgencias) {
        const parsed = JSON.parse(savedUrgencias);
        urgencias = Array.isArray(parsed) ? parsed.length : 0;
        urgenciasPendientes = Array.isArray(parsed)
          ? parsed.filter((u: any) => u.estado !== 'Solucionado' && u.estado !== 'Finalizado').length
          : 0;
      }
    } catch { /* ignore */ }

    return { partes, partesPendientes, catalogo, clientes, centros, albaranes, urgencias, urgenciasPendientes };
  };

  const [stats, setStats] = useState(calculateLocalStats);

  // Escuchar novedades en tiempo real de Firestore para que las tarjetas reflejen los datos reales de inmediato
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    try {
      // 1. Partes
      unsubs.push(subscribePartes((items) => {
        try { localStorage.setItem('firecheck_db_partes', JSON.stringify(items)); } catch {}
        const count = items.length;
        const pends = items.filter((p: any) => p.estado === 'Planificado' || p.estado === 'En Proceso').length;
        setStats(prev => ({ ...prev, partes: count, partesPendientes: pends }));
      }));
    } catch (e) { console.warn(e); }

    try {
      // 2. Centros
      unsubs.push(subscribeCentros((items) => {
        try { localStorage.setItem('firecheck_db_centros', JSON.stringify(items)); } catch {}
        setStats(prev => ({ ...prev, centros: items.length }));
      }));
    } catch (e) { console.warn(e); }

    try {
      // 3. Albaranes
      unsubs.push(subscribeAlbaranes((items) => {
        try { localStorage.setItem('firecheck_db_albaranes', JSON.stringify(items)); } catch {}
        setStats(prev => ({ ...prev, albaranes: items.length }));
      }));
    } catch (e) { console.warn(e); }

    try {
      // 4. Catálogo: Artículos
      unsubs.push(subscribeArticulos((items) => {
        try { localStorage.setItem('firecheck_db_articulos', JSON.stringify(items)); } catch {}
        setStats(prev => {
          let serv = 0;
          try {
            const savedServicios = localStorage.getItem('firecheck_db_servicios');
            serv = savedServicios ? JSON.parse(savedServicios).length : 0;
          } catch {}
          return { ...prev, catalogo: items.length + serv };
        });
      }));
    } catch (e) { console.warn(e); }

    try {
      // 5. Catálogo: Servicios
      const qServ = collection(db, 'servicios');
      const unsubServ = onSnapshot(qServ, (snap) => {
        const servItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        try { localStorage.setItem('firecheck_db_servicios', JSON.stringify(servItems)); } catch {}
        setStats(prev => {
          let arts = 0;
          try {
            const savedArticulos = localStorage.getItem('firecheck_db_articulos');
            arts = savedArticulos ? JSON.parse(savedArticulos).length : 0;
          } catch {}
          return { ...prev, catalogo: servItems.length + arts };
        });
      });
      unsubs.push(unsubServ);
    } catch (e) { console.warn(e); }

    try {
      // 6. Clientes
      unsubs.push(subscribeClientes((items) => {
        try { localStorage.getItem('firecheck_db_clientes'); } catch {}
        setStats(prev => ({ ...prev, clientes: items.length }));
      }));
    } catch (e) { console.warn(e); }

    try {
      // 7. Avisos / Urgencias
      const qUrg = collection(db, 'urgencias');
      const unsubUrg = onSnapshot(qUrg, (snap) => {
        const urgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        try { localStorage.setItem('firecheck_db_urgencias', JSON.stringify(urgs)); } catch {}
        const pends = urgs.filter((u: any) => u.estado !== 'Solucionado' && u.estado !== 'Finalizado').length;
        setStats(prev => ({ ...prev, urgencias: urgs.length, urgenciasPendientes: pends }));
      });
      unsubs.push(unsubUrg);
    } catch (e) { console.warn(e); }

    return () => {
      unsubs.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

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

  const cards = [
    {
      id: 'calendario' as TecnicoView,
      title: 'Calendario',
      description: 'Planificación de trabajos y revisiones',
      icon: Calendar,
      bgColor: 'bg-rose-500/10 text-rose-600',
      iconColor: 'text-rose-600',
      borderColor: 'border-rose-200/80',
      hoverBorder: 'hover:border-rose-400 hover:shadow-rose-100',
      textColor: 'text-rose-700',
      badgeBg: 'bg-rose-100/80',
      badgeText: 'text-rose-700',
      badgeLabel: 'Agenda',
      clickable: true,
      stats: [
        { label: 'Mes actual', value: stats.partesPendientes },
      ],
    },
    {
      id: 'partes' as TecnicoView,
      title: 'Partes de Trabajo',
      description: 'Partes asignados e intervenciones',
      icon: FileText,
      bgColor: 'bg-violet-500/10 text-violet-600',
      iconColor: 'text-violet-600',
      borderColor: 'border-violet-200/80',
      hoverBorder: 'hover:border-violet-400 hover:shadow-violet-100',
      textColor: 'text-violet-700',
      badgeBg: 'bg-violet-100/80',
      badgeText: 'text-violet-700',
      badgeLabel: 'Operaciones',
      clickable: true,
      stats: [
        { label: 'Total', value: stats.partes },
        { label: 'Pendientes', value: stats.partesPendientes },
      ],
    },
    {
      id: 'catalogo' as TecnicoView,
      title: 'Catálogo',
      description: 'Artículos, productos y servicios',
      icon: Package,
      bgColor: 'bg-orange-500/10 text-orange-600',
      iconColor: 'text-orange-600',
      borderColor: 'border-orange-200/80',
      hoverBorder: 'hover:border-orange-400 hover:shadow-orange-100',
      textColor: 'text-orange-700',
      badgeBg: 'bg-orange-100/80',
      badgeText: 'text-orange-700',
      badgeLabel: 'Tarifario',
      clickable: true,
      stats: [
        { label: 'Artículos', value: stats.catalogo },
      ],
    },
    {
      id: 'urgencias' as TecnicoView,
      title: 'Avisos',
      description: 'Avisos de averías e incidencias urgentes',
      icon: AlertTriangle,
      bgColor: 'bg-zinc-900 text-white',
      iconColor: 'text-amber-400',
      borderColor: 'border-zinc-800',
      hoverBorder: 'hover:border-black hover:shadow-zinc-300',
      textColor: 'text-zinc-900',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-900',
      badgeLabel: 'Avisos',
      clickable: true,
      stats: [
        { label: 'Total avisos', value: stats.urgencias },
        { label: 'Pendientes', value: stats.urgenciasPendientes },
      ],
    },
    {
      id: 'albaranes' as TecnicoView,
      title: 'Albaranes',
      description: 'Consulta y gestiona albaranes de entrega',
      icon: FileCheck,
      bgColor: 'bg-emerald-500/10 text-emerald-600',
      iconColor: 'text-emerald-600',
      borderColor: 'border-emerald-200/80',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-100',
      textColor: 'text-emerald-700',
      badgeBg: 'bg-emerald-100/80',
      badgeText: 'text-emerald-700',
      badgeLabel: 'Documentos',
      clickable: true,
      stats: [
        { label: 'Albaranes', value: stats.albaranes },
      ],
    },
    {
      id: 'centros' as TecnicoView,
      title: 'Centros',
      description: 'Ubicaciones de centros de trabajo',
      icon: Building2,
      bgColor: 'bg-sky-500/10 text-sky-600',
      iconColor: 'text-sky-600',
      borderColor: 'border-sky-200/80',
      hoverBorder: 'hover:border-sky-400 hover:shadow-sky-100',
      textColor: 'text-sky-700',
      badgeBg: 'bg-sky-100/80',
      badgeText: 'text-sky-700',
      badgeLabel: 'Instalaciones',
      clickable: true,
      stats: [
        { label: 'Centros', value: stats.centros },
      ],
    },
    {
      id: 'pruebas-tecnicas' as TecnicoView,
      title: 'Pruebas Técnicas',
      description: 'Presión y caudal en red y bombas',
      icon: Gauge,
      bgColor: 'bg-red-500/10 text-red-600',
      iconColor: 'text-red-600',
      borderColor: 'border-red-200/80',
      hoverBorder: 'hover:border-red-400 hover:shadow-red-100',
      textColor: 'text-red-700',
      badgeBg: 'bg-red-100/80',
      badgeText: 'text-red-700',
      badgeLabel: 'Operaciones',
      clickable: true,
      stats: [
        { label: 'Ensayos', value: '2 Tipos' },
      ],
    },
    {
      id: 'buzon' as TecnicoView,
      title: 'Buzón',
      description: 'Sugerencias y reporte de incidencias',
      icon: Inbox,
      bgColor: 'bg-purple-500/10 text-purple-600',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200/80',
      hoverBorder: 'hover:border-purple-400 hover:shadow-purple-100',
      textColor: 'text-purple-700',
      badgeBg: 'bg-purple-100/80',
      badgeText: 'text-purple-700',
      badgeLabel: 'Buzón',
      clickable: true,
      stats: [
        { label: 'Mensajes', value: 'Buzón' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#1d3557] flex flex-col justify-between">
      {/* Top Bar compacta */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs relative">
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-2 sm:py-2.5">
          <div className="flex items-center gap-2.5">
            <img
              src={appLogo}
              alt="Logo"
              className="h-9 w-9 sm:h-10 sm:w-10 object-contain drop-shadow-xs"
              onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }}
            />
            <div>
              <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">Panel Técnico</p>
              <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Sistema de Operaciones</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 pr-1">
              <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center text-xs font-bold text-orange-600 border border-orange-200">
                {(loggedUser?.nombre || (loggedUser as any)?.usuario || 'T').charAt(0).toUpperCase()}{(loggedUser?.apellidos || '').charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {loggedUser?.nombre || (loggedUser as any)?.usuario || 'Técnico'}{loggedUser?.apellidos ? ` ${loggedUser.apellidos}` : ''}
                </p>
                <p className="text-[9px] text-orange-500 uppercase font-bold tracking-wider">
                  {loggedUser?.rol || 'técnico'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer border border-red-700"
              title="Cerrar sesión"
            >
              <Power className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
        <div className="h-0.5 bg-red-600 w-full" />
      </header>

      {/* Cuadrícula de 8 Tarjetas en una sola pantalla: 4x2 en tablet/PC o 2x4 en móvil */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-8 sm:pt-12 pb-6 flex flex-col justify-start">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
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
                className={`group relative bg-white rounded-2xl border ${isBuzonUnread ? 'border-red-400 shadow-red-100 ring-2 ring-red-400/20' : `${card.borderColor} ${card.hoverBorder}`} shadow-xs hover:shadow-md transition-all duration-200 p-3 sm:p-4 flex flex-col justify-between min-h-[130px] sm:min-h-[152px] ${card.clickable ? 'cursor-pointer active:scale-[0.98] select-none' : ''}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${card.bgColor} flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs`}>
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.iconColor}`} />
                    {isBuzonUnread && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.9)] border-2 border-white" />
                    )}
                  </div>
                  <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    isBuzonUnread
                      ? 'bg-red-600 text-white animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.7)]'
                      : `${card.badgeBg} ${card.badgeText}`
                  }`}>
                    {isBuzonUnread ? '¡Aviso!' : card.badgeLabel}
                  </span>
                </div>

                <div className="mt-2 sm:mt-3">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center justify-between">
                    <span className="truncate">{card.title}</span>
                    <span className="text-xs text-slate-400 font-semibold opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">→</span>
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2 leading-snug mt-1">{card.description}</p>
                </div>

                <div className="flex items-center gap-3 pt-2 sm:pt-2.5 border-t border-slate-100 mt-1.5">
                  {card.stats.map((stat) => (
                    <div key={stat.label} className="flex items-baseline gap-1.5">
                      <p className={`text-lg sm:text-xl font-black ${card.textColor} leading-none`}>{stat.value}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pb-2 text-center flex flex-col items-center gap-1">
          <p className="text-[11px] text-slate-300">
            Conectado: <span className="font-semibold text-white">{loggedUser?.nombre || (loggedUser as any)?.usuario || 'Técnico'}{loggedUser?.apellidos ? ` ${loggedUser.apellidos}` : ''}</span>
            {' · '}
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              Cerrar sesión
            </button>
          </p>
          <p className="text-[11px] font-medium text-slate-400 tracking-wider">
            {APP_VERSION}
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

  if (currentView === 'pruebas-tecnicas') {
    return (
      <div className="min-h-screen bg-zinc-50 relative">
        <div className="sticky top-0 z-50 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center gap-2 text-zinc-600 font-semibold cursor-pointer"
          >
            <span className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">←</span>
            Volver al panel
          </button>
          <h1 className="text-sm font-bold text-zinc-900">Pruebas Técnicas</h1>
        </div>
        <div className="pb-20">
          <PruebasTecnicas />
        </div>
      </div>
    );
  }

  if (currentView === 'calendario') {
    return (
      <div className="min-h-screen bg-slate-100 relative">
        <div className="sticky top-0 z-50 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between shadow-xs">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center gap-2 text-zinc-600 font-semibold cursor-pointer hover:text-zinc-900 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">←</span>
            Volver al panel
          </button>
          <h1 className="text-sm font-bold text-zinc-900">Calendario de Trabajo</h1>
        </div>
        <div className="h-[calc(100vh-57px)]">
          <Calendario />
        </div>
      </div>
    );
  }

  if (currentView === 'buzon') {
    return <Buzon isTecnicoMode={true} onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'urgencias') {
    return (
      <div className="min-h-screen bg-zinc-50 relative">
        <div className="sticky top-0 z-50 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between shadow-xs">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center gap-2 text-zinc-600 font-semibold cursor-pointer hover:text-zinc-900 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center font-bold">←</span>
            <span>Volver al panel</span>
          </button>
          <h1 className="text-sm font-bold text-zinc-900">Avisos y Urgencias</h1>
        </div>
        <div className="pb-20">
          <Urgencias />
        </div>
      </div>
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
        <Route path="/buzon" element={<Buzon isTecnicoMode={true} />} />
        <Route path="/pruebas-tecnicas" element={<PruebasTecnicas />} />
        <Route path="/urgencias" element={<Urgencias />} />
        <Route path="/revision-checklist" element={<RevisionChecklist />} />
      </Routes>
    </BrowserRouter>
  );
}
