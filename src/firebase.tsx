// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, getDocs, query, where, addDoc, doc, updateDoc, setDoc, deleteDoc, onSnapshot, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAqxTDdTXikySejIXDDIjm1ZYzlmZXS0zs",
  authDomain: "app-abanfoc-v1.firebaseapp.com",
  projectId: "app-abanfoc-v1",
  storageBucket: "app-abanfoc-v1.firebasestorage.app",
  messagingSenderId: "468455047562",
  appId: "1:468455047562:web:3d8fb53011ca4b1718c873",
  measurementId: "G-JW0T2BFDY8"
};

// Initialize Firebase
// Interfaces para Sistemas y Equipos
export interface SistemaCategoria {
  id: string;
  nombre: string;
}
// Interface for Equipos
export interface SistemaEquipo {
  id: string;
  idCategoria: string;
  codigo: string;
  nombre: string;
  familia: string;
  revisable: boolean;
}

// Interface for Articulos
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
  // Añadir otras propiedades de Centro si se usan en Albaranes.tsx
}

export interface Equipo {
  id: string;
  centroId: string;
  // Añadir otras propiedades de Equipo si se usan en Albaranes.tsx
}

export interface Empresa {
  _docId?: string;
  nombre: string;
  direccion?: string;
  localidad?: string;
  cif?: string;
  logoUrl?: string;
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

// Habilitar persistencia offline para evitar bloqueos por falta de conexión
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('La persistencia falló: Múltiples pestañas abiertas.');
  } else if (err.code === 'unimplemented') {
    console.warn('El navegador no soporta persistencia offline.');
  }
});

/**
 * Guarda un nuevo usuario en Firestore (colección "usuarios").
 * Campos que guarda: nombre, apellidos, rol, contraseña
 */
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

/**
 * TÉCNICOS - operaciones con Firestore (colección "tecnicos").
 */
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
      console.error('subscribeTecnicos error:', err); // Changed _e to err
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
    console.error('saveTecnico error:', e); // Changed _e to e
    throw e;
  }
}

export async function deleteTecnico(id: string) {
  try {
    const ref = doc(db, 'tecnicos', id);
    await deleteDoc(ref);
    return true;
  } catch (e) { // Changed _e to e
    console.error('deleteTecnico error:', e);
    throw e;
  }
}

/**
 * Verifica credenciales en Firestore.
 * Busca en la colección "usuarios" un documento con campo `nombre` o `usuario` igual a username
 * y compara la contraseña. Devuelve el objeto usuario (sin contraseña) o null.
 */
export async function verifyUser(username: string, password: string) {
  try {
    const col = collection(db, 'usuarios');
    console.info('verifyUser: buscando usuario', username);

    // Buscar por 'usuario' primero (usuarios legacy: superusuario, administrador, tecnico)
    let q = query(col, where('usuario', '==', username));
    let snap = await getDocs(q);
    console.info('verifyUser: resultado busqueda por usuario, docs=', snap.size);

    // Si no encuentra, buscar por 'nombre' (usuarios creados desde Gestión de Usuarios)
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

    // Soportar varios nombres de campo para contraseña
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
    console.error('verifyUser error:', e); // Changed _e to e
    return null;
  }
}

/**
 * Suscribe a los cambios del perfil del ingeniero en Firestore.
 */
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

/**
 * Guarda o actualiza los datos del ingeniero en Firestore.
 */
export const saveIngeniero = async (id: string | null, data: any) => {
  if (id) {
    const docRef = doc(db, 'ingeniero', id);
    await updateDoc(docRef, data);
  } else {
    await addDoc(collection(db, 'ingeniero'), data);
  }
};
// Subscribe Empresa
/**
 * Suscribe a los cambios de los datos de la empresa en Firestore.
 */
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
// Subscribe Empresas
/**
 * Suscribe a TODAS las empresas (para la lista).
 */
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
// Save Empresa
/**
 * Guarda o actualiza los datos de la empresa en Firestore.
 */
export const saveEmpresa = async (id: string | null, data: Empresa) => {
  if (id) {
    const docRef = doc(db, 'empresa', id);
    await updateDoc(docRef, data as Record<string, any>);
  } else {
    await addDoc(collection(db, 'empresa'), data);
  }
};
// Delete Empresa
/**
 * Elimina una empresa de Firestore.
 */
export const deleteEmpresa = async (id: string) => {
  const docRef = doc(db, 'empresa', id);
  await deleteDoc(docRef);
};
// Upload File
/**
 * Sube un archivo a Firebase Storage y devuelve la URL de descarga.
 * @param file El archivo seleccionado del input.
 * @param path La ruta de destino en el bucket de storage.
 */
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
// Subscribe Clientes
/**
 * Clientes - suscripción en tiempo real.
 */
export function subscribeClientes(callback: (clientes: Cliente[]) => void) {
  try {
    const col = collection(db, 'clientes');
    return onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Cliente[];
      callback(items);
    });
  } catch (e) { // Changed _e to e
    console.error('subscribeClientes error:', e);
    return () => {};
  }
}

/**
 * Centros - operaciones con Firestore
 * addCentro: añade un centro (devuelve el documento creado)
 * updateCentro: actualiza un centro por id (merge)
 * deleteCentro: borra un centro por id
 * getCentros: obtiene todos los centros una sola vez
 * subscribeCentros: escucha cambios en tiempo real y llama al callback con la lista actualizada
 */

export async function addCentro(centro: Centro) {
  try {
    const col = collection(db, 'centros');
    // Si el objeto centro incluye un campo `id` lo usamos como documentId en Firestore
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
  } catch (e) { // Changed _e to e
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
  } catch (e) { // Changed _e to e
    console.error('deleteCentro error:', e);
    throw e;
  }
}

export async function getCentros(): Promise<Centro[]> {
  try {
    const col = collection(db, 'centros');
    const snap = await getDocs(col); // Removed _e
    return snap.docs.map(d => {
      const data = d.data() as any;
      return { _docId: d.id, id: data?.id ?? d.id, ...data };
    });
  } catch (e) { // Changed _e to e
    console.error('getCentros error:', e);
    throw e;
  }
}

/**
 * subscribeCentros(callback): devuelve una función para cancelar la suscripción.
 * callback recibe la lista actualizada de centros.
 */
export function subscribeCentros(callback: (centros: Centro[]) => void) {
  try {
    const col = collection(db, 'centros');
    const unsub = onSnapshot(col, (snap) => {
      console.info('subscribeCentros: snapshot received, size=', snap.size);
      const items = snap.docs.map(d => { // Removed _e
        const data = d.data() as any;
        return { _docId: d.id, id: data?.id ?? d.id, ...data };
      });
      console.info('subscribeCentros: items=', items);
      callback(items);
    }, (err) => {
      console.error('subscribeCentros error:', err); // Changed _e to err
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeCentros error:', e);
    return () => {};
  }
}

/**
 * Helper para normalizar el nombre del sistema y usarlo como ID de documento (2ª columna).
 * "SISTEMA EXTINTORES" -> "extintores"
 */
export function getCollectionName(catNombre: string) {
  return catNombre
    .replace(/^sistema\s+/i, '')
    .toLowerCase()
    .trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, '_');
}

/**
 * SISTEMAS (CATEGORÍAS) - operaciones con Firestore
 */
export async function addSistemaCategoria(categoria: SistemaCategoria) {
  try {
    const systemId = getCollectionName(categoria.nombre);
    const ref = doc(db, 'sistemas', systemId);
    await setDoc(ref, { 
      id: systemId, 
      nombre: categoria.nombre.toUpperCase(), 
      updatedAt: new Date().toISOString() 
    });
    return { id: systemId, nombre: categoria.nombre };
  } catch (e) {
    console.error('addSistemaCategoria error:', e); // Changed _e to e
    throw e;
  }
}

export async function updateSistemaCategoria(id: string, categoria: Partial<SistemaCategoria>) {
  try {
    const ref = doc(db, 'sistemas', id);
    await setDoc(ref, { ...categoria, updatedAt: new Date().toISOString() }, { merge: true });
    return { _docId: id, ...categoria };
  } catch (e) {
    console.error('updateSistemaCategoria error:', e); // Changed _e to e
    throw e;
  }
}

export async function deleteSistemaCategoria(id: string) {
  try {
    const ref = doc(db, 'sistemas', id);
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error('deleteSistemaCategoria error:', e); // Changed _e to e
    throw e;
  }
}

export async function getSistemasCategorias() {
  try {
    const col = collection(db, 'sistemas');
    const snap = await getDocs(col);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SistemaCategoria[];
  } catch (e) { // Changed _e to e
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
      console.error('subscribeSistemasCategorias error:', err); // Changed _e to err
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeSistemasCategorias error:', e);
    return () => {};
  }
}

/**
 * Suscribe a los equipos de un sistema específico (colección dinámica).
 * Por ejemplo, si catNombre es "SISTEMA EXTINTORES", escuchará la colección "extintores".
 */
export function subscribeEquiposBySystem(catNombre: string, callback: (equipos: SistemaEquipo[]) => void) {
  try {
    const systemId = getCollectionName(catNombre);
    // Nueva ruta anidada: sistemas -> [ID Sistema] -> equipos
    const col = collection(db, 'sistemas', systemId, 'equipos');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return { ...data, id: d.id };
      }) as SistemaEquipo[];
      callback(items);
    }, (err) => {
      console.error(`Error en suscripción a equipos de ${systemId}:`, err);
    }); // Changed _e to err
    return unsub;
  } catch (e) {
    return () => {};
  }
}

/**
 * Guarda o actualiza un equipo individual en su colección de sistema correspondiente.
 */
export async function saveEquipoToSystemCollection(catNombre: string, equipo: SistemaEquipo) {
  try {
    const systemId = getCollectionName(catNombre);
    const ref = doc(db, 'sistemas', systemId, 'equipos', equipo.id);
    await setDoc(ref, { 
      ...equipo, 
      idCategoria: systemId,
      updatedAt: new Date().toISOString() 
    });
    return true;
  } catch (e) {
    console.error('Error al guardar equipo en Firestore:', e); // Changed _e to e
    throw e;
  }
}

/**
 * Elimina un equipo de su colección de sistema.
 */
export async function deleteEquipoFromSystemCollection(catNombre: string, equipoId: string) {
  try {
    const systemId = getCollectionName(catNombre);
    const ref = doc(db, 'sistemas', systemId, 'equipos', equipoId);
    await deleteDoc(ref);
    return true;
  } catch (e) { // Changed _e to e
    console.error('Error al eliminar equipo de Firestore:', e);
    throw e;
  }
}

/**
 * Sincroniza cada sistema en su propia colección de Firestore.
 * Por ejemplo: "SISTEMA EXTINTORES" -> Colección "extintores"
 */
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
          idCategoria: systemId,
          updatedAt: new Date().toISOString() 
        });
      }
    }
    return true; // Changed _e to e
  } catch (e: any) {
    console.error('Error en syncSistemas:', e);
    throw e;
  }
}

/**
 * ARTICULOS - operaciones con Firestore
 * getArticulos: obtiene todos los articulos una sola vez
 * subscribeArticulos: escucha cambios en tiempo real y llama al callback con la lista actualizada
 * saveArticulo: guarda o actualiza un articulo
 * deleteArticulo: elimina un articulo
 */

export async function getArticulos() {
  try {
    const col = collection(db, 'articulos');
    const snap = await getDocs(col);
    return snap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, ...data };
    }) as Articulo[];
  } catch (e) { // Changed _e to e
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
      console.error('subscribeArticulos error:', err); // Changed _e to err
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
    // Si el objeto articulo incluye un campo `id` lo usamos como documentId en Firestore
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
  } catch (e) { // Changed _e to e
    console.error('saveArticulo error:', e);
    throw e;
  }
}

export async function deleteArticulo(id: string) {
  try {
    const ref = doc(db, 'articulos', id);
    await deleteDoc(ref);
    return true;
  } catch (e) { // Changed _e to e
    console.error('deleteArticulo error:', e);
    throw e;
  }
}

/**
 * FAMILIAS - opciones para el desplegable de familia en artículos.
 */
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
  } catch (e) { // Changed _e to e
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
    }, (err) => { // Changed _e to err
      console.error('subscribeFamilias error:', err);
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeFamilias error:', e);
    return () => {};
  }
}

/**
 * ALBARANES - operaciones con Firestore (colección "albaranes").
 */

export async function addAlbaran(albaran: Albaran) {
  try {
    const col = collection(db, 'albaranes');
    
    const albaranToSave = {
      ...albaran,
      updatedAt: new Date().toISOString()
    };

    // If albaran.id is provided, use it as the document ID.
    // This is useful for manually created albaranes where the ID is set by the user.
    // For albaranes generated from Partes, the 'id' field is already unique.
    if (albaran.id) {
      const docRef = doc(db, 'albaranes', albaran.id);
      await setDoc(docRef, albaranToSave);
      console.info('addAlbaran: created with custom ID', albaran.id);
      return { ...albaranToSave, _docId: albaran.id };
    } else {
      // If no ID is provided, let Firestore generate one. // Removed duplicate id: newDocRef.id
      const newDocRef = await addDoc(col, albaranToSave);
      console.info('addAlbaran: created with generated ID', newDocRef.id);
      const { id: _, ...rest } = albaranToSave;
      return { ...rest, _docId: newDocRef.id, id: newDocRef.id };
    }
  } catch (e) {
    console.error('addAlbaran error:', e);
    throw e; // Changed _e to e
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
  } catch (e) { // Changed _e to e
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
  } catch (e) { // Changed _e to e
    console.error('deleteAlbaran error:', e);
    throw e;
  }
}

export function subscribeAlbaranes(callback: (albaranes: Albaran[]) => void) {
  try {
    const col = collection(db, 'albaranes');
    const unsub = onSnapshot(col, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Albaran[];
      callback(items);
    }, (err) => {
      console.error('subscribeAlbaranes error:', err); // Changed _e to err
      callback([]);
    });
    return unsub;
  } catch (e) {
    console.error('subscribeAlbaranes error:', e);
    return () => {};
  }
}

export {app, storage, db, analytics};
