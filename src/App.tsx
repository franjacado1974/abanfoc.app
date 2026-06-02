import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, Building2, Calculator, FileText,
  FileCheck, HardHat,
  SearchCheck, Wrench, Receipt, FileDigit, Package, CalendarDays,
  Settings, X, Plus, Trash2, ShieldCheck, ArrowLeft,
  TrendingUp, Activity, Clock, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import Clientes from './Clientes';
import Centros from './Centros';
import Catalogo from './Catalogo';
import Articulos from './Articulos';
import Servicios from './Servicios';
import Partes from './Partes';
import Albaranes from './Albaranes';
import Certificados from './Certificados';
import ConfiguracionEmpresa from './ConfiguracionEmpresa';
import Planificacion from './Planificacion';
import RevisionChecklist from './RevisionChecklist';
import Revisiones from './Revisiones';
import ConfirmationModal from './ConfirmationModal';
import Sidebar from './components/Sidebar';
import DetailModal from './components/DetailModal';
import { verifyUser, addUserToFirestore } from './firebase';

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }
};

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
  const [appLogo] = useState(() => {
    try {
      return localStorage.getItem('firecheck_db_logo') || '/logo.png';
    } catch {
      return '/logo.png';
    }
  });

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

    alert('Usuario o contraseña incorrectos');
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 bg-zinc-200"
      style={{ backgroundImage: "url('/bg-login.jpg')" }}
    >
      <div className="bg-white/85 backdrop-blur-md p-5 sm:p-6 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-sm border border-white/20">
        <div className="flex flex-col items-center mb-6">
          <img src={appLogo} alt="Logo" className="h-12 sm:h-14 md:h-16 mb-4 sm:mb-6 object-contain" />
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
            placeholder="Contraseña"
            className="w-full px-4 py-3 sm:py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl sm:rounded-2xl outline-none focus:border-black font-medium text-sm" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required
          />
          <button type="submit" className="w-full bg-black hover:bg-zinc-800 text-white py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold shadow-lg transition-all active:scale-95">Entrar</button>
        </form>
        <p className="text-center text-zinc-400 text-xs mt-4">V.02.06.26</p>
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
            No tienes los permisos necesarios para acceder a esta sección.
          </p>
        </div>
        <button 
          onClick={() => navigate('/')} 
          className="w-full bg-black hover:bg-zinc-800 text-white py-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95"
        >
          Volver al Inicio
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

function DashboardMetric({ label, value, Icon, color, subtitle }: { label: string; value: number; Icon: React.ElementType; color: string; subtitle?: string }) {
  const colorClasses: Record<string, { bg: string; icon: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-900', border: 'border-blue-200' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-900', border: 'border-emerald-200' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-900', border: 'border-amber-200' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600', text: 'text-violet-900', border: 'border-violet-200' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600', text: 'text-rose-900', border: 'border-rose-200' },
    cyan: { bg: 'bg-cyan-50', icon: 'text-cyan-600', text: 'text-cyan-900', border: 'border-cyan-200' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600', text: 'text-orange-900', border: 'border-orange-200' },
  };
  const c = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`metric-card ${c.bg} ${c.border}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center ${c.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className={`text-3xl font-black ${c.text} tracking-tight`}>{value}</p>
      {subtitle && <p className="text-xs text-zinc-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function Dashboard({ loggedUser, onLogout }: { loggedUser: Usuario, onLogout: () => void }) {
  const handleLogout = () => {
    if (confirm('¿Estás seguro de que quieres cerrar la sesión?')) {
      sessionStorage.removeItem('firecheck_logged_user');
      onLogout();
    }
  };

  const navigate = useNavigate();
  const [appLogo] = useState(() => {
    try {
      return localStorage.getItem('firecheck_db_logo') || '/logo.png';
    } catch {
      return '/logo.png';
    }
  });

  const getStats = () => {
    let clientes = 0;
    let centros = 0;
    let catalogo = 0;
    let albaranes = 0;
    let partes = 0;
    let pendientes = 0;
    let certificados = 0;
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

      const savedPartes = localStorage.getItem('firecheck_db_partes');
      if (savedPartes) {
        const parsed = JSON.parse(savedPartes);
        partes = Array.isArray(parsed) ? parsed.length : 0;
        pendientes = Array.isArray(parsed) ? parsed.filter((p: any) => p.estado === 'Planificado' || p.estado === 'En Proceso').length : 0;
      }

      const savedCertificados = localStorage.getItem('firecheck_db_certificados');
      if (savedCertificados) {
        const parsed = JSON.parse(savedCertificados);
        certificados = Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch { /* ignore */ }
    return { clientes, centros, catalogo, albaranes, partes, pendientes, certificados };
  };

  const stats = useMemo(() => getStats(), []);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<'menu' | 'tecnicos' | 'usuarios'>('menu');

  const [tecnicos, setTecnicos] = useState<{id: string, nombre: string, apellidos: string}[]>(() => {
    try {
      const stored = localStorage.getItem('firecheck_db_tecnicos');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [nuevoTecnico, setNuevoTecnico] = useState({nombre: '', apellidos: ''});
  
  const [usuarios, setUsuarios] = useState<Usuario[]>(() => {
    try {
      const stored = localStorage.getItem('firecheck_db_usuarios');
      if (!stored && !localStorage.getItem('firecheck_migration_done')) {
        const initialAdmin: Usuario[] = [{
          id: 'USR-' + generateId().slice(0, 8).toUpperCase(),
          nombre: 'Super',
          apellidos: 'Admin',
          rol: 'super-administrador',
          password: 'admin'
        }];
        localStorage.setItem('firecheck_db_usuarios', JSON.stringify(initialAdmin));
        localStorage.setItem('firecheck_migration_done', 'true');
        return initialAdmin;
      }
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [nuevoUsuario, setNuevoUsuario] = useState({nombre: '', apellidos: '', rol: 'visualizador', password: ''});

  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'tecnico' | 'usuario', id: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAddTecnico = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTecnico.nombre.trim() || !nuevoTecnico.apellidos.trim()) return;
    
    const newTec = {
      id: generateId(),
      nombre: nuevoTecnico.nombre.trim(),
      apellidos: nuevoTecnico.apellidos.trim()
    };
    
    const updated = [...tecnicos, newTec];
    setTecnicos(updated);
    localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(updated));
    setNuevoTecnico({nombre: '', apellidos: ''});
  };

  const handleDeleteTecnico = (id: string) => {
    setItemToDelete({ type: 'tecnico', id });
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteTecnico = () => {
    if (!itemToDelete || itemToDelete.type !== 'tecnico') return;
    setIsConfirmModalOpen(false);
    const updated = tecnicos.filter(t => t.id !== itemToDelete.id);
    setTecnicos(updated);
    localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(updated));
    setItemToDelete(null);
  };

  const handleResetUsuarios = () => {
    if (!confirm('¿Estás seguro de que quieres eliminar TODOS los usuarios?')) return;
    setUsuarios([]);
    localStorage.setItem('firecheck_db_usuarios', JSON.stringify([]));
  };

  const handleSyncTecnicos = () => {
    const updated = [...usuarios];
    let hasChanges = false;
    tecnicos.forEach(t => {
      if (!updated.some(u => u.nombre === t.nombre && u.apellidos === t.apellidos)) {
        updated.push({ ...t, rol: 'visualizador', password: '' });
        hasChanges = true;
      }
    });
    if (hasChanges) {
      setUsuarios(updated);
      localStorage.setItem('firecheck_db_usuarios', JSON.stringify(updated));
    }
  };

  const handleAddUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUsuario.nombre.trim() || !nuevoUsuario.apellidos.trim()) return;
    
    const userData = {
      nombre: nuevoUsuario.nombre.trim(),
      apellidos: nuevoUsuario.apellidos.trim(),
      rol: nuevoUsuario.rol,
      password: nuevoUsuario.password.trim()
    };
    
    try {
      const savedUser = await addUserToFirestore(userData);
      const localUser: Usuario = {
        id: savedUser.id,
        nombre: savedUser.nombre,
        apellidos: savedUser.apellidos,
        rol: savedUser.rol,
        password: userData.password
      };
      const updated = [...usuarios, localUser];
      setUsuarios(updated);
      localStorage.setItem('firecheck_db_usuarios', JSON.stringify(updated));
      alert(`Usuario "${userData.nombre}" creado correctamente en Firestore`);
    } catch (err) {
      console.error('Error guardando usuario en Firestore:', err);
      alert('Error al crear el usuario en Firestore. Comprueba tu conexión.');
      return;
    }
    
    setNuevoUsuario({nombre: '', apellidos: '', rol: 'visualizador', password: ''});
  };

  const handleDeleteUsuario = (id: string) => {
    setItemToDelete({ type: 'usuario', id });
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteUsuario = () => {
    if (!itemToDelete || itemToDelete.type !== 'usuario') return;
    setIsConfirmModalOpen(false);
    const updated = usuarios.filter(u => u.id !== itemToDelete.id);
    setUsuarios(updated);
    localStorage.setItem('firecheck_db_usuarios', JSON.stringify(updated));
    setItemToDelete(null);
  };

  const handleUpdateRol = (id: string, newRol: string) => {
    const updated = usuarios.map(u => u.id === id ? { ...u, rol: newRol } : u);
    setUsuarios(updated);
    localStorage.setItem('firecheck_db_usuarios', JSON.stringify(updated));
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const showConfig = loggedUser?.rol === 'super-administrador' || loggedUser?.rol === 'administrador';

  return (
    <div className="flex h-screen bg-[#f8f6f3]">
      <Sidebar user={loggedUser} onLogout={handleLogout} appLogo={appLogo} />
      
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-[#f8f6f3]/80 backdrop-blur-md border-b border-zinc-200/60">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-bold text-zinc-900">Panel de Control</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Bienvenido, {loggedUser.nombre}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-zinc-500 font-medium capitalize">{formatDate(currentTime)}</p>
                <p className="text-lg font-bold text-zinc-900 tracking-tight">{formatTime(currentTime)}</p>
              </div>
              {showConfig && (
                <button
                  onClick={() => { setSettingsView('menu'); setIsSettingsOpen(true); }}
                  className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all shadow-sm group"
                >
                  <Settings className="w-4 h-4 text-zinc-500 group-hover:rotate-90 transition-transform duration-500" />
                  <span className="text-sm font-semibold text-zinc-700 hidden sm:inline">Configuración</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            <div className="metric-card" onClick={() => navigate('/clientes')} style={{ cursor: 'pointer' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Clientes</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-blue-900 tracking-tight">{stats.clientes}</p>
              <p className="text-xs text-zinc-400 mt-1">Registros activos</p>
            </div>

            <div className="metric-card" onClick={() => navigate('/centros')} style={{ cursor: 'pointer' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Centros</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-emerald-900 tracking-tight">{stats.centros}</p>
              <p className="text-xs text-zinc-400 mt-1">Instalaciones</p>
            </div>

            <div className="metric-card" onClick={() => navigate('/partes_trabajo')} style={{ cursor: 'pointer' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Pendientes</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-amber-900 tracking-tight">{stats.pendientes}</p>
              <p className="text-xs text-zinc-400 mt-1">Partes planificados</p>
            </div>

            <div className="metric-card" onClick={() => navigate('/partes')} style={{ cursor: 'pointer' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Partes</span>
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-violet-900 tracking-tight">{stats.partes}</p>
              <p className="text-xs text-zinc-400 mt-1">Totales registrados</p>
            </div>
          </div>

          {/* Secondary metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3 hover:border-orange-200 transition-colors cursor-pointer" onClick={() => navigate('/catalogo')}>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-zinc-900">{stats.catalogo}</p>
                <p className="text-xs text-zinc-500">Catálogo</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3 hover:border-cyan-200 transition-colors cursor-pointer" onClick={() => navigate('/certificados')}>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600 shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-zinc-900">{stats.certificados}</p>
                <p className="text-xs text-zinc-500">Certificados</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3 hover:border-violet-200 transition-colors cursor-pointer" onClick={() => navigate('/albaranes')}>
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
                <FileDigit className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-zinc-900">{stats.albaranes}</p>
                <p className="text-xs text-zinc-500">Albaranes</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3 hover:border-rose-200 transition-colors cursor-pointer" onClick={() => navigate('/facturas')}>
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-zinc-900">{stats.albaranes - Math.floor(stats.albaranes * 0.4)}</p>
                <p className="text-xs text-zinc-500">Pendientes Factura</p>
              </div>
            </div>
          </div>

          {/* Quick Access Grid */}
          <div className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4">Acceso Rápido</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {[
                { label: 'Planificación', icon: CalendarDays, path: '/partes_trabajo', color: 'amber' },
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

        {/* MODAL DE AJUSTES */}
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-2 px-6 pt-4">
                  {settingsView !== 'menu' && (
                    <button onClick={() => setSettingsView('menu')} className="p-1 hover:bg-zinc-100 rounded-full">
                      <ArrowLeft className="w-5 h-5 text-zinc-500" />
                    </button>
                  )}
                  <h2 className="text-xl font-bold text-zinc-900">
                    {settingsView === 'menu' ? 'Panel de Configuración' : settingsView === 'tecnicos' ? 'Gestión de Técnicos' : 'Gestión de Usuarios'}
                  </h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 mr-4 mt-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {settingsView === 'menu' ? (
                  <div className="space-y-4">
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        navigate('/configuracion-datos');
                      }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left group"
                    >
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800">Gestión de empresa</p>
                        <p className="text-xs text-zinc-500">Datos fiscales, RASIC, logo y firmas.</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setSettingsView('tecnicos')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all text-left group"
                    >
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800">Gestión técnicos</p>
                        <p className="text-xs text-zinc-500">Alta de operarios y técnicos.</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setSettingsView('usuarios')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all text-left group"
                    >
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800">Gestión de usuarios</p>
                        <p className="text-xs text-zinc-500">Asignar roles y permisos del sistema.</p>
                      </div>
                    </button>
                  </div>
                ) : settingsView === 'tecnicos' ? (
                  <section className="space-y-6">
                    <form onSubmit={handleAddTecnico} className="flex flex-col gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Nombre"
                        value={nuevoTecnico.nombre}
                        onChange={e => setNuevoTecnico({...nuevoTecnico, nombre: e.target.value})}
                        className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Apellidos"
                        value={nuevoTecnico.apellidos}
                        onChange={e => setNuevoTecnico({...nuevoTecnico, apellidos: e.target.value})}
                        className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
                      />
                      <button type="submit" className="bg-black hover:bg-zinc-800 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium">
                        <Plus className="w-4 h-4" /> Añadir Técnico
                      </button>
                    </form>

                    <div className="border border-zinc-100 rounded-2xl overflow-hidden bg-zinc-50/50 max-h-60 overflow-y-auto">
                      {tecnicos.length === 0 ? (
                        <div className="p-8 text-center text-zinc-400 text-sm">No hay técnicos registrados.</div>
                      ) : (
                        <ul className="divide-y divide-zinc-100">
                          {tecnicos.map(t => (
                            <li key={t.id} className="p-4 flex items-center justify-between bg-white hover:bg-zinc-50 transition-colors">
                              <span className="font-medium text-zinc-900 text-sm">{t.nombre} {t.apellidos}</span>
                              <button onClick={() => handleDeleteTecnico(t.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                ) : (
                  <section className="space-y-6">
                    <form onSubmit={handleAddUsuario} className="flex flex-col gap-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Nuevo Usuario</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={handleSyncTecnicos} className="text-[10px] text-indigo-600 hover:underline font-bold uppercase">Vincular Técnicos</button>
                          <button type="button" onClick={handleResetUsuarios} className="text-[10px] text-red-500 hover:underline font-bold uppercase">Borrar Todo</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text" required placeholder="Nombre"
                          value={nuevoUsuario.nombre}
                          onChange={e => setNuevoUsuario({...nuevoUsuario, nombre: e.target.value})}
                          className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
                        />
                        <input
                          type="text" required placeholder="Apellidos"
                          value={nuevoUsuario.apellidos}
                          onChange={e => setNuevoUsuario({...nuevoUsuario, apellidos: e.target.value})}
                          className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
                        />
                      </div>
                      <input
                        type="text" required placeholder="Contraseña"
                        value={nuevoUsuario.password}
                        onChange={e => setNuevoUsuario({...nuevoUsuario, password: e.target.value})}
                        className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
                      />
                      <select
                        value={nuevoUsuario.rol}
                        onChange={e => setNuevoUsuario({...nuevoUsuario, rol: e.target.value})}
                        className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black bg-white"
                      >
                        <option value="super-administrador">Super Administrador</option>
                        <option value="administrador">Administrador</option>
                        <option value="editor">Editor</option>
                        <option value="visualizador">Visualizador</option>
                      </select>
                      <button type="submit" className="bg-black hover:bg-zinc-800 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium">
                        <Plus className="w-4 h-4" /> Añadir Usuario
                      </button>
                    </form>

                    <div className="border border-zinc-100 rounded-2xl overflow-hidden bg-zinc-50/50 max-h-60 overflow-y-auto">
                      {usuarios.length === 0 ? (
                        <div className="p-8 text-center text-zinc-400 text-sm">No hay usuarios.</div>
                      ) : (
                        <ul className="divide-y divide-zinc-100">
                          {usuarios.map(u => (
                            <li key={u.id} className="p-4 flex flex-col gap-2 bg-white hover:bg-zinc-50 transition-colors">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-zinc-900 text-sm">{u.nombre} {u.apellidos}</span>
                                <button onClick={() => handleDeleteUsuario(u.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Rol:</span>
                                <select 
                                  value={u.rol} 
                                  onChange={(e) => handleUpdateRol(u.id, e.target.value)}
                                  className="text-xs bg-zinc-100 border border-zinc-200 rounded px-2 py-1 outline-none"
                                >
                                  <option value="super-administrador">Super Administrador</option>
                                  <option value="administrador">Administrador</option>
                                  <option value="editor">Editor</option>
                                  <option value="visualizador">Visualizador</option>
                                </select>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {isConfirmModalOpen && itemToDelete && (
          <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={itemToDelete.type === 'tecnico' ? confirmDeleteTecnico : confirmDeleteUsuario}
            title="Confirmar Eliminación"
            message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?"
            confirmText="Sí, eliminar"
            cancelText="No, cancelar"
          />
        )}
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
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </button>
          <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
          <p className="text-zinc-500 mt-2">Esta sección está en construcción y se implementará próximamente.</p>
        </div>
      </div>
    </div>
  );
}

function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#f8f6f3]">
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

  const [appLogo] = useState(() => {
    try {
      return localStorage.getItem('firecheck_db_logo') || '/logo.png';
    } catch {
      return '/logo.png';
    }
  });

  if (!loggedUser) {
    return <Login usuarios={availableUsers} onLogin={setLoggedUser} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard loggedUser={loggedUser!} onLogout={() => { 
          setLoggedUser(null); 
          const stored = localStorage.getItem('firecheck_db_usuarios');
          if (stored) setAvailableUsers(JSON.parse(stored));
        }} />} />
        
        <Route path="/clientes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout><Clientes /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/centros" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout><Centros /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/presupuestos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PlaceholderPage title="Gestión de Presupuestos" bgColor="bg-zinc-50" />
          </ProtectedRoute>
        } />
        <Route path="/albaranes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'visualizador']} user={loggedUser}>
            <PageLayout><Albaranes /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/facturas" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PlaceholderPage title="Facturación" bgColor="bg-zinc-50" />
          </ProtectedRoute>
        } />
        <Route path="/partes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador']} user={loggedUser}>
            <PageLayout><Partes /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/certificados" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout><Certificados /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/instalaciones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PlaceholderPage title="Instalaciones" bgColor="bg-zinc-50" />
          </ProtectedRoute>
        } />
        <Route path="/revisiones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout><Revisiones /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/reparaciones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PlaceholderPage title="Reparaciones y Averías" bgColor="bg-zinc-50" />
          </ProtectedRoute>
        } />
        <Route path="/catalogo" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout><Catalogo /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/articulos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout><Articulos /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/servicios" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout><Servicios /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/configuracion-datos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout><ConfiguracionEmpresa /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/partes_trabajo" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout><Planificacion /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/revision-checklist" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout><RevisionChecklist /></PageLayout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}