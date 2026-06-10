import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, FileText, RefreshCw, Calendar, User as UserIcon, Building2, MapPin, Trash2, X, Search, ArrowLeft, ChevronRight, Layers, Edit, AlertTriangle, Lock, LockOpen, Eye } from 'lucide-react';
import { addParte, updateParte, deleteParte, subscribePartes, type Albaran, type Tecnico } from './firebase';
import type { Parte, Centro, Cliente, CentroSistema, EquipoInstalado } from './Centros';
import { generarActaExtintoresPDF, generarAlbaranPDF, generarAlbaranPDFView, generarCertificadoPDF, generarCertificadoPDFView } from './pdfGenerator';

const generateId = () => {
  return crypto.randomUUID();
};

interface EmpresaData {
  _docId?: string;
  nombre: string;
  cif?: string;
}

// ============================================================
// VISTA MÓVIL PARA TÉCNICO (rol: editor)
// ============================================================
function VistaTecnicoMovil({ partes, centros, clientes, tecnicos }: {
  partes: Parte[];
  centros: Centro[];
  clientes: Cliente[];
  tecnicos: Tecnico[];
}) {
  const navigate = useNavigate();
  const [parteSeleccionado, setParteSeleccionado] = useState<Parte | null>(null);
  const [equiposInstalados, setEquiposInstalados] = useState<EquipoInstalado[]>([]);
  const [centroSistemas, setCentroSistemas] = useState<CentroSistema[]>([]);

  // Obtener técnico del usuario logueado
  const loggedUser = (() => {
    try { return JSON.parse(sessionStorage.getItem('firecheck_logged_user') || 'null'); } catch { return null; }
  })();

  // Suscripción a equipos instalados
  useEffect(() => {
    const storedEquipos = localStorage.getItem('firecheck_db_equipos_instalados');
    if (storedEquipos) {
      try {
        setEquiposInstalados(JSON.parse(storedEquipos));
      } catch (e) {
        console.error("Error parsing equipos from localStorage:", e);
      }
    }
  }, []);

  // Suscripción a sistemas del centro
  useEffect(() => {
    const storedSistemas = localStorage.getItem('firecheck_db_centro_sistemas');
    if (storedSistemas) {
      try {
        setCentroSistemas(JSON.parse(storedSistemas));
      } catch (e) {
        console.error("Error parsing sistemas from localStorage:", e);
      }
    }
  }, []);

  // Buscar el técnico que corresponde al usuario logueado (por nombre)
  const tecnicoLogueado = tecnicos.find(t =>
    t.nombre?.toLowerCase() === loggedUser?.nombre?.toLowerCase()
  );

  // Filtrar partes activos (Planificado, Abierto, Pre-Cerrado) asignados a este técnico.
  // Excluir Finalizado y Cerrado para que no aparezcan en la tablet.
  const partesAsignados = partes.filter(p =>
    p.estado !== 'Cerrado' &&
    p.estado !== 'Finalizado' &&
    (tecnicoLogueado ? (p.tecnicoId === tecnicoLogueado.id || p.tecnicoId === tecnicoLogueado._docId) : true)
  ).sort((a, b) => {
    const fa = a.fechaProgramada || a.fechaCreacion || '';
    const fb = b.fechaProgramada || b.fechaCreacion || '';
    return fa.localeCompare(fb);
  });

  if (parteSeleccionado) {
    const centro = centros.find(c => c.id === parteSeleccionado.centroId);
    const cliente = clientes.find(cl => cl.id === parteSeleccionado.clienteId);
    const sistDelCentro = centroSistemas.filter(s => s.centroId === parteSeleccionado.centroId);

    return (
      <div className="min-h-screen bg-zinc-50">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setParteSeleccionado(null)} className="p-2 -ml-1 text-zinc-500 hover:text-black transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400 font-medium truncate">{cliente?.nombre}</p>
            <h2 className="text-base font-bold text-zinc-900 truncate">{centro?.nombre || 'Centro'}</h2>
          </div>
          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full uppercase">Planificado</span>
        </div>

        <div className="p-4 space-y-4">
          {/* Info del parte */}
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 space-y-2">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="font-medium">Fecha programada:</span>
              <span className="font-bold text-blue-700">
                {parteSeleccionado.fechaProgramada
                  ? parteSeleccionado.fechaProgramada.replace(/-/g, '/')
                  : 'No especificada'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>{centro?.direccion || ''} {centro?.poblacion || ''}</span>
            </div>
          </div>

          {/* Sistemas del centro */}
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-1">Sistemas a revisar</h3>

          {sistDelCentro.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-zinc-200">
              <Layers className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Este centro no tiene sistemas registrados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sistDelCentro.map(sist => {
                const equiposDelSist = equiposInstalados.filter(e => e.sistemaId === sist.id && e.revisable !== false);
                const revisados = equiposDelSist.filter(e => e.revisado === true).length;
                const total = equiposDelSist.length;
                const pct = total > 0 ? Math.round((revisados / total) * 100) : 0;
                const hasAnomalies = equiposDelSist.some(eq =>
                  Object.keys(eq).some(k => k.startsWith('check') && (eq as any)[k] === false)
                );

                return (
                  <button
                    key={sist.id}
                    onClick={async () => {
                      // Cambiar estado a "Abierto" solo al entrar en un sistema
                      if (parteSeleccionado.estado === 'Planificado') {
                        const docId = (parteSeleccionado as any)._docId || parteSeleccionado.id;
                        try { await updateParte(docId, { estado: 'Abierto' }); } catch (e) { console.error(e); }
                      }
                      navigate('/revision-checklist', { state: { centroId: parteSeleccionado.centroId, parteId: parteSeleccionado.id, sistemaId: sist.id } });
                    }}
                    className="w-full bg-white rounded-2xl p-4 border border-zinc-200 hover:border-blue-300 active:scale-[0.98] transition-all text-left flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      <Layers className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-900 truncate">{sist.familia || sist.tipo}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{total} equipos · {revisados} revisados</p>
                      <div className="mt-2 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasAnomalies && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Botón ir a revisión completa */}
          <button
            onClick={async () => {
              // Cambiar estado a "Abierto" solo al entrar en la revisión
              if (parteSeleccionado.estado === 'Planificado') {
                const docId = (parteSeleccionado as any)._docId || parteSeleccionado.id;
                try { await updateParte(docId, { estado: 'Abierto' }); } catch (e) { console.error(e); }
              }
              navigate('/revision-checklist', { state: { centroId: parteSeleccionado.centroId, parteId: parteSeleccionado.id } });
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all mt-4"
          >
            <Edit className="w-5 h-5" /> Iniciar revisión completa
          </button>
        </div>
      </div>
    );
  }

  // Lista de partes planificados
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-zinc-200 px-4 py-4">
        <h1 className="text-xl font-bold text-zinc-900">Mis Partes Planificados</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          {tecnicoLogueado ? `${tecnicoLogueado.nombre} ${tecnicoLogueado.apellidos}` : loggedUser?.nombre || 'Técnico'}
          {' · '}{partesAsignados.length} parte{partesAsignados.length !== 1 ? 's' : ''} pendiente{partesAsignados.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="p-4 space-y-3">
        {partesAsignados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Calendar className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold text-sm text-center text-zinc-500">No tienes partes planificados</p>
            <p className="text-xs text-center mt-1">Cuando se te asigne un parte aparecerá aquí</p>
          </div>
        ) : (
          partesAsignados.map(parte => {
            const centro = centros.find(c => c.id === parte.centroId);
            const cliente = clientes.find(cl => cl.id === parte.clienteId);
            const sistCount = centroSistemas.filter(s => s.centroId === parte.centroId).length;

            return (
              <button
                key={parte.id}
                onClick={() => setParteSeleccionado(parte)}
                className="w-full bg-white rounded-2xl p-4 border-2 border-blue-100 hover:border-blue-400 active:scale-[0.98] transition-all text-left shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{cliente?.nombre || 'Cliente'}</p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{centro?.nombre || 'Centro desconocido'}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0 mt-1" />
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-zinc-100">
                  <div className="flex items-center gap-1.5 text-xs text-blue-700 font-bold">
                    <Calendar className="w-3.5 h-3.5" />
                    {parte.fechaProgramada
                      ? parte.fechaProgramada.replace(/-/g, '/')
                      : 'Sin fecha'}
                  </div>
                  <span className="text-zinc-300">·</span>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Layers className="w-3.5 h-3.5" />
                    {sistCount} sistema{sistCount !== 1 ? 's' : ''}
                  </div>
                  <span className="ml-auto text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {parte.periodicidad || 'Mantenimiento'}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL (Vista Escritorio)
// ============================================================
export default function Partes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { centroId, clienteId } = location.state || {};

  // Detectar si es técnico (editor) en móvil
  const loggedUser = (() => {
    try { return JSON.parse(sessionStorage.getItem('firecheck_logged_user') || 'null'); } catch { return null; }
  })();
  const isTecnico = loggedUser?.rol === 'editor';

  const [partes, setPartes] = useState<Parte[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]'); } catch { return []; } });
  const [tecnicos] = useState<Tecnico[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]'); } catch { return []; } });
  const [centros] = useState<Centro[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'); } catch { return []; } });
  const [clientes] = useState<Cliente[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'); } catch { return []; } });
  const [empresas] = useState<EmpresaData[]>(() => { try { return JSON.parse(localStorage.getItem('firecheck_db_empresas') || '[]'); } catch { return []; } });

  // Suscripción en tiempo real a Firestore (colección "partes")
  useEffect(() => {
    const unsub = subscribePartes((items) => {
      const mapped = items.map((d: any) => ({ ...d })) as Parte[];
      setPartes(mapped);
      localStorage.setItem('firecheck_db_partes', JSON.stringify(mapped));

      // Migración: actualizar partes sin nombreCentro
      const centrosActuales: Centro[] = (() => {
        try { return JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'); } catch { return []; }
      })();
      items.forEach(async (p: any) => {
        if (!p.nombreCentro && p.centroId) {
          const centro = centrosActuales.find((c: any) => c.id === p.centroId);
          if (centro?.nombre) {
            const docId = p._docId || p.id;
            try { await updateParte(docId, { nombreCentro: centro.nombre }); } catch (e) { console.error('migración nombreCentro:', e); }
          }
        }
      });
    });
    return () => unsub();
  }, []);

  const [view, setView] = useState<'list' | 'form'>('list');

  const [form, setForm] = useState<Parte>({
    id: '',
    centroId: centroId || '',
    clienteId: clienteId || '',
    fechaCreacion: new Date().toISOString(),
    tecnicoId: centros.find(c => c.id === centroId)?.tecnicoId || '',
    empresaId: centros.find(c => c.id === centroId)?.empresaId || '',
    periodicidad: '',
    mesesRevision: '',
    estado: 'Planificado',
    tipoTrabajo: 'Mantenimiento'
  });

  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isViewSignaturesModalOpen, setIsViewSignaturesModalOpen] = useState(false);
  const [parteIdToFinalize, setParteIdToFinalize] = useState<string | null>(null);
  const [parteVerFirmas, setParteVerFirmas] = useState<Parte | null>(null);
  const [albaranAsociado, setAlbaranAsociado] = useState<Albaran | null>(null);
  const [nombreFirmanteEdit, setNombreFirmanteEdit] = useState('');
  const [firmaClienteRedrawOk, setFirmaClienteRedrawOk] = useState(false);
  const [firmaTecnicoRedrawOk, setFirmaTecnicoRedrawOk] = useState(false);
  const [drawingCliente, setDrawingCliente] = useState(false);
  const [drawingTecnico, setDrawingTecnico] = useState(false);
  const canvasFirmaClienteRef = useRef<HTMLCanvasElement>(null);
  const canvasFirmaTecnicoRef = useRef<HTMLCanvasElement>(null);

  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [parteDocumentos, setParteDocumentos] = useState<Parte | null>(null);
  const [documentosSeleccionados, setDocumentosSeleccionados] = useState({
    actas: true,
    certificado: true,
    albaran: true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const canvasClienteRef = useRef<HTMLCanvasElement>(null);
  const canvasTecnicoRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (location.state?.editParteId && partes.length > 0) {
      const target = partes.find(p => p.id === location.state.editParteId);
      if (target) {
        setForm(target);
        setView('form');
        navigate(location.pathname, { replace: true, state: { ...location.state, editParteId: undefined } });
      }
    }
  }, [location.state?.editParteId, partes, navigate, location.pathname, location.state]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.centroId || !form.tecnicoId) return alert('Por favor, selecciona un centro y un técnico.');
    const c = centros.find(ce => ce.id === form.centroId);

    const newParte: Parte = {
      ...form,
      id: form.id || `PARTE-${generateId().slice(0, 8).toUpperCase()}`,
      clienteId: c ? c.clienteId : form.clienteId,
      empresaId: c?.empresaId || form.empresaId,
      nombreCentro: c?.nombre || (form as any).nombreCentro || '',
    } as any;

    try {
      if (form.id) {
        const docId = (form as any)._docId || form.id;
        await updateParte(docId, newParte as any);
      } else {
        await addParte(newParte as any);
      }
    } catch (err) {
      console.error('Error guardando parte en Firestore:', err);
      alert('Error al guardar en Firestore');
      return;
    }
    setView('list');
  };

  const handleSincronizar = async (id: string) => {
    const currentParte = partes.find(p => p.id === id);
    const prefixMap: Record<string, string> = {
      'Mantenimiento': 'MANT', 'Reparación': 'REP', 'Instalación': 'INST', 'Entrega de material': 'MAT'
    };
    const prefix = prefixMap[currentParte?.tipoTrabajo || 'Mantenimiento'] || 'MANT';
    const numMant = `${prefix}-${new Date().getFullYear()}-${Math.floor(Math.random()*10000).toString().padStart(4, '0')}`;
    const docId = (currentParte as any)?._docId || id;
    try { await updateParte(docId, { estado: 'Finalizado', numeroMantenimiento: numMant }); } catch (e) { console.error(e); }
    alert(`Trabajo sincronizado correctamente. Se ha asignado el Número de Mantenimiento: ${numMant}`);
  };

  const getPosFirma = (canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const startFirmaDraw = (canvasRef: React.RefObject<HTMLCanvasElement | null>, setDrawing: (v: boolean) => void, e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPosFirma(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const drawFirma = (canvasRef: React.RefObject<HTMLCanvasElement | null>, drawing: boolean, e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPosFirma(canvas, e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopFirmaDraw = (setDrawing: (v: boolean) => void, setFirmaOk: (v: boolean) => void, canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
    setDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasContent = Array.from(data).some((v, i) => i % 4 === 3 && v > 0);
    setFirmaOk(hasContent);
  };

  const clearFirmaCanvas = (canvasRef: React.RefObject<HTMLCanvasElement | null>, setFirmaOk: (v: boolean) => void) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaOk(false);
  };

  // ─── Ver firmas (solo visualización, desde el parte) ─────────────
  const handleVerFirmas = (id: string) => {
    const currentParte = partes.find(p => p.id === id);
    if (!currentParte) return;

    if (!currentParte.firmaCliente && !currentParte.firmaTecnico) {
      // Fallback: buscar en el albarán
      const albaranes: Albaran[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const alb = albaranes.find(a => a.parteId === id);
      if (!alb || (!alb.firmaCliente && !alb.firmaTecnico)) {
        alert('No hay firmas disponibles para este parte. El técnico debe finalizar la revisión y capturar las firmas.');
        return;
      }
      setParteVerFirmas({ ...currentParte, firmaCliente: alb.firmaCliente, firmaTecnico: alb.firmaTecnico, nombreFirmante: alb.nombreFirmante } as Parte);
    } else {
      setParteVerFirmas(currentParte);
    }
    setIsViewSignaturesModalOpen(true);
  };

  // ─── Abrir modal de finalización (con firmas editables) ──────────
  const handleFinalizarParte = (id: string) => {
    const currentParte = partes.find(p => p.id === id);
    if (!currentParte) return;

    if (currentParte.estado !== 'Pre-Cerrado') {
      alert('Este parte aún no ha sido firmado en el dispositivo móvil. El técnico debe finalizar la revisión y capturar las firmas antes de poder finalizarlo desde el escritorio.');
      return;
    }

    // Obtener firmas del parte o del albarán
    let firmaCliente = currentParte.firmaCliente || '';
    let firmaTecnico = currentParte.firmaTecnico || '';
    let nombreFirmante = currentParte.nombreFirmante || '';

    if (!firmaCliente || !firmaTecnico) {
      const albaranes: Albaran[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const alb = albaranes.find(a => a.parteId === id);
      if (alb) {
        firmaCliente = alb.firmaCliente || '';
        firmaTecnico = alb.firmaTecnico || '';
        nombreFirmante = alb.nombreFirmante || '';
      }
    }

    if (!firmaCliente && !firmaTecnico) {
      alert('No se encontraron los datos de firma para este parte. Asegúrese de que el técnico haya finalizado correctamente.');
      return;
    }

    setAlbaranAsociado({ parteId: id, firmaCliente, firmaTecnico, nombreFirmante } as Albaran);
    setNombreFirmanteEdit(nombreFirmante);
    setParteIdToFinalize(id);
    setIsSignatureModalOpen(true);
  };

  // ─── Reabrir un parte finalizado ─────────────────────────────────
  const handleReabrirParte = async (id: string) => {
    if (!confirm('¿Re-abrir este parte? Volverá al estado "Abierto" y el técnico podrá volver a verlo en su dispositivo.')) return;
    const parte = partes.find(p => p.id === id);
    const docId = (parte as any)?._docId || id;
    try { await updateParte(docId, { estado: 'Abierto' }); } catch (e) { console.error(e); }
  };

  // ─── Ejecutar finalización del parte ─────────────────────────────
  const executeFinalizarParte = async (id: string) => {
    const parteAFinalizar = partes.find(p => p.id === id);
    if (!parteAFinalizar) return;

    // Obtener firmas redibujadas (si las hay)
    const getFirmaFromCanvas = (canvasRef: React.RefObject<HTMLCanvasElement | null>, originalFirma: string): string => {
      const canvas = canvasRef.current;
      if (!canvas) return originalFirma;
      const ctx = canvas.getContext('2d');
      if (!ctx) return originalFirma;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const hasContent = Array.from(data).some((v, i) => i % 4 === 3 && v > 0);
      if (!hasContent) return originalFirma;
      return canvas.toDataURL('image/png');
    };

    const firmaCliente = getFirmaFromCanvas(canvasFirmaClienteRef, albaranAsociado?.firmaCliente || '');
    const firmaTecnico = getFirmaFromCanvas(canvasFirmaTecnicoRef, albaranAsociado?.firmaTecnico || '');

    // 1. Actualizar el Parte a Finalizado en Firestore guardando también las firmas
    const docId = (parteAFinalizar as any)._docId || id;
    try {
      await updateParte(docId, {
        estado: 'Finalizado',
        firmaCliente,
        firmaTecnico,
        nombreFirmante: nombreFirmanteEdit || albaranAsociado?.nombreFirmante || ''
      } as any);
    } catch (e) { console.error(e); }

    // 2. Generar Certificado (Evaluar si es positivo o negativo)
    try {
      const storedEquipos: EquipoInstalado[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
      const eqDelCentro = storedEquipos.filter((e) => e.centroId === parteAFinalizar.centroId);

      const hasAnomalies = eqDelCentro.some((eq) =>
        Object.keys(eq).some(k => k.startsWith('check') && (eq as Record<string, any>)[k] === false)
      );

      const nuevoCertificado = {
        id: `CERT-${generateId().slice(0, 8).toUpperCase()}`,
        centroId: parteAFinalizar.centroId,
        clienteId: parteAFinalizar.clienteId,
        parteId: parteAFinalizar.id,
        fechaCreacion: new Date().toISOString(),
        estado: hasAnomalies ? 'NO favorable' : 'Favorable',
        numeroMantenimiento: parteAFinalizar.numeroMantenimiento || 'Sin Número',
        tecnicoId: parteAFinalizar.tecnicoId
      };

      const certificadosExistentes = JSON.parse(localStorage.getItem('firecheck_db_certificados') || '[]');
      localStorage.setItem('firecheck_db_certificados', JSON.stringify([...certificadosExistentes, nuevoCertificado]));

    } catch (e) { console.error("Error generando certificado automático", e); }
  };

  // ─── Confirmar finalización definitiva ───────────────────────────
  const confirmFinalizarDefinitivo = async () => {
    if (!parteIdToFinalize || !albaranAsociado) return;

    // Obtener firmas redibujadas
    const getFirmaFromCanvas = (canvasRef: React.RefObject<HTMLCanvasElement | null>, originalFirma: string): string => {
      const canvas = canvasRef.current;
      if (!canvas) return originalFirma;
      const ctx = canvas.getContext('2d');
      if (!ctx) return originalFirma;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const hasContent = Array.from(data).some((v, i) => i % 4 === 3 && v > 0);
      if (!hasContent) return originalFirma;
      return canvas.toDataURL('image/png');
    };

    const firmaCliente = getFirmaFromCanvas(canvasFirmaClienteRef, albaranAsociado.firmaCliente || '');
    const firmaTecnico = getFirmaFromCanvas(canvasFirmaTecnicoRef, albaranAsociado.firmaTecnico || '');

    // Actualizar el albarán con las firmas (redibujadas si procede) y el nombre editado
    try {
      const { addAlbaran } = await import('./firebase');
      await addAlbaran({
        ...albaranAsociado,
        firmaCliente,
        firmaTecnico,
        nombreFirmante: nombreFirmanteEdit || albaranAsociado.nombreFirmante
      });
    } catch (e) {
      console.error('Error actualizando firmas:', e);
    }

    await executeFinalizarParte(parteIdToFinalize);
    setIsSignatureModalOpen(false);
    setParteIdToFinalize(null);
    setAlbaranAsociado(null);
  };

  // ─── GENERAR PDFs ────────────────────────────────────────────────
  const handleGenerarPDF = async (parte: Parte) => {
    try {
      const storedSistemas: CentroSistema[] = JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]');
      const storedEquipos: EquipoInstalado[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');

      const centro = centros.find(c => c.id === parte.centroId);
      const cliente = clientes.find(cl => cl.id === parte.clienteId);
      const tecnico = tecnicos.find(t => t.id === parte.tecnicoId);

      if (!centro || !cliente) {
        alert("No se encontró el centro o cliente asociado al parte.");
        return;
      }

      const sistemasDelCentro = storedSistemas.filter((s) => s.centroId === centro.id);
      const equiposDelCentro = storedEquipos
        .filter((e) => e.centroId === centro.id)
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }));

      if (sistemasDelCentro.length === 0 || equiposDelCentro.length === 0) {
        alert("No hay sistemas o equipos revisados en este centro para generar el PDF.");
        return;
      }

      const nombreTecnico = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado';

      const albaranes: Albaran[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const albaranData = albaranes.find((a) => a.parteId === parte.id);

      await generarActaExtintoresPDF(
        cliente as Record<string, any>,
        centro as Record<string, any>,
        sistemasDelCentro as Record<string, any>[],
        equiposDelCentro as Record<string, any>[],
        parte.numeroMantenimiento || parte.id,
        nombreTecnico,
        undefined,
        albaranData?.firmaCliente,
        albaranData?.firmaTecnico,
        albaranData?.nombreFirmante
      );
    } catch (e) {
      console.error(e);
      alert("Hubo un error al generar el PDF.");
    }
  };

  const handleViewAlbaranPDF = async (parte: Parte) => {
    try {
      const storedEquipos: EquipoInstalado[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
      const centro = centros.find(c => c.id === parte.centroId);
      const cliente = clientes.find(cl => cl.id === parte.clienteId);
      const tecnico = tecnicos.find(t => t.id === parte.tecnicoId);

      if (!centro || !cliente) return;

      const equiposDelCentro = storedEquipos
        .filter((e) => e.centroId === centro.id)
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }));

      const albaranes: Albaran[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const albaranData = albaranes.find((a) => a.parteId === parte.id);
      const nombreTecnico = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado';

      const pdfBlobUrl = await generarAlbaranPDFView(
        cliente as Record<string, any>,
        centro as Record<string, any>,
        equiposDelCentro as Record<string, any>[],
        parte.numeroMantenimiento || parte.id,
        nombreTecnico,
        parte.firmaCliente || albaranData?.firmaCliente,
        parte.firmaTecnico || albaranData?.firmaTecnico,
        parte.nombreFirmante || albaranData?.nombreFirmante,
        albaranData?.items
      );
      window.open(pdfBlobUrl, '_blank');
    } catch (e) {
      console.error(e);
    }
  };

  const handleViewCertificadoPDF = async (parte: Parte) => {
    try {
      const centro = centros.find(c => c.id === parte.centroId);
      const cliente = clientes.find(cl => cl.id === parte.clienteId);
      const tecnico = tecnicos.find(t => t.id === parte.tecnicoId);

      if (!centro || !cliente) return;

      const storedSistemas: CentroSistema[] = JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]');
      const storedEquipos: EquipoInstalado[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
      const sistemasDelCentro = storedSistemas.filter((s) => s.centroId === centro.id);
      const equiposDelCentro = storedEquipos.filter((e) => e.centroId === centro.id);

      const certificados: any[] = JSON.parse(localStorage.getItem('firecheck_db_certificados') || '[]');
      const certificado = certificados.filter((c) => c.parteId === parte.id).sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())[0];

      const albaranes: Albaran[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const albaranData = albaranes.find((a) => a.parteId === parte.id);
      const nombreTecnico = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado';

      const pdfBlobUrl = await generarCertificadoPDFView(
        cliente as Record<string, any>,
        centro as Record<string, any>,
        parte as Record<string, any>,
        nombreTecnico,
        certificado?.estado || 'Favorable',
        sistemasDelCentro as Record<string, any>[],
        equiposDelCentro as Record<string, any>[],
        parte.firmaCliente || albaranData?.firmaCliente,
        parte.firmaTecnico || albaranData?.firmaTecnico,
        parte.nombreFirmante || albaranData?.nombreFirmante
      );
      window.open(pdfBlobUrl, '_blank');
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerarAlbaranPDF = async (parte: Parte) => {
    try {
      const storedEquipos: EquipoInstalado[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');

      const centro = centros.find(c => c.id === parte.centroId);
      const cliente = clientes.find(cl => cl.id === parte.clienteId);
      const tecnico = tecnicos.find(t => t.id === parte.tecnicoId);

      if (!centro || !cliente) {
        alert("No se encontró el centro o cliente asociado al parte.");
        return;
      }

      const equiposDelCentro = storedEquipos
        .filter((e) => e.centroId === centro.id)
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }));
      if (equiposDelCentro.length === 0) {
        alert("No hay equipos registrados en este centro.");
        return;
      }

      const albaranes: Albaran[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const albaranData = albaranes.find((a) => a.parteId === parte.id);

      const nombreTecnico = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado';
      await generarAlbaranPDF(
        cliente as Record<string, any>,
        centro as Record<string, any>,
        equiposDelCentro as Record<string, any>[],
        parte.numeroMantenimiento || parte.id,
        nombreTecnico,
        albaranData?.firmaCliente,
        albaranData?.firmaTecnico,
        albaranData?.nombreFirmante
      );
    } catch (e) {
      console.error(e);
      alert("Hubo un error al generar el Albarán.");
    }
  };

  const handleGenerarCertificadoPDF = async (parte: Parte) => {
    try {
      const centro = centros.find(c => c.id === parte.centroId);
      const cliente = clientes.find(cl => cl.id === parte.clienteId);
      const tecnico = tecnicos.find(t => t.id === parte.tecnicoId);

      if (!centro || !cliente) {
        alert("No se encontró el centro o cliente asociado al parte.");
        return;
      }

      const storedSistemas: CentroSistema[] = JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]');
      const storedEquipos: EquipoInstalado[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
      const sistemasDelCentro = storedSistemas.filter((s) => s.centroId === parte.centroId);
      const equiposDelCentro = storedEquipos
        .filter((e) => e.centroId === parte.centroId)
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }));

      if (sistemasDelCentro.length === 0 || equiposDelCentro.length === 0) {
        alert("No hay sistemas o equipos revisados en este centro para generar el Certificado.");
        return;
      }

      const certificados: any[] = JSON.parse(localStorage.getItem('firecheck_db_certificados') || '[]');
      const certificado = certificados
        .filter((c) => c.parteId === parte.id)
        .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())[0];

      const albaranes: Albaran[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const albaranData = albaranes.find((a) => a.parteId === parte.id);

      const nombreTecnico = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado';
      await generarCertificadoPDF(
        cliente as Record<string, any>,
        centro as Record<string, any>,
        parte as Record<string, any>,
        nombreTecnico,
        certificado?.estado || 'Favorable',
        sistemasDelCentro as Record<string, any>[],
        equiposDelCentro as Record<string, any>[],
        albaranData?.firmaCliente, albaranData?.firmaTecnico, albaranData?.nombreFirmante
      );
    } catch (e) {
      console.error(e);
      alert("Hubo un error al generar el Certificado.");
    }
  };

  const handleAbrirDocumentos = (parte: Parte) => {
    setParteDocumentos(parte);
    setDocumentosSeleccionados({ actas: true, certificado: true, albaran: true });
    setIsDocumentsModalOpen(true);
  };

  const handleDescargarDocumentosSeleccionados = async () => {
    if (!parteDocumentos) return;

    const haySeleccion = Object.values(documentosSeleccionados).some(Boolean);
    if (!haySeleccion) {
      alert('Selecciona al menos un documento para descargar.');
      return;
    }

    if (documentosSeleccionados.actas) {
      await handleGenerarPDF(parteDocumentos);
    }
    if (documentosSeleccionados.certificado) {
      await handleGenerarCertificadoPDF(parteDocumentos);
    }
    if (documentosSeleccionados.albaran) {
      await handleGenerarAlbaranPDF(parteDocumentos);
    }

    setIsDocumentsModalOpen(false);
    setParteDocumentos(null);
  };

  const initDraw = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    let drawing = false;
    const getPos = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || e.touches?.[0]?.clientX;
      const clientY = e.clientY || e.touches?.[0]?.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    canvas.onmousedown = (e) => { drawing = true; const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); };
    canvas.onmousemove = (e) => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); };
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.ontouchstart = (e) => { drawing = true; const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); };
    canvas.ontouchmove = (e) => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); };
    canvas.ontouchend = () => { drawing = false; };
  };

  const filteredPartes = partes.filter(parte => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const centro = centros.find(c => c.id === parte.centroId);
    const tecnico = tecnicos.find(t => t.id === parte.tecnicoId);
    const cliente = clientes.find(cl => cl.id === parte.clienteId);
    const empresa = empresas.find(emp => emp._docId === parte.empresaId);
    return (
      parte.id.toLowerCase().includes(term) ||
      (centro?.nombre || '').toLowerCase().includes(term) ||
      (centro?.poblacion || '').toLowerCase().includes(term) ||
      (cliente?.nombre || '').toLowerCase().includes(term) ||
      (empresa?.nombre || '').toLowerCase().includes(term) ||
      (tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : '').toLowerCase().includes(term) ||
      parte.estado.toLowerCase().includes(term) ||
      (parte.numeroMantenimiento || '').toLowerCase().includes(term) ||
      (parte.periodicidad || '').toLowerCase().includes(term)
    );
  });

  useEffect(() => {
    if (isSignatureModalOpen) {
      setTimeout(() => {
        initDraw(canvasClienteRef.current);
        initDraw(canvasTecnicoRef.current);
      }, 100);
    }
  }, [isSignatureModalOpen]);

  // Vista especial para técnico (rol: editor)
  if (isTecnico) {
    return <VistaTecnicoMovil partes={partes} centros={centros} clientes={clientes} tecnicos={tecnicos} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-6">
      <div className="w-full">
        {/* HEADER */}
        <div className="mb-8 space-y-4">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-sky-950">
              Gestión de partes
            </h1>
          </div>
          {view === 'list' && (
            <div className="pl-0 md:pl-14">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por centro, cliente, técnico, estado..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-sky-100 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all shadow-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {view === 'form' ? (
          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-xl shadow-sky-900/5 border border-sky-100/50">
            <h2 className="text-xl font-bold text-sky-900 mb-6 flex items-center gap-2 pb-4 border-b border-sky-50">
              <FileText className="w-5 h-5" />
              {form.id ? 'Editar Parte' : 'Nuevo Parte'}
            </h2>

            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-sky-900 flex items-center gap-2"><Building2 className="w-4 h-4"/> Centro de Trabajo *</label>
                  <select
                    required
                    value={form.centroId}
                    onChange={e => {
                      const selectedCentro = centros.find(c => c.id === e.target.value);
                      setForm({
                        ...form,
                        centroId: e.target.value,
                        clienteId: selectedCentro?.clienteId || form.clienteId,
                        tecnicoId: selectedCentro?.tecnicoId || form.tecnicoId,
                        empresaId: selectedCentro?.empresaId || form.empresaId,
                      });
                    }}
                    className="w-full px-4 py-3 bg-sky-50/30 border border-sky-100 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    <option value="">Selecciona un centro...</option>
                    {centros.map(c => {
                      const cli = clientes.find(cl => cl.id === c.clienteId);
                      return <option key={c.id} value={c.id}>{c.nombre} ({cli?.nombre || 'Sin cliente'})</option>;
                    })}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-sky-900 flex items-center gap-2"><UserIcon className="w-4 h-4"/> Técnico Asignado *</label>
                  <select
                    required
                    value={form.tecnicoId}
                    onChange={e => setForm({...form, tecnicoId: e.target.value})}
                    className="w-full px-4 py-3 bg-sky-50/30 border border-sky-100 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    <option value="">Selecciona técnico...</option>
                    {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre} {t.apellidos}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-sky-900 flex items-center gap-2"><FileText className="w-4 h-4"/> Tipo de Trabajo *</label>
                  <select
                    required
                    value={form.tipoTrabajo || 'Mantenimiento'}
                    onChange={e => setForm({...form, tipoTrabajo: e.target.value})}
                    className="w-full px-4 py-3 bg-sky-50/30 border border-sky-100 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                  >
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Reparación">Reparación</option>
                    <option value="Instalación">Instalación</option>
                    <option value="Entrega de material">Entrega de material</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-amber-50 mt-8">
                <button type="button" onClick={() => setView('list')} className="px-6 py-3 rounded-xl font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-lg shadow-sky-200 transition-all">
                  <Save className="w-5 h-5" /> Guardar Planificación
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="w-full">
            {filteredPartes.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-sky-100 border-dashed">
                <Search className="w-16 h-16 text-sky-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-sky-900 mb-2">
                  {searchTerm ? 'Sin resultados' : 'No hay partes planificados'}
                </h3>
                <p className="text-sky-700/60">
                  {searchTerm ? 'No se encontraron partes que coincidan con tu búsqueda.' : 'Crea el primer parte de trabajo para asignarlo a un técnico.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {/* Cabecera de la tabla */}
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-0 bg-zinc-50 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider border-l-4 border-l-transparent items-center">
                  <div className="pr-3 py-3 h-full flex items-center">Cliente / Centro</div>
                  <div className="px-3 py-3 h-full flex items-center">Técnico / Empresa</div>
                  <div className="px-3 py-3 h-full flex items-center">Fecha Prog.</div>
                  <div className="px-3 py-3 h-full flex items-center">Tipo / Periodicidad</div>
                  <div className="px-3 py-3 h-full flex items-center">Ref. Trabajo</div>
                  <div className="px-3 py-3 h-full flex items-center">Estado</div>
                  <div className="pl-3 py-3">Acciones</div>
                </div>
                {/* Filas */}
                {filteredPartes.map((parte, idx) => {
                  const centro = centros.find(c => c.id === parte.centroId);
                  const tecnico = tecnicos.find(t => t.id === parte.tecnicoId);
                  const empresa = empresas.find(emp => emp._docId === parte.empresaId);
                  const isFinalizado = parte.estado === 'Finalizado';
                  const cliente = clientes.find(cl => cl.id === parte.clienteId);
                  const isOffline = parte.estado === 'Descargado (Offline)';
                  const isCerrado = parte.estado === 'Cerrado';
                  const isPreCerrado = parte.estado === 'Pre-Cerrado';
                  const isPlanificado = parte.estado === 'Planificado';
                  const isAbierto = parte.estado === 'Abierto';

                  // Finalizado es ahora el estado definitivo (antes era Cerrado)
                  const rowBg = isFinalizado
                    ? 'bg-blue-950/5 border-l-4 border-l-blue-900'
                    : isPreCerrado
                    ? 'bg-blue-50/40 border-l-4 border-l-blue-700'
                    : isCerrado
                    ? 'bg-zinc-100/40 border-l-4 border-l-zinc-500'
                    : isAbierto
                    ? 'bg-amber-50/30 border-l-4 border-l-amber-400'
                    : isPlanificado
                    ? 'bg-white border-l-4 border-l-blue-400'
                    : isOffline
                    ? 'bg-sky-50/30 border-l-4 border-l-sky-400'
                    : 'bg-white border-l-4 border-l-zinc-200';

                  const badgeClass = isFinalizado
                    ? 'bg-blue-900 text-white'
                    : isPreCerrado
                    ? 'bg-blue-700 text-white'
                    : isCerrado
                    ? 'bg-zinc-500 text-white'
                    : isAbierto
                    ? 'bg-amber-100 text-amber-700'
                    : isOffline
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-blue-100 text-blue-700';

                  return (
                    <div
                      key={parte.id}
                      className={`grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-0 px-4 items-center transition-colors hover:bg-zinc-50/80 ${idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'} ${rowBg}`}
                    >
                      {/* Cliente / Centro */}
                      <div className="min-w-0 pr-3 py-3 self-stretch flex flex-col justify-center">
                        <p className="text-sm font-bold text-zinc-900 truncate">{cliente?.nombre || '—'}</p>
                        <p className="text-xs text-zinc-500 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />{centro?.nombre || 'Centro desconocido'}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-400 mt-0.5 truncate">{parte.id}</p>
                      </div>

                      {/* Técnico / Empresa */}
                      <div className="min-w-0 px-3 py-3 self-stretch flex flex-col justify-center">
                        <p className="text-sm text-zinc-800 truncate flex items-center gap-1">
                          <UserIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          {tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado'}
                        </p>
                        <p className="text-xs text-zinc-500 truncate flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 shrink-0" />{empresa?.nombre || 'Sin empresa'}
                        </p>
                      </div>

                      {/* Fecha Programada */}
                      <div className="min-w-0 px-3 py-3 self-stretch flex flex-col justify-center">
                        <p className="text-sm font-bold text-sky-600 truncate">
                          {parte.fechaProgramada ? parte.fechaProgramada.replace(/-/g, '/') : '—'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5 truncate">{parte.mesesRevision || ''}</p>
                      </div>

                      {/* Tipo / Periodicidad */}
                      <div className="min-w-0 px-3 py-3 self-stretch flex flex-col justify-center">
                        <p className="text-sm text-zinc-800 truncate">{parte.tipoTrabajo || 'Mantenimiento'}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">{parte.periodicidad || '—'}</p>
                      </div>

                      {/* Ref. Trabajo */}
                      <div className="min-w-0 px-3 py-3 self-stretch flex flex-col justify-center">
                        {parte.numeroMantenimiento ? (
                          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded truncate">
                            {parte.numeroMantenimiento}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400 truncate">—</span>
                        )}
                      </div>

                      {/* Estado */}
                      <div className="min-w-0 px-3 py-3 self-stretch flex items-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider whitespace-nowrap ${badgeClass} truncate`}>
                          {parte.estado}
                        </span>
                      </div>

                      {/* Acciones */}
                      <div className="min-w-0 flex items-center gap-1 justify-start pl-3 py-3 self-stretch">
                        {!isFinalizado && !isCerrado && (
                          <button onClick={() => navigate('/revision-checklist', { state: { centroId: parte.centroId, parteId: parte.id } })} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Ir a la revisión">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isFinalizado && isOffline && !isCerrado && (
                          <button onClick={() => handleSincronizar(parte.id)} className="p-1.5 text-zinc-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all" title="Sincronizar">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Botón Ver Firmas + Finalizar (estado Pre-Cerrado) / Documentos (Finalizado) / Reabrir */}
                        {isPreCerrado && (
                          <>
                            <button onClick={() => handleVerFirmas(parte.id)} className="p-1.5 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all" title="Ver firmas">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleFinalizarParte(parte.id)} className="p-1.5 text-zinc-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all" title="Finalizar parte (ver firmas y cerrar definitivamente)">
                              <Lock className="w-3.5 h-3.5" />
                            </button>

                          </>
                        )}

                        {isFinalizado && (
                          <>
                            <button onClick={() => handleReabrirParte(parte.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Reabrir parte">
                              <LockOpen className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleAbrirDocumentos(parte)} className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Descargar documentos">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}


                        <button onClick={async () => {
                          if (
                            window.confirm('¿Estás seguro de que quieres eliminar este parte?') &&
                            window.confirm('ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?')
                          ) {
                            const docId = (parte as any)._docId || parte.id;
                            try { await deleteParte(docId); } catch (e) { console.error(e); }
                          }
                        }} className="p-1.5 text-zinc-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {isDocumentsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h2 className="text-lg font-bold text-zinc-900">Descargar documentos</h2>
              <button
                onClick={() => {
                  setIsDocumentsModalOpen(false);
                  setParteDocumentos(null);
                }}
                className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-500">Selecciona los documentos que quieres descargar:</p>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 hover:bg-zinc-50 transition-colors">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={documentosSeleccionados.actas}
                    onChange={(e) => setDocumentosSeleccionados(prev => ({ ...prev, actas: e.target.checked }))}
                    className="w-5 h-5 accent-indigo-600"
                  />
                  <span className="font-bold text-zinc-800">Actas</span>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 hover:bg-zinc-50 transition-colors">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={documentosSeleccionados.certificado}
                    onChange={(e) => setDocumentosSeleccionados(prev => ({ ...prev, certificado: e.target.checked }))}
                    className="w-5 h-5 accent-indigo-600"
                  />
                  <span className="font-bold text-zinc-800">Certificado</span>
                </label>
                <button onClick={() => handleViewCertificadoPDF(parteDocumentos!)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Ver Certificado">
                  <Eye className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 hover:bg-zinc-50 transition-colors">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={documentosSeleccionados.albaran}
                    onChange={(e) => setDocumentosSeleccionados(prev => ({ ...prev, albaran: e.target.checked }))}
                    className="w-5 h-5 accent-indigo-600"
                  />
                  <span className="font-bold text-zinc-800">Albarán</span>
                </label>
                <button onClick={() => handleViewAlbaranPDF(parteDocumentos!)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Ver Albarán">
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex gap-3">
              <button
                onClick={() => {
                  setIsDocumentsModalOpen(false);
                  setParteDocumentos(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
              >
                Cancelar
              </button>
              <button onClick={handleDescargarDocumentosSeleccionados} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all">
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de visualización de firmas (solo lectura) */}
      {isViewSignaturesModalOpen && parteVerFirmas && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900">Firmas del Parte</h2>
              <button onClick={() => { setIsViewSignaturesModalOpen(false); setParteVerFirmas(null); }} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Nombre del firmante */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400 uppercase">Firmante del Cliente</label>
                <p className="text-sm font-bold text-zinc-800">{parteVerFirmas.nombreFirmante || 'No especificado'}</p>
              </div>

              {/* Firma Cliente */}
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase block mb-2">Firma del Cliente</label>
                <div className="border border-zinc-200 rounded-2xl bg-zinc-50 p-2 h-32 flex items-center justify-center">
                  {parteVerFirmas.firmaCliente ? (
                    <img src={parteVerFirmas.firmaCliente} alt="Firma Cliente" className="max-h-full object-contain" />
                  ) : (
                    <p className="text-sm text-zinc-400 italic">No disponible</p>
                  )}
                </div>
              </div>

              {/* Firma Técnico */}
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase block mb-2">Firma del Técnico</label>
                <div className="border border-zinc-200 rounded-2xl bg-zinc-50 p-2 h-32 flex items-center justify-center">
                  {parteVerFirmas.firmaTecnico ? (
                    <img src={parteVerFirmas.firmaTecnico} alt="Firma Técnico" className="max-h-full object-contain" />
                  ) : (
                    <p className="text-sm text-zinc-400 italic">No disponible</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex justify-end shrink-0">
              <button
                onClick={() => { setIsViewSignaturesModalOpen(false); setParteVerFirmas(null); }}
                className="px-6 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {isSignatureModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900">Revisión de Firmas y Finalización</h2>
              <button onClick={() => setIsSignatureModalOpen(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              {albaranAsociado ? (
                <>
                  {/* Nombre del firmante - editable */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase">Firmante del Cliente</label>
                    <input
                      type="text"
                      value={nombreFirmanteEdit}
                      onChange={e => setNombreFirmanteEdit(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                    />
                  </div>

                  {/* Firma Cliente - original + redibujado */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-2">
                        Firma del Cliente
                        {firmaClienteRedrawOk && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                      </label>
                      <button
                        onClick={() => clearFirmaCanvas(canvasFirmaClienteRef, setFirmaClienteRedrawOk)}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                      >
                        Borrar dibujo
                      </button>
                    </div>
                    {/* Firma original */}
                    <div className="mb-2 border border-zinc-200 rounded-2xl bg-zinc-50 p-2 h-24 flex items-center justify-center">
                      <img src={albaranAsociado.firmaCliente || ''} alt="Firma Cliente original" className="max-h-full object-contain opacity-70" />
                    </div>
                    {/* Canvas para redibujar */}
                    <div className={`rounded-xl border-2 overflow-hidden transition-colors ${firmaClienteRedrawOk ? 'border-green-400' : 'border-zinc-200'}`}>
                      <canvas
                        ref={canvasFirmaClienteRef}
                        width={600}
                        height={180}
                        className="w-full touch-none bg-slate-50 cursor-crosshair"
                        style={{ display: 'block' }}
                        onMouseDown={e => startFirmaDraw(canvasFirmaClienteRef, setDrawingCliente, e)}
                        onMouseMove={e => drawFirma(canvasFirmaClienteRef, drawingCliente, e)}
                        onMouseUp={() => stopFirmaDraw(setDrawingCliente, setFirmaClienteRedrawOk, canvasFirmaClienteRef)}
                        onMouseLeave={() => stopFirmaDraw(setDrawingCliente, setFirmaClienteRedrawOk, canvasFirmaClienteRef)}
                        onTouchStart={e => { e.preventDefault(); startFirmaDraw(canvasFirmaClienteRef, setDrawingCliente, e); }}
                        onTouchMove={e => { e.preventDefault(); drawFirma(canvasFirmaClienteRef, drawingCliente, e); }}
                        onTouchEnd={() => stopFirmaDraw(setDrawingCliente, setFirmaClienteRedrawOk, canvasFirmaClienteRef)}
                      />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 text-center">Dibuje encima si desea modificar la firma</p>
                  </div>

                  {/* Firma Técnico - original + redibujado */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-2">
                        Firma del Técnico
                        {firmaTecnicoRedrawOk && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                      </label>
                      <button
                        onClick={() => clearFirmaCanvas(canvasFirmaTecnicoRef, setFirmaTecnicoRedrawOk)}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                      >
                        Borrar dibujo
                      </button>
                    </div>
                    {/* Firma original */}
                    <div className="mb-2 border border-zinc-200 rounded-2xl bg-zinc-50 p-2 h-24 flex items-center justify-center">
                      <img src={albaranAsociado.firmaTecnico || ''} alt="Firma Técnico original" className="max-h-full object-contain opacity-70" />
                    </div>
                    {/* Canvas para redibujar */}
                    <div className={`rounded-xl border-2 overflow-hidden transition-colors ${firmaTecnicoRedrawOk ? 'border-green-400' : 'border-zinc-200'}`}>
                      <canvas
                        ref={canvasFirmaTecnicoRef}
                        width={600}
                        height={180}
                        className="w-full touch-none bg-slate-50 cursor-crosshair"
                        style={{ display: 'block' }}
                        onMouseDown={e => startFirmaDraw(canvasFirmaTecnicoRef, setDrawingTecnico, e)}
                        onMouseMove={e => drawFirma(canvasFirmaTecnicoRef, drawingTecnico, e)}
                        onMouseUp={() => stopFirmaDraw(setDrawingTecnico, setFirmaTecnicoRedrawOk, canvasFirmaTecnicoRef)}
                        onMouseLeave={() => stopFirmaDraw(setDrawingTecnico, setFirmaTecnicoRedrawOk, canvasFirmaTecnicoRef)}
                        onTouchStart={e => { e.preventDefault(); startFirmaDraw(canvasFirmaTecnicoRef, setDrawingTecnico, e); }}
                        onTouchMove={e => { e.preventDefault(); drawFirma(canvasFirmaTecnicoRef, drawingTecnico, e); }}
                        onTouchEnd={() => stopFirmaDraw(setDrawingTecnico, setFirmaTecnicoRedrawOk, canvasFirmaTecnicoRef)}
                      />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 text-center">Dibuje encima si desea modificar la firma</p>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-zinc-500">Cargando datos de firma...</p>
              )}
            </div>
            <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex gap-3 shrink-0">
              <button onClick={() => setIsSignatureModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmFinalizarDefinitivo} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-sky-200 transition-all">
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}