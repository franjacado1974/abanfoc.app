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
import Reparaciones from './Reparaciones';
import Instalaciones from './Instalaciones';
import Ajustes from './Ajustes';
import Buzon from './Buzon';
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
        localStorage.setItem('firecheck_logged_user', JSON.stringify(remoteUser));
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
    sessionStorage.removeItem('firecheck_logged_user');
    onLogout();
  };

  const navigate = useNavigate();
  const isUserChus = loggedUser && (
    (loggedUser.nombre || '').toLowerCase().includes('chus') ||
    (loggedUser.apellidos || '').toLowerCase().includes('chus')
  );
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
    let partes = 0;
    let pendientes = 0;
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

      const savedPartes = localStorage.getItem('firecheck_db_partes');
      if (savedPartes) {
        const parsed = JSON.parse(savedPartes);
        if (Array.isArray(parsed)) {
          partes = parsed.length;
          pendientes = parsed.filter((p: any) => p.estado !== 'Cerrado' && p.estado !== 'Finalizado').length;
        }
      }
    } catch { /* ignore */ }
    return { clientes, centros, catalogo, albaranes, certificados, pedidos, partes, pendientes };
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
        updateStats();
      }));
    } catch (e) { console.error('subscribePartes failed', e); }

    try {
      unsubs.push(subscribePresupuestos((items) => {
        localStorage.setItem('firecheck_db_presupuestos', JSON.stringify(items));
        updateStats();
      }));
    } catch (e) { console.error('subscribePresupuestos failed', e); }

    return () => {
      unsubs.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  const [formattedDate, setFormattedDate] = useState('');
  const [recentPartes, setRecentPartes] = useState<any[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [centrosMap, setCentrosMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('es-ES', options);
    setFormattedDate(dateStr.charAt(0).toUpperCase() + dateStr.slice(1));

    try {
      const savedClientes = localStorage.getItem('firecheck_db_clientes');
      if (savedClientes) {
        const parsed = JSON.parse(savedClientes);
        if (Array.isArray(parsed)) {
          const map: Record<string, string> = {};
          parsed.forEach((c: any) => {
            map[c.id] = c.nombreFiscal || c.nombre || 'Cliente Desconocido';
          });
          setClientesMap(map);
        }
      }
    } catch (e) { console.error(e); }

    try {
      const savedCentros = localStorage.getItem('firecheck_db_centros');
      if (savedCentros) {
        const parsed = JSON.parse(savedCentros);
        if (Array.isArray(parsed)) {
          const map: Record<string, string> = {};
          parsed.forEach((c: any) => {
            map[c.id] = c.nombre || 'Centro Desconocido';
          });
          setCentrosMap(map);
        }
      }
    } catch (e) { console.error(e); }

    try {
      const savedPartes = localStorage.getItem('firecheck_db_partes');
      if (savedPartes) {
        const parsed = JSON.parse(savedPartes);
        if (Array.isArray(parsed)) {
          const sorted = [...parsed].sort((a: any, b: any) => {
            const dateA = a.fechaCreacion || '';
            const dateB = b.fechaCreacion || '';
            return dateB.localeCompare(dateA);
          });
          setRecentPartes(sorted.slice(0, 4));
        }
      }
    } catch (e) { console.error(e); }
  }, [stats]);

  const getStatusBadge = (estado: string) => {
    const styles: Record<string, string> = {
      'Planificado': 'bg-zinc-100 text-zinc-700 border border-zinc-300',
      'Abierto': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      'En revisión': 'bg-amber-50 text-amber-700 border border-amber-200',
      'Descargado (Offline)': 'bg-zinc-100 text-zinc-700 border border-zinc-200',
      'Finalizado': 'bg-blue-50 text-blue-700 border border-blue-200',
      'Cerrado': 'bg-slate-100 text-slate-700 border border-slate-200',
      'Pre-Cerrado': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    };
    return styles[estado] || 'bg-zinc-50 text-zinc-600 border border-zinc-200';
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <Sidebar user={loggedUser} onLogout={handleLogout} appLogo={appLogo} />
      
      <main className="flex-1 overflow-y-auto">
        {/* Top Sticky Bar */}
        <div className="sticky top-0 z-40 bg-[#F8FAFC]/80 backdrop-blur-md border-b border-zinc-200/60">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-xl font-black text-zinc-950 tracking-tight">Inicio</h1>
              <p className="text-xs font-semibold text-zinc-500 mt-0.5">{formattedDate}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold bg-red-50 text-red-600 border border-red-200/60 px-3 py-1.5 rounded-full uppercase tracking-wider">
                {loggedUser.rol}
              </span>
            </div>
          </div>
        </div>

        <div className="p-8 max-w-[1600px] mx-auto animate-in">
          {/* Welcome Hero Banner */}
          <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-zinc-800 relative overflow-hidden mb-8">
            <div className="absolute right-0 top-0 w-80 h-80 bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-orange-600/5 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-red-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">
                    Salamandra Control
                  </span>
                  <span className="text-zinc-500 text-[10px] font-semibold">• Activo</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  ¡Hola, {loggedUser.nombre}! 👋
                </h2>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  Bienvenido al panel administrativo de ABANFOC. Desde aquí puedes supervisar el inventario de sistemas, planificar revisiones trimestrales y anuales, y dar soporte a los técnicos en campo.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 text-xs px-3.5 py-1.5 rounded-xl font-bold border border-zinc-700/50 transition-colors">
                    {stats.clientes} Clientes Activos
                  </span>
                  <span className="bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 text-xs px-3.5 py-1.5 rounded-xl font-bold border border-zinc-700/50 transition-colors">
                    {stats.centros} Centros Registrados
                  </span>
                  <span className="bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 text-xs px-3.5 py-1.5 rounded-xl font-bold border border-zinc-700/50 transition-colors">
                    {stats.pendientes} Partes Pendientes
                  </span>
                </div>
              </div>

              {isUserChus && (
                <div className="hidden lg:flex items-center justify-center shrink-0 w-48 h-48 relative select-none" style={{ transform: 'translateY(6px)' }}>
                  <style>{`
                    @keyframes flyLeftToRight {
                      0% { transform: translate3d(-30px, 40px, 0) scale(0.6); opacity: 0; }
                      15% { opacity: 0.9; }
                      85% { opacity: 0.9; }
                      100% { transform: translate3d(210px, 10px, 0) scale(0.7); opacity: 0; }
                    }
                    @keyframes flyRightToLeft {
                      0% { transform: translate3d(210px, 60px, 0) scale(0.5) scaleX(-1); opacity: 0; }
                      15% { opacity: 0.8; }
                      85% { opacity: 0.8; }
                      100% { transform: translate3d(-30px, 30px, 0) scale(0.6) scaleX(-1); opacity: 0; }
                    }
                  `}</style>

                  <img 
                    src="/arbol.png" 
                    alt="Árbol colorido" 
                    className="h-44 w-44 object-contain"
                  />

                  {/* Pájaros blancos volando */}
                  <svg 
                    viewBox="0 0 20 12" 
                    className="absolute w-6 h-4 pointer-events-none select-none z-20"
                    style={{
                      animation: 'flyLeftToRight 8s linear infinite',
                      animationDelay: '1s'
                    }}
                  >
                    <path d="M 0,4 C 5,-2 8,4 10,7 C 12,4 15,-2 20,4 C 15,5 12,8 10,12 C 8,8 5,5 0,4 Z" fill="#ffffff" />
                  </svg>

                  <svg 
                    viewBox="0 0 20 12" 
                    className="absolute w-5 h-3 pointer-events-none select-none z-20"
                    style={{
                      animation: 'flyRightToLeft 11s linear infinite',
                      animationDelay: '5s'
                    }}
                  >
                    <path d="M 0,4 C 5,-2 8,4 10,7 C 12,4 15,-2 20,4 C 15,5 12,8 10,12 C 8,8 5,5 0,4 Z" fill="#ffffff" opacity="0.95" />
                  </svg>

                  {/* Margaritas a ras del suelo */}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 text-base filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                    <span>🌼</span>
                    <span>🌼</span>
                    <span>🌼</span>
                    <span>🌼</span>
                    <span>🌼</span>
                    <span>🌼</span>
                    <span>🌼</span>
                    <span>🌼</span>
                    <span>🌼</span>
                  </div>
                </div>
              )}

              <div className="hidden md:flex items-center justify-center shrink-0 w-32 h-32 rounded-2xl bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-red-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  src="/salamandra-orange.png" 
                  alt="salamandra" 
                  className="h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-transform duration-500 group-hover:scale-110" 
                  onError={(e) => { (e.target as HTMLImageElement).src = appLogo; }}
                />
              </div>
            </div>
          </div>

          {/* Primary Metric Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {/* Clientes */}
            <div 
              className="bg-white border border-zinc-200/80 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 hover:border-zinc-300 transition-all duration-300 group cursor-pointer"
              onClick={() => navigate('/clientes')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/10">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Ver todos</span>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-950 tracking-tight leading-none">{stats.clientes}</p>
                <p className="text-xs font-bold text-zinc-500 mt-1.5">Clientes</p>
              </div>
            </div>

            {/* Centros */}
            <div 
              className="bg-white border border-zinc-200/80 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 hover:border-zinc-300 transition-all duration-300 group cursor-pointer"
              onClick={() => navigate('/centros')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Ver todos</span>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-950 tracking-tight leading-none">{stats.centros}</p>
                <p className="text-xs font-bold text-zinc-500 mt-1.5">Centros</p>
              </div>
            </div>

            {/* Pedidos */}
            <div 
              className="bg-white border border-zinc-200/80 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 hover:border-zinc-300 transition-all duration-300 group cursor-pointer"
              onClick={() => navigate('/pedidos')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/10">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-hover:text-sky-600 transition-colors">Ver todos</span>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-950 tracking-tight leading-none">{stats.pedidos}</p>
                <p className="text-xs font-bold text-zinc-500 mt-1.5">Pedidos</p>
              </div>
            </div>

            {/* Pendientes */}
            <div 
              className="bg-white border border-zinc-200/80 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 hover:border-zinc-300 transition-all duration-300 group cursor-pointer"
              onClick={() => navigate('/partes_trabajo')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/10 ${stats.pendientes > 0 ? 'animate-pulse' : ''}`}>
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-hover:text-amber-600 transition-colors">Revisar</span>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-950 tracking-tight leading-none">{stats.pendientes}</p>
                <p className="text-xs font-bold text-zinc-500 mt-1.5">Partes Pendientes</p>
              </div>
            </div>

            {/* Total Partes */}
            <div 
              className="bg-white border border-zinc-200/80 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 hover:border-zinc-300 transition-all duration-300 group cursor-pointer"
              onClick={() => navigate('/partes')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-violet-500/10">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-hover:text-violet-600 transition-colors">Historial</span>
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-950 tracking-tight leading-none">{stats.partes}</p>
                <p className="text-xs font-bold text-zinc-500 mt-1.5">Total Partes</p>
              </div>
            </div>
          </div>

          {/* Secondary Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Catálogo */}
            <div 
              className="bg-[#FFFDF9] border border-orange-200/60 shadow-sm rounded-2xl p-4 flex items-center gap-4 hover:border-orange-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
              onClick={() => navigate('/catalogo')}
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100/70 flex items-center justify-center text-orange-600 shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-extrabold text-zinc-900 leading-none">{stats.catalogo}</p>
                <p className="text-[11px] font-bold text-zinc-500 mt-1.5">Artículos en Catálogo</p>
              </div>
            </div>

            {/* Certificados */}
            <div 
              className="bg-[#F6FCFE] border border-cyan-200/60 shadow-sm rounded-2xl p-4 flex items-center gap-4 hover:border-cyan-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
              onClick={() => navigate('/certificados')}
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-100/70 flex items-center justify-center text-cyan-600 shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-extrabold text-zinc-900 leading-none">{stats.certificados}</p>
                <p className="text-[11px] font-bold text-zinc-500 mt-1.5">Certificados Emitidos</p>
              </div>
            </div>

            {/* Albaranes */}
            <div 
              className="bg-[#FAFAFE] border border-violet-200/60 shadow-sm rounded-2xl p-4 flex items-center gap-4 hover:border-violet-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
              onClick={() => navigate('/albaranes')}
            >
              <div className="w-10 h-10 rounded-xl bg-violet-100/70 flex items-center justify-center text-violet-600 shrink-0">
                <FileDigit className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-extrabold text-zinc-900 leading-none">{stats.albaranes}</p>
                <p className="text-[11px] font-bold text-zinc-500 mt-1.5">Albaranes de Entrega</p>
              </div>
            </div>

            {/* Pendiente Facturación */}
            <div 
              className="bg-[#FFF9FA] border border-rose-200/60 shadow-sm rounded-2xl p-4 flex items-center gap-4 hover:border-rose-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
              onClick={() => navigate('/facturas')}
            >
              <div className="w-10 h-10 rounded-xl bg-rose-100/70 flex items-center justify-center text-rose-600 shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-extrabold text-zinc-900 leading-none">{stats.albaranes - Math.floor(stats.albaranes * 0.4)}</p>
                <p className="text-[11px] font-bold text-zinc-500 mt-1.5">Pendiente Facturación</p>
              </div>
            </div>
          </div>

          {/* Quick Access and Activity Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
            {/* Quick Access List */}
            <div className="xl:col-span-1 bg-white border border-zinc-200/80 shadow-sm rounded-3xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-400 mb-4">
                  Accesos Rápidos Directos
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Planificación', icon: CalendarDays, path: '/partes_trabajo', color: 'amber' },
                    { label: 'Partes', icon: FileText, path: '/partes', color: 'sky' },
                    { label: 'Revisiones', icon: SearchCheck, path: '/revisiones', color: 'indigo' },
                    { label: 'Reparaciones', icon: Wrench, path: '/reparaciones', color: 'red' },
                    { label: 'Instalaciones', icon: HardHat, path: '/instalaciones', color: 'teal' },
                    { label: 'Presupuestos', icon: Calculator, path: '/presupuestos', color: 'orange' },
                  ].map((item) => {
                    const colorStyles: Record<string, string> = {
                      amber: 'hover:border-amber-300 hover:bg-amber-50/30 text-amber-950',
                      sky: 'hover:border-sky-300 hover:bg-sky-50/30 text-sky-950',
                      indigo: 'hover:border-indigo-300 hover:bg-indigo-50/30 text-indigo-950',
                      red: 'hover:border-red-300 hover:bg-red-50/30 text-red-950',
                      teal: 'hover:border-teal-300 hover:bg-teal-50/30 text-teal-950',
                      orange: 'hover:border-orange-300 hover:bg-orange-50/30 text-orange-950',
                    };
                    const iconColorStyles: Record<string, string> = {
                      amber: 'text-amber-600 bg-amber-50',
                      sky: 'text-sky-600 bg-sky-50',
                      indigo: 'text-indigo-600 bg-indigo-50',
                      red: 'text-red-600 bg-red-50',
                      teal: 'text-teal-600 bg-teal-50',
                      orange: 'text-orange-600 bg-orange-50',
                    };
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-start gap-2.5 p-4 rounded-2xl border border-zinc-200/80 bg-white transition-all text-left group hover:-translate-y-0.5 hover:shadow-sm ${colorStyles[item.color] || ''}`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${iconColorStyles[item.color] || 'text-zinc-600 bg-zinc-50'}`}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-extrabold tracking-tight">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6 pt-5 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
                <span>Versión del Software</span>
                <span className="font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md">{APP_VERSION}</span>
              </div>
            </div>

            {/* Recent Work Orders Feed */}
            <div className="xl:col-span-2 bg-white border border-zinc-200/80 shadow-sm rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-400">
                  Últimos Partes de Trabajo Creados
                </h3>
                <button 
                  onClick={() => navigate('/partes')}
                  className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors flex items-center gap-1"
                >
                  Ver todos los partes →
                </button>
              </div>

              {recentPartes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300 mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-700">Sin partes de trabajo</h4>
                  <p className="text-[11px] text-zinc-450 mt-1 max-w-xs">No se han encontrado partes de trabajo registrados recientemente en el sistema.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPartes.map((parte) => {
                    const clientName = clientesMap[parte.clienteId] || 'Cliente cargando...';
                    const centerName = centrosMap[parte.centroId] || 'Centro cargando...';
                    const dateFormatted = parte.fechaCreacion 
                      ? new Date(parte.fechaCreacion).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                      : parte.fechaProgramada || 'S/D';

                    return (
                      <div 
                        key={parte.id}
                        onClick={() => navigate('/partes')}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50/55 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-500 shrink-0 group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-zinc-950 truncate leading-tight">
                              {clientName}
                            </h4>
                            <p className="text-[11px] text-zinc-500 truncate mt-1">
                              📍 {centerName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-50">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] font-bold text-zinc-450 uppercase block">Creado</span>
                            <span className="text-[11px] font-extrabold text-zinc-700 mt-0.5 block">{dateFormatted}</span>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${getStatusBadge(parte.estado)}`}>
                            {parte.estado}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PlaceholderPage(props: { title: string; [key: string]: any }) {
  const { title } = props;
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-6 flex flex-col">
      <div className="mb-6">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
        </button>
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">{title}</h1>
        <p className="text-xs font-semibold text-zinc-500 mt-1">Módulo en desarrollo para el sistema Salamandra.</p>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200/80 p-12 text-center shadow-sm flex-1 flex flex-col items-center justify-center min-h-[350px]">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-650 mb-4 animate-pulse">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-base font-black text-zinc-900">Sección en Construcción</h3>
        <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto leading-relaxed">
          Esta funcionalidad está siendo desarrollada actualmente y se implementará en una próxima actualización del sistema ABANFOC.
        </p>
      </div>
    </div>
  );
}

function PageLayout({ user, onLogout, appLogo, children }: { user: Usuario | null; onLogout: () => void; appLogo: string; children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#F8FAFC]">
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
      const session = sessionStorage.getItem('firecheck_logged_user') || localStorage.getItem('firecheck_logged_user');
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
    sessionStorage.removeItem('firecheck_logged_user');
    localStorage.removeItem('firecheck_logged_user');
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
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Instalaciones /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/revisiones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Revisiones /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/reparaciones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Reparaciones /></PageLayout>
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
        <Route path="/buzon" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Buzon /></PageLayout>
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