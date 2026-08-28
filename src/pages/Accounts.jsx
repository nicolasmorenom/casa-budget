import { useState } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useLanguage } from '../contexts/LanguageContext'
import { addAccount, updateAccount, deleteAccount } from '../lib/firestore'
import { formatMoney } from '../lib/format'

const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'cash', 'investment']

export default function Accounts() {
  const { activeHouseholdId, accounts } = useHousehold()
  const { t } = useLanguage()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">{t('accounts.title')}</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
        >
          {showForm ? t('common.cancel') : t('accounts.add')}
        </button>
      </div>

      {showForm && <AccountForm householdId={activeHouseholdId} onDone={() => setShowForm(false)} t={t} />}

      <div className="bg-paper-raised border border-line rounded-lg">
        {accounts.length === 0 ? (
          <p className="text-ink-soft text-sm p-4">{t('accounts.empty')}</p>
        ) : (
          accounts.map((a) => <AccountRow key={a.id} account={a} householdId={activeHouseholdId} t={t} />)
        )}
      </div>
    </div>
  )
}

function AccountRow({ account, householdId, t }) {
  const [editing, setEditing] = useState(false)
  const [balance, setBalance] = useState(account.balance)

  async function saveBalance() {
    await updateAccount(householdId, account.id, { balance: Number(balance) })
    setEditing(false)
  }

  return (
    <div className="ledger-row flex items-center justify-between px-4 py-3">
      <div>
        <p className="font-medium">{account.name}</p>
        <p className="text-xs text-ink-soft capitalize">
          {account.type}
          {account.simplefinAccountId ? ` · ${t('accounts.synced')}` : ` · ${t('accounts.manual')}`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {editing ? (
          <>
            <input
              className="w-28 border border-line rounded px-2 py-1 font-mono-num text-right bg-white/60"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              autoFocus
            />
            <button onClick={saveBalance} className="text-sage text-sm font-medium">
              {t('common.save')}
            </button>
          </>
        ) : (
          <button
            onClick={() => !account.simplefinAccountId && setEditing(true)}
            className="font-mono-num text-lg"
            title={account.simplefinAccountId ? undefined : 'Click to edit'}
          >
            {formatMoney(account.balance, account.currency)}
          </button>
        )}
        <button
          onClick={() => deleteAccount(householdId, account.id)}
          className="text-rust text-xs hover:underline"
        >
          {t('common.remove')}
        </button>
      </div>
    </div>
  )
}

function AccountForm({ householdId, onDone, t }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('checking')
  const [balance, setBalance] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    await addAccount(householdId, { name, type, balance })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-lg p-4 flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('common.name')}</label>
        <input
          className="border border-line rounded px-3 py-2 bg-white/60"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('common.type')}</label>
        <select className="border border-line rounded px-3 py-2 bg-white/60" value={type} onChange={(e) => setType(e.target.value)}>
          {ACCOUNT_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {tp}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-soft">{t('accounts.startingBalance')}</label>
        <input
          type="number"
          step="0.01"
          className="border border-line rounded px-3 py-2 bg-white/60 w-32"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
        />
      </div>
      <button type="submit" className="bg-amber text-paper rounded px-4 py-2 text-sm font-medium">
        {t('common.add')}
      </button>
    </form>
  )
}
