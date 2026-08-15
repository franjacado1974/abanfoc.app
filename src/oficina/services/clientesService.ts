import {
  subscribeClientes as firebaseSubscribeClientes,
  db
} from '../../recursos-compartidos/firebase/firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Cliente } from '../../recursos-compartidos/types/models';

export const subscribeClientes = (callback: (clientes: Cliente[]) => void) => {
  return firebaseSubscribeClientes(callback as any);
};

export const createCliente = async (cliente: Cliente): Promise<void> => {
  const ref = doc(db, 'clientes', cliente.id);
  await setDoc(ref, cliente);
};

export const updateCliente = async (id: string, updates: Partial<Cliente>): Promise<void> => {
  const ref = doc(db, 'clientes', id);
  await updateDoc(ref, updates as any);
};

export const deleteCliente = async (id: string): Promise<void> => {
  const ref = doc(db, 'clientes', id);
  await deleteDoc(ref);
};
