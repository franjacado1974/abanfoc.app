import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, Building2, Calculator, FileText,
  FileCheck, HardHat, ArrowLeft,
  SearchCheck, Wrench, Receipt, FileDigit, Package, CalendarDays, Power,
  Settings, X, Plus, Trash2, ShieldCheck
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import Clientes from './Clientes';
import Centros from './Centros';
import Catalogo from './Catalogo';
import Articulos from './Articulos';
import Servicios from './Servicios';
import Sistemas from './Sistemas';
import Partes from './Partes';
import Albaranes from './Albaranes';
import Certificados from './Certificados';
import GestionEmpresa from './GestionEmpresa';
import Planificacion from './Planificacion';
import RevisionChecklist from './RevisionChecklist';
import Revisiones from './Revisiones';
import ConfirmationModal from './ConfirmationModal'; // Import the new modal component
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

interface CardItem {
  id: string;
  path: string;
  title: string;
  desc: string;
  Icon: React.ElementType;
  color: string;
  stat?: number;
}

function Login({ usuarios, onLogin }: { usuarios: Usuario[], onLogin: (user: Usuario) => void }) {
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

function DashboardCard({ card, navigate }: { card: CardItem, navigate: (path: string) => void }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-950",
    emerald: "bg-emerald-50 border-emerald-200 hover:border-emerald-300 text-emerald-950",
    orange: "bg-orange-50 border-orange-200 hover:border-orange-300 text-orange-950",
    violet: "bg-violet-50 border-violet-200 hover:border-violet-300 text-violet-950",
    rose: "bg-rose-50 border-rose-200 hover:border-rose-300 text-rose-950",
    cyan: "bg-cyan-50 border-cyan-200 hover:border-cyan-300 text-cyan-950",
    amber: "bg-amber-50 border-amber-200 hover:border-amber-300 text-amber-950",
    teal: "bg-teal-50 border-teal-200 hover:border-teal-300 text-teal-950",
    indigo: "bg-indigo-50 border-indigo-200 hover:border-indigo-300 text-indigo-950",
    red: "bg-red-50 border-red-200 hover:border-red-300 text-red-950",
    fuchsia: "bg-fuchsia-50 border-fuchsia-200 hover:border-fuchsia-300 text-fuchsia-950",
    sky: "bg-sky-50 border-sky-200 hover:border-sky-300 text-sky-950"
  };
  
  const iconColorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    orange: "bg-orange-100 text-orange-600",
    violet: "bg-violet-100 text-violet-600",
    rose: "bg-rose-100 text-rose-600",
    cyan: "bg-cyan-100 text-cyan-600",
    amber: "bg-amber-100 text-amber-600",
    teal: "bg-teal-100 text-teal-600",
    indigo: "bg-indigo-100 text-indigo-600",
    red: "bg-red-100 text-red-600",
    fuchsia: "bg-fuchsia-100 text-fuchsia-600",
    sky: "bg-sky-100 text-sky-600"
  };

  const bgIconColorMap: Record<string, string> = {
    blue: "text-blue-200",
    emerald: "text-emerald-200",
    orange: "text-orange-200",
    violet: "text-violet-200",
    rose: "text-rose-200",
    cyan: "text-cyan-200",
    amber: "text-amber-200",
    teal: "text-teal-200",
    indigo: "text-indigo-200",
    red: "text-red-200",
    fuchsia: "text-fuchsia-200",
    sky: "text-sky-200"
  };

  const cardClasses = colorMap[card.color] || "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-900";
  const iconClasses = iconColorMap[card.color] || "bg-zinc-100 text-zinc-900";
  const bgIconClasses = bgIconColorMap[card.color] || "text-zinc-100";

  return (
    <div className="h-full">
      <div 
        className={`group relative flex flex-col p-5 rounded-3xl border shadow-sm hover:shadow-lg transition-all text-left overflow-hidden h-full cursor-pointer ${cardClasses}`}
        onClick={() => navigate(card.path)}
      >
        <div className={`absolute -top-4 -right-4 p-5 ${bgIconClasses} group-hover:-translate-y-2 group-hover:translate-x-2 transition-transform`}>
          <card.Icon className="w-24 h-24 opacity-60" />
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform shadow-sm ${iconClasses}`}>
          <card.Icon className="w-4 h-4" strokeWidth={2.5} />
        </div>
        
        <div className="mt-auto relative z-10">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2 leading-tight">
            {card.title}
            {card.stat !== undefined && (
              <span className="px-2 py-0.5 bg-black/10 text-black/70 text-[10px] font-bold rounded-md shadow-sm">
                {card.stat}
              </span>
            )}
          </h2>
          <p className="opacity-70 text-xs line-clamp-2 leading-snug">{card.desc}</p>
        </div>
      </div>
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
  const [stats] = useState(() => {
    let clientes = 0;
    let centros = 0;
    let catalogo = 0;
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
    } catch { /* ignore error in initial state */ }
    return { clientes, centros, catalogo };
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<'menu' | 'tecnicos' | 'usuarios'>('menu');

  const [appLogo] = useState(() => {
    try {
      return localStorage.getItem('firecheck_db_logo') || '/logo.png';
    } catch {
      return '/logo.png';
    }
  });

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
    
    // Guardar en Firestore
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

  const initialCards = [
    { id: 'clientes', path: '/clientes', title: 'Clientes', desc: 'Gestión de clientes.', Icon: Users, color: 'blue' },
    { id: 'centros', path: '/centros', title: 'Centros', desc: 'Gestión de centros de los clientes.', Icon: Building2, color: 'emerald' },
    { id: 'partes_trabajo', path: '/partes_trabajo', title: 'Planificación', desc: 'Planificación de los partes de trabajo.', Icon: CalendarDays, color: 'amber' },
    { id: 'partes', path: '/partes', title: 'Partes', desc: 'Gestión de partes de trabajo.', Icon: FileText, color: 'sky' },
    { id: 'revisiones', path: '/revisiones', title: 'Revisiones', desc: 'Mantenimiento de las instalaciones.', Icon: SearchCheck, color: 'indigo' },
    { id: 'reparaciones', path: '/reparaciones', title: 'Reparaciones', desc: 'Reparaciónes y Urgencias.', Icon: Wrench, color: 'red' },
    { id: 'instalaciones', path: '/instalaciones', title: 'Instalaciones', desc: 'Instalaciones y ampliación de sistemas.', Icon: HardHat, color: 'teal' },
    { id: 'presupuestos', path: '/presupuestos', title: 'Presupuestos', desc: 'Elaboración y gestión de presupuestos.', Icon: Calculator, color: 'orange' },
    { id: 'catalogo', path: '/catalogo', title: 'Catálogo', desc: 'Gestión de artículos y servicios.', Icon: Package, color: 'fuchsia' },
    { id: 'certificados', path: '/certificados', title: 'Certificados', desc: 'Gestión de certificados.', Icon: FileCheck, color: 'cyan' },
    { id: 'albaranes', path: '/albaranes', title: 'Albaranes', desc: 'Control de entregas y albaranes de trabajo.', Icon: FileDigit, color: 'violet' },
    { id: 'facturas', path: '/facturas', title: 'Facturas', desc: 'Facturación y control de cobros.', Icon: Receipt, color: 'rose' }
  ];

  const filteredCardsByRole = useMemo(() => {
    if (loggedUser?.rol === 'editor') {
      return initialCards.filter(card => 
        card.id === 'partes' || card.id === 'catalogo' || card.id === 'clientes'
      );
    }
    if (loggedUser?.rol === 'visualizador') {
      return initialCards.filter(card => 
        card.id === 'partes' || card.id === 'albaranes'
      );
    }
    return initialCards;
  }, [loggedUser?.rol]);

  // Inject stats
  const cardsWithStats = filteredCardsByRole.map(c => {
    if (c.id === 'clientes') return { ...c, stat: stats.clientes };
    if (c.id === 'centros') return { ...c, stat: stats.centros };
    if (c.id === 'catalogo') return { ...c, stat: stats.catalogo };
    return c;
  });

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 md:p-12 relative overflow-hidden">
      <div className="max-w-7xl w-full">
        {/* Header simple */}
        <div className="flex flex-col items-center md:flex-row md:justify-between mb-10 md:mb-12 gap-6 md:gap-4">
          <div className="flex flex-col items-center gap-1">
            <img src={appLogo} alt="Logo de la aplicación" className="h-12 md:h-16 max-w-[250px] object-contain" />
            {(loggedUser?.rol === 'super-administrador' || loggedUser?.rol === 'administrador') && (
              <button
                onClick={() => { setSettingsView('menu'); setIsSettingsOpen(true); }}
                className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-all shadow-sm group mt-2"
              >
                <Settings className="w-4 h-4 text-zinc-500 group-hover:rotate-90 transition-transform duration-500" />
                <span className="text-sm font-semibold text-zinc-700">Configuración</span>
              </button>
            )}
          </div>
          
          <div className="text-center md:text-right flex flex-col justify-center relative min-w-[200px]">
            <div className="flex justify-center md:justify-end mb-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-red-600 transition-colors group px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-red-50 bg-white shadow-sm"
                title="Cerrar Sesión"
              >
                <Power className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-tight">Cerrar Sesión</span>
              </button>
            </div>
            <p className="text-xs md:text-sm font-medium text-zinc-500 capitalize">{formatDate(currentTime)}</p>
            <p className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight leading-none mt-1">{formatTime(currentTime)}</p>
            <span className="text-[10px] text-zinc-400 mt-1 font-medium">v.1.2</span>
          </div>
        </div>

        {/* Grid de Botones */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {cardsWithStats.map((card) => (
            <DashboardCard key={card.id} card={card} navigate={navigate} />
          ))}
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

    </div>
  );
}

function PlaceholderPage({ title, bgColor = "bg-zinc-50" }: { title: string, bgColor?: string }) {
  const navigate = useNavigate();
  return (
    <div className={`min-h-screen ${bgColor} p-8`}>
      <button onClick={() => navigate('/')} className="text-sm font-medium text-zinc-500 hover:text-black mb-8 flex items-center gap-2">
        ← Volver al inicio
      </button>
      <h1 className="text-3xl font-bold text-zinc-900">{title}</h1>
      <p className="text-zinc-500 mt-2">Esta sección está en construcción y se implementará próximamente.</p>
    </div>
  );
}

function GlobalHomeButton() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/') return null;

  return (
    <button
      onClick={() => navigate('/')}
      className="fixed top-5 left-5 z-[200] w-12 h-12 rounded-full bg-black text-white shadow-lg hover:bg-zinc-800 transition-all flex items-center justify-center"
      title="Ir al inicio"
      aria-label="Ir al inicio"
    >
      <span className="text-lg leading-none">⌂</span>
    </button>
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

  if (!loggedUser) {
    return <Login usuarios={availableUsers} onLogin={setLoggedUser} />;
  }

  return (
    <BrowserRouter>
      <GlobalHomeButton />
      <Routes>
        <Route path="/" element={<Dashboard loggedUser={loggedUser!} onLogout={() => { 
          setLoggedUser(null); 
          const stored = localStorage.getItem('firecheck_db_usuarios');
          if (stored) setAvailableUsers(JSON.parse(stored));
        }} />} />
        
        <Route path="/clientes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <Clientes />
          </ProtectedRoute>
        } />
        <Route path="/centros" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <Centros />
          </ProtectedRoute>
        } />
        <Route path="/presupuestos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PlaceholderPage title="Gestión de Presupuestos" bgColor="bg-orange-50/40" />
          </ProtectedRoute>
        } />
        <Route path="/albaranes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'visualizador']} user={loggedUser}>
            <Albaranes />
          </ProtectedRoute>
        } />
        <Route path="/facturas" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PlaceholderPage title="Facturación" bgColor="bg-rose-50/40" />
          </ProtectedRoute>
        } />
        <Route path="/partes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador']} user={loggedUser}>
            <Partes />
          </ProtectedRoute>
        } />
        <Route path="/certificados" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <Certificados />
          </ProtectedRoute>
        } />
        <Route path="/instalaciones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PlaceholderPage title="Instalaciones" bgColor="bg-teal-50/40" />
          </ProtectedRoute>
        } />
        <Route path="/revisiones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <Revisiones />
          </ProtectedRoute>
        } />
        <Route path="/reparaciones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PlaceholderPage title="Reparaciones y Averías" bgColor="bg-red-50/40" />
          </ProtectedRoute>
        } />
        <Route path="/catalogo" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <Catalogo />
          </ProtectedRoute>
        } />
        <Route path="/articulos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <Articulos />
          </ProtectedRoute>
        } />
        <Route path="/servicios" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <Servicios />
          </ProtectedRoute>
        } />
        <Route path="/configuracion-datos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <GestionEmpresa />
          </ProtectedRoute>
        } />
        <Route path="/partes_trabajo" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <Planificacion />
          </ProtectedRoute>
        } />
        <Route path="/sistemas" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <Sistemas />
          </ProtectedRoute>
        } />
        <Route path="/revision-checklist" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <RevisionChecklist />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
