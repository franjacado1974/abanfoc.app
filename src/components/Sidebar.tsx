import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users, CalendarDays, Calendar, FileText, SearchCheck, Wrench,
  HardHat, Calculator, Package, FileCheck, FileDigit, Receipt,
  Settings, Power, ChevronLeft, ChevronRight, LayoutDashboard,
  Menu, X, Inbox, Clock, Gauge, Trash2,
  ChevronDown, Building2, FolderKanban, ClipboardCheck, Files, GraduationCap
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_VERSION } from '../constants';

interface SidebarProps {
  user: { nombre: string; apellidos: string; rol: string } | null;
  onLogout: () => void;
  appLogo: string;
}

interface NavSubItem {
  id: string;
  path: string;
  title: string;
  Icon: React.ElementType;
  allowedRoles: string[];
}

interface NavCategory {
  id: string;
  title: string;
  Icon: React.ElementType;
  path?: string;
  subItems?: NavSubItem[];
  allowedRoles: string[];
  isBottom?: boolean;
}

const CATEGORIAS_MENU: NavCategory[] = [
  // 1. Inicio
  {
    id: 'inicio',
    title: 'Inicio',
    Icon: LayoutDashboard,
    path: '/',
    allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador']
  },

  // 1.1 Calendario (Vista mensual a pantalla completa)
  {
    id: 'calendario',
    title: 'Calendario',
    Icon: Calendar,
    path: '/calendario',
    allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador']
  },

  // 2. Gestión (Clientes, Centros, Catálogo)
  {
    id: 'gestion',
    title: 'Gestión',
    Icon: FolderKanban,
    allowedRoles: ['super-administrador', 'administrador', 'editor'],
    subItems: [
      { id: 'clientes', path: '/clientes', title: 'Clientes', Icon: Users, allowedRoles: ['super-administrador', 'administrador', 'editor'] },
      { id: 'centros', path: '/centros', title: 'Centros', Icon: Building2, allowedRoles: ['super-administrador', 'administrador'] },
      { id: 'catalogo', path: '/catalogo', title: 'Catálogo', Icon: Package, allowedRoles: ['super-administrador', 'administrador', 'editor'] }
    ]
  },

  // 3. Mantenimientos (Planificación, Partes de trabajo, Revisiones)
  {
    id: 'mantenimientos',
    title: 'Mantenimientos',
    Icon: ClipboardCheck,
    allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador'],
    subItems: [
      { id: 'planificacion', path: '/partes_trabajo', title: 'Planificación', Icon: CalendarDays, allowedRoles: ['super-administrador', 'administrador'] },
      { id: 'partes', path: '/partes', title: 'Partes de Trabajo', Icon: FileText, allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador'] },
      { id: 'revisiones', path: '/revisiones', title: 'Revisiones', Icon: SearchCheck, allowedRoles: ['super-administrador', 'administrador'] }
    ]
  },

  // 4. Operaciones (Reparaciones, Instalaciones, Pruebas técnicas)
  {
    id: 'operaciones',
    title: 'Operaciones',
    Icon: Wrench,
    allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico'],
    subItems: [
      { id: 'reparaciones', path: '/reparaciones', title: 'Reparaciones', Icon: Wrench, allowedRoles: ['super-administrador', 'administrador'] },
      { id: 'instalaciones', path: '/instalaciones', title: 'Instalaciones', Icon: HardHat, allowedRoles: ['super-administrador', 'administrador'] },
      { id: 'pruebas-tecnicas', path: '/pruebas-tecnicas', title: 'Pruebas Técnicas', Icon: Gauge, allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico'] }
    ]
  },

  // 5. Documentos (Certificados, Presupuestos, Pedidos, Albaranes, Facturas)
  {
    id: 'documentos',
    title: 'Documentos',
    Icon: Files,
    allowedRoles: ['super-administrador', 'administrador', 'visualizador'],
    subItems: [
      { id: 'certificados', path: '/certificados', title: 'Certificados', Icon: FileCheck, allowedRoles: ['super-administrador', 'administrador'] },
      { id: 'presupuestos', path: '/presupuestos', title: 'Presupuestos', Icon: Calculator, allowedRoles: ['super-administrador', 'administrador'] },
      { id: 'pedidos', path: '/pedidos', title: 'Pedidos', Icon: FileText, allowedRoles: ['super-administrador', 'administrador'] },
      { id: 'albaranes', path: '/albaranes', title: 'Albaranes', Icon: FileDigit, allowedRoles: ['super-administrador', 'administrador', 'visualizador'] },
      { id: 'facturas', path: '/facturas', title: 'Facturas', Icon: Receipt, allowedRoles: ['super-administrador', 'administrador'] }
    ]
  },

  // 7. Tutoriales (Videos y tutoriales de la App)
  {
    id: 'metodos',
    title: 'Tutoriales',
    Icon: GraduationCap,
    path: '/metodos',
    allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico']
  },

  // 6. Papelera (Preservada permanentemente al fondo según Regla 29)
  {
    id: 'papelera',
    title: 'Papelera',
    Icon: Trash2,
    path: '/papelera',
    allowedRoles: ['super-administrador', 'administrador', 'editor'],
    isBottom: true
  }
];

export default function Sidebar({ user, onLogout, appLogo }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [displayLogo, setDisplayLogo] = useState(appLogo);
  const [hasUnreadBuzon, setHasUnreadBuzon] = useState(false);

  // Estado de apertura de acordeones de categorías
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    gestion: false,
    mantenimientos: false,
    operaciones: false,
    documentos: false
  });

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/clientes') return location.pathname === '/clientes' || location.pathname === '/clientes-centros';
    if (path === '/revisiones') return location.pathname === '/revisiones' || location.pathname === '/revision-checklist';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Abrir automáticamente la categoría correspondiente a la ruta activa
  useEffect(() => {
    CATEGORIAS_MENU.forEach((cat) => {
      if (cat.subItems && cat.subItems.some(sub => isActive(sub.path))) {
        setOpenCategories(prev => ({ ...prev, [cat.id]: true }));
      }
    });
  }, [location.pathname]);

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
              const isRed = r > 60 && r > g + 25 && r > b + 25;
              if (isRed) {
                const newG = Math.round(g * 0.1);
                const newB = Math.round(b * 0.1);
                if (g !== newG || b !== newB) {
                  data[i + 1] = newG;
                  data[i + 2] = newB;
                  changed = true;
                }
              } else {
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

  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
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

  // Filtrar categorías y submenús según el rol del usuario
  const visibleCategories = CATEGORIAS_MENU.filter(cat => cat.allowedRoles.includes(userRole)).map(cat => {
    if (cat.subItems) {
      return {
        ...cat,
        subItems: cat.subItems.filter(sub => sub.allowedRoles.includes(userRole))
      };
    }
    return cat;
  }).filter(cat => !cat.subItems || cat.subItems.length > 0);

  const mainCategories = visibleCategories.filter(c => !c.isBottom);
  const bottomCategories = visibleCategories.filter(c => c.isBottom);

  const sidebarBgColor = '#000000';

  const sidebarContent = (
    <div
      className={`flex flex-col h-full ${collapsed ? 'w-14' : 'w-56'} transition-all duration-300 ease-in-out`}
      style={{ backgroundColor: sidebarBgColor }}
    >
      {/* Logo & Header */}
      <div className="flex items-center justify-center px-4 py-5 border-b border-zinc-900 shrink-0">
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
                    onClick={() => handleNavigate('/registro-horario')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      isActive('/registro-horario')
                        ? 'text-red-600 bg-red-600/10'
                        : 'text-zinc-400 hover:text-red-500 hover:bg-white/10'
                    }`}
                    title="Registro horario"
                  >
                    <Clock className="w-4 h-4" strokeWidth={1.75} />
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
                onClick={() => handleNavigate('/registro-horario')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isActive('/registro-horario')
                    ? 'text-red-600 bg-red-600/10'
                    : 'text-zinc-400 hover:text-red-500 hover:bg-white/10'
                }`}
                title="Registro horario"
              >
                <Clock className="w-4 h-4" strokeWidth={1.75} />
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

      {/* Navigation: 7 Categorías con Submenús */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <div className="space-y-1">
          {mainCategories.map((cat) => {
            const hasSubs = cat.subItems && cat.subItems.length > 0;
            const isOpen = !!openCategories[cat.id];
            const isCatActive = hasSubs
              ? cat.subItems?.some(sub => isActive(sub.path))
              : cat.path ? isActive(cat.path) : false;

            // Renderizado en Modo Colapsado
            if (collapsed) {
              return (
                <div key={cat.id} className="relative group/collapsed flex justify-center py-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasSubs && cat.path) {
                        handleNavigate(cat.path);
                      }
                    }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      isCatActive
                        ? 'text-red-600 bg-red-600/15'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={cat.title}
                  >
                    <cat.Icon className="w-4 h-4" strokeWidth={1.75} />
                  </button>

                  {/* Menú flotante al pasar el cursor en modo colapsado */}
                  {hasSubs && (
                    <div className="hidden group-hover/collapsed:flex flex-col absolute left-full top-0 ml-2 z-50 bg-black border border-zinc-800 rounded-2xl p-2 shadow-2xl min-w-[190px] animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-500 border-b border-zinc-900 mb-1 flex items-center gap-2">
                        <cat.Icon className="w-3.5 h-3.5" />
                        <span>{cat.title}</span>
                      </div>
                      <div className="space-y-0.5">
                        {cat.subItems?.map((sub) => {
                          const subActive = isActive(sub.path);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleNavigate(sub.path)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                                subActive
                                  ? 'text-red-600 bg-white/10 font-bold'
                                  : 'text-zinc-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <sub.Icon className={`w-3.5 h-3.5 shrink-0 ${subActive ? 'text-red-600' : 'text-zinc-400'}`} strokeWidth={1.5} />
                              <span className="truncate">{sub.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Renderizado en Modo Expandido
            if (!hasSubs && cat.path) {
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleNavigate(cat.path!)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    isCatActive
                      ? 'text-red-600 bg-red-600/10 font-black shadow-sm'
                      : 'text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className={`flex items-center justify-center w-5 h-5 shrink-0 ${isCatActive ? 'text-red-600' : 'text-zinc-400'}`}>
                    <cat.Icon className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <span className="truncate">{cat.title}</span>
                </button>
              );
            }

            return (
              <div key={cat.id} className="mb-1">
                {/* Cabecera de Categoría con Acordeón */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    isCatActive
                      ? 'text-red-500 bg-white/5 font-black'
                      : 'text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex items-center justify-center w-5 h-5 shrink-0 ${isCatActive ? 'text-red-500' : 'text-zinc-400'}`}>
                      <cat.Icon className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <span className="truncate">{cat.title}</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 text-red-500' : ''
                    }`}
                  />
                </button>

                {/* Submenús desplegables */}
                {isOpen && cat.subItems && (
                  <div className="ml-5 pl-2.5 my-1 border-l-2 border-zinc-800 space-y-0.5 animate-in fade-in duration-150">
                    {cat.subItems.map((sub) => {
                      const subActive = isActive(sub.path);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleNavigate(sub.path)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                            subActive
                              ? 'text-red-600 font-black bg-white/10 shadow-sm'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <sub.Icon className={`w-3.5 h-3.5 shrink-0 ${subActive ? 'text-red-600' : 'text-zinc-400'}`} strokeWidth={1.5} />
                          <span className="truncate">{sub.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Categorías Inferiores (Papelera según Regla 29) */}
        {bottomCategories.length > 0 && (
          <div className="pt-2 mt-3 border-t border-zinc-900/80 space-y-1">
            {bottomCategories.map((cat) => {
              const isCatActive = cat.path ? isActive(cat.path) : false;

              if (collapsed) {
                return (
                  <div key={cat.id} className="flex justify-center py-1">
                    <button
                      type="button"
                      onClick={() => cat.path && handleNavigate(cat.path)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isCatActive
                          ? 'text-red-600 bg-red-600/15'
                          : 'text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={cat.title}
                    >
                      <cat.Icon className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => cat.path && handleNavigate(cat.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    isCatActive
                      ? 'text-red-600 bg-red-600/10 font-black shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className={`flex items-center justify-center w-5 h-5 shrink-0 ${isCatActive ? 'text-red-600' : 'text-zinc-400'}`}>
                    <cat.Icon className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <span className="truncate">{cat.title}</span>
                </button>
              );
            })}
          </div>
        )}
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