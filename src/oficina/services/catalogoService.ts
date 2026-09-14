import {
  subscribeArticulos as firebaseSubscribeArticulos,
  saveArticulo as firebaseSaveArticulo,
  deleteArticulo as firebaseDeleteArticulo,
  subscribeFamilias as firebaseSubscribeFamilias
} from '../../recursos-compartidos/firebase/firebase';
import type { Articulo, Familia } from '../../recursos-compartidos/types/models';

export const subscribeArticulos = (callback: (articulos: Articulo[]) => void) => {
  return firebaseSubscribeArticulos(callback as any);
};

export const saveArticulo = async (articulo: any): Promise<any> => {
  return firebaseSaveArticulo(articulo);
};

export const deleteArticulo = async (id: string): Promise<boolean> => {
  return firebaseDeleteArticulo(id);
};

export const subscribeFamilias = (callback: (familias: Familia[]) => void) => {
  return firebaseSubscribeFamilias(callback as any);
};
