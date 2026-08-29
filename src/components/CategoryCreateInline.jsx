import { useState } from 'react'
import { addCategory } from '../lib/firestore'

const SWATCHES = ['#3f6b52', '#a24a35', '#b9832e', '#7a6a53', '#5b7a99', '#a2665b', '#8a6ba8', '#5b8a99']

export default function CategoryCreateInline({ householdId, kind, onCreated, onCancel, t }) {
  const [name, setName] = useState('')
  const [color] = useState(() => SWATCHES[Math.floor(Math.random() * SWATCHES.length)])
  const [busy, setBusy] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const ref = await addCategory(householdId, { name: name.trim(), kind, color, monthlyBudget: 0 })
      onCreated(ref.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleCreate} className="flex items-center gap-2 bg-paper border border-line rounded px-2 py-1.5">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <input
        autoFocus
        className="border-b border-line bg-transparent text-sm flex-1 min-w-[100px] focus:outline-none py-0.5"
        placeholder={t('categories.newPlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" disabled={busy || !name.trim()} className="text-sage text-xs font-medium disabled:opacity-50 shrink-0">
        {t('common.add')}
      </button>
      <button type="button" onClick={onCancel} className="text-ink-soft text-xs shrink-0">
        {t('common.cancel')}
      </button>
    </form>
  )
}
