// Presentation Layer: Menu, Auth, Gamemode, Settings & Customize navigation controller.
// Depends ONLY on Domain/Presentation modules and injected Application services / ports.
// Zero direct Firebase, Firestore, localStorage, or WebAudio imports.
import { VERSION } from '../domain/data.js?v=29';
import { fitStage } from './layout.js?v=9';
import { createCustomizeUI } from './customize.js?v=6';

const $ = (id) => document.getElementById(id);
const SECTIONS = ['sec-startup', 'sec-login', 'sec-signup', 'sec-mainmenu', 'sec-gamemode', 'sec-customize'];
const LEVEL_STAGES = ['tutorial', 'level1', 'level2', 'level3'];
const DIFF_KEYS = ['easy', 'medium', 'hard'];
const DIFF_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function startMenuController({ authService, settingsStore, audio }) {
  let session = null; // { uid, profile }
  let toastTimer = null;
  let selectedLevel = 0; // 0 = Tutorial, 1 = Level 1, 2 = Level 2, 3 = Level 3
  let diffIndex = 0; // 0 = Easy, 1 = Medium, 2 = Hard
  const settings = settingsStore.load();
  audio.setSettings(settings);

  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('resize', fitStage);
  fitStage();

  function showToast(text, ok = false, duration = 3500) {
    const t = $('status-toast');
    clearTimeout(toastTimer);
    if (!text) {
      t.hidden = true;
      return;
    }
    t.textContent = text;
    t.className = ok ? 'ok' : '';
    t.hidden = false;
    if (duration > 0) {
      toastTimer = setTimeout(() => { t.hidden = true; }, duration);
    }
  }

  function getMaxUnlockedLevel(profile) {
    if (!profile) return 1;
    if (!profile.tutorialDone && (profile.levelsCompleted || 0) === 0) return 0;
    return Math.min(3, (profile.levelsCompleted || 0) + 1);
  }

  function syncGamemodeUI() {
    const p = session?.profile;
    const endlessUnlocked = !!(p && (p.endlessUnlocked || (p.levelsCompleted || 0) >= 3));

    $('lbl-current-level').textContent = `Current Level: ${selectedLevel}`;
    const dKey = DIFF_KEYS[diffIndex];
    $('lbl-difficulty').textContent = `Difficulty: ${DIFF_LABELS[dKey]}`;

    const endlessBtn = $('btn-mode-endless');
    const lockIcon = $('endless-lock-icon');
    const diffBtn = $('btn-diff-select');
    const endlessLbl = $('lbl-endless');

    if (endlessUnlocked) {
      endlessBtn.classList.remove('is-locked');
      endlessLbl.textContent = 'Endless';
      lockIcon.hidden = true;
      diffBtn.hidden = false;
    } else {
      endlessBtn.classList.add('is-locked');
      endlessLbl.textContent = '';
      lockIcon.hidden = false;
      diffBtn.hidden = true;
    }
  }

  function showSection(sectionId) {
    audio.sfx('tap');
    showToast('');
    for (const id of SECTIONS) {
      $(id).hidden = id !== sectionId;
    }
    document.body.classList.toggle('bg-gamemode', sectionId === 'sec-gamemode');
    document.body.classList.toggle('bg-customize', sectionId === 'sec-customize');

    if (sectionId === 'sec-mainmenu' && session?.profile) {
      $('player-label').textContent = `Player: ${session.profile.nickname}`;
    }
  }

  function enterGamemodeSection() {
    const p = session?.profile;
    selectedLevel = getMaxUnlockedLevel(p);
    syncGamemodeUI();
    showSection('sec-gamemode');
  }

  const customizeUI = createCustomizeUI({
    getSession: () => session,
    onProfileUpdated: async (updatedProfile) => {
      if (!session) return;
      session.profile = updatedProfile;
      try {
        await authService.saveProfile(session.uid, updatedProfile);
      } catch (err) {
        console.warn('Could not save customization online:', err);
      }
    },
    onBack: () => showSection('sec-mainmenu'),
    showToast,
    audio,
  });

  function enterCustomizeSection() {
    customizeUI.open('decor');
    showSection('sec-customize');
  }

  // Section 1 -> Section 2 or 3
  $('btn-go-login').onclick = () => {
    $('form-login').reset();
    showSection('sec-login');
  };
  $('btn-go-signup').onclick = () => {
    $('form-signup').reset();
    showSection('sec-signup');
  };

  // Back buttons
  $('btn-back-login').onclick = () => showSection('sec-startup');
  $('btn-back-signup').onclick = () => showSection('sec-startup');
  $('btn-back-gamemode').onclick = () => showSection('sec-mainmenu');

  // Section 2: Log-In Submit -> Section 4 (Main Menu)
  $('form-login').onsubmit = async (e) => {
    e.preventDefault();
    audio.sfx('tap');
    if (!authService.isConfigured()) {
      return showToast('Add your Firebase config in js/infrastructure/firebase-config.js first.');
    }
    const nick = $('login-nick').value.trim();
    const pin = $('login-pin').value;
    $('btn-login-submit').disabled = true;
    showToast('Logging in...', true, 0);
    try {
      session = await authService.logIn(nick, pin);
      showSection('sec-mainmenu');
      if (session?.admin) {
        showToast('Admin Test Mode active — all levels & cosmetics unlocked!', true, 4000);
      }
    } catch (err) {
      audio.sfx('wrong');
      showToast(err.code === 'app/invalid-input' ? err.message : authService.friendlyError(err));
    } finally {
      $('btn-login-submit').disabled = false;
    }
  };

  // Section 3: Sign-Up Submit (with Confirm PIN check) -> Section 4 (Main Menu)
  $('form-signup').onsubmit = async (e) => {
    e.preventDefault();
    audio.sfx('tap');
    if (!authService.isConfigured()) {
      return showToast('Add your Firebase config in js/infrastructure/firebase-config.js first.');
    }
    const nick = $('signup-nick').value.trim();
    const pin1 = $('signup-pin1').value;
    const pin2 = $('signup-pin2').value;
    if (pin1 !== pin2) {
      audio.sfx('wrong');
      return showToast('PINs do not match. Please check your 4-Digit PIN.');
    }
    $('btn-signup-submit').disabled = true;
    showToast('Creating account...', true, 0);
    try {
      session = await authService.signUp(nick, pin1);
      showSection('sec-mainmenu');
    } catch (err) {
      audio.sfx('wrong');
      showToast(err.code === 'app/invalid-input' ? err.message : authService.friendlyError(err));
    } finally {
      $('btn-signup-submit').disabled = false;
    }
  };

  // Section 4: Main Menu Actions
  $('btn-menu-play').onclick = () => enterGamemodeSection();

  $('btn-menu-settings').onclick = () => {
    audio.sfx('tap');
    $('modal-settings').hidden = false;
  };
  $('btn-close-settings').onclick = () => {
    audio.sfx('tap');
    $('modal-settings').hidden = true;
  };

  $('btn-menu-customize').onclick = () => enterCustomizeSection();

  $('btn-menu-logout').onclick = async () => {
    audio.sfx('tap');
    await authService.logOut(session && session.profile);
    session = null;
    showSection('sec-startup');
    showToast('Logged out.', true);
  };

  // Section 5: Choose Gamemode Actions
  $('btn-level-select').onclick = () => {
    audio.sfx('tap');
    const maxLvl = getMaxUnlockedLevel(session?.profile);
    selectedLevel = (selectedLevel + 1) % (maxLvl + 1);
    syncGamemodeUI();
  };

  $('btn-mode-normal').onclick = () => {
    audio.sfx('tap');
    const stageId = LEVEL_STAGES[selectedLevel] || 'tutorial';
    location.href = `./game.html?stage=${stageId}`;
  };

  $('btn-diff-select').onclick = () => {
    audio.sfx('tap');
    diffIndex = (diffIndex + 1) % DIFF_KEYS.length;
    syncGamemodeUI();
  };

  $('btn-mode-endless').onclick = () => {
    const p = session?.profile;
    const endlessUnlocked = !!(p && (p.endlessUnlocked || (p.levelsCompleted || 0) >= 3));
    if (!endlessUnlocked) {
      audio.sfx('wrong');
      showToast('Complete all 3 levels in Normal Mode to unlock Endless Mode!');
      return;
    }
    audio.sfx('tap');
    const dKey = DIFF_KEYS[diffIndex];
    location.href = `./game.html?stage=endless-${dKey}`;
  };

  // Settings bindings
  $('opt-volume').value = Math.round(settings.volume * 100);
  $('opt-sfx').checked = !!settings.sfx;
  $('version-text').textContent = `v${VERSION}`;

  $('opt-volume').oninput = (e) => {
    settings.volume = Number(e.target.value) / 100;
    audio.setSettings(settings);
    settingsStore.save(settings);
  };
  $('opt-sfx').onchange = (e) => {
    settings.sfx = e.target.checked;
    audio.setSettings(settings);
    settingsStore.save(settings);
    if (settings.sfx) audio.sfx('tap');
  };

  // Restore session when returning from game.html while already logged in
  const urlSection = new URLSearchParams(location.search).get('section');
  authService.onSessionRestored((restored) => {
    if (session || !restored) return;
    session = restored;
    if (urlSection === 'gamemode') enterGamemodeSection();
    else if (urlSection === 'customize') enterCustomizeSection();
    else if (urlSection === 'menu') showSection('sec-mainmenu');
  });
}
