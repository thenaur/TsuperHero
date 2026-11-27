// Main controller for gameplay: supports Level 0 (Tutorial), Levels 1–3, and Endless (Easy/Medium/Hard).
import { STAGES, LEVEL_ORDER, VERSION, getStage } from './data.js?v=23';
import { fitStage } from './layout.js?v=8';
import { Emitter } from './emitter.js?v=8';
import { Play, setAnimationsFrozen } from './play.js?v=27';
import { TutorialGuide } from './tutorial.js?v=21';
import { unlock, setSettings, sfx } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';
import { init as initProgress, save as saveProgress, getProfile, getState } from './progress.js';
import { applyTutorialDone, applyLevelComplete, applyEndlessResult } from './progress-rules.js';

const $ = (id) => document.getElementById(id);

let currentPlay = null;
let currentGuide = null;
let settings = loadSettings();
setSettings(settings);

// Unlock Web Audio on first user interaction
window.addEventListener('pointerdown', () => unlock(), { once: true });
window.addEventListener('resize', fitStage);
fitStage();

function startStage(stageId) {
  if (currentGuide) { currentGuide.stop(); currentGuide = null; }
  if (currentPlay) { currentPlay.destroy(); currentPlay = null; }

  $('modal-postgame').hidden = true;
  $('modal-menu').hidden = true;
  setAnimationsFrozen(false);

  let stage;
  try {
    stage = getStage(stageId);
  } catch {
    stage = STAGES.tutorial;
  }
  const bus = new Emitter();

  // keep switcher button active state synced
  for (const b of document.querySelectorAll('[data-start-stage]')) {
    b.classList.toggle('active', b.dataset.startStage === stage.id);
  }
  const restartBtn = $('menu-restart-stage');
  if (restartBtn) {
    restartBtn.dataset.startStage = stage.id;
    const label = `Restart ${stage.name}`;
    restartBtn.title = label;
    restartBtn.setAttribute('aria-label', label);
  }

  currentPlay = new Play(stage, {
    bus,
    onEnd: (summary) => handleStageEnd(summary),
  });
  currentPlay.start();

  if (stage.id === 'tutorial') {
    currentGuide = new TutorialGuide(currentPlay, bus, {
      onSkip: () => handleStageEnd({ stageId: 'tutorial', outcome: 'complete', skipped: true }),
    });
    currentGuide.start();
  }
}

async function handleStageEnd(summary) {
  if (currentGuide) { currentGuide.stop(); currentGuide = null; }

  const title = $('pg-title');
  const body = $('pg-body');
  const stats = $('pg-stats');
  const primary = $('pg-primary');

  if (summary.stageId === 'tutorial') {
    const updated = applyTutorialDone(getProfile());
    await saveProgress(updated);
    title.textContent = "You're Ready!";
    body.textContent = 'Tutorial (Level 0) complete! You now know how to read the Taripa, give exact change, protect your hearts, and follow the route progress bar.';
    stats.hidden = true;
    primary.textContent = 'Start Level 1';
    primary.onclick = () => startStage('level1');
  } else if (summary.stageId.startsWith('endless-')) {
    const diff = summary.stageId.slice(8);
    const res = applyEndlessResult(getProfile(), diff, summary.score);
    await saveProgress(res.profile);
    title.textContent = 'Game Over (Endless Mode)';
    const dayText = `Reached Day ${summary.day || 1}`;
    body.textContent = `${dayText} • Stars Earned: ★ ${res.starsAfter} / 3${res.newBest ? ' (New High Score!)' : ''}`;
    stats.hidden = false;
    $('pg-score').textContent = summary.score;
    $('pg-streak').textContent = summary.bestStreak;
    primary.textContent = 'Play Again';
    primary.onclick = () => startStage(summary.stageId);
  } else if (summary.outcome === 'complete') {
    const lvlIdx = LEVEL_ORDER.indexOf(summary.stageId);
    const updated = applyLevelComplete(getProfile(), Math.max(0, lvlIdx));
    await saveProgress(updated);
    const nextStageId = STAGES[summary.stageId]?.next;
    stats.hidden = false;
    $('pg-score').textContent = summary.score;
    $('pg-streak').textContent = summary.bestStreak;

    if (nextStageId) {
      title.textContent = `${STAGES[summary.stageId].name} Complete!`;
      body.textContent = 'You reached the final stop with hearts remaining!';
      primary.textContent = 'Move to Next Level';
      primary.onclick = () => startStage(nextStageId);
    } else {
      title.textContent = 'Level 3 Complete!';
      body.textContent = 'Congratulations! You unlocked Endless Mode!';
      primary.textContent = 'Play Endless Mode';
      primary.onclick = () => { location.href = './login.html?section=gamemode'; };
    }
  } else {
    title.textContent = 'Out of Hearts!';
    body.textContent = 'You ran out of lives before reaching the final stop. Try again from the first stop!';
    stats.hidden = false;
    $('pg-score').textContent = summary.score;
    $('pg-streak').textContent = summary.bestStreak;
    primary.textContent = 'Retry (Full Lives)';
    primary.onclick = () => startStage(summary.stageId);
  }

  $('modal-postgame').hidden = false;
}

// Menu & settings bindings
$('btn-menu').onclick = () => {
  sfx('tap');
  setAnimationsFrozen(true);
  $('modal-menu').hidden = false;
};
$('menu-close').onclick = () => {
  sfx('tap');
  $('modal-menu').hidden = true;
  setAnimationsFrozen(false);
};
$('pg-menu').onclick = () => {
  sfx('tap');
  location.href = './login.html?section=menu';
};

for (const b of document.querySelectorAll('[data-start-stage]')) {
  b.onclick = () => {
    sfx('tap');
    startStage(b.dataset.startStage);
  };
}

// Settings controls
$('set-volume').value = Math.round(settings.volume * 100);
$('set-sfx').checked = !!settings.sfx;
$('version-label').textContent = `v${VERSION}`;

$('set-volume').oninput = (e) => {
  settings.volume = Number(e.target.value) / 100;
  setSettings(settings);
  saveSettings(settings);
};
$('set-sfx').onchange = (e) => {
  settings.sfx = e.target.checked;
  setSettings(settings);
  saveSettings(settings);
  if (settings.sfx) sfx('tap');
};

// Boot: load profile (or guest mode) and launch requested stage
(async function boot() {
  const urlStage = new URLSearchParams(location.search).get('stage');
  await initProgress();
  const st = getState();
  $('account-badge').textContent = st.uid
    ? `Player: ${st.profile.nickname}`
    : 'Guest Mode (progress not saved online)';

  if (urlStage) {
    startStage(urlStage);
  } else {
    startStage(st.profile.tutorialDone ? 'level1' : 'tutorial');
  }
})();
