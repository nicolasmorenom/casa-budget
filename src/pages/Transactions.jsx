import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePeriod } from '../contexts/PeriodContext'
import { addTransaction, deleteTransaction, updateTransaction } from '../lib/firestore'
import { suggestCategoryId } from '../lib/categorize'
import { formatMoney, formatDate, isInPeriod } from '../lib/format'

export default function Transactions() {
  const { user } = useAuth()
  const { activeHouseholdId, accounts, categories, transactions, members } = useHousehold()
  const { t } = useLanguage()
  const { period } = usePeriod()
  const [showForm, setShowForm] = useState(false)
  const [accountFilter, setAccountFilter] = useState('all')
  const [periodOnly, setPeriodOnly] = useState(false)
  const [autoCatStatus, setAutoCatStatus] = useState('')

  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts])
  const memberMap = useMemo(() => Object.fromEntries(members.map((m) => [m.uid, m])), [members])

  const filtered = useMemo(() => {
    let list = transactions
    if (accountFilter !== 'all') list = list.filter((tx) => tx.accountId === accountFilter)
    if (periodOnly) list = list.filter((tx) => isInPeriod(tx.date, period))
    return list
  }, [transactions, accountFilter, periodOnly, period])

  const uncategorizedCount = useMemo(() => transactions.filter((tx) => !tx.categoryId).length, [transactions])

  async function handleAutoCategorize() {
    const candidates = transactions.filter((tx) => !tx.categoryId)
    let updated = 0
    for (const tx of candidates) {
      const suggestion = suggestCategoryId(tx.description, tx.amount, categories)
      if (suggestion) {
        await updateTransaction(activeHouseholdId, tx.id, { categoryId: suggestion })
        updated++
      }
    }
    setAutoCatStatus(
      updated > 0
        ? `${t('transactions.autoCategorizeDone')} ${updated}/${candidates.length}`
        : t('transactions.autoCategorizeNone')
    )
    setTimeout(() => setAutoCatStatus(''), 4000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl">{t('transactions.title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-ink-soft flex items-center gap-1.5">
            <input type="checkbox" checked={periodOnly} onChange={(e) => setPeriodOnly(e.target.checked)} />
            {t('transactions.thisMonthOnly')}
          </label>
          <select
            className="border border-line rounded px-3 py-2 text-sm bg-paper-raised"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="all">{t('transactions.allAccounts')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {uncategorizedCount > 0 && (
            <button
              onClick={handleAutoCategorize}
              className="border border-line rounded px-3 py-2 text-sm text-ink-soft hover:bg-paper-raised"
              title={t('transactions.autoCategorizeHint')}
            >
              {t('transactions.autoCategorize')} ({uncategorizedCount})
            </button>
          )}
          <button
            onClick={() => setShowForm((s) => !s)}
            className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
          >
            {showForm ? t('common.cancel') : t('transactions.add')}
          </button>
        </div>
      </div>

      {autoCatStatus && <p className="text-sm text-sage">{autoCatStatus}</p>}

      {showForm && (
        <TransactionForm
          householdId={activeHouseholdId}
          uid={user.uid}
          accounts={accounts}
          categories={categories}
          members={members}
          t={t}
          onDone={() => setShowForm(false)}
        />
      )}

      <div className="bg-paper-raised border border-line rounded-lg">
        {filtered.length === 0 ? (
          <p className="text-ink-soft text-sm p-4">{t('transactions.empty')}</p>
        ) : (
          filtered.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              account={accountMap[tx.accountId]}
              category={categoryMap[tx.categoryId]}
              categories={categories}
              paidByMember={memberMap[tx.paidBy]}
              householdId={activeHouseholdId}
              t={t}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TransactionRow({ tx, account, category, categories, paidByMember, householdId, t }) {
  const [editingCategory, setEditingCategory] = useState(false)

  return (
    <div className="ledger-row flex items-center justify-between px-4 py-2.5 gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{tx.description || 'Transaction'}</p>
        <p className="text-xs text-ink-soft truncate">
          {formatDate(tx.date)} · {account?.name || t('transactions.unknownAccount')}
          {tx.pending && ` · ${t('transactions.pending')}`}
          {tx.shared && paidByMember && ` · ${t('transactions.paidBy')} ${paidByMember.displayName}`}
        </p>
      </div>

      {editingCategory ? (
        <select
          autoFocus
          className="border border-line rounded px-2 py-1 text-xs bg-white/60"
          value={tx.categoryId || ''}
          onChange={(e) => {
            updateTransaction(householdId, tx.id, { categoryId: e.target.value || null })
            setEditingCategory(false)
          }}
          onBlur={() => setEditingCategory(false)}
        >
          <option value="">{t('common.uncategorized')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <button
          onClick={() => setEditingCategory(true)}
          className="text-xs px-2 py-1 rounded-full shrink-0"
          style={{ backgroundColor: (category?.color || '#8a8578') + '22', color: category?.color || '#8a8578' }}
        >
          {category?.name || t('common.uncategorized')}
        </button>
      )}

      <span className={`font-mono-num text-sm w-24 text-right shrink-0 ${tx.amount < 0 ? 'text-rust' : 'text-sage'}`}>
        {tx.amount < 0 ? '-' : '+'}
        {formatMoney(Math.abs(tx.amount))}
      </span>

      <button onClick={() => deleteTransaction(householdId, tx.id)} className="text-rust text-xs hover:underline shrink-0">
        {t('common.remove')}
      </button>
    </div>
  )
}

function TransactionForm({ householdId, uid, accounts, categories, members, t, onDone }) {
  const today = new Date().toISOString().slice(0, 10)
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [categoryId, setCategoryId] = useState('')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState('expense')
  const [date, setDate] = useState(today)
  const [shared, setShared] = useState(false)
  const [paidBy, setPaidBy] = useState(uid)

  function handleDescriptionChange(value) {
    setDescription(value)
    if (!categoryTouched) {
      const suggestion = suggestCategoryId(value, direction === 'expense' ? -1 : 1, categories)
      if (suggestion) setCategoryId(suggestion)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const signedAmount = direction === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount))
    await addTransaction(householdId, uid, { accountId, categoryId, description, amount: signedAmount, date, shared, paidBy })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-lg p-4 flex flex-wrap gap-3 items-end">
      <Field label={t('common.account')}>
        <select className="border border-line rounded px-3 py-2 bg-white/60" required value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="" disabled>
            {t('common.account')}
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('common.description')}>
        <input
          className="border border-line rounded px-3 py-2 bg-white/60"
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
        />
      </Field>
      <Field label={t('common.category')}>
        <select
          className="border border-line rounded px-3 py-2 bg-white/60"
          value={categoryId}
          onChange={(e) => {
            setCategoryTouched(true)
            setCategoryId(e.target.value)
          }}
        >
          <option value="">{t('common.uncategorized')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('common.type')}>
        <select className="border border-line rounded px-3 py-2 bg-white/60" value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="expense">{t('common.expense')}</option>
          <option value="income">{t('common.income')}</option>
        </select>
      </Field>
      <Field label={t('common.amount')}>
        <input
          type="number"
          step="0.01"
          min="0"
          required
          className="border border-line rounded px-3 py-2 bg-white/60 w-28"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label={t('common.date')}>
        <input type="date" className="border border-line rounded px-3 py-2 bg-white/60" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      {members.length > 1 && direction === 'expense' && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            {t('transactions.shared')}
          </label>
          {shared && (
            <select className="border border-line rounded px-2 py-1 text-sm bg-white/60" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <button type="submit" className="bg-amber text-paper rounded px-4 py-2 text-sm font-medium">
        {t('common.add')}
      </button>
    </form>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-ink-soft">{label}</label>
      {children}
    </div>
  )
}
