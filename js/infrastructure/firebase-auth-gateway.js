// Infrastructure Layer: AuthGateway adapter backed by Firebase Auth + offline localStorage fallback.
// Implements the AuthGateway port expected by js/application/auth-service.js.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { auth, isConfigured } from './firebase-config.js?v=1';

const EMAIL_DOMAIN = 'tsuperhero.app';
const PIN_PREFIX = 'tsuper-';
const LOCAL_ACCOUNTS_KEY = 'tsuperhero.localAccounts';
const ACTIVE_LOCAL_UID_KEY = 'tsuperhero.activeLocalUid';
const ADMIN_UID = 'local-admin-haljordangreenlantern';

const toEmail = (nick) => `${nick.toLowerCase()}@${EMAIL_DOMAIN}`;
const toPassword = (pin) => PIN_PREFIX + pin;

function isOfflineError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return !!(err && err.code === 'auth/network-request-failed');
}

function getLocalAccounts() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function setLocalAccounts(map) {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function createFirebaseAuthGateway() {
  return {
    isConfigured: () => isConfigured,
    isFileProtocol: () => typeof location !== 'undefined' && location.protocol === 'file:',

    async signUp(nick, pin, profileRepo) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, toEmail(nick), toPassword(pin));
        const profile = await profileRepo.createProfile(cred.user.uid, nick);
        return { uid: cred.user.uid, profile };
      } catch (err) {
        if (!isOfflineError(err)) {
          console.error('[auth] Firebase signUp failed:', err && err.code, err && err.message);
          throw err;
        }
        console.warn('[auth] Offline — creating local-only account fallback:', err && err.code);
        const key = nick.toLowerCase();
        const accounts = getLocalAccounts();
        if (accounts[key]) throw { code: 'auth/email-already-in-use' };
        const uid = `local-${key}`;
        const profile = await profileRepo.createProfile(uid, nick);
        accounts[key] = { uid, pin, nick };
        setLocalAccounts(accounts);
        try { sessionStorage.setItem(ACTIVE_LOCAL_UID_KEY, uid); } catch {}
        return { uid, profile, offline: true };
      }
    },

    async logInAdmin(allItemIds, profileRepo) {
      try { await signOut(auth); } catch {}
      const existing = await profileRepo.loadProfile(ADMIN_UID, 'Admin');
      const hasScore = Math.max(
        Number(existing?.bestScore?.easy) || 0,
        Number(existing?.bestScore?.medium) || 0,
        Number(existing?.bestScore?.hard) || 0
      );
      const adminProfile = {
        ...existing,
        nickname: 'Admin (Test)',
        isAdmin: true,
        tutorialDone: true,
        levelsCompleted: 3,
        endlessUnlocked: true,
        stars: 3,
        bestScore: hasScore > 0 ? existing.bestScore : { easy: 9999, medium: 9999, hard: 9999 },
        unlocked: hasScore > 0 ? existing.unlocked : allItemIds,
        equipped: { decor: null, interior: null, scenery: null, ...(existing?.equipped || {}) },
      };
      await profileRepo.saveProfile(ADMIN_UID, adminProfile);
      try { sessionStorage.setItem(ACTIVE_LOCAL_UID_KEY, ADMIN_UID); } catch {}
      return { uid: ADMIN_UID, profile: adminProfile, admin: true, offline: true };
    },

    async logIn(nick, pin, profileRepo) {
      try {
        const cred = await signInWithEmailAndPassword(auth, toEmail(nick), toPassword(pin));
        const profile = await profileRepo.loadProfile(cred.user.uid, nick);
        return { uid: cred.user.uid, profile };
      } catch (err) {
        if (!isOfflineError(err)) {
          console.error('[auth] Firebase logIn failed:', err && err.code, err && err.message);
          throw err;
        }
        console.warn('[auth] Offline — trying local account fallback:', err && err.code);
        const key = nick.toLowerCase();
        const accounts = getLocalAccounts();
        if (!accounts[key] || accounts[key].pin !== pin) throw err;
        const uid = accounts[key].uid;
        const profile = await profileRepo.loadProfile(uid, accounts[key].nick);
        try { sessionStorage.setItem(ACTIVE_LOCAL_UID_KEY, uid); } catch {}
        return { uid, profile, offline: true };
      }
    },

    async logOut(profile, profileRepo) {
      try {
        const localUid = sessionStorage.getItem(ACTIVE_LOCAL_UID_KEY);
        if (localUid && profile) await profileRepo.saveProfile(localUid, profile);
        sessionStorage.removeItem(ACTIVE_LOCAL_UID_KEY);
      } catch {}
      try {
        if (auth.currentUser && profile) await profileRepo.saveProfile(auth.currentUser.uid, profile);
      } catch (e) {
        console.warn('Could not save before logout:', e);
      }
      try {
        await signOut(auth);
      } catch {}
    },

    onSessionRestored(callback, profileRepo) {
      return onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const nick = (user.email || '').split('@')[0] || 'player';
            const profile = await profileRepo.loadProfile(user.uid, nick);
            callback({ uid: user.uid, profile });
          } catch (e) {
            console.warn('Could not restore session:', e);
          }
          return;
        }
        try {
          const localUid = sessionStorage.getItem(ACTIVE_LOCAL_UID_KEY);
          if (localUid) {
            const nick = localUid.replace(/^local-/, '') || 'player';
            const profile = await profileRepo.loadProfile(localUid, nick);
            callback({ uid: localUid, profile, offline: true });
          }
        } catch {}
      });
    },
  };
}
