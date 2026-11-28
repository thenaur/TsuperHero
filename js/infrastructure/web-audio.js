// Infrastructure Layer: AudioAdapter backed by Web Audio API.
// Placeholder synth SFX until real MP3/OGG files are wired in.
let ctx = null;
let S = { volume: 0.8, sfx: true };

export function setSettings(settings) { S = settings; }

export function unlock() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* audio not supported */ }
}

function tone(freq, start, dur, type = 'square', gain = 0.12) {
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain * S.volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const SOUNDS = {
  tap: () => tone(660, 0, 0.06),
  coin: () => { tone(988, 0, 0.07); tone(1319, 0.06, 0.12); },
  correct: () => { tone(523, 0, 0.1); tone(659, 0.1, 0.1); tone(784, 0.2, 0.18); },
  wrong: () => { tone(220, 0, 0.18, 'sawtooth'); tone(165, 0.17, 0.25, 'sawtooth'); },
  stop: () => tone(440, 0, 0.12, 'triangle'),
};

export function sfx(name) {
  if (!ctx || !S.sfx || S.volume <= 0) return;
  try { SOUNDS[name]?.(); } catch { /* ignore */ }
}

export function createWebAudioAdapter() {
  return { unlock, setSettings, sfx };
}
