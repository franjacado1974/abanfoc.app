import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users, CalendarDays, FileText, SearchCheck, Wrench,
  HardHat, Calculator, Package, FileCheck, FileDigit, Receipt,
  Settings, Power, ChevronLeft, ChevronRight, LayoutDashboard,
  Menu, X} from 'lucide-react';
import { APP_VERSION } from '../constants';

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
  { id: 'ajustes', path: '/ajustes', title: 'Configuraciones', Icon: Settings, allowedRoles: ['super-administrador', 'administrador'], section: 'configuracion' },
];

export default function Sidebar({ user, onLogout, appLogo }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [displayLogo, setDisplayLogo] = useState(appLogo);

  useEffect(() => {
    const loadAndProcessLogo = async () => {
      let sourceUrl = appLogo;

      try {
        const { storage } = await import('../firebase');
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

  const userRole = user?.rol || 'visualizador';

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
            <div className="text-center">
              <p className="text-lg font-black tracking-wider text-red-600 leading-tight">ABANFOC</p>
              <p className="text-xs text-white/90 font-semibold mt-0.5">
                {APP_VERSION}
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <img src={displayLogo} alt="Logo" className="h-9 w-9 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }} />
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

      {/* User Info & Logout */}
      <div className={`border-t border-zinc-900 px-3 py-3 shrink-0 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
        <div className="md:hidden mb-3 px-1">
          <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest">Sesión Activa</p>
          <p className="text-white/70 text-[9px] font-medium">{APP_VERSION}</p>
        </div>
        {!collapsed && user && (
          <div className="flex items-center gap-3 mb-3">
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
          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center text-xs font-bold text-red-500 border border-red-500/30 mb-2 -mt-2">
            {user.nombre.charAt(0)}{user.apellidos.charAt(0)}
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white hover:text-red-500 hover:bg-white/10 transition-all uppercase tracking-wider ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Cerrar Sesión"
        >
          <Power className="w-4 h-4" />
          {!collapsed && <span className="text-[10px]">Cerrar Sesión</span>}
        </button>
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
    </>
  );
}