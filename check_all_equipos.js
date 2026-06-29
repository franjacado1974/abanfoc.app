import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqxTDdTXikySejIXDDIjm1ZYzlmZXS0zs",
  authDomain: "app-abanfoc-v1.firebaseapp.com",
  projectId: "app-abanfoc-v1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log("=== SCANNING ALL CENTROS AND EQUIPOS ===");
  const centrosCol = collection(db, "centros");
  const centrosSnap = await getDocs(centrosCol);
  
  for (const centroDoc of centrosSnap.docs) {
    const centroData = centroDoc.data();
    const centroId = centroDoc.id;
    
    const sistemasCol = collection(db, "centros", centroId, "inventario");
    const sistSnap = await getDocs(sistemasCol);
    
    for (const sistDoc of sistSnap.docs) {
      const sistData = sistDoc.data();
      const eqCol = collection(db, "centros", centroId, "inventario", sistDoc.id, "equipos");
      const eqSnap = await getDocs(eqCol);
      
      if (eqSnap.docs.length > 0) {
        console.log(`\nCentro: ${centroData.nombre} (${centroId}) | Sistema: ${sistData.tipo || sistData.familia} (${sistDoc.id})`);
        for (const eqDoc of eqSnap.docs) {
          const eqData = eqDoc.data();
          console.log(`  Equipment Code: ${eqData.codigo} | Name: ${eqData.nombre}`);
          console.log(`    Keys:`, JSON.stringify(eqData));
        }
      }
    }
  }
}

main().catch(console.error);
