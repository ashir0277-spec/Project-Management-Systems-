// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBEsTVO6JsqCeVam5LeZbHqjiHF5aV93Do",
  authDomain: "projectms-dedbf.firebaseapp.com",
  projectId: "projectms-dedbf",
  storageBucket: "projectms-dedbf.firebasestorage.app",
  messagingSenderId: "71074630336",
  appId: "1:71074630336:web:4933bf34dcc5f2821bfb25",
  measurementId: "G-1FKCZB0FHQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize services with app instance
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);  // ✅ FIXED - Now using getStorage!

console.log("✅ Firebase initialized successfully");
console.log("Storage bucket:", storage.app.options.storageBucket);

export default app;