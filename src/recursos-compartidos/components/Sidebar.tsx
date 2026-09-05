import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users, CalendarDays, FileText, SearchCheck, Wrench,
  HardHat, Calculator, Package, FileCheck, FileDigit, Receipt,
  Settings, Power, ChevronLeft, ChevronRight, LayoutDashboard,
  Menu, X, Inbox} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { APP_VERSION } from '../types/constants';

interface SidebarProps {
  user: { nombre: string; apellidos: string; rol: string } | null;
  onLogout: () => void;
  appLogo: string;
}

interface NavItem {
  id: string;
  path: string;
  title: string;
  Icon: React.ElementType;
  allowedRoles: string[];
  section: 'gestion' | 'operaciones' | 'documentacion' | 'configuracion';
}

const navItems: NavItem[] = [
  { id: 'dashboard', path: '/', title: 'Inicio', Icon: LayoutDashboard, allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador'], section: 'gestion' },
  { id: 'clientes-centros', path: '/clientes-centros', title: 'Clientes', Icon: Users, allowedRoles: ['super-administrador', 'administrador', 'editor'], section: 'gestion' },
  { id: 'catalogo', path: '/catalogo', title: 'Catálogo', Icon: Package, allowedRoles: ['super-administrador', 'administrador', 'editor'], section: 'gestion' },
  { id: 'partes_trabajo', path: '/partes_trabajo', title: 'Planificación', Icon: CalendarDays, allowedRoles: ['super-administrador', 'administrador'], section: 'operaciones' },
  { id: 'partes', path: '/partes', title: 'Partes de Trabajo', Icon: FileText, allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador'], section: 'operaciones' },
  { id: 'revisiones', path: '/revisiones', title: 'Revisiones', Icon: SearchCheck, allowedRoles: ['super-administrador', 'administrador'], section: 'operaciones' },
  { id: 'reparaciones', path: '/reparaciones', title: 'Reparaciones', Icon: Wrench, allowedRoles: ['super-administrador', 'administrador'], section: 'operaciones' },
  { id: 'instalaciones', path: '/instalaciones', title: 'Instalaciones', Icon: HardHat, allowedRoles: ['super-administrador', 'administrador'], section: 'operaciones' },
  { id: 'certificados', path: '/certificados', title: 'Certificados', Icon: FileCheck, allowedRoles: ['super-administrador', 'administrador'], section: 'documentacion' },
  { id: 'presupuestos', path: '/presupuestos', title: 'Presupuestos', Icon: Calculator, allowedRoles: ['super-administrador', 'administrador'], section: 'documentacion' },
  { id: 'pedidos', path: '/pedidos', title: 'Pedidos', Icon: FileText, allowedRoles: ['super-administrador', 'administrador'], section: 'documentacion' },
  { id: 'albaranes', path: '/albaranes', title: 'Albaranes', Icon: FileDigit, allowedRoles: ['super-administrador', 'administrador', 'visualizador'], section: 'documentacion' },
  { id: 'facturas', path: '/facturas', title: 'Facturas', Icon: Receipt, allowedRoles: ['super-administrador', 'administrador'], section: 'documentacion' },
];

export default function Sidebar({ user, onLogout, appLogo }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [displayLogo, setDisplayLogo] = useState(appLogo);
  const [hasUnreadBuzon, setHasUnreadBuzon] = useState(false);

  // Escuchar cambios en buzon para activar la luz de notificación parpadeante
  useEffect(() => {
    try {
      const q = query(collection(db, 'buzon'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const lastSeenStr = localStorage.getItem('firecheck_buzon_last_seen');
        const lastSeen = lastSeenStr ? parseInt(lastSeenStr, 10) : 0;

        if (location.pathname === '/buzon') {
          localStorage.setItem('firecheck_buzon_last_seen', String(Date.now()));
          setHasUnreadBuzon(false);
          return;
        }

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
        console.warn('Error escuchando buzon en Sidebar:', err);
      });
      return () => unsub();
    } catch (err) {
      console.warn('Error configurando listener buzon en Sidebar:', err);
    }
  }, [location.pathname]);

  useEffect(() => {
    const loadAndProcessLogo = async () => {
      let sourceUrl = appLogo;

      try {
        const { storage } = await import('../firebase/firebase');
        const { ref, getDownloadURL } = await import('firebase/storage');
        const storageRef = ref(storage, 'empresa/escudo sin fondo.png');
        const url = await getDownloadURL(storageRef);
        if (url) {
          sourceUrl = url;
          localStorage.setItem('firecheck_db_logo', url);
        }
      } catch (err) {
        console.warn('Could not load escudo sin fondo.png from Firebase Storage, using fallback logo:', err);
      }

      if (!sourceUrl) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = sourceUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setDisplayLogo(sourceUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          let changed = false;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (a > 0) {
              // Check if the pixel is dominant red
              const isRed = r > 60 && r > g + 25 && r > b + 25;
              if (isRed) {
                // Mute green and blue to make it solid red and remove white spots inside
                const newG = Math.round(g * 0.1);
                const newB = Math.round(b * 0.1);
                if (g !== newG || b !== newB) {
                  data[i + 1] = newG;
                  data[i + 2] = newB;
                  changed = true;
                }
              } else {
                // Make non-red pixels (like white background/spots) fully transparent
                data[i + 3] = 0;
                changed = true;
              }
            }
          }
          if (changed) {
            ctx.putImageData(imgData, 0, 0);
            setDisplayLogo(canvas.toDataURL('image/png'));
          } else {
            setDisplayLogo(sourceUrl);
          }
        } catch (err) {
          console.error('Error processing logo transparency:', err);
          setDisplayLogo(sourceUrl);
        }
      };
      img.onerror = () => {
        setDisplayLogo(sourceUrl);
      };
    };

    loadAndProcessLogo();
  }, [appLogo]);

  const normalizeRole = (r?: string) => {
    const clean = (r || '').toLowerCase().trim();
    if (clean === 'administracion' || clean === 'administración' || clean === 'admin' || clean === 'administrador') return 'administrador';
    if (clean === 'superadministrador' || clean === 'superusuario' || clean === 'super_administrador' || clean === 'super-usuario' || clean === 'super-administrador') return 'super-administrador';
    return clean || 'visualizador';
  };

  const userRole = normalizeRole(user?.rol);

  const filteredItems = navItems.filter(item => item.allowedRoles.includes(userRole));

  const groupedItems = filteredItems.reduce((groups, item) => {
    if (!groups[item.section]) groups[item.section] = [];
    groups[item.section].push(item);
    return groups;
  }, {} as Record<string, NavItem[]>);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleOpenBuzon = () => {
    localStorage.setItem('firecheck_buzon_last_seen', String(Date.now()));
    setHasUnreadBuzon(false);
    handleNavigate('/buzon');
  };

  const sidebarBgColor = '#000000';

  const sidebarContent = (
    <div
      className={`flex flex-col h-full ${collapsed ? 'w-14' : 'w-52'} transition-all duration-300 ease-in-out`}
      style={{ backgroundColor: sidebarBgColor }}
    >
      {/* Logo & Header */}
      <div className="flex items-center justify-center px-4 py-5 border-b border-zinc-900">
        {!collapsed && (
          <div className="flex flex-col items-center gap-2 w-full overflow-hidden py-1">
            <img src={displayLogo} alt="Logo" className="h-16 w-16 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }} />
            <div className="text-center flex flex-col items-center">
              <p className="text-lg font-black tracking-wider text-red-600 leading-tight">ABANFOC</p>
              <p className="text-xs text-white/90 font-semibold mt-0.5 mb-1 flex items-center justify-center gap-1">
                {APP_VERSION}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico'].includes(userRole) && (
                  <button
                    type="button"
                    onClick={handleOpenBuzon}
                    className={`relative p-1.5 rounded-lg transition-all cursor-pointer ${
                      isActive('/buzon')
                        ? 'text-red-600 bg-red-600/10'
                        : 'text-zinc-400 hover:text-red-500 hover:bg-white/10'
                    }`}
                    title="Buzón"
                  >
                    <Inbox className="w-4 h-4" strokeWidth={1.75} />
                    {hasUnreadBuzon && !isActive('/buzon') && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.9)] border border-black" />
                    )}
                  </button>
                )}
                {['super-administrador', 'superusuario', 'superadministrador'].includes(userRole) && (
                  <button
                    type="button"
                    onClick={() => handleNavigate('/ajustes')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      isActive('/ajustes')
                        ? 'text-red-600 bg-red-600/10'
                        : 'text-zinc-400 hover:text-red-500 hover:bg-white/10'
                    }`}
                    title="Configuraciones"
                  >
                    <Settings className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className="p-1.5 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-red-500 hover:bg-white/10"
                  title="Cerrar Sesión"
                >
                  <Power className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-1.5">
            <img src={displayLogo} alt="Logo" className="h-9 w-9 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }} />
            {['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico'].includes(userRole) && (
              <button
                type="button"
                onClick={handleOpenBuzon}
                className={`relative p-1.5 rounded-lg transition-all cursor-pointer ${
                  isActive('/buzon')
                    ? 'text-red-600 bg-red-600/10'
                    : 'text-zinc-400 hover:text-red-500 hover:bg-white/10'
                }`}
                title="Buzón"
              >
                <Inbox className="w-4 h-4" strokeWidth={1.75} />
                {hasUnreadBuzon && !isActive('/buzon') && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.9)] border border-black" />
                )}
              </button>
            )}
            {['super-administrador', 'superusuario', 'superadministrador'].includes(userRole) && (
              <button
                type="button"
                onClick={() => handleNavigate('/ajustes')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isActive('/ajustes')
                    ? 'text-red-600 bg-red-600/10'
                    : 'text-zinc-400 hover:text-red-500 hover:bg-white/10'
                }`}
                title="Configuraciones"
              >
                <Settings className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="p-1.5 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-red-500 hover:bg-white/10"
              title="Cerrar Sesión"
            >
              <Power className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {Object.entries(groupedItems).map(([section, items]) => {
          return (
            <div key={section}>
              {items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 mx-2 mb-1 rounded-xl text-sm font-medium transition-all duration-200 ${
                      collapsed ? 'justify-center mx-0 px-0 w-16' : ''
                    } ${
                       active
                         ? 'text-red-600 bg-transparent font-bold'
                         : 'text-white hover:text-red-500 hover:bg-white/10'
                    }`}
                    title={collapsed ? item.title : undefined}
                  >
                    <div className={`flex items-center justify-center w-5 h-5 ${active ? 'text-red-600' : 'text-white'}`}>
                      <item.Icon className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* User Info */}
      <div className={`border-t border-zinc-900 px-3 py-3 shrink-0 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
        <div className="md:hidden mb-3 px-1">
          <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest">Sesión Activa</p>
          <p className="text-white/70 text-[9px] font-medium">{APP_VERSION}</p>
        </div>
        {!collapsed && user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center text-xs font-bold text-red-500 border border-red-500/30">
              {user.nombre.charAt(0)}{user.apellidos.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.nombre} {user.apellidos}</p>
              <p className="text-[9px] text-red-500 uppercase font-bold tracking-wider truncate">{user.rol}</p>
            </div>
          </div>
        )}
        {collapsed && user && (
          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center text-xs font-bold text-red-500 border border-red-500/30">
            {user.nombre.charAt(0)}{user.apellidos.charAt(0)}
          </div>
        )}
      </div>

      {/* Collapse button (desktop) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 border border-zinc-800 rounded-full flex items-center justify-center text-red-500 hover:text-red-400 hover:brightness-110 transition-all shadow-lg hidden md:flex"
        style={{ backgroundColor: sidebarBgColor }}
        title={collapsed ? 'Expandir menú' : 'Contraer menú'}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-[100] w-10 h-10 text-red-500 rounded-xl flex items-center justify-center shadow-lg md:hidden border border-zinc-900"
        style={{ backgroundColor: sidebarBgColor }}
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-0 left-0 h-full shadow-2xl"
            style={{ backgroundColor: sidebarBgColor }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:block relative">
        <div className="h-screen text-white shadow-2xl border-r border-zinc-900" style={{ backgroundColor: sidebarBgColor }}>
          {sidebarContent}
        </div>
      </aside>

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
    </>
  );
}