// Pure rules for unlocking levels, stars, and customization. No Firebase, no DOM.
import { STAR_THRESHOLDS, CUSTOM, CUSTOM_CATEGORY_META, LEVEL_ORDER } from './data.js?v=28';

const clone = (p) => JSON.parse(JSON.stringify(p));
const ALL_ITEMS = Object.values(CUSTOM).flat();

export const starsFor = (score) => STAR_THRESHOLDS.filter((t) => score >= t).length;
export const itemsForStars = (stars) => ALL_ITEMS.filter((i) => i.stars <= stars).map((i) => i.id);

export function bestScoreFor(profile, difficulty) {
  return Math.max(0, Number(profile?.bestScore?.[difficulty]) || 0);
}

export function highestEndlessScore(profile) {
  return Math.max(
    bestScoreFor(profile, 'easy'),
    bestScoreFor(profile, 'medium'),
    bestScoreFor(profile, 'hard')
  );
}

// Tier 1 unlock: Category unlocks when reaching its unlockScore (1000 / 2500 / 5000)
// in ANY Endless difficulty (Easy, Medium, or Hard).
export function isCategoryUnlocked(profile, category) {
  const meta = CUSTOM_CATEGORY_META[category];
  if (!meta) return false;
  return highestEndlessScore(profile) >= meta.unlockScore;
}

// Tier 2 unlock: Each item requires BOTH its category to be unlocked (in any Endless difficulty)
// AND reaching item.minScore in that item's specific Endless difficulty (item.tier: easy / medium / hard).
export function getItemLockState(profile, item) {
  if (!item) {
    return {
      unlocked: false,
      categoryLocked: true,
      categoryRequiredScore: 0,
      requiredScore: 0,
      requiredDifficulty: null,
      currentDifficultyScore: 0,
    };
  }
  const meta = CUSTOM_CATEGORY_META[item.category];
  const categoryRequiredScore = meta ? meta.unlockScore : 0;
  const categoryUnlocked = isCategoryUnlocked(profile, item.category);
  const requiredDifficulty = item.tier || 'easy';
  const currentDifficultyScore = bestScoreFor(profile, requiredDifficulty);
  const difficultyMet = currentDifficultyScore >= item.minScore;
  return {
    unlocked: categoryUnlocked && difficultyMet,
    categoryLocked: !categoryUnlocked,
    categoryRequiredScore,
    requiredScore: item.minScore,
    requiredDifficulty,
    currentDifficultyScore,
  };
}

export function findCustomItem(category, itemId) {
  const list = CUSTOM[category];
  if (!list || !itemId) return null;
  return list.find((item) => item.id === itemId) || null;
}

export function isItemUnlocked(profile, item) {
  return getItemLockState(profile, item).unlocked;
}

export function itemsForProfile(profile) {
  return ALL_ITEMS.filter((i) => isItemUnlocked(profile, i)).map((i) => i.id);
}

export const itemsForScore = (score) =>
  itemsForProfile({ bestScore: { easy: score, medium: score, hard: score } });

export function equipCustomization(profile, category, itemId) {
  if (!CUSTOM[category]) throw new Error(`Unknown customization category: ${category}`);
  const p = clone(profile);
  p.equipped = { decor: null, interior: null, scenery: null, ...(p.equipped || {}) };

  if (itemId === null || itemId === undefined) {
    const changed = p.equipped[category] !== null;
    p.equipped[category] = null;
    return { profile: p, changed, locked: false, item: null };
  }

  const item = findCustomItem(category, itemId);
  if (!item) throw new Error(`Unknown item ${itemId} in category ${category}`);
  const lock = getItemLockState(p, item);
  if (!lock.unlocked) {
    return {
      profile: p,
      changed: false,
      locked: true,
      categoryLocked: lock.categoryLocked,
      categoryRequiredScore: lock.categoryRequiredScore,
      requiredScore: lock.requiredScore,
      requiredDifficulty: lock.requiredDifficulty,
      currentDifficultyScore: lock.currentDifficultyScore,
      item,
    };
  }

  const changed = p.equipped[category] !== item.id;
  p.equipped[category] = item.id;
  return { profile: p, changed, locked: false, item };
}

export function isUnlocked(profile, stageId) {
  if (stageId === 'tutorial' || stageId === 'level1') return true;
  if (stageId === 'level2') return profile.levelsCompleted >= 1;
  if (stageId === 'level3') return profile.levelsCompleted >= 2;
  if (stageId.startsWith('endless-')) return !!profile.endlessUnlocked;
  return false;
}

export function applyTutorialDone(profile) {
  const p = clone(profile);
  p.tutorialDone = true;
  return p;
}

export function applyLevelComplete(profile, levelIndex) {
  if (!(levelIndex >= 0 && levelIndex < LEVEL_ORDER.length)) throw new Error(`Bad level index ${levelIndex}`);
  const p = clone(profile);
  p.levelsCompleted = Math.max(p.levelsCompleted || 0, levelIndex + 1);
  if (p.levelsCompleted >= LEVEL_ORDER.length) p.endlessUnlocked = true;
  return p;
}

export function applyEndlessResult(profile, difficulty, score) {
  const p = clone(profile);
  p.bestScore = { easy: 0, medium: 0, hard: 0, ...(p.bestScore || {}) };
  const starsBefore = p.stars || 0;
  const unlockedBefore = new Set(itemsForProfile(p));
  const prevBest = bestScoreFor(p, difficulty);
  p.bestScore[difficulty] = Math.max(prevBest, score);
  const bestAfter = highestEndlessScore(p);
  p.stars = Math.max(starsBefore, starsFor(bestAfter));
  const unlockedAfterIds = itemsForProfile(p);
  const newlyUnlocked = ALL_ITEMS.filter(
    (i) => unlockedAfterIds.includes(i.id) && !unlockedBefore.has(i.id)
  );
  p.unlocked = unlockedAfterIds;
  return { profile: p, newBest: score > prevBest, starsBefore, starsAfter: p.stars, newlyUnlocked };
}
