import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqxTDdTXikySejIXDDIjm1ZYzlmZXS0zs",
  authDomain: "app-abanfoc-v1.firebaseapp.com",
  projectId: "app-abanfoc-v1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log("=== CONFIGURING SECTION 1 ITEMS BY QUERY ===");
  const templateId = "hTHz3Tbsr0QRi3f8tIiu";
  
  // Delete new_sec1_q2 and new_sec1_q3
  try { await deleteDoc(doc(db, "plantillas", templateId, "items", "new_sec1_q2")); } catch(e){}
  try { await deleteDoc(doc(db, "plantillas", templateId, "items", "new_sec1_q3")); } catch(e){}
  console.log("Deleted placeholders.");

  // Get all items under template items subcollection
  const snap = await getDocs(collection(db, "plantillas", templateId, "items"));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const findDocByLabel = (labelPattern) => {
    return items.find(item => {
      const lbl = (item.label || '').toUpperCase().trim();
      const pat = labelPattern.toUpperCase().trim();
      return lbl.includes(pat);
    });
  };

  // Define target items
  const targets = [
    { pattern: "Fecha de revisión", label: "Fecha de revisión", orden: 2 },
    { pattern: "Central nº", label: "Central nº", orden: 3 },
    { pattern: "Marca", label: "Marca", orden: 4 },
    { pattern: "Modelo", label: "Modelo", orden: 5 },
    { pattern: "Cantidad de zonas", label: "Cantidad de zonas o lazos", orden: 6 },
    { pattern: "Zonas o lazos libres", label: "Zonas o lazos libres", orden: 7 },
    { pattern: "marcado CE", label: "¿La central tiene marcado CE?", orden: 8 },
    { pattern: "conexión a otra central", label: "¿Existe conexión a otra central?", orden: 9 },
    { pattern: "Panel repetidor", label: "¿Existe Panel repetidor de alarmas:?", orden: 10 },
    { pattern: "Central Receptora de Alarmas", label: "¿Existe conexión a Central Receptora de Alarmas", orden: 11 },
    { pattern: "Ubicación de la central", label: "La central se encuentra vigilada 24H", orden: 12, tipoRespuesta: "desplegable", opciones: ["Sí", "No", "N/A"] },
    { pattern: "Tipo de sistema", label: "Se envía transmisión de señales a CRA", orden: 13, tipoRespuesta: "desplegable", opciones: ["Sí", "No", "N/A"] }
  ];

  for (const t of targets) {
    const found = findDocByLabel(t.pattern);
    if (found) {
      const docRef = doc(db, "plantillas", templateId, "items", found.id);
      const dataToUpdate = {
        label: t.label,
        orden: t.orden
      };
      if (t.tipoRespuesta) dataToUpdate.tipoRespuesta = t.tipoRespuesta;
      if (t.opciones) dataToUpdate.opciones = t.opciones;
      
      await updateDoc(docRef, dataToUpdate);
      console.log(`Updated "${found.label}" -> "${t.label}" (orden: ${t.orden})`);
    } else {
      console.log(`WARNING: Could not find item with pattern "${t.pattern}"`);
    }
  }

  // Set new_sec1_q1 to "Existen planos de la instalación"
  await setDoc(doc(db, "plantillas", templateId, "items", "new_sec1_q1"), {
    key: "item_new_sec1_q1",
    label: "Existen planos de la instalación",
    tipoRespuesta: "desplegable",
    opciones: ["Sí", "No", "N/A"],
    requerido: false,
    plantillaId: templateId,
    orden: 13.5,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  console.log("Configured new_sec1_q1 for 'Existen planos de la instalación'.");

  console.log("Configuration finished successfully!");
}

main().catch(console.error);
