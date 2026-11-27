import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile, normalizeProfile } from '../js/profile.js';
import {
  starsFor,
  isUnlocked,
  highestEndlessScore,
  isItemUnlocked,
  findCustomItem,
  equipCustomization,
  applyLevelComplete,
  applyEndlessResult,
  applyTutorialDone,
} from '../js/game/progress-rules.js';

test('stars at 1,000 / 2,500 / 5,000', () => {
  assert.equal(starsFor(999), 0);
  assert.equal(starsFor(1000), 1);
  assert.equal(starsFor(2500), 2);
  assert.equal(starsFor(5000), 3);
  assert.equal(starsFor(99999), 3);
});

test('levels unlock in order and Endless unlocks after Level 3', () => {
  let p = defaultProfile('ana');
  assert.ok(isUnlocked(p, 'level1'));
  assert.ok(!isUnlocked(p, 'level2'));
  assert.ok(!isUnlocked(p, 'endless-easy'));
  p = applyLevelComplete(p, 0);
  assert.ok(isUnlocked(p, 'level2'));
  p = applyLevelComplete(p, 1);
  p = applyLevelComplete(p, 2);
  assert.equal(p.levelsCompleted, 3);
  assert.ok(p.endlessUnlocked);
  assert.ok(isUnlocked(p, 'endless-hard'));
  // replaying an earlier level never lowers progress
  p = applyLevelComplete(p, 0);
  assert.equal(p.levelsCompleted, 3);
});

test('rules never modify the original profile', () => {
  const p = defaultProfile('ana');
  applyTutorialDone(p);
  applyLevelComplete(p, 2);
  applyEndlessResult(p, 'easy', 6000);
  assert.deepEqual(p, defaultProfile('ana'));
});

test('Endless result: best score only goes up, stars and customization unlocks are earned by highscore', () => {
  let r = applyEndlessResult(defaultProfile('ana'), 'easy', 1000);
  assert.equal(highestEndlessScore(r.profile), 1000);
  assert.equal(r.starsAfter, 1);
  assert.deepEqual(r.newlyUnlocked.map((i) => i.id), ['decor-dice']);

  r = applyEndlessResult(r.profile, 'medium', 2600);
  assert.equal(highestEndlessScore(r.profile), 2600);
  assert.equal(r.starsAfter, 2);
  assert.equal(r.newBest, true);
  assert.deepEqual(
    r.newlyUnlocked.map((i) => i.id).sort(),
    ['decor-freshener', 'decor-lily', 'interior-fiesta']
  );

  r = applyEndlessResult(r.profile, 'medium', 500);
  assert.equal(r.profile.bestScore.medium, 2600);
  assert.equal(r.newBest, false);
  assert.equal(r.starsAfter, 2);
  assert.equal(r.newlyUnlocked.length, 0);
});

test('equipCustomization unlocks by highscore, allows equip/unequip, and blocks locked items', () => {
  let p = defaultProfile('ana');
  // Score 0 -> Fuzzy Dice is locked
  const lockedRes = equipCustomization(p, 'decor', 'decor-dice');
  assert.equal(lockedRes.locked, true);
  assert.equal(lockedRes.changed, false);
  assert.equal(lockedRes.requiredScore, 1000);
  assert.equal(lockedRes.profile.equipped.decor, null);

  // Reach 1,000 in Endless -> Fuzzy Dice unlocks, Air Freshener still locked
  p = applyEndlessResult(p, 'easy', 1000).profile;
  assert.equal(isItemUnlocked(p, findCustomItem('decor', 'decor-dice')), true);
  assert.equal(isItemUnlocked(p, findCustomItem('decor', 'decor-freshener')), false);

  const equipRes = equipCustomization(p, 'decor', 'decor-dice');
  assert.equal(equipRes.locked, false);
  assert.equal(equipRes.changed, true);
  assert.equal(equipRes.profile.equipped.decor, 'decor-dice');

  // Unequip back to default
  const unequipRes = equipCustomization(equipRes.profile, 'decor', null);
  assert.equal(unequipRes.changed, true);
  assert.equal(unequipRes.profile.equipped.decor, null);
});

test('old saves missing fields are filled in', () => {
  const p = normalizeProfile({ nickname: 'ana', levelsCompleted: 2, bestScore: { easy: 10 } }, 'ana');
  assert.equal(p.levelsCompleted, 2);
  assert.deepEqual(p.bestScore, { easy: 10, medium: 0, hard: 0 });
  assert.equal(p.tutorialDone, false);
  assert.deepEqual(p.unlocked, []);
  assert.deepEqual(p.equipped, { decor: null, interior: null, scenery: null });
});
