import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Plus, Edit, Trash2, AlertTriangle, CheckCircle2,
  Shield, Wrench, Search, Upload, X, Save, ArrowLeft,
  Bell, FileText, Check, ExternalLink, ArrowRight,
  Image as ImageIcon, Loader, Eye
} from 'lucide-react';
import {
  subscribeVehiculos, addVehiculo, updateVehiculo, deleteVehiculo,
  uploadFile, subscribeTecnicos, type VehiculoItem, type AlertaVehiculo
} from './firebase';
import {
  subscribePlantillas, subscribeItemsDePlantilla, inicializarOtrasPlantillasPorDefecto,
  COLECCION_OTRAS_PLANTILLAS, type Plantilla, type ItemPlantilla
} from './plantillas';

// Componente de Matrícula Española Oficial (con Eurobanda azul, escudo de 12 estrellas de la UE y letra 'E' de España)
function PlacaMatriculaReal({ matricula, size = 'md' }: { matricula: string; size?: 'sm' | 'md' | 'lg' }) {
  const isLg = size === 'lg';
  const isSm = size === 'sm';

  return (
    <div
      className={`inline-flex items-stretch bg-white border-[1.5px] border-zinc-950 rounded-md overflow-hidden select-none shrink-0 ${
        isLg ? 'h-8' : isSm ? 'h-6' : 'h-7'
      }`}
      style={{
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.9), 0 1px 3px rgba(0,0,0,0.2)',
      }}
    >
      {/* Eurobanda azul oficial con las 12 estrellas de Europa y la E de España */}
      <div
        className={`bg-[#003399] flex flex-col items-center justify-between py-0.5 text-white shrink-0 ${
          isLg ? 'w-6 px-0.5' : isSm ? 'w-4 px-0.5' : 'w-5 px-0.5'
        }`}
      >
        {/* Escudo / Corona de 12 estrellas de la Unión Europea */}
        <svg
          viewBox="0 0 24 24"
          className={isLg ? 'w-3.5 h-3.5 mt-0.5' : isSm ? 'w-2.5 h-2.5 mt-0.5' : 'w-3 h-3 mt-0.5'}
          fill="#FFCC00"
        >
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const cx = 12 + 7.5 * Math.sin(rad);
            const cy = 12 - 7.5 * Math.cos(rad);
            return <circle key={deg} cx={cx} cy={cy} r="1.15" fill="#FFCC00" />;
          })}
        </svg>

        {/* Letra E oficial de España */}
        <span
          className={`font-black text-white leading-none ${
            isLg ? 'text-[11px] mb-0.5' : isSm ? 'text-[8px] mb-0.5' : 'text-[9.5px] mb-0.5'
          }`}
          style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
        >
          E
        </span>
      </div>

      {/* Matrícula española con tipografía oficial en relieve */}
      <div
        className={`bg-white flex items-center justify-center font-mono font-black tracking-widest text-zinc-950 px-2.5 ${
          isLg ? 'text-base' : isSm ? 'text-xs' : 'text-sm'
        }`}
        style={{ letterSpacing: '0.14em' }}
      >
        {matricula || '0000-XXX'}
      </div>
    </div>
  );
}

export default function Vehiculos() {
  const navigate = useNavigate();

  // ─── ESTADOS PRINCIPALES ──────────────────────────────────────────────────
  const [vehiculos, setVehiculos] = useState<VehiculoItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_vehiculos') || '[]');
    } catch { return []; }
  });

  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string; apellidos?: string; _docId?: string }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');
    } catch { return []; }
  });

  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Vehículo actualmente abierto/seleccionado ("al entrar")
  const [vehiculoSeleccionadoId, setVehiculoSeleccionadoId] = useState<string | null>(null);

  // Estados para subida de fotos en el checklist
  const [subiendoImagenKey, setSubiendoImagenKey] = useState<string | null>(null);
  const [previewImagenModal, setPreviewImagenModal] = useState<string | null>(null);

  // ─── PLANTILLA DE VEHÍCULOS (DE OTRAS PLANTILLAS) ─────────────────────────
  const [plantillasOtras, setPlantillasOtras] = useState<Plantilla[]>([]);
  const [plantillaVehiculoId, setPlantillaVehiculoId] = useState<string | null>(null);
  const [preguntasPlantilla, setPreguntasPlantilla] = useState<ItemPlantilla[]>([]);

  // ─── MODAL CREAR / EDITAR VEHÍCULO ────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formVehiculo, setFormVehiculo] = useState<{
    matricula: string;
    marcaModelo: string;
    tipo: string;
    tecnicoAsignadoId: string;
    kilometraje: string;
    imagenUrl: string;
    observaciones: string;
    // Alertas estándar
    seguroFecha: string;
    seguroCompania: string;
    seguroDiasAviso: number;
    itvFecha: string;
    itvDiasAviso: number;
    mantenimientoFecha: string;
    mantenimientoDiasAviso: number;
    // Alertas personalizadas
    alertasExtra: { id: string; titulo: string; fecha: string; diasAviso: number }[];
  }>({
    matricula: '',
    marcaModelo: '',
    tipo: 'Furgoneta',
    tecnicoAsignadoId: '',
    kilometraje: '',
    imagenUrl: '',
    observaciones: '',
    seguroFecha: '',
    seguroCompania: '',
    seguroDiasAviso: 15,
    itvFecha: '',
    itvDiasAviso: 15,
    mantenimientoFecha: '',
    mantenimientoDiasAviso: 15,
    alertasExtra: []
  });

  // Respuestas del checklist por cada vehículo en edición local antes de guardar
  const [respuestasLocales, setRespuestasLocales] = useState<Record<string, Record<string, any>>>({});

  // ─── SUSCRIPCIONES EN TIEMPO REAL ─────────────────────────────────────────
  useEffect(() => {
    const unsubVeh = subscribeVehiculos((items) => {
      setVehiculos(items);
    });

    const unsubTec = subscribeTecnicos((items) => {
      setTecnicos(items || []);
    });

    const unsubPlant = subscribePlantillas((lista) => {
      setPlantillasOtras(lista);
      if (lista.length === 0) {
        inicializarOtrasPlantillasPorDefecto().catch(console.error);
      }
    }, COLECCION_OTRAS_PLANTILLAS);

    return () => {
      unsubVeh();
      unsubTec();
      unsubPlant();
    };
  }, []);

  // Seleccionar la plantilla de vehículos correspondiente (ej: V01 o con nombre de vehículo)
  useEffect(() => {
    if (plantillasOtras.length === 0) return;
    const vehPlantilla = plantillasOtras.find(p => 
      (p.codigo && p.codigo.toUpperCase().includes('V')) ||
      (p.nombre && /veh[ií]culo|furgoneta|flota/i.test(p.nombre))
    ) || plantillasOtras[0];

    if (vehPlantilla) {
      setPlantillaVehiculoId(vehPlantilla.id);
    }
  }, [plantillasOtras]);

  // Cargar las preguntas de la plantilla de vehículos
  useEffect(() => {
    if (!plantillaVehiculoId) return;
    const unsub = subscribeItemsDePlantilla(plantillaVehiculoId, (items) => {
      const ordenados = [...items].sort((a, b) => a.orden - b.orden);
      setPreguntasPlantilla(ordenados);
    }, COLECCION_OTRAS_PLANTILLAS);
    return () => unsub();
  }, [plantillaVehiculoId]);

  // Inicializar respuestas locales al cargar vehículos
  useEffect(() => {
    const map: Record<string, Record<string, any>> = {};
    vehiculos.forEach(v => {
      map[v.id] = { ...(v.respuestasChecklist || {}) };
    });
    setRespuestasLocales(map);
  }, [vehiculos]);

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 3500);
  };

  const formatFecha = (raw: string | undefined): string => {
    if (!raw) return '—';
    const clean = raw.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
    const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return clean;
  };

  // Cálculo de días restantes hasta una fecha
  const calcularDiasRestantes = (fechaStr: string): number | null => {
    if (!fechaStr) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const target = new Date(fechaStr);
    if (isNaN(target.getTime())) return null;
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  };

  // ─── ABRIR MODAL CREAR / EDITAR ───────────────────────────────────────────
  const handleOpenCrear = () => {
    setEditandoId(null);
    setFormVehiculo({
      matricula: '',
      marcaModelo: '',
      tipo: 'Furgoneta',
      tecnicoAsignadoId: tecnicos[0]?.id || '',
      kilometraje: '',
      imagenUrl: '',
      observaciones: '',
      seguroFecha: '',
      seguroCompania: '',
      seguroDiasAviso: 15,
      itvFecha: '',
      itvDiasAviso: 15,
      mantenimientoFecha: '',
      mantenimientoDiasAviso: 15,
      alertasExtra: []
    });
    setModalOpen(true);
  };

  const handleOpenEditar = (veh: VehiculoItem) => {
    setEditandoId(veh._docId || veh.id);

    const alertaSeguro = veh.alertas?.find(a => a.tipo === 'seguro');
    const alertaItv = veh.alertas?.find(a => a.tipo === 'itv');
    const alertaMant = veh.alertas?.find(a => a.tipo === 'mantenimiento');
    const extras = veh.alertas?.filter(a => a.tipo === 'otro') || [];

    setFormVehiculo({
      matricula: veh.matricula || '',
      marcaModelo: veh.marcaModelo || '',
      tipo: veh.tipo || 'Furgoneta',
      tecnicoAsignadoId: veh.tecnicoAsignadoId || '',
      kilometraje: veh.kilometraje ? String(veh.kilometraje) : '',
      imagenUrl: veh.imagenUrl || '',
      observaciones: veh.observaciones || '',
      seguroFecha: alertaSeguro?.fecha || '',
      seguroCompania: alertaSeguro?.descripcion || '',
      seguroDiasAviso: alertaSeguro?.diasAviso || 15,
      itvFecha: alertaItv?.fecha || '',
      itvDiasAviso: alertaItv?.diasAviso || 15,
      mantenimientoFecha: alertaMant?.fecha || '',
      mantenimientoDiasAviso: alertaMant?.diasAviso || 15,
      alertasExtra: extras.map(e => ({
        id: e.id,
        titulo: e.titulo,
        fecha: e.fecha,
        diasAviso: e.diasAviso || 15
      }))
    });
    setModalOpen(true);
  };

  // ─── SUBIR FOTO DEL VEHÍCULO ──────────────────────────────────────────────
  const handleSubirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoFoto(true);
    try {
      const path = `vehiculos_fotos/veh_${Date.now()}_${file.name}`;
      const url = await uploadFile(file, path);
      setFormVehiculo(prev => ({ ...prev, imagenUrl: url }));
      mostrarMensaje('ok', 'Foto cargada correctamente');
    } catch (err: any) {
      console.error('Error subiendo foto de vehículo:', err);
      mostrarMensaje('error', 'Error al subir la fotografía');
    } finally {
      setSubiendoFoto(false);
    }
  };

  // ─── GUARDAR VEHÍCULO (CREAR / EDITAR) ────────────────────────────────────
  const handleGuardarVehiculo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVehiculo.matricula.trim()) {
      mostrarMensaje('error', 'La matrícula es obligatoria');
      return;
    }

    setCargando(true);
    try {
      const tecObj = tecnicos.find(t => t.id === formVehiculo.tecnicoAsignadoId || t._docId === formVehiculo.tecnicoAsignadoId);
      const tecNombre = tecObj ? `${tecObj.nombre} ${tecObj.apellidos || ''}`.trim() : '';

      const alertas: AlertaVehiculo[] = [];

      if (formVehiculo.seguroFecha) {
        alertas.push({
          id: 'seguro',
          tipo: 'seguro',
          titulo: 'Caducidad de Seguro',
          fecha: formVehiculo.seguroFecha,
          diasAviso: Number(formVehiculo.seguroDiasAviso) || 15,
          descripcion: formVehiculo.seguroCompania ? `Compañía / Póliza: ${formVehiculo.seguroCompania}` : 'Seguro obligatorio'
        });
      }

      if (formVehiculo.itvFecha) {
        alertas.push({
          id: 'itv',
          tipo: 'itv',
          titulo: 'Vencimiento ITV',
          fecha: formVehiculo.itvFecha,
          diasAviso: Number(formVehiculo.itvDiasAviso) || 15,
          descripcion: 'Inspección Técnica de Vehículos (ITV)'
        });
      }

      if (formVehiculo.mantenimientoFecha) {
        alertas.push({
          id: 'mantenimiento',
          tipo: 'mantenimiento',
          titulo: 'Próxima Revisión / Taller',
          fecha: formVehiculo.mantenimientoFecha,
          diasAviso: Number(formVehiculo.mantenimientoDiasAviso) || 15,
          descripcion: 'Revisión periódica de taller y mantenimiento'
        });
      }

      formVehiculo.alertasExtra.forEach(extra => {
        if (extra.titulo.trim() && extra.fecha) {
          alertas.push({
            id: extra.id || `alerta_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            tipo: 'otro',
            titulo: extra.titulo.trim(),
            fecha: extra.fecha,
            diasAviso: Number(extra.diasAviso) || 15
          });
        }
      });

      const matriculaFormateada = formVehiculo.matricula.trim().toUpperCase();

      if (editandoId) {
        await updateVehiculo(editandoId, {
          matricula: matriculaFormateada,
          marcaModelo: formVehiculo.marcaModelo.trim(),
          tipo: formVehiculo.tipo,
          tecnicoAsignadoId: formVehiculo.tecnicoAsignadoId,
          tecnicoAsignadoNombre: tecNombre,
          kilometraje: formVehiculo.kilometraje ? Number(formVehiculo.kilometraje) : '',
          imagenUrl: formVehiculo.imagenUrl,
          observaciones: formVehiculo.observaciones.trim(),
          alertas
        });
        mostrarMensaje('ok', 'Vehículo actualizado correctamente');
      } else {
        const nuevoVeh: VehiculoItem = {
          id: `VEH-${Date.now()}`,
          matricula: matriculaFormateada,
          marcaModelo: formVehiculo.marcaModelo.trim(),
          tipo: formVehiculo.tipo,
          tecnicoAsignadoId: formVehiculo.tecnicoAsignadoId,
          tecnicoAsignadoNombre: tecNombre,
          kilometraje: formVehiculo.kilometraje ? Number(formVehiculo.kilometraje) : '',
          imagenUrl: formVehiculo.imagenUrl,
          observaciones: formVehiculo.observaciones.trim(),
          alertas,
          respuestasChecklist: {},
          fechaCreacion: new Date().toISOString()
        };
        const creado = await addVehiculo(nuevoVeh);
        mostrarMensaje('ok', 'Nuevo vehículo añadido a la flota');
        // Abrir directamente la ficha del nuevo vehículo
        setVehiculoSeleccionadoId(creado.id);
      }

      setModalOpen(false);
    } catch (err: any) {
      console.error('Error al guardar vehículo:', err);
      mostrarMensaje('error', 'Error al guardar los datos del vehículo');
    } finally {
      setCargando(false);
    }
  };

  // ─── ELIMINAR VEHÍCULO ────────────────────────────────────────────────────
  const handleEliminarVehiculo = async (veh: VehiculoItem) => {
    const docId = veh._docId || veh.id;
    if (!confirm(`¿Estás seguro de que deseas eliminar el vehículo con matrícula ${veh.matricula}?`)) {
      return;
    }
    try {
      await deleteVehiculo(docId);
      mostrarMensaje('ok', 'Vehículo eliminado de la flota');
      if (vehiculoSeleccionadoId === veh.id || vehiculoSeleccionadoId === veh._docId) {
        setVehiculoSeleccionadoId(null);
      }
    } catch (err) {
      console.error('Error al eliminar vehículo:', err);
      mostrarMensaje('error', 'Error al eliminar el vehículo');
    }
  };

  // ─── MANEJAR RESPUESTAS DE CHECKLIST EN CADA VEHÍCULO ─────────────────────
  const handleChecklistChange = (vehiculoId: string, itemKey: string, valor: any) => {
    setRespuestasLocales(prev => ({
      ...prev,
      [vehiculoId]: {
        ...(prev[vehiculoId] || {}),
        [itemKey]: valor
      }
    }));
  };

  const handleSubirImagenChecklist = async (vehiculoId: string, itemKey: string, file: File) => {
    if (!file) return;
    setSubiendoImagenKey(itemKey);
    try {
      const path = `vehiculos_checklist/${vehiculoId}_${itemKey}_${Date.now()}_${file.name}`;
      const url = await uploadFile(file, path);
      handleChecklistChange(vehiculoId, itemKey, url);
      mostrarMensaje('ok', 'Fotografía subida correctamente');

      // Si el vehículo no tiene foto principal o la pregunta es de foto de vehículo, actualizar la foto principal del vehículo
      const veh = vehiculos.find(v => v.id === vehiculoId || v._docId === vehiculoId);
      if (veh && !veh.imagenUrl) {
        await updateVehiculo(veh._docId || veh.id, { imagenUrl: url });
      }
    } catch (err: any) {
      console.error('Error subiendo imagen de checklist:', err);
      mostrarMensaje('error', 'Error al subir la imagen');
    } finally {
      setSubiendoImagenKey(null);
    }
  };

  const handleGuardarChecklistVehiculo = async (veh: VehiculoItem) => {
    const docId = veh._docId || veh.id;
    const respuestasAGuardar = respuestasLocales[veh.id] || {};
    try {
      await updateVehiculo(docId, {
        respuestasChecklist: respuestasAGuardar,
        fechaUltimaRevision: new Date().toISOString()
      });
      mostrarMensaje('ok', `Revisión guardada para el vehículo ${veh.matricula}`);
    } catch (err) {
      console.error('Error al guardar checklist del vehículo:', err);
      mostrarMensaje('error', 'Error al guardar la revisión del vehículo');
    }
  };

  // ─── FILTRADO DE VEHÍCULOS ────────────────────────────────────────────────
  const vehiculosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return vehiculos;
    return vehiculos.filter(v =>
      (v.matricula && v.matricula.toLowerCase().includes(q)) ||
      (v.marcaModelo && v.marcaModelo.toLowerCase().includes(q)) ||
      (v.tecnicoAsignadoNombre && v.tecnicoAsignadoNombre.toLowerCase().includes(q)) ||
      (v.tipo && v.tipo.toLowerCase().includes(q))
    );
  }, [vehiculos, busqueda]);

  // Vehículo actualmente seleccionado para ver su ficha ("al entrar")
  const vehiculoActivo = useMemo(() => {
    if (!vehiculoSeleccionadoId) return null;
    return vehiculos.find(v => v.id === vehiculoSeleccionadoId || v._docId === vehiculoSeleccionadoId) || null;
  }, [vehiculos, vehiculoSeleccionadoId]);

  // Alertas globales que vencen en 15 días o ya vencieron
  const alertasCriticasGlobales = useMemo(() => {
    let count = 0;
    vehiculos.forEach(v => {
      v.alertas?.forEach(a => {
        if (!a.fecha) return;
        const dias = calcularDiasRestantes(a.fecha);
        const diasAviso = a.diasAviso || 15;
        if (dias !== null && dias <= diasAviso) count++;
      });
    });
    return count;
  }, [vehiculos]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 sm:px-8 py-6">
      {/* ── BARRA SUPERIOR ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          {vehiculoActivo ? (
            <button
              onClick={() => setVehiculoSeleccionadoId(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 mb-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al listado de vehículos
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Truck className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-zinc-950 tracking-tight">
                  {vehiculoActivo ? `Ficha: ${vehiculoActivo.matricula} - ${vehiculoActivo.marcaModelo}` : 'Vehículos y Flota'}
                </h1>
                {!vehiculoActivo && (
                  <span className="text-xs font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                    {vehiculos.length} {vehiculos.length === 1 ? 'vehículo' : 'vehículos'}
                  </span>
                )}
                {alertasCriticasGlobales > 0 && !vehiculoActivo && (
                  <span className="text-xs font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-300 flex items-center gap-1 animate-pulse">
                    <Bell className="w-3 h-3 text-rose-600" />
                    {alertasCriticasGlobales} {alertasCriticasGlobales === 1 ? 'alerta en Hoy' : 'alertas en Hoy'}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                {vehiculoActivo
                  ? 'Detalles, alertas de vencimiento y tabla con las preguntas de revisión del vehículo.'
                  : 'Pulsa en cualquier tarjeta para entrar y ver la información completa, alertas y checklist de revisión.'}
              </p>
            </div>
          </div>
        </div>

        {/* Acciones principales superiores */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCrear}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Añadir nuevo vehículo</span>
          </button>

          <button
            onClick={() => navigate('/ajustes')}
            className="flex items-center gap-1.5 bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-2xs hover:bg-zinc-50 transition-all cursor-pointer"
            title="Ir a Configuración para editar la plantilla de Vehículos"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span>Editar plantilla en Otras plantillas</span>
          </button>
        </div>
      </div>

      {/* ── MENSAJES DE ESTADO ──────────────────────────────────────────────── */}
      {mensaje && (
        <div className={`mb-4 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 border animate-in fade-in ${
          mensaje.tipo === 'ok'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-sm'
            : 'bg-rose-50 text-rose-800 border-rose-200 shadow-sm'
        }`}>
          {mensaje.tipo === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
          <span>{mensaje.texto}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VISTA 1: LISTADO DE TARJETAS (SOLO MARCA, MODELO Y MATRÍCULA POR FUERA)
      ══════════════════════════════════════════════════════════════════════ */}
      {!vehiculoActivo && (
        <>
          {/* Barra de Búsqueda */}
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar vehículo por matrícula, marca o modelo..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="text-[11px] font-semibold text-zinc-400">
              Mostrando {vehiculosFiltrados.length} de {vehiculos.length} vehículos
            </div>
          </div>

          {vehiculosFiltrados.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center max-w-lg mx-auto shadow-sm my-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Truck className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-black text-zinc-900 mb-1">No hay vehículos registrados</h2>
              <p className="text-xs font-medium text-zinc-500 mb-6">
                {busqueda ? 'No se encontraron vehículos coincidentes con la búsqueda.' : 'Empieza añadiendo el primer vehículo de tu empresa.'}
              </p>
              <button
                onClick={handleOpenCrear}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-red-500/20 cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" /> + Añadir nuevo vehículo
              </button>
            </div>
          ) : (
            /* Cuadrícula de Tarjetas: Vista exterior limpia (solo Marca, Modelo y Matrícula) */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {vehiculosFiltrados.map((veh) => {
                // Comprobar si tiene alguna alerta crítica
                let tieneAlertaActiva = false;
                veh.alertas?.forEach(a => {
                  if (!a.fecha) return;
                  const dias = calcularDiasRestantes(a.fecha);
                  const diasAviso = a.diasAviso || 15;
                  if (dias !== null && dias <= diasAviso) tieneAlertaActiva = true;
                });

                return (
                  <div
                    key={veh.id}
                    onClick={() => setVehiculoSeleccionadoId(veh.id)}
                    className="group bg-white rounded-3xl border border-zinc-200/90 hover:border-blue-500 shadow-sm hover:shadow-xl transition-all duration-200 p-5 flex flex-col justify-between cursor-pointer relative overflow-hidden active:scale-[0.99]"
                  >
                    {/* Indicador superior de alerta si procede */}
                    {tieneAlertaActiva && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-rose-100 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-300 animate-pulse">
                        <Bell className="w-3 h-3 text-rose-600" />
                        <span>Aviso</span>
                      </div>
                    )}

                    <div>
                      {/* Imagen o Icono Superior */}
                      <div className="w-full h-36 rounded-2xl bg-gradient-to-br from-zinc-50 to-blue-50/40 border border-zinc-200/80 mb-4 overflow-hidden flex items-center justify-center group-hover:scale-[1.02] transition-transform">
                        {veh.imagenUrl ? (
                          <img
                            src={veh.imagenUrl}
                            alt={veh.matricula}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-white border border-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                            <Truck className="w-8 h-8 stroke-[1.8]" />
                          </div>
                        )}
                      </div>

                      {/* Marca, Modelo y Matrícula Real oficial al lado derecho */}
                      <div className="flex items-center justify-between gap-2.5 mb-2">
                        <h3 className="text-base font-black text-zinc-900 leading-snug group-hover:text-blue-600 transition-colors">
                          {veh.marcaModelo || 'Marca y modelo sin especificar'}
                        </h3>
                        <PlacaMatriculaReal matricula={veh.matricula} size="sm" />
                      </div>
                    </div>

                    {/* Botón inferior: Entrar al vehículo */}
                    <div className="mt-5 pt-3.5 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-blue-600 group-hover:text-blue-700 flex items-center gap-1.5">
                        <span>Entrar al vehículo</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </span>

                      <span className="text-[11px] font-semibold text-zinc-400">
                        {veh.tipo || 'Furgoneta'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VISTA 2: AL ENTRAR AL VEHÍCULO (TODA LA INFORMACIÓN, ALERTAS Y TABLA)
      ══════════════════════════════════════════════════════════════════════ */}
      {vehiculoActivo && (
        <div className="bg-white rounded-3xl border border-zinc-200/90 shadow-sm overflow-hidden animate-in fade-in duration-200">
          {/* ── CABECERA COMPLETA DEL VEHÍCULO ─────────────────────────────────── */}
          <div className="p-5 sm:p-7 bg-gradient-to-r from-zinc-50/80 via-white to-blue-50/40 border-b border-zinc-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Identificación y Foto */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <div className="w-20 h-20 rounded-2xl bg-zinc-100 border border-zinc-200/90 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                {vehiculoActivo.imagenUrl ? (
                  <img src={vehiculoActivo.imagenUrl} alt={vehiculoActivo.matricula} className="w-full h-full object-cover" />
                ) : (
                  <Truck className="w-10 h-10 text-blue-600" />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    {vehiculoActivo.tipo || 'Furgoneta'}
                  </span>
                </div>

                {/* Marca y Modelo con la Matrícula Real al lado derecho */}
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-900">
                    {vehiculoActivo.marcaModelo || 'Vehículo sin marca/modelo'}
                  </h2>
                  <PlacaMatriculaReal matricula={vehiculoActivo.matricula} size="lg" />
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-zinc-500 mt-1.5">
                  {vehiculoActivo.tecnicoAsignadoNombre && (
                    <span className="flex items-center gap-1.5 text-slate-800">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      Conductor asignado: <strong className="text-zinc-950 font-bold">{vehiculoActivo.tecnicoAsignadoNombre}</strong>
                    </span>
                  )}
                  {vehiculoActivo.kilometraje && (
                    <span className="flex items-center gap-1.5 font-mono text-zinc-800 bg-zinc-100 px-2.5 py-0.5 rounded-lg border border-zinc-200">
                      <Wrench className="w-3.5 h-3.5 text-zinc-500" />
                      {Number(vehiculoActivo.kilometraje).toLocaleString('es-ES')} km
                    </span>
                  )}
                  {vehiculoActivo.observaciones && (
                    <span className="text-zinc-500 italic max-w-md truncate">
                      "{vehiculoActivo.observaciones}"
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Zona Derecha: Botones de acción del vehículo */}
            <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
              <button
                type="button"
                onClick={() => handleOpenEditar(vehiculoActivo)}
                className="h-9 px-3.5 bg-white border border-zinc-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Editar datos del vehículo y fechas de alertas"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Editar vehículo</span>
              </button>

              <button
                type="button"
                onClick={() => handleEliminarVehiculo(vehiculoActivo)}
                className="h-9 px-3.5 bg-white border border-zinc-200 hover:border-red-400 hover:bg-red-50 text-red-600 font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Eliminar este vehículo"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar vehículo</span>
              </button>
            </div>
          </div>

          {/* ── TABLA CON LAS PREGUNTAS DEL FORMULARIO DE LA PLANTILLA ────────── */}
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="text-base font-semibold text-zinc-900 uppercase tracking-wide">
                    INFORMACIÓN DEL VEHICULO
                  </h3>
                </div>

                {/* Caducidad del seguro y alertas en formato compacto al lado del título */}
                {vehiculoActivo.alertas && vehiculoActivo.alertas.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {vehiculoActivo.alertas.map((alerta) => {
                      const dias = calcularDiasRestantes(alerta.fecha);
                      const diasAviso = alerta.diasAviso || 15;
                      const esCritica = dias !== null && dias <= diasAviso;
                      const haVencido = dias !== null && dias < 0;

                      return (
                        <div
                          key={alerta.id}
                          className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all text-xs ${
                            haVencido
                              ? 'bg-rose-50 border-rose-300 text-rose-800'
                              : esCritica
                              ? 'bg-amber-50 border-amber-300 text-amber-900'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                          }`}
                          title={`${alerta.titulo}: ${alerta.fecha ? formatFecha(alerta.fecha) : 'Sin fecha'}${alerta.descripcion ? ` - ${alerta.descripcion}` : ''}`}
                        >
                          <Bell className={`w-3 h-3 shrink-0 ${haVencido ? 'text-rose-600 animate-pulse' : esCritica ? 'text-amber-600 animate-pulse' : 'text-zinc-400'}`} />
                          <div className="flex items-center gap-1.5 leading-none">
                            <span className="font-semibold text-[11px] text-zinc-900">{alerta.titulo}:</span>
                            <span className={`text-[11px] ${haVencido ? 'text-rose-600 font-semibold' : esCritica ? 'text-amber-700 font-semibold' : 'text-zinc-600'}`}>
                              {dias === null
                                ? 'Sin fecha'
                                : haVencido
                                ? `Caducó hace ${Math.abs(dias)}d`
                                : dias === 0
                                ? 'Vence hoy'
                                : `En ${dias}d (${formatFecha(alerta.fecha)})`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGuardarChecklistVehiculo(vehiculoActivo)}
                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Revisión</span>
              </button>
            </div>

            {preguntasPlantilla.length === 0 ? (
              <div className="p-8 bg-zinc-50 rounded-2xl border border-zinc-200 text-center">
                <p className="text-xs font-bold text-zinc-600 mb-1">
                  No hay preguntas creadas en la plantilla de Vehículos.
                </p>
                <p className="text-[11px] text-zinc-400 mb-3">
                  Puedes configurar las preguntas del checklist desde el menú "Otras plantillas".
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/ajustes')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir Otras plantillas
                </button>
              </div>
            ) : (
              <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-100 border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                        <th className="py-2 px-3 w-12 text-center font-semibold">#</th>
                        <th className="py-2 px-3 font-semibold">Pregunta / Punto de Revisión</th>
                        <th className="py-2 px-3 w-64 font-semibold">Respuesta / Estado</th>
                        <th className="py-2 px-3 font-semibold">Observaciones / Valor adicional</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/70 text-xs">
                      {preguntasPlantilla.map((pregunta, idx) => {
                        const key = pregunta.key || pregunta.id;
                        const respuestasActuales = respuestasLocales[vehiculoActivo.id] || {};
                        const valorActual = respuestasActuales[key];
                        const notaKey = `${key}_nota`;
                        const notaActual = respuestasActuales[notaKey] || '';

                        return (
                          <tr
                            key={pregunta.id}
                            className={`transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50/20' : 'bg-blue-50/40 hover:bg-blue-50/60'}`}
                          >
                            <td className="py-2 px-3 text-center font-normal text-zinc-400">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3">
                              <p className="font-normal text-zinc-800 text-xs sm:text-sm leading-snug">{pregunta.label}</p>
                            </td>
                            {/* Columna de Tipo eliminada según solicitud */}
                            <td className="py-2 px-3">
                              {/* Control interactivo según tipo */}
                              {pregunta.tipoRespuesta === 'check' && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleChecklistChange(vehiculoActivo.id, key, 'CORRECTO')}
                                    className={`px-3 py-1 rounded-lg font-normal text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                      valorActual === 'CORRECTO' || valorActual === true
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700'
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>OK</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleChecklistChange(vehiculoActivo.id, key, 'NO CORRECTO')}
                                    className={`px-3 py-1 rounded-lg font-normal text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                      valorActual === 'NO CORRECTO' || valorActual === false
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-rose-50 hover:text-rose-700'
                                    }`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Fallo</span>
                                  </button>
                                </div>
                              )}

                              {/* Tipo IMAGEN o preguntas que pidan foto/imagen */}
                              {(pregunta.tipoRespuesta === 'imagen' || (!['check', 'numero', 'fecha', 'desplegable'].includes(pregunta.tipoRespuesta) && /imagen|foto|fotograf/i.test(pregunta.label))) && (
                                <div className="flex items-center gap-2">
                                  {valorActual ? (
                                    <div className="flex items-center gap-2 bg-white border border-zinc-200/90 p-1 rounded-lg">
                                      <div
                                        onClick={() => setPreviewImagenModal(valorActual)}
                                        className="relative w-8 h-8 rounded-md overflow-hidden border border-zinc-200 cursor-pointer group shrink-0 shadow-2xs"
                                        title="Clic para ver imagen completa"
                                      >
                                        <img src={valorActual} alt="Checklist" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <Eye className="w-3 h-3 text-white" />
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <label className="text-[11px] font-normal text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1">
                                          <Upload className="w-3 h-3" />
                                          <span>Cambiar</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => {
                                              const f = e.target.files?.[0];
                                              if (f) handleSubirImagenChecklist(vehiculoActivo.id, key, f);
                                              e.target.value = '';
                                            }}
                                          />
                                        </label>

                                        <button
                                          type="button"
                                          onClick={() => handleChecklistChange(vehiculoActivo.id, key, '')}
                                          className="text-[11px] font-normal text-red-500 hover:text-red-700 flex items-center gap-0.5 cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>Quitar</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <label className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-blue-50 border border-zinc-200 text-blue-700 text-xs font-normal rounded-lg cursor-pointer transition-colors shadow-2xs">
                                      {subiendoImagenKey === key ? (
                                        <>
                                          <Loader className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                          <span>Subiendo...</span>
                                        </>
                                      ) : (
                                        <>
                                          <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                                          <span>+ Añadir foto</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => {
                                              const f = e.target.files?.[0];
                                              if (f) handleSubirImagenChecklist(vehiculoActivo.id, key, f);
                                              e.target.value = '';
                                            }}
                                          />
                                        </>
                                      )}
                                    </label>
                                  )}
                                </div>
                              )}

                              {pregunta.tipoRespuesta === 'numero' && (
                                <input
                                  type="number"
                                  value={valorActual ?? ''}
                                  onChange={e => handleChecklistChange(vehiculoActivo.id, key, e.target.value)}
                                  placeholder="Valor numérico..."
                                  className="w-full h-8 px-2.5 bg-white border border-zinc-200 rounded-lg text-xs font-normal outline-none focus:border-blue-500"
                                />
                              )}

                              {pregunta.tipoRespuesta === 'fecha' && (
                                <input
                                  type="date"
                                  value={valorActual ?? ''}
                                  onChange={e => handleChecklistChange(vehiculoActivo.id, key, e.target.value)}
                                  className="w-full h-8 px-2.5 bg-white border border-zinc-200 rounded-lg text-xs font-normal outline-none focus:border-blue-500"
                                />
                              )}

                              {pregunta.tipoRespuesta === 'desplegable' && (
                                <select
                                  value={valorActual ?? ''}
                                  onChange={e => handleChecklistChange(vehiculoActivo.id, key, e.target.value)}
                                  className="w-full h-8 px-2.5 bg-white border border-zinc-200 rounded-lg text-xs font-normal outline-none focus:border-blue-500 cursor-pointer"
                                >
                                  <option value="">-- Seleccionar --</option>
                                  {(pregunta.opciones || []).map((opt, i) => (
                                    <option key={i} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              )}

                              {(pregunta.tipoRespuesta === 'texto' || pregunta.tipoRespuesta === 'texto-largo') && !/imagen|foto|fotograf/i.test(pregunta.label) && (
                                <input
                                  type="text"
                                  value={valorActual ?? ''}
                                  onChange={e => handleChecklistChange(vehiculoActivo.id, key, e.target.value)}
                                  placeholder="Escribir respuesta..."
                                  className="w-full h-8 px-2.5 bg-white border border-zinc-200 rounded-lg text-xs font-normal outline-none focus:border-blue-500"
                                />
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={notaActual}
                                onChange={e => handleChecklistChange(vehiculoActivo.id, notaKey, e.target.value)}
                                placeholder="Notas u observaciones de este punto..."
                                className="w-full h-8 px-2.5 bg-white/70 border border-zinc-200 rounded-lg text-xs font-normal outline-none focus:bg-white focus:border-blue-500 transition-all"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL DE CREACIÓN / EDICIÓN DE VEHÍCULO Y ALERTAS ────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-zinc-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {/* Cabecera del modal */}
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900">
                    {editandoId ? 'Editar Vehículo' : 'Añadir Nuevo Vehículo'}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Datos del vehículo, conductor asignado y configuración de alertas de seguro e ITV.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarVehiculo} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Sección 1: Datos Básicos */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">
                  1. Información del Vehículo
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Matrícula <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formVehiculo.matricula}
                      onChange={e => setFormVehiculo({ ...formVehiculo, matricula: e.target.value.toUpperCase() })}
                      placeholder="Ej: 1234-XYZ"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-black outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Marca y Modelo
                    </label>
                    <input
                      type="text"
                      value={formVehiculo.marcaModelo}
                      onChange={e => setFormVehiculo({ ...formVehiculo, marcaModelo: e.target.value })}
                      placeholder="Ej: Renault Kangoo 1.5 dCi"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Tipo de Vehículo
                    </label>
                    <select
                      value={formVehiculo.tipo}
                      onChange={e => setFormVehiculo({ ...formVehiculo, tipo: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:border-blue-500"
                    >
                      <option value="Furgoneta">Furgoneta</option>
                      <option value="Camión">Camión</option>
                      <option value="Turismo">Turismo</option>
                      <option value="Pick-up">Pick-up / 4x4</option>
                      <option value="Remolque">Remolque</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Conductor / Técnico Asignado
                    </label>
                    <select
                      value={formVehiculo.tecnicoAsignadoId}
                      onChange={e => setFormVehiculo({ ...formVehiculo, tecnicoAsignadoId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-blue-500"
                    >
                      <option value="">-- Sin asignar --</option>
                      {tecnicos.map(t => (
                        <option key={t.id || t._docId} value={t.id || t._docId}>
                          {t.nombre} {t.apellidos || ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Kilometraje Actual
                    </label>
                    <input
                      type="number"
                      value={formVehiculo.kilometraje}
                      onChange={e => setFormVehiculo({ ...formVehiculo, kilometraje: e.target.value })}
                      placeholder="Ej: 145000"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-medium outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  {/* Foto del vehículo */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Fotografía del Vehículo
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleSubirFoto}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={subiendoFoto}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl border border-zinc-200 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{subiendoFoto ? 'Subiendo...' : 'Seleccionar foto...'}</span>
                      </button>

                      {formVehiculo.imagenUrl && (
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                          <img src={formVehiculo.imagenUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setFormVehiculo(prev => ({ ...prev, imagenUrl: '' }))}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-red-600 text-white rounded-full"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 2: Configuración de Alertas para el Menú "HOY" */}
              <div className="pt-4 border-t border-zinc-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-purple-600" />
                      2. Alertas y Vencimientos para el Menú "HOY"
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Aparecerán automáticamente en la tarjeta <strong>"4. Notificaciones"</strong> con los días de preaviso indicados (por defecto 15 días).
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Alerta de Seguro */}
                  <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200/80">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-black text-purple-950">Seguro del Vehículo</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                          Fecha de Vencimiento
                        </label>
                        <input
                          type="date"
                          value={formVehiculo.seguroFecha}
                          onChange={e => setFormVehiculo({ ...formVehiculo, seguroFecha: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-medium outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                          Compañía / Póliza
                        </label>
                        <input
                          type="text"
                          value={formVehiculo.seguroCompania}
                          onChange={e => setFormVehiculo({ ...formVehiculo, seguroCompania: e.target.value })}
                          placeholder="Ej: Mapfre Póliza nº 12345"
                          className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                          Días de preaviso
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={formVehiculo.seguroDiasAviso}
                          onChange={e => setFormVehiculo({ ...formVehiculo, seguroDiasAviso: Number(e.target.value) || 15 })}
                          className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-bold outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Alerta de ITV */}
                  <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-black text-blue-950">Inspección Técnica (ITV)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                          Fecha de Próxima ITV
                        </label>
                        <input
                          type="date"
                          value={formVehiculo.itvFecha}
                          onChange={e => setFormVehiculo({ ...formVehiculo, itvFecha: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-medium outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                          Días de preaviso (ej: 15 días antes)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={formVehiculo.itvDiasAviso}
                          onChange={e => setFormVehiculo({ ...formVehiculo, itvDiasAviso: Number(e.target.value) || 15 })}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Alerta de Mantenimiento / Taller */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-black text-amber-950">Revisión Periódica / Taller</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                          Fecha Prevista de Mantenimiento
                        </label>
                        <input
                          type="date"
                          value={formVehiculo.mantenimientoFecha}
                          onChange={e => setFormVehiculo({ ...formVehiculo, mantenimientoFecha: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                          Días de preaviso
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={formVehiculo.mantenimientoDiasAviso}
                          onChange={e => setFormVehiculo({ ...formVehiculo, mantenimientoDiasAviso: Number(e.target.value) || 15 })}
                          className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción del modal */}
              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {cargando ? 'Guardando...' : editandoId ? 'Guardar Cambios' : 'Añadir Vehículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL VISUALIZADOR DE IMAGEN EN TAMAÑO COMPLETO ──────────────────── */}
      {previewImagenModal && (
        <div 
          onClick={() => setPreviewImagenModal(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImagenModal(null)}
              className="absolute top-4 right-4 p-2.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewImagenModal} alt="Preview" className="max-w-full max-h-[82vh] object-contain rounded-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
