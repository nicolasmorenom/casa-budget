import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (no 0/O/1/I)
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// The invite code IS the Firestore document id (not a separate field looked
// up via a collection query). That's what lets Firestore rules allow a plain
// `get` by exact id without ever allowing `list` on the collection — nobody
// can enumerate other households' codes, only look up one they already have.
// Dashboard.js already expects a household shaped like { id, name, code,
// memberEmails } (see HowToPage and the sidebar) — this just gives it real
// data instead of the old hardcoded stand-in.
export async function createHousehold(user, name) {
  let code = randomCode();
  // Astronomically unlikely to collide (32^6 combinations), but cheap to guard.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getDoc(doc(db, "budgetHouseholds", code));
    if (!existing.exists()) break;
    code = randomCode();
  }

  await setDoc(doc(db, "budgetHouseholds", code), {
    name: name?.trim() || "My Household",
    code,
    memberUids: [user.uid],
    memberEmails: [user.email],
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });
  await setDoc(doc(db, "users", user.uid), { householdId: code }, { merge: true });
  return code;
}

export async function joinHouseholdByCode(user, rawCode) {
  const code = rawCode.trim().toUpperCase();
  const ref = doc(db, "budgetHouseholds", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("No household found with that code.");

  const data = snap.data();
  if (!data.memberUids.includes(user.uid)) {
    // Plain array append (not arrayUnion) on purpose — the security rule
    // checks for an exact "old array + my uid appended" shape, which is a
    // simpler, Admin-SDK-free way to allow a non-member to join without
    // opening the door to arbitrary edits from non-members.
    await updateDoc(ref, {
      memberUids: [...data.memberUids, user.uid],
      memberEmails: [...data.memberEmails, user.email],
    });
  }
  await setDoc(doc(db, "users", user.uid), { householdId: code }, { merge: true });
  return code;
}

export async function getUserHouseholdId(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().householdId || null : null;
}

export async function getHousehold(householdId) {
  const snap = await getDoc(doc(db, "budgetHouseholds", householdId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
