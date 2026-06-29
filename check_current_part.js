import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqxTDdTXikySejIXDDIjm1ZYzlmZXS0zs",
  authDomain: "app-abanfoc-v1.firebaseapp.com",
  projectId: "app-abanfoc-v1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log("=== LATEST PARTS ===");
  const col = collection(db, "partes");
  const q = query(col, orderBy("updatedAt", "desc"), limit(5));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    console.log(`Parte ID: ${doc.id} | Centro ID: ${doc.data().centroId} | Estado: ${doc.data().estado} | Cliente: ${doc.data().clienteNombre} | Centro: ${doc.data().centroNombre} | Updated: ${doc.data().updatedAt}`);
  });
}

main().catch(console.error);
