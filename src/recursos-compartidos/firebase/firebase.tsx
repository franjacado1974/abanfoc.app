import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, getDocs, getDoc, query, where, orderBy, addDoc, doc, updateDoc, setDoc, deleteDoc, onSnapshot, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyADw32Czr9wMORD5fY1MPWL78Gl3tNxTZg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "fire2-fcd66.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "fire2-fcd66",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "fire2-fcd66.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "849531214248",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:849531214248:web:97a260bf7a9b37306b259d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MBRHB1VZG3"
};

export interface SistemaCategoria {
  id: string;
  nombre: string;
  imagenUrl?: string;
  tipos?: { id: string; nombre: string }[];
}
export interface SistemaEquipo {
  id: string;
  idCategoria: string;
  codigo: string;
  nombre: string;
  familia: string;
  revisable: boolean;
}

export interface Articulo {
  id: string;
  codigo: string;
  nombre: string;
  familiaId?: string;
  familia: string;
  precioCompra: number;
  precioVenta: number;
  revisable: boolean;
  fotoUrl?: string;
}

export interface Familia {
  id: string;
  nombre: string;
}

export interface Tecnico {
  id: string;
  nombre: string;
  apellidos: string;
  _docId?: string;
  habilitacion?: string;
  [key: string]: any;
}

export interface Pedido {
  id: string;
  empresaId: string;
  clienteId: string;
  centroId: string;
  titulo: string;
  fechaCreacion: string;
  fechaPrevista?: string;
  items: { cantidad: number; concepto: string; descripcion: string; precioUnidad: number; subtotal: number; }[];
  estado: 'Pendiente' | 'En Proceso' | 'Completado';
  presupuestoId?: string;
  numeroPedido?: string;
  notas?: string;
  _docId?: string;
}

export interface Albaran {
  id: string;
  empresaId: string;
  clienteId: string;
  centroId: string;
  fechaCreacion: string;
  items: { cantidad: number; concepto: string; descripcion: string; precioUnidad: number; subtotal: number; }[];
  nombreFirmante: string;
  tecnicoId: string;
  facturado: boolean;
  firmaCliente?: string;
  firmaTecnico?: string;
  numeroMantenimiento?: string;
  parteId?: string;
  numeroPedido?: string;
  titulo?: string;
  periodicidad?: string;
  _docId?: string;
}

export interface TrabajoConfig {
  id: string;
  opciones: string[];
}

export interface Cliente {
  id: string;
  nombre: string;
  cif?: string;
  direccion?: string;
  poblacion?: string;
  cp?: string;
  provincia?: string;
  telefono?: string;
  contacto?: string;
  correo?: string;
  correoGeneral?: string;
  correoAdministracion?: string;
  correoFacturacion?: string;
  correoMantenimiento?: string;
  correoCompras?: string;
  correoPedidos?: string;
  correoOtro?: string;
}

export interface Centro {
  _docId?: string;
  id: string;
  clienteId: string;
  nombre: string;
  direccion?: string;
  poblacion?: string;
  provincia?: string;
  telefono?: string;
  empresaId?: string;
  periodicidad?: string[];
  mesesRevision?: string[];
  tecnicoId?: string;
  numeroContrato?: string;
  fechaInicioContrato?: string;
  fechaFinContrato?: string;
  importeAnualContrato?: string;
  observacionesContrato?: string;
  sistemasContrato?: string[];
  precioAnualContrato?: string;
  precioTrimestralContrato?: string;
  precioMensualContrato?: string;
  comentariosTecnico?: string;
  comentariosPrivados?: string;
  formaPago?: string;
  vencimiento?: string;
  iban?: string;
  notas?: string;
  correo?: string;
  correoGeneral?: string;
  correoAdministracion?: string;
  correoFacturacion?: string;
  correoMantenimiento?: string;
  correoCompras?: string;
  correoPedidos?: string;
  correoOtro?: string;
}

export interface Equipo {
  id: string;
  centroId: string;
}

export interface Empresa {
  _docId?: string;
  id?: string;
  nombre: string;
  direccion?: string;
  localidad?: string;
  poblacion?: string;
  codigoPostal?: string;
  cp?: string;
  cif?: string;
  rasic?: string;
  telefono?: string;
  email?: string;
  correo?: string;
  logoUrl?: string;
  selloUrl?: string;
}

// ─── PRESUPUESTO Interfaces ──────────────────────────────────────────────

export interface ImpuestoConfig {
  id: string;
  iva: number;
  exento: boolean;
  _docId?: string;
}

export interface PresupuestoLinea {
  id: string;
  tipo: 'articulo' | 'servicio' | 'manual';
  codigo?: string;
  concepto: string;
  descripcion?: string;
  fotoUrl?: string;
  cantidad: number;
  precioUnidad: number;
  subtotal: number;
}

export interface Presupuesto {
  id: string;
  titulo: string;
  numeroPresupuesto?: string;
  clienteId: string;
  nombreCliente?: string;
  centroId?: string;
  fechaCreacion: string;
  fechaValidez?: string;
  estado: 'Borrador' | 'Enviado' | 'En espera' | 'Aprobado' | 'Rechazado';
  lineas: PresupuestoLinea[];
  subtotal: number;
  iva: number;
  total: number;
  notas?: string;
  usuarioRealizado?: string;
  _docId?: string;
}

const app = initializeApp(firebaseConfig);
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn('Firebase Analytics not available in this environment:', e);
}
const storage = getStorage(app);
const db = getFirestore(app);

enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('La persistencia falló: Múltiples pestañas abiertas.');
  } else if (err.code === 'unimplemented') {
    console.warn('El navegador no soporta persistencia offline.');
  } else if (err.message?.includes('message channel closed')) {
    // Error interno de Firebase al cerrar pestañas - no afecta al funcionamiento
    console.debug('Persistencia offline: mensaje interno ignorado');
  } else {
    console.debug('Persistencia offline error:', err.code, err.message);
  }
});

export async function addUserToFirestore(user: { nombre: string; apellidos: string; rol: string; password: string }) {
  try {
    const col = collection(db, 'usuarios');
    const docRef = await addDoc(col, {
      nombre: user.nombre,
      apellidos: user.apellidos,
      rol: user.rol,
      contraseña: user.password
    });
    console.info('addUserToFirestore: created', docRef.id, user.nombre);
    return { id: docRef.id, ...user };
  } catch (e) {
    console.error('addUserToFirestore error:', e);
    throw e;
  }
}

export function subscribeTecnicos(callback: (tecnicos: Tecnico[]) => void) {
  try {
    const col = collection(db, 'tecnicos');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data();
        return {
          _docId: d.id,
          id: data?.id?.trim() || d.id,
          nombre: data?.nombre ?? '',
          apellidos: data?.apellidos ?? '',
          ...data
        };
      }) as any[];
      callback(items);
    }, (err) => {
      console.error('subscribeTecnicos error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeTecnicos error:', e);
    return () => {};
  }
}

export async function saveTecnico(tecnico: Tecnico) {
  try {
    const cleanTecnico = {
      id: tecnico.id || '',
      nombre: tecnico.nombre,
      apellidos: tecnico.apellidos,
      habilitacion: tecnico.habilitacion || '',
      updatedAt: new Date().toISOString()
    };

    if (!tecnico._docId) {
      const ref = await addDoc(collection(db, 'tecnicos'), cleanTecnico);
      const savedTecnico = { ...cleanTecnico, id: cleanTecnico.id || ref.id };
      console.info('saveTecnico: created', ref.id, savedTecnico.nombre);
      return { _docId: ref.id, ...savedTecnico };
    }

    const ref = doc(db, 'tecnicos', tecnico._docId);
    await setDoc(ref, cleanTecnico, { merge: true });
    console.info('saveTecnico: updated', ref.id, cleanTecnico.nombre);
    return { _docId: ref.id, ...cleanTecnico };
  } catch (e) {
    console.error('saveTecnico error:', e);
    throw e;
  }
}

export async function deleteTecnico(id: string) {
  try {
    const ref = doc(db, 'tecnicos', id);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('deleteTecnico error:', e);
    throw e;
  }
}

export async function verifyUser(username: string, password: string) {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanUsername || !cleanPassword) return null;

  const checkUserMatch = (data: any, docId?: string) => {
    if (!data) return null;
    const uUsuario = (data['usuario'] ?? '').toString().trim().toLowerCase();
    const uNombre = (data['nombre'] ?? '').toString().trim().toLowerCase();
    const uApellidos = (data['apellidos'] ?? '').toString().trim().toLowerCase();
    const uFullName = `${uNombre} ${uApellidos}`.trim().toLowerCase();
    const uEmail = (data['email'] ?? '').toString().trim().toLowerCase();

    const storedPassword = (
      data['contraseña'] ??
      data['contrasena'] ??
      data['password'] ??
      data['clave'] ??
      ''
    ).toString().trim();

    // Solo coincide si el nombre/usuario introducido coincide exactamente con el usuario registrado
    const isUserMatch = (
      (uUsuario !== '' && uUsuario === cleanUsername) ||
      (uNombre !== '' && uNombre === cleanUsername) ||
      (uFullName !== '' && uFullName === cleanUsername) ||
      (uEmail !== '' && uEmail === cleanUsername)
    );

    // La contraseña debe coincidir estrictamente con la configurada en Firebase
    const isPassMatch = storedPassword !== '' && storedPassword === cleanPassword;

    if (isUserMatch && isPassMatch) {
      const nombre = data['nombre'] ?? data['usuario'] ?? username;
      const apellidos = data['apellidos'] ?? '';
      const rol = (data['rol'] ?? 'tecnico').toString().trim().toLowerCase();
      return {
        id: docId || data.id || data._docId || 'user_' + Date.now(),
        nombre,
        apellidos,
        rol
      };
    }
    return null;
  };

  // 1. Consultar estrictamente en Firestore (colección 'usuarios')
  try {
    const col = collection(db, 'usuarios');
    console.info('verifyUser: buscando usuario en Firestore colección "usuarios":', username);

    const snap = await getDocs(col);
    if (!snap.empty) {
      const allUsers = snap.docs.map(doc => ({ _docId: doc.id, ...doc.data() }));
      try {
        localStorage.setItem('firecheck_db_usuarios', JSON.stringify(allUsers));
      } catch (err) {
        console.warn('No se pudo guardar la lista de usuarios en localStorage:', err);
      }

      for (const doc of snap.docs) {
        const match = checkUserMatch(doc.data(), doc.id);
        if (match) {
          console.info('verifyUser: login exitoso en Firestore para', match.nombre, 'rol:', match.rol);
          return match;
        }
      }
    }
  } catch (e) {
    console.warn('verifyUser: Firestore inaccesible o inestable (modo offline):', e);
  }

  // 2. Fallback offline estricto: Consultar en caché local de usuarios de Firestore (firecheck_db_usuarios)
  try {
    const stored = localStorage.getItem('firecheck_db_usuarios');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        for (const u of parsed) {
          const match = checkUserMatch(u, u._docId || u.id);
          if (match) {
            console.info('verifyUser (offline fallback): login exitoso desde memoria local para', match.nombre, 'rol:', match.rol);
            return match;
          }
        }
      }
    }
  } catch (e) {
    console.error('verifyUser fallback error:', e);
  }

  console.warn('verifyUser: credenciales incorrectas para el usuario:', username);
  return null;
}

export const subscribeIngeniero = (onUpdate: (data: any) => void) => {
  const q = query(collection(db, 'ingeniero'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ 
      _docId: doc.id, 
      ...doc.data() 
    }));
    onUpdate(data[0] || null);
  });
};

export const saveIngeniero = async (id: string | null, data: any) => {
  if (id) {
    const docRef = doc(db, 'ingeniero', id);
    await updateDoc(docRef, data);
  } else {
    await addDoc(collection(db, 'ingeniero'), data);
  }
};

export const subscribeEmpresa = (onUpdate: (data: any) => void) => {
  const q = query(collection(db, 'empresa'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ 
      _docId: doc.id, 
      ...doc.data() 
    }));
    onUpdate(data[0] || null);
  });
};

export const subscribeEmpresas = (onUpdate: (data: Empresa[]) => void) => {
  const q = query(collection(db, 'empresa'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ 
      _docId: doc.id, 
      ...doc.data() 
    })) as Empresa[];
    onUpdate(data);
  });
};

export const subscribeTrabajos = (onUpdate: (data: TrabajoConfig[]) => void) => {
  const q = query(collection(db, 'trabajos'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => {
      const docData = doc.data();
      return {
        id: doc.id,
        opciones: Object.keys(docData).filter(k => k !== 'id' && k !== '_docId')
      };
    });
    // Sort by id for consistent display
    data.sort((a, b) => a.id.localeCompare(b.id));
    onUpdate(data);
  });
};

export const saveEmpresa = async (id: string | null, data: Empresa) => {
  if (id) {
    const docRef = doc(db, 'empresa', id);
    await updateDoc(docRef, data as Record<string, any>);
  } else {
    await addDoc(collection(db, 'empresa'), data);
  }
};

export const deleteEmpresa = async (id: string) => {
  const docRef = doc(db, 'empresa', id);
  await deleteDoc(docRef);
};

export const uploadFile = async (file: File, path: string) => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Error al subir archivo a Firebase Storage:", error);
    throw error;
  }
};

export function subscribeClientes(callback: (clientes: Cliente[]) => void) {
  try {
    const col = collection(db, 'clientes');
    return onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Cliente[];
      items.sort((a, b) => ((a as any).nombreFiscal || a.nombre || '').localeCompare((b as any).nombreFiscal || b.nombre || ''));
      callback(items);
    });
  } catch (e) {
    console.error('subscribeClientes error:', e);
    return () => {};
  }
}

export async function addCentro(centro: Centro) {
  try {
    const col = collection(db, 'centros');
    const ref = await addDoc(col, { ...centro, updatedAt: new Date().toISOString() });
    console.info('addCentro: added new document', ref.id, 'data:', centro);
    return { _docId: ref.id, ...centro };
  } catch (e) {
    console.error('addCentro error:', e);
    throw e;
  }
}

export async function updateCentro(id: string, centro: Centro) {
  try {
    const ref = doc(db, 'centros', id);
    await setDoc(ref, { ...centro, updatedAt: new Date().toISOString() }, { merge: true });
    const centroId = centro.id ?? id;
    return { _docId: id, ...centro, id: centroId };
  } catch (e) {
    console.error('updateCentro error:', e);
    throw e;
  }
}

export async function saveContrato(centroDocId: string, contratoData: any) {
  try {
    const ref = doc(db, 'contratos', centroDocId);
    await setDoc(ref, {
      ...contratoData,
      centroId: centroDocId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (e) {
    console.error('saveContrato error:', e);
    throw e;
  }
}

export async function syncContratosExistentes(centros: Centro[]) {
  try {
    const contratosCol = collection(db, 'contratos');
    const snap = await getDocs(contratosCol);
    const existingContractDocIds = new Set(snap.docs.map(d => d.id));

    for (const centro of centros) {
      const docId = centro._docId || centro.id;
      if (centro.numeroContrato && !existingContractDocIds.has(docId)) {
        console.info('Sincronizando contrato para el centro:', centro.nombre);
        const ref = doc(db, 'contratos', docId);
        await setDoc(ref, {
          clienteId: centro.clienteId || '',
          numeroContrato: centro.numeroContrato,
          fechaInicioContrato: centro.fechaInicioContrato || '',
          fechaFinContrato: centro.fechaFinContrato || '',
          importeAnualContrato: centro.importeAnualContrato || '',
          observacionesContrato: centro.observacionesContrato || '',
          periodicidad: centro.periodicidad || [],
          sistemasContrato: (centro as any).sistemasContrato || (centro.observacionesContrato ? centro.observacionesContrato.split(', ').filter(Boolean) : []),
          precioAnualContrato: (centro as any).precioAnualContrato || '',
          precioTrimestralContrato: (centro as any).precioTrimestralContrato || '',
          precioMensualContrato: (centro as any).precioMensualContrato || '',
          centroId: docId,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }
  } catch (e) {
    console.error('Error in syncContratosExistentes:', e);
  }
}

export async function deleteCentro(id: string) {
  try {
    const ref = doc(db, 'centros', id);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('deleteCentro error:', e);
    throw e;
  }
}

export async function getCentros(): Promise<Centro[]> {
  try {
    const col = collection(db, 'centros');
    const snap = await getDocs(col);
    return snap.docs.map(d => {
      const data = d.data() as any;
      return { _docId: d.id, id: data?.id ?? d.id, ...data };
    });
  } catch (e) {
    console.error('getCentros error:', e);
    throw e;
  }
}

export function subscribeCentros(callback: (centros: Centro[]) => void) {
  try {
    const col = collection(db, 'centros');
    const unsub = onSnapshot(col, (snap) => {
      console.info('subscribeCentros: snapshot received, size=', snap.size);
      const rawItems = snap.docs.map(d => {
        const data = d.data() as any;
        return { _docId: d.id, id: data?.id ?? d.id, ...data } as Centro;
      });

      // Desduplicar centros por código id único
      const seenIds = new Set<string>();
      const items: Centro[] = [];
      for (const item of rawItems) {
        const uniqueKey = item.id || item._docId;
        if (uniqueKey && !seenIds.has(uniqueKey)) {
          seenIds.add(uniqueKey);
          items.push(item);
        }
      }

      items.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      console.info('subscribeCentros: items=', items);
      callback(items);
    }, (err) => {
      console.error('subscribeCentros error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeCentros error:', e);
    return () => {};
  }
}

export function getCollectionName(catNombre: string) {
  return catNombre
    .replace(/^sistema\s+/i, '')
    .toLowerCase()
    .trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, '_');
}

export async function addSistemaCategoria(categoria: SistemaCategoria) {
  try {
    const systemId = getCollectionName(categoria.nombre);
    const ref = doc(db, 'sistemas', systemId);
    const data: any = { 
      id: systemId, 
      nombre: categoria.nombre.toUpperCase(), 
      updatedAt: new Date().toISOString() 
    };
    if (categoria.imagenUrl) {
      data.imagenUrl = categoria.imagenUrl;
    }
    await setDoc(ref, data);
    return { id: systemId, nombre: categoria.nombre, imagenUrl: categoria.imagenUrl };
  } catch (e) {
    console.error('addSistemaCategoria error:', e);
    throw e;
  }
}

export async function updateSistemaCategoria(id: string, categoria: Partial<SistemaCategoria>) {
  try {
    const ref = doc(db, 'sistemas', id);
    const data: any = { ...categoria, updatedAt: new Date().toISOString() };
    // Permitir borrar imagenUrl explícitamente con null
    if (categoria.imagenUrl === null) {
      data.imagenUrl = null;
    }
    await setDoc(ref, data, { merge: true });
    return { _docId: id, ...categoria };
  } catch (e) {
    console.error('updateSistemaCategoria error:', e);
    throw e;
  }
}

export async function deleteSistemaCategoria(id: string) {
  try {
    const ref = doc(db, 'sistemas', id);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('deleteSistemaCategoria error:', e);
    throw e;
  }
}

export async function getSistemasCategorias() {
  try {
    const col = collection(db, 'sistemas');
    const snap = await getDocs(col);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SistemaCategoria[];
  } catch (e) {
    console.error('getSistemasCategorias error:', e);
    throw e;
  }
}

export function subscribeSistemasCategorias(callback: (categorias: SistemaCategoria[]) => void) {
  try {
    const col = collection(db, 'sistemas');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SistemaCategoria[];
      callback(items);
    }, (err) => {
      console.error('subscribeSistemasCategorias error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeSistemasCategorias error:', e);
    return () => {};
  }
}

export function subscribeEquiposBySystem(catNombre: string, callback: (equipos: SistemaEquipo[]) => void) {
  try {
    const systemId = getCollectionName(catNombre);
    const col = collection(db, 'sistemas', systemId, 'equipos');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return { ...data, id: d.id };
      }) as SistemaEquipo[];
      callback(items);
    }, (err) => {
      console.error(`Error en suscripción a equipos de ${systemId}:`, err);
    });
    return unsub;
  } catch (e) {
    return () => {};
  }
}

export async function saveEquipoToSystemCollection(catNombre: string, equipo: SistemaEquipo) {
  try {
    const systemId = getCollectionName(catNombre);
    const ref = doc(db, 'sistemas', systemId, 'equipos', equipo.id);
    await setDoc(ref, { 
      ...equipo, 
      updatedAt: new Date().toISOString() 
    });
    return true;
  } catch (e) {
    console.error('Error al guardar equipo en Firestore:', e);
    throw e;
  }
}

export async function deleteEquipoFromSystemCollection(catNombre: string, equipoId: string) {
  try {
    const systemId = getCollectionName(catNombre);
    const ref = doc(db, 'sistemas', systemId, 'equipos', equipoId);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('Error al eliminar equipo de Firestore:', e);
    throw e;
  }
}

export async function getEquiposInstalados(centroId: string, sistemaId: string): Promise<any[]> {
  try {
    let col = collection(db, 'centros', centroId, 'inventario', sistemaId, 'equipos');
    let snap = await getDocs(col);
    if (snap.empty) {
      col = collection(db, 'centros', centroId, 'sistemas', sistemaId, 'equipos');
      snap = await getDocs(col);
    }
    return snap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, _docId: d.id, centroId, sistemaId, ...data };
    });
  } catch (e) {
    console.error('getEquiposInstalados error:', e);
    return [];
  }
}

export async function syncSistemas(categorias: SistemaCategoria[], equipos: SistemaEquipo[]) {
  try {
    for (const cat of categorias) {
      const systemId = getCollectionName(cat.nombre);
      const catRef = doc(db, 'sistemas', systemId);
      
      await setDoc(catRef, { id: systemId, nombre: cat.nombre, updatedAt: new Date().toISOString() });

      const equiposDelSistema = equipos.filter(e => e.idCategoria === cat.id);
      for (const eq of equiposDelSistema) {
        const ref = doc(db, 'sistemas', systemId, 'equipos', eq.id);
        await setDoc(ref, { 
          ...eq, 
          updatedAt: new Date().toISOString() 
        });
      }
    }
    return true;
  } catch (e: any) {
    console.error('Error en syncSistemas:', e);
    throw e;
  }
}

export async function getArticulos() {
  try {
    const col = collection(db, 'articulos');
    const snap = await getDocs(col);
    return snap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, ...data };
    }) as Articulo[];
  } catch (e) {
    console.error('getArticulos error:', e);
    throw e;
  }
}

export function subscribeArticulos(callback: (articulos: Articulo[]) => void) {
  try {
    const col = collection(db, 'articulos');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, ...data };
      }) as Articulo[];
      callback(items);
    }, (err) => {
      console.error('subscribeArticulos error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeArticulos error:', e);
    return () => {};
  }
}

export async function saveArticulo(articulo: Articulo) {
  try {
    const col = collection(db, 'articulos');
    const cleanArticulo = Object.fromEntries(
      Object.entries(articulo).filter(([, value]) => value !== undefined)
    ) as Articulo;
    if (cleanArticulo && cleanArticulo.id) {
      const ref = doc(db, 'articulos', cleanArticulo.id);
      await setDoc(ref, { 
        ...cleanArticulo, 
        updatedAt: new Date().toISOString() 
      });
      return { ...cleanArticulo, id: ref.id };
    } else {
      const ref = await addDoc(col, { 
        ...cleanArticulo, 
        updatedAt: new Date().toISOString() 
      });
      return { ...cleanArticulo, id: ref.id };
    }
  } catch (e) {
    console.error('saveArticulo error:', e);
    throw e;
  }
}

export async function deleteArticulo(id: string) {
  try {
    const ref = doc(db, 'articulos', id);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('deleteArticulo error:', e);
    throw e;
  }
}

const mapFamiliaDoc = (docId: string, data: any): Familia | null => {
  const nombre = String(data?.nombre ?? data?.familia ?? data?.name ?? docId).trim();
  if (!nombre) return null;
  return { id: docId, nombre };
};

export async function getFamilias() {
  try {
    const col = collection(db, 'familias');
    const snap = await getDocs(col);
    return snap.docs
      .map(d => mapFamiliaDoc(d.id, d.data()))
      .filter((familia): familia is Familia => familia !== null)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  } catch (e) {
    console.error('getFamilias error:', e);
    throw e;
  }
}

export function subscribeFamilias(callback: (familias: Familia[]) => void) {
  try {
    const col = collection(db, 'familias');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs
        .map(d => mapFamiliaDoc(d.id, d.data()))
        .filter((familia): familia is Familia => familia !== null)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
      callback(items);
    }, (err) => {
      console.error('subscribeFamilias error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeFamilias error:', e);
    return () => {};
  }
}

function isFirmaValida(firma: string | undefined): boolean {
  if (!firma) return false;
  if (firma.length <= 4400) return false;
  if (firma.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAADICAYAAAA0n5+2')) return false;
  return true;
}

async function enviarCorreoAlbaran(albaran: Albaran) {
  try {
    // Solo enviar el albarán si ha sido firmado por el cliente (lo que indica que está finalizado y firmado)
    if (!isFirmaValida(albaran.firmaCliente)) {
      console.info(`enviarCorreoAlbaran: No se envía correo porque el albarán ${albaran.id || ''} no tiene una firma válida del cliente.`);
      return;
    }

    // 1. Obtener detalles del cliente para el correo
    let clienteName = 'Cliente desconocido';
    let clienteCif = '-';
    let clienteDireccion = '';
    let clientePoblacion = '';
    let clienteProvincia = '';
    let clienteCp = '';
    if (albaran.clienteId) {
      try {
        const clientDocRef = doc(db, 'clientes', albaran.clienteId);
        const clientSnap = await getDoc(clientDocRef);
        if (clientSnap.exists()) {
          const clientData = clientSnap.data();
          if (clientData) {
            clienteName = clientData.nombre || 'Cliente sin nombre';
            clienteCif = clientData.cif || '-';
            clienteDireccion = clientData.direccion || '';
            clientePoblacion = clientData.poblacion || '';
            clienteProvincia = clientData.provincia || '';
            clienteCp = clientData.cp || '';
          }
        }
      } catch (err) {
        console.error("Error fetching client details for email:", err);
      }
    }

    // 2. Obtener detalles del centro para el correo
    let centroName = 'Centro desconocido';
    let centroDireccion = '';
    let centroPoblacion = '';
    let centroProvincia = '';
    let centroCp = '';
    if (albaran.centroId) {
      try {
        const centroDocRef = doc(db, 'centros', albaran.centroId);
        const centroSnap = await getDoc(centroDocRef);
        if (centroSnap.exists()) {
          const centroData = centroSnap.data();
          if (centroData) {
            centroName = centroData.nombre || 'Centro sin nombre';
            centroDireccion = centroData.direccion || '';
            centroPoblacion = centroData.poblacion || '';
            centroProvincia = centroData.provincia || '';
            centroCp = centroData.cp || '';
          }
        }
      } catch (err) {
        console.error("Error fetching centro details for email:", err);
      }
    }

    // 3. Obtener nombre del técnico para el correo
    let tecnicoNombre = 'No asignado';
    if (albaran.tecnicoId) {
      try {
        const docRef = doc(db, 'tecnicos', albaran.tecnicoId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          tecnicoNombre = `${data?.nombre || ''} ${data?.apellidos || ''}`.trim();
        } else {
          const q = query(collection(db, 'tecnicos'), where('id', '==', albaran.tecnicoId));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const data = querySnap.docs[0].data();
            tecnicoNombre = `${data?.nombre || ''} ${data?.apellidos || ''}`.trim();
          }
        }
      } catch (err) {
        console.error("Error fetching tecnico for email:", err);
      }
    }

    const docId = albaran.id || 'NUEVO';
    const collectionsToTrigger = ['mail', 'emails', 'mails', 'email'];
    
    // Formatear la fecha
    let fechaStr = '';
    try {
      if (albaran.fechaCreacion) {
        fechaStr = new Date(albaran.fechaCreacion).toLocaleDateString('es-ES');
      } else {
        fechaStr = new Date().toLocaleDateString('es-ES');
      }
    } catch {
      fechaStr = albaran.fechaCreacion || '';
    }

    // Formatear asunto del correo
    let subjectStr = `Albarán recibido de : ${clienteName}`;
    if (centroName && centroName !== 'Centro desconocido' && centroName !== clienteName) {
      subjectStr = `Albarán recibido de : ${clienteName} / ${centroName}`;
    }

    // Formatear moneda
    const formatMoneda = (val: number) => {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val || 0);
    };

    let itemsHtml = '';
    let subtotalTotal = 0;
    if (albaran.items && albaran.items.length > 0) {
      itemsHtml = albaran.items.map(item => {
        const sub = item.subtotal || (item.cantidad * item.precioUnidad) || 0;
        subtotalTotal += sub;
        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.cantidad}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;"><b>${item.concepto || ''}</b></td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.descripcion || ''}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatMoneda(item.precioUnidad)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatMoneda(sub)}</td>
          </tr>
        `;
      }).join('');
    }

    const ivaImporte = subtotalTotal * 0.21;
    const totalConIva = subtotalTotal + ivaImporte;

    const emailPayload = {
      to: 'abanfoc@abanfoc.es',
      message: {
        subject: subjectStr,
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #800020; border-bottom: 2px solid #800020; padding-bottom: 10px; margin-top: 0;">Detalles del Albarán: ${docId}</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="width: 50%; vertical-align: top; padding-right: 10px;">
                  <h4 style="color: #666; margin: 10px 0 5px 0; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Datos del Cliente</h4>
                  <p style="margin: 0; font-size: 14px;"><b>${clienteName}</b></p>
                  <p style="margin: 3px 0 0 0; font-size: 13px; color: #555;">CIF: ${clienteCif}</p>
                  <p style="margin: 3px 0 0 0; font-size: 13px; color: #555;">${clienteDireccion}</p>
                  <p style="margin: 3px 0 0 0; font-size: 13px; color: #555;">${[clienteCp, clientePoblacion, clienteProvincia].filter(Boolean).join(', ')}</p>
                </td>
                <td style="width: 50%; vertical-align: top; padding-left: 10px; border-left: 1px solid #eee;">
                  <h4 style="color: #666; margin: 10px 0 5px 0; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Datos de la Instalación (Centro)</h4>
                  <p style="margin: 0; font-size: 14px;"><b>${centroName}</b></p>
                  <p style="margin: 3px 0 0 0; font-size: 13px; color: #555;">${centroDireccion}</p>
                  <p style="margin: 3px 0 0 0; font-size: 13px; color: #555;">${[centroCp, centroPoblacion, centroProvincia].filter(Boolean).join(', ')}</p>
                </td>
              </tr>
            </table>

            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #f0f0f0;">
              <h4 style="color: #666; margin: 0 0 10px 0; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Información del Albarán</h4>
              <table style="width: 100%; font-size: 13px; line-height: 1.5;">
                <tr>
                  <td style="width: 40%; color: #666;"><b>Título:</b></td>
                  <td>${albaran.titulo || '-'}</td>
                </tr>
                <tr>
                  <td style="color: #666;"><b>Fecha:</b></td>
                  <td>${fechaStr}</td>
                </tr>
                <tr>
                  <td style="color: #666;"><b>Nº Mantenimiento:</b></td>
                  <td>${albaran.numeroMantenimiento || '-'}</td>
                </tr>
                <tr>
                  <td style="color: #666;"><b>N. Pedido:</b></td>
                  <td>${albaran.numeroPedido || '-'}</td>
                </tr>
                <tr>
                  <td style="color: #666;"><b>Periodicidad:</b></td>
                  <td>${albaran.periodicidad || '-'}</td>
                </tr>
                <tr>
                  <td style="color: #666;"><b>Técnico:</b></td>
                  <td>${tecnicoNombre}</td>
                </tr>
                <tr>
                  <td style="color: #666;"><b>Firmado por Cliente:</b></td>
                  <td>${albaran.firmaCliente ? `Sí (Receptor: ${albaran.nombreFirmante || 'No especificado'})` : 'No'}</td>
                </tr>
              </table>
            </div>

            <h4 style="color: #666; margin: 15px 0 10px 0; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Detalle de Líneas de Trabajo</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #800020; color: #ffffff;">
                  <th style="padding: 10px 8px; text-align: center; border-radius: 6px 0 0 0;">Cant.</th>
                  <th style="padding: 10px 8px; text-align: left;">Concepto</th>
                  <th style="padding: 10px 8px; text-align: left;">Descripción</th>
                  <th style="padding: 10px 8px; text-align: right;">Precio ud.</th>
                  <th style="padding: 10px 8px; text-align: right; border-radius: 0 6px 0 0;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml || '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #888;">No hay líneas de trabajo en este albarán.</td></tr>'}
              </tbody>
            </table>

            ${subtotalTotal > 0 ? `
              <table style="width: 40%; margin-left: auto; font-size: 13px; line-height: 1.6; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #666;">Subtotal:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold;">${formatMoneda(subtotalTotal)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #666; border-bottom: 1px solid #eee;">IVA (21%):</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold; border-bottom: 1px solid #eee;">${formatMoneda(ivaImporte)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0 4px 0; font-size: 15px; color: #800020; font-weight: bold;">Total + IVA:</td>
                  <td style="padding: 8px 0 4px 0; text-align: right; font-size: 15px; color: #800020; font-weight: bold;">${formatMoneda(totalConIva)}</td>
                </tr>
              </table>
            ` : ''}
            
            <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px; text-align: center; font-size: 11px; color: #999;">
              <p>Este es un correo automático generado por el sistema de gestión de Abanfoc.</p>
            </div>
          </div>
        `
      }
    };

    for (const colName of collectionsToTrigger) {
      try {
        const mailCol = collection(db, colName);
        await addDoc(mailCol, emailPayload);
        console.info(`Correo de albarán registrado en la colección '${colName}' de Firestore`);
      } catch (mailErr) {
        console.error(`Error al registrar el correo de albarán en la colección '${colName}':`, mailErr);
      }
    }
  } catch (err) {
    console.error("Error global en enviarCorreoAlbaran:", err);
  }
}

export async function addAlbaran(albaran: Albaran) {
  try {
    const col = collection(db, 'albaranes');
    
    const albaranToSave = {
      ...albaran,
      updatedAt: new Date().toISOString()
    };

    let finalAlbaran: Albaran;

    if (albaran.id) {
      const docRef = doc(db, 'albaranes', albaran.id);
      await setDoc(docRef, albaranToSave);
      console.info('addAlbaran: created with custom ID', albaran.id);
      finalAlbaran = { ...albaranToSave, _docId: albaran.id };
    } else {
      const newDocRef = await addDoc(col, albaranToSave);
      console.info('addAlbaran: created with generated ID', newDocRef.id);
      const { id: _, ...rest } = albaranToSave;
      finalAlbaran = { ...rest, _docId: newDocRef.id, id: newDocRef.id };
    }

    try {
      await enviarCorreoAlbaran(finalAlbaran);
    } catch (emailErr) {
      console.error('Error in enviarCorreoAlbaran inside addAlbaran:', emailErr);
    }

    return finalAlbaran;
  } catch (e) {
    console.error('addAlbaran error:', e);
    throw e;
  }
}

export async function updateAlbaran(albaran: Albaran) {
  try {
    if (!albaran.id) {
      throw new Error("Albaran ID is required for update.");
    }
    const docRef = doc(db, 'albaranes', albaran.id);

    // Verificar si ya estaba firmado en la base de datos
    let alreadySigned = false;
    try {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as Albaran;
        if (existingData && isFirmaValida(existingData.firmaCliente)) {
          alreadySigned = true;
        }
      }
    } catch (readErr) {
      console.warn("No se pudo leer la firma anterior del albarán:", readErr);
    }

    const albaranToUpdate = {
      ...albaran,
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, albaranToUpdate, { merge: true });
    console.info('updateAlbaran: updated', albaran.id);

    // Solo enviar correo si antes NO estaba firmado y ahora SÍ está firmado
    if (!alreadySigned && isFirmaValida(albaranToUpdate.firmaCliente)) {
      try {
        await enviarCorreoAlbaran(albaranToUpdate);
      } catch (emailErr) {
        console.error('Error in enviarCorreoAlbaran inside updateAlbaran:', emailErr);
      }
    } else {
      console.info(`enviarCorreoAlbaran omitido en actualización del albarán ${albaran.id}: ya firmado (${alreadySigned}) o sin firma válida.`);
    }

    return { _docId: albaran.id, ...albaranToUpdate };
  } catch (e) {
    console.error('updateAlbaran error:', e);
    throw e;
  }
}

export async function deleteAlbaran(id: string) {
  try {
    const docRef = doc(db, 'albaranes', id);
    await deleteDoc(docRef);
    console.info('deleteAlbaran: deleted', id);
    return true;
  } catch (e) {
    console.error('deleteAlbaran error:', e);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PEDIDOS - Firestore CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function addPedido(pedido: Pedido) {
  try {
    const pedidoToSave = { ...pedido, updatedAt: new Date().toISOString() };
    const col = collection(db, 'pedidos');
    if (pedido.id) {
      const docRef = doc(db, 'pedidos', pedido.id);
      await setDoc(docRef, pedidoToSave);
      return { ...pedidoToSave, _docId: pedido.id };
    } else {
      const ref = await addDoc(col, pedidoToSave);
      return { ...pedidoToSave, _docId: ref.id, id: ref.id };
    }
  } catch (e) {
    console.error('addPedido error:', e);
    throw e;
  }
}

export async function updatePedido(id: string, pedido: Partial<Pedido>) {
  try {
    const ref = doc(db, 'pedidos', id);
    await setDoc(ref, { ...pedido, updatedAt: new Date().toISOString() }, { merge: true });
    return { _docId: id, ...pedido };
  } catch (e) {
    console.error('updatePedido error:', e);
    throw e;
  }
}

export async function deletePedido(id: string) {
  try {
    const ref = doc(db, 'pedidos', id);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('deletePedido error:', e);
    throw e;
  }
}

export function subscribePedidos(callback: (pedidos: Pedido[]) => void) {
  try {
    const col = collection(db, 'pedidos');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          _docId: d.id,
          id: data?.id ?? d.id,
          empresaId: data?.empresaId || '',
          clienteId: data?.clienteId || '',
          centroId: data?.centroId || '',
          titulo: data?.titulo || '',
          fechaCreacion: data?.fechaCreacion || new Date().toISOString(),
          fechaPrevista: data?.fechaPrevista || '',
          items: Array.isArray(data?.items) ? data.items : [],
          estado: data?.estado || 'Pendiente',
          presupuestoId: data?.presupuestoId || '',
          numeroPedido: data?.numeroPedido || data?.id || '',
          notas: data?.notas || '',
        } as Pedido;
      });
      callback(items);
    }, (err) => {
      console.error('subscribePedidos error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribePedidos error:', e);
    return () => {};
  }
}

export function subscribeAlbaranes(callback: (albaranes: Albaran[]) => void) {
  try {
    const col = collection(db, 'albaranes');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Albaran[];
      items.sort((a, b) => ((b as any).fecha || b.fechaCreacion || '').localeCompare((a as any).fecha || a.fechaCreacion || ''));
      callback(items);
    }, (err) => {
      console.error('subscribeAlbaranes error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeAlbaranes error:', e);
    return () => {};
  }
}

export interface Certificado {
  id: string;
  _docId?: string;
  clienteId: string;
  centroId: string;
  empresaId: string;
  parteId: string;
  numeroMantenimiento: string;
  fechaCreacion: string;
  estado: string;
  tecnicoId?: string;
  tipoCertificado?: 'revision' | 'instalacion' | 'reparacion' | 'puesta_en_marcha' | 'obligacion_salarial' | 'generico' | string;
  tituloCertificado?: string;
  textoCertificado?: string;
  observaciones?: string;
  esManual?: boolean;
}

export async function addCertificado(certificado: Certificado) {
  try {
    const col = collection(db, 'certificados');
    const certToSave = {
      ...certificado,
      updatedAt: new Date().toISOString()
    };
    if (certificado.id) {
      const docRef = doc(db, 'certificados', certificado.id);
      await setDoc(docRef, certToSave);
      console.info('addCertificado: created/updated with custom ID', certificado.id);
      return { ...certToSave, _docId: certificado.id };
    } else {
      const newDocRef = await addDoc(col, certToSave);
      console.info('addCertificado: created with generated ID', newDocRef.id);
      return { ...certToSave, _docId: newDocRef.id, id: newDocRef.id };
    }
  } catch (e) {
    console.error('addCertificado error:', e);
    throw e;
  }
}

export async function deleteCertificado(id: string) {
  try {
    const docRef = doc(db, 'certificados', id);
    await deleteDoc(docRef);
    console.info('deleteCertificado: deleted', id);
    return true;
  } catch (e) {
    console.error('deleteCertificado error:', e);
    throw e;
  }
}

export function subscribeCertificados(callback: (certificados: Certificado[]) => void) {
  try {
    const col = collection(db, 'certificados');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data();
        return {
          _docId: d.id,
          id: data.id || d.id,
          clienteId: data.clienteId || '',
          centroId: data.centroId || '',
          empresaId: data.empresaId || '',
          parteId: data.parteId || '',
          numeroMantenimiento: data.numeroMantenimiento || '',
          fechaCreacion: data.fechaCreacion || new Date().toISOString(),
          estado: data.estado || '',
          tecnicoId: data.tecnicoId || '',
          tipoCertificado: data.tipoCertificado || 'revision',
          tituloCertificado: data.tituloCertificado || '',
          textoCertificado: data.textoCertificado || '',
          observaciones: data.observaciones || '',
          esManual: data.esManual === true,
        } as Certificado;
      });
      items.sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));
      callback(items);
    }, (err) => {
      console.error('subscribeCertificados error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeCertificados error:', e);
    return () => {};
  }
}

export interface ParteFirestore {
  id: string;
  centroId: string;
  nombreCentro?: string;
  clienteId: string;
  fechaCreacion: string;
  tecnicoId: string;
  empresaId?: string;
  periodicidad: string;
  mesesRevision: string;
  estado: 'Planificado' | 'Abierto' | 'En revisión' | 'Descargado (Offline)' | 'Finalizado' | 'Cerrado' | 'Pre-Cerrado' | 'Retimbrando';
  tipoTrabajo?: string;
  numeroMantenimiento?: string;
  fechaProgramada?: string;
  _docId?: string;
  retirarExtintoresRetimbrado?: boolean;
  dejarExtintoresDeposito?: boolean;
  cantidadExtintoresDeposito?: number;
  retimbradoReiniciado?: boolean;
  observacionesTecnico?: string;
  cantidadRetimbrados?: number;
  comentariosPrivados?: string;
  equiposRetirados?: boolean;
  retimbrado?: boolean;
}

export async function generateNumeroMantenimiento(): Promise<string> {
  const year = new Date().getFullYear();
  let maxCorr = 0;
  try {
    const partesSnap = await getDocs(collection(db, 'partes'));
    partesSnap.forEach(d => {
      const num = d.data().numeroMantenimiento;
      if (num && typeof num === 'string' && num.startsWith(`MANT-${year}-`)) {
        const corrStr = num.split('-')[2];
        const corr = parseInt(corrStr, 10);
        if (!isNaN(corr) && corr > maxCorr) {
          maxCorr = corr;
        }
      }
    });
  } catch (e) {
    console.error('Error calculando correlativo', e);
  }
  const nextCorr = (maxCorr + 1).toString().padStart(4, '0');
  return `MANT-${year}-${nextCorr}`;
}

export async function addParte(parte: ParteFirestore) {
  try {
    const parteToSave = { ...parte, updatedAt: new Date().toISOString() };
    
    // Generar numeroMantenimiento si no existe
    if (!parteToSave.numeroMantenimiento) {
      parteToSave.numeroMantenimiento = await generateNumeroMantenimiento();
    }

    if (parte.id) {
      const ref = doc(db, 'partes', parte.id);
      await setDoc(ref, parteToSave);
      return { ...parteToSave, _docId: parte.id };
    } else {
      const col = collection(db, 'partes');
      const ref = await addDoc(col, parteToSave);
      return { ...parteToSave, _docId: ref.id, id: ref.id };
    }
  } catch (e) {
    console.error('addParte error:', e);
    throw e;
  }
}

export async function updateParte(id: string, parte: Partial<ParteFirestore>) {
  try {
    const ref = doc(db, 'partes', id);
    await setDoc(ref, { ...parte, updatedAt: new Date().toISOString() }, { merge: true });
    return { _docId: id, ...parte };
  } catch (e) {
    console.error('updateParte error:', e);
    throw e;
  }
}

export async function deleteParte(id: string) {
  try {
    const ref = doc(db, 'partes', id);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('deleteParte error:', e);
    throw e;
  }
}

export function subscribePartes(callback: (partes: ParteFirestore[]) => void) {
  try {
    const col = collection(db, 'partes');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return { _docId: d.id, id: data?.id ?? d.id, ...data };
      }) as ParteFirestore[];
      items.sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));
      callback(items);
    }, (err) => {
      console.error('subscribePartes error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribePartes error:', e);
    return () => {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESUPUESTOS - Firestore CRUD
// ─────────────────────────────────────────────────────────────────────────────

/** Genera un número de presupuesto correlativo con formato año.contador (ej: 26.3300)
 *  El contador se almacena en Firestore en un documento de la colección "contadores" */
async function getNextPresupuestoNumero(): Promise<string> {
  const ano = new Date().getFullYear().toString().slice(-2); // "26" para 2026
  const counterDocRef = doc(db, 'contadores', 'presupuestos');
  
  try {
    const { runTransaction } = await import('firebase/firestore');
    const result = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(counterDocRef);
      let nextNum: number;
      if (!docSnap.exists()) {
        nextNum = 3300;
        transaction.set(counterDocRef, { año: Number(ano), ultimoNumero: nextNum });
      } else {
        const data = docSnap.data();
        const añoGuardado = data?.año || 0;
        if (añoGuardado < Number(ano)) {
          nextNum = 0;
          transaction.update(counterDocRef, { año: Number(ano), ultimoNumero: nextNum });
        } else {
          nextNum = (data?.ultimoNumero || 0) + 1;
          transaction.update(counterDocRef, { ultimoNumero: nextNum });
        }
      }
      return nextNum;
    });
    return `${ano}.${String(result).padStart(4, '0')}`;
  } catch (e) {
    console.error('Error generando número de presupuesto:', e);
    return `${ano}.${String(Date.now()).slice(-4)}`;
  }
}

export async function addPresupuesto(presupuesto: Presupuesto) {
  try {
    const nuevoNumero = await getNextPresupuestoNumero();
    const presupuestoToSave = {
      ...presupuesto,
      numeroPresupuesto: nuevoNumero,
      id: presupuesto.id || `PRE-${Date.now()}`,
      updatedAt: new Date().toISOString()
    };

    const col = collection(db, 'presupuestos');
    const ref = await addDoc(col, presupuestoToSave);
    return { ...presupuestoToSave, _docId: ref.id, id: ref.id };
  } catch (e) {
    console.error('addPresupuesto error:', e);
    throw e;
  }
}

export async function updatePresupuesto(id: string, presupuesto: Partial<Presupuesto>) {
  try {
    const ref = doc(db, 'presupuestos', id);
    await setDoc(ref, { ...presupuesto, updatedAt: new Date().toISOString() }, { merge: true });
    return { _docId: id, ...presupuesto };
  } catch (e) {
    console.error('updatePresupuesto error:', e);
    throw e;
  }
}

export async function deletePresupuesto(id: string) {
  try {
    const ref = doc(db, 'presupuestos', id);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('deletePresupuesto error:', e);
    throw e;
  }
}

export function subscribePresupuestos(callback: (presupuestos: Presupuesto[]) => void) {
  try {
    const col = collection(db, 'presupuestos');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
      return {
        _docId: d.id,
        id: data?.id ?? d.id,
        titulo: data?.titulo || '',
        numeroPresupuesto: data?.numeroPresupuesto || data?.id || '',
        clienteId: data?.clienteId || '',
        nombreCliente: data?.nombreCliente || '',
        centroId: data?.centroId || '',
        fechaCreacion: data?.fechaCreacion || new Date().toISOString(),
        fechaValidez: data?.fechaValidez || '',
        estado: data?.estado || 'Borrador',
        lineas: Array.isArray(data?.lineas) ? data.lineas : [],
        subtotal: typeof data?.subtotal === 'number' ? data.subtotal : 0,
        iva: typeof data?.iva === 'number' ? data.iva : 21,
        total: typeof data?.total === 'number' ? data.total : 0,
        notas: data?.notas || '',
      } as Presupuesto;
      });
      items.sort((a, b) => (b.fechaCreacion || (a as any).fecha || '').localeCompare(a.fechaCreacion || (b as any).fecha || ''));
      callback(items);
    }, (err) => {
      console.error('subscribePresupuestos error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribePresupuestos error:', e);
    return () => {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CENTROS → SISTEMAS → EQUIPOS
// ─────────────────────────────────────────────────────────────────────────────

export function sistemaToSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .trim();
}

export interface CentroSistemaFirestore {
  id: string;
  centroId: string;
  tipo: string;
  familia: string;
  descripcion: string;
  _docId?: string;
}

export async function addCentroSistema(sistema: CentroSistemaFirestore) {
  try {
    const slug = sistemaToSlug(sistema.tipo || sistema.familia || sistema.id);
    const ref = doc(db, 'centros', sistema.centroId, 'inventario', slug);
    await setDoc(ref, {
      id: slug,
      centroId: sistema.centroId,
      tipo: sistema.tipo,
      familia: sistema.familia,
      descripcion: sistema.descripcion || '',
      updatedAt: new Date().toISOString()
    });
    return { ...sistema, id: slug, _docId: slug };
  } catch (e) {
    console.error('addCentroSistema error:', e);
    throw e;
  }
}

export async function updateCentroSistema(centroId: string, sistemaId: string, sistema: Partial<CentroSistemaFirestore>) {
  try {
    const ref = doc(db, 'centros', centroId, 'inventario', sistemaId);
    await setDoc(ref, { ...sistema, updatedAt: new Date().toISOString() }, { merge: true });
    return { _docId: sistemaId, ...sistema };
  } catch (e) {
    console.error('updateCentroSistema error:', e);
    throw e;
  }
}

export async function deleteCentroSistema(centroId: string, sistemaId: string) {
  try {
    const ref = doc(db, 'centros', centroId, 'inventario', sistemaId);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('deleteCentroSistema error:', e);
    throw e;
  }
}

export function subscribeCentroSistemas(centroId: string, callback: (sistemas: CentroSistemaFirestore[]) => void) {
  try {
    const colInventario = collection(db, 'centros', centroId, 'inventario');
    const unsub = onSnapshot(colInventario, (snap) => {
      const sistemas = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          _docId: d.id,
          id: data?.id || d.id,
          centroId: data?.centroId || centroId,
          tipo: data?.tipo || d.id,
          familia: data?.familia || data?.tipo || d.id,
          descripcion: data?.descripcion || ''
        } as CentroSistemaFirestore;
      });
      callback(sistemas);
    }, (err) => {
      console.error('subscribeCentroSistemas error:', err);
      callback([]);
    });

    return unsub;
  } catch (e) {
    console.error('subscribeCentroSistemas error:', e);
    return () => {};
  }
}

export interface EquipoInstaladoFirestore {
  id: string;
  centroId: string;
  sistemaId: string;
  codigo: string;
  nombre: string;
  ubicacion: string;
  revisable?: boolean;
  revisado?: boolean;
  placa?: string;
  clase?: string;
  fabricante?: string;
  fechaFabricacion?: string;
  ultimoRetimbre?: string;
  pesoCapacidad?: string;
  anomalias?: string;
  longitud?: string;
  pruebaHidraulica?: string;
  foto?: string;
  checkAcceso?: boolean | null;
  checkAltura?: boolean | null;
  checkSoporte?: boolean | null;
  checkSenalizacion?: boolean | null;
  checkManguera?: boolean | null;
  checkPeso?: boolean | null;
  checkManometro?: boolean | null;
  checkMarcado?: boolean | null;
  checkEtiquetas?: boolean | null;
  checkRetimbre?: boolean | null;
  checkRiesgo?: boolean | null;
  checkDistancia?: boolean | null;
  checkPasador?: boolean | null;
  checkMovilidad?: boolean | null;
  [key: string]: any; // Allow for dynamic properties from templates
  _docId?: string;
}

/** Elimina campos con valor undefined de un objeto (Firestore no permite undefined en setDoc) */
function limpiarUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const limpio: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      limpio[key] = value;
    }
  }
  return limpio;
}

export async function addEquipoInstalado(equipo: EquipoInstaladoFirestore) {
  try {
    console.log('addEquipoInstalado: centroId=', equipo.centroId, 'sistemaId=', equipo.sistemaId, 'equipoId=', equipo.id);
    // Guardar TODOS los campos del equipo (incluyendo campos dinámicos de plantilla)
    const equipoData = limpiarUndefined({ ...equipo, updatedAt: new Date().toISOString() });

    if (equipo.id) {
      const ref = doc(db, 'centros', equipo.centroId, 'inventario', equipo.sistemaId, 'equipos', equipo.id);
      await setDoc(ref, { ...equipoData, id: equipo.id });
      return { ...equipo, _docId: equipo.id };
    } else {
      const col = collection(db, 'centros', equipo.centroId, 'inventario', equipo.sistemaId, 'equipos');
      const ref = await addDoc(col, equipoData);
      return { ...equipo, id: ref.id, _docId: ref.id };
    }
  } catch (e) {
    console.error('addEquipoInstalado error:', e);
    throw e;
  }
}

export async function updateEquipoInstalado(id: string, equipo: Partial<EquipoInstaladoFirestore>, fallbackCentroId?: string, fallbackSistemaId?: string) {
  try {
    const cId = equipo.centroId || fallbackCentroId;
    const sId = equipo.sistemaId || fallbackSistemaId;
    if (!cId || !sId) {
      console.warn('updateEquipoInstalado: faltan centroId o sistemaId', { id, equipo, cId, sId });
      return { _docId: id, ...equipo };
    }
    const ref = doc(db, 'centros', cId, 'inventario', sId, 'equipos', id);
    const cleanData = limpiarUndefined({ ...equipo, centroId: cId, sistemaId: sId, updatedAt: new Date().toISOString() });
    await setDoc(ref, cleanData, { merge: true });
    return { _docId: id, ...equipo };
  } catch (e) {
    console.error('updateEquipoInstalado error:', e);
    throw e;
  }
}

export async function deleteEquipoInstalado(centroId: string, sistemaId: string, equipoId: string) {
  try {
    const ref = doc(db, 'centros', centroId, 'inventario', sistemaId, 'equipos', equipoId);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('deleteEquipoInstalado error:', e);
    throw e;
  }
}

export function subscribeEquiposInstalados(centroId: string, sistemaId: string, callback: (equipos: EquipoInstaladoFirestore[]) => void) {
  try {
    const col = collection(db, 'centros', centroId, 'inventario', sistemaId, 'equipos');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return { _docId: d.id, id: d.id, ...data } as EquipoInstaladoFirestore;
      });
      callback(items);
    }, (err) => {
      console.error('subscribeEquiposInstalados error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeEquiposInstalados error:', e);
    return () => {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPUESTOS - Firestore CRUD
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeImpuestos(callback: (config: ImpuestoConfig | null) => void) {
  try {
    const col = collection(db, 'impuestos');
    const unsub = onSnapshot(col, (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      const doc = snap.docs[0];
      const data = doc.data() as any;
      callback({
        _docId: doc.id,
        id: data?.id || doc.id,
        iva: typeof data?.iva === 'number' ? data.iva : 21,
        exento: data?.exento === true,
      });
    }, (err) => {
      console.error('subscribeImpuestos error:', err);
      callback(null);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeImpuestos error:', e);
    return () => {};
  }
}

export async function saveImpuestoConfig(config: { iva: number; exento: boolean }) {
  try {
    const col = collection(db, 'impuestos');
    const snap = await getDocs(col);
    const data = {
      iva: config.iva,
      exento: config.exento,
      updatedAt: new Date().toISOString()
    };
    if (snap.empty) {
      const ref = await addDoc(col, data);
      return { _docId: ref.id, ...data };
    } else {
      const ref = doc(db, 'impuestos', snap.docs[0].id);
      await setDoc(ref, data, { merge: true });
      return { _docId: snap.docs[0].id, ...data };
    }
  } catch (e) {
    console.error('saveImpuestoConfig error:', e);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLIST - Firestore CRUD
// ─────────────────────────────────────────────────────────────────────────────

export type TipoRespuestaChecklist = 'check' | 'texto' | 'texto-largo' | 'numero' | 'fecha' | 'imagen' | 'desplegable' | 'seccion' | 'tabla' | 'seleccion' | 'grafico';

export interface ChecklistItem {
  id: string;
  sistemaId: string;       // ID del sistema al que pertenece (ej: id de SistemaCategoria)
  sistemaNombre: string;   // Nombre del sistema para referencia
  label: string;           // Texto de la pregunta/check
  key: string;             // Clave única para el check (ej: checkAcceso, checkAltura)
  orden: number;           // Orden de aparición
  tipoRespuesta: TipoRespuestaChecklist;  // Tipo de respuesta: 'check' | 'texto' | 'numero' | 'fecha'
  horizontal?: boolean;    // Si se muestra en disposición horizontal (pregunta a la izq, respuesta a la der)
  opciones?: string[];     // Opciones si es desplegable (y cabeceras horizontales para tablas)
  filasInicio?: number;    // Cantidad inicial de filas para tablas
  filasNombres?: string[];  // Nombres predefinidos de las filas (cabecera vertical para tablas)
}

// ─── CHECKLIST POR COLECCIÓN DINÁMICA (checklist_{sistemaNombre}) ────────

function getChecklistCollectionName(sistemaNombre: string): string {
  // Normalizar: minúsculas, sin espacios, sin caracteres especiales
  const nombre = sistemaNombre.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `checklist_${nombre}`;
}

export function subscribeChecklists(sistemaId: string, callback: (items: ChecklistItem[]) => void) {
  try {
    const col = collection(db, 'checklist');
    const q = query(col, where('sistemaId', '==', sistemaId), orderBy('orden', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const items: ChecklistItem[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        items.push({
          id: doc.id,
          sistemaId: data.sistemaId || '',
          sistemaNombre: data.sistemaNombre || '',
          label: data.label || '',
          key: data.key || '',
          orden: data.orden || 0,
          tipoRespuesta: data.tipoRespuesta || 'check',
          opciones: data.opciones || [],
          horizontal: data.horizontal === true,
          filasInicio: data.filasInicio,
        });
      });
      callback(items);
    }, (err) => {
      console.error('subscribeChecklists error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeChecklists error:', e);
    return () => {};
  }
}

export async function addChecklistItem(item: Omit<ChecklistItem, 'id'>) {
  try {
    const col = collection(db, 'checklist');
    const docRef = await addDoc(col, item);
    return { id: docRef.id, ...item };
  } catch (e) {
    console.error('addChecklistItem error:', e);
    throw e;
  }
}

export async function updateChecklistItem(id: string, data: Partial<ChecklistItem>) {
  try {
    const docRef = doc(db, 'checklist', id);
    await updateDoc(docRef, data);
  } catch (e) {
    console.error('updateChecklistItem error:', e);
    throw e;
  }
}

export async function deleteChecklistItem(id: string) {
  try {
    const docRef = doc(db, 'checklist', id);
    await deleteDoc(docRef);
  } catch (e) {
    console.error('deleteChecklistItem error:', e);
    throw e;
  }
}

export async function saveChecklistBatch(items: Omit<ChecklistItem, 'id'>[]) {
  try {
    const col = collection(db, 'checklist');
    const results = [];
    for (const item of items) {
      const docRef = await addDoc(col, item);
      results.push({ id: docRef.id, ...item });
    }
    return results;
  } catch (e) {
    console.error('saveChecklistBatch error:', e);
    throw e;
  }
}

// ─── CHECKLIST POR COLECCIÓN DINÁMICA (checklist_{sistemaNombre}) ────────

export function subscribeChecklistsPorSistema(sistemaNombre: string, callback: (items: ChecklistItem[]) => void) {
  try {
    const colName = getChecklistCollectionName(sistemaNombre);
    const col = collection(db, colName);
    const q = query(col, orderBy('orden', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const items: ChecklistItem[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        items.push({
          id: doc.id,
          sistemaId: data.sistemaId || '',
          sistemaNombre: data.sistemaNombre || sistemaNombre,
          label: data.label || '',
          key: data.key || '',
          orden: data.orden || 0,
          tipoRespuesta: data.tipoRespuesta || 'check',
        });
      });
      callback(items);
    }, (err) => {
      console.error(`subscribeChecklistsPorSistema(${colName}) error:`, err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeChecklistsPorSistema error:', e);
    return () => {};
  }
}

export async function saveChecklistBatchPorSistema(sistemaNombre: string, items: Omit<ChecklistItem, 'id'>[]) {
  try {
    const colName = getChecklistCollectionName(sistemaNombre);
    const col = collection(db, colName);
    const results = [];
    for (const item of items) {
      const docRef = await addDoc(col, item);
      results.push({ id: docRef.id, ...item });
    }
    return results;
  } catch (e) {
    console.error(`saveChecklistBatchPorSistema(${sistemaNombre}) error:`, e);
    throw e;
  }
}

export async function deleteChecklistItemPorSistema(sistemaNombre: string, id: string) {
  try {
    const colName = getChecklistCollectionName(sistemaNombre);
    const docRef = doc(db, colName, id);
    await deleteDoc(docRef);
  } catch (e) {
    console.error(`deleteChecklistItemPorSistema(${sistemaNombre}) error:`, e);
    throw e;
  }
}

export async function updateChecklistItemPorSistema(sistemaNombre: string, id: string, data: Partial<ChecklistItem>) {
  try {
    const colName = getChecklistCollectionName(sistemaNombre);
    const docRef = doc(db, colName, id);
    await updateDoc(docRef, data);
  } catch (e) {
    console.error(`updateChecklistItemPorSistema(${sistemaNombre}) error:`, e);
    throw e;
  }
}

// ─── REPARACIONES Y AVERÍAS ──────────────────────────────────────────────────
export interface ReparacionItem {
  id: string;
  _docId?: string;
  reparacion: string;
  lugar: string;
  tecnicoAsignado: string;
  comercial: string;
  estado: 'Pendiente' | 'En curso' | 'Parado' | 'Finalizado';
  fechaCreacion: string;
  observaciones?: string;
  nota?: string;
}

export function subscribeReparaciones(callback: (items: ReparacionItem[]) => void) {
  try {
    const col = collection(db, 'reparaciones');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          _docId: d.id,
          id: data?.id ?? d.id,
          reparacion: data?.reparacion || '',
          lugar: data?.lugar || '',
          tecnicoAsignado: data?.tecnicoAsignado || '',
          comercial: data?.comercial || '',
          estado: data?.estado || 'Pendiente',
          fechaCreacion: data?.fechaCreacion || new Date().toISOString(),
          observaciones: data?.observaciones || '',
          nota: data?.nota || data?.observaciones || '',
        } as ReparacionItem;
      });
      items.sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));
      callback(items);
    }, (err) => {
      console.error('subscribeReparaciones error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeReparaciones error:', e);
    return () => {};
  }
}

export async function addReparacion(data: ReparacionItem) {
  try {
    const col = collection(db, 'reparaciones');
    const docRef = await addDoc(col, data);
    return { ...data, _docId: docRef.id };
  } catch (e) {
    console.error('addReparacion error:', e);
    throw e;
  }
}

export async function updateReparacion(docId: string, data: Partial<ReparacionItem>) {
  try {
    const docRef = doc(db, 'reparaciones', docId);
    await updateDoc(docRef, data as any);
  } catch (e) {
    console.error('updateReparacion error:', e);
    throw e;
  }
}

export async function deleteReparacion(docId: string) {
  try {
    const docRef = doc(db, 'reparaciones', docId);
    await deleteDoc(docRef);
  } catch (e) {
    console.error('deleteReparacion error:', e);
    throw e;
  }
}

// ─── INSTALACIONES ───────────────────────────────────────────────────────────
export interface InstalacionItem {
  id: string;
  _docId?: string;
  instalacion: string;
  lugar: string;
  tecnicoAsignado: string;
  comercial: string;
  estado: 'Pendiente' | 'En curso' | 'Parado' | 'Finalizado';
  fechaCreacion: string;
  observaciones?: string;
  nota?: string;
}

export function subscribeInstalaciones(callback: (items: InstalacionItem[]) => void) {
  try {
    const col = collection(db, 'instalaciones');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          _docId: d.id,
          id: data?.id ?? d.id,
          instalacion: data?.instalacion || '',
          lugar: data?.lugar || '',
          tecnicoAsignado: data?.tecnicoAsignado || '',
          comercial: data?.comercial || '',
          estado: data?.estado || 'Pendiente',
          fechaCreacion: data?.fechaCreacion || new Date().toISOString(),
          observaciones: data?.observaciones || '',
          nota: data?.nota || data?.observaciones || '',
        } as InstalacionItem;
      });
      items.sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));
      callback(items);
    }, (err) => {
      console.error('subscribeInstalaciones error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeInstalaciones error:', e);
    return () => {};
  }
}

export async function addInstalacion(data: InstalacionItem) {
  try {
    const col = collection(db, 'instalaciones');
    const docRef = await addDoc(col, data);
    return { ...data, _docId: docRef.id };
  } catch (e) {
    console.error('addInstalacion error:', e);
    throw e;
  }
}

export async function updateInstalacion(docId: string, data: Partial<InstalacionItem>) {
  try {
    const docRef = doc(db, 'instalaciones', docId);
    await updateDoc(docRef, data as any);
  } catch (e) {
    console.error('updateInstalacion error:', e);
    throw e;
  }
}

export async function deleteInstalacion(docId: string) {
  try {
    const docRef = doc(db, 'instalaciones', docId);
    await deleteDoc(docRef);
  } catch (e) {
    console.error('deleteInstalacion error:', e);
    throw e;
  }
}

// ─── REVISIONES ANUALES PERIÓDICAS ───────────────────────────────────────────
export interface RevisionItem {
  id: string;
  _docId?: string;
  centroId?: string;
  centroNombre?: string;
  codigoCentro?: string;
  empresaMantenedora?: string;
  ubicacion?: string;
  mes?: string;
  tipoRevision?: string;
  estado: 'Planificado' | 'En curso' | 'Parado' | 'Finalizado';
  fechaCreacion?: string;
  observaciones?: string;
  nota?: string;
}

export function subscribeRevisiones(callback: (items: RevisionItem[]) => void) {
  try {
    const col = collection(db, 'revisiones');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          _docId: d.id,
          id: data?.id ?? d.id,
          centroId: data?.centroId || '',
          centroNombre: data?.centroNombre || '',
          codigoCentro: data?.codigoCentro || '',
          empresaMantenedora: data?.empresaMantenedora || '',
          ubicacion: data?.ubicacion || '',
          mes: data?.mes || '',
          tipoRevision: data?.tipoRevision || '',
          estado: data?.estado || 'Planificado',
          fechaCreacion: data?.fechaCreacion || new Date().toISOString(),
          observaciones: data?.observaciones || '',
          nota: data?.nota || data?.observaciones || '',
        } as RevisionItem;
      });
      items.sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));
      callback(items);
    }, (err) => {
      console.error('subscribeRevisiones error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeRevisiones error:', e);
    return () => {};
  }
}

export async function addRevision(data: RevisionItem) {
  try {
    const col = collection(db, 'revisiones');
    const docRef = await addDoc(col, data);
    return { ...data, _docId: docRef.id };
  } catch (e) {
    console.error('addRevision error:', e);
    throw e;
  }
}

export async function updateRevision(docId: string, data: Partial<RevisionItem>) {
  try {
    const docRef = doc(db, 'revisiones', docId);
    await updateDoc(docRef, data as any);
  } catch (e) {
    console.error('updateRevision error:', e);
    throw e;
  }
}

export async function deleteRevision(docId: string) {
  try {
    const docRef = doc(db, 'revisiones', docId);
    await deleteDoc(docRef);
  } catch (e) {
    console.error('deleteRevision error:', e);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAPELERA DE RECICLAJE (Centralizada - Retención 100 Días)
// ─────────────────────────────────────────────────────────────────────────────

export interface PapeleraItem {
  id: string;
  originalDocId: string;
  coleccion: string;
  tipo: string;
  titulo: string;
  clienteNombre?: string;
  centroNombre?: string;
  datos: Record<string, any>;
  fechaEliminacion: string;
  fechaExpiracion: string;
  eliminadoPor?: string;
  _docId?: string;
}

function cleanUndefinedForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefinedForFirestore);
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = cleanUndefinedForFirestore(val);
    }
  }
  return clean;
}

export async function moverAPapelera(params: {
  coleccion: string;
  originalDocId: string;
  tipo: string;
  titulo: string;
  clienteNombre?: string;
  centroNombre?: string;
  datos: Record<string, any>;
  usuario?: string;
}) {
  try {
    const fechaEliminacion = new Date().toISOString();
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 100);
    const fechaExpiracion = expDate.toISOString();

    const sanitizedDatos = cleanUndefinedForFirestore(params.datos || {});

    const papeleraCol = collection(db, 'papelera');
    await addDoc(papeleraCol, {
      originalDocId: params.originalDocId,
      coleccion: params.coleccion,
      tipo: params.tipo,
      titulo: params.titulo || 'Sin título',
      clienteNombre: params.clienteNombre || '',
      centroNombre: params.centroNombre || '',
      datos: sanitizedDatos,
      fechaEliminacion,
      fechaExpiracion,
      eliminadoPor: params.usuario || 'Usuario'
    });

    // Eliminar de la colección de origen
    const originalRef = doc(db, params.coleccion, params.originalDocId);
    await deleteDoc(originalRef);

    console.info(`moverAPapelera: Documento ${params.originalDocId} de ${params.coleccion} movido a papelera`);
    return true;
  } catch (e) {
    console.error('moverAPapelera error:', e);
    throw e;
  }
}

export function subscribePapelera(callback: (items: PapeleraItem[]) => void) {
  try {
    const col = collection(db, 'papelera');
    const q = query(col, orderBy('fechaEliminacion', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      const now = Date.now();
      const validItems: PapeleraItem[] = [];

      for (const d of snap.docs) {
        const data = d.data() as any;
        const expTime = data.fechaExpiracion ? new Date(data.fechaExpiracion).getTime() : 0;

        // Si han pasado más de 100 días, purgar automáticamente de Firestore
        if (expTime > 0 && expTime < now) {
          deleteDoc(doc(db, 'papelera', d.id)).catch(err =>
            console.error('Error purgando elemento caducado de papelera:', err)
          );
        } else {
          validItems.push({
            _docId: d.id,
            id: d.id,
            ...data
          });
        }
      }

      callback(validItems);
    }, (err) => {
      console.error('subscribePapelera error:', err);
      callback([]);
    });

    return unsub;
  } catch (e) {
    console.error('subscribePapelera error:', e);
    return () => {};
  }
}

export async function restaurarElementoPapelera(item: PapeleraItem) {
  try {
    if (!item.coleccion || !item.originalDocId || !item.datos) {
      throw new Error('Datos insuficientes para restaurar el elemento.');
    }

    // Reinsertar en la colección original
    const originalRef = doc(db, item.coleccion, item.originalDocId);
    await setDoc(originalRef, item.datos);

    // Eliminar de la papelera
    const papeleraRef = doc(db, 'papelera', item._docId || item.id);
    await deleteDoc(papeleraRef);

    console.info(`restaurarElementoPapelera: ${item.originalDocId} restaurado en ${item.coleccion}`);
    return true;
  } catch (e) {
    console.error('restaurarElementoPapelera error:', e);
    throw e;
  }
}

export async function eliminarDefinitivoPapelera(docId: string) {
  try {
    const papeleraRef = doc(db, 'papelera', docId);
    await deleteDoc(papeleraRef);
    console.info(`eliminarDefinitivoPapelera: ${docId} eliminado físicamente`);
    return true;
  } catch (e) {
    console.error('eliminarDefinitivoPapelera error:', e);
    throw e;
  }
}

export async function vaciarPapeleraCompleta() {
  try {
    const snap = await getDocs(collection(db, 'papelera'));
    const promises = snap.docs.map(d => deleteDoc(doc(db, 'papelera', d.id)));
    await Promise.all(promises);
    console.info('vaciarPapeleraCompleta: Papelera vaciada');
    return true;
  } catch (e) {
    console.error('vaciarPapeleraCompleta error:', e);
    throw e;
  }
}

export {app, storage, db, analytics};

