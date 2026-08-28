import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signin') await signIn(email, password)
      else await signUp(email, password, name)
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-4xl leading-none">Casa</p>
          <p className="font-display text-4xl leading-none text-amber -mt-1">Budget</p>
          <p className="text-ink-soft mt-3 text-sm">The household ledger, kept together.</p>
        </div>

        <div className="bg-paper-raised border border-line rounded-lg p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <input
                className="border border-line rounded px-3 py-2 bg-white/60"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <input
              className="border border-line rounded px-3 py-2 bg-white/60"
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="border border-line rounded px-3 py-2 bg-white/60"
              type="password"
              placeholder="Password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-rust">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="bg-ink text-paper rounded py-2 font-medium hover:bg-ink-soft transition-colors disabled:opacity-50"
            >
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4 text-xs text-ink-soft">
            <div className="h-px bg-line flex-1" /> or <div className="h-px bg-line flex-1" />
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full border border-line rounded py-2 font-medium hover:bg-white/60 transition-colors"
          >
            Continue with Google
          </button>
        </div>

        <p className="text-center text-sm text-ink-soft mt-4">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="text-amber font-medium hover:underline"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
