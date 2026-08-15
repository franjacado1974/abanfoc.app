import {
  subscribeRevisiones as firebaseSubscribeRevisiones,
  addRevision as firebaseAddRevision,
  updateRevision as firebaseUpdateRevision,
  deleteRevision as firebaseDeleteRevision,
  getEquiposInstalados as firebaseGetEquiposInstalados,
  deleteEquipoInstalado as firebaseDeleteEquipoInstalado,
  subscribeEquiposInstalados as firebaseSubscribeEquiposInstalados,
  addEquipoInstalado as firebaseAddEquipoInstalado,
  updateEquipoInstalado as firebaseUpdateEquipoInstalado
} from '../../recursos-compartidos/firebase/firebase';

export const subscribeRevisiones = (callback: (revisiones: any[]) => void) => {
  return firebaseSubscribeRevisiones(callback);
};

export const addRevision = async (data: any): Promise<void> => {
  await firebaseAddRevision(data);
};

export const updateRevision = async (docId: string, data: Partial<any>): Promise<void> => {
  await firebaseUpdateRevision(docId, data);
};

export const deleteRevision = async (docId: string): Promise<void> => {
  await firebaseDeleteRevision(docId);
};

export const getEquiposInstalados = async (centroId: string, sistemaId: string): Promise<any[]> => {
  return firebaseGetEquiposInstalados(centroId, sistemaId);
};

export const deleteEquipoInstalado = async (centroId: string, sistemaId: string, equipoId: string): Promise<void> => {
  await firebaseDeleteEquipoInstalado(centroId, sistemaId, equipoId);
};

export const subscribeEquiposInstalados = (centroId: string, sistemaId: string, callback: (equipos: any[]) => void) => {
  return firebaseSubscribeEquiposInstalados(centroId, sistemaId, callback);
};

export const addEquipoInstalado = async (equipo: any): Promise<any> => {
  return firebaseAddEquipoInstalado(equipo);
};

export const updateEquipoInstalado = async (id: string, equipo: Partial<any>, fallbackCentroId?: string, fallbackSistemaId?: string): Promise<any> => {
  return firebaseUpdateEquipoInstalado(id, equipo, fallbackCentroId, fallbackSistemaId);
};
