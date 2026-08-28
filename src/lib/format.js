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

export function periodLabel(period, lang = 'es') {
  const monthNames = {
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  }
  const [year, month] = period.split('-').map(Number)
  const name = (monthNames[lang] || monthNames.es)[month - 1]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}
