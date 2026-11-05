import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { 
  Building2, HardHat, Wrench, ClipboardCheck,
  ShieldCheck, ArrowLeft,
  Clock, ArrowRightCircle, ArrowLeftCircle, CheckCircle2, AlertTriangle, KeyRound,
  CalendarDays, Package, Receipt, ArrowRight, User
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import Loader from './components/Loader';
import DashboardTecnico from './DashboardTecnico';
import Clientes from './Clientes';
import Centros from './Centros';
import ClientesCentros from './ClientesCentros';
import Presupuestos from './Presupuestos';
import PortalPresupuesto from './PortalPresupuesto';
import Catalogo from './Catalogo';
import Articulos from './Articulos';
import Servicios from './Servicios';
import Albaranes from './Albaranes';
import Facturas from './Facturas';
import Certificados from './Certificados';
import ConfiguracionEmpresa from './ConfiguracionEmpresa';
import Pedidos from './Pedidos';
import Planificacion from './Planificacion';
import Partes from './Partes';
import PartesTrabajoOperaciones from './PartesTrabajoOperaciones';
import CrearNuevoParte from './CrearNuevoParte';
import RevisionChecklist from './RevisionChecklist';
import Revisiones from './Revisiones';
import Reparaciones from './Reparaciones';
import Instalaciones from './Instalaciones';
import Urgencias from './Urgencias';
import Ajustes from './Ajustes';
import Buzon from './Buzon';
import RegistroHorario from './RegistroHorario';
import PruebasTecnicas from './PruebasTecnicas';
import Papelera from './Papelera';
import Metodos from './Metodos';
import Analisis from './Analisis';
import Calendario from './Calendario';
import Notas from './Notas';
import AvisoStockModal from './components/AvisoStockModal';
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
  subscribeSistemasCategorias,
  subscribeUsuarios,
  registrarFichaje,
  subscribeUrgencias,
  subscribeReparaciones,
  subscribeInstalaciones,
  subscribeFacturas,
  subscribeAvisosStock,
  type UrgenciaItem,
  type ReparacionItem,
  type InstalacionItem,
  type ParteFirestore,
  type Albaran,
  type Factura,
  type Articulo,
  type AvisoStock
} from './firebase';
import { APP_VERSION } from './constants';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  rol: string;
  password?: string;
  usuario?: string;
}

function Login({ usuarios: initialUsuarios, onLogin }: { usuarios: Usuario[], onLogin: (user: Usuario) => void }) {
  // viewMode: 'cards' (pantalla con 2 tarjetas) | 'login' (formulario sistema) | 'horario' (fichaje)
  const [viewMode, setViewMode] = useState<'cards' | 'login' | 'horario'>('cards');
  
  // Login form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [appLogo] = useState('/logo_login.png');

  // Control Horario states
  const [userList, setUserList] = useState<Usuario[]>(initialUsuarios || []);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [notasFichaje, setNotasFichaje] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{ tipo: 'entrada' | 'salida'; hora: string; usuario: string } | null>(null);
  const [offlineWarning, setOfflineWarning] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Suscribirse a la lista de usuarios para el selector de horario
  useEffect(() => {
    const unsub = subscribeUsuarios((users) => {
      if (Array.isArray(users) && users.length > 0) {
        setUserList(users);
      }
    });
    return () => unsub();
  }, []);

  // Reloj en vivo para control horario
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Comprobar si hubo un fallo de registro previo offline
  useEffect(() => {
    try {
      const savedAlert = localStorage.getItem('firecheck_pending_horario_alert');
      if (savedAlert) {
        setOfflineWarning(savedAlert);
      }
    } catch { /* ignore */ }
  }, []);

  // Filtrar usuarios con rol "Técnico" o "Administración" (excluyendo Super Administrador y Administrador)
  const horarioUsers = useMemo(() => {
    return userList.filter((u) => {
      const r = (u.rol || '').toString().trim().toLowerCase();
      if (
        r === 'super-administrador' ||
        r === 'superadministrador' ||
        r === 'superusuario' ||
        r === 'administrador' ||
        r === 'admin'
      ) {
        return false;
      }
      return (
        r === 'tecnico' ||
        r === 'técnico' ||
        r === 'administracion' ||
        r === 'administración' ||
        r === 'editor' ||
        r === 'visualizador'
      );
    });
  }, [userList]);

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

    alert('Usuario o contraseña incorrectos');
  };

  const handleRegistrarHorario = async (tipo: 'entrada' | 'salida') => {
    if (!selectedUserId) {
      alert('Por favor, selecciona tu nombre de usuario para registrar la jornada.');
      return;
    }

    const foundUser = userList.find(u => u.id === selectedUserId || (u as any)._docId === selectedUserId);
    const uNombre = foundUser ? (foundUser.nombre + (foundUser.apellidos ? ' ' + foundUser.apellidos : '')) : 'Usuario';
    const uRol = foundUser ? foundUser.rol : 'técnico';

    setIsSubmitting(true);

    try {
      // Guardar en Firebase estrictamente esperando confirmación
      const record = await registrarFichaje({
        usuarioId: selectedUserId,
        usuarioNombre: uNombre,
        usuarioRol: uRol,
        tipo,
        notas: notasFichaje.trim()
      });

      // Éxito confirmado en Firestore: limpiar alertas previas y mostrar modal con check verde
      localStorage.removeItem('firecheck_pending_horario_alert');
      setOfflineWarning(null);
      setSuccessData({
        tipo,
        hora: record.hora,
        usuario: record.usuarioNombre
      });
      setShowSuccessModal(true);
      setNotasFichaje('');
    } catch (err) {
      console.error('Error guardando registro horario en Firebase:', err);
      // No se muestra el check verde por fallo de red / cobertura
      const errorMsg = `No se pudo registrar tu último acceso (${tipo.toUpperCase()}) por fallo de cobertura o red. Comprueba tu conexión a internet o vuelve a intentarlo.`;
      try {
        localStorage.setItem('firecheck_pending_horario_alert', errorMsg);
      } catch { /* ignore */ }
      setOfflineWarning(errorMsg);
      alert('Error de conexión: No se ha podido guardar el registro horario en Firebase. Se ha registrado un recordatorio para el próximo acceso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedTimeString = currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDateString = currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 bg-zinc-200"
      style={{ backgroundImage: "url('/bg-login.jpg')" }}
    >
      {/* ─── VISTA 1: DOS TARJETAS PRINCIPALES (SELECCIÓN) ─── */}
      {viewMode === 'cards' && (
        <div className="bg-white/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/30 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center mb-6">
            <img 
              src={appLogo} 
              alt="Logo" 
              className="h-14 sm:h-16 mb-2 object-contain" 
              onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }} 
            />
            <p className="text-zinc-500 text-xs font-semibold mt-0.5">Selecciona una opción para continuar</p>
          </div>

          {offlineWarning && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-left flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-amber-900">Aviso de conexión</p>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-tight">{offlineWarning}</p>
                <button
                  onClick={() => {
                    localStorage.removeItem('firecheck_pending_horario_alert');
                    setOfflineWarning(null);
                  }}
                  className="text-[10px] font-bold text-amber-900 underline mt-1.5 cursor-pointer block"
                >
                  Entendido / Descartar aviso
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {/* Tarjeta 1: Control Horario */}
            <button
              onClick={() => setViewMode('horario')}
              className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 hover:from-orange-500/20 hover:to-amber-500/15 border-2 border-orange-200 hover:border-orange-400 transition-all text-left shadow-sm active:scale-[0.98] cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0 group-hover:scale-105 transition-transform">
                <Clock className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-zinc-900">Control Horario</h3>
                  <span className="text-[10px] font-extrabold uppercase bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">Fichaje</span>
                </div>
                <p className="text-xs text-zinc-600 mt-0.5 font-medium">Registrar entrada o salida de jornada</p>
              </div>
            </button>

            {/* Tarjeta 2: Entrar al Sistema */}
            <button
              onClick={() => setViewMode('login')}
              className="group flex items-center gap-4 p-4 rounded-2xl bg-zinc-900 hover:bg-black text-white border-2 border-zinc-800 hover:border-zinc-700 transition-all text-left shadow-md active:scale-[0.98] cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center text-red-500 shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                <KeyRound className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-white">Entrar al Sistema</h3>
                  <span className="text-[10px] font-extrabold uppercase bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">Acceso</span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 font-medium">Iniciar sesión con credenciales</p>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6 text-zinc-400 text-xs">
            <img src="/salamandra-orange.png" alt="salamandra" className="h-8 w-8 object-contain" />
            <span>{APP_VERSION}</span>
          </div>
        </div>
      )}

      {/* ─── VISTA 2: FORMULARIO CONTROL HORARIO (FICHAJE) ─── */}
      {viewMode === 'horario' && (
        <div className="bg-white/95 backdrop-blur-md p-6 sm:p-7 rounded-3xl shadow-2xl w-full max-w-sm border border-white/40 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setViewMode('cards')}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-zinc-100"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <span className="text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full">
              Fichaje Rápido
            </span>
          </div>

          {/* Reloj Digital en Vivo */}
          <div className="bg-zinc-900 text-white rounded-2xl p-4 text-center mb-5 shadow-inner border border-zinc-800">
            <p className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-orange-400 leading-none">
              {formattedTimeString}
            </p>
            <p className="text-[11px] font-medium text-zinc-400 capitalize mt-2">
              {formattedDateString}
            </p>
          </div>

          {offlineWarning && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-tight">{offlineWarning}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                Selecciona tu usuario *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl outline-none focus:border-orange-500 focus:bg-white font-bold text-sm text-zinc-900 cursor-pointer shadow-sm"
              >
                <option value="">-- Elige tu nombre --</option>
                {horarioUsers.map((u) => {
                  const fullName = u.nombre ? `${u.nombre} ${u.apellidos || ''}` : (u.usuario || u.id);
                  return (
                    <option key={u.id || (u as any)._docId} value={u.id || (u as any)._docId}>
                      {fullName} ({u.rol || 'técnico'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                Observaciones / Notas (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. Salida a comida, inicio de guardia..."
                value={notasFichaje}
                onChange={(e) => setNotasFichaje(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-orange-500 font-medium text-xs text-zinc-800 shadow-sm"
              />
            </div>

            {/* Botones Principales de Entrada y Salida */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting || !selectedUserId}
                onClick={() => handleRegistrarHorario('entrada')}
                className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
              >
                <ArrowRightCircle className="w-5 h-5 stroke-[2.5]" />
                <span>Registrar entrada</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || !selectedUserId}
                onClick={() => handleRegistrarHorario('salida')}
                className="w-full flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-red-600/20 transition-all active:scale-95 cursor-pointer"
              >
                <ArrowLeftCircle className="w-5 h-5 stroke-[2.5]" />
                <span>Registrar salida</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-5 text-zinc-400 text-xs">
            <img src="/salamandra-orange.png" alt="salamandra" className="h-7 w-7 object-contain" />
            <span>{APP_VERSION}</span>
          </div>
        </div>
      )}

      {/* ─── VISTA 3: ACCESO AL SISTEMA (FORMULARIO ORIGINAL) ─── */}
      {viewMode === 'login' && (
        <div className="bg-white/85 backdrop-blur-md p-5 sm:p-6 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-sm border border-white/20 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setViewMode('cards')}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-zinc-100"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full">
              Sistema
            </span>
          </div>

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
              placeholder="Contraseña"
              className="w-full px-4 py-3 sm:py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl sm:rounded-2xl outline-none focus:border-black font-medium text-sm" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
            />
            <button type="submit" className="w-full bg-black hover:bg-zinc-800 text-white py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold shadow-lg transition-all active:scale-95 cursor-pointer">Entrar</button>
          </form>
          <div className="flex items-center justify-center gap-2 mt-4 text-zinc-400 text-xs">
            <img src="/salamandra-orange.png" alt="salamandra" className="h-10 w-10 object-contain" />
            <span>{APP_VERSION}</span>
          </div>
        </div>
      )}

      {/* ─── MODAL ÉXITO: HORARIO REGISTRADO CON CHECK VERDE ─── */}
      {showSuccessModal && successData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 sm:p-7 text-center animate-in zoom-in-95 duration-200 border border-zinc-100">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
            </div>
            
            <h3 className="text-2xl font-black text-zinc-950 tracking-tight">
              Horario registrado
            </h3>
            
            <div className="my-4 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
              <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                {successData.tipo === 'entrada' ? '🟢 Fichaje de Entrada' : '🔴 Fichaje de Salida'}
              </p>
              <p className="text-base font-black text-zinc-900 mt-1">
                {successData.usuario}
              </p>
              <p className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                Hora: {successData.hora}
              </p>
            </div>

            <p className="text-xs text-zinc-500 mb-6">
              El registro se ha sincronizado y guardado con éxito en la base de datos de Firebase.
            </p>

            <button
              onClick={() => {
                setShowSuccessModal(false);
                setViewMode('cards');
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
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

function normalizeRole(r?: string) {
  const clean = (r || '').toLowerCase().trim();
  if (clean === 'administracion' || clean === 'administración' || clean === 'admin' || clean === 'administrador') return 'administrador';
  if (clean === 'superadministrador' || clean === 'superusuario' || clean === 'super_administrador' || clean === 'super-usuario' || clean === 'super-administrador') return 'super-administrador';
  if (clean === 'tecnico' || clean === 'técnico') return 'tecnico';
  return clean || 'visualizador';
}

function ProtectedRoute({ allowedRoles, user, children }: { allowedRoles: string[], user: Usuario | null, children: React.ReactNode }) {
  const userRole = normalizeRole(user?.rol);
  if (!user || !allowedRoles.includes(userRole)) {
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
  const LOGO_URL = "/favicon.png";

  const [appLogo] = useState(() => {
    try {
      return localStorage.getItem('firecheck_db_logo') || LOGO_URL;
    } catch {
      return LOGO_URL;
    }
  });

  const [urgencias, setUrgencias] = useState<UrgenciaItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_urgencias') || '[]');
    } catch { return []; }
  });
  const [reparaciones, setReparaciones] = useState<ReparacionItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_reparaciones') || '[]');
    } catch { return []; }
  });
  const [instalaciones, setInstalaciones] = useState<InstalacionItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_instalaciones') || '[]');
    } catch { return []; }
  });
  const [partesList, setPartesList] = useState<ParteFirestore[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
    } catch { return []; }
  });
  const [albaranesList, setAlbaranesList] = useState<Albaran[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
    } catch { return []; }
  });
  const [facturasList, setFacturasList] = useState<Factura[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_facturas') || '[]');
    } catch { return []; }
  });
  const [articulosList, setArticulosList] = useState<Articulo[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_articulos') || '[]');
    } catch { return []; }
  });
  const [avisosStockList, setAvisosStockList] = useState<AvisoStock[]>([]);

  const [clientesList, setClientesList] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]');
    } catch { return []; }
  });
  const [centrosList, setCentrosList] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
    } catch { return []; }
  });
  const [tecnicosList, setTecnicosList] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');
    } catch { return []; }
  });

  const [clientesMap, setClientesMap] = useState<Record<string, string>>(() => {
    try {
      const savedClientes = localStorage.getItem('firecheck_db_clientes');
      if (savedClientes) {
        const parsed = JSON.parse(savedClientes);
        if (Array.isArray(parsed)) {
          const map: Record<string, string> = {};
          parsed.forEach((c: any) => {
            const nombre = c.nombreFiscal || c.nombre || 'Cliente Desconocido';
            if (c.id) map[c.id] = nombre;
            if (c._docId) map[c._docId] = nombre;
          });
          return map;
        }
      }
    } catch { /* ignore */ }
    return {};
  });

  const [centrosMap, setCentrosMap] = useState<Record<string, string>>(() => {
    try {
      const savedCentros = localStorage.getItem('firecheck_db_centros');
      if (savedCentros) {
        const parsed = JSON.parse(savedCentros);
        if (Array.isArray(parsed)) {
          const map: Record<string, string> = {};
          parsed.forEach((c: any) => {
            const nombre = c.nombre || 'Centro Desconocido';
            if (c.id) map[c.id] = nombre;
            if (c._docId) map[c._docId] = nombre;
          });
          return map;
        }
      }
    } catch { /* ignore */ }
    return {};
  });

  const [formattedDate, setFormattedDate] = useState('');

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('es-ES', options);
    setFormattedDate(dateStr.charAt(0).toUpperCase() + dateStr.slice(1));
  }, []);

  useEffect(() => {
    // Rutina de desahogo y saneamiento de cuota de almacenamiento:
    // Eliminar claves que contienen documentos masivos pesados para que Firebase y la app tengan espacio de sobra
    try {
      ['firecheck_db_albaranes', 'firecheck_db_certificados', 'firecheck_db_presupuestos'].forEach(k => {
        const item = localStorage.getItem(k);
        if (item && item.length > 500000) { // Si pesa más de 500 KB, liberar para evitar QuotaExceededError
          localStorage.removeItem(k);
        }
      });
    } catch { /* ignore */ }

    const unsubs: (() => void)[] = [];

    const safeLocalSet = (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch (e: any) {
        console.warn(`[StorageQuota] Error guardando ${key} en localStorage:`, e);
        // Si la cuota se satura, liberar inmediatamente cachés no esenciales
        try {
          localStorage.removeItem('firecheck_db_albaranes');
          localStorage.removeItem('firecheck_db_certificados');
          localStorage.removeItem('firecheck_db_presupuestos');
          localStorage.setItem(key, value);
        } catch { /* ignore */ }
      }
    };

    try {
      unsubs.push(subscribeClientes((items) => {
        safeLocalSet('firecheck_db_clientes', JSON.stringify(items));
        if (Array.isArray(items)) {
          setClientesList(items);
          const map: Record<string, string> = {};
          items.forEach((c: any) => {
            const nombre = c.nombreFiscal || c.nombre || 'Cliente Desconocido';
            if (c.id) map[c.id] = nombre;
            if (c._docId) map[c._docId] = nombre;
          });
          setClientesMap(map);
        }
      }));
    } catch (e) { console.error('subscribeClientes failed', e); }

    try {
      unsubs.push(subscribeCentros((items) => {
        safeLocalSet('firecheck_db_centros', JSON.stringify(items));
        if (Array.isArray(items)) {
          setCentrosList(items);
          const map: Record<string, string> = {};
          items.forEach((c: any) => {
            const nombre = c.nombre || 'Centro Desconocido';
            if (c.id) map[c.id] = nombre;
            if (c._docId) map[c._docId] = nombre;
          });
          setCentrosMap(map);
        }
      }));
    } catch (e) { console.error('subscribeCentros failed', e); }

    try {
      unsubs.push(subscribeArticulos((items) => {
        safeLocalSet('firecheck_db_articulos', JSON.stringify(items));
        setArticulosList(items || []);
      }));
    } catch (e) { console.error('subscribeArticulos failed', e); }

    try {
      unsubs.push(subscribeAlbaranes((items) => {
        safeLocalSet('firecheck_db_albaranes', JSON.stringify(items));
        setAlbaranesList(items || []);
      }));
    } catch (e) { console.error('subscribeAlbaranes failed', e); }

    try {
      unsubs.push(subscribeFacturas((items) => {
        safeLocalSet('firecheck_db_facturas', JSON.stringify(items));
        setFacturasList(items || []);
      }));
    } catch (e) { console.error('subscribeFacturas failed', e); }

    try {
      unsubs.push(subscribeAvisosStock((items) => {
        setAvisosStockList(items || []);
      }));
    } catch (e) { console.error('subscribeAvisosStock failed', e); }

    try {
      unsubs.push(subscribeCertificados((items) => {
        safeLocalSet('firecheck_db_certificados', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribeCertificados failed', e); }

    try {
      unsubs.push(subscribePedidos((items) => {
        safeLocalSet('firecheck_db_pedidos', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribePedidos failed', e); }

    try {
      unsubs.push(subscribeTecnicos((items) => {
        safeLocalSet('firecheck_db_tecnicos', JSON.stringify(items));
        setTecnicosList(items || []);
      }));
    } catch (e) { console.error('subscribeTecnicos failed', e); }

    try {
      unsubs.push(subscribeEmpresas((items) => {
        safeLocalSet('firecheck_db_empresas', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribeEmpresas failed', e); }

    try {
      unsubs.push(subscribeTrabajos((items) => {
        safeLocalSet('firecheck_db_trabajos', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribeTrabajos failed', e); }

    try {
      unsubs.push(subscribeSistemasCategorias((items) => {
        safeLocalSet('firecheck_db_sistemas_categorias', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribeSistemasCategorias failed', e); }

    try {
      unsubs.push(subscribePresupuestos((items) => {
        safeLocalSet('firecheck_db_presupuestos', JSON.stringify(items));
      }));
    } catch (e) { console.error('subscribePresupuestos failed', e); }

    try {
      unsubs.push(subscribeUrgencias((items) => {
        safeLocalSet('firecheck_db_urgencias', JSON.stringify(items));
        setUrgencias(items || []);
      }));
    } catch (e) { console.error('subscribeUrgencias failed', e); }

    try {
      unsubs.push(subscribeReparaciones((items) => {
        safeLocalSet('firecheck_db_reparaciones', JSON.stringify(items));
        setReparaciones(items || []);
      }));
    } catch (e) { console.error('subscribeReparaciones failed', e); }

    try {
      unsubs.push(subscribeInstalaciones((items) => {
        safeLocalSet('firecheck_db_instalaciones', JSON.stringify(items));
        setInstalaciones(items || []);
      }));
    } catch (e) { console.error('subscribeInstalaciones failed', e); }

    try {
      unsubs.push(subscribePartes((items) => {
        safeLocalSet('firecheck_db_partes', JSON.stringify(items));
        setPartesList(items || []);
      }));
    } catch (e) { console.error('subscribePartes failed', e); }

    return () => {
      unsubs.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  // ─── HELPERS PARA TARJETAS DEL DASHBOARD ──────────────────────────────────
  const isFirmaValida = (firma: string | undefined): boolean => {
    if (!firma) return false;
    if (firma.length <= 4400) return false;
    if (firma.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAADICAYAAAA0n5+2')) return false;
    return true;
  };

  const formatFechaCorta = (raw: string | undefined): string => {
    if (!raw) return '—';
    const clean = raw.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return clean;
  };

  const normalizeDateIso = (raw: string | undefined | null): string | null => {
    if (!raw || typeof raw !== 'string') return null;
    const clean = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    const ddmmyyyy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
    }
    if (clean.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(clean)) {
      return clean.slice(0, 10);
    }
    return null;
  };

  const isDateInRangeToday = (startRaw: string | undefined | null, endRaw: string | undefined | null, todayIso: string): boolean => {
    const startIso = normalizeDateIso(startRaw);
    if (!startIso) return false;
    const endIso = normalizeDateIso(endRaw);
    if (endIso && endIso >= startIso) {
      return todayIso >= startIso && todayIso <= endIso;
    }
    return startIso === todayIso;
  };

  const extraerHoraTarea = (item: any): string => {
    if (item?.hora && typeof item.hora === 'string' && item.hora.trim()) return item.hora.trim();
    if (item?.horaProgramada && typeof item.horaProgramada === 'string' && item.horaProgramada.trim()) return item.horaProgramada.trim();
    if (item?.fechaCreacion && typeof item.fechaCreacion === 'string' && item.fechaCreacion.includes('T')) {
      const d = new Date(item.fechaCreacion);
      if (!isNaN(d.getTime())) {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        if (hh !== '00' || mm !== '00') return `${hh}:${mm}`;
      }
    }
    return 'Jornada';
  };

  // ─── 1. TARJETA FACTURACIÓN (NARANJA): ALBARANES PENDIENTES DE FACTURAR ───
  const albaranesPendientesFacturar = useMemo(() => {
    return albaranesList
      .filter(a => !a.facturado && !facturasList.some(f => f.albaranId === a.id))
      .sort((a, b) => {
        const firmaA = (isFirmaValida(a.firmaCliente) || isFirmaValida(a.firmaTecnico)) ? 1 : 0;
        const firmaB = (isFirmaValida(b.firmaCliente) || isFirmaValida(b.firmaTecnico)) ? 1 : 0;
        if (firmaA !== firmaB) return firmaB - firmaA;
        return new Date(b.fechaCreacion || 0).getTime() - new Date(a.fechaCreacion || 0).getTime();
      })
      .map(a => {
        const centroObj = centrosList.find(c => (c.id === a.centroId || c._docId === a.centroId));
        const clienteNombre =
          (a.clienteId && clientesMap[a.clienteId]) ||
          a.clienteNombreLibre ||
          (centroObj?.clienteId && clientesMap[centroObj.clienteId]) ||
          (a.centroId && centrosMap[a.centroId]) ||
          a.centroNombreLibre ||
          'Cliente';
        const firmado = isFirmaValida(a.firmaCliente) || isFirmaValida(a.firmaTecnico) || Boolean(a.firmaCliente || a.firmaTecnico);
        return {
          id: a.id || (a as any)._docId || 'ALB',
          numero: a.id || (a as any).numeroMantenimiento || 'S/N',
          cliente: clienteNombre,
          fecha: formatFechaCorta(a.fechaCreacion),
          firmado,
          raw: a
        };
      });
  }, [albaranesList, facturasList, clientesMap, centrosMap, centrosList]);

  // ─── 2. TARJETA TAREAS DE HOY (AZUL): RESUMEN DE TRABAJOS PARA HOY ────────
  const tareasDeHoy = useMemo(() => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const lista: {
      id: string;
      hora: string;
      cliente: string;
      tipo: 'Revisión' | 'Reparación' | 'Instalación' | 'Aviso' | 'Visita programada';
      detalle: string;
      tecnico?: string;
      completado: boolean;
      badgeColor: string;
      ruta: string;
    }[] = [];

    // A) Revisiones y Visitas programadas (colección partes)
    partesList.forEach(p => {
      if (!isDateInRangeToday(p.fechaProgramada, p.fechaFinProgramada || (p as any).fechaFin, todayIso)) return;
      const c = centrosList.find(cent => (cent._docId || cent.id) === p.centroId);
      const cl = clientesList.find(cli => (cli._docId || cli.id) === (p.clienteId || c?.clienteId));
      const tec = tecnicosList.find(t => (t._docId || t.id) === p.tecnicoId);
      const clienteNombre = p.nombreCentro || c?.nombre || cl?.nombre || clientesMap[p.clienteId] || centrosMap[p.centroId] || 'Centro programado';
      const esVisita = (p.tipoTrabajo || '').toLowerCase().includes('visita');
      const tipoLabel: 'Revisión' | 'Visita programadas' extends never ? any : 'Revisión' | 'Visita programada' = esVisita ? 'Visita programada' : 'Revisión';
      const tieneAlbaran = albaranesList.some(a => a.parteId === p.id || a.parteId === (p as any)._docId || (p.numeroMantenimiento && a.numeroMantenimiento === p.numeroMantenimiento));
      const completado = tieneAlbaran || p.estado === 'Finalizado' || p.estado === 'Cerrado';

      lista.push({
        id: `parte-${p.id || p._docId}`,
        hora: extraerHoraTarea(p),
        cliente: clienteNombre,
        tipo: tipoLabel,
        detalle: p.periodicidad ? `Revisión ${p.periodicidad}` : (p.tipoTrabajo || 'Mantenimiento PCI'),
        tecnico: tec?.nombre ? `${tec.nombre} ${tec.apellidos || ''}`.trim() : undefined,
        completado,
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
        ruta: '/calendario'
      });
    });

    // B) Reparaciones
    reparaciones.forEach(r => {
      const fechaBase = r.fecha || (r.fechaCreacion ? r.fechaCreacion.slice(0, 10) : '');
      if (!isDateInRangeToday(fechaBase, r.fechaFinProgramada || (r as any).fechaFin, todayIso)) return;
      const c = centrosList.find(cent => (r.centroId && (cent._docId || cent.id) === r.centroId));
      const cl = clientesList.find(cli => (cli._docId || cli.id) === r.clienteId || (cli._docId || cli.id) === c?.clienteId);
      const clienteNombre = cl?.nombre || (r.clienteId && clientesMap[r.clienteId]) || r.clienteNombre || r.lugar || (r.centroId && centrosMap[r.centroId]) || 'Cliente';
      const tieneAlbaran = Boolean(r.albaranId) || albaranesList.some(a => a.reparacionId === r.id || a.reparacionId === (r as any)._docId);
      const completado = tieneAlbaran || r.estado === 'Finalizado' || Boolean((r as any).resueltaManual);

      lista.push({
        id: `rep-${r.id || r._docId}`,
        hora: extraerHoraTarea(r),
        cliente: clienteNombre,
        tipo: 'Reparación',
        detalle: r.reparacion || r.titulo || 'Reparación / Avería',
        tecnico: r.tecnicoAsignado || undefined,
        completado,
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
        ruta: '/calendario'
      });
    });

    // C) Instalaciones
    instalaciones.forEach(i => {
      const fechaBase = i.fecha || (i.fechaCreacion ? i.fechaCreacion.slice(0, 10) : '');
      if (!isDateInRangeToday(fechaBase, i.fechaFinProgramada || (i as any).fechaFin, todayIso)) return;
      const c = centrosList.find(cent => (i.centroId && (cent._docId || cent.id) === i.centroId));
      const cl = clientesList.find(cli => (cli._docId || cli.id) === i.clienteId || (cli._docId || cli.id) === c?.clienteId);
      const clienteNombre = cl?.nombre || (i.clienteId && clientesMap[i.clienteId]) || i.clienteNombre || i.lugar || (i.centroId && centrosMap[i.centroId]) || 'Cliente';
      const tieneAlbaran = Boolean(i.albaranId) || albaranesList.some(a => a.instalacionId === i.id || a.instalacionId === (i as any)._docId);
      const completado = tieneAlbaran || i.estado === 'Finalizado' || Boolean((i as any).resueltaManual);

      lista.push({
        id: `inst-${i.id || i._docId}`,
        hora: extraerHoraTarea(i),
        cliente: clienteNombre,
        tipo: 'Instalación',
        detalle: i.instalacion || i.titulo || 'Instalación / Montaje',
        tecnico: i.tecnicoAsignado || undefined,
        completado,
        badgeColor: 'bg-red-100 text-red-800 border-red-300',
        ruta: '/calendario'
      });
    });

    // D) Avisos / Urgencias
    urgencias.forEach(u => {
      const fechaBase = u.fecha || (u.fechaCreacion ? u.fechaCreacion.slice(0, 10) : '');
      if (!isDateInRangeToday(fechaBase, u.fechaFinProgramada || (u as any).fechaFin, todayIso)) return;
      const c = centrosList.find(cent => (u.centroId && (cent._docId || cent.id) === u.centroId));
      const cl = clientesList.find(cli => (cli._docId || cli.id) === u.clienteId || (cli._docId || cli.id) === c?.clienteId);
      const clienteNombre = cl?.nombre || (u.clienteId && clientesMap[u.clienteId]) || u.clienteNombre || u.lugar || (u.centroId && centrosMap[u.centroId]) || 'Cliente';
      const tieneAlbaran = Boolean(u.albaranId) || albaranesList.some(a => (a as any).urgenciaId === u.id || (a as any).urgenciaId === (u as any)._docId);
      const completado = tieneAlbaran || u.estado === 'Finalizado' || Boolean((u as any).resueltaManual);

      lista.push({
        id: `urg-${u.id || u._docId}`,
        hora: extraerHoraTarea(u),
        cliente: clienteNombre,
        tipo: 'Aviso',
        detalle: u.titulo || u.urgencia || 'Aviso de urgencia',
        tecnico: u.tecnicoAsignado || undefined,
        completado,
        badgeColor: 'bg-zinc-900 text-white border-black',
        ruta: '/calendario'
      });
    });

    return lista.sort((a, b) => Number(a.completado) - Number(b.completado));
  }, [partesList, reparaciones, instalaciones, urgencias, centrosList, clientesList, tecnicosList, clientesMap, centrosMap, albaranesList]);

  // ─── 3. TARJETA STOCK (VERDE): MATERIALES CON EXISTENCIAS BAJAS ───────────
  const materialesStockBajo = useMemo(() => {
    const map = new Map<string, { id: string; codigo: string; nombre: string; cantidad: number; familia?: string }>();

    articulosList.forEach(art => {
      if (art.revisable === false) return; // Excluir servicios puros
      if (art.cantidad !== undefined && art.cantidad !== null && String(art.cantidad).trim() !== '') {
        const cantNum = Number(art.cantidad);
        if (!isNaN(cantNum) && cantNum <= 2) {
          map.set(art.id || art.codigo || art.nombre, {
            id: art.id || art.codigo,
            codigo: art.codigo || '—',
            nombre: art.nombre || 'Material sin nombre',
            cantidad: Math.max(0, cantNum),
            familia: art.familia
          });
        }
      }
    });

    avisosStockList.forEach(aviso => {
      if (aviso.activo !== false) {
        const key = aviso.articuloId || aviso.id || aviso.codigo || aviso.nombre;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            codigo: aviso.codigo || '—',
            nombre: aviso.nombre || 'Material agotado',
            cantidad: 0,
            familia: aviso.familia
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.cantidad - b.cantidad);
  }, [articulosList, avisosStockList]);

  const todoEnOrdenGlobal = albaranesPendientesFacturar.length === 0 && materialesStockBajo.length === 0;

  return (
    <div className="flex h-screen bg-[#F4F7FB]">
      <Sidebar user={loggedUser} onLogout={handleLogout} appLogo={appLogo} />
      
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Cabecera Superior Corporativa Azul Marino */}
        <div className="sticky top-0 z-40 bg-gradient-to-r from-[#0F2342] via-[#162F56] to-[#1D3557] text-white shadow-md border-b border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between px-5 sm:px-8 py-3.5 gap-2 max-w-[1680px] mx-auto w-full">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center text-orange-400 shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-white tracking-wide">{formattedDate}</p>
                <p className="text-[11px] text-slate-300 font-medium">Panel de Control en Tiempo Real · Salamandra PCI</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 py-1.5 rounded-full transition-colors">
                <User className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-white">{loggedUser.nombre}</span>
                <span className="text-[10px] font-black bg-orange-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {loggedUser.rol}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-[1680px] w-full mx-auto flex-1 flex flex-col justify-between gap-6 animate-in">
          <div>
            {/* Bienvenida e Indicador de Estado Global */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0F2342] tracking-tight">
                  ¡Hola, {loggedUser.nombre}!
                </h1>
                <p className="text-sm sm:text-base font-medium text-slate-500 mt-1">
                  Resumen de tu jornada en Salamandra · Fotografía en tiempo real de facturación, trabajos de hoy y almacén.
                </p>
              </div>

              {todoEnOrdenGlobal ? (
                <div className="flex items-center gap-3.5 bg-emerald-50 border-2 border-emerald-200/80 px-5 py-3 rounded-2xl shrink-0 shadow-2xs">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-emerald-950 leading-tight">Todo al día</p>
                    <p className="text-xs font-semibold text-emerald-700">Sin facturación ni stock pendiente</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3.5 bg-[#0F2342] text-white px-5 py-3 rounded-2xl shrink-0 shadow-sm border border-slate-800">
                  <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Clock className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white leading-tight">Actividad en curso</p>
                    <p className="text-xs font-medium text-slate-300">
                      {albaranesPendientesFacturar.length} alb. por facturar · {tareasDeHoy.length} tareas hoy · {materialesStockBajo.length} avisos stock
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 3 TARJETAS PRINCIPALES DEL DASHBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* ═══════════════════════════════════════════════════════════════
                  1. TARJETA FACTURACIÓN (COLOR NARANJA)
              ═══════════════════════════════════════════════════════════════ */}
              <div className="rounded-[2rem] bg-gradient-to-br from-orange-50 via-amber-50/60 to-white border-2 border-orange-200/90 shadow-md hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden">
                <div className="p-6 sm:p-7 flex-1 flex flex-col">
                  {/* Cabecera con Icono Ilustrativo y Contador Destacado */}
                  <div className="flex items-start gap-5 pb-5 border-b border-orange-200/70">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#0F2342] to-[#1D3557] border-2 border-orange-400/40 flex items-center justify-center shrink-0 shadow-lg relative">
                      <Receipt className="w-10 h-10 text-white stroke-[1.8]" />
                      <span className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-orange-500 text-white font-black text-sm flex items-center justify-center border-2 border-white shadow">
                        €
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="inline-block text-[11px] font-black uppercase tracking-widest text-orange-800 bg-orange-200/70 px-2.5 py-0.5 rounded-full mb-1">
                        1. Facturación
                      </span>
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-5xl sm:text-6xl font-black text-orange-600 tracking-tight leading-none">
                          {albaranesPendientesFacturar.length}
                        </span>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F2342]">
                          {albaranesPendientesFacturar.length === 1 ? 'albarán pendiente' : 'albaranes pendientes'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        Albaranes firmados listos para emitir factura
                      </p>
                    </div>
                  </div>

                  {/* Listado Real de Registros de Firestore */}
                  <div className="mt-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-900/80">
                        Primeros registros pendientes
                      </span>
                      {albaranesPendientesFacturar.length > 0 && (
                        <span className="text-[11px] font-bold text-orange-700">
                          Mostrando {Math.min(5, albaranesPendientesFacturar.length)} de {albaranesPendientesFacturar.length}
                        </span>
                      )}
                    </div>

                    {albaranesPendientesFacturar.length === 0 ? (
                      <div className="flex-1 min-h-[210px] rounded-2xl bg-white/80 border border-orange-200/60 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2.5">
                          <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
                        </div>
                        <p className="text-base font-black text-[#0F2342]">Todo al día</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          No hay albaranes pendientes de facturar en este momento.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 flex-1">
                        {albaranesPendientesFacturar.slice(0, 5).map((item) => (
                          <div
                            key={item.id}
                            onClick={() => navigate('/facturas', { state: { prefillFactura: { albaranId: item.raw.id, empresaId: item.raw.empresaId || '', clienteId: item.raw.clienteId || '', centroId: item.raw.centroId || '', clienteNombreLibre: item.raw.clienteNombreLibre || '', centroNombreLibre: item.raw.centroNombreLibre || '', numeroPedido: item.raw.numeroPedido || '', titulo: item.raw.titulo || `Factura de Albarán ${item.raw.id}`, fechaCreacion: new Date().toISOString(), items: item.raw.items || [] } } })}
                            className="group bg-white hover:bg-orange-50/90 border border-orange-200/80 hover:border-orange-400 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs"
                            title="Clic para abrir en Facturación"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                                <p className="text-xs sm:text-sm font-bold text-[#0F2342] truncate group-hover:text-orange-700 transition-colors">
                                  {item.cliente}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 pl-4">
                                <span className="text-[11px] font-mono font-bold text-orange-800 bg-orange-100/90 px-2 py-0.5 rounded-md border border-orange-200">
                                  Albarán {item.numero}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {item.fecha}
                                </span>
                              </div>
                            </div>

                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                              item.firmado
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {item.firmado ? 'Firmado' : 'Pendiente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón Inferior Naranja */}
                <div className="px-6 pb-6 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/facturas')}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black text-sm shadow-md shadow-orange-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
                  >
                    <ArrowRight className="w-4 h-4 stroke-[2.8]" />
                    <span>Ver pendientes</span>
                  </button>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════
                  2. TARJETA TAREAS DE HOY (COLOR AZUL)
              ═══════════════════════════════════════════════════════════════ */}
              <div className="rounded-[2rem] bg-gradient-to-br from-sky-50 via-blue-50/60 to-white border-2 border-sky-200/90 shadow-md hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden">
                <div className="p-6 sm:p-7 flex-1 flex flex-col">
                  {/* Cabecera con Icono Ilustrativo y Contador Destacado */}
                  <div className="flex items-start gap-5 pb-5 border-b border-sky-200/70">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#0F2342] to-[#1D3557] border-2 border-sky-400/40 flex items-center justify-center shrink-0 shadow-lg relative">
                      <CalendarDays className="w-10 h-10 text-white stroke-[1.8]" />
                      <span className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center border-2 border-white shadow">
                        HOY
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="inline-block text-[11px] font-black uppercase tracking-widest text-blue-800 bg-sky-200/70 px-2.5 py-0.5 rounded-full mb-1">
                        2. Tareas de Hoy
                      </span>
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-5xl sm:text-6xl font-black text-blue-600 tracking-tight leading-none">
                          {tareasDeHoy.length}
                        </span>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F2342]">
                          {tareasDeHoy.length === 1 ? 'tarea prevista' : 'tareas previstas'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        Revisiones, reparaciones, instalaciones y avisos
                      </p>
                    </div>
                  </div>

                  {/* Listado Real de Tareas del Día Actual */}
                  <div className="mt-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900/80">
                        Agenda operativa de hoy
                      </span>
                      {tareasDeHoy.length > 0 && (
                        <span className="text-[11px] font-bold text-blue-700">
                          Mostrando {Math.min(5, tareasDeHoy.length)} de {tareasDeHoy.length}
                        </span>
                      )}
                    </div>

                    {tareasDeHoy.length === 0 ? (
                      <div className="flex-1 min-h-[210px] rounded-2xl bg-white/80 border border-sky-200/60 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2.5">
                          <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
                        </div>
                        <p className="text-base font-black text-[#0F2342]">Todo al día</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          No hay tareas ni intervenciones programadas para la fecha de hoy.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 flex-1">
                        {tareasDeHoy.slice(0, 5).map((tarea) => (
                          <div
                            key={tarea.id}
                            onClick={() => navigate('/calendario')}
                            className={`group bg-white hover:bg-sky-50/90 border border-sky-200/80 hover:border-blue-400 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs ${
                              tarea.completado ? 'opacity-65' : ''
                            }`}
                            title={`${tarea.tipo}: ${tarea.cliente} — ${tarea.detalle}`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md shrink-0">
                                  {tarea.hora}
                                </span>
                                <p className="text-xs sm:text-sm font-bold text-[#0F2342] truncate group-hover:text-blue-700 transition-colors">
                                  {tarea.cliente}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 pl-1">
                                <p className="text-[11px] font-medium text-slate-500 truncate">
                                  {tarea.detalle}
                                  {tarea.tecnico ? ` · Téc: ${tarea.tecnico}` : ''}
                                </p>
                              </div>
                            </div>

                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${tarea.badgeColor}`}>
                              {tarea.tipo}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón Inferior Azul */}
                <div className="px-6 pb-6 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/calendario')}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-black text-sm shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
                  >
                    <ArrowRight className="w-4 h-4 stroke-[2.8]" />
                    <span>Ver calendario</span>
                  </button>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════
                  3. TARJETA STOCK (COLOR VERDE)
              ═══════════════════════════════════════════════════════════════ */}
              <div className="rounded-[2rem] bg-gradient-to-br from-emerald-50 via-green-50/60 to-white border-2 border-emerald-200/90 shadow-md hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden">
                <div className="p-6 sm:p-7 flex-1 flex flex-col">
                  {/* Cabecera con Icono Ilustrativo y Contador Destacado */}
                  <div className="flex items-start gap-5 pb-5 border-b border-emerald-200/70">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#0F2342] to-[#1D3557] border-2 border-emerald-400/40 flex items-center justify-center shrink-0 shadow-lg relative">
                      <Package className="w-10 h-10 text-white stroke-[1.8]" />
                      <span className={`absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center border-2 border-white shadow ${
                        materialesStockBajo.length > 0 ? 'bg-red-600' : 'bg-emerald-600'
                      }`}>
                        {materialesStockBajo.length > 0 ? '!' : '✓'}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="inline-block text-[11px] font-black uppercase tracking-widest text-emerald-900 bg-emerald-200/70 px-2.5 py-0.5 rounded-full mb-1">
                        3. Stock
                      </span>
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-5xl sm:text-6xl font-black text-emerald-600 tracking-tight leading-none">
                          {materialesStockBajo.length}
                        </span>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F2342]">
                          {materialesStockBajo.length === 1 ? 'material con stock bajo' : 'materiales con stock bajo'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        Artículos de almacén que necesitan reposición
                      </p>
                    </div>
                  </div>

                  {/* Listado Real de Materiales con Existencias Bajas */}
                  <div className="mt-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900/80">
                        Materiales a reponer
                      </span>
                      {materialesStockBajo.length > 0 && (
                        <span className="text-[11px] font-bold text-emerald-700">
                          Mostrando {Math.min(5, materialesStockBajo.length)} de {materialesStockBajo.length}
                        </span>
                      )}
                    </div>

                    {materialesStockBajo.length === 0 ? (
                      <div className="flex-1 min-h-[210px] rounded-2xl bg-white/80 border border-emerald-200/60 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2.5">
                          <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
                        </div>
                        <p className="text-base font-black text-[#0F2342]">Todo al día</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          Todos los materiales del catálogo tienen existencias suficientes.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 flex-1">
                        {materialesStockBajo.slice(0, 5).map((mat) => (
                          <div
                            key={mat.id}
                            onClick={() => navigate('/catalogo')}
                            className="group bg-white hover:bg-emerald-50/90 border border-emerald-200/80 hover:border-emerald-400 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs"
                            title="Ir al Catálogo para reponer stock"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${mat.cantidad === 0 ? 'text-red-600' : 'text-amber-500'}`} />
                                <p className="text-xs sm:text-sm font-bold text-[#0F2342] truncate group-hover:text-emerald-800 transition-colors">
                                  {mat.nombre}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 pl-5">
                                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {mat.codigo}
                                </span>
                                {mat.familia && (
                                  <span className="text-[11px] font-medium text-slate-500 truncate">
                                    {mat.familia}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end shrink-0">
                              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                                mat.cantidad === 0
                                  ? 'bg-red-100 text-red-700 border-red-300'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}>
                                {mat.cantidad} {mat.cantidad === 1 ? 'ud.' : 'uds.'}
                              </span>
                              <span className={`text-[9px] font-extrabold uppercase tracking-wider mt-0.5 ${
                                mat.cantidad === 0 ? 'text-red-600' : 'text-amber-700'
                              }`}>
                                {mat.cantidad === 0 ? 'Stock agotado' : 'Stock bajo'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón Inferior Verde */}
                <div className="px-6 pb-6 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/catalogo')}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white font-black text-sm shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
                  >
                    <ArrowRight className="w-4 h-4 stroke-[2.8]" />
                    <span>Ver catálogo</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Barra Inferior de Accesos Rápidos (inspirada en el diseño de referencia) */}
          <div className="bg-white/90 border border-slate-200/90 rounded-2xl px-5 py-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="text-xs font-black uppercase tracking-wider text-[#0F2342] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                Acceso rápido:
              </span>
              <button
                type="button"
                onClick={() => navigate('/analisis')}
                className="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-orange-50"
              >
                Análisis
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => navigate('/pedidos')}
                className="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-orange-50"
              >
                Pedidos
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => navigate('/albaranes')}
                className="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-orange-50"
              >
                Albaranes
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => navigate('/facturas')}
                className="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-orange-50"
              >
                Facturas
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => navigate('/revisiones')}
                title={'Ir al módulo Listado de mantenimientos anuales "LISTMAN"'}
                className="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-orange-50"
              >
                Listman
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
              <button
                type="button"
                onClick={() => navigate('/reparaciones')}
                className="hover:text-[#0F2342] transition-colors cursor-pointer flex items-center gap-1"
              >
                <Wrench className="w-3.5 h-3.5 text-sky-600" /> Reparaciones
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => navigate('/instalaciones')}
                className="hover:text-[#0F2342] transition-colors cursor-pointer flex items-center gap-1"
              >
                <HardHat className="w-3.5 h-3.5 text-red-600" /> Instalaciones
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => navigate('/urgencias')}
                className="hover:text-[#0F2342] transition-colors cursor-pointer flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-zinc-900" /> Avisos y Urgencias
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => navigate('/partes')}
                className="hover:text-[#0F2342] transition-colors cursor-pointer flex items-center gap-1"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-600" /> Partes
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function PlaceholderPage(props: { title: string; [key: string]: any }) {
  const { title } = props;
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-6 flex flex-col">
      <div className="mb-6 text-center sm:text-left flex flex-col items-center sm:items-start">
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
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
      if (r) {
        setInterval(() => {
          r.update();
        }, 15000);
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [newVersion, setNewVersion] = useState<string>('');

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.version && data.version !== APP_VERSION) {
            setNewVersion(data.version);
            setNeedRefresh(true);
          }
        }
      } catch (err) {
        console.warn('Error comprobando versión:', err);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 20000);
    window.addEventListener('focus', checkVersion);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkVersion);
    };
  }, []);

  useEffect(() => {
    if (needRefresh && !newVersion) {
      fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
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
  }, [needRefresh, newVersion]);

  const handleUpdateClick = async () => {
    try {
      if (updateServiceWorker) {
        await updateServiceWorker(true);
      }
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
      if (!session) return null;
      const parsed = JSON.parse(session);
      if (parsed && typeof parsed === 'object') {
        return {
          ...parsed,
          nombre: parsed.nombre || parsed.usuario || 'Usuario',
          apellidos: parsed.apellidos || ''
        };
      }
      return null;
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



  // Detección de ruta pública: Portal del cliente para presupuestos
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  if (pathname.startsWith('/portal-presupuesto/') || pathname.startsWith('/p/')) {
    const token = pathname.replace(/^\/(portal-presupuesto|p)\//, '').split('/')[0];
    return <PortalPresupuesto token={token} />;
  }

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
  const activeRole = normalizeRole(loggedUser.rol);
  if (activeRole === 'tecnico') {
    return (
      <>
        <DashboardTecnico loggedUser={loggedUser} onLogout={handleLogout} />
        <AvisoStockModal user={loggedUser} />
        {renderUpdatePrompt()}
        {renderInstallPrompt()}
      </>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard loggedUser={loggedUser!} onLogout={handleLogout} />} />
        
        <Route path="/calendario" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Calendario /></PageLayout>
          </ProtectedRoute>
        } />
        
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
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Facturas /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/partes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Partes /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/partes-trabajo" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><PartesTrabajoOperaciones loggedUser={loggedUser} /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/crear-parte" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'tecnico']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><CrearNuevoParte /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/certificados" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Certificados /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/instalaciones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'tecnico']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Instalaciones /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/revisiones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Revisiones /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/reparaciones" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'tecnico']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Reparaciones /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/catalogo" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'tecnico']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Catalogo user={loggedUser} isTecnicoMode={loggedUser?.rol === 'tecnico'} /></PageLayout>
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
          <ProtectedRoute allowedRoles={['super-administrador', 'superusuario', 'superadministrador']} user={loggedUser}>
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
        <Route path="/pruebas-tecnicas" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><PruebasTecnicas /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/urgencias" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Urgencias /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/registro-horario" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'superusuario', 'superadministrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><RegistroHorario /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/ajustes" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'superusuario', 'superadministrador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Ajustes /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/papelera" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Papelera /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/metodos" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Metodos /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/analisis" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Analisis /></PageLayout>
          </ProtectedRoute>
        } />
        <Route path="/notas" element={
          <ProtectedRoute allowedRoles={['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico']} user={loggedUser}>
            <PageLayout user={loggedUser} onLogout={handleLogout} appLogo={appLogo}><Notas user={loggedUser} /></PageLayout>
          </ProtectedRoute>
        } />
      </Routes>
      {renderUpdatePrompt()}
      {renderInstallPrompt()}
      <AvisoStockModal user={loggedUser} />
    </BrowserRouter>
  );
}