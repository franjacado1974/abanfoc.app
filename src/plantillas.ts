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

export type TipoRespuestaChecklist = 'check' | 'texto' | 'texto-largo' | 'numero' | 'fecha' | 'imagen' | 'desplegable';

/** Ítem individual dentro de una plantilla de checklist */
export interface ItemPlantilla {
  id: string;
  plantillaId: string;
  label: string;
  key: string;
  orden: number;
  tipoRespuesta: TipoRespuestaChecklist;
  requerido: boolean;
  opciones?: string[]; // Para tipo 'desplegable'
  createdAt?: string;
  updatedAt?: string;
}

/** Datos para crear/actualizar un ítem (sin id) */
export type ItemPlantillaInput = Omit<ItemPlantilla, 'id' | 'createdAt' | 'updatedAt'>;

/** Plantilla de checklist (documento principal) */
export interface Plantilla {
  id: string;
  nombre: string;
  descripcion?: string;
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

const COLECCION_PLANTILLAS = 'plantillas';
const SUBCOLECCION_ITEMS = 'items';

// ─── FUNCIONES CRUD: PLANTILLAS ──────────────────────────────────────────────

/**
 * Obtiene todas las plantillas activas.
 */
export async function getPlantillas(): Promise<Plantilla[]> {
  try {
    const col = collection(db, COLECCION_PLANTILLAS);
    const q = query(col, orderBy('nombre', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        nombre: data.nombre || '',
        descripcion: data.descripcion || '',
        activa: data.activa !== false,
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || '',
      } as Plantilla;
    });
  } catch (e) {
    console.error('getPlantillas error:', e);
    throw e;
  }
}

/**
 * Obtiene una plantilla por su ID.
 */
export async function getPlantilla(id: string): Promise<Plantilla | null> {
  try {
    const ref = doc(db, COLECCION_PLANTILLAS, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return {
      id: snap.id,
      nombre: data.nombre || '',
      descripcion: data.descripcion || '',
      activa: data.activa !== false,
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
    } as Plantilla;
  } catch (e) {
    console.error('getPlantilla error:', e);
    throw e;
  }
}

/**
 * Crea una nueva plantilla.
 * @returns La plantilla creada con su ID.
 */
export async function addPlantilla(input: PlantillaInput): Promise<Plantilla> {
  try {
    const col = collection(db, COLECCION_PLANTILLAS);
    const data = {
      ...input,
      activa: input.activa !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ref = await addDoc(col, data);
    return { id: ref.id, ...data };
  } catch (e) {
    console.error('addPlantilla error:', e);
    throw e;
  }
}

/**
 * Actualiza una plantilla existente.
 */
export async function updatePlantilla(id: string, input: Partial<PlantillaInput>): Promise<void> {
  try {
    const ref = doc(db, COLECCION_PLANTILLAS, id);
    await updateDoc(ref, {
      ...input,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('updatePlantilla error:', e);
    throw e;
  }
}

/**
 * Elimina una plantilla y todos sus ítems (subcolección).
 */
export async function deletePlantilla(id: string): Promise<void> {
  try {
    // Primero eliminar todos los ítems de la subcolección
    const itemsRef = collection(db, COLECCION_PLANTILLAS, id, SUBCOLECCION_ITEMS);
    const itemsSnap = await getDocs(itemsRef);

    const batch = writeBatch(db);
    itemsSnap.docs.forEach((docItem) => {
      batch.delete(docItem.ref);
    });
    await batch.commit();

    // Luego eliminar el documento principal
    const ref = doc(db, COLECCION_PLANTILLAS, id);
    await deleteDoc(ref);
  } catch (e) {
    console.error('deletePlantilla error:', e);
    throw e;
  }
}

/**
 * Suscripción en tiempo real a todas las plantillas activas.
 */
export function subscribePlantillas(callback: (plantillas: Plantilla[]) => void): () => void {
  try {
    const col = collection(db, COLECCION_PLANTILLAS);
    const q = query(col, orderBy('nombre', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            nombre: data.nombre || '',
            descripcion: data.descripcion || '',
            activa: data.activa !== false,
            createdAt: data.createdAt || '',
            updatedAt: data.updatedAt || '',
          } as Plantilla;
        });
        callback(items);
      },
      (err) => {
        console.error('subscribePlantillas error:', err);
        callback([]);
      }
    );
    return unsub;
  } catch (e) {
    console.error('subscribePlantillas error:', e);
    return () => {};
  }
}

// ─── FUNCIONES CRUD: ITEMS DE PLANTILLA ──────────────────────────────────────

/**
 * Obtiene todos los ítems de una plantilla, ordenados por 'orden'.
 */
export async function getItemsDePlantilla(plantillaId: string): Promise<ItemPlantilla[]> {
  try {
    const col = collection(db, COLECCION_PLANTILLAS, plantillaId, SUBCOLECCION_ITEMS);
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
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || '',
      } as ItemPlantilla;
    });
  } catch (e) {
    console.error('getItemsDePlantilla error:', e);
    throw e;
  }
}

/**
 * Añade un ítem a una plantilla.
 */
export async function addItemAPlantilla(input: ItemPlantillaInput): Promise<ItemPlantilla> {
  try {
    const col = collection(db, COLECCION_PLANTILLAS, input.plantillaId, SUBCOLECCION_ITEMS);
    const data = {
      ...input,
      requerido: input.requerido !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ref = await addDoc(col, data);
    return { id: ref.id, ...data };
  } catch (e) {
    console.error('addItemAPlantilla error:', e);
    throw e;
  }
}

/**
 * Actualiza un ítem existente.
 */
export async function updateItemDePlantilla(
  plantillaId: string,
  itemId: string,
  input: Partial<ItemPlantillaInput>
): Promise<void> {
  try {
    const ref = doc(db, COLECCION_PLANTILLAS, plantillaId, SUBCOLECCION_ITEMS, itemId);
    await updateDoc(ref, {
      ...input,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('updateItemDePlantilla error:', e);
    throw e;
  }
}

/**
 * Elimina un ítem de una plantilla.
 */
export async function deleteItemDePlantilla(plantillaId: string, itemId: string): Promise<void> {
  try {
    const ref = doc(db, COLECCION_PLANTILLAS, plantillaId, SUBCOLECCION_ITEMS, itemId);
    await deleteDoc(ref);
  } catch (e) {
    console.error('deleteItemDePlantilla error:', e);
    throw e;
  }
}

/**
 * Suscripción en tiempo real a los ítems de una plantilla.
 */
export function subscribeItemsDePlantilla(
  plantillaId: string,
  callback: (items: ItemPlantilla[]) => void
): () => void {
  try {
    const col = collection(db, COLECCION_PLANTILLAS, plantillaId, SUBCOLECCION_ITEMS);
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
            createdAt: data.createdAt || '',
            updatedAt: data.updatedAt || '',
          } as ItemPlantilla;
        });
        callback(items);
      },
      (err) => {
        console.error(`subscribeItemsDePlantilla(${plantillaId}) error:`, err);
        callback([]);
      }
    );
    return unsub;
  } catch (e) {
    console.error('subscribeItemsDePlantilla error:', e);
    return () => {};
  }
}

/**
 * Obtiene una plantilla completa con todos sus ítems.
 */
export async function getPlantillaConItems(plantillaId: string): Promise<PlantillaConItems | null> {
  try {
    const plantilla = await getPlantilla(plantillaId);
    if (!plantilla) return null;
    const items = await getItemsDePlantilla(plantillaId);
    return { ...plantilla, items };
  } catch (e) {
    console.error('getPlantillaConItems error:', e);
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
  itemsInput: ItemPlantillaInput[]
): Promise<PlantillaConItems> {
  try {
    // 1. Crear o actualizar la plantilla
    const col = collection(db, COLECCION_PLANTILLAS);
    const plantillaData = {
      ...plantillaInput,
      activa: plantillaInput.activa !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ref = await addDoc(col, plantillaData);
    const plantillaId = ref.id;

    // 2. Crear todos los ítems
    const itemsCol = collection(db, COLECCION_PLANTILLAS, plantillaId, SUBCOLECCION_ITEMS);
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
    console.error('savePlantillaConItems error:', e);
    throw e;
  }
}

/**
 * Reemplaza todos los ítems de una plantilla por una nueva lista.
 * Útil para reordenar o actualizar masivamente.
 */
export async function reemplazarItemsDePlantilla(
  plantillaId: string,
  nuevosItems: ItemPlantillaInput[]
): Promise<ItemPlantilla[]> {
  try {
    const batch = writeBatch(db);

    // 1. Eliminar todos los ítems existentes
    const itemsCol = collection(db, COLECCION_PLANTILLAS, plantillaId, SUBCOLECCION_ITEMS);
    const existingSnap = await getDocs(itemsCol);
    existingSnap.docs.forEach((docItem) => {
      batch.delete(docItem.ref);
    });

    // 2. Crear los nuevos ítems
    const createdItems: ItemPlantilla[] = [];
    for (let i = 0; i < nuevosItems.length; i++) {
      const item = nuevosItems[i];
      const itemRef = doc(itemsCol); // Genera un ID automático
      const itemData = {
        label: item.label,
        key: item.key,
        plantillaId,
        orden: item.orden ?? i + 1,
        tipoRespuesta: item.tipoRespuesta || 'check',
        requerido: item.requerido !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      batch.set(itemRef, itemData);
      createdItems.push({ id: itemRef.id, ...itemData });
    }

    await batch.commit();
    return createdItems;
  } catch (e) {
    console.error('reemplazarItemsDePlantilla error:', e);
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
      { plantillaId: '', label: 'Manguera', key: 'checkManguera', orden: 4, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Presión', key: 'checkPresion', orden: 5, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Manómetro', key: 'checkManometro', orden: 6, tipoRespuesta: 'check', requerido: true },
      { plantillaId: '', label: 'Longitud', key: 'checkLongitud', orden: 7, tipoRespuesta: 'numero', requerido: true },
      { plantillaId: '', label: 'Prueba hidráulica', key: 'checkPruebaHidraulica', orden: 8, tipoRespuesta: 'texto', requerido: false },
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
 * Duplica una plantilla existente con todos sus ítems.
 * Crea un nuevo documento con un ID único y copia todos los ítems.
 * @returns La nueva plantilla duplicada.
 */
export async function duplicarPlantilla(plantillaId: string): Promise<Plantilla> {
  try {
    // 1. Obtener la plantilla original
    const original = await getPlantilla(plantillaId);
    if (!original) throw new Error(`Plantilla ${plantillaId} no encontrada`);

    // 2. Obtener los ítems originales
    const itemsOriginales = await getItemsDePlantilla(plantillaId);

    // 3. Crear la nueva plantilla con nombre "COPIA - ..."
    const col = collection(db, COLECCION_PLANTILLAS);
    const nuevaPlantillaData = {
      nombre: `COPIA - ${original.nombre}`,
      descripcion: original.descripcion || '',
      activa: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const nuevaRef = await addDoc(col, nuevaPlantillaData);
    const nuevaPlantillaId = nuevaRef.id;

    // 4. Copiar todos los ítems a la nueva plantilla usando batch
    if (itemsOriginales.length > 0) {
      const batch = writeBatch(db);
      const itemsCol = collection(db, COLECCION_PLANTILLAS, nuevaPlantillaId, SUBCOLECCION_ITEMS);
      itemsOriginales.forEach((item) => {
        const itemRef = doc(itemsCol);
        batch.set(itemRef, {
          plantillaId: nuevaPlantillaId,
          label: item.label,
          key: item.key,
          orden: item.orden,
          tipoRespuesta: item.tipoRespuesta,
          requerido: item.requerido,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    }

    return { id: nuevaPlantillaId, ...nuevaPlantillaData };
  } catch (e) {
    console.error('duplicarPlantilla error:', e);
    throw e;
  }
}

/**
 * Inicializa las plantillas por defecto en Firestore.
 * Solo crea las que no existan (compara por nombre).
 */
export async function inicializarPlantillasPorDefecto(): Promise<void> {
  try {
    const existentes = await getPlantillas();
    const nombresExistentes = new Set(existentes.map((p) => p.nombre));

    for (const template of PLANTILLAS_POR_DEFECTO) {
      if (nombresExistentes.has(template.plantilla.nombre)) {
        console.log(`Plantilla "${template.plantilla.nombre}" ya existe, se omite.`);
        continue;
      }

      console.log(`Creando plantilla por defecto: "${template.plantilla.nombre}"...`);
      await savePlantillaConItems(template.plantilla, template.items);
    }

    console.log('Plantillas por defecto inicializadas correctamente.');
  } catch (e) {
    console.error('inicializarPlantillasPorDefecto error:', e);
    throw e;
  }
}
