import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Values come from Vite env vars (see .env.example) so the same code can
// point at a different Firebase project per environment. Defaults below
// fall back to the budget-app-public project if no .env is present.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBmdPXOv_7tPKnO2wA7R-2XotT_sWTAZnM',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'budget-app-public.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://budget-app-public-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'budget-app-public',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'budget-app-public.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '575176881739',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:575176881739:web:e48b33f90629c82e477fce',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
