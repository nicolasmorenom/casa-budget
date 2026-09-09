import { useState } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useLanguage } from '../contexts/LanguageContext'
import { addGoal, updateGoal, deleteGoal } from '../lib/firestore'
import { formatMoney } from '../lib/format'

export default function Goals() {
  const { activeHouseholdId, goals } = useHousehold()
  const { t } = useLanguage()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">{t('goals.title')}</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
        >
          {showForm ? t('common.cancel') : t('goals.add')}
        </button>
      </div>

      {showForm && <GoalForm householdId={activeHouseholdId} onDone={() => setShowForm(false)} t={t} />}

      {goals.length === 0 ? (
        <p className="text-ink-soft text-sm">{t('goals.empty')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} householdId={activeHouseholdId} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function GoalCard({ goal, householdId, t }) {
  const [amountInput, setAmountInput] = useState('')
  const pct = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount)

  let monthlyNeeded = null
  if (goal.targetDate && remaining > 0) {
    const now = new Date()
    const target = new Date(`${goal.targetDate}T00:00:00`)
    const monthsRemaining = Math.max(
      1,
      (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
    )
    monthlyNeeded = remaining / monthsRemaining
  }

  function adjust(sign) {
    const delta = Number(amountInput)
    if (!delta) return
    updateGoal(householdId, goal.id, { savedAmount: Math.max(0, goal.savedAmount + sign * delta) })
    setAmountInput('')
  }

  return (
    <div className="bg-paper-raised border border-line rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: goal.color }} />
          {goal.name}
        </span>
        <button onClick={() => deleteGoal(householdId, goal.id)} className="text-rust text-xs hover:underline">
          {t('common.remove')}
        </button>
      </div>

      <div>
        <div className="flex items-baseline justify-between font-mono-num text-sm mb-1">
          <span>{formatMoney(goal.savedAmount)}</span>
          <span className="text-ink-soft">{formatMoney(goal.targetAmount)}</span>
        </div>
        <div className="h-2 rounded-full bg-line overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
        </div>
      </div>

      <p className="text-xs text-ink-soft">
        {t('goals.remaining')}: {formatMoney(remaining)}
        {goal.targetDate && ` · ${t('goals.deadline')}: ${goal.targetDate}`}
        {monthlyNeeded != null && ` · ${t('goals.monthlyNeeded')}: ${formatMoney(monthlyNeeded)}/mo`}
      </p>

      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          className="border border-line rounded px-2 py-1 text-sm bg-white/60 w-24"
          placeholder="0.00"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
        />
        <button onClick={() => adjust(1)} className="text-sage text-xs font-medium border border-line rounded px-2 py-1">
          {t('goals.addFunds')}
        </button>
        <button onClick={() => adjust(-1)} className="text-rust text-xs font-medium border border-line rounded px-2 py-1">
          {t('goals.withdraw')}
        </button>
      </div>
    </div>
  )
}

function GoalForm({ householdId, onDone, t }) {
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [savedAmount, setSavedAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [color, setColor] = useState('#3f6b52')

  async function handleSubmit(e) {
    e.preventDefault()
    await addGoal(householdId, { name, targetAmount, savedAmount, targetDate: targetDate || null, color })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-lg p-4 flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('common.name')}</label>
        <input className="border border-line rounded px-3 py-2 bg-white/60" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('goals.target')}</label>
        <input
          type="number"
          step="0.01"
          className="border border-line rounded px-3 py-2 bg-white/60 w-28"
          required
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('goals.saved')}</label>
        <input
          type="number"
          step="0.01"
          className="border border-line rounded px-3 py-2 bg-white/60 w-28"
          value={savedAmount}
          onChange={(e) => setSavedAmount(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('goals.deadline')}</label>
        <input
          type="date"
          className="border border-line rounded px-3 py-2 bg-white/60"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('budgets.color')}</label>
        <input type="color" className="border border-line rounded h-10 w-14 bg-white/60" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>
      <button type="submit" className="bg-amber text-paper rounded px-4 py-2 text-sm font-medium">
        {t('common.add')}
      </button>
    </form>
  )
}
