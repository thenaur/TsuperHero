// Pure rules for unlocking levels, stars, and customization. No Firebase, no DOM.
import { STAR_THRESHOLDS, CUSTOM, LEVEL_ORDER } from './data.js';

const clone = (p) => JSON.parse(JSON.stringify(p));
const ALL_ITEMS = Object.values(CUSTOM).flat();

export const starsFor = (score) => STAR_THRESHOLDS.filter((t) => score >= t).length;
export const itemsForStars = (stars) => ALL_ITEMS.filter((i) => i.stars <= stars).map((i) => i.id);

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
  const prevBest = p.bestScore[difficulty] || 0;
  p.bestScore[difficulty] = Math.max(prevBest, score);
  const best = Math.max(...Object.values(p.bestScore));
  p.stars = Math.max(starsBefore, starsFor(best));
  p.unlocked = [...new Set([...(p.unlocked || []), ...itemsForStars(p.stars)])];
  const newlyUnlocked = ALL_ITEMS.filter((i) => i.stars > starsBefore && i.stars <= p.stars);
  return { profile: p, newBest: score > prevBest, starsBefore, starsAfter: p.stars, newlyUnlocked };
}
