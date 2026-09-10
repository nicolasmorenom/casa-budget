# Casa Budget (family instance)

Private, two-person household budgeting app — React (Create React App) +
Firebase (Auth + Firestore), deployed on Netlify to presupuestosuchos.com.
Access is restricted to `nicolasm1410@gmail.com` and
`n.rodriguez2338@gmail.com` — anyone else who signs in with Google gets
signed back out immediately (`ALLOWED_EMAILS` in `src/App.js`).

## Data model (confirmed against the actual code)

Same flat, single-household model as before — every document carries a
`householdId` field set to the hardcoded `"casa"`.

```
users/{uid}              { name, email, photo, lastLogin }
transactions/{id}        { householdId, amount, date, type, categoryId,
                            accountId, addedBy, createdAt, ... }
categories/{id}          { householdId, label, type, icon, color,
                            monthlyBudget, group, createdAt }
accounts/{id}            { householdId, ..., createdAt }
goals/{id}               { householdId, ..., createdAt }
bills/{id}               { householdId, ..., createdAt }
budgetPlans/{monthKey}   { householdId, ... }  — doc id is like "2026-08"
```

## Firestore rules & Firebase/Netlify setup

Unchanged from before — see the earlier `SETUP.md` if this is a fresh
Firebase project: enable Google sign-in, add `presupuestosuchos.com` and
your Netlify site's `*.netlify.app` domain to Authorized domains, deploy
`firestore.rules`. No composite indexes needed — every query is a single
`where("householdId", "==", ...)`.

## What's changed since the last version I reviewed

SimpleFIN is now actually wired into the UI (`SimplefinModal` in
Dashboard.js) — that's real, working progress. But going through the sync
flow surfaced several issues worth knowing about before you rely on it:

### Real bugs

- **No duplicate protection on import, at all.** `addTx` is a plain
  `addDoc` with no check against existing transactions. Every SimpleFIN
  sync re-fetches the full window and, unless you manually skip rows you've
  already imported, running it twice creates a full duplicate set. This is
  the exact problem I spent a lot of effort fixing in the other Casa Budget
  build (matching on transaction id, then falling back to an
  amount+date-window match to catch a pending transaction getting a new id
  once it posts) — none of that exists here yet.
- **No `pending=1` sent to SimpleFIN.** Per SimpleFIN's own spec, pending
  transactions (e.g., a credit card charge that hasn't posted yet) are
  excluded unless the request explicitly asks for them. This proxy doesn't,
  so pending transactions won't show up regardless of what's actually
  pending on your accounts.
- **No chunking for longer date ranges.** A request for more than ~45 days
  risks the same "Requested date range exceeds recommended range" response
  I ran into on your other connection — this proxy just passes whatever
  `startDate` it's given straight through in one call.

### Worth knowing, not urgent

- **SimpleFIN connection URL lives in `localStorage`** (`sf_url_{uid}`),
  not Firestore — per-device, not shared between the two of you, gone if
  that browser's storage is cleared.
- **Merchant→category mappings** are also `localStorage`-only, same
  limitation.
- **The AI-categorization step calls `api.anthropic.com` directly from the
  browser with no API key present anywhere in the code** — right now that
  just means it silently fails and falls back to leaving rows uncategorized
  for manual review (caught by a try/catch that only `console.warn`s). It's
  not currently a security problem since there's no key to leak. But if
  this ever gets "fixed" by adding a key directly in the frontend code,
  that key would be visible to anyone who opens browser devtools or reads
  the deployed JS bundle — API calls like this need to go through a
  serverless function (like `simplefin-proxy.js` already does for
  SimpleFIN) so the key stays server-side.

I didn't touch any of this in this pass since you asked for a literal copy
plus the Firebase rules — just flagging it since it's the same class of bug
we already spent real time on elsewhere in this project. Say the word if
you want me to port those fixes over here too.
