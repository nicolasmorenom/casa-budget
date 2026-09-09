import { useMemo, useState } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useLanguage } from '../contexts/LanguageContext'
import { addBill, updateBill, deleteBill } from '../lib/firestore'
import { formatMoney, currentPeriod } from '../lib/format'
import { arrayUnion, arrayRemove } from 'firebase/firestore'

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function nextDueDate(dueDay) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  let year = now.getFullYear()
  let month = now.getMonth()
  let due = new Date(year, month, Math.min(dueDay, daysInMonth(year, month)))
  if (due < now) {
    month += 1
    due = new Date(year, month, Math.min(dueDay, daysInMonth(year, month)))
  }
  return due
}

function daysUntil(date) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((date - now) / 86400000)
}

// Groups the last 90 days of expenses by a normalized description (lowercase,
// digits stripped, so "NETFLIX 4521" and "NETFLIX 8830" match) and flags
// groups that look like a recurring subscription: at least 2 hits in
// distinct months, with amounts that don't vary by more than 15%.
function detectSubscriptions(transactions, existingBillNames) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const groups = {}

  transactions
    .filter((tx) => tx.amount < 0 && new Date(tx.date) >= cutoff)
    .forEach((tx) => {
      const key = (tx.description || '').toLowerCase().replace(/[0-9]+/g, '').trim()
      if (!key) return
      ;(groups[key] ||= []).push(tx)
    })

  const suggestions = []
  for (const [key, txs] of Object.entries(groups)) {
    const distinctMonths = new Set(txs.map((tx) => tx.date.slice(0, 7)))
    if (distinctMonths.size < 2) continue
    const amounts = txs.map((tx) => Math.abs(tx.amount))
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const maxVariance = Math.max(...amounts.map((a) => Math.abs(a - mean) / mean))
    if (maxVariance > 0.15) continue
    if (existingBillNames.has(key)) continue

    const mostRecent = txs.sort((a, b) => (a.date < b.date ? 1 : -1))[0]
    suggestions.push({
      key,
      name: mostRecent.description || key,
      amount: mean,
      dueDay: new Date(`${mostRecent.date}T00:00:00`).getDate(),
      categoryId: mostRecent.categoryId || null,
    })
  }
  return suggestions
}

export default function Bills() {
  const { activeHouseholdId, bills, transactions, categories } = useHousehold()
  const { t } = useLanguage()
  const [showForm, setShowForm] = useState(false)

  const period = currentPeriod()
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const enriched = useMemo(
    () =>
      bills
        .filter((b) => b.active !== false)
        .map((b) => {
          const paid = (b.paidMonths || []).includes(period)
          const due = nextDueDate(b.dueDay)
          return { ...b, paid, daysUntilDue: daysUntil(due) }
        })
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue),
    [bills, period]
  )

  const monthlyTotal = useMemo(() => bills.filter((b) => b.active !== false).reduce((s, b) => s + b.amount, 0), [bills])

  const existingBillNames = useMemo(
    () => new Set(bills.map((b) => b.name.toLowerCase().replace(/[0-9]+/g, '').trim())),
    [bills]
  )
  const detected = useMemo(
    () => detectSubscriptions(transactions, existingBillNames),
    [transactions, existingBillNames]
  )

  function togglePaid(bill) {
    updateBill(activeHouseholdId, bill.id, {
      paidMonths: bill.paid ? arrayRemove(period) : arrayUnion(period),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">{t('bills.title')}</h1>
          <p className="text-sm text-ink-soft">{t('bills.monthlyTotal')}: {formatMoney(monthlyTotal)}/mo</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
        >
          {showForm ? t('common.cancel') : t('bills.add')}
        </button>
      </div>

      {showForm && (
        <BillForm householdId={activeHouseholdId} categories={categories} onDone={() => setShowForm(false)} t={t} />
      )}

      {detected.length > 0 && (
        <div className="bg-amber-soft rounded-lg p-4">
          <p className="text-sm font-medium text-amber mb-2">{t('bills.detected')}</p>
          <p className="text-xs text-ink-soft mb-3">{t('bills.detectedHint')}</p>
          <div className="flex flex-col gap-2">
            {detected.map((s) => (
              <div key={s.key} className="flex items-center justify-between bg-paper-raised rounded px-3 py-2 text-sm">
                <span className="truncate">{s.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono-num text-ink-soft">{formatMoney(s.amount)}/mo</span>
                  <button
                    onClick={() =>
                      addBill(activeHouseholdId, {
                        name: s.name,
                        amount: s.amount,
                        dueDay: s.dueDay,
                        categoryId: s.categoryId,
                        type: 'subscription',
                      })
                    }
                    className="text-sage text-xs font-medium border border-line rounded px-2 py-1"
                  >
                    {t('common.add')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {enriched.length === 0 ? (
        <p className="text-ink-soft text-sm">{t('bills.empty')}</p>
      ) : (
        <div className="bg-paper-raised border border-line rounded-lg">
          {enriched.map((b) => (
            <div key={b.id} className="ledger-row flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.name}</p>
                <p className="text-xs text-ink-soft">
                  {categoryMap[b.categoryId]?.name || (b.type === 'subscription' ? t('bills.typeSubscription') : t('bills.typeBill'))}
                  {' · '}
                  {b.paid ? (
                    <span className="text-sage">{t('bills.paid')}</span>
                  ) : b.daysUntilDue < 0 ? (
                    <span className="text-rust">{t('bills.overdue')}</span>
                  ) : b.daysUntilDue <= 5 ? (
                    <span className="text-amber">{t('bills.dueSoon')}</span>
                  ) : (
                    <span>{b.daysUntilDue}d</span>
                  )}
                </p>
              </div>
              <span className="font-mono-num text-sm shrink-0">{formatMoney(b.amount)}</span>
              <button
                onClick={() => togglePaid(b)}
                className={`text-xs px-2 py-1 rounded border shrink-0 ${b.paid ? 'border-sage text-sage' : 'border-line text-ink-soft'}`}
              >
                {t('bills.markPaid')}
              </button>
              <button onClick={() => deleteBill(activeHouseholdId, b.id)} className="text-rust text-xs hover:underline shrink-0">
                {t('common.remove')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BillForm({ householdId, categories, onDone, t }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const [type, setType] = useState('bill')
  const [categoryId, setCategoryId] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    await addBill(householdId, { name, amount, dueDay, type, categoryId: categoryId || null })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-lg p-4 flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('common.name')}</label>
        <input className="border border-line rounded px-3 py-2 bg-white/60" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('common.amount')}</label>
        <input
          type="number"
          step="0.01"
          className="border border-line rounded px-3 py-2 bg-white/60 w-28"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('bills.dueDay')}</label>
        <input
          type="number"
          min="1"
          max="31"
          className="border border-line rounded px-3 py-2 bg-white/60 w-20"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('common.type')}</label>
        <select className="border border-line rounded px-3 py-2 bg-white/60" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="bill">{t('bills.typeBill')}</option>
          <option value="subscription">{t('bills.typeSubscription')}</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('common.category')}</label>
        <select className="border border-line rounded px-3 py-2 bg-white/60" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{t('common.uncategorized')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="bg-amber text-paper rounded px-4 py-2 text-sm font-medium">
        {t('common.add')}
      </button>
    </form>
  )
}
