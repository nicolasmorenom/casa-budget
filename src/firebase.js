import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCLZW6tjwb4PbVGqhKJOOszIo9vaHB3z-o",
  authDomain: "casa-budget.firebaseapp.com",
  projectId: "casa-budget",
  storageBucket: "casa-budget.firebasestorage.app",
  messagingSenderId: "323178896592",
  appId: "1:323178896592:web:d117ecef7ec2a5873192d5"
};

const app = initializeApp(firebaseConfig);
export const auth           = getAuth(app);
export const db             = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
