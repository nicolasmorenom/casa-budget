import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useHousehold } from '../contexts/HouseholdContext'
import { formatMoney, formatDate, currentPeriod, isInPeriod } from '../lib/format'

export default function Dashboard() {
  const { accounts, categories, transactions } = useHousehold()
  const period = currentPeriod()

  const netWorth = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0), [accounts])

  const monthTx = useMemo(() => transactions.filter((t) => isInPeriod(t.date, period)), [transactions, period])

  const income = useMemo(() => monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0), [monthTx])
  const expenses = useMemo(
    () => monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
    [monthTx]
  )

  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const spendByCategory = useMemo(() => {
    const totals = {}
    monthTx
      .filter((t) => t.amount < 0)
      .forEach((t) => {
        const key = t.categoryId || 'uncategorized'
        totals[key] = (totals[key] || 0) + Math.abs(t.amount)
      })
    return Object.entries(totals)
      .map(([id, value]) => ({
        id,
        name: categoryMap[id]?.name || 'Uncategorized',
        value,
        color: categoryMap[id]?.color || '#8a8578',
      }))
      .sort((a, b) => b.value - a.value)
  }, [monthTx, categoryMap])

  const recent = transactions.slice(0, 8)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">This month</p>
        <h1 className="font-display text-3xl">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Net worth" value={netWorth} tone="ink" />
        <SummaryCard label="Income" value={income} tone="sage" />
        <SummaryCard label="Spent" value={expenses} tone="rust" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <h2 className="font-display text-xl mb-3">Spending by category</h2>
          {spendByCategory.length === 0 ? (
            <p className="text-ink-soft text-sm">No expenses logged yet this month.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-40 h-40 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={spendByCategory} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                      {spendByCategory.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="text-sm flex flex-col gap-1.5 flex-1">
                {spendByCategory.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="font-mono-num text-ink-soft">{formatMoney(c.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-xl mb-3">Recent activity</h2>
          <div className="bg-paper-raised border border-line rounded-lg">
            {recent.length === 0 ? (
              <p className="text-ink-soft text-sm p-4">
                No transactions yet — add one manually or connect a bank via SimpleFIN in Settings.
              </p>
            ) : (
              recent.map((t) => (
                <div key={t.id} className="ledger-row flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{t.description || 'Transaction'}</p>
                    <p className="text-xs text-ink-soft">{formatDate(t.date)}</p>
                  </div>
                  <span className={`font-mono-num text-sm ${t.amount < 0 ? 'text-rust' : 'text-sage'}`}>
                    {t.amount < 0 ? '-' : '+'}
                    {formatMoney(Math.abs(t.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, tone }) {
  const toneClass = { ink: 'text-ink', sage: 'text-sage', rust: 'text-rust' }[tone]
  return (
    <div className="bg-paper-raised border border-line rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">{label}</p>
      <p className={`font-mono-num text-2xl ${toneClass}`}>{formatMoney(value)}</p>
    </div>
  )
}
