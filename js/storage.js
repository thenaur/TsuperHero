// Saved progress: one Firestore document per user at users/{uid}.
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { defaultProfile, normalizeProfile } from "./profile.js";

export { defaultProfile };

// Create the starting document for a brand-new account.
export async function createProfile(uid, nickname) {
  const profile = defaultProfile(nickname);
  await setDoc(doc(db, "users", uid), profile);
  return profile;
}

// Load once after login. Creates the document if it is somehow missing.
export async function loadProfile(uid, nickname) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return createProfile(uid, nickname);
  return normalizeProfile(snap.data(), nickname);
}

// Call after a level, when Endless ends, on unlock, and on logout.
export async function saveProfile(uid, profile) {
  await setDoc(doc(db, "users", uid), profile);
}
