import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users, CalendarDays, FileText, SearchCheck, Wrench,
  HardHat, Calculator, Package, FileCheck, FileDigit, Receipt,
  Settings, Power, ChevronLeft, ChevronRight, LayoutDashboard,
  Menu, X
} from 'lucide-react';

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
  { id: 'dashboard', path: '/', title: 'Dashboard', Icon: LayoutDashboard, allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador'], section: 'gestion' },
  { id: 'clientes-centros', path: '/clientes-centros', title: 'Clientes', Icon: Users, allowedRoles: ['super-administrador', 'administrador', 'editor'], section: 'gestion' },
  { id: 'catalogo', path: '/catalogo', title: 'Catálogo', Icon: Package, allowedRoles: ['super-administrador', 'administrador', 'editor'], section: 'gestion' },
  { id: 'partes_trabajo', path: '/partes_trabajo', title: 'Planificación', Icon: CalendarDays, allowedRoles: ['super-administrador', 'administrador'], section: 'operaciones' },
  { id: 'partes', path: '/partes', title: 'Partes de Trabajo', Icon: FileText, allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador'], section: 'operaciones' },
  { id: 'revisiones', path: '/revisiones', title: 'Revisiones', Icon: SearchCheck, allowedRoles: ['super-administrador', 'administrador'], section: 'operaciones' },
  { id: 'reparaciones', path: '/reparaciones', title: 'Reparaciones', Icon: Wrench, allowedRoles: ['super-administrador', 'administrador'], section: 'operaciones' },
  { id: 'instalaciones', path: '/instalaciones', title: 'Instalaciones', Icon: HardHat, allowedRoles: ['super-administrador', 'administrador'], section: 'operaciones' },
  { id: 'presupuestos', path: '/presupuestos', title: 'Presupuestos', Icon: Calculator, allowedRoles: ['super-administrador', 'administrador'], section: 'operaciones' },
  { id: 'certificados', path: '/certificados', title: 'Certificados', Icon: FileCheck, allowedRoles: ['super-administrador', 'administrador'], section: 'documentacion' },
  { id: 'albaranes', path: '/albaranes', title: 'Albaranes', Icon: FileDigit, allowedRoles: ['super-administrador', 'administrador', 'visualizador'], section: 'documentacion' },
  { id: 'facturas', path: '/facturas', title: 'Facturas', Icon: Receipt, allowedRoles: ['super-administrador', 'administrador'], section: 'documentacion' },
  { id: 'configuracion', path: '/configuracion-datos', title: 'Configuracion', Icon: Settings, allowedRoles: ['super-administrador', 'administrador'], section: 'configuracion' },
  { id: 'ajustes', path: '/ajustes', title: 'Ajustes del Sistema', Icon: Settings, allowedRoles: ['super-administrador', 'administrador'], section: 'configuracion' },
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

  const sidebarContent = (
    <div className={`flex flex-col h-full ${collapsed ? 'w-16' : 'w-64'} transition-all duration-300 ease-in-out`}>
      {/* Logo & Header */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-5 border-b border-blue-800/30`}>
        {!collapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            <img src={appLogo} alt="Logo" className="h-9 w-9 object-contain rounded-lg ring-2 ring-orange-400/30" onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }} />
            <div>
              <p className="text-sm font-bold text-orange-400 leading-tight">ABANFOKING</p>
              <p className="text-[9px] text-blue-300 font-medium uppercase tracking-wider">Sistema de Gestión</p>
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
          const sectionColors: Record<string, string> = {
            gestion: 'text-orange-400',
            operaciones: 'text-orange-400',
            documentacion: 'text-orange-400',
            configuracion: 'text-orange-400',
          };
          const sectionLabels: Record<string, string> = {
            gestion: 'Gestión',
            operaciones: 'Operaciones',
            documentacion: 'Documentación',
            configuracion: 'Sistema',
          };
          return (
            <div key={section} className="mb-3">
               {!collapsed && (
                 <p className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest ${sectionColors[section] || 'text-orange-500'} opacity-100`}>
                   {sectionLabels[section] || section}
                 </p>
               )}
              {items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      collapsed ? 'justify-center mx-0 px-0 w-16' : ''
                    } ${
                       active
                         ? 'bg-orange-500/20 text-orange-300 shadow-sm shadow-orange-500/10 border border-orange-500/20'
                         : 'text-white hover:text-orange-500 hover:bg-blue-800/40'
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
      <div className={`border-t border-blue-800/30 px-3 py-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
        {!collapsed && user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-xs font-bold text-orange-400 border border-orange-500/30">
              {user.nombre.charAt(0)}{user.apellidos.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-100 truncate">{user.nombre} {user.apellidos}</p>
              <p className="text-[9px] text-orange-400 uppercase font-bold tracking-wider truncate">{user.rol}</p>
            </div>
          </div>
        )}
        {collapsed && user && (
          <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-xs font-bold text-orange-400 border border-orange-500/30 mb-2">
            {user.nombre.charAt(0)}{user.apellidos.charAt(0)}
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white hover:text-orange-500 hover:bg-blue-800/40 transition-all uppercase tracking-wider ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Cerrar Sesión"
        >
          <Power className="w-4 h-4" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>

      {/* Collapse button (desktop) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-blue-900 border border-blue-700 rounded-full flex items-center justify-center text-orange-400 hover:text-orange-300 hover:bg-blue-800 transition-all shadow-lg hidden md:flex"
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
        className="fixed top-4 left-4 z-[100] w-10 h-10 bg-blue-900 text-orange-400 rounded-xl flex items-center justify-center shadow-lg md:hidden border border-blue-700"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-0 left-0 h-full bg-blue-950 shadow-2xl"
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
        <div className="h-screen bg-blue-950 text-white shadow-2xl border-r border-blue-800/30">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}
