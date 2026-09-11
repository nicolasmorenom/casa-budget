# Casa Budget (public instance)

React (Create React App) + Firebase (Auth + Firestore), deployed on Netlify
to presupuestosuchos.com. **This app is now open to anyone who signs in
with Google** — the two-email whitelist that used to gate it has been
removed, and real per-household data isolation has been added in its
place (see below for why that's a package deal, not two separate things).

## Data model

```
users/{uid}                    { name, email, photo, lastLogin, householdId }
budgetHouseholds/{code}        { name, code, memberUids, memberEmails, createdAt, createdBy }
transactions/{id}              { householdId, amount, date, type, categoryId, accountId, addedBy, createdAt, ... }
categories/{id}                { householdId, label, type, icon, color, monthlyBudget, group, createdAt }
accounts/{id}                  { householdId, ..., createdAt }
goals/{id}                     { householdId, ..., createdAt }
bills/{id}                     { householdId, ..., createdAt }
budgetPlans/{householdId_YYYY-MM} { householdId, ... }
```

`budgetHouseholds/{code}` — the document id **is** the 6-character invite
code. That's deliberate; see the security section below.

## Why removing the whitelist alone would have been dangerous

Every collection here used a hardcoded `householdId: "casa"`, with zero
per-user separation — the email whitelist was the *only* thing keeping
data private. Removing it without anything else would have meant any
stranger who signed in saw, and mixed their own data into, real financial
transactions belonging to whoever used the app before them.

## What's now in place

- `budgetHouseholds/{code}` — each household has a name, its invite code,
  and member lists (`memberUids` for security rules, `memberEmails` for
  display — `Dashboard.js` already had UI expecting exactly this shape in
  its household/invite-code card, it just never had real data behind it).
- `src/households.js` — create a household, join one by code, or look up
  which household the signed-in user belongs to.
- A new onboarding screen in `App.js`, shown right after sign-in if the
  user isn't in a household yet: create new, or join with a code.
- **`Dashboard.js` itself is untouched.** It already took `householdId` as
  a prop rather than hardcoding it, so this retrofit only needed to change
  what feeds that prop, not the 4,000+ line file itself.

## How "join by code" is secured without a server function

The simplest implementation would query `where("code", "==", enteredCode)`
against a normal collection — but Firestore rules can't restrict *which*
documents a `list` query returns, only whether the query is allowed at
all. `allow list: if signed in` would leak every household's name and
invite code to any stranger who creates an account.

Using the code as the document id avoids this: looking up a household by
code becomes a `get` by exact id, and there's intentionally **no
`allow list`** on this collection. Nobody can discover a household's code
by browsing — only by already having it (same trade-off as any
"anyone-with-the-link" sharing model).

Joining itself — a non-member updating someone else's household doc to add
themselves — is normally blocked. It's allowed only in one narrow shape:
the proposed `memberUids`/`memberEmails` are exactly the current arrays
with your own uid/email appended, and nothing else in the document
changed. That's enough to let someone join with a code entirely through
Firestore rules, with no Cloud Function or Admin SDK service account
needed.

## A related bug found and fixed along the way

The *other* Casa Budget app in this project (the multi-household scaffold,
sharing this same Firebase project) has the same join-by-invite-code
feature — and its rules required already being a household member before
you could update the household doc at all, which meant joining could never
actually have succeeded there either. Fixed with the same "exact append"
pattern, in the same merged `firestore.rules` (synced into both repos —
deploy this version regardless of which repo you deploy rules from).

## Firebase/Netlify setup

This project (`budget-app-public`) is shared with the other Casa Budget
app, so a few things carry over or need a look:

- **Authorized domains**: Authentication → Settings → Authorized domains →
  make sure `presupuestosuchos.com` is listed (separate from whatever was
  configured there for the other app's domain). Google sign-in should
  already be enabled from the other app's setup.
- **`users/{uid}` is intentionally shared** between both apps, gated by
  self-access only (no email restriction) — a new public user needs to be
  able to write their own profile doc regardless of which app they're
  using.
- No composite indexes needed — every query here is a single
  `where("householdId", "==", ...)`.
- **Only Google sign-in is wired up.** "Other sources" would mean adding
  providers like email/password or Apple — not done here. Say the word if
  you want that.

## SimpleFIN: real, working, but with real gaps

SimpleFIN is genuinely wired into the UI here (`SimplefinModal` in
`Dashboard.js`) — real progress since the last version I reviewed. Going
through the flow surfaced issues worth knowing about before relying on it,
none of which I touched in this pass:

### Bugs

- **No duplicate protection on import, at all.** `addTx` is a plain
  `addDoc` with no check against existing transactions. Every sync
  re-fetches the full window; running it twice, or not skipping
  already-imported rows, creates a full duplicate set. This is the exact
  problem already fixed in the other Casa Budget build (match on
  transaction id, then fall back to an amount+date-window match to catch a
  pending transaction getting a new id once it posts) — none of that
  exists here.
- **No `pending=1` sent to SimpleFIN.** Per SimpleFIN's spec, pending
  transactions are excluded unless explicitly requested. This proxy
  doesn't ask for them, so pending charges won't show up regardless of
  what's actually pending on an account.
- **No chunking for longer date ranges.** A request over ~45 days risks
  the same "exceeds recommended range" response seen on the other
  connection — this proxy passes `startDate` straight through in one call.

### Worth knowing, not urgent

- **SimpleFIN connection URL lives in `localStorage`** (`sf_url_{uid}`),
  not Firestore — per-device, doesn't sync across devices or between
  household members, gone if that browser's storage is cleared.
- **Merchant→category mappings** are also `localStorage`-only.
- **The AI-categorization step calls `api.anthropic.com` directly from the
  browser, with no API key present anywhere in the code right now** — it
  currently just fails silently and falls back to manual categorization.
  Not exploitable today since there's no key to leak, but if a key ever
  gets added directly in this frontend file, it would be visible to anyone
  via devtools or the deployed JS bundle. Should go through a serverless
  function instead, same pattern `simplefin-proxy.js` already uses.

Say the word if you want any of the above fixed.
