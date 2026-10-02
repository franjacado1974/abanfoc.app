/**
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * FormBuilderPlantillas.tsx
 * Editor visual de formularios (Form Builder) para plantillas de checklist.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * CaracterÃ­sticas:
 * - Sidebar con lista de plantillas desde Firestore
 * - Editor visual con vista previa en tiempo real
 * - Cada fila: texto editable, tipo de respuesta (check/texto/numero), orden
 * - Checkbox "Horizontal" para mostrar label a la izquierda y campo a la derecha
 * - Botones: AÃ±adir fila, Eliminar fila, Subir/Bajar
 * - Guardado y sincronizaciÃ³n directa con Firestore
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 */

import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Save, ChevronUp, ChevronDown,
  GripVertical, AlertCircle,
  ClipboardList, Edit3, X, Loader, Copy, Image,
  Table, TrendingUp
} from 'lucide-react';
import {
  subscribePlantillas, subscribeItemsDePlantilla,
  addPlantilla, updatePlantilla, deletePlantilla,
  addItemAPlantilla, updateItemDePlantilla, deleteItemDePlantilla,
  reemplazarItemsDePlantilla, inicializarPlantillasPorDefecto, duplicarPlantilla,
  type Plantilla, type ItemPlantillaInput, type PlantillaInput, type TipoRespuestaChecklist
} from '../../recursos-compartidos/types/plantillas';

// â”€â”€â”€ TIPOS LOCALES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ItemLocal {
  id: string;           // ID del documento en Firestore (o temporal si es nuevo)
  label: string;
  key: string;
  orden: number;
  tipoRespuesta: TipoRespuestaChecklist;
  requerido: boolean;
  opciones?: string[];  // Opciones para desplegable y tabla (cabeceras)
  filasInicio?: number; // Filas iniciales para tabla
  filasNombres?: string[]; // Nombres de las filas (cabecera vertical para tablas, opcional)
  horizontal?: boolean; // true = label a la izquierda, campo a la derecha
  valorPredeterminado?: string; // Valor por defecto / predeterminado
  esNuevo?: boolean;    // true si aÃºn no se ha guardado en Firestore
}

// â”€â”€â”€ COMPONENTE PRINCIPAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Componente auxiliar para las opciones del desplegable
const OpcionesInput = ({ opciones, onUpdate }: { opciones: string[], onUpdate: (opts: string[]) => void }) => {
  const [val, setVal] = useState(opciones.join(', '));
  
  // Sincronizar si cambia desde fuera y no estamos editando
  useEffect(() => {
    setVal(opciones.join(', '));
  }, [opciones.join(', ')]);

  return (
    <input
      type="text"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => {
        const opts = val.split(',').map(s => s.trim()).filter(Boolean);
        onUpdate(opts);
        setVal(opts.join(', '));
      }}
      className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-md text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
      placeholder="Ej: OpciÃ³n 1, OpciÃ³n 2, OpciÃ³n 3"
    />
  );
};

export default function FormBuilderPlantillas() {
  // â”€â”€â”€ ESTADOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string | null>(null);
  const [items, setItems] = useState<ItemLocal[]>([]);
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [descripcionPlantilla, setDescripcionPlantilla] = useState('');
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [inicializado, setInicializado] = useState(false);

  // Estados para modal "Crear tabla"
  const [modalTablaOpen, setModalTablaOpen] = useState(false);
  const [tablaNombre, setTablaNombre] = useState('Tabla');
  const [tablaColumnas, setTablaColumnas] = useState(3);
  const [tablaFilas, setTablaFilas] = useState(4);

  // â”€â”€â”€ SUSCRIPCIONES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // SuscripciÃ³n a la lista de plantillas
  useEffect(() => {
    const unsub = subscribePlantillas((lista) => {
      console.log('ðŸ“‹ Plantillas cargadas desde Firestore:', lista.length);
      setPlantillas(lista);
      if (lista.length === 0 && !inicializado) {
        console.log('âš ï¸ No hay plantillas. Inicializando plantillas por defecto...');
        inicializarPlantillasPorDefecto()
          .then(() => {
            console.log('âœ… Plantillas por defecto inicializadas correctamente');
            setInicializado(true);
          })
          .catch((err) => {
            console.error('âŒ Error inicializando plantillas por defecto:', err);
            mostrarMensaje('error', 'Error al inicializar plantillas: ' + err.message);
          });
      } else if (lista.length > 0) {
        setInicializado(true);
      }
    });
    return () => unsub();
  }, [inicializado]);

  // SuscripciÃ³n a los items de la plantilla seleccionada
  useEffect(() => {
    if (!plantillaSeleccionada) {
      setItems([]);
      return;
    }
    const unsub = subscribeItemsDePlantilla(plantillaSeleccionada, (itemsFirestore) => {
      const ordenados = [...itemsFirestore].sort((a, b) => a.orden - b.orden);
      setItems(ordenados.map(it => ({
        id: it.id,
        label: it.label,
        key: it.key,
        orden: it.orden,
        tipoRespuesta: it.tipoRespuesta,
        requerido: it.requerido,
        opciones: it.opciones || [],
        filasInicio: it.filasInicio,
        filasNombres: it.filasNombres,
        horizontal: it.horizontal === true,
        valorPredeterminado: it.valorPredeterminado || '',
        esNuevo: false,
      })));
    });
    return () => unsub();
  }, [plantillaSeleccionada]);

  // Cargar datos de la plantilla al seleccionar
  useEffect(() => {
    if (!plantillaSeleccionada) return;
    const p = plantillas.find(p => p.id === plantillaSeleccionada);
    if (p) {
      setNombrePlantilla(p.nombre);
      setDescripcionPlantilla(p.descripcion || '');
    }
  }, [plantillaSeleccionada, plantillas]);

  // â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 3000);
  };

  // â”€â”€â”€ MANEJADORES DE PLANTILLA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleCrearPlantilla = async () => {
    const nombre = prompt('Nombre de la nueva plantilla:');
    if (!nombre || !nombre.trim()) return;
    try {
      const input: PlantillaInput = { nombre: nombre.trim(), activa: true };
      const creada = await addPlantilla(input);
      setPlantillaSeleccionada(creada.id);
      setNombrePlantilla(creada.nombre);
      setDescripcionPlantilla('');
      mostrarMensaje('ok', 'Plantilla creada correctamente');
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al crear la plantilla');
    }
  };

  const handleEliminarPlantilla = async (id: string) => {
    if (!confirm('Â¿Eliminar esta plantilla y todos sus items?\nEsta acciÃ³n no se puede deshacer.')) return;
    try {
      await deletePlantilla(id);
      if (plantillaSeleccionada === id) {
        setPlantillaSeleccionada(null);
        setItems([]);
      }
      mostrarMensaje('ok', 'Plantilla eliminada');
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al eliminar la plantilla');
    }
  };

  const handleDuplicarPlantilla = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      mostrarMensaje('ok', 'Duplicando plantilla...');
      const nueva = await duplicarPlantilla(id);
      setPlantillaSeleccionada(nueva.id);
      setNombrePlantilla(nueva.nombre);
      setDescripcionPlantilla(nueva.descripcion || '');
      mostrarMensaje('ok', 'âœ… Plantilla duplicada correctamente');
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al duplicar la plantilla');
    }
  };

  const handleGuardarNombre = async () => {
    if (!plantillaSeleccionada || !nombrePlantilla.trim()) return;
    try {
      const datos: any = { nombre: nombrePlantilla.trim() };
      if (descripcionPlantilla.trim()) {
        datos.descripcion = descripcionPlantilla.trim();
      }
      await updatePlantilla(plantillaSeleccionada, datos);
      setEditandoNombre(false);
      mostrarMensaje('ok', 'Nombre guardado');
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al guardar el nombre');
    }
  };

  // â”€â”€â”€ MANEJADORES DE ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleAddItem = async () => {
    if (!plantillaSeleccionada) return;
    const nuevoOrden = items.length + 1;
    const nuevoItem: ItemPlantillaInput = {
      plantillaId: plantillaSeleccionada,
      label: 'Nueva pregunta',
      key: `item_${Date.now()}`,
      orden: nuevoOrden,
      tipoRespuesta: 'check',
      requerido: true,
    };
    try {
      await addItemAPlantilla(nuevoItem);
      mostrarMensaje('ok', 'Pregunta aÃ±adida');
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al aÃ±adir la pregunta');
    }
  };

  const handleCrearTabla = () => {
    if (!plantillaSeleccionada) return;
    setTablaNombre('Tabla de Equipos');
    setTablaColumnas(3);
    setTablaFilas(4);
    setModalTablaOpen(true);
  };

  const handleCrearTablaConfirm = async () => {
    if (!plantillaSeleccionada) return;
    
    // Crear cabeceras por defecto
    const opcionesCabeceras = Array.from({ length: tablaColumnas }, (_, i) => `Columna ${i + 1}`);
    
    const nuevoOrden = items.length + 1;
    const nuevoItem = {
      plantillaId: plantillaSeleccionada,
      label: tablaNombre.trim() || 'Tabla',
      key: `table_${Date.now()}`,
      orden: nuevoOrden,
      tipoRespuesta: 'tabla',
      requerido: false,
      opciones: opcionesCabeceras,
      filasInicio: tablaFilas,
      filasNombres: [],
    } as any;
    
    try {
      await addItemAPlantilla(nuevoItem);
      setModalTablaOpen(false);
      mostrarMensaje('ok', 'Tabla aÃ±adida al checklist');
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al crear la tabla');
    }
  };

  const handleCrearGrafico = async () => {
    if (!plantillaSeleccionada) return;
    
    const nuevoOrden = items.length + 1;
    const nuevoItem = {
      plantillaId: plantillaSeleccionada,
      label: 'Ensayo de Caudal y PresiÃ³n (GrÃ¡fico Q-H)',
      key: `table_${Date.now()}`,
      orden: nuevoOrden,
      tipoRespuesta: 'grafico',
      requerido: false,
      opciones: ['Caudal (mÂ³/h)', 'L.P.M.', 'PresiÃ³n (bar)', 'R.P.M.'],
      filasInicio: 4,
      filasNombres: ['0%', '50%', '100%', '140%'],
    } as any;
    
    try {
      await addItemAPlantilla(nuevoItem);
      mostrarMensaje('ok', 'GrÃ¡fico Q-H aÃ±adido al checklist');
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al crear el grÃ¡fico');
    }
  };

  const handleUpdateItem = async (itemId: string, cambios: Partial<ItemPlantillaInput>) => {
    if (!plantillaSeleccionada) return;
    try {
      await updateItemDePlantilla(plantillaSeleccionada, itemId, cambios);
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al actualizar');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!plantillaSeleccionada) return;
    try {
      await deleteItemDePlantilla(plantillaSeleccionada, itemId);
      mostrarMensaje('ok', 'Pregunta eliminada');
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al eliminar');
    }
  };

  const handleCopyItem = async (index: number) => {
    if (!plantillaSeleccionada || index < 0 || index >= items.length) return;
    
    // Crear la nueva lista con la copia insertada justo despuÃ©s del original
    const nuevosItems: ItemPlantillaInput[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      nuevosItems.push({
        plantillaId: plantillaSeleccionada,
        label: item.label,
        key: item.key,
        orden: i + 1,
        tipoRespuesta: item.tipoRespuesta,
        requerido: item.requerido,
        opciones: item.opciones || [],
        filasInicio: item.filasInicio,
        filasNombres: item.filasNombres,
        horizontal: item.horizontal === true,
        valorPredeterminado: item.valorPredeterminado || '',
      });
      // Si es el item que estamos copiando, insertamos la copia justo despuÃ©s
      if (i === index) {
        nuevosItems.push({
          plantillaId: plantillaSeleccionada,
          label: item.label + ' (copia)',
          key: `item_${Date.now()}`,
          orden: i + 2, // Se reasignarÃ¡ al final
          tipoRespuesta: item.tipoRespuesta,
          requerido: item.requerido,
          opciones: item.opciones || [],
          filasInicio: item.filasInicio,
          filasNombres: item.filasNombres,
          horizontal: item.horizontal === true,
          valorPredeterminado: item.valorPredeterminado || '',
        });
      }
    }
    // Reasignar Ã³rdenes consecutivos
    const itemsFinal = nuevosItems.map((item, i) => ({
      ...item,
      orden: i + 1,
    }));

    try {
      await reemplazarItemsDePlantilla(plantillaSeleccionada, itemsFinal);
      mostrarMensaje('ok', 'Pregunta duplicada');
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al duplicar la pregunta');
    }
  };

  const handleMoverItem = async (index: number, direccion: 'up' | 'down') => {
    if (!plantillaSeleccionada) return;
    const nuevoIndex = direccion === 'up' ? index - 1 : index + 1;
    if (nuevoIndex < 0 || nuevoIndex >= items.length) return;

    // Intercambiar Ã³rdenes
    const itemsReordenados = items.map((item, i) => {
      if (i === index) return { ...item, orden: items[nuevoIndex].orden };
      if (i === nuevoIndex) return { ...item, orden: items[index].orden };
      return item;
    }).sort((a, b) => a.orden - b.orden);

    // Reasignar Ã³rdenes consecutivos
    const itemsFinal = itemsReordenados.map((item, i) => ({
      plantillaId: plantillaSeleccionada!,
      label: item.label,
      key: item.key,
      orden: i + 1,
      tipoRespuesta: item.tipoRespuesta,
      requerido: item.requerido,
      opciones: item.opciones || [],
      filasInicio: item.filasInicio,
      filasNombres: item.filasNombres,
      horizontal: item.horizontal === true,
      valorPredeterminado: item.valorPredeterminado || '',
    }));

    try {
      await reemplazarItemsDePlantilla(plantillaSeleccionada, itemsFinal);
      mostrarMensaje('ok', 'Orden actualizado');
    } catch (e) {
      console.error(e);
      mostrarMensaje('error', 'Error al reordenar');
    }
  };

  // â”€â”€â”€ GUARDADO COMPLETO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleGuardarTodo = async () => {
    if (!plantillaSeleccionada || !nombrePlantilla.trim()) return;
    setGuardando(true);
    try {
      // Guardar nombre y descripciÃ³n de la plantilla
      // (los items se guardan individualmente al editar cada campo)
      const datos: any = { nombre: nombrePlantilla.trim() };
      if (descripcionPlantilla.trim()) {
        datos.descripcion = descripcionPlantilla.trim();
      }
      await updatePlantilla(plantillaSeleccionada, datos);
      mostrarMensaje('ok', 'âœ… Plantilla guardada correctamente');
    } catch (e: any) {
      console.error('Error detallado al guardar plantilla:', e);
      const msgError = e?.message || e?.code || 'Error desconocido';
      mostrarMensaje('error', `âŒ Error: ${msgError}`);
    } finally {
      setGuardando(false);
    }
  };

  // â”€â”€â”€ RENDER: BADGE DE TIPO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const TipoBadge = ({ tipo }: { tipo: TipoRespuestaChecklist }) => {
    const estilos: Record<string, string> = {
      check: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      texto: 'bg-blue-100 text-blue-700 border-blue-200',
      'texto-largo': 'bg-sky-100 text-sky-700 border-sky-200',
      numero: 'bg-amber-100 text-amber-700 border-amber-200',
      fecha: 'bg-purple-100 text-purple-700 border-purple-200',
      imagen: 'bg-pink-100 text-pink-700 border-pink-200',
      desplegable: 'bg-orange-100 text-orange-700 border-orange-200',
      seccion: 'bg-zinc-200 text-zinc-800 border-zinc-300',
      tabla: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      seleccion: 'bg-violet-100 text-violet-700 border-violet-200',
      grafico: 'bg-rose-100 text-rose-700 border-rose-200',
    };
    const labels: Record<string, string> = {
      check: 'Check',
      texto: 'Texto',
      'texto-largo': 'Texto Largo',
      numero: 'NÃºmero',
      fecha: 'Fecha',
      imagen: 'Imagen',
      desplegable: 'Desplegable',
      seccion: 'SecciÃ³n',
      tabla: 'Tabla',
      seleccion: 'SelecciÃ³n',
      grafico: 'GrÃ¡fico Q-H',
    };
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${estilos[tipo] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
        {labels[tipo] || tipo}
      </span>
    );
  };

  // â”€â”€â”€ RENDER: VISTA PREVIA DEL CAMPO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const renderInputPreview = (item: ItemLocal) => {
    switch (item.tipoRespuesta) {
      case 'check':
        return (
          <label className="flex items-center gap-2 cursor-pointer text-xs px-3 py-2 rounded-lg bg-white border border-zinc-200 hover:border-zinc-300 transition-all select-none text-zinc-700 font-medium">
            <input
              type="checkbox"
              className="w-4 h-4 rounded cursor-pointer text-teal-600 border-zinc-300 focus:ring-teal-500"
              checked={item.valorPredeterminado === 'true'}
              disabled
            />
            {item.label}
          </label>
        );
      case 'numero':
        return (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-500">{item.label}</label>
            <input
              type="number"
              value={item.valorPredeterminado || ''}
              placeholder={item.valorPredeterminado ? '' : '0'}
              className="w-28 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              disabled
            />
          </div>
        );
      case 'texto':
        return (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-500">{item.label}</label>
            <input
              type="text"
              value={item.valorPredeterminado || ''}
              placeholder={item.valorPredeterminado ? '' : '...'}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              disabled
            />
          </div>
        );
      case 'fecha':
        return (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-500">{item.label}</label>
            <input
              type="date"
              value={item.valorPredeterminado === 'hoy' ? new Date().toISOString().split('T')[0] : (item.valorPredeterminado || '')}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              disabled
            />
          </div>
        );
      case 'texto-largo':
        return (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-500">{item.label}</label>
            <textarea
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 resize-none"
              rows={3}
              value={item.valorPredeterminado || ''}
              placeholder={item.valorPredeterminado ? '' : '...'}
              disabled
            />
          </div>
        );
      case 'imagen':
        return (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-500">{item.label}</label>
            <div className="flex items-center gap-2 p-3 bg-white border border-dashed border-zinc-300 rounded-lg">
              <Image className="w-5 h-5 text-zinc-400" />
              <span className="text-[10px] text-zinc-400">AÃ±adir foto</span>
            </div>
          </div>
        );
      case 'desplegable':
        return (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-500">{item.label}</label>
            <select
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none text-zinc-700 font-medium"
              value={item.valorPredeterminado || ''}
              disabled
            >
              <option value="">Selecciona...</option>
              {(item.opciones || []).map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );
      case 'seleccion':
        const opcionesSel = item.opciones && item.opciones.length > 0 ? item.opciones : ['SÃ­', 'No', 'N/A'];
        return (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-500">{item.label}</label>
            <div className="flex flex-wrap items-center gap-4 mt-1">
              {opcionesSel.map((opt, i) => {
                const isSelected = item.valorPredeterminado ? opt === item.valorPredeterminado : (i === 0);
                return (
                  <div
                    key={i}
                    className={`inline-flex items-center gap-2 py-1 select-none transition-all ${
                      isSelected ? 'opacity-100' : 'opacity-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                        : 'bg-white border-zinc-300 text-transparent'
                    }`}>
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                    <span className={`text-xs text-zinc-700 ${isSelected ? 'font-bold text-indigo-900' : 'font-normal'}`}>
                      {opt}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'seccion':
        return (
          <div className="border-b border-zinc-200 pb-1 pt-1 mb-1">
            <span className="text-xs font-bold text-zinc-700 uppercase tracking-wide">{item.label || 'Separador de SecciÃ³n'}</span>
          </div>
        );
      case 'tabla':
      case 'grafico':
        const isGrafico = item.tipoRespuesta === 'grafico';
        const headers = item.opciones || [];
        const hasVert = Array.isArray(item.filasNombres) && item.filasNombres.length > 0;
        const rowsCount = (hasVert && item.filasNombres) ? item.filasNombres.length : (item.filasInicio || 3);
        const displayHeaders = hasVert ? ['Concepto / Ensayo', ...headers] : headers;

        return (
          <div className="flex flex-col gap-1.5 w-full col-span-full">
            <label className="text-[10px] font-semibold text-zinc-500">{item.label}</label>
            <div className="border border-zinc-200 rounded-lg overflow-hidden w-full bg-white shadow-sm">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead>
                  <tr className="bg-black text-white">
                    {displayHeaders.map((h, i) => (
                      <th key={i} className="px-2 py-1.5 font-bold border-r border-zinc-800 last:border-r-0 uppercase text-[8px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowsCount }).map((_, rIdx) => {
                    const rowName = (hasVert && item.filasNombres) ? (item.filasNombres[rIdx] || '') : '';
                    return (
                      <tr key={rIdx} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/50">
                        {hasVert && (
                          <td className="px-2 py-1.5 border-r border-zinc-100 font-bold bg-zinc-50 text-zinc-700">{rowName}</td>
                        )}
                        {headers.map((_, cIdx) => (
                          <td key={cIdx} className="px-2 py-1.5 border-r border-zinc-100 last:border-r-0 text-zinc-400">...</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!hasVert && (
                <div className="px-2 py-1 bg-zinc-50 border-t border-zinc-100 flex justify-end">
                  <span className="text-[8px] bg-white border border-zinc-200 text-indigo-600 px-1.5 py-0.5 rounded font-bold shadow-sm">+ AÃ±adir fila</span>
                </div>
              )}
            </div>
            {isGrafico && (
              <div className="border border-dashed border-rose-300 rounded-lg p-3 bg-rose-50/20 text-center flex flex-col items-center justify-center min-h-[60px] mt-1">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wide">ðŸ“ˆ [Curva de Caudal y PresiÃ³n (Q-H) se graficarÃ¡ automÃ¡ticamente en el acta PDF]</span>
              </div>
            )}
          </div>
        );
    }
  };

  const VistaPreviaCampo = ({ item }: { item: ItemLocal }) => {
    // Si es secciÃ³n, siempre se renderiza igual
    if (item.tipoRespuesta === 'seccion') {
      return (
        <div className="border-b border-zinc-200 pb-1 pt-1 mb-1">
          <span className="text-xs font-bold text-zinc-700 uppercase tracking-wide">{item.label || 'Separador de SecciÃ³n'}</span>
        </div>
      );
    }

    if (item.tipoRespuesta === 'tabla' || item.tipoRespuesta === 'grafico') {
      return renderInputPreview(item);
    }

    // Si tiene horizontal activado, se renderiza en lÃ­nea horizontal
    if (item.horizontal) {
      const innerType = item.tipoRespuesta;
      return (
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-zinc-100">
          <span className="text-xs font-semibold text-zinc-700">{item.label || 'Pregunta'}</span>
          <div className="w-48 shrink-0">
            {innerType === 'check' && (
              <label className="flex items-center gap-2 cursor-pointer text-xs px-3 py-1.5 rounded-lg bg-white border border-zinc-200 hover:border-zinc-300 transition-all select-none text-zinc-700 font-medium">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded cursor-pointer text-teal-600 border-zinc-300 focus:ring-teal-500"
                  checked={item.valorPredeterminado === 'true'}
                  disabled
                />
                OK
              </label>
            )}
            {innerType === 'texto' && (
              <input
                type="text"
                value={item.valorPredeterminado || ''}
                placeholder={item.valorPredeterminado ? '' : '...'}
                className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                disabled
              />
            )}
            {innerType === 'numero' && (
              <input
                type="number"
                value={item.valorPredeterminado || ''}
                placeholder={item.valorPredeterminado ? '' : '0'}
                className="w-28 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                disabled
              />
            )}
            {innerType === 'fecha' && (
              <input
                type="date"
                value={item.valorPredeterminado === 'hoy' ? new Date().toISOString().split('T')[0] : (item.valorPredeterminado || '')}
                className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                disabled
              />
            )}
            {innerType === 'texto-largo' && (
              <textarea
                className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 resize-none"
                rows={2}
                value={item.valorPredeterminado || ''}
                placeholder={item.valorPredeterminado ? '' : '...'}
                disabled
              />
            )}
            {innerType === 'imagen' && (
              <div className="flex items-center gap-2 p-2 bg-white border border-dashed border-zinc-300 rounded-lg">
                <Image className="w-4 h-4 text-zinc-400" />
                <span className="text-[9px] text-zinc-400">AÃ±adir foto</span>
              </div>
            )}
            {innerType === 'desplegable' && (
              <select
                className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none text-zinc-700 font-medium"
                value={item.valorPredeterminado || ''}
                disabled
              >
                <option value="">Selecciona...</option>
                {(item.opciones || []).map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            )}
            {innerType === 'seleccion' && (
              <div className="flex gap-1 flex-wrap justify-end">
                {(item.opciones && item.opciones.length > 0 ? item.opciones : ['SÃ­', 'No', 'N/A']).map((opt, i) => {
                  const isSelected = item.valorPredeterminado ? opt === item.valorPredeterminado : (i === 0);
                  return (
                    <span
                      key={i}
                      className={`px-2.5 py-1 text-[10px] rounded-lg border text-center font-semibold shadow-sm transition-all select-none ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold' 
                          : 'bg-white text-zinc-600 border-zinc-200'
                      }`}
                    >
                      {opt}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Renderizado normal (vertical)
    return <>{renderInputPreview(item)}</>;
  };

  // â”€â”€â”€ RENDER PRINCIPAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="min-h-screen bg-[#DCE1E5] flex flex-col">
      {/* â”€â”€ CUERPO: DOS COLUMNAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* â”€â”€ SIDEBAR: Lista de plantillas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <aside className="w-full lg:w-96 xl:w-[26rem] bg-white border-b lg:border-b-0 lg:border-r border-zinc-200 overflow-y-auto shrink-0">
          <div className="p-4 space-y-3">
            {/* BotÃ³n nueva plantilla */}
            <button
              onClick={handleCrearPlantilla}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nueva Plantilla
            </button>

            {/* Lista */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
                Plantillas ({plantillas.length})
              </p>
              {plantillas.length === 0 ? (
                <div className="p-4 text-center text-zinc-400 text-xs">
                  No hay plantillas. Crea una nueva.
                </div>
              ) : (
                plantillas.map(p => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${
                      plantillaSeleccionada === p.id
                        ? 'bg-teal-50 border border-teal-200 shadow-sm'
                        : 'hover:bg-zinc-50 border border-transparent'
                    }`}
                    onClick={() => setPlantillaSeleccionada(p.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${
                        plantillaSeleccionada === p.id ? 'text-teal-800' : 'text-zinc-800'
                      }`}>
                        {p.nombre}
                      </p>
                      {p.descripcion && (
                        <p className="text-[9px] text-zinc-400 truncate">{p.descripcion}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDuplicarPlantilla(p.id, e)}
                      className="p-1.5 text-teal-400 hover:text-teal-700 hover:bg-teal-100 rounded-lg transition-all shrink-0"
                      title="Duplicar plantilla"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEliminarPlantilla(p.id); }}
                      className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0"
                      title="Eliminar plantilla"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* â”€â”€ EDITOR PRINCIPAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {!plantillaSeleccionada ? (
            /* â”€â”€ Estado vacÃ­o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-20 h-20 bg-teal-100 rounded-3xl flex items-center justify-center mb-6">
                <ClipboardList className="w-10 h-10 text-teal-600" />
              </div>
              <h2 className="text-xl font-bold text-zinc-800 mb-2">Selecciona una plantilla</h2>
              <p className="text-sm text-zinc-500 max-w-sm">
                Elige una plantilla de la lista lateral o crea una nueva para empezar a diseÃ±ar tu formulario.
              </p>
            </div>
          ) : (
            /* â”€â”€ Editor activo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
            <div className="max-w-3xl mx-auto space-y-6">
              {/* â”€â”€ CABECERA DE LA PLANTILLA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {editandoNombre ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={nombrePlantilla}
                          onChange={e => setNombrePlantilla(e.target.value)}
                          className="w-full px-3 py-2 border border-teal-300 rounded-xl text-sm font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-teal-500/20 bg-teal-50/30"
                          autoFocus
                          placeholder="Nombre de la plantilla"
                        />
                        <input
                          type="text"
                          value={descripcionPlantilla}
                          onChange={e => setDescripcionPlantilla(e.target.value)}
                          className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-600 outline-none focus:border-teal-500"
                          placeholder="DescripciÃ³n (opcional)"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleGuardarNombre}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditandoNombre(false)}
                            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-xs font-bold transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-lg font-bold text-zinc-900 truncate">{nombrePlantilla}</h2>
                        {descripcionPlantilla && (
                          <p className="text-xs text-zinc-500 mt-0.5">{descripcionPlantilla}</p>
                        )}
                        <p className="text-[10px] text-zinc-400 mt-1.5">
                          {items.length} {items.length === 1 ? 'pregunta' : 'preguntas'}
                        </p>
                      </>
                    )}
                  </div>
                  {!editandoNombre && (
                    <button
                      onClick={() => setEditandoNombre(true)}
                      className="p-2 text-zinc-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all shrink-0"
                      title="Editar nombre"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* â”€â”€ BARRA DE ACCIONES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> AÃ±adir pregunta
                </button>

                <button
                  onClick={handleCrearTabla}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Table className="w-3.5 h-3.5" /> Crear tabla
                </button>

                <button
                  onClick={handleCrearGrafico}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Crear GrÃ¡fico Q-H
                </button>

                <div className="flex-1" />

                <button
                  onClick={handleGuardarTodo}
                  disabled={guardando}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {guardando ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {guardando ? 'Guardando...' : 'Guardar Plantilla'}
                </button>

                {/* Mensaje flotante */}
                {mensaje && (
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg animate-in fade-in slide-in-from-top-2 ${
                    mensaje.tipo === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {mensaje.texto}
                  </span>
                )}
              </div>

              {/* â”€â”€ LISTA DE ITEMS (EDITOR) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
                {/* Cabecera del editor */}
                <div className="px-5 py-3 bg-gradient-to-r from-teal-600 to-teal-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-white" />
                    <p className="text-xs font-bold text-white uppercase tracking-wider">Preguntas del formulario</p>
                  </div>
                  <span className="text-[10px] font-bold text-teal-100 bg-white/20 px-2 py-0.5 rounded-lg">
                    {items.length} items
                  </span>
                </div>

                {/* Cuerpo: items editables */}
                <div className="p-4 sm:p-5">
                  {items.length === 0 ? (
                    <div className="text-center py-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                      <ClipboardList className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                      <p className="text-sm text-zinc-400 font-medium mb-1">No hay preguntas en esta plantilla</p>
                      <p className="text-xs text-zinc-300 mb-4">AÃ±ade tu primera pregunta para empezar</p>
                      <button
                        onClick={handleAddItem}
                        className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" /> Crear primera pregunta
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div key={item.id} className="flex flex-col gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200 hover:border-teal-200 hover:bg-teal-50/30 transition-all group">
                          <div className="flex items-center gap-2">
                            {/* â”€â”€ Controles de orden â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              onClick={() => handleMoverItem(idx, 'up')}
                              disabled={idx === 0}
                              className="p-0.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              title="Subir"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoverItem(idx, 'down')}
                              disabled={idx === items.length - 1}
                              className="p-0.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              title="Bajar"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>

                          {/* â”€â”€ NÃºmero de orden â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                          <span className="text-[10px] font-bold text-zinc-400 w-5 text-center shrink-0">
                            {idx + 1}
                          </span>

                          {/* â”€â”€ Grip (indicador visual de arrastre) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                          <GripVertical className="w-3 h-3 text-zinc-300 shrink-0" />

                          {/* â”€â”€ Campo de texto editable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                          <input
                            type="text"
                            value={item.label}
                            onChange={e => handleUpdateItem(item.id, { label: e.target.value })}
                            className="flex-1 min-w-0 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                            placeholder="Escribe la pregunta..."
                          />

                          {/* â”€â”€ Selector de tipo de respuesta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                          <select
                            value={item.tipoRespuesta}
                            onChange={e => {
                              const nuevoTipo = e.target.value as TipoRespuestaChecklist;
                              const cambios: any = { tipoRespuesta: nuevoTipo };
                              if (nuevoTipo === 'seleccion' && (!item.opciones || item.opciones.length === 0)) {
                                cambios.opciones = ['SÃ­', 'No', 'N/A'];
                              }
                              handleUpdateItem(item.id, cambios);
                            }}
                            className="text-[10px] bg-white border border-zinc-200 rounded-lg px-2 py-2 outline-none focus:border-teal-500 text-zinc-600 font-medium cursor-pointer hover:border-zinc-300 transition-colors"
                          >
                            <option value="check">âœ“ Check</option>
                            <option value="texto">Aa Texto</option>
                            <option value="texto-largo">ðŸ“„ Texto Largo</option>
                            <option value="numero"># NÃºmero</option>
                            <option value="fecha">ðŸ“… Fecha</option>
                            <option value="imagen">ðŸ–¼ï¸ Imagen</option>
                            <option value="desplegable">ðŸ”½ Desplegable</option>
                            <option value="seleccion">ðŸ”˜ SelecciÃ³n (Botones)</option>
                            <option value="tabla">ðŸ“Š Tabla</option>
                            <option value="grafico">ðŸ“ˆ GrÃ¡fico Q-H</option>
                            <option value="seccion">ðŸ“ SecciÃ³n / Separador</option>
                          </select>

                          {/* â”€â”€ Badge del tipo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                          <TipoBadge tipo={item.tipoRespuesta} />

                          {/* â”€â”€ Badge de valor predeterminado si existe â”€â”€â”€â”€â”€ */}
                          {item.valorPredeterminado && (
                            <span 
                              className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 max-w-[140px] truncate" 
                              title={`Valor por defecto: ${item.valorPredeterminado}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                              <span className="truncate">Def: {item.valorPredeterminado}</span>
                            </span>
                          )}

                          {/* â”€â”€ Checkbox horizontal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                          <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer shrink-0 hover:text-zinc-700 transition-colors" title="Horizontal: pregunta a la izquierda, campo a la derecha">
                            <input
                              type="checkbox"
                              checked={item.horizontal === true}
                              onChange={e => handleUpdateItem(item.id, { horizontal: e.target.checked })}
                              className="w-3.5 h-3.5 rounded cursor-pointer text-indigo-600 border-zinc-300 focus:ring-indigo-500"
                            />
                            <span className="hidden sm:inline">â†”ï¸</span>
                          </label>

                          {/* â”€â”€ Checkbox requerido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                          <label className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer shrink-0 hover:text-zinc-700 transition-colors" title="Requerido">
                            <input
                              type="checkbox"
                              checked={item.requerido}
                              onChange={e => handleUpdateItem(item.id, { requerido: e.target.checked })}
                              className="w-3.5 h-3.5 rounded cursor-pointer text-teal-600 border-zinc-300 focus:ring-teal-500"
                            />
                            <span className="hidden sm:inline">Req</span>
                          </label>

                          {/* â”€â”€ BotÃ³n copiar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                          <button
                            onClick={() => handleCopyItem(idx)}
                            className="p-1.5 text-zinc-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all shrink-0"
                            title="Duplicar pregunta"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* â”€â”€ BotÃ³n eliminar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0"
                            title="Eliminar pregunta"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          </div>
                          
                          {/* â”€â”€ Editor de opciones para desplegable y selecciÃ³n â”€â”€ */}
                          {(item.tipoRespuesta === 'desplegable' || item.tipoRespuesta === 'seleccion') && (
                            <div className="pl-14 pr-2 space-y-2">
                              <div>
                                <label className="text-[10px] font-semibold text-zinc-500 mb-1 block">
                                  {item.tipoRespuesta === 'seleccion' ? 'Opciones de selecciÃ³n (separadas por comas)' : 'Opciones del desplegable (separadas por comas)'}
                                </label>
                                <OpcionesInput 
                                  opciones={item.opciones || []} 
                                  onUpdate={(opts) => handleUpdateItem(item.id, { opciones: opts })} 
                                />
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <span className="text-[10px] font-bold text-zinc-600">â­ Valor predeterminado:</span>
                                <select
                                  value={item.valorPredeterminado || ''}
                                  onChange={(e) => handleUpdateItem(item.id, { valorPredeterminado: e.target.value })}
                                  className="text-xs bg-white border border-zinc-200 rounded-md px-2.5 py-1 outline-none focus:border-teal-500 text-zinc-700 font-medium cursor-pointer hover:border-zinc-300 transition-colors shadow-sm"
                                >
                                  <option value="">-- Sin predeterminado (en blanco) --</option>
                                  {(item.opciones || []).map((op, oIdx) => (
                                    <option key={oIdx} value={op}>{op}</option>
                                  ))}
                                </select>
                                {item.valorPredeterminado && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItem(item.id, { valorPredeterminado: '' })}
                                    className="text-[10px] text-zinc-400 hover:text-red-500 underline transition-colors"
                                    title="Quitar valor predeterminado"
                                  >
                                    Quitar
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {item.tipoRespuesta === 'check' && (
                            <div className="pl-14 pr-2 pt-1 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-zinc-600">â­ Valor predeterminado:</span>
                              <select
                                value={item.valorPredeterminado || ''}
                                onChange={(e) => handleUpdateItem(item.id, { valorPredeterminado: e.target.value })}
                                className="text-xs bg-white border border-zinc-200 rounded-md px-2.5 py-1 outline-none focus:border-teal-500 text-zinc-700 font-medium cursor-pointer hover:border-zinc-300 transition-colors shadow-sm"
                              >
                                <option value="">-- Sin predeterminado (VacÃ­o) --</option>
                                <option value="CORRECTO">âœ“ Marcado (CORRECTO)</option>
                                <option value="NO CORRECTO">âœ— Desmarcado / Incorrecto</option>
                              </select>
                              {item.valorPredeterminado && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(item.id, { valorPredeterminado: '' })}
                                  className="text-[10px] text-zinc-400 hover:text-red-500 underline transition-colors"
                                  title="Quitar valor predeterminado"
                                >
                                  Quitar
                                </button>
                              )}
                            </div>
                          )}

                          {(item.tipoRespuesta === 'texto' || item.tipoRespuesta === 'texto-largo') && (
                            <div className="pl-14 pr-2 pt-1 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-zinc-600">â­ Texto predeterminado:</span>
                              <input
                                type="text"
                                value={item.valorPredeterminado || ''}
                                onChange={(e) => handleUpdateItem(item.id, { valorPredeterminado: e.target.value })}
                                placeholder="Escribe el texto por defecto (ej. N/A)..."
                                className="flex-1 max-w-sm px-2.5 py-1 bg-white border border-zinc-200 rounded-md text-xs outline-none focus:border-teal-500 shadow-sm"
                              />
                              {item.valorPredeterminado && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(item.id, { valorPredeterminado: '' })}
                                  className="text-[10px] text-zinc-400 hover:text-red-500 underline transition-colors"
                                >
                                  Quitar
                                </button>
                              )}
                            </div>
                          )}

                          {item.tipoRespuesta === 'numero' && (
                            <div className="pl-14 pr-2 pt-1 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-zinc-600">â­ NÃºmero predeterminado:</span>
                              <input
                                type="number"
                                value={item.valorPredeterminado || ''}
                                onChange={(e) => handleUpdateItem(item.id, { valorPredeterminado: e.target.value })}
                                placeholder="Ej: 0"
                                className="w-28 px-2.5 py-1 bg-white border border-zinc-200 rounded-md text-xs outline-none focus:border-teal-500 shadow-sm"
                              />
                              {item.valorPredeterminado && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(item.id, { valorPredeterminado: '' })}
                                  className="text-[10px] text-zinc-400 hover:text-red-500 underline transition-colors"
                                >
                                  Quitar
                                </button>
                              )}
                            </div>
                          )}

                          {item.tipoRespuesta === 'fecha' && (
                            <div className="pl-14 pr-2 pt-1 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-zinc-600">â­ Fecha predeterminada:</span>
                              <select
                                value={item.valorPredeterminado || ''}
                                onChange={(e) => handleUpdateItem(item.id, { valorPredeterminado: e.target.value })}
                                className="text-xs bg-white border border-zinc-200 rounded-md px-2.5 py-1 outline-none focus:border-teal-500 text-zinc-700 font-medium cursor-pointer hover:border-zinc-300 transition-colors shadow-sm"
                              >
                                <option value="">-- Sin predeterminado --</option>
                                <option value="HOY">ðŸ“… Fecha de la revisiÃ³n (Hoy)</option>
                              </select>
                              {item.valorPredeterminado && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(item.id, { valorPredeterminado: '' })}
                                  className="text-[10px] text-zinc-400 hover:text-red-500 underline transition-colors"
                                >
                                  Quitar
                                </button>
                              )}
                            </div>
                          )}

                          {(item.tipoRespuesta === 'tabla' || item.tipoRespuesta === 'grafico') && (
                            <div className="pl-14 pr-2 space-y-2">
                              <div>
                                <label className="text-[10px] font-semibold text-zinc-500 mb-1 block">
                                  {item.tipoRespuesta === 'grafico' ? 'Cabeceras de la tabla del GrÃ¡fico (ej: Caudal (mÂ³/h), PresiÃ³n (bar))' : 'Cabeceras de la tabla (separadas por comas)'}
                                </label>
                                <OpcionesInput 
                                  opciones={item.opciones || []} 
                                  onUpdate={(opts) => handleUpdateItem(item.id, { opciones: opts })} 
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-zinc-500 mb-1 block">Cabeceras verticales / Filas predefinidas (separadas por comas, opcional)</label>
                                <OpcionesInput 
                                  opciones={item.filasNombres || []} 
                                  onUpdate={(opts) => handleUpdateItem(item.id, { filasNombres: opts })} 
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] font-semibold text-zinc-500">Filas Iniciales (si no hay predefinidas):</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={item.filasInicio || 4}
                                  onChange={(e) => handleUpdateItem(item.id, { filasInicio: Math.max(1, parseInt(e.target.value) || 1) })}
                                  className="w-16 px-2 py-1 bg-white border border-zinc-200 rounded-md text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer con resumen */}
                {items.length > 0 && (
                  <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                    <p className="text-[10px] text-zinc-400">
                      {items.filter(i => i.tipoRespuesta === 'check').length} check Â·
                      {' '}{items.filter(i => i.tipoRespuesta === 'texto').length} texto Â·
                      {' '}{items.filter(i => i.tipoRespuesta === 'texto-largo').length} texto largo Â·
                      {' '}{items.filter(i => i.tipoRespuesta === 'numero').length} nÃºmero Â·
                      {' '}{items.filter(i => i.tipoRespuesta === 'fecha').length} fecha Â·
                      {' '}{items.filter(i => i.tipoRespuesta === 'imagen').length} imagen Â·
                      {' '}{items.filter(i => i.horizontal).length} horizontal
                    </p>
                    <p className="text-[10px] text-zinc-400 italic">
                      {items.filter(i => i.requerido).length} requeridos Â· Total: {items.length}
                    </p>
                  </div>
                )}
              </div>

              {/* â”€â”€ BOTÃ“N GUARDAR INFERIOR (ENTRE EDITOR Y VISTA PREVIA) â”€â”€ */}
              {items.length > 0 && (
                <div className="flex items-center justify-end gap-3 pr-2">
                  {mensaje && (
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg animate-in fade-in slide-in-from-top-2 ${
                      mensaje.tipo === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {mensaje.texto}
                    </span>
                  )}
                  <button
                    onClick={handleGuardarTodo}
                    disabled={guardando}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    {guardando ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {guardando ? 'Guardando...' : 'Guardar Plantilla'}
                  </button>
                </div>
              )}

              {/* â”€â”€ VISTA PREVIA EN TIEMPO REAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              {items.length > 0 && (
                <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
                  <div className="px-5 py-3 bg-gradient-to-r from-zinc-700 to-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-zinc-300" />
                      <p className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Vista previa del formulario</p>
                    </div>
                    <span className="text-[9px] text-zinc-400">En tiempo real</span>
                  </div>
                  <div className="p-5">
                    <div className="mb-4 pb-3 border-b border-zinc-100">
                      <p className="text-sm font-bold text-zinc-800">{nombrePlantilla}</p>
                      {descripcionPlantilla && (
                        <p className="text-[10px] text-zinc-500 mt-0.5">{descripcionPlantilla}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {items.map((item, idx) => {
                        const isSeccion = item.tipoRespuesta === 'seccion';
                        const isHorizontal = item.horizontal === true;
                        const isFullWidth = isSeccion || isHorizontal || item.tipoRespuesta === 'tabla';
                        return (
                          <div key={item.id} className={`flex items-start gap-2 ${isFullWidth ? 'col-span-full mt-2' : ''}`}>
                            {!isFullWidth && (
                              <span className="text-[9px] font-bold text-zinc-400 mt-1.5 w-4 shrink-0">{idx + 1}.</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <VistaPreviaCampo item={item} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="px-5 py-2.5 bg-zinc-50 border-t border-zinc-100">
                    <p className="text-[9px] text-zinc-400 italic">
                      AsÃ­ se verÃ¡ el formulario durante la revisiÃ³n. Los cambios se reflejan automÃ¡ticamente.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* â”€â”€ MODAL: CONFIGURAR TABLA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {modalTablaOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider">Configurar Nueva Tabla</h3>
              <button onClick={() => setModalTablaOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Nombre de la tabla</label>
                <input
                  type="text"
                  value={tablaNombre}
                  onChange={(e) => setTablaNombre(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  placeholder="Ej: Equipos del Sistema"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Columnas</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={tablaColumnas}
                    onChange={(e) => setTablaColumnas(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Filas Iniciales</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={tablaFilas}
                    onChange={(e) => setTablaFilas(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setModalTablaOpen(false)}
                className="px-3.5 py-2 bg-white hover:bg-zinc-50 text-zinc-600 border border-zinc-200 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearTablaConfirm}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
