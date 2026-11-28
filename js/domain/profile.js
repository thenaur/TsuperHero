// Domain Layer: Player Profile entity & normalization.
// Zero external dependencies (no DOM, no Firebase, no storage).

export function defaultProfile(nickname) {
  return {
    nickname,
    levelsCompleted: 0,
    tutorialDone: false,
    endlessUnlocked: false,
    bestScore: { easy: 0, medium: 0, hard: 0 },
    stars: 0,
    unlocked: [],
    equipped: { decor: null, interior: null, scenery: null },
  };
}

// Fills in any missing fields so older saves keep working as the profile grows.
export function normalizeProfile(data, nickname) {
  const base = defaultProfile(nickname);
  return {
    ...base,
    ...data,
    bestScore: { ...base.bestScore, ...(data?.bestScore || {}) },
    equipped: { ...base.equipped, ...(data?.equipped || {}) },
    unlocked: Array.isArray(data?.unlocked) ? data.unlocked : base.unlocked,
  };
}
