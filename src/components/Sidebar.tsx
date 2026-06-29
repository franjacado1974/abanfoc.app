import { useState } from 'react';
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

  const userRole = user?.rol || 'visualizador';

  const filteredItems = navItems.filter(item => item.allowedRoles.includes(userRole));

  const groupedItems = filteredItems.reduce((groups, item) => {
    if (!groups[item.section]) groups[item.section] = [];
    groups[item.section].push(item);
    return groups;
  }, {} as Record<string, NavItem[]>);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const sidebarBgColor = '#00008B';

  const sidebarContent = (
    <div
      className={`flex flex-col h-full ${collapsed ? 'w-14' : 'w-52'} transition-all duration-300 ease-in-out`}
      style={{ backgroundColor: sidebarBgColor }}
    >
      {/* Logo & Header */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-5 border-b border-white/20`}>
        {!collapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            <img src={appLogo} alt="Logo" className="h-9 w-9 object-contain rounded-lg ring-2 ring-orange-400/30" onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }} />
            <div>
              <p className="text-sm font-bold text-orange-400 leading-tight">ABANFOC</p>
              <p className="text-xs text-white/90 font-medium">
                {APP_VERSION}
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <img src={appLogo} alt="Logo" className="h-8 w-8 object-contain rounded-lg ring-2 ring-orange-400/30" onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin scrollbar-thumb-blue-700 scrollbar-track-transparent">
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
                         ? 'bg-orange-500/20 text-orange-300 shadow-sm shadow-orange-500/10 border border-orange-500/20'
                         : 'text-white hover:text-orange-500 hover:bg-white/10'
                    }`}
                    title={collapsed ? item.title : undefined}
                  >
                    <div className={`flex items-center justify-center w-5 h-5 ${active ? 'text-white' : 'text-white'}`}>
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
      <div className={`border-t border-white/20 px-3 py-3 shrink-0 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
        <div className="md:hidden mb-3 px-1">
          <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest">Sesión Activa</p>
          <p className="text-white/70 text-[9px]">{APP_VERSION}</p>
        </div>
        {!collapsed && user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-xs font-bold text-orange-400 border border-orange-500/30">
              {user.nombre.charAt(0)}{user.apellidos.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.nombre} {user.apellidos}</p>
              <p className="text-[9px] text-orange-400 uppercase font-bold tracking-wider truncate">{user.rol}</p>
            </div>
          </div>
        )}
        {collapsed && user && (
          <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-xs font-bold text-orange-400 border border-orange-500/30 mb-2 -mt-2">
            {user.nombre.charAt(0)}{user.apellidos.charAt(0)}
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white hover:text-orange-500 hover:bg-white/10 transition-all uppercase tracking-wider ${
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
        className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-[#00008B] border border-white/30 rounded-full flex items-center justify-center text-orange-400 hover:text-orange-300 hover:brightness-110 transition-all shadow-lg hidden md:flex"
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
        className="fixed top-4 left-4 z-[100] w-10 h-10 bg-[#00008B] text-orange-400 rounded-xl flex items-center justify-center shadow-lg md:hidden border border-white/20"
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
        <div className="h-screen text-white shadow-2xl border-r border-white/20" style={{ backgroundColor: sidebarBgColor }}>
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}