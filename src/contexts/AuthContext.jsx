import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

// This deployment is private to the household — anyone else who signs up gets
// bounced immediately. Firestore rules enforce the same list server-side (see
// isAllowedEmail() in firestore.rules), so this isn't just a client-side gate.
const ALLOWED_EMAILS = ['nicolasm1410@gmail.com', 'n.rodriguez2338@gmail.com']

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = signed out
  const [blocked, setBlocked] = useState(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (u && !ALLOWED_EMAILS.includes(u.email)) {
          signOut(auth)
          setUser(null)
          setBlocked(true)
          return
        }
        setBlocked(false)
        setUser(u)
      }),
    []
  )

  const value = {
    user,
    loading: user === undefined,
    blocked,
    signUp: async (email, password, displayName) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName) await updateProfile(cred.user, { displayName })
      return cred.user
    },
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signInWithGoogle: () => signInWithPopup(auth, googleProvider),
    signOutUser: () => signOut(auth),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
