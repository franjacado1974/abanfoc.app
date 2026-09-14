import {
  subscribeTrabajos as firebaseSubscribeTrabajos
} from '../../recursos-compartidos/firebase/firebase';

export const subscribeTrabajos = (callback: (trabajos: any[]) => void) => {
  return firebaseSubscribeTrabajos(callback);
};
