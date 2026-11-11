import { useState, useEffect } from 'react';
import {
  ArrowLeft, Save, Sparkles, CheckCircle2, RotateCcw,
  Calendar, FileText, Truck, ClipboardList, Award, FileSpreadsheet, Wrench,
  Clock, Hash, AlertCircle
} from 'lucide-react';
import {
  type ConfiguracionContadores,
  type TipoDocumentoContador,
  getConfiguracionContadores,
  guardarConfiguracionContadores,
  subscribeConfiguracionContadores,
  formatearCodigoDocumento,
  estaReinicioActivo
} from './services/contadoresService';

interface ReinicioContadoresProps {
  onBack: () => void;
}

const DOCUMENTOS_INFO: Record<TipoDocumentoContador, {
  titulo: string;
  descripcion: string;
  icon: typeof FileText;
  colorBorder: string;
  colorBg: string;
  colorText: string;
  sugerenciaPrefijo: string;
}> = {
  facturas: {
    titulo: 'Facturas',
    descripcion: 'Numeración oficial de facturas de venta (ej: 27.0001, 27.001 o FAC 27.001).',
    icon: FileText,
    colorBorder: 'border-violet-200 hover:border-violet-400',
    colorBg: 'bg-violet-50 text-violet-700',
    colorText: 'text-violet-700',
    sugerenciaPrefijo: '27.'
  },
  albaranes: {
    titulo: 'Albaranes',
    descripcion: 'Código de albaranes de trabajo y entrega (ej: ALB.27001 o ALB-27-001).',
    icon: Truck,
    colorBorder: 'border-blue-200 hover:border-blue-400',
    colorBg: 'bg-blue-50 text-blue-700',
    colorText: 'text-blue-700',
    sugerenciaPrefijo: 'ALB.27'
  },
  pedidos: {
    titulo: 'Pedidos de Venta / Trabajo',
    descripcion: 'Identificador correlativo de pedidos de clientes (ej: PDV.27001).',
    icon: ClipboardList,
    colorBorder: 'border-emerald-200 hover:border-emerald-400',
    colorBg: 'bg-emerald-50 text-emerald-700',
    colorText: 'text-emerald-700',
    sugerenciaPrefijo: 'PDV.27'
  },
  certificados: {
    titulo: 'Certificados Oficiales',
    descripcion: 'Número de certificado emitido para revisiones e instalaciones (ej: CERT-2027-0001).',
    icon: Award,
    colorBorder: 'border-amber-200 hover:border-amber-400',
    colorBg: 'bg-amber-50 text-amber-700',
    colorText: 'text-amber-700',
    sugerenciaPrefijo: 'CERT-2027-'
  },
  presupuestos: {
    titulo: 'Presupuestos',
    descripcion: 'Código de ofertas y presupuestos comerciales (ej: PRE.27001).',
    icon: FileSpreadsheet,
    colorBorder: 'border-rose-200 hover:border-rose-400',
    colorBg: 'bg-rose-50 text-rose-700',
    colorText: 'text-rose-700',
    sugerenciaPrefijo: 'PRE.27'
  },
  partes: {
    titulo: 'Partes de Revisión / Mantenimiento',
    descripcion: 'Número de parte de trabajo operativo (ej: MANT-2027-0001).',
    icon: Wrench,
    colorBorder: 'border-cyan-200 hover:border-cyan-400',
    colorBg: 'bg-cyan-50 text-cyan-700',
    colorText: 'text-cyan-700',
    sugerenciaPrefijo: 'MANT-2027-'
  }
};

export default function ReinicioContadores({ onBack }: ReinicioContadoresProps) {
  const [config, setConfig] = useState<ConfiguracionContadores>(() => getConfiguracionContadores());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'todos' | TipoDocumentoContador>('todos');
  const [anoObjetivo, setAnoObjetivo] = useState<number>(() => new Date().getFullYear() + 1);

  // Carga y sincronización en tiempo real desde Firestore
  useEffect(() => {
    const unsub = subscribeConfiguracionContadores((data) => {
      setConfig(data);
    });
    return () => unsub();
  }, []);

  const handleFieldChange = (
    tipo: TipoDocumentoContador,
    field: string,
    value: any
  ) => {
    setConfig(prev => {
      const docConf = { ...prev[tipo], [field]: value };
      return {
        ...prev,
        [tipo]: docConf
      };
    });
  };

  const handleSaveAll = async () => {
    setSaveStatus('saving');
    try {
      await guardarConfiguracionContadores(config);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Error guardando configuración de contadores:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3500);
    }
  };

  const aplicarPreajusteAno = (ano: number, fechaCorteTipo: '31dic' | '1ene' | 'hoy') => {
    const currentYear = new Date().getFullYear();
    const yy = ano.toString().slice(-2);
    let fecha = `${currentYear}-12-31`;
    if (fechaCorteTipo === '1ene') {
      fecha = `${ano}-01-01`;
    } else if (fechaCorteTipo === 'hoy') {
      fecha = new Date().toISOString().slice(0, 10);
    }

    setConfig(prev => ({
      ...prev,
      facturas: {
        ...prev.facturas,
        activo: true,
        fechaReinicio: fecha,
        prefijo: `${yy}.`,
        numeroDigitos: 4,
        siguienteNumero: 1
      },
      albaranes: {
        ...prev.albaranes,
        activo: true,
        fechaReinicio: fecha,
        prefijo: `ALB.${yy}`,
        numeroDigitos: 3,
        siguienteNumero: 1
      },
      pedidos: {
        ...prev.pedidos,
        activo: true,
        fechaReinicio: fecha,
        prefijo: `PDV.${yy}`,
        numeroDigitos: 3,
        siguienteNumero: 1
      },
      certificados: {
        ...prev.certificados,
        activo: true,
        fechaReinicio: fecha,
        prefijo: `CERT-${ano}-`,
        numeroDigitos: 4,
        siguienteNumero: 1
      },
      presupuestos: {
        ...prev.presupuestos,
        activo: true,
        fechaReinicio: fecha,
        prefijo: `PRE.${yy}`,
        numeroDigitos: 3,
        siguienteNumero: 1
      },
      partes: {
        ...prev.partes,
        activo: true,
        fechaReinicio: fecha,
        prefijo: `MANT-${ano}-`,
        numeroDigitos: 4,
        siguienteNumero: 1
      }
    }));
  };

  const hoyStr = new Date().toISOString().slice(0, 10);

  const tiposList: TipoDocumentoContador[] = activeTab === 'todos'
    ? ['facturas', 'albaranes', 'pedidos', 'certificados', 'presupuestos', 'partes']
    : [activeTab];

  return (
    <div className="space-y-6 pb-12">
      {/* ── BARRA SUPERIOR DE ACCIONES ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
            title="Volver a la configuración"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-zinc-900 tracking-tight">Reinicio de Contadores</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 text-violet-800 border border-violet-200 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Numeración y Cortes
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Configura fechas de reinicio, prefijos y contadores iniciales para facturas, albaranes, pedidos y certificados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleSaveAll}
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm shadow-sm transition-all cursor-pointer ${
              saveStatus === 'success'
                ? 'bg-emerald-600 text-white'
                : saveStatus === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white active:scale-95'
            }`}
          >
            {saveStatus === 'saving' ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" /> Guardando...
              </>
            ) : saveStatus === 'success' ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> ¡Guardado con éxito!
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="w-4 h-4" /> Error al guardar
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Guardar Todos los Cambios
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── ASISTENTE RÁPIDO DE CAMBIO DE AÑO ── */}
      <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-700 to-slate-900 text-white shadow-lg">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold text-violet-100 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Asistente Rápido de Cambio de Ejercicio
            </div>
            <h3 className="text-xl font-black tracking-tight text-white">
              ¿Preparando la numeración del Año {anoObjetivo}?
            </h3>
            <p className="text-xs text-violet-100/90 leading-relaxed">
              Configura en un solo clic todos los documentos para el año nuevo. Puedes indicar que el cambio se aplique automáticamente a partir del 31 de diciembre, del 1 de enero, o inmediatamente hoy.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-violet-100">Año:</span>
              <input
                type="number"
                min="2025"
                max="2035"
                value={anoObjetivo}
                onChange={e => setAnoObjetivo(parseInt(e.target.value, 10) || (new Date().getFullYear() + 1))}
                className="w-20 px-2.5 py-1.5 rounded-xl bg-white text-zinc-900 font-bold text-sm text-center shadow-inner"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => aplicarPreajusteAno(anoObjetivo, '31dic')}
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all border border-white/30 cursor-pointer"
                title="Aplica corte el 31 de Diciembre"
              >
                Corte 31 Dic
              </button>
              <button
                onClick={() => aplicarPreajusteAno(anoObjetivo, '1ene')}
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all border border-white/30 cursor-pointer"
                title="Aplica corte el 1 de Enero"
              >
                Corte 1 Ene
              </button>
              <button
                onClick={() => aplicarPreajusteAno(anoObjetivo, 'hoy')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 text-xs font-extrabold transition-all shadow-md active:scale-95 cursor-pointer"
                title="Aplica el nuevo formato desde hoy mismo"
              >
                ⚡ Aplicar desde Hoy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── SELECTOR DE PESTAÑAS / FILTRO ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('todos')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'todos'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
          }`}
        >
          Todos los Documentos (6)
        </button>
        {(['facturas', 'albaranes', 'pedidos', 'certificados', 'presupuestos', 'partes'] as TipoDocumentoContador[]).map(tipo => {
          const info = DOCUMENTOS_INFO[tipo];
          const isDocActivo = config[tipo]?.activo;
          return (
            <button
              key={tipo}
              onClick={() => setActiveTab(tipo)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tipo
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
              }`}
            >
              <span>{info.titulo}</span>
              {isDocActivo ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-zinc-300" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── GRID DE TARJETAS DE CADA DOCUMENTO ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tiposList.map(tipo => {
          const info = DOCUMENTOS_INFO[tipo];
          const Icon = info.icon;
          const docConfig = config[tipo] || {
            tipo,
            nombreVisible: info.titulo,
            activo: false,
            fechaReinicio: `${new Date().getFullYear()}-12-31`,
            prefijo: info.sugerenciaPrefijo,
            numeroDigitos: 4,
            siguienteNumero: 1
          };

          const isActivo = docConfig.activo;
          const isVigor = estaReinicioActivo(docConfig, hoyStr);
          const codigoEjemplo = formatearCodigoDocumento(
            docConfig.prefijo,
            docConfig.siguienteNumero || 1,
            docConfig.numeroDigitos
          );

          return (
            <div
              key={tipo}
              className={`flex flex-col justify-between p-6 rounded-3xl bg-white border-2 transition-all shadow-sm ${
                isActivo
                  ? `${info.colorBorder} shadow-md`
                  : 'border-zinc-200/80 hover:border-zinc-300 opacity-90'
              }`}
            >
              <div className="space-y-5">
                {/* Cabecera de la tarjeta con Switch */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${info.colorBg}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-zinc-900">{info.titulo}</h4>
                      <p className="text-xs text-zinc-500">{info.descripcion}</p>
                    </div>
                  </div>

                  {/* Switch Activo / Inactivo */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isActivo}
                      onChange={e => handleFieldChange(tipo, 'activo', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {/* Insignia de estado */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-500">Estado del reinicio:</span>
                  {!isActivo ? (
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                      ⚪ Desactivado (numeración estándar)
                    </span>
                  ) : isVigor ? (
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      🟢 Activo en vigor actualmente
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      Programado para el {docConfig.fechaReinicio.split('-').reverse().join('/')}
                    </span>
                  )}
                </div>

                {/* Campos de configuración */}
                <div className="space-y-4 pt-2 border-t border-zinc-100">
                  {/* Fecha de reinicio */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        Fecha de inicio / reinicio:
                      </label>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleFieldChange(tipo, 'fechaReinicio', hoyStr)}
                          className="text-violet-600 hover:text-violet-800 font-semibold cursor-pointer underline"
                        >
                          Hoy
                        </button>
                        <span className="text-zinc-300">•</span>
                        <button
                          type="button"
                          onClick={() => handleFieldChange(tipo, 'fechaReinicio', `${new Date().getFullYear()}-12-31`)}
                          className="text-violet-600 hover:text-violet-800 font-semibold cursor-pointer underline"
                        >
                          31 Dic
                        </button>
                        <span className="text-zinc-300">•</span>
                        <button
                          type="button"
                          onClick={() => handleFieldChange(tipo, 'fechaReinicio', `${new Date().getFullYear() + 1}-01-01`)}
                          className="text-violet-600 hover:text-violet-800 font-semibold cursor-pointer underline"
                        >
                          1 Ene
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      value={docConfig.fechaReinicio || ''}
                      onChange={e => handleFieldChange(tipo, 'fechaReinicio', e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
                    />
                  </div>

                  {/* Prefijo y Dígitos */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-zinc-700 flex items-center gap-1 mb-1.5">
                        <Hash className="w-3.5 h-3.5 text-zinc-500" />
                        Prefijo del código:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 27. o ALB.27"
                        value={docConfig.prefijo || ''}
                        onChange={e => handleFieldChange(tipo, 'prefijo', e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-700 flex items-center gap-1 mb-1.5">
                        Cifras / Ceros:
                      </label>
                      <select
                        value={docConfig.numeroDigitos || 4}
                        onChange={e => handleFieldChange(tipo, 'numeroDigitos', parseInt(e.target.value, 10) || 4)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
                      >
                        <option value={3}>3 dígitos (ej: 001)</option>
                        <option value={4}>4 dígitos (ej: 0001)</option>
                        <option value={5}>5 dígitos (ej: 00001)</option>
                        <option value={2}>2 dígitos (ej: 01)</option>
                      </select>
                    </div>
                  </div>

                  {/* Contador inicial / Siguiente número */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                        Siguiente número a asignar (contador):
                      </label>
                      <button
                        type="button"
                        onClick={() => handleFieldChange(tipo, 'siguienteNumero', 1)}
                        className="text-[11px] font-bold text-violet-600 hover:text-violet-800 cursor-pointer"
                      >
                        Reiniciar a 1
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={docConfig.siguienteNumero ?? 1}
                        onChange={e => handleFieldChange(tipo, 'siguienteNumero', Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleFieldChange(tipo, 'siguienteNumero', Math.max(1, (docConfig.siguienteNumero || 1) + 1))}
                        className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold cursor-pointer transition-colors"
                        title="Incrementar +1"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── CAJA DE VISTA PREVIA EN VIVO ── */}
                <div className="p-4 rounded-2xl bg-zinc-900 text-white shadow-inner">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 mb-1">
                    <span>VISTA PREVIA DEL PRÓXIMO CÓDIGO</span>
                    <span className="text-emerald-400 font-bold">● En directo</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xl font-black text-amber-300 tracking-wider">
                      {codigoEjemplo}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      luego {formatearCodigoDocumento(docConfig.prefijo, (docConfig.siguienteNumero || 1) + 1, docConfig.numeroDigitos)}...
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón rápido inferior de guardar para esta tarjeta */}
              <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleSaveAll}
                  className="text-xs font-bold text-zinc-600 hover:text-zinc-900 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar cambios
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
