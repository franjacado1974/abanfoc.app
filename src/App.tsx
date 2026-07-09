import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { 
  Users, Building2, Calculator, FileText,
  FileCheck, HardHat,
  SearchCheck, Wrench, Receipt, FileDigit, Package, CalendarDays,
  ShieldCheck, ArrowLeft,
  Clock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import Loader from './components/Loader';
import DashboardTecnico from './DashboardTecnico';
import Clientes from './Clientes';
import Centros from './Centros';
import ClientesCentros from './ClientesCentros';
import Presupuestos from './Presupuestos';
import Catalogo from './Catalogo';
import Articulos from './Articulos';
import Servicios from './Servicios';
import Albaranes from './Albaranes';
import Certificados from './Certificados';
import ConfiguracionEmpresa from './ConfiguracionEmpresa';
import Pedidos from './Pedidos';
import Planificacion from './Planificacion';
import Partes from './Partes';
import RevisionChecklist from './RevisionChecklist';
import Revisiones from './Revisiones';
import Ajustes from './Ajustes';
import Sidebar from './components/Sidebar';
import { 
  verifyUser,
  subscribeClientes,
  subscribeCentros,
  subscribeArticulos,
  subscribeAlbaranes,
  subscribeCertificados,
  subscribePedidos,
  subscribePartes,
  subscribePresupuestos,
  subscribeTecnicos,
  subscribeEmpresas,
  subscribeTrabajos,
  subscribeSistemasCategorias
} from './firebase';
import { APP_VERSION } from './constants';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  rol: string;
  password?: string;
}

function Login({ usuarios: _usuarios, onLogin }: { usuarios: Usuario[], onLogin: (user: Usuario) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [appLogo] = useState('/logo_login.png');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const remoteUser = await verifyUser(username, password);
      if (remoteUser) {
        sessionStorage.setItem('firecheck_logged_user', JSON.stringify(remoteUser));
        onLogin(remoteUser);
        return;
      }
    } catch (err) {
      console.error('Error verificando en Firestore:', err);
    }

    alert('Usuario o contrasena incorrectos');
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 bg-zinc-200"
      style={{ backgroundImage: "url('/bg-login.jpg')" }}
    >
      <div className="bg-white/85 backdrop-blur-md p-5 sm:p-6 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-sm border border-white/20">
        <div className="flex flex-col items-center mb-6">
          <img src={appLogo} alt="Logo" className="h-12 sm:h-14 md:h-16 mb-4 sm:mb-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }} />
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 text-center">acceso al sistema</h2>
          <p className="text-zinc-500 text-sm text-center">introduce tus credenciales para continuar</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="text" 
            placeholder="Nombre"
            className="w-full px-4 py-3 sm:py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl sm:rounded-2xl outline-none focus:border-black font-medium text-sm" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            required
          />
          <input 
            type="password" 
            placeholder="Contrasena"
            className="w-full px-4 py-3 sm:py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl sm:rounded-2xl outline-none focus:border-black font-medium text-sm" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required
          />
          <button type="submit" className="w-full bg-black hover:bg-zinc-800 text-white py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold shadow-lg transition-all active:scale-95">Entrar</button>
        </form>
        <div className="flex items-center justify-center gap-2 mt-4 text-zinc-400 text-xs">
          <img src="/salamandra-orange.png" alt="salamandra" className="h-10 w-10 object-contain" />
          <span>{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}

function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-zinc-200 text-center">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900">Acceso Denegado</h2>
          <p className="text-zinc-500 text-sm mt-2">
            No tienes los permisos necesarios para acceder a esta seccion.
          </p>
        </div>
        <button 
          onClick={() => navigate('/')} 
          className="w-full bg-black hover:bg-zinc-800 text-white py-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95"
        >
          Volver a Inicio
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ allowedRoles, user, children }: { allowedRoles: string[], user: Usuario | null, children: React.ReactNode }) {
  if (!user || !allowedRoles.includes(user.rol)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}

function Dashboard({ loggedUser, onLogout }: { loggedUser: Usuario, onLogout: () => void }) {
  const handleLogout = () => {
    if (confirm('Estas seguro de que quieres cerrar la sesion?')) {
      sessionStorage.removeItem('firecheck_logged_user');
      onLogout();
    }
  };

  const navigate = useNavigate();
  const LOGO_URL = "/favicon.png";

  const [appLogo] = useState(() => {
    try {
      return localStorage.getItem('firecheck_db_logo') || LOGO_URL;
    } catch {
      return LOGO_URL;
    }
  });

  const getStats = () => {
    let clientes = 0;
    let centros = 0;
    let catalogo = 0;
    let albaranes = 0;
    let certificados = 0;
    let pedidos = 0;
    try {
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

      const savedArticulos = localStorage.getItem('firecheck_db_articulos');
      const articulosCount = savedArticulos
        ? (Array.isArray(JSON.parse(savedArticulos)) ? JSON.parse(savedArticulos).length : 0)
        : 0;

      const savedServicios = localStorage.getItem('firecheck_db_servicios');
      const serviciosCount = savedServicios
        ? (Array.isArray(JSON.parse(savedServicios)) ? JSON.parse(savedServicios).length : 0)
        : 0;

      catalogo = articulosCount + serviciosCount;

      const savedAlbaranes = localStorage.getItem('firecheck_db_albaranes');
      if (savedAlbaranes) {
        const parsed = JSON.parse(savedAlbaranes);
        albaranes = Array.isArray(parsed) ? parsed.length : 0;
      }


      const savedCertificados = localStorage.getItem('firecheck_db_certificados');
      if (savedCertificados) {
        const parsed = JSON.parse(savedCertificados);
        certificados = Array.isArray(parsed) ? parsed.length : 0;
      }

      const savedPedidos = localStorage.getItem('firecheck_db_pedidos');
      if (savedPedidos) {
        const parsed = JSON.parse(savedPedidos);
        pedidos = Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch { /* ignore */ }
    return { clientes, centros, catalogo, albaranes, certificados, pedidos, partes: 0, pendientes: 0 };
  };

  const [stats, setStats] = useState(() => getStats());

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const updateStats = () => {
      setStats(getStats());
    };

    try {
      unsubs.push(subscribeClientes((items) => {
        localStorage.setItem('firecheck_db_clientes', JSON.stringify(items));
        updateStats();
      }));
    } catch (e) { console.error('subscribeClientes failed', e); }

    try {
      unsubs.push(subscribeCentros((items) => {
        localStorage.setItem('firecheck_db_centros', JSON.stringify(items));
        updateStats();
      }));
    } catch (e) { console.error('subscribeCentros failed', e); }

    try {
      unsubs.push(subscribeArticulos((items) => {
        localStorage.setItem('firecheck_db_articulos', JSON.stringify(items));
        updateStats();
      }));
    } catch (e) { console.error('subscribeArticulos failed', e); }

    try {
      unsubs.push(subscribeAlbaranes((items) => {
        localStorage.setItem('firecheck_db_albaranes', JSON.stringify(items));
        updateStats();
      }));
    } catch (e) { console.error('subscribeAlbaranes failed', e); }

    try {
      unsubs.push(subscribeCertificados((items) => {
        localStorage.setItem('firecheck_db_certificados', JSON.stringify(items));
        updateStats();
      }));
    } catch (e) { console.error('subscribeCertificados failed', e); }

    try {
      unsubs.push(subscribePedidos((items) => {
        localStorage.setItem('firecheck_db_pedidos', JSON.stringify(items));
        updateStats();
      }));
    } catch (e) { console.error('subscribePedidos failed', e); }

    // Other caches for subsequent menus
    try {
      unsubs.push(subscribeTecnicos((items) => {
        localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribeTecnicos failed', e); }

    try {
      unsubs.push(subscribeEmpresas((items) => {
        localStorage.setItem('firecheck_db_empresas', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribeEmpresas failed', e); }

    try {
      unsubs.push(subscribeTrabajos((items) => {
        localStorage.setItem('firecheck_db_trabajos', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribeTrabajos failed', e); }

    try {
      unsubs.push(subscribeSistemasCategorias((items) => {
        localStorage.setItem('firecheck_db_sistemas_categorias', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribeSistemasCategorias failed', e); }

    try {
      unsubs.push(subscribePartes((items) => {
        localStorage.setItem('firecheck_db_partes', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribePartes failed', e); }

    try {
      unsubs.push(subscribePresupuestos((items) => {
        localStorage.setItem('firecheck_db_presupuestos', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribePresupuestos failed', e); }

    return () => {
      unsubs.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  return (
    <div className="flex h-screen bg-[#DCE1E5]">
      <Sidebar user={loggedUser} onLogout={handleLogout} appLogo={appLogo} />
      
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-[#DCE1E5]/80 backdrop-blur-md border-b border-zinc-200/60">
          <div className="flex items-center justify-center px-6 py-4">
            <div className="text-center">
              <h1 className="text-xl font-bold text-zinc-900">Inicio</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Bienvenido, {loggedUser.nombre}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-zinc-200 p-3 flex items-center gap-3 hover:shadow-sm transition-all cursor-pointer" onClick={() => navigate('/clientes')}>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-blue-900 leading-none">{stats.clientes}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Clientes</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-3 flex items-center gap-3 hover:shadow-sm transition-all cursor-pointer" onClick={() => navigate('/centros')}>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-900 leading-none">{stats.centros}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Centros</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-3 flex items-center gap-3 hover:shadow-sm transition-all cursor-pointer" onClick={() => navigate('/pedidos')}>
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-sky-900 leading-none">{stats.pedidos}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Pedidos</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-3 flex items-center gap-3 hover:shadow-sm transition-all cursor-pointer" onClick={() => navigate('/partes_trabajo')}>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-900 leading-none">0</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Pendientes</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-3 flex items-center gap-3 hover:shadow-sm transition-all cursor-pointer" onClick={() => navigate('/partes')}>
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-violet-900 leading-none">0</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Partes</p>
              </div>
            </div>
          </div>

          {/* Secondary metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-zinc-200 p-3 flex items-center gap-3 hover:border-orange-200 transition-all cursor-pointer" onClick={() => navigate('/catalogo')}>
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-zinc-900 leading-none">{stats.catalogo}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Catálogo</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-3 flex items-center gap-3 hover:border-cyan-200 transition-all cursor-pointer" onClick={() => navigate('/certificados')}>
              <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600 shrink-0">
                <FileCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-zinc-900 leading-none">{stats.certificados}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Certificados</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-3 flex items-center gap-3 hover:border-violet-200 transition-all cursor-pointer" onClick={() => navigate('/albaranes')}>
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
                <FileDigit className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-zinc-900 leading-none">{stats.albaranes}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Albaranes</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-3 flex items-center gap-3 hover:border-rose-200 transition-all cursor-pointer" onClick={() => navigate('/facturas')}>
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-zinc-900 leading-none">{stats.albaranes - Math.floor(stats.albaranes * 0.4)}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Pend. Factura</p>
              </div>
            </div>
          </div>

          {/* Quick Access Grid */}
          <div className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4">Acceso Rapido</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {[
                { label: 'Planificacion', icon: CalendarDays, path: '/partes_trabajo', color: 'amber' },
                { label: 'Partes', icon: FileText, path: '/partes', color: 'sky' },
                { label: 'Revisiones', icon: SearchCheck, path: '/revisiones', color: 'indigo' },
                { label: 'Reparaciones', icon: Wrench, path: '/reparaciones', color: 'red' },
                { label: 'Instalaciones', icon: HardHat, path: '/instalaciones', color: 'teal' },
                { label: 'Presupuestos', icon: Calculator, path: '/presupuestos', color: 'orange' },
              ].map((item) => {
                const colorMap: Record<string, string> = {
                  amber: 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-300',
                  sky: 'bg-sky-50 border-sky-200 text-sky-700 hover:border-sky-300',
                  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:border-indigo-300',
                  red: 'bg-red-50 border-red-200 text-red-700 hover:border-red-300',
                  teal: 'bg-teal-50 border-teal-200 text-teal-700 hover:border-teal-300',
                  orange: 'bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-300',
                };
                const iconColorMap: Record<string, string> = {
                  amber: 'text-amber-600', sky: 'text-sky-600', indigo: 'text-indigo-600',
                  red: 'text-red-600', teal: 'text-teal-600', orange: 'text-orange-600',
                };
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border ${colorMap[item.color] || 'bg-white border-zinc-200'} transition-all text-left`}
                  >
                    <div className={`${iconColorMap[item.color] || 'text-zinc-600'}`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PlaceholderPage({ title, bgColor = "bg-zinc-50" }: { title: string, bgColor?: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex h-screen bg-[#DCE1E5]">
      <div className={`flex-1 overflow-y-auto ${bgColor}`}>
        <div className="p-6">
          <button onClick={() => navigate('/')} className="text-sm font-medium text-zinc-500 hover:text-black mb-6 flex items-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver a Inicio
          </button>
          <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
          <p className="text-zinc-500 mt-2">Esta seccion esta en construccion y se implementara proximamente.</p>
        </div>
      </div>
    </div>
  );
}

function PageLayout({ user, onLogout, appLogo, children }: { user: Usuario | null; onLogout: () => void; appLogo: string; children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#DCE1E5]">
      <Sidebar user={user} onLogout={onLogout} appLogo={appLogo} />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [newVersion, setNewVersion] = useState<string>('');

  useEffect(() => {
    if (needRefresh) {
      fetch('/version.json?t=' + Date.now())
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch version');
          return res.json();
        })
        .then(data => {
          if (data && data.version) {
            setNewVersion(data.version);
          }
        })
        .catch(err => {
          console.error('Error fetching new version:', err);
        });
    }
  }, [needRefresh]);

  const handleUpdateClick = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }
    } catch (err) {
      console.error('Error clearing cache:', err);
    } finally {
      const url = new URL(window.location.href);
      url.searchParams.set('update_ts', Date.now().toString());
      window.location.replace(url.toString());
    }
  };

  const renderUpdatePrompt = () => {
    if (!needRefresh) return null;
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9999] bg-zinc-900/95 text-white p-4 rounded-2xl shadow-2xl border border-zinc-800 backdrop-blur-md flex flex-col gap-3 animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-zinc-100 font-sans">
               Nueva versión disponible{newVersion ? ` (${newVersion})` : ''}
            </h4>
            <p className="text-xs text-zinc-450 mt-0.5 font-sans">Actualiza la aplicación para disfrutar de las últimas mejoras y correcciones.</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-1 font-sans">
          <button 
            onClick={() => setNeedRefresh(false)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Descartar
          </button>
          <button 
            onClick={handleUpdateClick}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-md shadow-orange-500/10 active:scale-95 cursor-pointer"
          >
            Actualizar ahora
          </button>
        </div>
      </div>
    );
  };

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User choice to install: ${outcome}`);
    setDeferredPrompt(null);
  };

  const renderInstallPrompt = () => {
    if (!deferredPrompt) return null;
    return (
      <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9999] bg-zinc-900/95 text-white p-4 rounded-2xl shadow-2xl border border-zinc-800 backdrop-blur-md flex flex-col gap-3 animate-slide-down">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
            <Building2 className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-zinc-100 font-sans">Instalar aplicación</h4>
            <p className="text-xs text-zinc-400 mt-0.5 font-sans">Instala ABANFOC en tu dispositivo para un acceso rápido y mejor rendimiento.</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-1 font-sans">
          <button 
            onClick={() => setDeferredPrompt(null)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Ahora no
          </button>
          <button 
            onClick={handleInstallClick}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-md shadow-orange-500/10 active:scale-95 cursor-pointer"
          >
            Instalar
          </button>
        </div>
      </div>
    );
  };

  const [loggedUser, setLoggedUser] = useState<Usuario | null>(() => {
    try {
      const session = sessionStorage.getItem('firecheck_logged_user');
      return session ? JSON.parse(session) : null;
    } catch { return null; }
  });
  const [availableUsers, setAvailableUsers] = useState<Usuario[]>(() => {
    try {
      const stored = localStorage.getItem('firecheck_db_usuarios');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [isDataLoading, setIsDataLoading] = useState(false);

  useEffect(() => {
    if (loggedUser) {
      setIsDataLoading(true);
      const timer = setTimeout(() => {
        setIsDataLoading(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [loggedUser]);

  const LOGO_URL = "/favicon.png";

  const [appLogo] = useState(() => {
    try {
      return localStorage.getItem('firecheck_db_logo') || LOGO_URL;
    } catch {
      return LOGO_URL;
    }
  });

  const handleLogout = () => {
    setLoggedUser(null);
    const stored = localStorage.getItem('firecheck_db_usuarios');
    if (stored) setAvailableUsers(JSON.parse(stored));
  };

  if (!loggedUser) {
    return (
      <>
        <Login usuarios={availableUsers} onLogin={setLoggedUser} />
        {renderUpdatePrompt()}
        {renderInstallPrompt()}
      </>
    );
  }

  if (isDataLoading) {
    return (
      <>
        <Loader />
        {renderUpdatePrompt()}
        {renderInstallPrompt()}
      </>
    );
  }

  // El usuario técnico solo ve su dashboard sin menú lateral
  if (loggedUser.rol === 'tecnico') {
    return (
      <>
        <DashboardTecnico loggedUser={loggedUser} onLogout={handleLogout} />
        {renderUpdatePrompt()}
        {renderInstallPrompt()}
      </>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard loggedUser={loggedUser!} onLogout={handleLogout} />} />
        
        <Route path="/clientes-centros" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><ClientesCentros /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/clientes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Clientes /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/centros" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Centros /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/presupuestos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Presupuestos /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/pedidos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Pedidos /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/albaranes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'visualizador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Albaranes /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/facturas" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><PlaceholderPage title="Facturacion" bgColor="bg-zinc-50" /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/partes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Partes /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/certificados" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Certificados /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/instalaciones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><PlaceholderPage title="Instalaciones" bgColor="bg-zinc-50" /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/revisiones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Revisiones /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/reparaciones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><PlaceholderPage title="Reparaciones y Averias" bgColor="bg-zinc-50" /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/catalogo" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Catalogo /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/articulos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Articulos /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/servicios" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Servicios /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/configuracion-datos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><ConfiguracionEmpresa /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/partes_trabajo" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Planificacion /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/revision-checklist" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><RevisionChecklist /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/ajustes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Ajustes /></PageLayout>
          </ProtectedRoute>
        } />
      </Routes>
      {renderUpdatePrompt()}
      {renderInstallPrompt()}
    </BrowserRouter>
  );
}