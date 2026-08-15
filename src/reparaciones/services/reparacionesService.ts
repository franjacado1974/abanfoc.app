import {
  subscribeReparaciones as firebaseSubscribeReparaciones,
  addReparacion as firebaseAddReparacion,
  updateReparacion as firebaseUpdateReparacion,
  deleteReparacion as firebaseDeleteReparacion
} from '../../recursos-compartidos/firebase/firebase';

export const subscribeReparaciones = (callback: (items: any[]) => void) => {
  return firebaseSubscribeReparaciones(callback);
};

export const createReparacion = async (data: any): Promise<any> => {
  return firebaseAddReparacion(data);
};

export const updateReparacion = async (docId: string, data: Partial<any>): Promise<any> => {
  return firebaseUpdateReparacion(docId, data);
};

export const deleteReparacion = async (docId: string): Promise<any> => {
  return firebaseDeleteReparacion(docId);
};
