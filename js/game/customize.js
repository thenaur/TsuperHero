// Customization screen controller:
//   - Displays Endless Mode highest score (across Easy/Medium/Hard) in Gas.png LCD
//   - Switches between DECOR (GasButton1), INTERIOR (GasButton2), SCENERY (GasButton3)
//   - Renders 3 item cards (top-left, top-right, bottom-center) with Lock.png for locked items
//     and Equipped.png (EQUIP) / Unequipped.png (UNEQUIP) for unlocked items
//   - Swaps the left IN-GAME SCREEN preview between NormalPreview.png and the equipped item's preview
//   - Persists equipped selections to Firebase / localStorage via saveProfile
import { CUSTOM, CUSTOM_CATEGORY_META, CUSTOM_PREVIEW_NORMAL } from './data.js?v=28';
import {
  highestEndlessScore,
  isCategoryUnlocked,
  getItemLockState,
  itemsForProfile,
  starsFor,
  isItemUnlocked,
  findCustomItem,
  equipCustomization,
} from './progress-rules.js?v=28';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const LOCK_ICON_SRC = '../assets/Lock.png';
const TIER_SHORT = { easy: 'EASY', medium: 'MED', hard: 'HARD' };
const TIER_FULL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

function formatLockMessage(item, lock) {
  const catLabel = CUSTOM_CATEGORY_META[item.category]?.label || item.category.toUpperCase();
  const diffLabel = TIER_FULL[lock.requiredDifficulty] || 'Easy';
  if (lock.categoryLocked) {
    return `Unlock ${catLabel} at ${lock.categoryRequiredScore.toLocaleString()} in any Endless mode, then reach ${lock.requiredScore.toLocaleString()} in Endless ${diffLabel} for ${item.name}!`;
  }
  return `Reach ${lock.requiredScore.toLocaleString()} in Endless ${diffLabel} to unlock ${item.name}! (Your ${diffLabel} best: ${lock.currentDifficultyScore.toLocaleString()})`;
}

export function createCustomizeUI({ getSession, onProfileUpdated, onBack, showToast }) {
  let activeCategory = 'decor';

  function currentProfile() {
    return getSession()?.profile || null;
  }

  function resolveEquipped(profile, category) {
    const id = profile?.equipped?.[category] || null;
    const item = findCustomItem(category, id);
    return item && isItemUnlocked(profile, item) ? item : null;
  }

  function updatePreview(profile) {
    const baseImg = $('custom-preview-img');
    const decorImg = $('custom-preview-decor');
    const interiorImg = $('custom-preview-interior');
    const hudImg = $('custom-preview-hud');
    if (!baseImg) return;

    const eqDecor = resolveEquipped(profile, 'decor');
    const eqInterior = resolveEquipped(profile, 'interior');
    const eqScenery = resolveEquipped(profile, 'scenery');
    const equippedCount = (eqDecor ? 1 : 0) + (eqInterior ? 1 : 0) + (eqScenery ? 1 : 0);

    // Reset overlay layers by default
    if (decorImg) {
      decorImg.hidden = true;
      decorImg.classList.remove('decor-dice', 'decor-freshener', 'decor-lily');
    }
    if (interiorImg) interiorImg.hidden = true;
    if (hudImg) hudImg.hidden = true;

    // 0 equipped -> pure NormalPreview.png
    if (equippedCount === 0) {
      if (baseImg.getAttribute('src') !== CUSTOM_PREVIEW_NORMAL) baseImg.src = CUSTOM_PREVIEW_NORMAL;
      baseImg.alt = 'Normal In-Game Preview';
      return;
    }

    // Exactly 1 equipped -> show the artist's dedicated single-item preview PNG directly
    if (equippedCount === 1) {
      const only = eqDecor || eqInterior || eqScenery;
      if (baseImg.getAttribute('src') !== only.preview) baseImg.src = only.preview;
      baseImg.alt = `${only.name} In-Game Preview`;
      return;
    }

    // 2 or 3 categories equipped together -> composite all equipped layers live!
    const baseSrc = eqScenery ? eqScenery.preview : CUSTOM_PREVIEW_NORMAL;
    if (baseImg.getAttribute('src') !== baseSrc) baseImg.src = baseSrc;

    if (eqDecor && decorImg && eqDecor.decorImg) {
      decorImg.src = eqDecor.decorImg;
      decorImg.alt = `${eqDecor.name} Decor`;
      decorImg.classList.add(eqDecor.id);
      decorImg.hidden = false;
    }

    if (eqInterior && interiorImg && eqInterior.interiorImg) {
      interiorImg.src = eqInterior.interiorImg;
      interiorImg.alt = `${eqInterior.name} Interior`;
      interiorImg.hidden = false;
      if (hudImg) hudImg.hidden = false;
    }

    const names = [eqScenery?.name, eqInterior?.name, eqDecor?.name].filter(Boolean).join(' + ');
    baseImg.alt = `${names} Combined In-Game Preview`;
  }

  function renderTabs(profile) {
    for (const btn of document.querySelectorAll('#custom-tab-bar .gas-tab-btn')) {
      const cat = btn.dataset.cat;
      const meta = CUSTOM_CATEGORY_META[cat];
      const catUnlocked = isCategoryUnlocked(profile, cat);
      btn.classList.toggle('is-active', cat === activeCategory);
      btn.classList.toggle('is-cat-locked', !catUnlocked);
      btn.title = catUnlocked
        ? `${meta?.label || cat.toUpperCase()} (Unlocked)`
        : `${meta?.label || cat.toUpperCase()} — Reach ${(meta?.unlockScore || 0).toLocaleString()} in any Endless mode to unlock`;
    }
  }

  function renderCards(profile) {
    const grid = $('custom-items-grid');
    if (!grid) return;
    grid.replaceChildren();

    const items = CUSTOM[activeCategory] || [];
    const equippedId = profile?.equipped?.[activeCategory] || null;

    for (const item of items) {
      const lock = getItemLockState(profile, item);
      const unlocked = lock.unlocked;
      const equipped = unlocked && equippedId === item.id;
      const diffShort = TIER_SHORT[item.tier] || 'EASY';
      const diffFull = TIER_FULL[item.tier] || 'Easy';

      const card = document.createElement('div');
      card.className = 'custom-card';
      if (!unlocked) card.classList.add('is-locked');
      if (equipped) card.classList.add('is-equipped');

      const box = document.createElement('div');
      box.className = 'custom-item-box';

      const icon = document.createElement('img');
      icon.className = 'custom-item-icon';
      icon.src = unlocked ? item.icon : LOCK_ICON_SRC;
      icon.alt = unlocked ? item.name : `Locked (${item.minScore.toLocaleString()} in Endless ${diffFull})`;
      box.append(icon);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'custom-equip-btn';
      if (!unlocked) {
        btn.classList.add('state-locked');
        btn.textContent = `${item.minScore.toLocaleString()} ${diffShort}`;
        btn.title = formatLockMessage(item, lock);
      } else if (equipped) {
        btn.classList.add('state-unequip');
        btn.textContent = 'UNEQUIP';
        btn.title = `Unequip ${item.name}`;
      } else {
        btn.classList.add('state-equip');
        btn.textContent = 'EQUIP';
        btn.title = `Equip ${item.name}`;
      }

      const handleClick = async () => {
        const p = currentProfile();
        if (!p) {
          sfx('wrong');
          showToast?.('Log in first to save your customizations!');
          return;
        }
        const curLock = getItemLockState(p, item);
        if (!curLock.unlocked) {
          sfx('wrong');
          showToast?.(formatLockMessage(item, curLock));
          return;
        }

        const isCurrentlyEquipped = p.equipped?.[activeCategory] === item.id;
        const nextId = isCurrentlyEquipped ? null : item.id;
        const res = equipCustomization(p, activeCategory, nextId);
        if (res.locked) {
          sfx('wrong');
          showToast?.(formatLockMessage(item, res));
          return;
        }

        sfx('tap');
        await onProfileUpdated?.(res.profile);
        render();
      };

      card.onclick = handleClick;
      card.append(box, btn);
      grid.append(card);
    }
  }

  function render() {
    const profile = currentProfile();
    const highVal = $('custom-highscore-val');
    if (highVal) {
      highVal.textContent = String(highestEndlessScore(profile));
    }
    const adminBar = $('custom-admin-bar');
    if (adminBar) {
      adminBar.hidden = !profile?.isAdmin;
    }
    renderTabs(profile);
    renderCards(profile);
    updatePreview(profile);
  }

  // Bind Admin Test score preset buttons (only shown when profile.isAdmin === true)
  for (const chip of document.querySelectorAll('#custom-admin-bar [data-test-score]')) {
    chip.onclick = async () => {
      const p = currentProfile();
      if (!p || !p.isAdmin) return;
      const score = Number(chip.dataset.testScore) || 0;
      const next = JSON.parse(JSON.stringify(p));
      next.bestScore = { easy: score, medium: score, hard: score };
      next.stars = starsFor(score);
      next.unlocked = itemsForProfile(next);
      next.equipped = { decor: null, interior: null, scenery: null, ...(next.equipped || {}) };
      for (const cat of Object.keys(CUSTOM)) {
        const curItem = findCustomItem(cat, next.equipped[cat]);
        if (curItem && !isItemUnlocked(next, curItem)) {
          next.equipped[cat] = null;
        }
      }
      sfx('tap');
      await onProfileUpdated?.(next);
      showToast?.(`Admin Test: All Endless best scores set to ${score.toLocaleString()}`, true, 2200);
      render();
    };
  }

  // Bind category tab buttons
  for (const btn of document.querySelectorAll('#custom-tab-bar .gas-tab-btn')) {
    btn.onclick = () => {
      const cat = btn.dataset.cat;
      const p = currentProfile();
      if (!isCategoryUnlocked(p, cat)) {
        const meta = CUSTOM_CATEGORY_META[cat];
        showToast?.(
          `${meta?.label || cat.toUpperCase()} unlocks at ${(meta?.unlockScore || 0).toLocaleString()} in any Endless mode!`,
          false,
          3000
        );
      }
      if (cat === activeCategory) return;
      sfx('tap');
      activeCategory = cat;
      render();
    };
  }

  // Bind Back button
  const backBtn = $('btn-back-customize');
  if (backBtn) {
    backBtn.onclick = () => {
      onBack?.();
    };
  }

  return {
    open(category = 'decor') {
      if (CUSTOM[category]) activeCategory = category;
      render();
    },
    render,
  };
}
