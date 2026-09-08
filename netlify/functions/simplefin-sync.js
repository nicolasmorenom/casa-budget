// Fetches accounts + transactions from SimpleFIN using a stored access URL.
// Runs server-side so the Basic Auth credentials embedded in the access URL
// never sit in browser devtools network logs beyond this app's own request.
//
// The Bridge's own error responses are the source of truth on window size —
// it told us directly ("Requested date range exceeds recommended range of
// 45 days. In the future, this may be capped.") that 45 days is the current
// number, superseding the 90-day figure this comment used to cite from
// secondhand reports. So a request for a year of history has to be split
// into consecutive <=45-day windows and merged here. If no startDate is
// given at all, we do a single call with no date params, which is the "just
// give me whatever you'd normally give me" behavior (the Bridge's own
// recent-activity default).
//
// Pending transactions get their own extra, date-unbounded request. Per spec
// a pending transaction's `posted` timestamp may be 0 (it hasn't posted
// yet), and some server implementations filter `posted >= start-date` —
// which a 0 timestamp fails, silently dropping currently-pending
// transactions from any windowed request that also specifies a start-date
// (which every request here does, since a fully unbounded window isn't
// possible once history-chunking is in play). Asking once, with no date
// bounds at all, sidesteps that.

const MAX_WINDOW_SECONDS = 45 * 24 * 60 * 60
const MAX_CHUNKS = 16 // ~2 years of history in one call, at 45 days/chunk

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
        const winEnd = Math.min(winStart + MAX_WINDOW_SECONDS, nowTs)
        windows.push([winStart, winEnd])
        winStart = winEnd
      }
    } else {
      windows.push([null, null]) // no dates requested — take whatever window the Bridge defaults to
    }

    // accountId -> { ...account fields, txById: Map(transactionId -> transaction) }
    // Deduping by transaction id here (not just at the end) matters once the
    // supplemental pending-only fetch below can return the same transaction
    // a windowed fetch already picked up.
    const accountsById = new Map()
    let errors = []

    function mergeAccounts(accts, { pendingOnly = false } = {}) {
      for (const acct of accts) {
        let entry = accountsById.get(acct.id)
        if (!entry) {
          entry = { ...acct, txById: new Map() }
          accountsById.set(acct.id, entry)
        } else {
          // Later fetches are closer to "now", so their balance snapshot wins —
          // except the pending-only supplemental fetch, whose balance figure
          // isn't tied to the requested date range and shouldn't override it.
          if (!pendingOnly) {
            entry.balance = acct.balance
            entry['available-balance'] = acct['available-balance']
            entry['balance-date'] = acct['balance-date']
          }
        }
        const txs = pendingOnly ? (acct.transactions || []).filter((t) => t.pending) : acct.transactions || []
        txs.forEach((t) => entry.txById.set(t.id, t))
      }
    }

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
      mergeAccounts(data.accounts || [])
    }

    // Supplemental pending-only fetch, no date bounds — see the note above.
    // Best-effort: if this one fails, don't fail the whole sync over it.
    try {
      const pendingUrl = new URL(baseAccountsUrl)
      pendingUrl.searchParams.set('pending', '1')
      const pendingRes = await fetch(pendingUrl.toString(), { headers: { Authorization: authHeader } })
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json()
        mergeAccounts(pendingData.accounts || [], { pendingOnly: true })
      }
    } catch {
      // ignore — historical data above still returns successfully either way
    }

    const accounts = Array.from(accountsById.values()).map(({ txById, ...acct }) => ({
      ...acct,
      transactions: Array.from(txById.values()),
    }))
    const pendingCount = accounts.reduce((sum, a) => sum + a.transactions.filter((t) => t.pending).length, 0)

    return { statusCode: 200, body: JSON.stringify({ accounts, errors, pendingCount }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
