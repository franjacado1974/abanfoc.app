import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAqxTDdTXikySejIXDDIjm1ZYzlmZXS0zs",
  authDomain: "app-abanfoc-v1.firebaseapp.com",
  projectId: "app-abanfoc-v1",
  storageBucket: "app-abanfoc-v1.firebasestorage.app",
  messagingSenderId: "468455047562",
  appId: "1:468455047562:web:3d8fb53011ca4b1718c873",
  measurementId: "G-JW0T2BFDY8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  try {
    const q = query(collection(db, 'albaranes'), limit(30));
    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} albaranes`);
    snapshot.forEach(doc => {
      const data = doc.data();
      const firma = data.firmaCliente;
      console.log(`ID: ${doc.id}`);
      console.log(`  firmaCliente exists: ${firma !== undefined}`);
      console.log(`  firmaCliente type: ${typeof firma}`);
      if (firma) {
        console.log(`  firmaCliente length: ${firma.length}`);
        console.log(`  firmaCliente start: ${firma.slice(0, 50)}...`);
      }
    });
  } catch (err) {
    console.error('Error fetching data:', err);
  }
}

check().then(() => process.exit(0));
