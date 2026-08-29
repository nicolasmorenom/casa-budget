import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useLanguage } from '../contexts/LanguageContext'
import { addTransaction } from '../lib/firestore'
import { suggestCategoryId } from '../lib/categorize'
import CategoryCreateInline from './CategoryCreateInline'

export default function QuickAddExpense() {
  const { user } = useAuth()
  const { activeHouseholdId, accounts, categories, members } = useHousehold()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  if (!accounts.length) return null // nothing to log against yet

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t('quickAdd.fab')}
        className="fixed z-20 bottom-20 md:bottom-8 right-5 md:right-8 w-14 h-14 rounded-full bg-amber text-paper text-2xl leading-none shadow-lg flex items-center justify-center hover:brightness-95 transition"
      >
        +
      </button>

      {open && (
        <QuickAddModal
          onClose={() => setOpen(false)}
          uid={user.uid}
          householdId={activeHouseholdId}
          accounts={accounts}
          categories={categories.filter((c) => c.kind === 'expense')}
          members={members}
          t={t}
        />
      )}
    </>
  )
}

function QuickAddModal({ onClose, uid, householdId, accounts, categories, members, t }) {
  const today = new Date().toISOString().slice(0, 10)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [shared, setShared] = useState(false)
  const [paidBy, setPaidBy] = useState(uid)
  const [busy, setBusy] = useState(false)

  function handleDescriptionChange(value) {
    setDescription(value)
    if (!categoryTouched) {
      const suggestion = suggestCategoryId(value, -1, categories)
      if (suggestion) setCategoryId(suggestion)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await addTransaction(householdId, uid, {
        accountId,
        categoryId,
        description,
        amount: -Math.abs(Number(amount)),
        date: today,
        paidBy,
        shared,
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 bg-ink/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-paper w-full md:max-w-sm rounded-t-2xl md:rounded-lg border border-line p-5 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">{t('quickAdd.title')}</h2>
          <button type="button" onClick={onClose} className="text-ink-soft text-xl leading-none">
            ×
          </button>
        </div>

        <input
          autoFocus
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="0.00"
          className="font-mono-num text-3xl border-b border-line bg-transparent py-2 focus:outline-none"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          className="border border-line rounded px-3 py-2 bg-paper-raised"
          placeholder={t('common.description')}
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className={creatingCategory ? 'col-span-2' : ''}>
            {creatingCategory ? (
              <CategoryCreateInline
                householdId={householdId}
                kind="expense"
                t={t}
                onCancel={() => setCreatingCategory(false)}
                onCreated={(newId) => {
                  setCategoryId(newId)
                  setCategoryTouched(true)
                  setCreatingCategory(false)
                }}
              />
            ) : (
              <select
                className="border border-line rounded px-3 py-2 bg-paper-raised w-full"
                value={categoryId}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setCreatingCategory(true)
                    return
                  }
                  setCategoryTouched(true)
                  setCategoryId(e.target.value)
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__new__">{t('categories.newOption')}</option>
              </select>
            )}
          </div>
          {!creatingCategory && (
            <select
              className="border border-line rounded px-3 py-2 bg-paper-raised"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {members.length > 1 && (
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
              {t('transactions.shared')}
            </label>
            {shared && (
              <select
                className="border border-line rounded px-2 py-1 bg-paper-raised text-sm"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !accountId || !categoryId}
          className="bg-amber text-paper rounded py-2.5 font-medium disabled:opacity-50"
        >
          {t('quickAdd.button')}
        </button>
      </form>
    </div>
  )
}
