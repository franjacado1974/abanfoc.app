import { useState, useEffect, useRef } from 'react';
import { Download, CheckCircle, Clock, ShieldCheck, FileText, Check, AlertCircle, RefreshCw, PenTool } from 'lucide-react';
import { 
  getPresupuestoByToken, 
  registrarVisitaPresupuesto, 
  registrarDescargaPresupuesto, 
  firmarPresupuestoPublico,
  type Presupuesto 
} from './firebase';
import { generarPresupuestoPDF } from './pdfGenerator';

interface PortalPresupuestoProps {
  token: string;
}

function formatMoneda(valor: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor) || 0);
}

function formatFecha(fecha?: string): string {
  if (!fecha) return '—';
  try {
    return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return fecha;
  }
}

function formatCodigoPresupuesto(numero?: string, fallbackId?: string): string {
  if (!numero && !fallbackId) return 'PRV —';
  const raw = (numero || fallbackId || '').trim();
  const clean = raw.replace(/^(PDV|PRV|PRE)[-\s]*/i, '');
  return `PRV ${clean}`;
}

export default function PortalPresupuesto({ token }: PortalPresupuestoProps) {
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados del formulario de firma
  const [nombreFirmante, setNombreFirmante] = useState('');
  const [dniFirmante, setDniFirmante] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [isSubmittingFirma, setIsSubmittingFirma] = useState(false);
  const [firmaCompletada, setFirmaCompletada] = useState(false);
  const [descargandoPDF, setDescargandoPDF] = useState(false);

  // Canvas de firma digital
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const isDrawing = useRef(false);

  // Cargar presupuesto y registrar visita
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const p = await getPresupuestoByToken(token);
        if (!p) {
          if (isMounted) {
            setError('No se ha encontrado el presupuesto solicitado o el enlace ha caducado.');
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setPresupuesto(p);
          if (p.estado === 'Aprobado' || p.seguimiento?.firmado) {
            setFirmaCompletada(true);
          }
          setLoading(false);
        }

        // Registrar visita en segundo plano (solo 1 vez por sesión de navegador)
        const sessionKey = `visited_presupuesto_${p._docId || p.id}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, '1');
          const updatedSeg = await registrarVisitaPresupuesto(p._docId || p.id, p.seguimiento);
          if (isMounted && updatedSeg) {
            setPresupuesto(prev => prev ? { ...prev, seguimiento: updatedSeg } : prev);
          }
        }
      } catch (err: any) {
        console.error('Error cargando presupuesto público:', err);
        if (isMounted) {
          setError('Ocurrió un error al cargar el presupuesto. Por favor intente más tarde.');
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [token]);

  // Manejo del Canvas de firma
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const startDraw = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawing.current = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setHasSignature(true);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const stopDraw = () => {
      isDrawing.current = false;
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    window.addEventListener('touchend', stopDraw);

    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      window.removeEventListener('mouseup', stopDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      window.removeEventListener('touchend', stopDraw);
    };
  }, [presupuesto, firmaCompletada]);

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Descargar PDF y registrar evento
  const handleDescargarPDF = async () => {
    if (!presupuesto) return;
    try {
      setDescargandoPDF(true);
      await generarPresupuestoPDF({
        titulo: presupuesto.titulo,
        numeroPresupuesto: presupuesto.numeroPresupuesto,
        nombreCliente: presupuesto.nombreCliente || 'Cliente',
        fechaCreacion: presupuesto.fechaCreacion,
        fechaValidez: presupuesto.fechaValidez,
        estado: presupuesto.estado,
        lineas: (presupuesto.lineas || []).map(l => ({
          familia: l.familia,
          concepto: l.concepto,
          descripcion: l.descripcion,
          codigo: l.codigo,
          fotoUrl: l.fotoUrl,
          cantidad: l.cantidad,
          precioUnidad: l.precioUnidad,
          subtotal: l.subtotal,
        })),
        subtotal: presupuesto.subtotal,
        descuentoPorcentaje: presupuesto.descuentoPorcentaje,
        descuentoImporte: presupuesto.descuentoImporte,
        iva: presupuesto.iva,
        total: presupuesto.total,
        notas: presupuesto.notas,
      });

      // Registrar descarga en Firestore
      const docId = presupuesto._docId || presupuesto.id;
      const updatedSeg = await registrarDescargaPresupuesto(docId, presupuesto.seguimiento);
      if (updatedSeg) {
        setPresupuesto(prev => prev ? { ...prev, seguimiento: updatedSeg } : prev);
      }
    } catch (e) {
      console.error('Error al generar PDF público:', e);
      alert('Hubo un problema al generar el documento PDF. Por favor inténtelo de nuevo.');
    } finally {
      setDescargandoPDF(false);
    }
  };

  // Enviar aceptación y firma
  const handleConfirmarFirma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presupuesto) return;
    if (!nombreFirmante.trim()) {
      alert('Por favor introduzca el nombre y apellidos de la persona firmante.');
      return;
    }
    if (!dniFirmante.trim()) {
      alert('Por favor introduzca el DNI / NIF de la persona firmante.');
      return;
    }
    if (!hasSignature || !canvasRef.current) {
      alert('Por favor dibuje su firma manuscrita en el recuadro antes de confirmar.');
      return;
    }
    if (!aceptaTerminos) {
      alert('Debe marcar la casilla aceptando los términos y condiciones de la oferta comercial.');
      return;
    }

    try {
      setIsSubmittingFirma(true);
      const firmaBase64 = canvasRef.current.toDataURL('image/png');
      const docId = presupuesto._docId || presupuesto.id;

      await firmarPresupuestoPublico(docId, {
        nombre: nombreFirmante.trim(),
        dni: dniFirmante.trim().toUpperCase(),
        firmaBase64
      }, presupuesto.seguimiento);

      setFirmaCompletada(true);
      setPresupuesto(prev => prev ? {
        ...prev,
        estado: 'Aprobado',
        seguimiento: {
          ...(prev.seguimiento || {}),
          firmado: {
            nombre: nombreFirmante.trim(),
            dni: dniFirmante.trim().toUpperCase(),
            fecha: new Date().toISOString(),
            firmaBase64
          }
        }
      } : prev);
    } catch (err: any) {
      console.error('Error guardando firma:', err);
      alert('Error al registrar la aceptación: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsSubmittingFirma(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Cargando presupuesto...</h2>
          <p className="text-xs text-slate-500">Estamos verificando y preparando el documento oficial.</p>
        </div>
      </div>
    );
  }

  if (error || !presupuesto) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Presupuesto no disponible</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'El enlace no es válido o ha expirado.'}</p>
          <div className="text-xs text-slate-400">
            Si cree que se trata de un error, póngase en contacto con <strong className="text-slate-700">ABANFOC S.L.</strong> al 93 010 89 17.
          </div>
        </div>
      </div>
    );
  }

  const codPresupuesto = formatCodigoPresupuesto(presupuesto.numeroPresupuesto, presupuesto.id);
  const estaAprobado = presupuesto.estado === 'Aprobado' || firmaCompletada;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 pb-16 font-sans">
      {/* Barra superior corporativa */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ABANFOC" className="h-8 w-auto object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
            <div className="border-l border-slate-200 pl-3">
              <span className="text-xs font-black tracking-wider text-slate-900 uppercase">ABANFOC S.L.</span>
              <p className="text-[10px] text-slate-400 font-medium">Protección Contra Incendios</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDescargarPDF}
              disabled={descargandoPDF}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              title="Descargar documento en PDF"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">{descargandoPDF ? 'Generando...' : 'Descargar PDF'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        {/* Banner de estado */}
        {estaAprobado ? (
          <div className="mb-6 bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-emerald-950">Presupuesto Aprobado y Firmado</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Este presupuesto ya ha sido firmado digitalmente y se encuentra aceptado para su ejecución.
                {presupuesto.seguimiento?.firmado && (
                  <span className="block mt-1 font-semibold text-emerald-900">
                    Firmado por: {presupuesto.seguimiento.firmado.nombre} (DNI: {presupuesto.seguimiento.firmado.dni}) el {formatFecha(presupuesto.seguimiento.firmado.fecha)}.
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6 bg-sky-50 border border-sky-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-sky-950">Oferta Comercial Pendiente de Aceptación</h3>
                <p className="text-[11px] sm:text-xs text-sky-800 mt-0.5">Puede revisar el desglose, descargar el documento PDF y rubricar su conformidad online.</p>
              </div>
            </div>
            <a
              href="#seccion-firma"
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shrink-0 shadow-md shadow-red-500/20"
            >
              Firmar Ahora
            </a>
          </div>
        )}

        {/* Tarjeta Principal del Presupuesto */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden mb-8">
          {/* Cabecera del documento */}
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-red-50 text-red-600 border border-red-100 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> Presupuesto Oficial
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{presupuesto.titulo}</h1>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Emitido por <span className="text-slate-800 font-bold">ABANFOC S.L.</span> &bull; CIF: B16794679
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 shrink-0 min-w-[220px]">
                <div className="text-xs font-bold text-slate-400 uppercase">Referencia</div>
                <div className="text-lg font-black font-mono text-slate-900 mt-0.5">{codPresupuesto}</div>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/70 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-medium">Fecha:</span>
                    <p className="font-bold text-slate-700">{formatFecha(presupuesto.fechaCreacion)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Validez:</span>
                    <p className="font-bold text-slate-700">{formatFecha(presupuesto.fechaValidez)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Datos del cliente */}
            <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cliente Destinatario</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">{presupuesto.nombreCliente || 'Cliente'}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Importe Total Presupuestado</p>
                <p className="text-2xl font-black text-red-600 mt-0.5">{formatMoneda(presupuesto.total)}</p>
              </div>
            </div>
          </div>

          {/* Tabla de Artículos */}
          <div className="p-4 sm:p-8">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" /> Desglose de Partidas y Materiales
            </h2>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Artículo / Concepto</th>
                    <th className="py-3 px-3 text-center w-16">Cant.</th>
                    <th className="py-3 px-4 text-right w-28">Precio Ud.</th>
                    <th className="py-3 px-4 text-right w-32">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(presupuesto.lineas || []).map((linea, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="font-semibold text-slate-900">{linea.concepto}</div>
                        {linea.codigo && <span className="text-[10px] font-mono text-slate-400 mr-2">Cód: {linea.codigo}</span>}
                        {linea.descripcion && <p className="text-[11px] text-slate-500 mt-0.5 font-normal">{linea.descripcion}</p>}
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-700 font-bold">{linea.cantidad}</td>
                      <td className="py-3.5 px-4 text-right text-slate-600">{formatMoneda(linea.precioUnidad)}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatMoneda(linea.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fila de Descuento si existe */}
            {presupuesto.descuentoPorcentaje && Number(presupuesto.descuentoPorcentaje) > 0 ? (
              <div className="mt-4 border-b border-slate-200 pb-3 pt-2 px-3 flex items-center justify-between text-xs font-bold text-red-600 bg-red-50/40 rounded-xl">
                <span>Descuento sobre el subtotal: {Number(presupuesto.descuentoPorcentaje).toFixed(2).replace('.', ',')} %</span>
                <span>-{formatMoneda(presupuesto.descuentoImporte || (presupuesto.subtotal * Number(presupuesto.descuentoPorcentaje) / 100))}</span>
              </div>
            ) : null}

            {/* Totales */}
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-slate-100">
              <div className="w-full sm:max-w-md">
                {presupuesto.notas && (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Notas y Condiciones</p>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{presupuesto.notas}</p>
                  </div>
                )}
              </div>

              <div className="w-full sm:w-72 bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-800">{formatMoneda(presupuesto.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>IVA ({presupuesto.iva}%):</span>
                  <span className="font-semibold text-slate-800">
                    {presupuesto.iva === 0 ? 'Exento (0%)' : formatMoneda((presupuesto.subtotal - (presupuesto.descuentoImporte || 0)) * presupuesto.iva / 100)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-xs font-black text-slate-900 uppercase">TOTAL:</span>
                  <span className="text-xl font-black text-red-600">{formatMoneda(presupuesto.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Firma / Aceptación Digital */}
        <div id="seccion-firma" className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden scroll-mt-24">
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PenTool className="w-5 h-5 text-red-600" /> Aceptación y Firma Digital del Presupuesto
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Rellene los datos del representante y rubrique con el dedo o ratón para confirmar la aceptación de esta oferta.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {estaAprobado ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-1">¡Presupuesto Aceptado y Firmado!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                  Muchas gracias por su confianza. El departamento de operaciones de ABANFOC S.L. ha sido notificado y comenzará las gestiones oportunas.
                </p>

                {presupuesto.seguimiento?.firmado?.firmaBase64 && (
                  <div className="inline-block p-4 bg-slate-50 rounded-2xl border border-slate-200 max-w-xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Firma Registrada</p>
                    <img src={presupuesto.seguimiento.firmado.firmaBase64} alt="Firma del cliente" className="h-20 w-auto mx-auto object-contain" />
                    <div className="mt-2 text-[11px] text-slate-600 border-t border-slate-200 pt-2 font-medium">
                      {presupuesto.seguimiento.firmado.nombre} &bull; {presupuesto.seguimiento.firmado.dni}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleConfirmarFirma} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nombre y Apellidos del Firmante *</label>
                    <input
                      type="text"
                      required
                      value={nombreFirmante}
                      onChange={(e) => setNombreFirmante(e.target.value)}
                      placeholder="Ej. Juan Pérez García"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-red-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">DNI / NIF del Representante *</label>
                    <input
                      type="text"
                      required
                      value={dniFirmante}
                      onChange={(e) => setDniFirmante(e.target.value)}
                      placeholder="Ej. 12345678Z"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 uppercase focus:bg-white focus:border-red-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Lienzo Canvas de Firma */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Firma Manuscrita Digital *</label>
                    <button
                      type="button"
                      onClick={handleClearSignature}
                      className="text-[11px] font-semibold text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      Limpiar firma
                    </button>
                  </div>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-1 flex items-center justify-center overflow-hidden touch-none relative">
                    <canvas
                      ref={canvasRef}
                      width={700}
                      height={200}
                      className="w-full h-44 bg-white rounded-xl cursor-crosshair touch-none"
                    />
                    {!hasSignature && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-semibold">
                        Dibuje su firma aquí con el dedo o ratón
                      </div>
                    )}
                  </div>
                </div>

                {/* Casilla de aceptación */}
                <div className="flex items-start gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="terminos"
                    required
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="terminos" className="text-xs text-slate-600 leading-relaxed select-none cursor-pointer">
                    Confirmo la aceptación del presupuesto <strong className="text-slate-900">{codPresupuesto}</strong> por un importe total de <strong className="text-slate-900">{formatMoneda(presupuesto.total)}</strong> y autorizo a ABANFOC S.L. a coordinar el inicio de los trabajos según las condiciones descritas.
                  </label>
                </div>

                {/* Botón enviar firma */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isSubmittingFirma}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {isSubmittingFirma ? 'Procesando Aceptación...' : 'Aceptar y Confirmar Presupuesto'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Pie de página */}
      <footer className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} ABANFOC S.L. &bull; Empresa Mantenedora de Sistemas Contra Incendios &bull; RASIC: 10600168</p>
        <p className="mt-1 text-[11px] text-slate-400">C/ America 16 B Ático, 08921 Sta. Coloma Gramanet, Barcelona &bull; Tel: 93 010 89 17 &bull; abanfoc@abanfoc.es</p>
      </footer>
    </div>
  );
}
