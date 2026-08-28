export function formatMoney(amount, currency = 'USD') {
  const n = Number(amount) || 0
  return n.toLocaleString('en-US', { style: 'currency', currency })
}

export function formatDate(isoDate) {
  if (!isoDate) return ''
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function isInPeriod(isoDate, period) {
  return isoDate?.startsWith(period)
}
