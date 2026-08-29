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

// Upsert used by the SimpleFIN sync flow: avoids duplicate transactions on
// repeated syncs by keying off the SimpleFIN transaction id, and tries to
// pre-categorize each new transaction against the household's own categories.
export async function upsertTransactionsFromSimpleFin(householdId, uid, accountId, transactions, categories = []) {
  const existingSnap = await getDocs(
    query(collection(db, 'households', householdId, 'transactions'), where('accountId', '==', accountId))
  )
  const existingSimplefinIds = new Set(
    existingSnap.docs.map((d) => d.data().simplefinId).filter(Boolean)
  )
  const toAdd = transactions.filter((t) => !existingSimplefinIds.has(t.id))
  await Promise.all(
    toAdd.map((t) => {
      const description = t.description || t.payee || 'Imported transaction'
      const amount = Number(t.amount)
      return addTransaction(householdId, uid, {
        accountId,
        amount,
        description,
        date: new Date(t.posted * 1000).toISOString().slice(0, 10),
        pending: t.pending || false,
        simplefinId: t.id,
        categoryId: suggestCategoryId(description, amount, categories),
      })
    })
  )
  return toAdd.length
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
