// Netlify serverless function — SimpleFIN CORS proxy
// Deployed at /.netlify/functions/simplefin-proxy

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST")   return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { action, setupToken, accessUrl, startDate } = body;

  // ── ACTION: claim — exchange one-time setup token for permanent access URL ──
  if (action === "claim") {
    if (!setupToken?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing setupToken" }) };
    try {
      const claimUrl = Buffer.from(setupToken.trim(), "base64").toString("utf8").trim();
      if (!claimUrl.startsWith("https://")) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid token — copy the full token from SimpleFIN Bridge" }) };
      }
      const resp = await fetch(claimUrl, { method: "POST", headers: { "Content-Length": "0" } });
      if (!resp.ok) {
        const txt = await resp.text();
        return { statusCode: 400, headers, body: JSON.stringify({ error: `SimpleFIN: ${txt}` }) };
      }
      const url = (await resp.text()).trim();
      return { statusCode: 200, headers, body: JSON.stringify({ accessUrl: url }) };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Claim failed: ${e.message}` }) };
    }
  }

  // ── ACTION: fetch — pull accounts + transactions ───────────────────────────
  if (action === "fetch") {
    if (!accessUrl?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing accessUrl" }) };
    try {
      const url      = new URL(accessUrl.trim());
      const username = decodeURIComponent(url.username);
      const password = decodeURIComponent(url.password);
      url.username   = "";
      url.password   = "";
      const base     = url.toString().replace(/\/$/, "");

      // Fetch last 90 days by default
      const params = new URLSearchParams({ version: "2" });
      const start  = startDate
        ? Math.floor(new Date(startDate).getTime() / 1000)
        : Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
      params.append("start-date", String(start));

      const resp = await fetch(`${base}/accounts?${params}`, {
        headers: {
          "Authorization": "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
        },
      });

      if (!resp.ok) {
        const txt = await resp.text();
        return { statusCode: resp.status, headers, body: JSON.stringify({ error: `SimpleFIN fetch: ${txt}` }) };
      }

      const data = await resp.json();
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          accounts: data.accounts || [],
          errors:   data.errors   || [],
        }),
      };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Fetch failed: ${e.message}` }) };
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
};
