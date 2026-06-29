import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqxTDdTXikySejIXDDIjm1ZYzlmZXS0zs",
  authDomain: "app-abanfoc-v1.firebaseapp.com",
  projectId: "app-abanfoc-v1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log("=== REMOVING DUPLICATE ITEMS FROM ALL TEMPLATES ===");
  const plantillasCol = collection(db, "plantillas");
  const plantillasSnap = await getDocs(plantillasCol);
  
  for (const plantillaDoc of plantillasSnap.docs) {
    const plantillaId = plantillaDoc.id;
    const plantillaNombre = plantillaDoc.data().nombre;
    console.log(`\nProcessing template: "${plantillaNombre}" (${plantillaId})`);
    
    const itemsCol = collection(db, "plantillas", plantillaId, "items");
    const itemsSnap = await getDocs(itemsCol);
    console.log(`  Current items count: ${itemsSnap.docs.length}`);
    
    const seenKeys = new Set();
    let deleteCount = 0;
    
    // Ordenar de forma determinista para mantener las primeras
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.orden - b.orden);
    
    for (const item of items) {
      if (seenKeys.has(item.key)) {
        // Delete this duplicate
        console.log(`  Deleting duplicate key "${item.key}" (ID: ${item.id}, Label: "${item.label}")`);
        const itemRef = doc(db, "plantillas", plantillaId, "items", item.id);
        await deleteDoc(itemRef);
        deleteCount++;
      } else {
        seenKeys.add(item.key);
      }
    }
    console.log(`  Finished template: Deleted ${deleteCount} items.`);
  }
}

main().catch(console.error);
