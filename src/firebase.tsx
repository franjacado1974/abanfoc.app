// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, getDocs, query, where, addDoc, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { getStorage } from "firebase/storage";
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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const storage= getStorage(app);
const db = getFirestore(app);

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
    console.error('verifyUser error:', e);
    return null;
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

export async function addCentro(centro: any) {
  try {
    const col = collection(db, 'centros');
    // Si el objeto centro incluye un campo `id` lo usamos como documentId en Firestore
    if (centro && centro.id) {
      const ref = doc(db, 'centros', centro.id);
      console.info('addCentro: writing document with id', centro.id, 'data:', centro);
      await setDoc(ref, { ...centro, updatedAt: new Date().toISOString() });
      return { _docId: ref.id, id: centro.id ?? ref.id, ...centro };
    } else {
      const ref = await addDoc(col, { ...centro, updatedAt: new Date().toISOString() });
      console.info('addCentro: added new document', ref.id, 'data:', centro);
      return { _docId: ref.id, id: centro.id ?? ref.id, ...centro };
    }
  } catch (e) {
    console.error('addCentro error:', e);
    throw e;
  }
}

export async function updateCentro(id: string, centro: any) {
  try {
    const ref = doc(db, 'centros', id);
    await setDoc(ref, { ...centro, updatedAt: new Date().toISOString() }, { merge: true });
    return { _docId: id, id: centro.id ?? id, ...centro };
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

export async function getCentros() {
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

/**
 * subscribeCentros(callback): devuelve una función para cancelar la suscripción.
 * callback recibe la lista actualizada de centros.
 */
export function subscribeCentros(callback: (centros: any[]) => void) {
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

export {app, storage, db, analytics};