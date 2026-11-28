// Presentation Layer: Customization screen UI controller.
// Depends ONLY on Domain rules, Presentation asset catalog, and injected callbacks/audio.
// Zero direct Infrastructure (Firebase/localStorage/WebAudio) imports.
import { CUSTOM, CUSTOM_CATEGORY_META } from '../domain/data.js?v=29';
import {
  highestEndlessScore,
  isCategoryUnlocked,
  getItemLockState,
  itemsForProfile,
  starsFor,
  isItemUnlocked,
  findCustomItem,
  equipCustomization,
} from '../domain/progress-rules.js?v=29';
import { CUSTOM_PREVIEW_NORMAL, LOCK_ICON_SRC, getCustomAssets } from './assets.js?v=1';

const $ = (id) => document.getElementById(id);
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

export function createCustomizeUI({ getSession, onProfileUpdated, onBack, showToast, audio }) {
  let activeCategory = 'decor';
  const playSfx = (name) => audio?.sfx?.(name);

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

    if (decorImg) {
      decorImg.hidden = true;
      decorImg.classList.remove('decor-dice', 'decor-freshener', 'decor-lily');
    }
    if (interiorImg) interiorImg.hidden = true;
    if (hudImg) hudImg.hidden = true;

    if (equippedCount === 0) {
      if (baseImg.getAttribute('src') !== CUSTOM_PREVIEW_NORMAL) baseImg.src = CUSTOM_PREVIEW_NORMAL;
      baseImg.alt = 'Normal In-Game Preview';
      return;
    }

    if (equippedCount === 1) {
      const only = eqDecor || eqInterior || eqScenery;
      const assets = getCustomAssets(only.id);
      if (assets.preview && baseImg.getAttribute('src') !== assets.preview) baseImg.src = assets.preview;
      baseImg.alt = `${only.name} In-Game Preview`;
      return;
    }

    const sceneryAssets = eqScenery ? getCustomAssets(eqScenery.id) : null;
    const baseSrc = sceneryAssets?.preview || CUSTOM_PREVIEW_NORMAL;
    if (baseImg.getAttribute('src') !== baseSrc) baseImg.src = baseSrc;

    if (eqDecor && decorImg) {
      const decorAssets = getCustomAssets(eqDecor.id);
      if (decorAssets.decorImg) {
        decorImg.src = decorAssets.decorImg;
        decorImg.alt = `${eqDecor.name} Decor`;
        decorImg.classList.add(eqDecor.id);
        decorImg.hidden = false;
      }
    }

    if (eqInterior && interiorImg) {
      const interiorAssets = getCustomAssets(eqInterior.id);
      if (interiorAssets.interiorImg) {
        interiorImg.src = interiorAssets.interiorImg;
        interiorImg.alt = `${eqInterior.name} Interior`;
        interiorImg.hidden = false;
        if (hudImg) hudImg.hidden = false;
      }
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
      const assets = getCustomAssets(item.id);

      const card = document.createElement('div');
      card.className = 'custom-card';
      if (!unlocked) card.classList.add('is-locked');
      if (equipped) card.classList.add('is-equipped');

      const box = document.createElement('div');
      box.className = 'custom-item-box';

      const icon = document.createElement('img');
      icon.className = 'custom-item-icon';
      icon.src = unlocked ? (assets.icon || LOCK_ICON_SRC) : LOCK_ICON_SRC;
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
          playSfx('wrong');
          showToast?.('Log in first to save your customizations!');
          return;
        }
        const curLock = getItemLockState(p, item);
        if (!curLock.unlocked) {
          playSfx('wrong');
          showToast?.(formatLockMessage(item, curLock));
          return;
        }

        const isCurrentlyEquipped = p.equipped?.[activeCategory] === item.id;
        const nextId = isCurrentlyEquipped ? null : item.id;
        const res = equipCustomization(p, activeCategory, nextId);
        if (res.locked) {
          playSfx('wrong');
          showToast?.(formatLockMessage(item, res));
          return;
        }

        playSfx('tap');
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
      playSfx('tap');
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
      playSfx('tap');
      activeCategory = cat;
      render();
    };
  }

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
