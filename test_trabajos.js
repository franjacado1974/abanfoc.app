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
  const q = collection(db, "trabajos");
  const snap = await getDocs(q);
  console.log("Docs found:", snap.size);
  snap.forEach(doc => console.log(doc.id, doc.data()));
}
main().catch(console.error);