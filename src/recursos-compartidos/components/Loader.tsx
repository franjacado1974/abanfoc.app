import { useEffect, useState } from 'react';

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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black overflow-hidden select-none">
      {/* Real Smoke Layer 1 - Crisp, high resolution, moving slowly */}
      <div 
        className="absolute inset-0 bg-cover bg-center select-none pointer-events-none mix-blend-screen animate-smoke-1"
        style={{ backgroundImage: "url('/real_smoke_bg.png')" }}
      />
      
      {/* Real Smoke Layer 2 - Offset, scaling up differently to create depth */}
      <div 
        className="absolute inset-0 bg-cover bg-center select-none pointer-events-none mix-blend-screen animate-smoke-2"
        style={{ backgroundImage: "url('/real_smoke_bg.png')" }}
      />

      {/* Main dark glassmorphic card */}
      <div className="relative z-10 bg-zinc-950/60 backdrop-blur-xl p-8 sm:p-12 rounded-[2.5rem] border border-zinc-900 flex flex-col items-center w-full max-w-sm sm:max-w-md shadow-2xl text-center">
        {/* Rotating Racor Container */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-8 bg-zinc-950 rounded-full flex items-center justify-center border border-zinc-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_10px_25px_-5px_rgba(239,68,68,0.15)] overflow-hidden">
          {/* Outer spinning dashed ring */}
          <div className="absolute inset-1.5 border border-dashed border-red-500/40 rounded-full animate-spin-slow"></div>
          
          {/* Racor Barcelona Icon itself */}
          <img 
            src="/loader-racor.png" 
            alt="Cargando..." 
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain animate-spin-slow select-none pointer-events-none filter drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]" 
            onError={(e) => { (e.target as HTMLImageElement).src = '/racor-barcelona.jpg'; }}
          />
        </div>

        {/* Brand App Text */}
        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2 font-sans bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400">
          ABANFOC
        </h3>
        <p className="text-zinc-400 text-xs sm:text-sm font-semibold min-h-[20px] transition-all duration-300 font-sans tracking-wide">
          {loadingText}
        </p>

        {/* Loading Progress Bar */}
        <div className="w-48 sm:w-56 h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-6 border border-zinc-800/50 shadow-inner">
          <div className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 rounded-full animate-fill-progress"></div>
        </div>

        {/* Status indicator badge */}
        <span className="text-[9px] text-red-400 font-bold uppercase tracking-widest mt-8 px-3.5 py-1 bg-red-950/30 border border-red-900/30 rounded-full font-sans shadow-sm">
          Preparando Entorno
        </span>
      </div>
    </div>
  );
}
