// Infrastructure Layer: SettingsStore adapter backed by localStorage.
const KEY = 'tsuperhero.settings';
const DEFAULTS = { volume: 0.8, sfx: true };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
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

export function createLocalSettingsStore() {
  return { load: loadSettings, save: saveSettings };
}
