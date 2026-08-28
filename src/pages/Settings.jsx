import { useState } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import SimpleFinConnect from '../components/SimpleFinConnect'

export default function Settings() {
  const { household } = useHousehold()
  const [copied, setCopied] = useState(false)

  function copyInvite() {
    navigator.clipboard.writeText(household.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl">Settings</h1>

      <section className="bg-paper-raised border border-line rounded-lg p-4">
        <h2 className="font-display text-xl mb-1">{household?.name}</h2>
        <p className="text-sm text-ink-soft mb-3">
          {household?.memberUids?.length || 1} member{household?.memberUids?.length === 1 ? '' : 's'}
        </p>
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">Invite code</p>
        <div className="flex items-center gap-3">
          <code className="font-mono-num text-lg bg-white/60 border border-line rounded px-3 py-1.5">
            {household?.inviteCode}
          </code>
          <button onClick={copyInvite} className="text-amber text-sm font-medium hover:underline">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-ink-soft mt-2">Share this code so a partner can join the same household.</p>
      </section>

      <SimpleFinConnect />
    </div>
  )
}
