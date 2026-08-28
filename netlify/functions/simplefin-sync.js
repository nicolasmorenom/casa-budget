// Fetches accounts + transactions from SimpleFIN using a stored access URL.
// Runs server-side so the Basic Auth credentials embedded in the access URL
// never sit in browser devtools network logs beyond this app's own request.

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { accessUrl, startDate } = JSON.parse(event.body || '{}')
    if (!accessUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing accessUrl' }) }
    }

    const url = new URL(accessUrl)
    const username = url.username
    const password = url.password
    // The path portion of the access URL already includes the bridge's base path.
    const accountsUrl = new URL(`${url.origin}${url.pathname}/accounts`)
    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000)
      accountsUrl.searchParams.set('start-date', String(startTimestamp))
    }

    const res = await fetch(accountsUrl.toString(), {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
      },
    })

    if (!res.ok) {
      const text = await res.text()
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `SimpleFIN sync failed (${res.status}): ${text.slice(0, 200)}` }),
      }
    }

    const data = await res.json()
    return { statusCode: 200, body: JSON.stringify({ accounts: data.accounts || [], errors: data.errors || [] }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
