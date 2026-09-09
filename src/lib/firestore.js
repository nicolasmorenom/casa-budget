import { db } from './firebase'
import { suggestCategoryId } from './categorize'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore'

// ---------- Households ----------

function randomInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function createHousehold(uid, name, profile = {}) {
  const householdRef = await addDoc(collection(db, 'households'), {
    name,
    memberUids: [uid],
    inviteCode: randomInviteCode(),
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'users', uid), { householdIds: arrayUnion(householdRef.id) }, { merge: true })
  await setDoc(doc(db, 'households', householdRef.id, 'members', uid), {
    displayName: profile.displayName || profile.email || 'Member',
    email: profile.email || null,
  })
  await seedDefaultCategories(householdRef.id)
  return householdRef.id
}

export async function joinHouseholdByInviteCode(uid, code, profile = {}) {
  const q = query(collection(db, 'households'), where('inviteCode', '==', code.trim().toUpperCase()))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('No household found with that invite code.')
  const householdDoc = snap.docs[0]
  await updateDoc(householdDoc.ref, { memberUids: arrayUnion(uid) })
  await setDoc(doc(db, 'users', uid), { householdIds: arrayUnion(householdDoc.id) }, { merge: true })
  await setDoc(doc(db, 'households', householdDoc.id, 'members', uid), {
    displayName: profile.displayName || profile.email || 'Member',
    email: profile.email || null,
  })
  return householdDoc.id
}

export function subscribeMembers(householdId, cb) {
  return onSnapshot(collection(db, 'households', householdId, 'members'), (snap) =>
    cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
  )
}

export function subscribeUserDoc(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), (snap) => cb(snap.exists() ? snap.data() : null))
}

export function subscribeHousehold(householdId, cb) {
  return onSnapshot(doc(db, 'households', householdId), (snap) =>
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  )
}

// ---------- Accounts ----------

export function subscribeAccounts(householdId, cb) {
  const q = query(collection(db, 'households', householdId, 'accounts'), orderBy('name'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export function addAccount(householdId, account) {
  return addDoc(collection(db, 'households', householdId, 'accounts'), {
    name: account.name,
    type: account.type || 'checking',
    balance: Number(account.balance) || 0,
    currency: account.currency || 'USD',
    simplefinAccountId: account.simplefinAccountId || null,
    archived: false,
    createdAt: serverTimestamp(),
  })
}

export function updateAccount(householdId, accountId, patch) {
  return updateDoc(doc(db, 'households', householdId, 'accounts', accountId), patch)
}

export function deleteAccount(householdId, accountId) {
  return deleteDoc(doc(db, 'households', householdId, 'accounts', accountId))
}

// ---------- Categories ----------

const DEFAULT_CATEGORIES = [
  { name: 'Salario / Ingresos', kind: 'income', color: '#3f6b52', monthlyBudget: 0 },
  { name: 'Arriendo / Hipoteca', kind: 'expense', color: '#b9832e', monthlyBudget: 1800 },
  { name: 'Mercado', kind: 'expense', color: '#a24a35', monthlyBudget: 600 },
  { name: 'Servicios públicos', kind: 'expense', color: '#7a6a53', monthlyBudget: 250 },
  { name: 'Transporte', kind: 'expense', color: '#5b7a99', monthlyBudget: 200 },
  { name: 'Restaurantes', kind: 'expense', color: '#a2665b', monthlyBudget: 250 },
  { name: 'Entretenimiento', kind: 'expense', color: '#8a6ba8', monthlyBudget: 150 },
  { name: 'Ahorros', kind: 'expense', color: '#3f6b52', monthlyBudget: 400 },
]

async function seedDefaultCategories(householdId) {
  const batchPromises = DEFAULT_CATEGORIES.map((cat) =>
    addDoc(collection(db, 'households', householdId, 'categories'), cat)
  )
  await Promise.all(batchPromises)
}

export function subscribeCategories(householdId, cb) {
  const q = query(collection(db, 'households', householdId, 'categories'), orderBy('name'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export function addCategory(householdId, category) {
  return addDoc(collection(db, 'households', householdId, 'categories'), {
    name: category.name,
    kind: category.kind || 'expense',
    color: category.color || '#3c4d61',
    monthlyBudget: Number(category.monthlyBudget) || 0,
    essential: !!category.essential,
  })
}

export function updateCategory(householdId, categoryId, patch) {
  return updateDoc(doc(db, 'households', householdId, 'categories', categoryId), patch)
}

export function deleteCategory(householdId, categoryId) {
  return deleteDoc(doc(db, 'households', householdId, 'categories', categoryId))
}

// ---------- Transactions ----------

export function subscribeTransactions(householdId, cb) {
  const q = query(collection(db, 'households', householdId, 'transactions'), orderBy('date', 'desc'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export function addTransaction(householdId, uid, tx) {
  return addDoc(collection(db, 'households', householdId, 'transactions'), {
    accountId: tx.accountId,
    categoryId: tx.categoryId || null,
    amount: Number(tx.amount),
    description: tx.description || '',
    date: tx.date, // ISO date string, e.g. 2026-08-28
    pending: !!tx.pending,
    simplefinId: tx.simplefinId || null,
    paidBy: tx.paidBy || uid,
    shared: !!tx.shared,
    createdBy: uid,
    createdAt: serverTimestamp(),
  })
}

export function updateTransaction(householdId, txId, patch) {
  return updateDoc(doc(db, 'households', householdId, 'transactions', txId), patch)
}

export function deleteTransaction(householdId, txId) {
  return deleteDoc(doc(db, 'households', householdId, 'transactions', txId))
}

// Upsert used by the SimpleFIN sync flow. Two things make this trickier than a
// plain id-based dedup:
//
// 1. When a transaction is pending, SimpleFIN (like most bank-data APIs) gives
//    it one id; once it clears, many banks hand it a NEW id. A pure id match
//    would treat that as a brand-new transaction, producing a duplicate —
//    this is the most common source of "duplicate transactions" complaints
//    with any bank sync, not something specific to SimpleFIN.
// 2. So: an incoming transaction whose id doesn't match anything gets a
//    second check — is there an existing PENDING transaction on this account
//    with the same amount, within a few days? If so, treat this as that
//    transaction settling: update it in place (new id, final description,
//    pending: false) instead of inserting a new row.
//
// Each existing pending transaction can only absorb one incoming update, so
// two same-day, same-amount pendings can't accidentally collapse into one.
const PENDING_MATCH_WINDOW_DAYS = 5

// A pending transaction's `posted` timestamp may be 0 per the SimpleFIN spec
// (it hasn't posted yet), which would otherwise turn into a Jan 1 1970 date.
// Fall back to transacted_at, then to today, in that order.
function simplefinTransactionDate(t) {
  const epoch = t.posted || t.transacted_at
  if (epoch) return new Date(epoch * 1000).toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

export async function upsertTransactionsFromSimpleFin(householdId, uid, accountId, transactions, categories = []) {
  const existingSnap = await getDocs(
    query(collection(db, 'households', householdId, 'transactions'), where('accountId', '==', accountId))
  )
  const existingSimplefinIds = new Set(existingSnap.docs.map((d) => d.data().simplefinId).filter(Boolean))
  const pendingCandidates = existingSnap.docs
    .filter((d) => d.data().pending && d.data().simplefinId)
    .map((d) => ({ id: d.id, ...d.data() }))

  let added = 0
  let settled = 0

  for (const t of transactions) {
    if (existingSimplefinIds.has(t.id)) continue // already have this exact id

    const description = t.description || t.payee || 'Imported transaction'
    const amount = Number(t.amount)
    const date = simplefinTransactionDate(t)

    const matchIndex = pendingCandidates.findIndex((p) => {
      if (p.amount !== amount) return false
      const daysApart = Math.abs(new Date(p.date) - new Date(date)) / 86400000
      return daysApart <= PENDING_MATCH_WINDOW_DAYS
    })

    if (matchIndex !== -1) {
      const match = pendingCandidates[matchIndex]
      pendingCandidates.splice(matchIndex, 1) // don't let another incoming row match the same pending doc
      await updateTransaction(householdId, match.id, {
        simplefinId: t.id,
        description,
        date,
        pending: t.pending || false,
      })
      settled++
      continue
    }

    await addTransaction(householdId, uid, {
      accountId,
      amount,
      description,
      date,
      pending: t.pending || false,
      simplefinId: t.id,
      categoryId: suggestCategoryId(description, amount, categories),
    })
    added++
  }

  return { added, settled }
}

// ---------- SimpleFIN connection (per household) ----------

export async function getSimplefinConnection(householdId) {
  const snap = await getDoc(doc(db, 'households', householdId, 'simplefin', 'connection'))
  return snap.exists() ? snap.data() : null
}

export function saveSimplefinConnection(householdId, accessUrl) {
  return setDoc(doc(db, 'households', householdId, 'simplefin', 'connection'), {
    accessUrl,
    connectedAt: serverTimestamp(),
  })
}

export function updateSimplefinLastSync(householdId) {
  return setDoc(
    doc(db, 'households', householdId, 'simplefin', 'connection'),
    { lastSyncedAt: serverTimestamp() },
    { merge: true }
  )
}

export function deleteSimplefinConnection(householdId) {
  return deleteDoc(doc(db, 'households', householdId, 'simplefin', 'connection'))
}

// One-time cleanup for duplicates left over from before the pending/posted
// matching above existed. Deliberately conservative: only removes a pending
// transaction when a DIFFERENT, already-settled (non-pending) transaction on
// the same account matches its amount within the window — that specific
// pending-stub-plus-settled-twin pattern is the one this bug actually
// produces. It never touches two settled transactions with the same amount,
// since those could genuinely be two separate purchases.
export async function findAndRemoveDuplicates(householdId) {
  const snap = await getDocs(collection(db, 'households', householdId, 'transactions'))
  const all = snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))

  const byAccount = {}
  all.forEach((tx) => {
    ;(byAccount[tx.accountId] ||= []).push(tx)
  })

  let removed = 0
  for (const accountTx of Object.values(byAccount)) {
    const settled = accountTx.filter((tx) => !tx.pending)
    const claimedSettledIds = new Set()
    const pending = accountTx.filter((tx) => tx.pending)

    for (const p of pending) {
      const match = settled.find(
        (s) =>
          !claimedSettledIds.has(s.id) &&
          s.amount === p.amount &&
          Math.abs(new Date(s.date) - new Date(p.date)) / 86400000 <= PENDING_MATCH_WINDOW_DAYS
      )
      if (match) {
        claimedSettledIds.add(match.id)
        await deleteDoc(p.ref)
        removed++
      }
    }
  }
  return removed
}
