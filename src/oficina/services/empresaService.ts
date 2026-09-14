import {
  subscribeTecnicos as firebaseSubscribeTecnicos,
  saveTecnico as firebaseSaveTecnico,
  deleteTecnico as firebaseDeleteTecnico,
  subscribeImpuestos as firebaseSubscribeImpuestos,
  saveImpuestoConfig as firebaseSaveImpuestoConfig
} from '../../recursos-compartidos/firebase/firebase';
import type { Tecnico } from '../../recursos-compartidos/types/models';

export const subscribeTecnicos = (callback: (tecnicos: Tecnico[]) => void) => {
  return firebaseSubscribeTecnicos(callback as any);
};

export const saveTecnico = async (tecnico: any): Promise<any> => {
  return firebaseSaveTecnico(tecnico);
};

export const deleteTecnico = async (id: string): Promise<boolean> => {
  return firebaseDeleteTecnico(id);
};

export const subscribeImpuestos = (callback: (config: any) => void) => {
  return firebaseSubscribeImpuestos(callback);
};

export const saveImpuestoConfig = async (config: { iva: number; exento: boolean }): Promise<any> => {
  return firebaseSaveImpuestoConfig(config);
};
