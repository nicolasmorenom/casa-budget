import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createHousehold(user, name) {
  let code = randomCode();
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
