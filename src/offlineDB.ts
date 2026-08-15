/**
 * ─── SALAMANDRA OFFLINE DB (IndexedDB v1) ──────────────────────────────────
 * Módulo nativo de persistencia de baja latencia para trabajo Offline-First.
 * Soporta almacenamiento binario de fotos mediante Blobs, versión de esquema (DB_VERSION = 1),
 * cola de sincronización transaccional por bloques e identificadores únicos idempotentes.
 */

export const DB_NAME = 'salamandra_offline_db';
export const DB_VERSION = 1;

export interface OfflineParteBundle {
  parteId: string;
  centroId: string;
  clienteId: string;
  parte: any;
  cliente: any;
  centro: any;
  sistemasDelCentro: any[];
  equiposInstalados: any[];
  checklistItemsPorSistema: Record<string, any[]>;
  plantillas: any[];
  categoriasSistema: any[];
  equiposCatalogo: any[];
  downloadedAt: string;
  syncStatus: 'downloaded' | 'pending_sync' | 'syncing' | 'synced' | 'error';
  lastLocalEdit?: string;
  remoteUpdatedAt?: string;
  firmas?: {
    firmaClienteUrl?: string;
    firmaTecnicoUrl?: string;
    nombreClienteFirma?: string;
  };
}

export interface OfflinePhotoRecord {
  id: string; // parteId_equipoId_photoId
  parteId: string;
  equipoId: string;
  photoId: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
  syncStatus: 'pending' | 'synced';
}

export interface PendingSyncItem {
  sync_item_uuid: string; // Identificador único idempotente
  parteId: string;
  blockType: 'equipo' | 'parte' | 'firma' | 'foto' | 'checklist';
  blockId: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Inicializa y abre la base de datos IndexedDB con control de esquemas.
 */
export function initOfflineDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB no está soportado en este navegador.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.info(`[OfflineDB] Actualizando esquema a v${DB_VERSION}...`);

      // Store 1: downloadedPartes (key: parteId)
      if (!db.objectStoreNames.contains('downloadedPartes')) {
        const storePartes = db.createObjectStore('downloadedPartes', { keyPath: 'parteId' });
        storePartes.createIndex('syncStatus', 'syncStatus', { unique: false });
        storePartes.createIndex('centroId', 'centroId', { unique: false });
      }

      // Store 2: offlinePhotos (key: id)
      if (!db.objectStoreNames.contains('offlinePhotos')) {
        const storePhotos = db.createObjectStore('offlinePhotos', { keyPath: 'id' });
        storePhotos.createIndex('parteId', 'parteId', { unique: false });
        storePhotos.createIndex('equipoId', 'equipoId', { unique: false });
      }

      // Store 3: pendingSyncQueue (key: sync_item_uuid)
      if (!db.objectStoreNames.contains('pendingSyncQueue')) {
        const storeQueue = db.createObjectStore('pendingSyncQueue', { keyPath: 'sync_item_uuid' });
        storeQueue.createIndex('parteId', 'parteId', { unique: false });
        storeQueue.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = (event: Event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      console.info(`[OfflineDB] Base de datos '${DB_NAME}' v${DB_VERSION} lista.`);
      resolve(dbInstance);
    };

    request.onerror = (event: Event) => {
      console.error('[OfflineDB] Error abriendo IndexedDB:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Guarda o reemplaza el paquete completo descargado de un parte en IndexedDB.
 */
export async function saveParteOfflineBundle(bundle: OfflineParteBundle): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('downloadedPartes', 'readwrite');
    const store = tx.objectStore('downloadedPartes');

    const cleanBundle: OfflineParteBundle = {
      ...bundle,
      downloadedAt: bundle.downloadedAt || new Date().toISOString(),
      syncStatus: bundle.syncStatus || 'downloaded'
    };

    const request = store.put(cleanBundle);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene el paquete completo de un parte descargado desde IndexedDB.
 */
export async function getParteOfflineBundle(parteId: string): Promise<OfflineParteBundle | null> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('downloadedPartes', 'readonly');
    const store = tx.objectStore('downloadedPartes');
    const request = store.get(parteId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Actualiza parcialmente los datos locales de un parte en IndexedDB sin bloquear la UI.
 */
export async function updateParteOfflineData(
  parteId: string,
  partialUpdate: {
    equiposInstalados?: any[];
    parte?: any;
    firmas?: any;
    syncStatus?: 'downloaded' | 'pending_sync' | 'syncing' | 'synced' | 'error';
  }
): Promise<void> {
  const existing = await getParteOfflineBundle(parteId);
  if (!existing) {
    console.warn(`[OfflineDB] No se encontró el paquete local para el parte: ${parteId}`);
    return;
  }

  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('downloadedPartes', 'readwrite');
    const store = tx.objectStore('downloadedPartes');

    const updatedBundle: OfflineParteBundle = {
      ...existing,
      equiposInstalados: partialUpdate.equiposInstalados ?? existing.equiposInstalados,
      parte: partialUpdate.parte ? { ...existing.parte, ...partialUpdate.parte } : existing.parte,
      firmas: partialUpdate.firmas ? { ...existing.firmas, ...partialUpdate.firmas } : existing.firmas,
      syncStatus: partialUpdate.syncStatus ?? 'pending_sync',
      lastLocalEdit: new Date().toISOString()
    };

    const request = store.put(updatedBundle);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Almacena una foto binaria (Blob) en el Object Store 'offlinePhotos'.
 */
export async function saveOfflinePhotoBlob(
  parteId: string,
  equipoId: string,
  photoId: string,
  blob: Blob
): Promise<OfflinePhotoRecord> {
  const db = await initOfflineDB();
  const photoRecord: OfflinePhotoRecord = {
    id: `${parteId}_${equipoId}_${photoId}`,
    parteId,
    equipoId,
    photoId,
    blob,
    mimeType: blob.type || 'image/jpeg',
    createdAt: new Date().toISOString(),
    syncStatus: 'pending'
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('offlinePhotos', 'readwrite');
    const store = tx.objectStore('offlinePhotos');
    const request = store.put(photoRecord);

    request.onsuccess = () => resolve(photoRecord);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene todas las fotos guardadas en Blobs para un parte.
 */
export async function getOfflinePhotosForParte(parteId: string): Promise<Array<OfflinePhotoRecord & { objectUrl: string }>> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offlinePhotos', 'readonly');
    const store = tx.objectStore('offlinePhotos');
    const index = store.index('parteId');
    const request = index.getAll(parteId);

    request.onsuccess = () => {
      const records: OfflinePhotoRecord[] = request.result || [];
      const withUrls = records.map(r => ({
        ...r,
        objectUrl: URL.createObjectURL(r.blob)
      }));
      resolve(withUrls);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Elimina un registro de foto en Blob de IndexedDB.
 */
export async function deleteOfflinePhotoBlob(id: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offlinePhotos', 'readwrite');
    const store = tx.objectStore('offlinePhotos');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Agrega una operación incremental transaccional e idempotente a la cola 'pendingSyncQueue'.
 */
export async function addPendingSyncItem(
  parteId: string,
  blockType: 'equipo' | 'parte' | 'firma' | 'foto' | 'checklist',
  blockId: string,
  payload: any
): Promise<string> {
  const db = await initOfflineDB();
  const sync_item_uuid = `sync_${parteId}_${blockType}_${blockId}`;

  const item: PendingSyncItem = {
    sync_item_uuid,
    parteId,
    blockType,
    blockId,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending'
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingSyncQueue', 'readwrite');
    const store = tx.objectStore('pendingSyncQueue');
    const request = store.put(item);

    request.onsuccess = () => resolve(sync_item_uuid);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene todos los elementos pendientes de sincronizar en la cola (opcionalmente filtrados por parteId).
 */
export async function getPendingSyncItems(parteId?: string): Promise<PendingSyncItem[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingSyncQueue', 'readonly');
    const store = tx.objectStore('pendingSyncQueue');

    let request: IDBRequest;
    if (parteId) {
      const index = store.index('parteId');
      request = index.getAll(parteId);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      const items: PendingSyncItem[] = request.result || [];
      items.sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Marca un elemento de la cola como completado y lo elimina de la cola SOLO tras confirmación.
 */
export async function markSyncItemDone(sync_item_uuid: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingSyncQueue', 'readwrite');
    const store = tx.objectStore('pendingSyncQueue');
    const request = store.delete(sync_item_uuid);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Registra un fallo de sincronización en la cola para su posterior reintento automático.
 */
export async function markSyncItemFailed(sync_item_uuid: string, errorMsg: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingSyncQueue', 'readwrite');
    const store = tx.objectStore('pendingSyncQueue');
    const getReq = store.get(sync_item_uuid);

    getReq.onsuccess = () => {
      const item: PendingSyncItem = getReq.result;
      if (item) {
        item.status = 'failed';
        item.retryCount = (item.retryCount || 0) + 1;
        item.errorMessage = errorMsg;
        store.put(item);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Obtiene un resumen de diagnóstico del almacenamiento IndexedDB local (para Administrador).
 */
export async function getOfflineDiagnostics() {
  const db = await initOfflineDB();
  const getCount = (storeName: string): Promise<number> => {
    return new Promise((res, rej) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  };

  const partesCount = await getCount('downloadedPartes');
  const photosCount = await getCount('offlinePhotos');
  const pendingQueueCount = await getCount('pendingSyncQueue');

  let storageEstimate: any = null;
  if (navigator.storage && navigator.storage.estimate) {
    try {
      storageEstimate = await navigator.storage.estimate();
    } catch { /* ignore */ }
  }

  return {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    partesCount,
    photosCount,
    pendingQueueCount,
    storageEstimate
  };
}
