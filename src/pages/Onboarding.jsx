import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { createHousehold, joinHouseholdByInviteCode } from '../lib/firestore'

export default function Onboarding() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [mode, setMode] = useState('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const profile = { displayName: user.displayName, email: user.email }
    try {
      if (mode === 'create') await createHousehold(user.uid, name.trim() || 'Our Household', profile)
      else await joinHouseholdByInviteCode(user.uid, code, profile)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="font-display text-2xl mb-1">{t('onboarding.title')}</p>
        <p className="text-ink-soft text-sm mb-6">{t('onboarding.subtitle')}</p>

        <div className="flex gap-2 mb-4 text-sm">
          <button
            className={`flex-1 rounded py-2 border ${mode === 'create' ? 'bg-ink text-paper border-ink' : 'border-line'}`}
            onClick={() => setMode('create')}
          >
            {t('onboarding.createNew')}
          </button>
          <button
            className={`flex-1 rounded py-2 border ${mode === 'join' ? 'bg-ink text-paper border-ink' : 'border-line'}`}
            onClick={() => setMode('join')}
          >
            {t('onboarding.joinExisting')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'create' ? (
            <input
              className="border border-line rounded px-3 py-2 bg-paper-raised"
              placeholder={t('onboarding.householdName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : (
            <input
              className="border border-line rounded px-3 py-2 bg-paper-raised uppercase"
              placeholder={t('onboarding.inviteCode')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          )}
          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="bg-amber text-paper rounded py-2 font-medium hover:brightness-95 transition disabled:opacity-50"
          >
            {mode === 'create' ? t('onboarding.createButton') : t('onboarding.joinButton')}
          </button>
        </form>
      </div>
    </div>
  )
}
