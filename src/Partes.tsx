import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, FileText, DownloadCloud, RefreshCw, Calendar, User as UserIcon, Building2, MapPin, Trash2, CheckCircle2, X, Search, ArrowLeft, ChevronRight, Layers, Edit, AlertTriangle } from 'lucide-react';
import { addAlbaran, addParte, updateParte, deleteParte, subscribePartes, type Albaran, type Tecnico } from './firebase';
import type { Parte, Centro, Cliente, CentroSistema, EquipoInstalado } from './Centros';
import { generarActaExtintoresPDF, generarAlbaranPDF, generarCertificadoPDF } from './pdfGenerator';

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
  const [equiposInstalados] = useState<EquipoInstalado[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]'); } catch { return []; }
  });
  const [centroSistemas] = useState<CentroSistema[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]'); } catch { return []; }
  });

  // Obtener técnico del usuario logueado
  const loggedUser = (() => {
    try { return JSON.parse(sessionStorage.getItem('firecheck_logged_user') || 'null'); } catch { return null; }
  })();

  // Buscar el técnico que corresponde al usuario logueado (por nombre)
  const tecnicoLogueado = tecnicos.find(t =>
    t.nombre?.toLowerCase() === loggedUser?.nombre?.toLowerCase()
  );

  // Filtrar partes activos (Planificado o Abierto) asignados a este técnico
  // Los partes borrados del calendario desaparecen automáticamente gracias a la suscripción en tiempo real
  const partesAsignados = partes.filter(p =>
    (p.estado === 'Planificado' || p.estado === 'Abierto') &&
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
// COMPONENTE PRINCIPAL
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
  // También migra partes sin nombreCentro añadiéndolo automáticamente
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

  const [view, setView] = useState<'list' | 'form'>('list'); // Default to list view
  
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
  const [parteIdToClose, setParteIdToClose] = useState<string | null>(null);
  const [nombreFirmante, setNombreFirmante] = useState('');
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
        // Limpiamos el estado de navegación para evitar re-aperturas accidentales
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
  const handleDescargarOffline = async (id: string) => {
    const parte = partes.find(p => p.id === id);
    if (!parte) return;
    const docId = (parte as any)._docId || id;
    try { await updateParte(docId, { estado: 'Descargado (Offline)' }); } catch (e) { console.error(e); }
    alert('Parte de trabajo descargado en el dispositivo. Ahora puedes trabajar sin conexión.');
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

  const handleCerrarParte = (id: string) => {
      const currentParte = partes.find(p => p.id === id);
      if (!currentParte) return;
      setParteIdToClose(id);
      setIsSignatureModalOpen(true);
  };

  const handleReabrirParte = async (id: string) => {
      if (!confirm('¿Re-abrir este parte? Volverá al estado "Finalizado" y podrás revisarlo de nuevo.')) return;
      const parte = partes.find(p => p.id === id);
      const docId = (parte as any)?._docId || id;
      try { await updateParte(docId, { estado: 'Finalizado' }); } catch (e) { console.error(e); }
  };

  const executeCerrarParte = async (id: string) => {
      const parteACerrar = partes.find(p => p.id === id);
      if (!parteACerrar) return;

      // 1. Actualizar el Parte a Cerrado en Firestore
      const docId = (parteACerrar as any)._docId || id;
      try { await updateParte(docId, { estado: 'Cerrado' }); } catch (e) { console.error(e); }

      // 2. Generar Certificado (Evaluar si es positivo o negativo)
      try {
        const storedEquipos: EquipoInstalado[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        const eqDelCentro = storedEquipos.filter((e) => e.centroId === parteACerrar.centroId);
        
        // Comprobar si hay alguna anomalía (algún check = false)
        const hasAnomalies = eqDelCentro.some((eq) => 
          Object.keys(eq).some(k => k.startsWith('check') && (eq as Record<string, any>)[k] === false)
        );

        const nuevoCertificado = {
          id: `CERT-${generateId().slice(0,8).toUpperCase()}`,
          centroId: parteACerrar.centroId,
          clienteId: parteACerrar.clienteId,
          parteId: parteACerrar.id,
          fechaCreacion: new Date().toISOString(),
          estado: hasAnomalies ? 'NO favorable' : 'Favorable',
          numeroMantenimiento: parteACerrar.numeroMantenimiento || 'Sin Número',
          tecnicoId: parteACerrar.tecnicoId
        };

        const certificadosExistentes = JSON.parse(localStorage.getItem('firecheck_db_certificados') || '[]');
        localStorage.setItem('firecheck_db_certificados', JSON.stringify([...certificadosExistentes, nuevoCertificado]));

      } catch (e) { console.error("Error generando certificado automático", e); }
  };

  const confirmCerrarConFirma = async () => {
    if (!nombreFirmante.trim()) {
      alert('Por favor, introduce el nombre del firmante.');
      return;
    }
    if (parteIdToClose) {
      // Extraer las firmas de los canvas como base64
      const firmaCliente = canvasClienteRef.current?.toDataURL('image/png') || '';
      const firmaTecnico = canvasTecnicoRef.current?.toDataURL('image/png') || '';

      const parte = partes.find(p => p.id === parteIdToClose);
      
      // Generar ID correlativo automático buscando en el historial
      const albaranesExistentes: Albaran[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const year = new Date().getFullYear().toString().slice(-2);
      const prefix = `ALB-${year}-`;
      const patterned = albaranesExistentes.filter((alb) => alb.id?.startsWith(prefix));
      let nextNum = 1;
      if (patterned.length > 0) {
        const nums = patterned.map((alb) => {
          const parts = alb.id.split('-');
          return parseInt(parts[parts.length - 1]);
        }).filter((n) => !isNaN(n));
        if (nums.length > 0) nextNum = Math.max(...nums) + 1;
      }
      const nextId = `${prefix}${nextNum.toString().padStart(3, '0')}`;

      // Crear registro de albarán con firmas
      const nuevoAlbaran: Albaran = {
        id: nextId,
        centroId: parte?.centroId || '',
        clienteId: parte?.clienteId || '',
        empresaId: parte?.empresaId || '',
        parteId: parteIdToClose,
        tecnicoId: parte?.tecnicoId || '',
        numeroMantenimiento: parte?.numeroMantenimiento || '',
        fechaCreacion: new Date().toISOString(),
        facturado: false,
        items: [], // Se hereda del trabajo realizado en equipos
        firmaCliente,
        firmaTecnico,
        nombreFirmante
      };

      await addAlbaran(nuevoAlbaran); // Add albaran to Firebase

      executeCerrarParte(parteIdToClose);
      setIsSignatureModalOpen(false);
      setParteIdToClose(null);
      setNombreFirmante('');
    }
  };

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
      
      // Filtramos los sistemas y equipos específicos de este centro
      const sistemasDelCentro = storedSistemas.filter((s) => s.centroId === centro.id);
      const equiposDelCentro = storedEquipos.filter((e) => e.centroId === centro.id);
      
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
        undefined, // anomalyTextColor: use default red
        albaranData?.firmaCliente,
        albaranData?.firmaTecnico,
        albaranData?.nombreFirmante
      );
    } catch (e) {
      console.error(e);
      alert("Hubo un error al generar el PDF.");
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
      
      const equiposDelCentro = storedEquipos.filter((e) => e.centroId === centro.id);
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
      const equiposDelCentro = storedEquipos.filter((e) => e.centroId === parte.centroId);

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
    <div className="min-h-screen bg-zinc-50 flex items-start justify-center p-4 md:p-8">
      <div className="max-w-6xl w-full">
        {/* HEADER */}
        <div className="mb-8 space-y-4">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-sky-950 flex items-center justify-center gap-3">
              <Calendar className="w-8 h-8 text-sky-500" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPartes.length === 0 ? (
              <div className="col-span-full text-center py-16 bg-white rounded-3xl border border-sky-100 border-dashed">
                <Search className="w-16 h-16 text-sky-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-sky-900 mb-2">
                  {searchTerm ? 'Sin resultados' : 'No hay partes planificados'}
                </h3>
                <p className="text-sky-700/60">
                  {searchTerm ? 'No se encontraron partes que coincidan con tu búsqueda.' : 'Crea el primer parte de trabajo para asignarlo a un técnico.'}
                </p>
              </div>
            ) : (
              filteredPartes.map(parte => {
                const centro = centros.find(c => c.id === parte.centroId);
                const tecnico = tecnicos.find(t => t.id === parte.tecnicoId);
                const empresa = empresas.find(emp => emp._docId === parte.empresaId);
                const isFinalizado = parte.estado === 'Finalizado';
                const cliente = clientes.find(cl => cl.id === parte.clienteId); // Find the client for display
                const isOffline = parte.estado === 'Descargado (Offline)';
                const isCerrado = parte.estado === 'Cerrado';
                const isPreCerrado = parte.estado === 'Pre-Cerrado';
                const isPlanificado = parte.estado === 'Planificado';

                return (
                  <div key={parte.id} className={`bg-white rounded-3xl p-6 border-2 shadow-sm transition-all flex flex-col ${isCerrado ? 'border-blue-900 bg-blue-950/5' : isPreCerrado ? 'border-blue-700 bg-blue-50/30' : isFinalizado ? 'border-emerald-500 bg-emerald-50/30' : isPlanificado ? 'border-blue-500 hover:shadow-md' : isOffline ? 'border-sky-300 bg-sky-50/30' : 'border-sky-100 hover:shadow-md'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded">{parte.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${isCerrado ? 'bg-blue-900 text-white' : isPreCerrado ? 'bg-blue-700 text-white' : isFinalizado ? 'bg-emerald-100 text-emerald-700' : isOffline ? 'bg-sky-100 text-sky-700' : 'bg-sky-100 text-sky-700'}`}>
                        {parte.estado}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-zinc-900 mb-1 line-clamp-1">{centro?.nombre || 'Centro Desconocido'}</h3>
                    <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1"><MapPin className="w-3 h-3"/> {centro?.poblacion || 'Sin ubicación'}</p>
                    {cliente && (
                      <p className="text-xs text-zinc-500 mb-4 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" /> {cliente.nombre}
                      </p>
                    )}

                    <div className="space-y-3 mb-6 flex-1">
                      <div className="flex justify-between items-center text-sm border-b border-zinc-50 pb-2">
                        <span className="text-zinc-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Fecha Programada</span>
                        <span className="font-bold text-sky-600">
                          {parte.fechaProgramada ? parte.fechaProgramada.replace(/-/g, '/') : 'No programada'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-zinc-50 pb-2">
                        <span className="text-zinc-500 flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5"/> Técnico</span>
                        <span className="font-medium text-zinc-800">{tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-zinc-50 pb-2">
                        <span className="text-zinc-500 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5"/> Empresa</span>
                        <span className="font-medium text-zinc-800 text-right line-clamp-1">{empresa ? empresa.nombre : 'No asignada'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-zinc-50 pb-2">
                        <span className="text-zinc-500 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5"/> Tipo Trabajo</span>
                        <span className="font-medium text-zinc-800">{parte.tipoTrabajo || 'Mantenimiento'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-zinc-50 pb-2">
                        <span className="text-zinc-500 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5"/> Periodicidad</span>
                          <span className="font-medium text-zinc-800">{parte.periodicidad || 'No especificado'}</span>
                      </div>
                      <div className="flex flex-col text-sm border-b border-zinc-50 pb-2 gap-1.5">
                        <span className="text-zinc-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Meses planificados</span>
                        <span className="font-medium text-zinc-800 leading-tight">{parte.mesesRevision}</span>
                      </div>
                      {(isFinalizado || isCerrado) && parte.numeroMantenimiento && (
                        <div className="flex justify-between items-center text-sm bg-emerald-100 p-2 rounded-lg mt-2">
                          <span className="text-emerald-800 font-bold">Ref. Trabajo:</span>
                          <span className="font-mono font-bold text-emerald-900">{parte.numeroMantenimiento}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-auto">
                      {!isFinalizado && !isOffline && !isCerrado && (
                        <button onClick={() => handleDescargarOffline(parte.id)} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-black text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                          <DownloadCloud className="w-4 h-4" /> descargar off line
                        </button>
                      )}
                      {!isCerrado && (
                        <button onClick={() => {
                          navigate('/revision-checklist', { state: { centroId: parte.centroId, parteId: parte.id } });
                        }} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                          <Building2 className="w-4 h-4" /> Ir a la revisión
                        </button>
                      )}
                      {!isFinalizado && isOffline && !isCerrado && (
                        <button onClick={() => handleSincronizar(parte.id)} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                          <RefreshCw className="w-4 h-4" /> Sincronizar Fin
                        </button>
                      )}
                      {isFinalizado && !isCerrado && (
                        <button onClick={() => handleCerrarParte(parte.id)} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 bg-black hover:bg-zinc-800 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                          <CheckCircle2 className="w-4 h-4" /> Cerrar Parte
                        </button>
                      )}
                      {isCerrado && (
                        <div className="w-full flex flex-col gap-2">
                          <button onClick={() => handleReabrirParte(parte.id)} className="w-full flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-amber-900 px-3 py-2 rounded-xl text-[10px] font-bold transition-all shadow-sm" title="Re-abrir el parte para revisarlo de nuevo">
                            <RefreshCw className="w-4 h-4" /> Re-abrir parte
                          </button>
                          <button onClick={() => handleAbrirDocumentos(parte)} className="w-full flex items-center justify-center gap-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-2 rounded-xl text-[10px] font-bold transition-all shadow-sm" title="Seleccionar y descargar documentos">
                            <FileText className="w-4 h-4" /> Documentos
                          </button>
                        </div>
                      )}
                      <button onClick={async () => {
                        if (
                          window.confirm('¿Estás seguro de que quieres eliminar este parte?') &&
                          window.confirm('ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?')
                        ) {
                          const docId = (parte as any)._docId || parte.id;
                          try { await deleteParte(docId); } catch (e) { console.error(e); }
                        }
                      }} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-colors border border-zinc-200 hover:border-red-200" title="Eliminar Parte">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
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

              <label className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={documentosSeleccionados.actas}
                  onChange={(e) => setDocumentosSeleccionados(prev => ({ ...prev, actas: e.target.checked }))}
                  className="w-5 h-5 accent-indigo-600"
                />
                <span className="font-bold text-zinc-800">Actas</span>
              </label>

              <label className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={documentosSeleccionados.certificado}
                  onChange={(e) => setDocumentosSeleccionados(prev => ({ ...prev, certificado: e.target.checked }))}
                  className="w-5 h-5 accent-indigo-600"
                />
                <span className="font-bold text-zinc-800">Certificado</span>
              </label>

              <label className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={documentosSeleccionados.albaran}
                  onChange={(e) => setDocumentosSeleccionados(prev => ({ ...prev, albaran: e.target.checked }))}
                  className="w-5 h-5 accent-indigo-600"
                />
                <span className="font-bold text-zinc-800">Albarán</span>
              </label>
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

      {isSignatureModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h2 className="text-lg font-bold text-zinc-900">Cierre de Parte y Firmas</h2>
              <button onClick={() => setIsSignatureModalOpen(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700">Nombre del Cliente / Receptor *</label>
                    <input 
                      type="text" 
                      value={nombreFirmante} 
                      onChange={(e) => setNombreFirmante(e.target.value)}
                      placeholder="Nombre y Apellidos"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase">Firma del Cliente</label>
                <canvas ref={canvasClienteRef} width={450} height={150} className="w-full h-32 border border-zinc-200 rounded-2xl bg-zinc-50 touch-none" />
                <button onClick={() => canvasClienteRef.current?.getContext('2d')?.clearRect(0,0,1000,1000)} className="text-[10px] text-zinc-400 underline">Limpiar firma cliente</button>
              </div>
              <div className="space-y-2 pt-4 border-t border-zinc-100">
                <label className="text-xs font-bold text-zinc-400 uppercase">Firma del Técnico</label>
                <canvas ref={canvasTecnicoRef} width={450} height={150} className="w-full h-32 border border-zinc-200 rounded-2xl bg-zinc-50 touch-none" />
                <button onClick={() => canvasTecnicoRef.current?.getContext('2d')?.clearRect(0,0,1000,1000)} className="text-[10px] text-zinc-400 underline">Limpiar firma técnico</button>
              </div>
            </div>
            <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex gap-3">
              <button onClick={() => setIsSignatureModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmCerrarConFirma} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-sky-200 transition-all">
                Finalizar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
