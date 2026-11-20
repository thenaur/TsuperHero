// Connects the game to the account. Works without internet or login (guest mode).
// Firebase is loaded with dynamic import(), so if it fails the game still runs.
import { defaultProfile } from '../profile.js';

const FIREBASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
const state = { uid: null, profile: defaultProfile('guest'), storage: null, error: null };

const timeout = (ms, what) => new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms));

export const getState = () => state;
export const getProfile = () => state.profile;

export async function init() {
  try {
    const cfg = await Promise.race([import('../firebase-config.js'), timeout(8000, 'Firebase load')]);
    if (!cfg.isConfigured) return state;
    const { onAuthStateChanged } = await import(FIREBASE + 'firebase-auth.js');
    const user = await new Promise((resolve) => {
      let done = false;
      const finish = (u) => { if (!done) { done = true; resolve(u); } };
      setTimeout(() => finish(null), 5000);
      const unsub = onAuthStateChanged(cfg.auth, (u) => { finish(u); setTimeout(() => unsub(), 0); });
    });
    if (!user) return state;
    const storage = await import('../storage.js');
    const nick = (user.email || '').split('@')[0] || 'player';
    const profile = await Promise.race([storage.loadProfile(user.uid, nick), timeout(8000, 'Profile load')]);
    // Only enable saving once the real profile has loaded, so a failed load can never
    // overwrite the player's saved progress with an empty profile.
    state.profile = profile;
    state.uid = user.uid;
    state.storage = storage;
  } catch (e) {
    console.warn('[progress] guest mode:', e);
    state.error = e;
    state.uid = null;
  }
  return state;
}

/** Updates the profile in memory right away, then tries to save it. Never throws. */
export async function save(profile) {
  state.profile = profile;
  if (!state.uid) return { saved: false, reason: 'guest' };
  try {
    await Promise.race([state.storage.saveProfile(state.uid, profile), timeout(8000, 'Save')]);
    return { saved: true };
  } catch (e) {
    console.warn('[progress] save failed:', e);
    return { saved: false, reason: 'offline' };
  }
}
