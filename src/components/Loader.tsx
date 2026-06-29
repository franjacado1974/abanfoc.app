import { useEffect, useState } from 'react';
import { extintorBase64 } from '../icono_extintor';

export default function Loader() {
  const [loadingText, setLoadingText] = useState('Iniciando sesión segura...');

  useEffect(() => {
    const t1 = setTimeout(() => {
      setLoadingText('Cargando clientes y centros...');
    }, 800);

    const t2 = setTimeout(() => {
      setLoadingText('Sincronizando planificaciones y partes...');
    }, 1600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#f8f6f3] via-[#ffffff] to-[#f0edf5]">
      {/* Background ambient design details */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-red-100 rounded-full blur-3xl opacity-40 animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-zinc-200 rounded-full blur-3xl opacity-40 animate-pulse"></div>

      {/* Main glassmorphic card */}
      <div className="bg-white/80 backdrop-blur-md p-8 sm:p-12 rounded-[2.5rem] border border-zinc-200/80 flex flex-col items-center w-full max-w-sm sm:max-w-md animate-pulse-glow text-center">
        {/* Extinguisher Icon Container */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-8 bg-zinc-50 rounded-full flex items-center justify-center border border-zinc-200/50 shadow-inner overflow-hidden">
          {/* Subtle rotating pattern border inside */}
          <div className="absolute inset-2 border-2 border-dashed border-red-500/20 rounded-full animate-spin-slow"></div>
          {/* Extinguisher Icon itself */}
          <img 
            src={extintorBase64} 
            alt="Extintor" 
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain animate-spin-slow select-none pointer-events-none" 
            onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }}
          />
        </div>

        {/* Text */}
        <h3 className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight mb-2">
          Abanfoc App
        </h3>
        <p className="text-zinc-500 text-xs sm:text-sm font-medium min-h-[20px] transition-all duration-300">
          {loadingText}
        </p>

        {/* Progress Bar Container */}
        <div className="w-48 sm:w-56 h-1.5 bg-zinc-100 rounded-full overflow-hidden mt-6 border border-zinc-200/40">
          <div className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full animate-fill-progress"></div>
        </div>

        {/* Version label */}
        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-8">
          Preparando entorno
        </span>
      </div>
    </div>
  );
}
