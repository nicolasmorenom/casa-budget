// Fetches accounts + transactions from SimpleFIN using a stored access URL.
// Runs server-side so the Basic Auth credentials embedded in the access URL
// never sit in browser devtools network logs beyond this app's own request.
//
// SimpleFIN Bridge caps any single /accounts request to a 90-day start/end
// window (enforced on their end, not just documented as a suggestion) — see
// https://beta-bridge.simplefin.org/info/developers. So a request for a
// year of history has to be split into consecutive <=90-day windows and
// merged here. If no startDate is given at all, we do a single call with no
// date params, which is the "just give me whatever you'd normally give me"
// behavior (the Bridge's own recent-activity default).

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60
const MAX_CHUNKS = 8 // ~2 years of history in one call; keeps this well inside Netlify's function timeout and SimpleFIN's 24-req/day quota

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { accessUrl, startDate, endDate } = JSON.parse(event.body || '{}')
    if (!accessUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing accessUrl' }) }
    }

    const url = new URL(accessUrl)
    const authHeader = 'Basic ' + Buffer.from(`${url.username}:${url.password}`).toString('base64')
    const baseAccountsUrl = `${url.origin}${url.pathname}/accounts`

    const nowTs = endDate ? Math.floor(new Date(endDate).getTime() / 1000) : Math.floor(Date.now() / 1000)
    const startTs = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : null

    const windows = []
    if (startTs) {
      let winStart = startTs
      while (winStart < nowTs && windows.length < MAX_CHUNKS) {
        const winEnd = Math.min(winStart + NINETY_DAYS_SECONDS, nowTs)
        windows.push([winStart, winEnd])
        winStart = winEnd
      }
    } else {
      windows.push([null, null]) // no dates requested — take whatever window the Bridge defaults to
    }

    const accountsById = new Map()
    let errors = []

    for (const [winStart, winEnd] of windows) {
      const reqUrl = new URL(baseAccountsUrl)
      if (winStart) reqUrl.searchParams.set('start-date', String(winStart))
      if (winEnd) reqUrl.searchParams.set('end-date', String(winEnd))
      reqUrl.searchParams.set('pending', '1') // per spec, pending transactions are excluded unless explicitly requested

      const res = await fetch(reqUrl.toString(), { headers: { Authorization: authHeader } })
      if (!res.ok) {
        const text = await res.text()
        return {
          statusCode: 502,
          body: JSON.stringify({ error: `SimpleFIN sync failed (${res.status}): ${text.slice(0, 200)}` }),
        }
      }

      const data = await res.json()
      errors = errors.concat(data.errors || data.errlist || [])

      for (const acct of data.accounts || []) {
        if (!accountsById.has(acct.id)) {
          accountsById.set(acct.id, { ...acct, transactions: [...(acct.transactions || [])] })
        } else {
          const existing = accountsById.get(acct.id)
          // Later windows are closer to "now", so their balance snapshot wins.
          existing.balance = acct.balance
          existing['available-balance'] = acct['available-balance']
          existing['balance-date'] = acct['balance-date']
          existing.transactions.push(...(acct.transactions || []))
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ accounts: Array.from(accountsById.values()), errors }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
