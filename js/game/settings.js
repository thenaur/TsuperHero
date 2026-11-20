// Settings are saved on the device (localStorage), not the account.
const KEY = 'tsuperhero.settings';
const DEFAULTS = { volume: 0.8, sfx: true };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS }; // storage blocked or corrupted: use defaults
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
