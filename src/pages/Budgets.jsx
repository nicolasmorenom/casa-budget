import { useMemo, useState } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { addCategory, updateCategory, deleteCategory } from '../lib/firestore'
import { formatMoney, currentPeriod, isInPeriod } from '../lib/format'

export default function Budgets() {
  const { activeHouseholdId, categories, transactions } = useHousehold()
  const [showForm, setShowForm] = useState(false)
  const period = currentPeriod()

  const monthExpenses = useMemo(() => transactions.filter((t) => t.amount < 0 && isInPeriod(t.date, period)), [transactions, period])

  const spentByCategory = useMemo(() => {
    const totals = {}
    monthExpenses.forEach((t) => {
      const key = t.categoryId || 'uncategorized'
      totals[key] = (totals[key] || 0) + Math.abs(t.amount)
    })
    return totals
  }, [monthExpenses])

  const expenseCategories = categories.filter((c) => c.kind === 'expense')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Budgets</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add category'}
        </button>
      </div>

      {showForm && <CategoryForm householdId={activeHouseholdId} onDone={() => setShowForm(false)} />}

      <div className="flex flex-col gap-3">
        {expenseCategories.map((c) => (
          <BudgetRow key={c.id} category={c} spent={spentByCategory[c.id] || 0} householdId={activeHouseholdId} />
        ))}
      </div>
    </div>
  )
}

function BudgetRow({ category, spent, householdId }) {
  const [editing, setEditing] = useState(false)
  const [budget, setBudget] = useState(category.monthlyBudget)
  const pct = category.monthlyBudget > 0 ? Math.min(100, (spent / category.monthlyBudget) * 100) : 0
  const over = category.monthlyBudget > 0 && spent > category.monthlyBudget
  const barColor = over ? 'var(--color-rust)' : 'var(--color-sage)'

  async function saveBudget() {
    await updateCategory(householdId, category.id, { monthlyBudget: Number(budget) })
    setEditing(false)
  }

  return (
    <div className="bg-paper-raised border border-line rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 font-medium">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }} />
          {category.name}
        </span>
        <div className="flex items-center gap-2 font-mono-num text-sm">
          <span className={over ? 'text-rust' : ''}>{formatMoney(spent)}</span>
          <span className="text-ink-soft">/</span>
          {editing ? (
            <>
              <input
                className="w-20 border border-line rounded px-1 py-0.5 text-right bg-white/60"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                autoFocus
              />
              <button onClick={saveBudget} className="text-sage text-xs">
                Save
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-ink-soft hover:underline">
              {formatMoney(category.monthlyBudget)}
            </button>
          )}
          <button onClick={() => deleteCategory(householdId, category.id)} className="text-rust text-xs ml-2 hover:underline">
            Remove
          </button>
        </div>
      </div>
      <div className="h-2 rounded-full bg-line overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  )
}

function CategoryForm({ householdId, onDone }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('expense')
  const [monthlyBudget, setMonthlyBudget] = useState('')
  const [color, setColor] = useState('#3c4d61')

  async function handleSubmit(e) {
    e.preventDefault()
    await addCategory(householdId, { name, kind, monthlyBudget, color })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-lg p-4 flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">Name</label>
        <input className="border border-line rounded px-3 py-2 bg-white/60" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">Kind</label>
        <select className="border border-line rounded px-3 py-2 bg-white/60" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">Monthly budget</label>
        <input
          type="number"
          step="0.01"
          className="border border-line rounded px-3 py-2 bg-white/60 w-28"
          value={monthlyBudget}
          onChange={(e) => setMonthlyBudget(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">Color</label>
        <input type="color" className="border border-line rounded h-10 w-14 bg-white/60" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>
      <button type="submit" className="bg-amber text-paper rounded px-4 py-2 text-sm font-medium">
        Add
      </button>
    </form>
  )
}
