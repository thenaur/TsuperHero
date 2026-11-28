// Infrastructure Layer: Resilient SessionGateway adapter for gameplay.
// Loads Firebase dynamically with a timeout so offline / unconfigured environments
// fall back cleanly to Guest Mode (or active local session) without blocking play.
import { defaultProfile } from '../domain/profile.js?v=1';

const FIREBASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
const ACTIVE_LOCAL_UID_KEY = 'tsuperhero.activeLocalUid';

const timeout = (ms, what) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms));

export function createFirebaseSessionGateway() {
  let profileRepo = null;

  async function loadSession() {
    try {
      const cfg = await Promise.race([
        import('./firebase-config.js?v=1'),
        timeout(8000, 'Firebase load'),
      ]);
      if (!cfg.isConfigured) {
        return { uid: null, profile: defaultProfile('guest'), error: null };
      }

      const { onAuthStateChanged } = await import(FIREBASE + 'firebase-auth.js');
      const user = await new Promise((resolve) => {
        let done = false;
        const finish = (u) => { if (!done) { done = true; resolve(u); } };
        setTimeout(() => finish(null), 5000);
        const unsub = onAuthStateChanged(cfg.auth, (u) => { finish(u); setTimeout(() => unsub(), 0); });
      });

      const repoMod = await import('./firebase-profile-repo.js?v=1');
      profileRepo = repoMod.createFirebaseProfileRepo();

      if (!user) {
        const localUid = sessionStorage.getItem(ACTIVE_LOCAL_UID_KEY);
        if (localUid) {
          const nick = localUid.replace(/^local-/, '') || 'player';
          const profile = await profileRepo.loadProfile(localUid, nick);
          return { uid: localUid, profile, error: null };
        }
        return { uid: null, profile: defaultProfile('guest'), error: null };
      }

      const nick = (user.email || '').split('@')[0] || 'player';
      const profile = await Promise.race([
        profileRepo.loadProfile(user.uid, nick),
        timeout(8000, 'Profile load'),
      ]);
      return { uid: user.uid, profile, error: null };
    } catch (e) {
      console.warn('[session-gateway] guest mode:', e);
      return { uid: null, profile: defaultProfile('guest'), error: e };
    }
  }

  async function saveProfile(uid, profile) {
    if (!profileRepo) {
      const repoMod = await import('./firebase-profile-repo.js?v=1');
      profileRepo = repoMod.createFirebaseProfileRepo();
    }
    await Promise.race([
      profileRepo.saveProfile(uid, profile),
      timeout(8000, 'Save'),
    ]);
  }

  return { loadSession, saveProfile };
}
