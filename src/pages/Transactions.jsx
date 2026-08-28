import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { addTransaction, deleteTransaction, updateTransaction } from '../lib/firestore'
import { formatMoney, formatDate } from '../lib/format'

export default function Transactions() {
  const { user } = useAuth()
  const { activeHouseholdId, accounts, categories, transactions } = useHousehold()
  const [showForm, setShowForm] = useState(false)
  const [accountFilter, setAccountFilter] = useState('all')

  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts])

  const filtered = useMemo(
    () => (accountFilter === 'all' ? transactions : transactions.filter((t) => t.accountId === accountFilter)),
    [transactions, accountFilter]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl">Transactions</h1>
        <div className="flex items-center gap-2">
          <select
            className="border border-line rounded px-3 py-2 text-sm bg-paper-raised"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
      </div>

      {showForm && (
        <TransactionForm
          householdId={activeHouseholdId}
          uid={user.uid}
          accounts={accounts}
          categories={categories}
          onDone={() => setShowForm(false)}
        />
      )}

      <div className="bg-paper-raised border border-line rounded-lg">
        {filtered.length === 0 ? (
          <p className="text-ink-soft text-sm p-4">No transactions to show.</p>
        ) : (
          filtered.map((t) => (
            <TransactionRow
              key={t.id}
              tx={t}
              account={accountMap[t.accountId]}
              category={categoryMap[t.categoryId]}
              categories={categories}
              householdId={activeHouseholdId}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TransactionRow({ tx, account, category, categories, householdId }) {
  const [editingCategory, setEditingCategory] = useState(false)

  return (
    <div className="ledger-row flex items-center justify-between px-4 py-2.5 gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{tx.description || 'Transaction'}</p>
        <p className="text-xs text-ink-soft">
          {formatDate(tx.date)} · {account?.name || 'Unknown account'}
          {tx.pending && ' · pending'}
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
          <option value="">Uncategorized</option>
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
          {category?.name || 'Uncategorized'}
        </button>
      )}

      <span className={`font-mono-num text-sm w-24 text-right shrink-0 ${tx.amount < 0 ? 'text-rust' : 'text-sage'}`}>
        {tx.amount < 0 ? '-' : '+'}
        {formatMoney(Math.abs(tx.amount))}
      </span>

      <button onClick={() => deleteTransaction(householdId, tx.id)} className="text-rust text-xs hover:underline shrink-0">
        Remove
      </button>
    </div>
  )
}

function TransactionForm({ householdId, uid, accounts, categories, onDone }) {
  const today = new Date().toISOString().slice(0, 10)
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState('expense')
  const [date, setDate] = useState(today)

  async function handleSubmit(e) {
    e.preventDefault()
    const signedAmount = direction === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount))
    await addTransaction(householdId, uid, { accountId, categoryId, description, amount: signedAmount, date })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-lg p-4 flex flex-wrap gap-3 items-end">
      <Field label="Account">
        <select className="border border-line rounded px-3 py-2 bg-white/60" required value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="" disabled>
            Select account
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <input className="border border-line rounded px-3 py-2 bg-white/60" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Category">
        <select className="border border-line rounded px-3 py-2 bg-white/60" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Type">
        <select className="border border-line rounded px-3 py-2 bg-white/60" value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </Field>
      <Field label="Amount">
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
      <Field label="Date">
        <input type="date" className="border border-line rounded px-3 py-2 bg-white/60" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <button type="submit" className="bg-amber text-paper rounded px-4 py-2 text-sm font-medium">
        Add
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
