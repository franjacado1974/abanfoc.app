import {
  subscribeInstalaciones as firebaseSubscribeInstalaciones,
  addInstalacion as firebaseAddInstalacion,
  updateInstalacion as firebaseUpdateInstalacion,
  deleteInstalacion as firebaseDeleteInstalacion
} from '../../recursos-compartidos/firebase/firebase';

export const subscribeInstalaciones = (callback: (items: any[]) => void) => {
  return firebaseSubscribeInstalaciones(callback);
};

export const createInstalacion = async (data: any): Promise<any> => {
  return firebaseAddInstalacion(data);
};

export const updateInstalacion = async (docId: string, data: Partial<any>): Promise<any> => {
  return firebaseUpdateInstalacion(docId, data);
};

export const deleteInstalacion = async (docId: string): Promise<any> => {
  return firebaseDeleteInstalacion(docId);
};
