import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { 
  Users, Building2, Calculator, FileText,
  FileCheck, HardHat,
  SearchCheck, Wrench, Receipt, FileDigit, Package, CalendarDays,
  ShieldCheck, ArrowLeft,
  Clock
} from 'lucide-react';
import { useState, useMemo } from 'react';
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
import { verifyUser } from './firebase';
import { APP_VERSION } from './constants';

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
        <p className="text-center text-zinc-400 text-xs mt-4">{APP_VERSION}</p>
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

  const stats = useMemo(() => getStats(), []);

  return (
    <div className="flex h-screen bg-[#f8f6f3]">
      <Sidebar user={loggedUser} onLogout={handleLogout} appLogo={appLogo} />
      
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-[#f8f6f3]/80 backdrop-blur-md border-b border-zinc-200/60">
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
    <div className="flex h-screen bg-[#f8f6f3]">
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
    <div className="flex h-screen bg-[#f8f6f3]">
      <Sidebar user={user} onLogout={onLogout} appLogo={appLogo} />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export default function App() {
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
    return <Login usuarios={availableUsers} onLogin={setLoggedUser} />;
  }

  // El usuario técnico solo ve su dashboard sin menú lateral
  if (loggedUser.rol === 'tecnico') {
    return <DashboardTecnico loggedUser={loggedUser} onLogout={handleLogout} />;
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
    </BrowserRouter>
  );
}