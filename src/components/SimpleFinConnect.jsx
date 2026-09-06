import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { claimSetupToken, fetchSimplefinData } from '../lib/simplefin'
import {
  getSimplefinConnection,
  saveSimplefinConnection,
  updateSimplefinLastSync,
  deleteSimplefinConnection,
  addAccount,
  updateAccount,
  upsertTransactionsFromSimpleFin,
  findAndRemoveDuplicates,
} from '../lib/firestore'

const HISTORY_OPTIONS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '6 months', days: 182 },
  { label: '1 year', days: 365 },
  { label: '2 years', days: 730 },
]

export default function SimpleFinConnect() {
  const { user } = useAuth()
  const { activeHouseholdId, accounts, categories } = useHousehold()
  const [connection, setConnection] = useState(undefined)
  const [setupToken, setSetupToken] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [historyDays, setHistoryDays] = useState(90)

  useEffect(() => {
    if (!activeHouseholdId) return
    getSimplefinConnection(activeHouseholdId).then(setConnection)
  }, [activeHouseholdId])

  async function handleConnect(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const accessUrl = await claimSetupToken(setupToken.trim())
      await saveSimplefinConnection(activeHouseholdId, accessUrl)
      setConnection({ accessUrl })
      setSetupToken('')
      setHistoryDays(365) // first sync after connecting should pull a real amount of history
      setStatus('Connected. Pick how far back to import, then Sync now.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSync() {
    setError('')
    setBusy(true)
    setStatus('Syncing…')
    try {
      const startDate = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000).toISOString()
      const { accounts: sfAccounts, errors, pendingCount } = await fetchSimplefinData(connection.accessUrl, { startDate })
      let newAccounts = 0
      let newTx = 0
      let settledTx = 0

      for (const sfAccount of sfAccounts) {
        let localAccount = accounts.find((a) => a.simplefinAccountId === sfAccount.id)
        if (!localAccount) {
          const ref = await addAccount(activeHouseholdId, {
            name: sfAccount.name,
            type: 'checking',
            balance: sfAccount.balance,
            currency: sfAccount.currency || 'USD',
            simplefinAccountId: sfAccount.id,
          })
          newAccounts++
          localAccount = { id: ref.id }
        } else {
          await updateAccount(activeHouseholdId, localAccount.id, { balance: sfAccount.balance })
        }
        const { added, settled } = await upsertTransactionsFromSimpleFin(
          activeHouseholdId,
          user.uid,
          localAccount.id,
          sfAccount.transactions || [],
          categories
        )
        newTx += added
        settledTx += settled
      }

      await updateSimplefinLastSync(activeHouseholdId)
      const errNote = errors?.length ? ` (${errors.length} account error(s) reported by SimpleFIN)` : ''
      const settledNote = settledTx > 0 ? `, ${settledTx} pending transaction(s) settled (no duplicates)` : ''
      const pendingNote = ` SimpleFIN currently reports ${pendingCount || 0} pending transaction(s) across your accounts.`
      setStatus(`Synced: ${newAccounts} new account(s), ${newTx} new transaction(s)${settledNote}.${errNote}${pendingNote}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    await deleteSimplefinConnection(activeHouseholdId)
    setConnection(null)
    setStatus('')
  }

  async function handleDedupe() {
    setBusy(true)
    setStatus('Checking for duplicates…')
    try {
      const removed = await findAndRemoveDuplicates(activeHouseholdId)
      setStatus(removed > 0 ? `Removed ${removed} duplicate transaction(s).` : 'No duplicates found.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (connection === undefined) return null

  return (
    <div className="bg-paper-raised border border-line rounded-lg p-4">
      <h2 className="font-display text-xl mb-1">SimpleFIN bank connection</h2>
      <p className="text-sm text-ink-soft mb-4">
        SimpleFIN is a read-only bank data protocol — get a setup token from your SimpleFIN Bridge provider
        (e.g. beta-bridge.simplefin.org) and paste it below. It can only be claimed once, so it's saved to your
        household immediately.
      </p>

      {!connection ? (
        <form onSubmit={handleConnect} className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
            <label className="text-xs text-ink-soft">Setup token</label>
            <input
              className="border border-line rounded px-3 py-2 bg-white/60 font-mono-num text-sm"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              placeholder="Paste the base64 setup token"
              required
            />
          </div>
          <button disabled={busy} className="bg-amber text-paper rounded px-4 py-2 text-sm font-medium disabled:opacity-50">
            Connect
          </button>
        </form>
      ) : (
        <>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sage text-sm font-medium">● Connected</span>
          <label className="text-xs text-ink-soft flex items-center gap-2">
            Import
            <select
              className="border border-line rounded px-2 py-1.5 text-sm bg-white/60"
              value={historyDays}
              onChange={(e) => setHistoryDays(Number(e.target.value))}
            >
              {HISTORY_OPTIONS.map((opt) => (
                <option key={opt.days} value={opt.days}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={handleSync}
            disabled={busy}
            className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Sync now
          </button>
          <button onClick={handleDisconnect} className="text-rust text-sm hover:underline">
            Disconnect
          </button>
        </div>
        <p className="text-xs text-ink-soft mt-2">
          Re-syncing never creates duplicates — it's safe to run a longer range again if you need older
          transactions than your first import covered.
        </p>
        <button onClick={handleDedupe} disabled={busy} className="text-xs text-ink-soft hover:underline mt-1 disabled:opacity-50">
          Find &amp; remove duplicate transactions
        </button>
        </>
      )}

      {status && <p className="text-sm text-sage mt-3">{status}</p>}
      {error && <p className="text-sm text-rust mt-3">{error}</p>}
    </div>
  )
}
