// Pure rules for unlocking levels, stars, and customization. No Firebase, no DOM.
import { STAR_THRESHOLDS, CUSTOM, LEVEL_ORDER } from './data.js?v=27';

const clone = (p) => JSON.parse(JSON.stringify(p));
const ALL_ITEMS = Object.values(CUSTOM).flat();

export const starsFor = (score) => STAR_THRESHOLDS.filter((t) => score >= t).length;
export const itemsForStars = (stars) => ALL_ITEMS.filter((i) => i.stars <= stars).map((i) => i.id);
export const itemsForScore = (score) => ALL_ITEMS.filter((i) => score >= i.minScore).map((i) => i.id);

export function highestEndlessScore(profile) {
  const bs = profile?.bestScore || {};
  return Math.max(0, Number(bs.easy) || 0, Number(bs.medium) || 0, Number(bs.hard) || 0);
}

export function findCustomItem(category, itemId) {
  const list = CUSTOM[category];
  if (!list || !itemId) return null;
  return list.find((item) => item.id === itemId) || null;
}

export function isItemUnlocked(profile, item) {
  if (!item) return false;
  const best = highestEndlessScore(profile);
  if (best >= item.minScore) return true;
  return Array.isArray(profile?.unlocked) && profile.unlocked.includes(item.id);
}

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
  if (!isItemUnlocked(p, item)) {
    return { profile: p, changed: false, locked: true, requiredScore: item.minScore, item };
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
  const starsBefore = p.stars || 0;
  const bestBefore = highestEndlessScore(p);
  const prevBest = p.bestScore[difficulty] || 0;
  p.bestScore[difficulty] = Math.max(prevBest, score);
  const bestAfter = highestEndlessScore(p);
  p.stars = Math.max(starsBefore, starsFor(bestAfter));
  const unlockedBefore = new Set(p.unlocked || []);
  const newlyUnlocked = ALL_ITEMS.filter(
    (i) => i.minScore <= bestAfter && (i.minScore > bestBefore || !unlockedBefore.has(i.id))
  );
  p.unlocked = [...new Set([...unlockedBefore, ...itemsForScore(bestAfter)])];
  return { profile: p, newBest: score > prevBest, starsBefore, starsAfter: p.stars, newlyUnlocked };
}
