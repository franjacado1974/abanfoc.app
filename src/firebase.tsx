// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAqxTDdTXikySejIXDDIjm1ZYzlmZXS0zs",
  authDomain: "app-abanfoc-v1.firebaseapp.com",
  projectId: "app-abanfoc-v1",
  storageBucket: "app-abanfoc-v1.firebasestorage.app",
  messagingSenderId: "468455047562",
  appId: "1:468455047562:web:3d8fb53011ca4b1718c873",
  measurementId: "G-JW0T2BFDY8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const storage= getStorage(app);
const db = getFirestore(app);

export {app, storage, db, analytics};