import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Hammer, Construction, Sparkles } from 'lucide-react';

export default function Taller() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[85vh] flex flex-col justify-between p-4 sm:p-8">
      {/* Cabecera */}
      <div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-4 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
            <Hammer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Taller</h1>
            <p className="text-xs font-semibold text-zinc-500 mt-0.5">Gestión interna de taller, retimbrados y maquinaria.</p>
          </div>
        </div>
      </div>

      {/* Tarjeta En Construcción */}
      <div className="max-w-lg mx-auto w-full my-auto py-12 text-center">
        <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-sm p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-100/50 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-orange-100/40 rounded-full blur-2xl pointer-events-none" />

          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <Construction className="w-8 h-8 animate-bounce" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-black tracking-wider uppercase mb-3">
              <Sparkles className="w-3 h-3 text-amber-500" />
              En construcción
            </div>

            <h2 className="text-xl font-black text-zinc-900 mb-2">Módulo en Desarrollo</h2>
            <p className="text-sm font-medium text-zinc-500 leading-relaxed mb-6">
              Estamos trabajando en este apartado. Muy pronto podrás gestionar aquí todas las operaciones internas de taller, revisiones en banco y control de equipos.
            </p>

            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al inicio
            </button>
          </div>
        </div>
      </div>

      <div className="text-center text-[11px] text-zinc-400 font-medium">
        Salamandra FireCheck · Módulo Taller
      </div>
    </div>
  );
}
