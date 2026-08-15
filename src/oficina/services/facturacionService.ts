import {
  subscribeAlbaranes as firebaseSubscribeAlbaranes,
  addAlbaran as firebaseAddAlbaran,
  updateAlbaran as firebaseUpdateAlbaran,
  deleteAlbaran as firebaseDeleteAlbaran,
  subscribePresupuestos as firebaseSubscribePresupuestos,
  addPresupuesto as firebaseAddPresupuesto,
  updatePresupuesto as firebaseUpdatePresupuesto,
  deletePresupuesto as firebaseDeletePresupuesto,
  subscribeCertificados as firebaseSubscribeCertificados,
  addCertificado as firebaseAddCertificado,
  deleteCertificado as firebaseDeleteCertificado
} from '../../recursos-compartidos/firebase/firebase';

export const subscribeAlbaranes = (callback: (albaranes: any[]) => void) => {
  return firebaseSubscribeAlbaranes(callback);
};

export const createAlbaran = async (albaran: any): Promise<any> => {
  return firebaseAddAlbaran(albaran);
};

export const updateAlbaran = async (albaran: any): Promise<any> => {
  return firebaseUpdateAlbaran(albaran);
};

export const deleteAlbaran = async (id: string): Promise<boolean> => {
  return firebaseDeleteAlbaran(id);
};

export const subscribePresupuestos = (callback: (presupuestos: any[]) => void) => {
  return firebaseSubscribePresupuestos(callback);
};

export const createPresupuesto = async (presupuesto: any): Promise<any> => {
  return firebaseAddPresupuesto(presupuesto);
};

export const updatePresupuesto = async (id: string, presupuesto: any): Promise<any> => {
  return firebaseUpdatePresupuesto(id, presupuesto);
};

export const deletePresupuesto = async (id: string): Promise<boolean> => {
  return firebaseDeletePresupuesto(id);
};

export const subscribeCertificados = (callback: (certificados: any[]) => void) => {
  return firebaseSubscribeCertificados(callback);
};

export const createCertificado = async (certificado: any): Promise<any> => {
  return firebaseAddCertificado(certificado);
};

export const deleteCertificado = async (id: string): Promise<boolean> => {
  return firebaseDeleteCertificado(id);
};
