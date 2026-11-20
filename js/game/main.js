// Main controller for the playable prototype (Tutorial + Level 1).
import { STAGES, VERSION } from './data.js';
import { fitStage } from './layout.js';
import { Emitter } from './emitter.js';
import { Play } from './play.js';
import { TutorialGuide } from './tutorial.js';
import { unlock, setSettings, sfx } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';
import { init as initProgress, save as saveProgress, getProfile, getState } from './progress.js';
import { applyTutorialDone, applyLevelComplete } from './progress-rules.js';

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

  const stage = STAGES[stageId];
  const bus = new Emitter();

  // keep switcher button active state synced
  for (const b of document.querySelectorAll('[data-start-stage]')) {
    b.classList.toggle('active', b.dataset.startStage === stageId);
  }

  currentPlay = new Play(stage, {
    bus,
    onEnd: (summary) => handleStageEnd(summary),
  });
  currentPlay.start();

  if (stageId === 'tutorial') {
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
    title.textContent = 'Handa ka na!';
    body.textContent = 'Tapos na ang Tutorial! Alam mo na kung paano tumingin sa taripa, umintindi ng salita ng tsuper, at magbigay ng tamang sukli.';
    stats.hidden = true;
    primary.textContent = 'Start Level 1';
    primary.onclick = () => startStage('level1');
  } else if (summary.outcome === 'complete') {
    const updated = applyLevelComplete(getProfile(), 0);
    await saveProgress(updated);
    title.textContent = 'Level 1 Complete!';
    body.textContent = 'Naabot mo ang huling hintuan nang hindi nauubos ang buhay!';
    stats.hidden = false;
    $('pg-score').textContent = summary.score;
    $('pg-streak').textContent = summary.bestStreak;
    primary.textContent = 'Play Level 1 Again';
    primary.onclick = () => startStage('level1');
  } else {
    title.textContent = 'Naubos ang Buhay!';
    body.textContent = 'Subukan ulit mula sa unang hintuan.';
    stats.hidden = false;
    $('pg-score').textContent = summary.score;
    $('pg-streak').textContent = summary.bestStreak;
    primary.textContent = 'Retry Level 1 (Full Lives)';
    primary.onclick = () => startStage('level1');
  }

  $('modal-postgame').hidden = false;
}

// Menu & settings bindings
$('btn-menu').onclick = () => {
  sfx('tap');
  $('modal-menu').hidden = false;
};
$('menu-close').onclick = () => {
  sfx('tap');
  $('modal-menu').hidden = true;
};
$('pg-menu').onclick = () => {
  sfx('tap');
  $('modal-postgame').hidden = true;
  $('modal-menu').hidden = false;
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

// Boot: load profile (or guest mode) and launch Tutorial or Level 1
(async function boot() {
  const urlStage = new URLSearchParams(location.search).get('stage');
  await initProgress();
  const st = getState();
  $('account-badge').textContent = st.uid
    ? `Player: ${st.profile.nickname}`
    : 'Guest Mode (progress not saved online)';

  if (urlStage && STAGES[urlStage]) {
    startStage(urlStage);
  } else {
    startStage(st.profile.tutorialDone ? 'level1' : 'tutorial');
  }
})();
