 import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { 
  Users, Building2, Calculator,
  FileCheck, HardHat,
  SearchCheck, Wrench, Receipt, FileDigit, Package, CalendarDays,
  Settings, X, Plus, Trash2, Image as ImageIcon
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Clientes from './Clientes';
import Centros from './Centros';
import Revisiones from './Revisiones';
import Catalogo from './Catalogo';
import Articulos from './Articulos';
import Servicios from './Servicios';
import Sistemas from './Sistemas';
import Partes from './Partes';
import Albaranes from './Albaranes';
import Certificados from './Certificados';

function DashboardCard({ card, navigate }: { card: any, navigate: any }) {
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

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ clientes: 0, centros: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appLogo, setAppLogo] = useState('/logo.png');
  const [tecnicos, setTecnicos] = useState<{id: string, nombre: string, apellidos: string}[]>([]);
  const [nuevoTecnico, setNuevoTecnico] = useState({nombre: '', apellidos: ''});
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const storedLogo = localStorage.getItem('firecheck_db_logo');
      if (storedLogo) setAppLogo(storedLogo);
      
      const storedTecnicos = localStorage.getItem('firecheck_db_tecnicos');
      if (storedTecnicos) setTecnicos(JSON.parse(storedTecnicos));
    } catch (e) { console.error(e); }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        setAppLogo(base64);
        localStorage.setItem('firecheck_db_logo', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTecnico = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTecnico.nombre.trim() || !nuevoTecnico.apellidos.trim()) return;
    
    const newTec = {
      id: crypto.randomUUID(),
      nombre: nuevoTecnico.nombre.trim(),
      apellidos: nuevoTecnico.apellidos.trim()
    };
    
    const updated = [...tecnicos, newTec];
    setTecnicos(updated);
    localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(updated));
    setNuevoTecnico({nombre: '', apellidos: ''});
  };

  const handleDeleteTecnico = (id: string) => {
    const updated = tecnicos.filter(t => t.id !== id);
    setTecnicos(updated);
    localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(updated));
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
    { id: 'partes', path: '/partes', title: 'Planificación', desc: 'Planificación de los partes de trabajo.', Icon: CalendarDays, color: 'amber' },
    { id: 'revisiones', path: '/revisiones', title: 'Revisiones', desc: 'Mantenimiento de las instalaciones.', Icon: SearchCheck, color: 'indigo' },
    { id: 'reparaciones', path: '/reparaciones', title: 'Reparaciones', desc: 'Reparaciónes y Urgencias.', Icon: Wrench, color: 'red' },
    { id: 'instalaciones', path: '/instalaciones', title: 'Instalaciones', desc: 'Instalaciones y ampliación de sistemas.', Icon: HardHat, color: 'teal' },
    { id: 'presupuestos', path: '/presupuestos', title: 'Presupuestos', desc: 'Elaboración y gestión de presupuestos.', Icon: Calculator, color: 'orange' },
    { id: 'catalogo', path: '/catalogo', title: 'Catálogo', desc: 'Gestión de artículos y servicios.', Icon: Package, color: 'fuchsia' },
    { id: 'certificados', path: '/certificados', title: 'Certificados', desc: 'Gestión de certificados.', Icon: FileCheck, color: 'cyan' },
    { id: 'albaranes', path: '/albaranes', title: 'Albaranes', desc: 'Control de entregas y albaranes de trabajo.', Icon: FileDigit, color: 'violet' },
    { id: 'facturas', path: '/facturas', title: 'Facturas', desc: 'Facturación y control de cobros.', Icon: Receipt, color: 'rose' }
  ];

  const [cards] = useState(initialCards);

  useEffect(() => {
    let clientes = 0;
    let centros = 0;
    
    try {
      const savedClientes = localStorage.getItem('firecheck_db_clientes');
      if (savedClientes) clientes = JSON.parse(savedClientes).length;
      
      const savedCentros = localStorage.getItem('firecheck_db_centros');
      if (savedCentros) centros = JSON.parse(savedCentros).length;
    } catch (e) {}
    
    setStats({ clientes, centros });
  }, []);

  // Inject stats
  const cardsWithStats = cards.map(c => {
    if (c.id === 'clientes') return { ...c, stat: stats.clientes };
    if (c.id === 'centros') return { ...c, stat: stats.centros };
    return c;
  });

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 md:p-12 relative overflow-hidden">
      <div className="max-w-7xl w-full">
        {/* Header simple */}
        <div className="flex flex-col items-center md:flex-row md:justify-between mb-10 md:mb-12 gap-6 md:gap-4">
          <img src={appLogo} alt="Logo de la aplicación" className="h-12 md:h-16 max-w-[250px] object-contain" />
          
          <div className="text-center md:text-right flex flex-col justify-center relative min-w-[200px]">
            <div className="flex justify-center md:justify-end mb-2">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center justify-center p-2 text-zinc-400 hover:text-zinc-800 bg-white rounded-full shadow-sm hover:shadow transition-all border border-zinc-200"
                title="Ajustes del Sistema"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs md:text-sm font-medium text-zinc-500 capitalize">{formatDate(currentTime)}</p>
            <p className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight leading-none mt-1">{formatTime(currentTime)}</p>
            <span className="text-[10px] text-zinc-400 mt-1 font-medium">v.1.0</span>
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
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-100">
              <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-3">
                <Settings className="w-6 h-6 text-zinc-500" />
                Ajustes del Sistema
              </h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-10">
              {/* LOGOTIPO */}
              <section>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Logotipo de la App
                </h3>
                <div className="flex flex-col items-start gap-6">
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex items-center justify-center w-full max-w-[250px] min-h-[100px]">
                    <img src={appLogo} alt="Logo Actual" className="h-16 object-contain" />
                  </div>
                  <div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={logoInputRef}
                      onChange={handleLogoUpload}
                      className="hidden" 
                    />
                    <button 
                      onClick={() => logoInputRef.current?.click()}
                      className="px-4 py-2 border-2 border-dashed border-zinc-300 hover:border-black text-zinc-600 hover:text-black font-medium rounded-xl transition-colors"
                    >
                      Subir nueva imagen
                    </button>
                    <p className="text-xs text-zinc-400 mt-2">Formatos recomendados: PNG, JPG (fondo transparente)</p>
                  </div>
                </div>
              </section>

              {/* TÉCNICOS */}
              <section>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <HardHat className="w-4 h-4" /> Gestión de Técnicos
                </h3>
                
                <form onSubmit={handleAddTecnico} className="flex flex-col gap-3 mb-6">
                  <input
                    type="text"
                    required
                    placeholder="Nombre"
                    value={nuevoTecnico.nombre}
                    onChange={e => setNuevoTecnico({...nuevoTecnico, nombre: e.target.value})}
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Apellidos"
                    value={nuevoTecnico.apellidos}
                    onChange={e => setNuevoTecnico({...nuevoTecnico, apellidos: e.target.value})}
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  />
                  <button type="submit" className="bg-black hover:bg-zinc-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-medium">
                    <Plus className="w-4 h-4" /> Añadir
                  </button>
                </form>

                <div className="border border-zinc-100 rounded-2xl overflow-hidden bg-zinc-50/50">
                  {tecnicos.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 text-sm">
                      No hay técnicos registrados. Añade el primero arriba.
                    </div>
                  ) : (
                    <ul className="divide-y divide-zinc-100">
                      {tecnicos.map(t => (
                        <li key={t.id} className="p-4 flex items-center justify-between bg-white hover:bg-zinc-50 transition-colors">
                          <span className="font-medium text-zinc-900">{t.nombre} {t.apellidos}</span>
                          <button 
                            onClick={() => handleDeleteTecnico(t.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/centros" element={<Centros />} />
        <Route path="/presupuestos" element={<PlaceholderPage title="Gestión de Presupuestos" bgColor="bg-orange-50/40" />} />
        <Route path="/albaranes" element={<Albaranes />} /> {/* Mantener esta línea si ya estaba */}
        <Route path="/facturas" element={<PlaceholderPage title="Facturación" bgColor="bg-rose-50/40" />} />
        <Route path="/partes" element={<Partes />} />
        <Route path="/certificados" element={<Certificados />} />
        <Route path="/instalaciones" element={<PlaceholderPage title="Instalaciones" bgColor="bg-teal-50/40" />} />
        <Route path="/revisiones" element={<Revisiones />} />
        <Route path="/reparaciones" element={<PlaceholderPage title="Reparaciones y Averías" bgColor="bg-red-50/40" />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/articulos" element={<Articulos />} />
        <Route path="/servicios" element={<Servicios />} />
      </Routes>
    </BrowserRouter>
  );
}
