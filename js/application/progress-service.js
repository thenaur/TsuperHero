// Application Layer: Player progress use-case service.
// Depends ONLY on the Domain ring and an injected SessionGateway port:
//   sessionGateway = {
//     loadSession(): Promise<{ uid: string | null, profile: object, error?: Error | null }>,
//     saveProfile(uid: string, profile: object): Promise<void>,
//   }
// Zero Firebase, zero DOM, zero localStorage imports.
import { defaultProfile } from '../domain/profile.js?v=1';
import {
  applyTutorialDone,
  applyLevelComplete,
  applyEndlessResult,
  equipCustomization,
} from '../domain/progress-rules.js?v=29';

export function createProgressService(sessionGateway) {
  const state = {
    uid: null,
    profile: defaultProfile('guest'),
    error: null,
  };

  const getState = () => state;
  const getProfile = () => state.profile;

  async function init() {
    if (!sessionGateway?.loadSession) return state;
    try {
      const loaded = await sessionGateway.loadSession();
      if (loaded?.uid && loaded?.profile) {
        state.uid = loaded.uid;
        state.profile = loaded.profile;
        state.error = loaded.error || null;
      } else {
        state.uid = null;
        state.profile = loaded?.profile || defaultProfile('guest');
        state.error = loaded?.error || null;
      }
    } catch (e) {
      state.uid = null;
      state.error = e;
    }
    return state;
  }

  /** Updates in-memory profile immediately, then persists via the injected port. Never throws. */
  async function save(profile) {
    state.profile = profile;
    if (!state.uid || !sessionGateway?.saveProfile) {
      return { saved: false, reason: 'guest' };
    }
    try {
      await sessionGateway.saveProfile(state.uid, profile);
      return { saved: true };
    } catch (e) {
      return { saved: false, reason: 'offline', error: e };
    }
  }

  async function completeTutorial() {
    const updated = applyTutorialDone(state.profile);
    const persist = await save(updated);
    return { profile: updated, persist };
  }

  async function completeLevel(levelIndex) {
    const updated = applyLevelComplete(state.profile, levelIndex);
    const persist = await save(updated);
    return { profile: updated, persist };
  }

  async function recordEndlessRun(difficulty, score) {
    const result = applyEndlessResult(state.profile, difficulty, score);
    const persist = await save(result.profile);
    return { ...result, persist };
  }

  async function equipItem(category, itemId) {
    const result = equipCustomization(state.profile, category, itemId);
    if (!result.locked && result.changed) {
      const persist = await save(result.profile);
      return { ...result, persist };
    }
    return { ...result, persist: { saved: false, reason: result.locked ? 'locked' : 'unchanged' } };
  }

  return {
    init,
    getState,
    getProfile,
    save,
    completeTutorial,
    completeLevel,
    recordEndlessRun,
    equipItem,
  };
}
