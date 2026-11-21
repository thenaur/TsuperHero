// Nickname + 4-digit PIN login on top of Firebase email/password auth.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-config.js";
import { createProfile, loadProfile, saveProfile } from "./storage.js";

const EMAIL_DOMAIN = "tsuperhero.app"; // placeholder; cannot receive mail
const PIN_PREFIX = "tsuper-"; // Firebase needs 6+ characters; "tsuper-1234" is 11
const LOCAL_ACCOUNTS_KEY = "tsuperhero.localAccounts";

export const NICKNAME_RULE = /^[A-Za-z0-9_]{3,12}$/;
export const PIN_RULE = /^\d{4}$/;

const toEmail = (nick) => `${nick.toLowerCase()}@${EMAIL_DOMAIN}`;
const toPassword = (pin) => PIN_PREFIX + pin;

function getLocalAccounts() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function setLocalAccounts(map) {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

// Returns an error message, or null when the input is fine.
export function validate(nick, pin) {
  if (!NICKNAME_RULE.test(nick)) return "Nickname must be 3-12 letters, numbers, or underscores.";
  if (!PIN_RULE.test(pin)) return "PIN must be exactly 4 digits.";
  return null;
}

// Turn Firebase error codes into messages a child can understand.
export function friendlyError(err) {
  switch (err && err.code) {
    case "auth/email-already-in-use":
      return "That nickname is already taken. Try another one.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Wrong nickname or PIN.";
    case "auth/network-request-failed":
      return "No internet connection. You can still play, but progress cannot be saved.";
    case "auth/too-many-requests":
      return "Too many tries. Please wait a moment and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// Each returns { uid, profile }. Falls back to local offline account if network/Firebase fails.
export async function signUp(nick, pin) {
  const problem = validate(nick, pin);
  if (problem) throw { code: "app/invalid-input", message: problem };
  try {
    const cred = await createUserWithEmailAndPassword(auth, toEmail(nick), toPassword(pin));
    const profile = await createProfile(cred.user.uid, nick);
    return { uid: cred.user.uid, profile };
  } catch (err) {
    // Only fall back to local storage if it is a network/server reachability error, not a duplicate nickname
    if (err && (err.code === "auth/email-already-in-use" || err.code === "app/invalid-input")) throw err;
    const key = nick.toLowerCase();
    const accounts = getLocalAccounts();
    if (accounts[key]) throw { code: "auth/email-already-in-use" };
    const uid = `local-${key}`;
    const profile = await createProfile(uid, nick);
    accounts[key] = { uid, pin, nick };
    setLocalAccounts(accounts);
    try { sessionStorage.setItem("tsuperhero.activeLocalUid", uid); } catch {}
    return { uid, profile, offline: true };
  }
}

export async function logIn(nick, pin) {
  const problem = validate(nick, pin);
  if (problem) throw { code: "app/invalid-input", message: problem };
  try {
    const cred = await signInWithEmailAndPassword(auth, toEmail(nick), toPassword(pin));
    const profile = await loadProfile(cred.user.uid, nick);
    return { uid: cred.user.uid, profile };
  } catch (err) {
    if (err && (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password")) {
      // Also check if this account was created in local fallback mode
      const key = nick.toLowerCase();
      const accounts = getLocalAccounts();
      if (accounts[key] && accounts[key].pin === pin) {
        const uid = accounts[key].uid;
        const profile = await loadProfile(uid, accounts[key].nick);
        try { sessionStorage.setItem("tsuperhero.activeLocalUid", uid); } catch {}
        return { uid, profile, offline: true };
      }
      throw err;
    }
    const key = nick.toLowerCase();
    const accounts = getLocalAccounts();
    if (!accounts[key] || accounts[key].pin !== pin) throw err;
    const uid = accounts[key].uid;
    const profile = await loadProfile(uid, accounts[key].nick);
    try { sessionStorage.setItem("tsuperhero.activeLocalUid", uid); } catch {}
    return { uid, profile, offline: true };
  }
}

// Saves first (spec: save on logout), then signs out. A failed save never blocks logout.
export async function logOut(profile) {
  try {
    const localUid = sessionStorage.getItem("tsuperhero.activeLocalUid");
    if (localUid && profile) await saveProfile(localUid, profile);
    sessionStorage.removeItem("tsuperhero.activeLocalUid");
  } catch {}
  try {
    if (auth.currentUser && profile) await saveProfile(auth.currentUser.uid, profile);
  } catch (e) {
    console.warn("Could not save before logout:", e);
  }
  try {
    await signOut(auth);
  } catch {}
}
