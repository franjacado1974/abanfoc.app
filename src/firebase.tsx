import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, getDocs, getDoc, query, where, orderBy, addDoc, doc, updateDoc, setDoc, deleteDoc, onSnapshot, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAqxTDdTXikySejIXDDIjm1ZYzlmZXS0zs",
  authDomain: "app-abanfoc-v1.firebaseapp.com",
  projectId: "app-abanfoc-v1",
  storageBucket: "app-abanfoc-v1.firebasestorage.app",
  messagingSenderId: "468455047562",
  appId: "1:468455047562:web:3d8fb53011ca4b1718c873",
  measurementId: "G-JW0T2BFDY8"
};

export interface SistemaCategoria {
  id: string;
  nombre: string;
  imagenUrl?: string;
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
}

export interface Centro {
  id: string;
  clienteId: string;
  nombre: string;
  direccion?: string;
  poblacion?: string;
  provincia?: string;
  telefono?: string;
}

export interface Equipo {
  id: string;
  centroId: string;
}

export interface Empresa {
  _docId?: string;
  nombre: string;
  direccion?: string;
  localidad?: string;
  cif?: string;
  logoUrl?: string;
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

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('La persistencia falló: Múltiples pestañas abiertas.');
  } else if (err.code === 'unimplemented') {
    console.warn('El navegador no soporta persistencia offline.');
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
        const data = d.data() as Partial<Tecnico>;
        return {
          _docId: d.id,
          id: data?.id?.trim() || d.id,
          nombre: data?.nombre ?? '',
          apellidos: data?.apellidos ?? ''
        };
      }) as Tecnico[];
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
  try {
    const col = collection(db, 'usuarios');
    console.info('verifyUser: buscando usuario', username);

    let q = query(col, where('usuario', '==', username));
    let snap = await getDocs(q);
    console.info('verifyUser: resultado busqueda por usuario, docs=', snap.size);

    if (snap.empty) {
      q = query(col, where('nombre', '==', username));
      snap = await getDocs(q);
      console.info('verifyUser: resultado busqueda por nombre, docs=', snap.size);
    }

    if (snap.empty) {
      console.warn('verifyUser: usuario no encontrado en Firestore');
      return null;
    }

    const doc = snap.docs[0];
    const data: any = doc.data();
    if (!data) {
      console.warn('verifyUser: documento sin datos');
      return null;
    }

    console.info('verifyUser: datos del documento:', JSON.stringify(data));

    const storedPassword = data['contraseña'] ?? data['password'] ?? data['clave'] ?? '';
    console.info('verifyUser: contraseña almacenada:', storedPassword, '| introducida:', password);

    if (storedPassword === password) {
      const nombre = data['nombre'] ?? data['usuario'] ?? username;
      const apellidos = data['apellidos'] ?? '';
      const rol = data['rol'] ?? (username === 'superusuario' ? 'super-administrador' : 'administrador');
      console.info('verifyUser: login exitoso para', nombre, 'rol:', rol);
      return {
        id: doc.id,
        nombre,
        apellidos,
        rol
      };
    }

    console.warn('verifyUser: contraseña incorrecta');
    return null;
  } catch (e) {
    console.error('verifyUser error:', e);
    return null;
  }
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
    if (centro && centro.id) {
      const ref = doc(db, 'centros', centro.id);
      console.info('addCentro: writing document with id', centro.id, 'data:', centro);
      await setDoc(ref, { ...centro, updatedAt: new Date().toISOString() });
      const centroId = centro.id ?? ref.id;
      return { _docId: ref.id, ...centro, id: centroId };
    } else {
      const ref = await addDoc(col, { ...centro, updatedAt: new Date().toISOString() });
      console.info('addCentro: added new document', ref.id, 'data:', centro);
      const centroId = centro.id ?? ref.id;
      return { _docId: ref.id, ...centro, id: centroId };
    }
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
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return { _docId: d.id, id: data?.id ?? d.id, ...data };
      });
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

export async function addAlbaran(albaran: Albaran) {
  try {
    const col = collection(db, 'albaranes');
    
    const albaranToSave = {
      ...albaran,
      updatedAt: new Date().toISOString()
    };

    if (albaran.id) {
      const docRef = doc(db, 'albaranes', albaran.id);
      await setDoc(docRef, albaranToSave);
      console.info('addAlbaran: created with custom ID', albaran.id);
      return { ...albaranToSave, _docId: albaran.id };
    } else {
      const newDocRef = await addDoc(col, albaranToSave);
      console.info('addAlbaran: created with generated ID', newDocRef.id);
      const { id: _, ...rest } = albaranToSave;
      return { ...rest, _docId: newDocRef.id, id: newDocRef.id };
    }
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
    const albaranToUpdate = {
      ...albaran,
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, albaranToUpdate, { merge: true });
    console.info('updateAlbaran: updated', albaran.id);
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
  estado: 'Planificado' | 'Abierto' | 'Descargado (Offline)' | 'Finalizado' | 'Cerrado' | 'Pre-Cerrado';
  tipoTrabajo?: string;
  numeroMantenimiento?: string;
  fechaProgramada?: string;
  _docId?: string;
}

export async function addParte(parte: ParteFirestore) {
  try {
    const parteToSave = { ...parte, updatedAt: new Date().toISOString() };
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
  _docId?: string;
}

export async function addEquipoInstalado(equipo: EquipoInstaladoFirestore) {
  try {
    console.log('addEquipoInstalado: centroId=', equipo.centroId, 'sistemaId=', equipo.sistemaId, 'equipoId=', equipo.id);
    const equipoData = {
      centroId: equipo.centroId,
      sistemaId: equipo.sistemaId,
      codigo: equipo.codigo || '',
      nombre: equipo.nombre || '',
      ubicacion: equipo.ubicacion || '',
      revisable: equipo.revisable,
      revisado: equipo.revisado,
      placa: equipo.placa,
      clase: equipo.clase,
      fabricante: equipo.fabricante,
      fechaFabricacion: equipo.fechaFabricacion,
      ultimoRetimbre: equipo.ultimoRetimbre,
      pesoCapacidad: equipo.pesoCapacidad,
      anomalias: equipo.anomalias,
      longitud: equipo.longitud,
      pruebaHidraulica: equipo.pruebaHidraulica,
      checkAcceso: equipo.checkAcceso,
      checkAltura: equipo.checkAltura,
      checkSoporte: equipo.checkSoporte,
      checkSenalizacion: equipo.checkSenalizacion,
      checkManguera: equipo.checkManguera,
      checkPeso: equipo.checkPeso,
      checkManometro: equipo.checkManometro,
      checkMarcado: equipo.checkMarcado,
      checkEtiquetas: equipo.checkEtiquetas,
      checkRetimbre: equipo.checkRetimbre,
      checkRiesgo: equipo.checkRiesgo,
      checkDistancia: equipo.checkDistancia,
      checkPasador: equipo.checkPasador,
      checkMovilidad: equipo.checkMovilidad,
      updatedAt: new Date().toISOString()
    };

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

export async function updateEquipoInstalado(id: string, equipo: Partial<EquipoInstaladoFirestore>) {
  try {
    if (!equipo.centroId || !equipo.sistemaId) {
      console.warn('updateEquipoInstalado: faltan centroId o sistemaId');
      return { _docId: id, ...equipo };
    }
    const ref = doc(db, 'centros', equipo.centroId, 'inventario', equipo.sistemaId, 'equipos', id);
    await setDoc(ref, { ...equipo, updatedAt: new Date().toISOString() }, { merge: true });
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

export type TipoRespuestaChecklist = 'check' | 'texto' | 'numero';

export interface ChecklistItem {
  id: string;
  sistemaId: string;       // ID del sistema al que pertenece (ej: id de SistemaCategoria)
  sistemaNombre: string;   // Nombre del sistema para referencia
  label: string;           // Texto de la pregunta/check
  key: string;             // Clave única para el check (ej: checkAcceso, checkAltura)
  orden: number;           // Orden de aparición
  tipoRespuesta: TipoRespuestaChecklist;  // Tipo de respuesta: 'check' | 'texto' | 'numero'
}

// ─── CHECKLIST POR SISTEMA (documento único en colección 'checklist') ────

function getChecklistDocId(sistemaNombre: string): string {
  // Normalizar: minúsculas, sin espacios, sin caracteres especiales
  return sistemaNombre.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
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

// ─── CHECKLIST POR SISTEMA (documento único en colección 'checklist') ────

export function subscribeChecklistsPorSistema(sistemaNombre: string, callback: (items: ChecklistItem[]) => void) {
  try {
    const docId = getChecklistDocId(sistemaNombre);
    const docRef = doc(db, 'checklist', docId);
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const rawItems = data.items || [];
        const items: ChecklistItem[] = rawItems.map((item: any, index: number) => ({
          id: item.id || `${docId}_${index}`,
          sistemaId: item.sistemaId || '',
          sistemaNombre: item.sistemaNombre || sistemaNombre,
          label: item.label || '',
          key: item.key || '',
          orden: item.orden || index + 1,
          tipoRespuesta: item.tipoRespuesta || 'check',
        }));
        callback(items);
      } else {
        callback([]);
      }
    }, (err) => {
      console.error(`subscribeChecklistsPorSistema(${docId}) error:`, err);
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
    const docId = getChecklistDocId(sistemaNombre);
    const docRef = doc(db, 'checklist', docId);
    // Asignar IDs a los items
    const itemsWithIds = items.map((item, index) => ({
      ...item,
      id: `${docId}_${index}`,
    }));
    await setDoc(docRef, { items: itemsWithIds }, { merge: true });
    return itemsWithIds;
  } catch (e) {
    console.error(`saveChecklistBatchPorSistema(${sistemaNombre}) error:`, e);
    throw e;
  }
}

export async function deleteChecklistItemPorSistema(sistemaNombre: string, id: string) {
  try {
    const docId = getChecklistDocId(sistemaNombre);
    const docRef = doc(db, 'checklist', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const items = (data.items || []).filter((item: any) => item.id !== id);
      await setDoc(docRef, { items }, { merge: true });
    }
  } catch (e) {
    console.error(`deleteChecklistItemPorSistema(${sistemaNombre}) error:`, e);
    throw e;
  }
}

export async function updateChecklistItemPorSistema(sistemaNombre: string, id: string, data: Partial<ChecklistItem>) {
  try {
    const docId = getChecklistDocId(sistemaNombre);
    const docRef = doc(db, 'checklist', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const existingData = snap.data();
      const items = (existingData.items || []).map((item: any) => {
        if (item.id === id) {
          return { ...item, ...data };
        }
        return item;
      });
      await setDoc(docRef, { items }, { merge: true });
    }
  } catch (e) {
    console.error(`updateChecklistItemPorSistema(${sistemaNombre}) error:`, e);
    throw e;
  }
}

export {app, storage, db, analytics};
