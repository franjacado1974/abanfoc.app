// Servicio de integración con OneDrive Personal a través de Firebase Cloud Function (proxy seguro hacia Make.com)
import { getSalamandraIdToken, getLastFirebaseAuthError } from './salamandraAuthService';

export interface MakeOneDriveConfig {
  rootFolderPath: string;
}

export interface DocumentoAdjuntoOneDrive {
  id: string;
  nombre: string;
  onedriveItemId: string;
  webUrl: string;
  downloadUrl?: string;
  size?: number;
  mimeType?: string;
  carpetaNombre?: string;
  rutaCompleta?: string;
  esCopiaPresupuesto?: boolean;
  syncedViaMake?: boolean;
  fechaSubida: string;
}

const MAKE_CONFIG_STORAGE_KEY = 'firecheck_make_onedrive_config';
export const DEFAULT_ONEDRIVE_ROOT_FOLDER = '01 SERVIDOR ABANFOC/23 PRESUPUESTOS SALAMANDRA';
export const ONEDRIVE_PROXY_ENDPOINT = '/api/onedrive-upload';
// Límite máximo de subida por archivo en Salamandra (25 MB)
export const MAX_MAKE_UPLOAD_BYTES = 25 * 1024 * 1024;

export const getMakeOneDriveConfig = (): MakeOneDriveConfig => {
  try {
    const raw = localStorage.getItem(MAKE_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        rootFolderPath:
          (parsed.rootFolderPath || DEFAULT_ONEDRIVE_ROOT_FOLDER).trim() || DEFAULT_ONEDRIVE_ROOT_FOLDER,
      };
    }
  } catch {}
  return {
    rootFolderPath: DEFAULT_ONEDRIVE_ROOT_FOLDER,
  };
};

export const saveMakeOneDriveConfig = (config: MakeOneDriveConfig): void => {
  localStorage.setItem(
    MAKE_CONFIG_STORAGE_KEY,
    JSON.stringify({
      rootFolderPath:
        (config.rootFolderPath || DEFAULT_ONEDRIVE_ROOT_FOLDER).trim() || DEFAULT_ONEDRIVE_ROOT_FOLDER,
    })
  );
};

// Limpia caracteres no permitidos en nombres de carpetas/archivos de OneDrive
export const sanitizeOneDriveName = (value: string): string => {
  return value
    .replace(/[\\/:*?"<>|#%]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim();
};

export function buildPresupuestoFolderName(
  numeroPresupuesto?: string,
  fallbackId?: string,
  nombreCentro?: string
): string {
  const rawCode = (numeroPresupuesto || fallbackId || 'SIN-NUMERO').trim();
  const cleanCode =
    sanitizeOneDriveName(rawCode.replace(/^(PRE|PRV|PDV)[-\s]*/i, '')) || sanitizeOneDriveName(rawCode);
  const cleanCentro = sanitizeOneDriveName(nombreCentro || '');
  return cleanCentro ? `${cleanCode}-${cleanCentro}` : cleanCode;
}

export interface MakeUploadPayloadParams {
  fileData: Blob | File;
  fileName: string;
  folderName: string;
  presupuestoId: string;
  numeroPresupuesto?: string;
  nombreCentro?: string;
  esCopiaPresupuesto?: boolean;
}

export interface MakeUploadResult {
  id: string;
  nombre: string;
  webUrl: string;
  downloadUrl: string;
  size: number;
  mimeType: string;
  rutaCompleta: string;
  hasWebhookResponse: boolean;
}

export async function uploadFileViaMakeWebhook(params: MakeUploadPayloadParams): Promise<MakeUploadResult> {
  const idToken = await getSalamandraIdToken();
  if (!idToken) {
    const authErr = getLastFirebaseAuthError();
    throw new Error(
      authErr
        ? `Tu sesión no tiene credencial firmada de Firebase Auth (${authErr}).`
        : 'Tu sesión no tiene credencial firmada de Firebase Auth. Cierra sesión y vuelve a entrar en Salamandra para autorizar OneDrive.'
    );
  }

  if (params.fileData.size > MAX_MAKE_UPLOAD_BYTES) {
    const sizeMb = (params.fileData.size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `El archivo "${params.fileName}" pesa ${sizeMb} MB y supera el límite máximo de 25 MB permitido.`
    );
  }

  const cfg = getMakeOneDriveConfig();
  const safeFileName = sanitizeOneDriveName(params.fileName) || `archivo_${Date.now()}`;
  const cleanRoot = cfg.rootFolderPath
    .split(/[\\/]/)
    .map((s) => sanitizeOneDriveName(s))
    .filter(Boolean)
    .join('/');
  const cleanFolder = sanitizeOneDriveName(params.folderName);
  const fullFolderPath = cleanRoot ? `${cleanRoot}/${cleanFolder}` : cleanFolder;
  const mimeType = params.fileData.type || 'application/octet-stream';

  const formData = new FormData();
  formData.append('action', 'upload');
  formData.append('file', params.fileData, safeFileName);
  formData.append('fileName', safeFileName);
  formData.append('rootFolder', cleanRoot);
  formData.append('folderName', cleanFolder);
  formData.append('fullFolderPath', fullFolderPath);
  formData.append('presupuestoId', params.presupuestoId);
  formData.append('numeroPresupuesto', params.numeroPresupuesto || '');
  formData.append('nombreCentro', params.nombreCentro || '');
  formData.append('esCopiaPresupuesto', params.esCopiaPresupuesto ? 'true' : 'false');
  formData.append('mimeType', mimeType);
  formData.append('size', String(params.fileData.size));

  const res = await fetch(ONEDRIVE_PROXY_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: formData,
  });

  const rawText = await res.text().catch(() => '');
  let parsed: any = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    throw new Error(parsed?.error || rawText || `Error del servidor proxy (HTTP ${res.status}).`);
  }

  const hasWebhookResponse = Boolean(parsed?.hasWebhookResponse);
  const itemId = String(parsed?.id || '');
  const webUrl = String(parsed?.webUrl || '');
  const downloadUrl = String(parsed?.downloadUrl || '');
  const returnedName = String(parsed?.nombre || safeFileName) || safeFileName;

  return {
    id: itemId,
    nombre: returnedName,
    webUrl,
    downloadUrl,
    size: params.fileData.size,
    mimeType,
    rutaCompleta: `${fullFolderPath}/${returnedName}`,
    hasWebhookResponse,
  };
}
