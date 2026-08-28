# Casa Budget

A household budgeting app: shared accounts, categorized transactions, monthly
category budgets, and an optional read-only bank connection via **SimpleFIN**.
Built React + Vite + Tailwind v4, Firebase (Auth + Firestore), deployed on
Netlify (including two Netlify Functions for the SimpleFIN proxy).

## What's in this scaffold

- Email/password + Google sign-in (Firebase Auth)
- Multi-household model: each user can belong to a household, created or
  joined via a 6-character invite code — this is the "multi-household"
  piece for turning this into a public product later
- Household member profiles (`households/{id}/members/{uid}`) so names show
  up in the UI instead of raw ids
- Accounts, Categories, Transactions, Budgets pages, all live-synced via
  Firestore `onSnapshot`
- Dashboard: income, expenses, and remaining balance for the selected month,
  a category breakdown chart, recent activity, and — when a household has
  more than one member — a "shared spending by member" section
- A month switcher (Dashboard and Budgets share one `PeriodContext`) so past
  months can be reviewed separately from the current one
- Shared-cost tracking: any expense can be marked "shared" with a "paid by"
  member; the Dashboard turns that into a simple fair-share breakdown
  (who's owed, who owes) — not a full settle-up ledger, just enough to see
  at a glance
- A floating "+" quick-add button on every page for logging an expense in a
  few taps, without navigating to the Transactions page first
- Bilingual UI (Spanish default, English toggle) via a small `t()` helper in
  `LanguageContext` — preference is remembered in `localStorage`
- Default expense categories seeded in Spanish (rent/mortgage, groceries,
  utilities, transportation, dining out, entertainment, savings) — same
  shape as most household-budget apps use, editable afterward
- SimpleFIN Bridge connection: paste a setup token once, then pick how much
  history to import and hit "Sync now" — see the SimpleFIN section below
- A deliberately unbranded "ledger" visual language: serif display type,
  tabular-mono numerals, hairline dividers — see Design notes below

## Local setup

```bash
npm install
cp .env.example .env   # already pre-filled with your budget-app-public config
npm run dev
```

### Firebase project setup (one-time, in the Firebase console)

1. **Authentication** → Sign-in method → enable **Email/Password** and
   **Google**.
2. **Firestore Database** → create a database (production mode).
3. Deploy `firestore.rules` (in this repo) via the console's Rules tab, or
   with the Firebase CLI: `firebase deploy --only firestore:rules`.
4. Firestore doesn't need any composite indexes for the queries this
   scaffold uses.

The Firebase **web config is not a secret** — it's meant to ship in the
client bundle. Firestore security rules (`firestore.rules`) are what
actually protect the data, so make sure those are deployed before you put
real financial data in.

## Deploying to your existing Netlify site

This repo is already wired for `casa-budget.netlify.app`:

```bash
git init && git add -A && git commit -m "Casa Budget scaffold"
# push to a GitHub repo, then connect it in the Netlify dashboard, or:
netlify deploy --prod
```

`netlify.toml` sets the build command, publish directory, functions
directory, and an SPA redirect. Add the six `VITE_FIREBASE_*` variables from
`.env.example` under **Site settings → Environment variables** in Netlify so
production builds have them (Vite inlines `VITE_*` vars at build time).

No extra environment variables are needed for the two SimpleFIN functions —
they take the setup token / access URL from the request body, so there's no
server-side secret to configure for this scaffold.

## Connecting a bank via SimpleFIN

[SimpleFIN](https://www.simplefin.org/) is a lightweight, read-only protocol
for pulling account and transaction data from a bank — an alternative to
Plaid that a lot of DIY finance apps use. You'll need a setup token from a
SimpleFIN Bridge provider (the reference one is
[beta-bridge.simplefin.org](https://beta-bridge.simplefin.org/), ~$1.50/mo
per connection). In Settings → SimpleFIN bank connection, paste the token
and hit Connect, then Sync now whenever you want to pull in new data.

Two Netlify Functions do the actual talking to SimpleFIN so the browser
never hits SimpleFIN's CORS wall or has to construct Basic Auth headers:

- `simplefin-claim` — one-time exchange of a setup token for a durable
  access URL (which embeds the Basic Auth credentials)
- `simplefin-sync` — fetches accounts + transactions using that access URL

**On history depth:** SimpleFIN Bridge caps any single request to a 90-day
window, and if you don't ask for a range at all it falls back to a short
recent-activity default. `simplefin-sync` handles this by chunking a
requested range into consecutive 90-day windows server-side (capped at 8
chunks, ~2 years, to stay well within Netlify's function timeout and the
Bridge's 24-requests/day quota) — the Settings page has an "Import" dropdown
(30 days up to 2 years) so you control how far back a sync reaches. Re-syncing
never duplicates transactions (dedup is by SimpleFIN transaction id), so it's
always safe to re-run a longer range later.

The access URL is stored in Firestore at
`households/{id}/simplefin/connection`, readable/writable only by members of
that household under the current rules. That's a reasonable trade-off for a
personal/family app; if you turn this into a public multi-tenant product,
consider moving that document behind a Cloud Function using the Firebase
Admin SDK instead, so the credential never touches the client SDK at all.

## Data model

```
users/{uid}                          { householdIds: [...] }
households/{id}                      { name, memberUids: [...], inviteCode }
households/{id}/members/{uid}        { displayName, email }
households/{id}/accounts/{aid}       { name, type, balance, currency, simplefinAccountId }
households/{id}/categories/{cid}     { name, kind: income|expense, color, monthlyBudget }
households/{id}/transactions/{tid}   { accountId, categoryId, amount, description, date, simplefinId, paidBy, shared }
households/{id}/simplefin/connection { accessUrl, lastSyncedAt }
```

Budgets aren't a separate collection — a category's `monthlyBudget` is
compared against that category's transactions in the selected month on the
Budgets page. `paidBy` defaults to whoever created the transaction; `shared`
opts it into the Dashboard's fair-share breakdown. Simple, and enough for a
first version — see "Suggested next steps" for where a real Splitwise-style
settle-up would go if you need one later.

## Design notes

Palette, type, and the ledger-row motif are documented as inline comments
near where they're used (`src/index.css` for tokens). The signature idea:
tabular-mono numerals for every amount and hairline rules between rows,
borrowed from an actual paper ledger, rather than a generic dashboard-card
look.

## Suggested next steps

- Real settle-up logic for shared expenses (a "mark as settled" action, or
  a running balance across months rather than resetting fair-share to zero
  each period)
- Recurring/scheduled transactions
- CSV export
- Multi-currency support (currently assumes USD-like single currency per
  account)
- Automatic scheduled SimpleFIN sync (a Netlify scheduled function) instead
  of manual "Sync now"
- Extend the `t()` translation coverage to the SimpleFIN connection card in
  Settings, which is still English-only
