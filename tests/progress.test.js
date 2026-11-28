import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile, normalizeProfile } from '../js/domain/profile.js';
import { CUSTOM, CUSTOM_CATEGORY_META } from '../js/domain/data.js';
import {
  starsFor,
  isUnlocked,
  bestScoreFor,
  highestEndlessScore,
  isCategoryUnlocked,
  getItemLockState,
  isItemUnlocked,
  itemsForProfile,
  findCustomItem,
  equipCustomization,
  applyLevelComplete,
  applyEndlessResult,
  applyTutorialDone,
} from '../js/domain/progress-rules.js';

test('stars at 1,000 / 2,500 / 5,000', () => {
  assert.equal(starsFor(999), 0);
  assert.equal(starsFor(1000), 1);
  assert.equal(starsFor(2500), 2);
  assert.equal(starsFor(5000), 3);
  assert.equal(starsFor(99999), 3);
});

test('customization items are ordered Easy -> Medium -> Hard with ascending scores in every category', () => {
  for (const [cat, items] of Object.entries(CUSTOM)) {
    assert.deepEqual(
      items.map((i) => i.tier),
      ['easy', 'medium', 'hard'],
      `${cat} items should be ordered easy -> medium -> hard`
    );
    for (let i = 1; i < items.length; i++) {
      assert.ok(
        items[i].minScore > items[i - 1].minScore,
        `${cat} minScore should strictly increase: ${items[i - 1].minScore} < ${items[i].minScore}`
      );
    }
  }
  assert.deepEqual(CUSTOM.decor.map((i) => i.id), ['decor-dice', 'decor-freshener', 'decor-lily']);
  assert.deepEqual(CUSTOM.interior.map((i) => i.id), ['interior-fiesta', 'interior-christmas', 'interior-newyear']);
  assert.deepEqual(CUSTOM.scenery.map((i) => i.id), ['scenery-morning', 'scenery-night', 'scenery-dawn']);
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

test('categories unlock at 1,000 / 2,500 / 5,000 in ANY Endless difficulty', () => {
  assert.equal(CUSTOM_CATEGORY_META.decor.unlockScore, 1000);
  assert.equal(CUSTOM_CATEGORY_META.interior.unlockScore, 2500);
  assert.equal(CUSTOM_CATEGORY_META.scenery.unlockScore, 5000);

  let p = defaultProfile('ana');
  assert.equal(isCategoryUnlocked(p, 'decor'), false);
  assert.equal(isCategoryUnlocked(p, 'interior'), false);
  assert.equal(isCategoryUnlocked(p, 'scenery'), false);

  // 1,000 in Hard unlocks Decor (any difficulty works)
  p = applyEndlessResult(p, 'hard', 1000).profile;
  assert.equal(isCategoryUnlocked(p, 'decor'), true);
  assert.equal(isCategoryUnlocked(p, 'interior'), false);
  assert.equal(isCategoryUnlocked(p, 'scenery'), false);

  // 2,500 in Medium unlocks Interior
  p = applyEndlessResult(p, 'medium', 2500).profile;
  assert.equal(isCategoryUnlocked(p, 'interior'), true);
  assert.equal(isCategoryUnlocked(p, 'scenery'), false);

  // 5,000 in Easy unlocks Scenery
  p = applyEndlessResult(p, 'easy', 5000).profile;
  assert.equal(isCategoryUnlocked(p, 'scenery'), true);
});

test('items require BOTH category unlock AND their specific Endless difficulty highscore', () => {
  // 5,000 in Easy unlocks all 3 categories AND only the 3 Easy-tier items
  let r = applyEndlessResult(defaultProfile('ana'), 'easy', 5000);
  assert.equal(highestEndlessScore(r.profile), 5000);
  assert.equal(bestScoreFor(r.profile, 'easy'), 5000);
  assert.equal(bestScoreFor(r.profile, 'medium'), 0);
  assert.equal(bestScoreFor(r.profile, 'hard'), 0);
  assert.equal(r.starsAfter, 3);
  assert.deepEqual(
    r.newlyUnlocked.map((i) => i.id),
    ['decor-dice', 'interior-fiesta', 'scenery-morning']
  );
  assert.equal(isItemUnlocked(r.profile, findCustomItem('decor', 'decor-freshener')), false);
  assert.equal(isItemUnlocked(r.profile, findCustomItem('decor', 'decor-lily')), false);
  assert.equal(isItemUnlocked(r.profile, findCustomItem('interior', 'interior-christmas')), false);
  assert.equal(isItemUnlocked(r.profile, findCustomItem('scenery', 'scenery-night')), false);

  // Reaching 3,500 in Medium unlocks Medium items up to 3,500 (Air Freshener + Christmas), NOT Night (6,000) or Hard items
  r = applyEndlessResult(r.profile, 'medium', 3500);
  assert.deepEqual(
    r.newlyUnlocked.map((i) => i.id),
    ['decor-freshener', 'interior-christmas']
  );
  assert.equal(isItemUnlocked(r.profile, findCustomItem('scenery', 'scenery-night')), false);
  assert.equal(isItemUnlocked(r.profile, findCustomItem('decor', 'decor-lily')), false);

  // Lower Medium score never lowers best score or unlocks anything new
  r = applyEndlessResult(r.profile, 'medium', 500);
  assert.equal(r.profile.bestScore.medium, 3500);
  assert.equal(r.newBest, false);
  assert.equal(r.newlyUnlocked.length, 0);

  // Reaching 2,000 in Hard (from fresh profile) unlocks Decor category + Lily ONLY (not Easy/Medium Decor items)
  const hardOnly = applyEndlessResult(defaultProfile('ben'), 'hard', 2000);
  assert.equal(isCategoryUnlocked(hardOnly.profile, 'decor'), true);
  assert.equal(isCategoryUnlocked(hardOnly.profile, 'interior'), false);
  assert.deepEqual(itemsForProfile(hardOnly.profile), ['decor-lily']);
  assert.equal(isItemUnlocked(hardOnly.profile, findCustomItem('decor', 'decor-dice')), false);
  assert.equal(isItemUnlocked(hardOnly.profile, findCustomItem('decor', 'decor-freshener')), false);
});

test('equipCustomization enforces category and difficulty locks, and allows equip/unequip', () => {
  let p = defaultProfile('ana');
  // Score 0 -> Interior Fiesta is category-locked
  const catLocked = equipCustomization(p, 'interior', 'interior-fiesta');
  assert.equal(catLocked.locked, true);
  assert.equal(catLocked.categoryLocked, true);
  assert.equal(catLocked.categoryRequiredScore, 2500);
  assert.equal(catLocked.requiredDifficulty, 'easy');
  assert.equal(catLocked.requiredScore, 2500);
  assert.equal(catLocked.profile.equipped.interior, null);

  // Reach 2,500 in Easy -> Decor & Interior categories unlocked; Fiesta unlocked; Christmas is difficulty-locked (Medium)
  p = applyEndlessResult(p, 'easy', 2500).profile;
  const diffLocked = equipCustomization(p, 'interior', 'interior-christmas');
  assert.equal(diffLocked.locked, true);
  assert.equal(diffLocked.categoryLocked, false);
  assert.equal(diffLocked.requiredDifficulty, 'medium');
  assert.equal(diffLocked.requiredScore, 3500);
  assert.equal(diffLocked.currentDifficultyScore, 0);

  // Fiesta (Easy 2,500) can be equipped and unequipped
  const equipRes = equipCustomization(p, 'interior', 'interior-fiesta');
  assert.equal(equipRes.locked, false);
  assert.equal(equipRes.changed, true);
  assert.equal(equipRes.profile.equipped.interior, 'interior-fiesta');

  const unequipRes = equipCustomization(equipRes.profile, 'interior', null);
  assert.equal(unequipRes.changed, true);
  assert.equal(unequipRes.profile.equipped.interior, null);

  // Even if an old save has stale item IDs in profile.unlocked, difficulty rules stay authoritative
  const stale = { ...p, unlocked: ['interior-christmas'] };
  assert.equal(getItemLockState(stale, findCustomItem('interior', 'interior-christmas')).unlocked, false);
});

test('old saves missing fields are filled in', () => {
  const p = normalizeProfile({ nickname: 'ana', levelsCompleted: 2, bestScore: { easy: 10 } }, 'ana');
  assert.equal(p.levelsCompleted, 2);
  assert.deepEqual(p.bestScore, { easy: 10, medium: 0, hard: 0 });
  assert.equal(p.tutorialDone, false);
  assert.deepEqual(p.unlocked, []);
  assert.deepEqual(p.equipped, { decor: null, interior: null, scenery: null });
});
