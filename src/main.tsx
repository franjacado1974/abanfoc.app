import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Claves que jamás deben eliminarse automáticamente (sesión activa y alertas críticas)
const PROTECTED_STORAGE_KEYS = new Set([
  'firecheck_logged_user',
  'firecheck_pending_horario_alert',
  'firecheck_loader_image',
  'firecheck_loader_escala',
]);

// Orden de prioridad para liberar cachés secundarias recargables desde Firestore cuando el navegador supera su cuota de 5 MB
const EVICTABLE_CACHE_PRIORITY = [
  'firecheck_db_certificados',
  'firecheck_db_albaranes',
  'firecheck_db_presupuestos',
  'firecheck_db_equipos_instalados',
  'firecheck_db_sistemas_equipos',
  'firecheck_db_articulos',
  'firecheck_db_inventario',
  'firecheck_db_alertas_ext',
  'firecheck_db_alertas_bie',
  'firecheck_db_pedidos',
  'firecheck_db_partes',
  'firecheck_db_centros',
  'firecheck_db_clientes',
];

const nativeSetItem = Storage.prototype.setItem;
const nativeRemoveItem = Storage.prototype.removeItem;

// Aligera cadenas JSON masivas (> 250 KB) recortando únicamente imágenes/firmas Base64 incrustadas en la copia de localStorage
function compactarPayloadMasivoLocalStorage(key: string, value: string): string {
  if (!key.startsWith('firecheck_db_') || value.length < 250000) return value;
  if (!value.includes('data:image/')) return value;
  try {
    // Reemplaza cadenas data:image/...;base64,... de más de 1000 caracteres en la caché espejo de localStorage
    return value.replace(/"data:image\/[^"]{1000,}"/g, '""');
  } catch {
    return value;
  }
}

// Función de seguridad: Libera cuota eliminando claves temporales huérfanas de Firestore y cachés secundarias pesadas
function limpiarCoordinacionTemporalFirestore(liberarCachesPesadas = false) {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('firestore_')) {
        keysToRemove.push(k);
      } else if (
        liberarCachesPesadas &&
        k.startsWith('firecheck_db_sistemas_equipos_')
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      try { nativeRemoveItem.call(localStorage, k); } catch { /* ignore */ }
    });

    if (liberarCachesPesadas) {
      for (const cacheKey of EVICTABLE_CACHE_PRIORITY) {
        try { nativeRemoveItem.call(localStorage, cacheKey); } catch { /* ignore */ }
      }
    } else {
      // Saneamiento preventivo al arrancar: si alguna colección individual supera 400 KB o el total supera 3.2 MB, compactar o liberar
      let totalChars = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const val = localStorage.getItem(k) || '';
        totalChars += k.length + val.length;
        if (k.startsWith('firecheck_db_') && val.length > 400000) {
          const compactado = compactarPayloadMasivoLocalStorage(k, val);
          if (compactado.length < val.length && compactado.length < 400000) {
            try { nativeSetItem.call(localStorage, k, compactado); } catch { nativeRemoveItem.call(localStorage, k); }
          } else {
            try { nativeRemoveItem.call(localStorage, k); } catch { /* ignore */ }
          }
        }
      }
      if (totalChars > 3200000) {
        for (const cacheKey of EVICTABLE_CACHE_PRIORITY.slice(0, 6)) {
          try { nativeRemoveItem.call(localStorage, cacheKey); } catch { /* ignore */ }
        }
      }
    }
  } catch (e) {
    console.debug('Aviso comprobando claves temporales de Firestore:', e);
  }
}

// Blindaje global de Storage.prototype.setItem para impedir que Firestore sufra QuotaExceededError (ID: b815)
function instalarBlindajeStorageQuota() {
  try {
    Storage.prototype.setItem = function (key: string, value: string) {
      const valToStore = this === localStorage ? compactarPayloadMasivoLocalStorage(String(key), String(value)) : String(value);
      try {
        nativeSetItem.call(this, key, valToStore);
        return;
      } catch (err) {
        if (this !== localStorage) throw err;

        // 1. Liberar progresivamente cachés secundarias de firecheck_db_* hasta que haya espacio suficiente
        for (const cacheKey of EVICTABLE_CACHE_PRIORITY) {
          if (cacheKey === key) continue;
          try {
            if (localStorage.getItem(cacheKey) !== null) {
              nativeRemoveItem.call(localStorage, cacheKey);
              try {
                nativeSetItem.call(this, key, valToStore);
                return;
              } catch {
                // Continuar liberando la siguiente caché en orden de prioridad
              }
            }
          } catch { /* ignore */ }
        }

        // 2. Liberar subclaves dinámicas por categoría y cualquier otra clave no protegida ni de coordinación activa
        try {
          const extraKeys: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (
              k &&
              k !== key &&
              !PROTECTED_STORAGE_KEYS.has(k) &&
              !k.startsWith('firestore_')
            ) {
              extraKeys.push(k);
            }
          }
          for (const k of extraKeys) {
            try {
              nativeRemoveItem.call(localStorage, k);
              nativeSetItem.call(this, key, valToStore);
              return;
            } catch { /* seguir liberando */ }
          }
        } catch { /* ignore */ }

        // 3. Si la clave que se intenta escribir es de Firestore (crítica para evitar crash b815), limpiar restos antiguos de firestore_*
        if (String(key).startsWith('firestore_')) {
          try {
            const oldFsKeys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k !== key && k.startsWith('firestore_')) {
                oldFsKeys.push(k);
              }
            }
            oldFsKeys.forEach(k => {
              try { nativeRemoveItem.call(localStorage, k); } catch { /* ignore */ }
            });
            nativeSetItem.call(this, key, valToStore);
            return;
          } catch { /* ignore */ }
        }

        // 4. Si es una caché pesada de firecheck_db_* que ni siquiera vacía cabe en los 5 MB del navegador, omitir silenciosamente sin romper la app
        if (String(key).startsWith('firecheck_db_')) {
          console.warn(`[StorageGuard] Se omitió caché en localStorage para '${key}' por superar el límite físico del navegador.`);
          return;
        }
      }
    };
  } catch (e) {
    console.warn('No se pudo instalar el blindaje de Storage:', e);
  }
}

// Ejecución preventiva antes de montar Firebase y la aplicación
instalarBlindajeStorageQuota();
limpiarCoordinacionTemporalFirestore(false);

// Captura preventiva de promesas rechazadas de Firestore por QuotaExceededError / b815 en segundo plano
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event.reason?.message || event.reason || '');
    if (msg.includes('QuotaExceededError') || msg.includes('b815') || msg.includes('firestore_')) {
      console.warn('[StorageGuard] Auto-saneando almacenamiento tras aviso de Firestore en segundo plano:', msg);
      limpiarCoordinacionTemporalFirestore(true);
      event.preventDefault();
    }
  });
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturó un error fatal:', error, errorInfo);
    const msg = String(error?.message || error || '');
    if (msg.includes('QuotaExceededError') || msg.includes('b815') || msg.includes('firestore_')) {
      // Auto-recuperación inmediata sin cerrar la sesión del usuario
      limpiarCoordinacionTemporalFirestore(true);
      const lastAutoReload = Number(sessionStorage.getItem('firecheck_auto_quota_reload') || '0');
      if (Date.now() - lastAutoReload > 10000) {
        sessionStorage.setItem('firecheck_auto_quota_reload', String(Date.now()));
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    try {
      limpiarCoordinacionTemporalFirestore(true);
      sessionStorage.removeItem('firecheck_logged_user');
      localStorage.removeItem('firecheck_logged_user');
    } catch { /* ignore */ }
    window.location.href = '/';
  };

  handleReload = () => {
    try {
      limpiarCoordinacionTemporalFirestore(true);
    } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              ⚠️
            </div>
            <h1 className="text-lg font-black text-white">Se produjo un error al iniciar</h1>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              La aplicación ha detectado un problema con los datos temporales o de sesión en este dispositivo.
            </p>
            {this.state.error && (
              <div className="mt-3 p-2.5 bg-black/50 border border-zinc-800 rounded-xl text-left overflow-x-auto text-[11px] font-mono text-red-400 max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-red-600/20"
              >
                Restablecer sesión
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

