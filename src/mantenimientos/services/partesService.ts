import {
  subscribePartes as firebaseSubscribePartes,
  addParte as firebaseAddParte,
  updateParte as firebaseUpdateParte,
  deleteParte as firebaseDeleteParte
} from '../../recursos-compartidos/firebase/firebase';
import type { Parte } from '../../recursos-compartidos/types/models';

export const subscribePartes = (callback: (partes: Parte[]) => void) => {
  return firebaseSubscribePartes(callback as any);
};

export const createParte = async (parte: any): Promise<any> => {
  return firebaseAddParte(parte);
};

export const updateParte = async (id: string, updates: Partial<Parte>): Promise<any> => {
  return firebaseUpdateParte(id, updates as any);
};

export const cambiarEstadoParte = async (id: string, nuevoEstado: Parte['estado']): Promise<any> => {
  return firebaseUpdateParte(id, { estado: nuevoEstado });
};

export const deleteParte = async (id: string): Promise<boolean> => {
  return firebaseDeleteParte(id);
};
