import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Package, Wrench } from 'lucide-react';

export default function Catalogo() {
  const navigate = useNavigate();
  const [articulosCount, setArticulosCount] = useState(0);
  const [serviciosCount, setServiciosCount] = useState(0);

  useEffect(() => {
    // Fetch articulos count
    const savedArticulos = localStorage.getItem('firecheck_db_articulos');
    if (savedArticulos) {
      try {
        const parsed = JSON.parse(savedArticulos);
        setArticulosCount(Array.isArray(parsed) ? parsed.length : 0);
      } catch (error) {
        console.error('Error parsing articulos from localStorage:', error);
        setArticulosCount(0);
      }
    } else {
      setArticulosCount(0);
    }
    
    // Fetch servicios count
    const savedServicios = localStorage.getItem('firecheck_db_servicios');
    if (savedServicios) {
      try {
        const parsed = JSON.parse(savedServicios);
        setServiciosCount(Array.isArray(parsed) ? parsed.length : 0);
      } catch (error) {
        console.error('Error parsing servicios from localStorage:', error);
        setServiciosCount(0);
      }
    } else {
      setServiciosCount(0);
    }
  }, []);

  return (
    <div className="min-h-screen bg-fuchsia-50/40 p-6 md:p-12">
      <div className="max-w-7xl mx-auto w-full">
        <button onClick={() => navigate('/')} className="text-sm font-medium text-zinc-500 hover:text-black mb-8 flex items-center gap-2">
          ← Volver al inicio
        </button>
        
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-fuchsia-950 tracking-tight">Catálogo</h1>
          <p className="text-fuchsia-900/60 mt-2">Gestión de inventario de artículos, repuestos y servicios prestados.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
          {/* Tarjeta Artículos */}
          <div 
            onClick={() => navigate('/articulos')}
            className="group relative flex flex-col bg-white p-8 rounded-3xl border border-fuchsia-100 shadow-sm hover:shadow-lg hover:border-fuchsia-200 transition-all text-left overflow-hidden cursor-pointer"
            style={{ minHeight: '220px' }}
          >
            <div className="absolute -top-4 -right-4 p-6 text-fuchsia-50 group-hover:-translate-y-2 group-hover:translate-x-2 transition-transform">
              <Package className="w-32 h-32 opacity-60" />
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-10 relative z-10 group-hover:scale-110 transition-transform shadow-sm bg-fuchsia-100 text-fuchsia-600">
              <Package className="w-6 h-6" strokeWidth={2.5} />
            </div>
            
            <div className="mt-auto relative z-10">
              <h2 className="text-2xl font-bold text-fuchsia-950 mb-2 flex items-center gap-2">
                Artículos
                <span className="shrink-0 px-1.5 py-0.5 bg-fuchsia-100 text-fuchsia-800 text-[10px] font-mono font-bold rounded" title="Artículos registrados">
                  {articulosCount}
                </span>
              </h2>
              <p className="text-fuchsia-900/70 text-sm line-clamp-2">Piezas, repuestos, extintores y productos físicos en stock.</p>
            </div>
          </div>

          {/* Tarjeta Servicios */}
          <div 
            onClick={() => navigate('/servicios')}
            className="group relative flex flex-col bg-white p-8 rounded-3xl border border-fuchsia-100 shadow-sm hover:shadow-lg hover:border-fuchsia-200 transition-all text-left overflow-hidden cursor-pointer"
            style={{ minHeight: '220px' }}
          >
            <div className="absolute -top-4 -right-4 p-6 text-fuchsia-50 group-hover:-translate-y-2 group-hover:translate-x-2 transition-transform">
              <Wrench className="w-32 h-32 opacity-60" />
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-10 relative z-10 group-hover:scale-110 transition-transform shadow-sm bg-fuchsia-100 text-fuchsia-600">
              <Wrench className="w-6 h-6" strokeWidth={2.5} />
            </div>
            
            <div className="mt-auto relative z-10">
              <h2 className="text-2xl font-bold text-fuchsia-950 mb-2 flex items-center gap-2">
                Servicios
                <span className="shrink-0 px-1.5 py-0.5 bg-fuchsia-100 text-fuchsia-800 text-[10px] font-mono font-bold rounded" title="Servicios registrados">
                  {serviciosCount}
                </span>
              </h2>
              <p className="text-fuchsia-900/70 text-sm line-clamp-2">Horas de trabajo, desplazamientos, mantenimientos y mano de obra.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}