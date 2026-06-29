import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqxTDdTXikySejIXDDIjm1ZYzlmZXS0zs",
  authDomain: "app-abanfoc-v1.firebaseapp.com",
  projectId: "app-abanfoc-v1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const centroId = "IAGfXzFVqVHqTdsYZKbF";

async function main() {
  console.log(`=== SYSTEMS FOR CENTRO: ${centroId} ===`);
  const sistemasCol = collection(db, "centros", centroId, "sistemas");
  const sistSnap = await getDocs(sistemasCol);
  
  for (const sistDoc of sistSnap.docs) {
    const sistData = sistDoc.data();
    console.log(`Sistema ID: ${sistDoc.id} | Tipo: ${sistData.tipo} | Familia: ${sistData.familia}`);
    
    // Fetch equipments
    const eqCol = collection(db, "centros", centroId, "sistemas", sistDoc.id, "equipos");
    const eqSnap = await getDocs(eqCol);
    console.log(`  Equipos:`);
    eqSnap.forEach(eqDoc => {
      const eqData = eqDoc.data();
      console.log(`    - Cod: ${eqData.codigo} | Nom: ${eqData.nombre} | Ubicacion: ${eqData.ubicacion} | FechaFab: ${eqData.fechaFabricacion} | UltimoRetimbre: ${eqData.ultimoRetimbre}`);
      // Log all keys and values
      console.log(`      Raw:`, JSON.stringify(eqData));
    });
  }

  // Also query plantillas to see their items
  console.log(`\n=== PLANTILLAS IN DATABASE ===`);
  const plantillasCol = collection(db, "plantillas");
  const pSnap = await getDocs(plantillasCol);
  for (const pDoc of pSnap.docs) {
    console.log(`Plantilla: ${pDoc.data().nombre} (${pDoc.id})`);
    const itemsCol = collection(db, "plantillas", pDoc.id, "items");
    const itemsSnap = await getDocs(itemsCol);
    itemsSnap.docs.forEach(d => {
      console.log(`  - [${d.data().tipoRespuesta}] Key: ${d.data().key} | Label: ${d.data().label}`);
    });
  }
}

main().catch(console.error);
