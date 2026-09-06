import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

export default function Login() {
  const { signIn, signUp, signInWithGoogle, blocked } = useAuth()
  const { t, lang, setLang } = useLanguage()
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
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <button
        onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
        className="absolute top-4 right-4 text-xs border border-line rounded-full px-3 py-1 text-ink-soft hover:bg-paper-raised"
      >
        {lang === 'es' ? 'EN' : 'ES'}
      </button>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-4xl leading-none">Casa</p>
          <p className="font-display text-4xl leading-none text-amber -mt-1">Budget</p>
          <p className="text-ink-soft mt-3 text-sm">{t('login.tagline')}</p>
        </div>

        {blocked && (
          <p className="bg-rust-soft text-rust text-sm rounded-lg px-4 py-3 mb-4 text-center">{t('login.blocked')}</p>
        )}

        <div className="bg-paper-raised border border-line rounded-lg p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <input
                className="border border-line rounded px-3 py-2 bg-white/60"
                placeholder={t('login.name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <input
              className="border border-line rounded px-3 py-2 bg-white/60"
              type="email"
              placeholder={t('login.email')}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="border border-line rounded px-3 py-2 bg-white/60"
              type="password"
              placeholder={t('login.password')}
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
              {mode === 'signin' ? t('login.signIn') : t('login.signUp')}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4 text-xs text-ink-soft">
            <div className="h-px bg-line flex-1" /> {t('login.or')} <div className="h-px bg-line flex-1" />
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full border border-line rounded py-2 font-medium hover:bg-white/60 transition-colors"
          >
            {t('login.google')}
          </button>
        </div>

        <p className="text-center text-sm text-ink-soft mt-4">
          {mode === 'signin' ? t('login.noAccount') : t('login.hasAccount')}
          <button
            className="text-amber font-medium hover:underline"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? t('login.signUp') : t('login.signIn')}
          </button>
        </p>
      </div>
    </div>
  )
}
