import { initializeApp } from "firebase/app";
import { getFirestore, doc, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqxTDdTXikySejIXDDIjm1ZYzlmZXS0zs",
  authDomain: "app-abanfoc-v1.firebaseapp.com",
  projectId: "app-abanfoc-v1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log("=== INSPECTING CLIENT CENTROS INVENTARIO ===");
  // Let's get all centros
  const centrosCol = collection(db, "centros");
  const snapCentros = await getDocs(centrosCol);
  
  for (const docCentro of snapCentros.docs) {
    const centro = docCentro.data();
    console.log(`\nCentro ID=${docCentro.id}, Nombre=${centro.nombre}`);
    
    const inventarioCol = collection(db, "centros", docCentro.id, "inventario");
    try {
      const snapInv = await getDocs(inventarioCol);
      console.log(`  Inventario systems count: ${snapInv.docs.length}`);
      for (const docInv of snapInv.docs) {
        const inv = docInv.data();
        console.log(`    System ID=${docInv.id}, Nombre=${inv.nombre}, Familia=${inv.familia}, Tipo=${inv.tipo}`);
        
        // Let's count equipments in this system
        const eqCol = collection(db, "centros", docCentro.id, "inventario", docInv.id, "equipos");
        const snapEq = await getDocs(eqCol);
        console.log(`      Equipments count: ${snapEq.docs.length}`);
      }
    } catch (e) {
      console.log("  Error fetching inventario:", e.message);
    }
  }
}

main().catch(console.error);
