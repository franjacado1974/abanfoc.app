import {
  subscribeCentros as firebaseSubscribeCentros,
  addCentro as firebaseAddCentro,
  updateCentro as firebaseUpdateCentro,
  deleteCentro as firebaseDeleteCentro,
  saveContrato as firebaseSaveContrato,
  addCentroSistema as firebaseAddCentroSistema,
  updateCentroSistema as firebaseUpdateCentroSistema,
  deleteCentroSistema as firebaseDeleteCentroSistema,
  subscribeCentroSistemas as firebaseSubscribeCentroSistemas,
  addEquipoInstalado as firebaseAddEquipoInstalado,
  updateEquipoInstalado as firebaseUpdateEquipoInstalado,
  deleteEquipoInstalado as firebaseDeleteEquipoInstalado,
  subscribeEquiposInstalados as firebaseSubscribeEquiposInstalados
} from '../../recursos-compartidos/firebase/firebase';
import type { Centro, CentroSistema, EquipoInstalado } from '../../recursos-compartidos/types/models';

export const subscribeCentros = (callback: (centros: Centro[]) => void) => {
  return firebaseSubscribeCentros(callback as any);
};

export const createCentro = async (centro: any): Promise<any> => {
  return firebaseAddCentro(centro);
};

export const updateCentro = async (id: string, centro: any): Promise<any> => {
  return firebaseUpdateCentro(id, centro);
};

export const deleteCentro = async (id: string): Promise<boolean> => {
  return firebaseDeleteCentro(id);
};

export const saveContrato = async (centroDocId: string, contratoData: any): Promise<any> => {
  return firebaseSaveContrato(centroDocId, contratoData);
};

export const subscribeCentroSistemas = (centroId: string, callback: (sistemas: CentroSistema[]) => void) => {
  return firebaseSubscribeCentroSistemas(centroId, callback as any);
};

export const addCentroSistema = async (sistema: any): Promise<any> => {
  return firebaseAddCentroSistema(sistema);
};

export const updateCentroSistema = async (centroId: string, sistemaId: string, sistema: Partial<CentroSistema>): Promise<any> => {
  return firebaseUpdateCentroSistema(centroId, sistemaId, sistema as any);
};

export const deleteCentroSistema = async (centroId: string, sistemaId: string): Promise<any> => {
  return firebaseDeleteCentroSistema(centroId, sistemaId);
};

export const subscribeEquiposInstalados = (centroId: string, sistemaId: string, callback: (equipos: EquipoInstalado[]) => void) => {
  return firebaseSubscribeEquiposInstalados(centroId, sistemaId, callback as any);
};

export const addEquipoInstalado = async (equipo: any): Promise<any> => {
  return firebaseAddEquipoInstalado(equipo);
};

export const updateEquipoInstalado = async (id: string, equipo: Partial<EquipoInstalado>, fallbackCentroId?: string, fallbackSistemaId?: string): Promise<any> => {
  return firebaseUpdateEquipoInstalado(id, equipo, fallbackCentroId, fallbackSistemaId);
};

export const deleteEquipoInstalado = async (centroId: string, sistemaId: string, equipoId: string): Promise<any> => {
  return firebaseDeleteEquipoInstalado(centroId, sistemaId, equipoId);
};
