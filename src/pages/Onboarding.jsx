import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { createHousehold, joinHouseholdByInviteCode } from '../lib/firestore'

export default function Onboarding() {
  const { user } = useAuth()
  const [mode, setMode] = useState('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'create') await createHousehold(user.uid, name.trim() || 'Our Household')
      else await joinHouseholdByInviteCode(user.uid, code)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="font-display text-2xl mb-1">Set up your household</p>
        <p className="text-ink-soft text-sm mb-6">
          A household is the shared ledger — accounts, categories, and transactions everyone in it can see.
        </p>

        <div className="flex gap-2 mb-4 text-sm">
          <button
            className={`flex-1 rounded py-2 border ${mode === 'create' ? 'bg-ink text-paper border-ink' : 'border-line'}`}
            onClick={() => setMode('create')}
          >
            Create new
          </button>
          <button
            className={`flex-1 rounded py-2 border ${mode === 'join' ? 'bg-ink text-paper border-ink' : 'border-line'}`}
            onClick={() => setMode('join')}
          >
            Join existing
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'create' ? (
            <input
              className="border border-line rounded px-3 py-2 bg-paper-raised"
              placeholder="Household name (e.g. Moreno-Silva)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : (
            <input
              className="border border-line rounded px-3 py-2 bg-paper-raised uppercase"
              placeholder="Invite code"
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
            {mode === 'create' ? 'Create household' : 'Join household'}
          </button>
        </form>
      </div>
    </div>
  )
}
