/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANTILLAS DE CHECKLIST - Tipos TypeScript y estructura Firestore
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Estructura en Firestore:
 *
 *   /plantillas/{plantillaId}          ← Documento que representa un tipo de sistema
 *       ├── id: string                 ← ID del documento
 *       ├── nombre: string             ← Nombre del sistema (ej: "SISTEMA EXTINTORES")
 *       ├── descripcion?: string       ← Descripción opcional
 *       ├── activa: boolean            ← Si la plantilla está activa
 *       ├── createdAt: string          ← Fecha de creación (ISO)
 *       ├── updatedAt: string          ← Fecha de última modificación (ISO)
 *       │
 *       └── /items/{itemId}            ← Subcolección con los ítems del checklist
 *               ├── id: string         ← ID del documento
 *               ├── plantillaId: string ← ID de la plantilla padre
 *               ├── label: string      ← Texto de la pregunta/paso
 *               ├── key: string        ← Clave única (ej: "checkAcceso")
 *               ├── orden: number      ← Orden de aparición
 *               ├── tipoRespuesta: 'check' | 'texto' | 'numero' | 'fecha'
 *               ├── requerido: boolean ← Si es obligatorio
 *               ├── horizontal: boolean ← Si se muestra en línea horizontal
 *               ├── createdAt: string
 *               └── updatedAt: string
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

// ─── TIPOS ───────────────────────────────────────────────────────────────────

export type TipoRespuestaChecklist = 'check' | 'texto' | 'texto-largo' | 'numero' | 'fecha' | 'imagen' | 'desplegable' | 'seccion' | 'tabla' | 'seleccion' | 'grafico';

/** Ítem individual dentro de una plantilla de checklist */
export interface ItemPlantilla {
  id: string;
  plantillaId: string;
  label: string;
  key: string;
  orden: number;
  tipoRespuesta: TipoRespuestaChecklist;
  requerido: boolean;
  opciones?: string[]; // Para tipo 'desplegable' y 'tabla' (cabeceras de columna)
  filasInicio?: number; // Cantidad inicial de filas para 'tabla'
  filasNombres?: string[]; // Nombres de las filas (cabecera vertical para tablas, opcional)
  horizontal?: boolean; // Si es true, se muestra en línea horizontal (label + campo)
  valorPredeterminado?: string; // Valor por defecto / predeterminado (ej: 'N/A', 'CORRECTO', etc.)
  createdAt?: string;
  updatedAt?: string;
}

/** Datos para crear/actualizar un ítem (sin id) */
export type ItemPlantillaInput = Omit<ItemPlantilla, 'id' | 'createdAt' | 'updatedAt'>;

/** Plantilla de checklist (documento principal) */
export interface Plantilla {
  id: string;
  codigo?: string; // Código/número del sistema (ej: "S01", "S02")
  nombre: string;
  descripcion?: string;
  imagenUrl?: string;
  activa: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Datos para crear/actualizar una plantilla (sin id) */
export type PlantillaInput = Omit<Plantilla, 'id' | 'createdAt' | 'updatedAt'>;

/** Plantilla con sus ítems cargados */
export interface PlantillaConItems extends Plantilla {
  items: ItemPlantilla[];
}

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

export const COLECCION_PLANTILLAS = 'plantillas';
export const COLECCION_OTRAS_PLANTILLAS = 'otras_plantillas';
const SUBCOLECCION_ITEMS = 'items';

// ─── FUNCIONES CRUD: PLANTILLAS ──────────────────────────────────────────────

/**
 * Obtiene todas las plantillas activas.
 */
export async function getPlantillas(coleccionNom: string = COLECCION_PLANTILLAS): Promise<Plantilla[]> {
  try {
    const col = collection(db, coleccionNom);
    const q = query(col, orderBy('nombre', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        codigo: data.codigo || '',
        nombre: data.nombre || '',
        descripcion: data.descripcion || '',
        imagenUrl: data.imagenUrl || '',
        activa: data.activa !== false,
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || '',
      } as Plantilla;
    });
  } catch (e) {
    console.error(`getPlantillas(${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Obtiene una plantilla por su ID.
 */
export async function getPlantilla(id: string, coleccionNom: string = COLECCION_PLANTILLAS): Promise<Plantilla | null> {
  try {
    const ref = doc(db, coleccionNom, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return {
      id: snap.id,
      codigo: data.codigo || '',
      nombre: data.nombre || '',
      descripcion: data.descripcion || '',
      imagenUrl: data.imagenUrl || '',
      activa: data.activa !== false,
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
    } as Plantilla;
  } catch (e) {
    console.error(`getPlantilla(${id}, ${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Crea una nueva plantilla.
 * @returns La plantilla creada con su ID.
 */
export async function addPlantilla(input: PlantillaInput, coleccionNom: string = COLECCION_PLANTILLAS): Promise<Plantilla> {
  try {
    const col = collection(db, coleccionNom);
    const data = {
      ...input,
      activa: input.activa !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ref = await addDoc(col, data);
    return { id: ref.id, ...data };
  } catch (e) {
    console.error(`addPlantilla(${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Actualiza una plantilla existente.
 */
export async function updatePlantilla(id: string, input: Partial<PlantillaInput>, coleccionNom: string = COLECCION_PLANTILLAS): Promise<void> {
  try {
    const ref = doc(db, coleccionNom, id);
    await updateDoc(ref, {
      ...input,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`updatePlantilla(${id}, ${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Elimina una plantilla y todos sus ítems (subcolección).
 */
export async function deletePlantilla(id: string, coleccionNom: string = COLECCION_PLANTILLAS): Promise<void> {
  try {
    // Primero eliminar todos los ítems de la subcolección
    const itemsRef = collection(db, coleccionNom, id, SUBCOLECCION_ITEMS);
    const itemsSnap = await getDocs(itemsRef);

    const batch = writeBatch(db);
    itemsSnap.docs.forEach((docItem) => {
      batch.delete(docItem.ref);
    });
    await batch.commit();

    // Luego eliminar el documento principal
    const ref = doc(db, coleccionNom, id);
    await deleteDoc(ref);
  } catch (e) {
    console.error(`deletePlantilla(${id}, ${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Suscripción en tiempo real a todas las plantillas activas.
 */
export function subscribePlantillas(callback: (plantillas: Plantilla[]) => void, coleccionNom: string = COLECCION_PLANTILLAS): () => void {
  try {
    const col = collection(db, coleccionNom);
    const q = query(col, orderBy('nombre', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            codigo: data.codigo || '',
            nombre: data.nombre || '',
            descripcion: data.descripcion || '',
            imagenUrl: data.imagenUrl || '',
            activa: data.activa !== false,
            createdAt: data.createdAt || '',
            updatedAt: data.updatedAt || '',
          } as Plantilla;
        });
        callback(items);
      },
      (err) => {
        console.error(`subscribePlantillas(${coleccionNom}) error:`, err);
        callback([]);
      }
    );
    return unsub;
  } catch (e) {
    console.error(`subscribePlantillas(${coleccionNom}) error:`, e);
    return () => {};
  }
}

// ─── FUNCIONES CRUD: ITEMS DE PLANTILLA ──────────────────────────────────────

/**
 * Obtiene todos los ítems de una plantilla, ordenados por 'orden'.
 */
export async function getItemsDePlantilla(plantillaId: string, coleccionNom: string = COLECCION_PLANTILLAS): Promise<ItemPlantilla[]> {
  try {
    const col = collection(db, coleccionNom, plantillaId, SUBCOLECCION_ITEMS);
    const q = query(col, orderBy('orden', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        plantillaId,
        label: data.label || '',
        key: data.key || '',
        orden: data.orden || 0,
        tipoRespuesta: data.tipoRespuesta || 'check',
        requerido: data.requerido !== false,
        opciones: data.opciones || [],
        filasInicio: data.filasInicio,
        filasNombres: data.filasNombres || [],
        horizontal: data.horizontal === true,
        valorPredeterminado: data.valorPredeterminado || '',
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || '',
      } as ItemPlantilla;
    });
  } catch (e) {
    console.error(`getItemsDePlantilla(${plantillaId}, ${coleccionNom}) error:`, e);
    throw e;
  }
}

function cleanUndefined<T extends object>(obj: T): T {
  const newObj = { ...obj } as any;
  Object.keys(newObj).forEach((key) => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
}

/**
 * Añade un ítem a una plantilla.
 */
export async function addItemAPlantilla(input: ItemPlantillaInput, coleccionNom: string = COLECCION_PLANTILLAS): Promise<ItemPlantilla> {
  try {
    const col = collection(db, coleccionNom, input.plantillaId, SUBCOLECCION_ITEMS);
    const data = cleanUndefined({
      ...input,
      requerido: input.requerido !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const ref = await addDoc(col, data);
    return { id: ref.id, ...data };
  } catch (e) {
    console.error(`addItemAPlantilla(${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Actualiza un ítem existente.
 */
export async function updateItemDePlantilla(
  plantillaId: string,
  itemId: string,
  input: Partial<ItemPlantillaInput>,
  coleccionNom: string = COLECCION_PLANTILLAS
): Promise<void> {
  try {
    const ref = doc(db, coleccionNom, plantillaId, SUBCOLECCION_ITEMS, itemId);
    await updateDoc(ref, cleanUndefined({
      ...input,
      updatedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.error(`updateItemDePlantilla(${itemId}, ${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Elimina un ítem de una plantilla.
 */
export async function deleteItemDePlantilla(plantillaId: string, itemId: string, coleccionNom: string = COLECCION_PLANTILLAS): Promise<void> {
  try {
    const ref = doc(db, coleccionNom, plantillaId, SUBCOLECCION_ITEMS, itemId);
    await deleteDoc(ref);
  } catch (e) {
    console.error(`deleteItemDePlantilla(${itemId}, ${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Suscripción en tiempo real a los ítems de una plantilla.
 */
export function subscribeItemsDePlantilla(
  plantillaId: string,
  callback: (items: ItemPlantilla[]) => void,
  coleccionNom: string = COLECCION_PLANTILLAS
): () => void {
  try {
    const col = collection(db, coleccionNom, plantillaId, SUBCOLECCION_ITEMS);
    const q = query(col, orderBy('orden', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            plantillaId,
            label: data.label || '',
            key: data.key || '',
            orden: data.orden || 0,
            tipoRespuesta: data.tipoRespuesta || 'check',
            requerido: data.requerido !== false,
            opciones: data.opciones || [],
            filasInicio: data.filasInicio,
            filasNombres: data.filasNombres || [],
            horizontal: data.horizontal === true,
            valorPredeterminado: data.valorPredeterminado || '',
            createdAt: data.createdAt || '',
            updatedAt: data.updatedAt || '',
          } as ItemPlantilla;
        });
        callback(items);
      },
      (err) => {
        console.error(`subscribeItemsDePlantilla(${plantillaId}, ${coleccionNom}) error:`, err);
        callback([]);
      }
    );
    return unsub;
  } catch (e) {
    console.error(`subscribeItemsDePlantilla(${plantillaId}, ${coleccionNom}) error:`, e);
    return () => {};
  }
}

/**
 * Obtiene una plantilla completa con todos sus ítems.
 */
export async function getPlantillaConItems(plantillaId: string, coleccionNom: string = COLECCION_PLANTILLAS): Promise<PlantillaConItems | null> {
  try {
    const plantilla = await getPlantilla(plantillaId, coleccionNom);
    if (!plantilla) return null;
    const items = await getItemsDePlantilla(plantillaId, coleccionNom);
    return { ...plantilla, items };
  } catch (e) {
    console.error(`getPlantillaConItems(${plantillaId}, ${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Guarda una plantilla completa con sus ítems en una sola operación.
 * Si la plantilla ya existe, la actualiza; si no, la crea.
 * Los ítems se reemplazan completamente (se eliminan los existentes y se crean los nuevos).
 */
export async function savePlantillaConItems(
  plantillaInput: PlantillaInput,
  itemsInput: ItemPlantillaInput[],
  coleccionNom: string = COLECCION_PLANTILLAS
): Promise<PlantillaConItems> {
  try {
    // 1. Crear o actualizar la plantilla
    const col = collection(db, coleccionNom);
    const plantillaData = {
      ...plantillaInput,
      activa: plantillaInput.activa !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ref = await addDoc(col, plantillaData);
    const plantillaId = ref.id;

    // 2. Crear todos los ítems
    const itemsCol = collection(db, coleccionNom, plantillaId, SUBCOLECCION_ITEMS);
    const itemsPromises = itemsInput.map((item, index) => {
      const itemData = {
        ...item,
        plantillaId,
        orden: item.orden ?? index + 1,
        requerido: item.requerido !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return addDoc(itemsCol, itemData);
    });

    const itemRefs = await Promise.all(itemsPromises);
    const items: ItemPlantilla[] = itemRefs.map((itemRef, index) => ({
      id: itemRef.id,
      ...itemsInput[index],
      plantillaId,
      orden: itemsInput[index].orden ?? index + 1,
      requerido: itemsInput[index].requerido !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    return {
      id: plantillaId,
      ...plantillaInput,
      activa: plantillaInput.activa !== false,
      items,
    };
  } catch (e) {
    console.error(`savePlantillaConItems(${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Reemplaza todos los ítems de una plantilla por una nueva lista.
 * Útil para reordenar o actualizar masivamente.
 */
export async function reemplazarItemsDePlantilla(
  plantillaId: string,
  nuevosItems: ItemPlantillaInput[],
  coleccionNom: string = COLECCION_PLANTILLAS
): Promise<ItemPlantilla[]> {
  try {
    const batch = writeBatch(db);

    // 1. Eliminar todos los ítems existentes
    const itemsCol = collection(db, coleccionNom, plantillaId, SUBCOLECCION_ITEMS);
    const existingSnap = await getDocs(itemsCol);
    existingSnap.docs.forEach((docItem) => {
      batch.delete(docItem.ref);
    });

    // 2. Crear los nuevos ítems
    const createdItems: ItemPlantilla[] = [];
    for (let i = 0; i < nuevosItems.length; i++) {
      const item = nuevosItems[i];
      const itemRef = doc(itemsCol);
      const itemData = cleanUndefined({
        label: item.label,
        key: item.key,
        plantillaId,
        orden: item.orden ?? i + 1,
        tipoRespuesta: item.tipoRespuesta || 'check',
        requerido: item.requerido !== false,
        opciones: item.opciones || [],
        filasInicio: item.filasInicio,
        filasNombres: item.filasNombres || [],
        horizontal: item.horizontal === true,
        valorPredeterminado: item.valorPredeterminado || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      batch.set(itemRef, itemData);
      createdItems.push({ id: itemRef.id, ...itemData });
    }

    await batch.commit();
    return createdItems;
  } catch (e) {
    console.error(`reemplazarItemsDePlantilla(${coleccionNom}) error:`, e);
    throw e;
  }
}

// ─── DATOS INICIALES ─────────────────────────────────────────────────────────

/**
 * Plantillas por defecto para los sistemas más comunes.
 * Se pueden usar para poblar la base de datos inicial.
 */
export const PLANTILLAS_POR_DEFECTO: Array<{
  plantilla: PlantillaInput;
  items: ItemPlantillaInput[];
}> = [
  {
    plantilla: {
      nombre: 'SISTEMA EXTINTORES',
      descripcion: 'Checklist para revisión de extintores portátiles',
      activa: true,
    },
    items: [
      { plantillaId: '', label: 'Acceso', key: 'checkAcceso', orden: 1, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Altura', key: 'checkAltura', orden: 2, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Soporte', key: 'checkSoporte', orden: 3, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Señalización', key: 'checkSenalizacion', orden: 4, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Manguera', key: 'checkManguera', orden: 5, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Peso', key: 'checkPeso', orden: 6, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Presión', key: 'checkPresion', orden: 7, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Manómetro', key: 'checkManometro', orden: 8, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Marcado CE', key: 'checkMarcado', orden: 9, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Etiquetas de uso', key: 'checkEtiquetas', orden: 10, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Etiqueta de retimbrado', key: 'checkRetimbre', orden: 11, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Adecuado para su riesgo', key: 'checkRiesgo', orden: 12, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Distancia a otro <15 m.', key: 'checkDistancia', orden: 13, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Pasador y precinto', key: 'checkPasador', orden: 14, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Movilidad (si es carro)', key: 'checkMovilidad', orden: 15, tipoRespuesta: 'check', requerido: true },
    ],
  },
  {
    plantilla: {
      nombre: 'SISTEMA BIES',
      descripcion: 'Checklist para revisión de Bocas de Incendio Equipadas (BIES)',
      activa: true,
    },
    items: [
      { plantillaId: '', label: 'Acceso', key: 'checkAcceso', orden: 1, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Señalización', key: 'checkSenalizacion', orden: 2, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Soporte', key: 'checkSoporte', orden: 3, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Puerta y/o cristal', key: 'item_1790629281657', orden: 4, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Manguera', key: 'checkManguera', orden: 5, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Presión', key: 'checkPresion', orden: 6, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Manómetro', key: 'checkManometro', orden: 7, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Longitud', key: 'checkLongitud', orden: 8, tipoRespuesta: 'numero', requerido: true },
      { plantillaId: '', label: 'Prueba hidráulica', key: 'checkPruebaHidraulica', orden: 9, tipoRespuesta: 'texto', requerido: false },
    ],
  },
  {
    plantilla: {
      nombre: 'SISTEMA DETECCION AUTOMATICA',
      descripcion: 'Checklist para revisión de sistemas de detección automática de incendios',
      activa: true,
    },
    items: [
      { plantillaId: '', label: 'Acceso a detectores', key: 'checkAcceso', orden: 1, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Altura de instalación', key: 'checkAltura', orden: 2, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Señalización central', key: 'checkSenalizacion', orden: 3, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Estado de detectores', key: 'checkEstado', orden: 4, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Funcionamiento central', key: 'checkFuncionamiento', orden: 5, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Batería de respaldo', key: 'checkBateria', orden: 6, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Sirenas y señalización acústica', key: 'checkSirenas', orden: 7, tipoRespuesta: 'check', requerido: true },
    ],
  },
  {
    plantilla: {
      nombre: 'SISTEMA HIDRANTES',
      descripcion: 'Checklist para revisión de hidrantes exteriores',
      activa: true,
    },
    items: [
      { plantillaId: '', label: 'Acceso', key: 'checkAcceso', orden: 1, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Señalización', key: 'checkSenalizacion', orden: 2, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Presión', key: 'checkPresion', orden: 3, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Caudal', key: 'checkCaudal', orden: 4, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Conexiones', key: 'checkConexiones', orden: 5, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Fugas', key: 'checkFugas', orden: 6, tipoRespuesta: 'check', requerido: true },
    ],
  },
  {
    plantilla: {
      nombre: 'SISTEMA ROCIADORES',
      descripcion: 'Checklist para revisión de sistemas automáticos de rociadores (sprinklers)',
      activa: true,
    },
    items: [
      { plantillaId: '', label: 'Acceso a rociadores', key: 'checkAcceso', orden: 1, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Altura libre', key: 'checkAltura', orden: 2, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Presión de trabajo', key: 'checkPresion', orden: 3, tipoRespuesta: 'numero', requerido: true },
      { plantillaId: '', label: 'Cobertura', key: 'checkCobertura', orden: 4, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Válvulas de seccionamiento', key: 'checkValvulas', orden: 5, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Alarma de flujo', key: 'checkAlarma', orden: 6, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Grupo de bombeo', key: 'checkBombeo', orden: 7, tipoRespuesta: 'check', requerido: true },
    ],
  },
];

/**
 * Plantillas por defecto para Otras Plantillas (Vehículos, taller, equipos auxiliares)
 */
export const OTRAS_PLANTILLAS_POR_DEFECTO: Array<{
  plantilla: PlantillaInput;
  items: ItemPlantillaInput[];
}> = [
  {
    plantilla: {
      codigo: 'V01',
      nombre: 'REVISIÓN DE VEHÍCULOS / FURGONETAS',
      descripcion: 'Control periódico y estado del vehículo de empresa',
      activa: true,
    },
    items: [
      { plantillaId: '', label: 'Kilometraje actual del vehículo', key: 'kmActual', orden: 1, tipoRespuesta: 'numero', requerido: true },
      { plantillaId: '', label: 'Nivel de aceite de motor', key: 'nivelAceite', orden: 2, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Nivel de líquido refrigerante', key: 'nivelRefrigerante', orden: 3, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Nivel líquido de frenos', key: 'liquidoFrenos', orden: 4, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Presión y dibujo de neumáticos', key: 'neumaticos', orden: 5, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Luces delanteras, traseras e intermitentes', key: 'luces', orden: 6, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Limpiaparabrisas y líquido lavaparabrisas', key: 'limpiaparabrisas', orden: 7, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Documentación obligatoria e ITV al día', key: 'documentacion', orden: 8, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Extintor, triángulos / señal V16 y chaleco', key: 'seguridad', orden: 9, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Kit de herramientas y rueda de repuesto', key: 'herramientas', orden: 10, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Observaciones / Daños de chapa o incidencias', key: 'observacionesVehiculo', orden: 11, tipoRespuesta: 'texto-largo', requerido: false },
    ],
  },
  {
    plantilla: {
      codigo: 'T01',
      nombre: 'REVISIÓN DE TALLER Y MAQUINARIA',
      descripcion: 'Checklist de orden, seguridad y maquinaria en taller',
      activa: true,
    },
    items: [
      { plantillaId: '', label: 'Orden y limpieza general del puesto', key: 'ordenTaller', orden: 1, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Estado de herramientas manuales', key: 'herramientasManuales', orden: 2, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Maquinaria eléctrica, enchufes y cables', key: 'maquinariaElectrica', orden: 3, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Compresor de aire y manómetros', key: 'compresor', orden: 4, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'EPIs disponibles y en buen estado', key: 'epis', orden: 5, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Botiquín de primeros auxilios revisado', key: 'botiquin', orden: 6, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Notas de reposición o material defectuoso', key: 'notasTaller', orden: 7, tipoRespuesta: 'texto-largo', requerido: false },
    ],
  },
];

/**
 * Duplica una plantilla existente con todos sus ítems.
 * Crea un nuevo documento con un ID único y copia todos los ítems.
 * @returns La nueva plantilla duplicada.
 */
export async function duplicarPlantilla(plantillaId: string, coleccionNom: string = COLECCION_PLANTILLAS): Promise<Plantilla> {
  try {
    // 1. Obtener la plantilla original
    const original = await getPlantilla(plantillaId, coleccionNom);
    if (!original) throw new Error(`Plantilla ${plantillaId} no encontrada`);

    // 2. Obtener los ítems originales
    const itemsOriginales = await getItemsDePlantilla(plantillaId, coleccionNom);

    // 3. Crear la nueva plantilla con nombre "COPIA - ..."
    const col = collection(db, coleccionNom);
    const nuevaPlantillaData = {
      codigo: original.codigo ? `${original.codigo}-COPIA` : '',
      nombre: `COPIA - ${original.nombre}`,
      descripcion: original.descripcion || '',
      imagenUrl: original.imagenUrl || '',
      activa: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const nuevaRef = await addDoc(col, nuevaPlantillaData);
    const nuevaPlantillaId = nuevaRef.id;

    // 4. Copiar todos los ítems a la nueva plantilla usando batch
    if (itemsOriginales.length > 0) {
      const batch = writeBatch(db);
      const itemsCol = collection(db, coleccionNom, nuevaPlantillaId, SUBCOLECCION_ITEMS);
      itemsOriginales.forEach((item) => {
        const itemRef = doc(itemsCol);
        batch.set(itemRef, cleanUndefined({
          plantillaId: nuevaPlantillaId,
          label: item.label,
          key: item.key,
          orden: item.orden,
          tipoRespuesta: item.tipoRespuesta,
          requerido: item.requerido,
          opciones: item.opciones || [],
          filasInicio: item.filasInicio,
          horizontal: item.horizontal === true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      });
      await batch.commit();
    }

    return { id: nuevaPlantillaId, ...nuevaPlantillaData };
  } catch (e) {
    console.error(`duplicarPlantilla(${coleccionNom}) error:`, e);
    throw e;
  }
}

/**
 * Inicializa las plantillas por defecto en Firestore.
 * Solo crea las que no existan (compara por nombre).
 */
export async function inicializarPlantillasPorDefecto(): Promise<void> {
  try {
    const existentes = await getPlantillas(COLECCION_PLANTILLAS);
    const nombresExistentes = new Set(existentes.map((p) => p.nombre));

    for (const template of PLANTILLAS_POR_DEFECTO) {
      if (nombresExistentes.has(template.plantilla.nombre)) {
        console.log(`Plantilla "${template.plantilla.nombre}" ya existe, se omite.`);
        continue;
      }

      console.log(`Creando plantilla por defecto: "${template.plantilla.nombre}"...`);
      await savePlantillaConItems(template.plantilla, template.items, COLECCION_PLANTILLAS);
    }

    console.log('Plantillas por defecto inicializadas correctamente.');
  } catch (e) {
    console.error('inicializarPlantillasPorDefecto error:', e);
    throw e;
  }
}

/**
 * Inicializa las plantillas por defecto para Otras Plantillas (Vehículos, taller, etc.).
 */
export async function inicializarOtrasPlantillasPorDefecto(): Promise<void> {
  try {
    const existentes = await getPlantillas(COLECCION_OTRAS_PLANTILLAS);
    const nombresExistentes = new Set(existentes.map((p) => p.nombre));

    for (const template of OTRAS_PLANTILLAS_POR_DEFECTO) {
      if (nombresExistentes.has(template.plantilla.nombre)) {
        continue;
      }
      await savePlantillaConItems(template.plantilla, template.items, COLECCION_OTRAS_PLANTILLAS);
    }
  } catch (e) {
    console.error('inicializarOtrasPlantillasPorDefecto error:', e);
    throw e;
  }
}