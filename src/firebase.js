import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBmdPXOv_7tPKnO2wA7R-2XotT_sWTAZnM",
  authDomain: "budget-app-public.firebaseapp.com",
  databaseURL: "https://budget-app-public-default-rtdb.firebaseio.com",
  projectId: "budget-app-public",
  storageBucket: "budget-app-public.firebasestorage.app",
  messagingSenderId: "575176881739",
  appId: "1:575176881739:web:e48b33f90629c82e477fce"
};

const app = initializeApp(firebaseConfig);
export const auth           = getAuth(app);
export const db             = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
