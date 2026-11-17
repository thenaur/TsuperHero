// Saved progress: one Firestore document per user at users/{uid}.
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

export function defaultProfile(nickname) {
  return {
    nickname,
    levelsCompleted: 0,
    tutorialDone: false,
    endlessUnlocked: false,
    bestScore: { easy: 0, medium: 0, hard: 0 },
    stars: 0,
    unlocked: ["scenery1"],
    equipped: { scenery: "scenery1" },
  };
}

// Fills in any missing fields so older saves keep working as the profile grows.
function withDefaults(data, nickname) {
  const base = defaultProfile(nickname);
  return {
    ...base,
    ...data,
    bestScore: { ...base.bestScore, ...(data.bestScore || {}) },
    equipped: { ...base.equipped, ...(data.equipped || {}) },
  };
}

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
  return withDefaults(snap.data(), nickname);
}

// Call after a level, when Endless ends, on unlock, and on logout.
export async function saveProfile(uid, profile) {
  await setDoc(doc(db, "users", uid), profile);
}
