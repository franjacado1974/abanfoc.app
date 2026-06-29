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
  const plantillasCol = collection(db, "plantillas");
  const pSnap = await getDocs(plantillasCol);
  console.log("=== TEMPLATE LENGTHS ===");
  for (const pDoc of pSnap.docs) {
    const itemsCol = collection(db, "plantillas", pDoc.id, "items");
    const itemsSnap = await getDocs(itemsCol);
    console.log(`Plantilla: ${pDoc.data().nombre} (${pDoc.id}) -> ${itemsSnap.docs.length} items`);
  }
}

main().catch(console.error);
