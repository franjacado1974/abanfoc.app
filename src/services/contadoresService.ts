import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

export type TipoDocumentoContador =
  | 'facturas'
  | 'albaranes'
  | 'pedidos'
  | 'certificados'
  | 'presupuestos'
  | 'partes';

export interface DocumentoContadorConfig {
  tipo: TipoDocumentoContador;
  nombreVisible: string;
  activo: boolean;
  fechaReinicio: string; // formato YYYY-MM-DD (ej: '2026-12-31')
  prefijo: string; // ej: '27.' o 'ALB.27' o 'PDV.27'
  numeroDigitos: number; // ej: 3 o 4 dígitos de relleno (001 / 0001)
  siguienteNumero: number; // contador siguiente (ej: 1)
  ultimoNumeroAsignado?: number;
  ultimoCodigoGenerado?: string;
  ejemploFormato?: string;
}

export interface ConfiguracionContadores {
  facturas: DocumentoContadorConfig;
  albaranes: DocumentoContadorConfig;
  pedidos: DocumentoContadorConfig;
  certificados: DocumentoContadorConfig;
  presupuestos: DocumentoContadorConfig;
  partes: DocumentoContadorConfig;
  updatedAt?: string;
  actualizadoPor?: string;
}

const STORAGE_KEY = 'firecheck_contadores_config';
const FIRESTORE_COLLECTION = 'contadores';
const FIRESTORE_DOC = 'configuracion_reinicios';

/**
 * Genera la configuración inicial por defecto para el siguiente ejercicio anual
 */
export function generarConfiguracionPorDefecto(): ConfiguracionContadores {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const nextYY = nextYear.toString().slice(-2);
  const finAnoActual = `${currentYear}-12-31`;

  return {
    facturas: {
      tipo: 'facturas',
      nombreVisible: 'Facturas',
      activo: false,
      fechaReinicio: finAnoActual,
      prefijo: `${nextYY}.`,
      numeroDigitos: 4,
      siguienteNumero: 1,
      ejemploFormato: `${nextYY}.0001`
    },
    albaranes: {
      tipo: 'albaranes',
      nombreVisible: 'Albaranes',
      activo: false,
      fechaReinicio: finAnoActual,
      prefijo: `ALB.${nextYY}`,
      numeroDigitos: 3,
      siguienteNumero: 1,
      ejemploFormato: `ALB.${nextYY}001`
    },
    pedidos: {
      tipo: 'pedidos',
      nombreVisible: 'Pedidos',
      activo: false,
      fechaReinicio: finAnoActual,
      prefijo: `PDV.${nextYY}`,
      numeroDigitos: 3,
      siguienteNumero: 1,
      ejemploFormato: `PDV.${nextYY}001`
    },
    certificados: {
      tipo: 'certificados',
      nombreVisible: 'Certificados',
      activo: false,
      fechaReinicio: finAnoActual,
      prefijo: `CERT-${nextYear}-`,
      numeroDigitos: 4,
      siguienteNumero: 1,
      ejemploFormato: `CERT-${nextYear}-0001`
    },
    presupuestos: {
      tipo: 'presupuestos',
      nombreVisible: 'Presupuestos',
      activo: false,
      fechaReinicio: finAnoActual,
      prefijo: `PRE.${nextYY}`,
      numeroDigitos: 3,
      siguienteNumero: 1,
      ejemploFormato: `PRE.${nextYY}001`
    },
    partes: {
      tipo: 'partes',
      nombreVisible: 'Partes de Revisión / Mantenimiento',
      activo: false,
      fechaReinicio: finAnoActual,
      prefijo: `MANT-${nextYear}-`,
      numeroDigitos: 4,
      siguienteNumero: 1,
      ejemploFormato: `MANT-${nextYear}-0001`
    }
  };
}

/**
 * Obtiene la configuración actual de contadores desde LocalStorage con fallback
 */
export function getConfiguracionContadores(): ConfiguracionContadores {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const defaults = generarConfiguracionPorDefecto();
      return {
        facturas: { ...defaults.facturas, ...(parsed.facturas || {}) },
        albaranes: { ...defaults.albaranes, ...(parsed.albaranes || {}) },
        pedidos: { ...defaults.pedidos, ...(parsed.pedidos || {}) },
        certificados: { ...defaults.certificados, ...(parsed.certificados || {}) },
        presupuestos: { ...defaults.presupuestos, ...(parsed.presupuestos || {}) },
        partes: { ...defaults.partes, ...(parsed.partes || {}) },
        updatedAt: parsed.updatedAt,
        actualizadoPor: parsed.actualizadoPor
      };
    }
  } catch (err) {
    console.warn('[getConfiguracionContadores] Error leyendo localStorage:', err);
  }
  return generarConfiguracionPorDefecto();
}

/**
 * Guarda la configuración tanto en Firestore como en LocalStorage
 */
export async function guardarConfiguracionContadores(
  config: ConfiguracionContadores,
  usuarioNombre?: string
): Promise<void> {
  const configToSave: ConfiguracionContadores = {
    ...config,
    updatedAt: new Date().toISOString(),
    actualizadoPor: usuarioNombre || 'Administrador'
  };

  // Guardar inmediatamente en LocalStorage para latencia cero
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));
  } catch (e) {
    console.warn('[guardarConfiguracionContadores] Error guardando en LocalStorage:', e);
  }

  // Sincronizar en Firestore
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
    await setDoc(docRef, configToSave, { merge: true });
    console.info('[guardarConfiguracionContadores] Configuración guardada en Firestore');
  } catch (err) {
    console.error('[guardarConfiguracionContadores] Error sincronizando con Firestore:', err);
    throw err;
  }
}

/**
 * Suscribe a cambios en tiempo real de la configuración de contadores en Firestore
 */
export function subscribeConfiguracionContadores(
  callback: (config: ConfiguracionContadores) => void
): () => void {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ConfiguracionContadores;
          const defaults = generarConfiguracionPorDefecto();
          const merged: ConfiguracionContadores = {
            facturas: { ...defaults.facturas, ...(data.facturas || {}) },
            albaranes: { ...defaults.albaranes, ...(data.albaranes || {}) },
            pedidos: { ...defaults.pedidos, ...(data.pedidos || {}) },
            certificados: { ...defaults.certificados, ...(data.certificados || {}) },
            presupuestos: { ...defaults.presupuestos, ...(data.presupuestos || {}) },
            partes: { ...defaults.partes, ...(data.partes || {}) },
            updatedAt: data.updatedAt,
            actualizadoPor: data.actualizadoPor
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
          callback(merged);
        } else {
          // Documento no creado aún en Firestore; usar valores por defecto
          const current = getConfiguracionContadores();
          callback(current);
        }
      },
      (err) => {
        console.warn('[subscribeConfiguracionContadores] Error de escucha Firestore:', err);
        callback(getConfiguracionContadores());
      }
    );
    return unsubscribe;
  } catch (e) {
    console.warn('[subscribeConfiguracionContadores] No se pudo inicializar snapshot:', e);
    callback(getConfiguracionContadores());
    return () => {};
  }
}

/**
 * Formatea un código de documento según prefijo, número y dígitos de relleno
 */
export function formatearCodigoDocumento(prefijo: string, numero: number, numeroDigitos: number): string {
  const digits = Math.max(1, numeroDigitos || 3);
  const numPadded = String(Math.max(1, numero || 1)).padStart(digits, '0');
  return `${prefijo || ''}${numPadded}`;
}

/**
 * Comprueba si el reinicio está activo para un tipo de documento a una fecha dada
 */
export function estaReinicioActivo(config?: DocumentoContadorConfig, fechaDocumento?: string): boolean {
  if (!config || !config.activo) return false;
  if (!config.fechaReinicio) return true;

  const fechaEvaluar = (fechaDocumento || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const fechaCorte = config.fechaReinicio.slice(0, 10);

  return fechaEvaluar >= fechaCorte;
}

/**
 * Extrae el número secuencial de un código si coincide con el prefijo configurado
 */
export function extraerNumeroDeCodigo(codigo: string, prefijo: string): number | null {
  if (!codigo || !prefijo) return null;
  const cleanCode = codigo.trim();
  const cleanPrefix = prefijo.trim();

  if (!cleanCode.startsWith(cleanPrefix)) return null;

  const resto = cleanCode.slice(cleanPrefix.length).trim();
  const match = resto.match(/^(\d+)/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Calcula el siguiente número secuencial para una lista de códigos existentes
 * respetando el contador configurado y evitando cualquier colisión o duplicado.
 */
export function calcularSiguienteNumeroParaLista(
  codigosExistentes: string[],
  config: DocumentoContadorConfig
): { siguienteNumero: number; codigoFormateado: string } {
  let maxFound = 0;
  for (const cod of codigosExistentes) {
    const num = extraerNumeroDeCodigo(cod, config.prefijo);
    if (num !== null && num > maxFound) {
      maxFound = num;
    }
  }

  const baseConfigurada = Math.max(1, config.siguienteNumero || 1);
  const nextNum = maxFound >= baseConfigurada ? maxFound + 1 : baseConfigurada;
  const formatted = formatearCodigoDocumento(config.prefijo, nextNum, config.numeroDigitos);

  return { siguienteNumero: nextNum, codigoFormateado: formatted };
}

/**
 * Registra el uso de un número generado para avanzar el contador configurado
 */
export async function registrarNumeroGenerado(
  tipo: TipoDocumentoContador,
  numeroAsignado: number,
  codigoGenerado: string
): Promise<void> {
  try {
    const currentConfig = getConfiguracionContadores();
    const docConfig = currentConfig[tipo];
    if (!docConfig) return;

    const nextCounter = Math.max(docConfig.siguienteNumero || 1, numeroAsignado + 1);
    currentConfig[tipo] = {
      ...docConfig,
      siguienteNumero: nextCounter,
      ultimoNumeroAsignado: numeroAsignado,
      ultimoCodigoGenerado: codigoGenerado
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));

    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
    await setDoc(docRef, { [tipo]: currentConfig[tipo], updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn(`[registrarNumeroGenerado] Error actualizando contador de ${tipo}:`, err);
  }
}

/**
 * Helper para Facturas: calcula el siguiente número si el reinicio está activo
 */
export function obtenerSiguienteNumeroFacturaConfigurado(
  facturas: Array<{ id?: string; numeroFactura?: string; fechaCreacion?: string }>,
  fechaFactura?: string
): string | null {
  const config = getConfiguracionContadores().facturas;
  if (!estaReinicioActivo(config, fechaFactura)) {
    return null;
  }

  const codigos = facturas.map(f => f.numeroFactura || f.id || '').filter(Boolean);
  const { codigoFormateado } = calcularSiguienteNumeroParaLista(codigos, config);
  return codigoFormateado;
}

/**
 * Helper para Albaranes: calcula el siguiente número si el reinicio está activo
 */
export async function obtenerSiguienteNumeroAlbaranConfigurado(
  fechaAlbaran?: string
): Promise<string | null> {
  const config = getConfiguracionContadores().albaranes;
  if (!estaReinicioActivo(config, fechaAlbaran)) {
    return null;
  }

  const codigos: string[] = [];
  try {
    const raw = localStorage.getItem('firecheck_db_albaranes');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((a: any) => {
          if (a.id) codigos.push(a.id);
          if (a.numeroMantenimiento) codigos.push(a.numeroMantenimiento);
        });
      }
    }
  } catch {}

  const { codigoFormateado, siguienteNumero } = calcularSiguienteNumeroParaLista(codigos, config);
  // Registrar preventivamente para evitar duplicados en generación consecutiva
  await registrarNumeroGenerado('albaranes', siguienteNumero, codigoFormateado);
  return codigoFormateado;
}

/**
 * Helper para Pedidos: calcula el siguiente número si el reinicio está activo
 */
export async function obtenerSiguienteNumeroPedidoConfigurado(
  prefijoTipo: string = 'PDV',
  fechaPedido?: string
): Promise<string | null> {
  const config = getConfiguracionContadores().pedidos;
  if (!estaReinicioActivo(config, fechaPedido)) {
    return null;
  }

  // Permitir sustituir el prefijo base si es PDR / PDI / PDA
  let prefijoEfectivo = config.prefijo;
  if (prefijoTipo !== 'PDV' && config.prefijo.startsWith('PDV')) {
    prefijoEfectivo = config.prefijo.replace(/^PDV/i, prefijoTipo);
  }

  const configAdaptada: DocumentoContadorConfig = {
    ...config,
    prefijo: prefijoEfectivo
  };

  const codigos: string[] = [];
  try {
    const keys = ['firecheck_db_pedidos', 'firecheck_db_reparaciones', 'firecheck_db_instalaciones', 'firecheck_db_urgencias'];
    keys.forEach(k => {
      const raw = localStorage.getItem(k);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((item: any) => {
            if (item.numeroPedido) codigos.push(item.numeroPedido);
            if (item.pedidoId) codigos.push(item.pedidoId);
          });
        }
      }
    });
  } catch {}

  const { codigoFormateado, siguienteNumero } = calcularSiguienteNumeroParaLista(codigos, configAdaptada);
  await registrarNumeroGenerado('pedidos', siguienteNumero, codigoFormateado);
  return codigoFormateado;
}

/**
 * Helper para Certificados: calcula el siguiente número si el reinicio está activo
 */
export function obtenerSiguienteNumeroCertificadoConfigurado(
  certificados?: Array<{ id?: string; numeroMantenimiento?: string; fechaCreacion?: string }>,
  fechaCertificado?: string
): string | null {
  const config = getConfiguracionContadores().certificados;
  if (!estaReinicioActivo(config, fechaCertificado)) {
    return null;
  }

  const codigos: string[] = [];
  if (Array.isArray(certificados) && certificados.length > 0) {
    certificados.forEach(c => {
      if (c.numeroMantenimiento) codigos.push(c.numeroMantenimiento);
      if (c.id) codigos.push(c.id);
    });
  } else {
    try {
      const raw = localStorage.getItem('firecheck_db_certificados');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((c: any) => {
            if (c.numeroMantenimiento) codigos.push(c.numeroMantenimiento);
            if (c.id) codigos.push(c.id);
          });
        }
      }
    } catch {}
  }

  const { codigoFormateado } = calcularSiguienteNumeroParaLista(codigos, config);
  return codigoFormateado;
}

/**
 * Helper para Presupuestos: calcula el siguiente número si el reinicio está activo
 */
export async function obtenerSiguienteNumeroPresupuestoConfigurado(
  fechaPresupuesto?: string
): Promise<string | null> {
  const config = getConfiguracionContadores().presupuestos;
  if (!estaReinicioActivo(config, fechaPresupuesto)) {
    return null;
  }

  const codigos: string[] = [];
  try {
    const raw = localStorage.getItem('firecheck_db_presupuestos');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((p: any) => {
          if (p.numeroPresupuesto) codigos.push(p.numeroPresupuesto);
          if (p.id) codigos.push(p.id);
        });
      }
    }
  } catch {}

  const { codigoFormateado, siguienteNumero } = calcularSiguienteNumeroParaLista(codigos, config);
  await registrarNumeroGenerado('presupuestos', siguienteNumero, codigoFormateado);
  return codigoFormateado;
}

/**
 * Helper para Partes de Mantenimiento / Revisión: calcula el siguiente número si el reinicio está activo
 */
export async function obtenerSiguienteNumeroParteConfigurado(
  fechaParte?: string
): Promise<string | null> {
  const config = getConfiguracionContadores().partes;
  if (!estaReinicioActivo(config, fechaParte)) {
    return null;
  }

  const codigos: string[] = [];
  try {
    const raw = localStorage.getItem('firecheck_db_partes');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((p: any) => {
          if (p.numeroMantenimiento) codigos.push(p.numeroMantenimiento);
          if (p.id) codigos.push(p.id);
        });
      }
    }
  } catch {}

  const { codigoFormateado, siguienteNumero } = calcularSiguienteNumeroParaLista(codigos, config);
  await registrarNumeroGenerado('partes', siguienteNumero, codigoFormateado);
  return codigoFormateado;
}
