import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useHousehold } from '../contexts/HouseholdContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePeriod } from '../contexts/PeriodContext'
import { formatMoney, formatDate, isInPeriod } from '../lib/format'
import PeriodSwitcher from '../components/PeriodSwitcher'

const ESSENTIAL_NAME_MATCH = /arriendo|rent|hipoteca|mortgage|mercado|grocer|servicio|utilit|transporte|transport|salud|health|seguro|insurance|housing|vivienda/i
const NON_ESSENTIAL_NAME_MATCH = /restaurant|dining|entreten|entertainment|fun/i

// Respects an explicit essential flag on the category (including an explicit
// false) if the category was created after that field existed; falls back to
// keyword matching on the category name for older data — same philosophy as
// the transaction auto-categorizer.
function isEssentialCategory(category) {
  if (!category) return false
  if (typeof category.essential === 'boolean') return category.essential
  if (NON_ESSENTIAL_NAME_MATCH.test(category.name)) return false
  return ESSENTIAL_NAME_MATCH.test(category.name)
}

function shiftPeriodString(period, delta) {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Dashboard() {
  const { accounts, categories, transactions, members, goals, bills } = useHousehold()
  const { t } = useLanguage()
  const { period } = usePeriod()

  const netWorth = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0), [accounts])

  const periodTx = useMemo(() => transactions.filter((t) => isInPeriod(t.date, period)), [transactions, period])

  const income = useMemo(() => periodTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0), [periodTx])
  const expenses = useMemo(
    () => periodTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
    [periodTx]
  )
  const remaining = income - expenses

  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const spendByCategory = useMemo(() => {
    const totals = {}
    periodTx
      .filter((t) => t.amount < 0)
      .forEach((t) => {
        const key = t.categoryId || 'uncategorized'
        totals[key] = (totals[key] || 0) + Math.abs(t.amount)
      })
    return Object.entries(totals)
      .map(([id, value]) => ({
        id,
        name: categoryMap[id]?.name || t('common.uncategorized'),
        value,
        color: categoryMap[id]?.color || '#8a8578',
      }))
      .sort((a, b) => b.value - a.value)
  }, [periodTx, categoryMap, t])

  const sharedByMember = useMemo(() => {
    const shared = periodTx.filter((tx) => tx.amount < 0 && tx.shared)
    if (shared.length === 0 || members.length < 2) return null
    const paidTotals = {}
    shared.forEach((tx) => {
      paidTotals[tx.paidBy] = (paidTotals[tx.paidBy] || 0) + Math.abs(tx.amount)
    })
    const totalShared = Object.values(paidTotals).reduce((s, v) => s + v, 0)
    const fairShare = totalShared / members.length
    return members.map((m) => ({
      ...m,
      paid: paidTotals[m.uid] || 0,
      diff: (paidTotals[m.uid] || 0) - fairShare,
      fairShare,
    }))
  }, [periodTx, members])

  const recent = transactions.slice(0, 8)

  const essentialTotal = useMemo(() => {
    const categoryMapLocal = categoryMap
    return periodTx
      .filter((tx) => tx.amount < 0 && isEssentialCategory(categoryMapLocal[tx.categoryId]))
      .reduce((s, tx) => s + Math.abs(tx.amount), 0)
  }, [periodTx, categoryMap])
  const discretionaryTotal = Math.max(0, expenses - essentialTotal)

  const insights = useMemo(() => {
    const lines = []
    const previousPeriod = shiftPeriodString(period, -1)
    const previousPeriodTx = transactions.filter((tx) => isInPeriod(tx.date, previousPeriod))

    const diningCategory = categories.find((c) => /dining|restaurant/i.test(c.name))
    if (diningCategory) {
      const current = periodTx
        .filter((tx) => tx.categoryId === diningCategory.id && tx.amount < 0)
        .reduce((s, tx) => s + Math.abs(tx.amount), 0)
      const previous = previousPeriodTx
        .filter((tx) => tx.categoryId === diningCategory.id && tx.amount < 0)
        .reduce((s, tx) => s + Math.abs(tx.amount), 0)
      if (previous > 0) {
        const changePct = Math.round(((current - previous) / previous) * 100)
        if (Math.abs(changePct) >= 10) {
          lines.push(
            `${diningCategory.name} ${changePct > 0 ? '+' : ''}${changePct}% ${t('dashboard.insightVsLastMonth')}`
          )
        }
      }
    }

    const activeSubs = bills.filter((b) => b.type === 'subscription' && b.active !== false)
    if (activeSubs.length > 0) {
      const subsTotal = activeSubs.reduce((s, b) => s + b.amount, 0)
      lines.push(`${t('dashboard.insightSubscriptionsLabel')} ${formatMoney(subsTotal)}/mo`)
    }

    if (goals.length > 0) {
      const best = goals
        .map((g) => ({ ...g, pct: g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0 }))
        .sort((a, b) => b.pct - a.pct)[0]
      if (best.pct > 0) {
        lines.push(`${best.name}: ${Math.round(best.pct)}% ${t('dashboard.insightGoalProgress')}`)
      }
    }

    return lines.slice(0, 3)
  }, [period, periodTx, transactions, categories, bills, goals, t])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">{t('dashboard.thisMonth')}</p>
          <h1 className="font-display text-3xl">{t('dashboard.title')}</h1>
        </div>
        <PeriodSwitcher />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label={t('dashboard.netWorth')} value={netWorth} tone="ink" />
        <SummaryCard label={t('dashboard.income')} value={income} tone="sage" />
        <SummaryCard label={t('dashboard.spent')} value={expenses} tone="rust" />
        <SummaryCard label={t('dashboard.remaining')} value={remaining} tone={remaining < 0 ? 'rust' : 'sage'} />
      </div>

      {expenses > 0 && (
        <section>
          <h2 className="font-display text-xl mb-3">{t('dashboard.essentialsTitle')}</h2>
          <div className="h-3 rounded-full overflow-hidden flex bg-line">
            <div style={{ width: `${(essentialTotal / expenses) * 100}%`, backgroundColor: 'var(--color-sage)' }} />
            <div style={{ width: `${(discretionaryTotal / expenses) * 100}%`, backgroundColor: 'var(--color-amber)' }} />
          </div>
          <div className="flex justify-between text-xs text-ink-soft mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-sage)' }} />
              {t('dashboard.essentialsEssential')}: {formatMoney(essentialTotal)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-amber)' }} />
              {t('dashboard.essentialsDiscretionary')}: {formatMoney(discretionaryTotal)}
            </span>
          </div>
        </section>
      )}

      {insights.length > 0 && (
        <section className="bg-amber-soft rounded-lg p-4">
          <p className="text-sm font-medium text-amber mb-2">{t('dashboard.insightsTitle')}</p>
          <ul className="text-sm flex flex-col gap-1">
            {insights.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <h2 className="font-display text-xl mb-3">{t('dashboard.byCategory')}</h2>
          {spendByCategory.length === 0 ? (
            <p className="text-ink-soft text-sm">{t('dashboard.noExpenses')}</p>
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
          <h2 className="font-display text-xl mb-3">{t('dashboard.recentActivity')}</h2>
          <div className="bg-paper-raised border border-line rounded-lg">
            {recent.length === 0 ? (
              <p className="text-ink-soft text-sm p-4">{t('dashboard.noTransactions')}</p>
            ) : (
              recent.map((tx) => (
                <div key={tx.id} className={`ledger-row flex items-center justify-between px-4 py-2.5 ${tx.pending ? 'opacity-70' : ''}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm flex items-center gap-1.5">
                      {tx.description || 'Transaction'}
                      {tx.pending && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide bg-amber-soft text-amber px-1.5 py-0.5 rounded">
                          {t('transactions.pending')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-soft">{formatDate(tx.date)}</p>
                  </div>
                  <span className={`font-mono-num text-sm ${tx.amount < 0 ? 'text-rust' : 'text-sage'}`}>
                    {tx.amount < 0 ? '-' : '+'}
                    {formatMoney(Math.abs(tx.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {sharedByMember && (
        <section>
          <h2 className="font-display text-xl mb-3">{t('dashboard.splitTitle')}</h2>
          <div className="bg-paper-raised border border-line rounded-lg divide-y divide-line">
            {sharedByMember.map((m) => (
              <div key={m.uid} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{m.displayName}</p>
                  <p className="text-xs text-ink-soft">
                    {t('dashboard.splitPaid')} {formatMoney(m.paid)} · {t('dashboard.splitFairShare')}{' '}
                    {formatMoney(m.fairShare)}
                  </p>
                </div>
                <span className={`font-mono-num text-sm ${m.diff > 1 ? 'text-sage' : m.diff < -1 ? 'text-rust' : 'text-ink-soft'}`}>
                  {m.diff > 1
                    ? `+${formatMoney(m.diff)} ${t('dashboard.splitOwed')}`
                    : m.diff < -1
                      ? `${formatMoney(m.diff)} ${t('dashboard.splitOwes')}`
                      : t('dashboard.splitEven')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SummaryCard({ label, value, tone }) {
  const toneClass = { ink: 'text-ink', sage: 'text-sage', rust: 'text-rust' }[tone]
  return (
    <div className="bg-paper-raised border border-line rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">{label}</p>
      <p className={`font-mono-num text-xl sm:text-2xl ${toneClass}`}>{formatMoney(value)}</p>
    </div>
  )
}
