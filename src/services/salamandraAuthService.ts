import { getApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';

export const SALAMANDRA_AUTH_ENDPOINT = '/api/salamandra-auth';

let lastAuthSyncError: string | null = null;

export function getLastFirebaseAuthError(): string | null {
  return lastAuthSyncError;
}

/**
 * Solicita en segundo plano un Custom Token firmado a Cloud Functions
 * e inicia sesión en Firebase Auth sin bloquear el acceso offline o de técnicos.
 */
export async function syncFirebaseAuthSession(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  lastAuthSyncError = null;
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      lastAuthSyncError = 'Sin conexión a internet (modo offline).';
      return { ok: false, error: lastAuthSyncError };
    }

    const res = await fetch(SALAMANDRA_AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.customToken) {
      const code = data?.errorCode ? ` (${data.errorCode})` : '';
      lastAuthSyncError = `${data?.error || 'No se pudo obtener la credencial firmada de Firebase.'}${code}`;
      console.warn('[salamandraAuth] No se pudo obtener Custom Token. HTTP:', res.status, data?.errorCode || '');
      return {
        ok: false,
        error: lastAuthSyncError,
      };
    }

    const auth = getAuth(getApp());
    await signInWithCustomToken(auth, data.customToken);
    lastAuthSyncError = null;
    return { ok: true };
  } catch (err: any) {
    const errMsg = err?.code
      ? `${err.code}: ${err.message}`
      : (err?.message || 'Error conectando con el servicio de autenticación.');
    lastAuthSyncError = errMsg;
    console.warn('[salamandraAuth] Error en signInWithCustomToken:', err?.code || err?.message);
    return {
      ok: false,
      error: errMsg,
    };
  }
}

/**
 * Devuelve el Firebase Authentication ID Token vigente del usuario actual.
 */
export async function getSalamandraIdToken(): Promise<string | null> {
  try {
    const auth = getAuth(getApp());
    await auth.authStateReady();
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Cierra la sesión de Firebase Auth al cerrar sesión en Salamandra.
 */
export async function clearFirebaseAuthSession(): Promise<void> {
  try {
    const auth = getAuth(getApp());
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch {}
}
