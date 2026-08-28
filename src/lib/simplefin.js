// Client-side helper for the SimpleFIN Bridge integration. Both calls go
// through Netlify Functions so the browser never has to deal with SimpleFIN's
// CORS restrictions or Basic Auth header directly.

export async function claimSetupToken(setupToken) {
  const res = await fetch('/.netlify/functions/simplefin-claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setupToken }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not claim SimpleFIN setup token.')
  return data.accessUrl // save this immediately — the setup token can only be claimed once
}

export async function fetchSimplefinData(accessUrl, { startDate } = {}) {
  const res = await fetch('/.netlify/functions/simplefin-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessUrl, startDate }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not sync with SimpleFIN.')
  return data // { accounts: [...] } — each account includes its own transactions[]
}
