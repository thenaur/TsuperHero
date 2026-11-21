// Saved progress: one Firestore document per user at users/{uid},
// mirrored in localStorage so offline / Firestore rule failures never crash the game.
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { defaultProfile, normalizeProfile } from "./profile.js";

export { defaultProfile };

const cacheKey = (uid) => `tsuperhero.profile.${uid}`;

function readLocalCache(uid) {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalCache(uid, profile) {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify(profile));
  } catch { /* ignore */ }
}

// Create the starting document for a brand-new account.
export async function createProfile(uid, nickname) {
  const profile = defaultProfile(nickname);
  writeLocalCache(uid, profile);
  if (!String(uid).startsWith("local-")) {
    try {
      await setDoc(doc(db, "users", uid), profile);
    } catch (e) {
      console.warn("[storage] Cloud create skipped (saved locally):", e);
    }
  }
  return profile;
}

// Load once after login. Creates the document if it is somehow missing.
export async function loadProfile(uid, nickname) {
  const cached = readLocalCache(uid);
  if (!String(uid).startsWith("local-")) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const merged = normalizeProfile(snap.data(), nickname);
        writeLocalCache(uid, merged);
        return merged;
      }
      if (cached) {
        const merged = normalizeProfile(cached, nickname);
        try { await setDoc(doc(db, "users", uid), merged); } catch {}
        return merged;
      }
      return createProfile(uid, nickname);
    } catch (e) {
      console.warn("[storage] Cloud load failed, using local cache:", e);
    }
  }
  if (cached) return normalizeProfile(cached, nickname);
  return createProfile(uid, nickname);
}

// Call after a level, when Endless ends, on unlock, and on logout.
export async function saveProfile(uid, profile) {
  writeLocalCache(uid, profile);
  if (!String(uid).startsWith("local-")) {
    await setDoc(doc(db, "users", uid), profile);
  }
}
