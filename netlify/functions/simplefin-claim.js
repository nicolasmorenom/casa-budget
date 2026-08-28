// Exchanges a SimpleFIN "setup token" for an access URL. The setup token is
// base64 of a claim URL; POSTing to that claim URL (once, ever) returns the
// access URL, which embeds Basic Auth credentials for all future requests.
// This has to happen server-side because the claim URL only allows one claim,
// and because the response doesn't include CORS headers for browser fetches.

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { setupToken } = JSON.parse(event.body || '{}')
    if (!setupToken) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing setupToken' }) }
    }

    const claimUrl = Buffer.from(setupToken, 'base64').toString('utf-8')
    if (!claimUrl.startsWith('http')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Setup token did not decode to a valid URL' }) }
    }

    const claimRes = await fetch(claimUrl, { method: 'POST' })
    if (!claimRes.ok) {
      const text = await claimRes.text()
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `SimpleFIN claim failed (${claimRes.status}): ${text.slice(0, 200)}` }),
      }
    }
    const accessUrl = (await claimRes.text()).trim()

    return { statusCode: 200, body: JSON.stringify({ accessUrl }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
