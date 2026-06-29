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
  const detId = "hTHz3Tbsr0QRi3f8tIiu";
  const itemsCol = collection(db, "plantillas", detId, "items");
  const itemsSnap = await getDocs(itemsCol);
  console.log(`Found ${itemsSnap.docs.length} items in template DETECCION:`);
  
  const counts = {};
  const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  for (const item of items) {
    counts[item.key] = (counts[item.key] || 0) + 1;
  }
  
  console.log("=== KEY COUNTS ===");
  Object.keys(counts).forEach(k => {
    if (counts[k] > 1) {
      console.log(`Key "${k}" appears ${counts[k]} times!`);
    }
  });

  console.log("=== FIRST 20 ITEMS ===");
  const sorted = items.sort((a,b) => a.orden - b.orden);
  for (let i = 0; i < Math.min(20, sorted.length); i++) {
    const item = sorted[i];
    console.log(`- ID: ${item.id} | Order: ${item.orden} | Label: "${item.label}" | Key: "${item.key}"`);
  }
}

main().catch(console.error);
