import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, PackageX, ArrowRight, Check } from 'lucide-react';
import { subscribeAvisosStock, type AvisoStock } from '../firebase';

interface AvisoStockModalProps {
  user?: {
    id?: string;
    nombre: string;
    apellidos: string;
    rol: string;
    usuario?: string;
  } | null;
}

export default function AvisoStockModal({ user }: AvisoStockModalProps) {
  const [avisosActivos, setAvisosActivos] = useState<AvisoStock[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('firecheck_dismissed_stock_alerts');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const lastAlertTimestampRef = useRef<number>(0);

  // Reproducir sonido sutil y vibración cuando entra una alerta nueva
  const dispararEfectoAlerta = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch { /* ignore */ }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch { /* audio context blocked or unsupported */ }
  };

  useEffect(() => {
    const unsub = subscribeAvisosStock((items) => {
      // Filtrar avisos activos que no hayan sido descartados por este dispositivo
      const sinDescartar = items.filter(aviso => {
        const key = `${aviso.id}_${aviso.timestamp || aviso.fecha}`;
        return !dismissedKeys.has(key);
      });

      // Si entra un aviso nuevo que no teníamos, reproducir sonido
      const maxTimestamp = Math.max(...items.map(i => i.timestamp || 0), 0);
      if (sinDescartar.length > 0 && maxTimestamp > lastAlertTimestampRef.current) {
        dispararEfectoAlerta();
        lastAlertTimestampRef.current = maxTimestamp;
      }

      setAvisosActivos(sinDescartar);
      setCurrentIndex(0);
    });

    return () => unsub();
  }, [dismissedKeys]);

  const handleDismissCurrent = () => {
    if (avisosActivos.length === 0) return;
    const currentAviso = avisosActivos[currentIndex];
    const key = `${currentAviso.id}_${currentAviso.timestamp || currentAviso.fecha}`;
    
    const updated = new Set(dismissedKeys);
    updated.add(key);
    setDismissedKeys(updated);

    try {
      localStorage.setItem('firecheck_dismissed_stock_alerts', JSON.stringify(Array.from(updated)));
    } catch { /* ignore */ }

    if (currentIndex >= avisosActivos.length - 1) {
      setCurrentIndex(Math.max(0, avisosActivos.length - 2));
    }
  };

  const handleDismissAll = () => {
    const updated = new Set(dismissedKeys);
    avisosActivos.forEach(aviso => {
      const key = `${aviso.id}_${aviso.timestamp || aviso.fecha}`;
      updated.add(key);
    });
    setDismissedKeys(updated);

    try {
      localStorage.setItem('firecheck_dismissed_stock_alerts', JSON.stringify(Array.from(updated)));
    } catch { /* ignore */ }
  };

  const handleGoToCatalogo = () => {
    handleDismissCurrent();
    if (typeof window !== 'undefined') {
      window.location.href = '/catalogo';
    }
  };

  if (avisosActivos.length === 0) {
    return null;
  }

  const currentAviso = avisosActivos[currentIndex] || avisosActivos[0];
  const canAccessCatalogo = user && ['super-administrador', 'administrador', 'editor'].includes(user.rol.toLowerCase());

  // Buscar foto en el aviso o en el caché local de artículos
  const getFotoUrl = (aviso: AvisoStock) => {
    if (aviso.fotoUrl) return aviso.fotoUrl;
    try {
      const savedArticulos = localStorage.getItem('firecheck_db_articulos');
      if (savedArticulos) {
        const list = JSON.parse(savedArticulos);
        const match = list.find((a: any) => a.id === (aviso.articuloId || aviso.id) || a.codigo === aviso.codigo);
        if (match && match.fotoUrl) return match.fotoUrl;
      }
    } catch { /* ignore */ }
    return undefined;
  };

  const fotoUrlArticulo = currentAviso ? getFotoUrl(currentAviso) : undefined;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-[0_25px_60px_-15px_rgba(220,38,38,0.35)] border-2 border-red-500 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Cabecera de Alerta */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shrink-0 shadow-inner">
              <PackageX className="w-6 h-6 text-white animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full border border-white/30">
                Rotura de Stock
              </span>
              <h3 className="text-lg font-black tracking-tight leading-tight mt-0.5">
                ¡ARTÍCULO EN STOCK 0!
              </h3>
            </div>
          </div>

          {avisosActivos.length > 1 && (
            <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full border border-white/30">
              {currentIndex + 1} de {avisosActivos.length}
            </span>
          )}
        </div>

        {/* Cuerpo del Mensaje */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-start gap-3 p-3.5 bg-red-50/80 rounded-2xl border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
            <p className="text-xs text-red-900 leading-relaxed font-medium">
              El siguiente artículo ha alcanzado <strong className="text-red-700 font-bold underline">0 unidades en stock</strong>. Es urgente reponer o tramitar pedido de material.
            </p>
          </div>

          {/* Tarjeta de Datos del Artículo */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            {/* Foto del Artículo */}
            {fotoUrlArticulo ? (
              <div className="w-full h-44 bg-white border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center p-2 shadow-inner">
                <img
                  src={fotoUrlArticulo}
                  alt={currentAviso.nombre}
                  className="w-full h-full object-contain img-no-bg"
                />
              </div>
            ) : (
              <div className="w-full h-24 bg-slate-100/70 border border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-slate-400">
                <PackageX className="w-6 h-6 opacity-40 text-slate-500" />
                <span className="text-xs font-medium">Sin foto de artículo</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                {currentAviso.codigo}
              </span>
              <span className="text-[11px] font-black uppercase text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block" />
                Stock: 0 uds (Agotado)
              </span>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Artículo / Descripción
              </label>
              <h4 className="text-base font-semibold text-slate-800 leading-snug">
                {currentAviso.nombre}
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Familia / Sistema</span>
                <span className="font-semibold text-slate-700">{currentAviso.familia || 'General'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tipo / Modelo</span>
                <span className="font-semibold text-slate-700">
                  {currentAviso.tipo || 'Repuesto'} {currentAviso.modelo ? `(${currentAviso.modelo})` : ''}
                </span>
              </div>
            </div>

            {currentAviso.observaciones && (
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">
                  Ubicación en Taller / Notas
                </span>
                <p className="text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-200">
                  {currentAviso.observaciones}
                </p>
              </div>
            )}
          </div>

          {/* Navegación si hay varios avisos */}
          {avisosActivos.length > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <button
                type="button"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed font-medium"
              >
                ← Anterior
              </button>
              <span className="font-medium text-slate-600">
                Aviso {currentIndex + 1} de {avisosActivos.length}
              </span>
              <button
                type="button"
                onClick={() => setCurrentIndex(prev => Math.min(avisosActivos.length - 1, prev + 1))}
                disabled={currentIndex === avisosActivos.length - 1}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed font-medium"
              >
                Siguiente →
              </button>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={handleDismissCurrent}
              className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              Entendido / Aceptar
            </button>

            {avisosActivos.length > 1 && (
              <button
                type="button"
                onClick={handleDismissAll}
                className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                title="Aceptar todas las alertas pendientes"
              >
                Aceptar todas
              </button>
            )}

            {canAccessCatalogo && (
              <button
                type="button"
                onClick={handleGoToCatalogo}
                className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Ir al Catálogo</span>
                <ArrowRight className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
