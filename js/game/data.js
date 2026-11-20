// =====================================================================
// TsuperHero game data. Everything the group may want to tweak lives here:
// routes, fare matrices, vocabulary, lives, hints, scoring, rewards.
// Fares are written in PESOS here; the rest of the code converts them to
// whole CENTAVOS (₱12.50 -> 1250) so there are never decimal errors.
// =====================================================================

export const VERSION = '0.2.0-dev';

export const MAX_PAYMENT = 20000; // ₱200 – the biggest amount a passenger pays
export const HINT_MS = 5000; // how long a hint shows number forms
export const DRIVE_MS = 1600; // time to drive between stops
export const MAX_PIECES = 30; // max bills/coins the player can put in the sukli

export const COUNT_WORDS = { 1: 'Isa', 2: 'Dalawa', 3: 'Tatlo', 4: 'Apat' };

// ---- Money in the container (order = order on screen, like the wireframe) ----
// TODO(art director): confirm coin colors/denominations.
export const DENOMS = [
  { id: 'b50', value: 5000, kind: 'bill', label: '₱50' },
  { id: 'b100', value: 10000, kind: 'bill', label: '₱100' },
  { id: 'c1', value: 100, kind: 'coin', label: '₱1' },
  { id: 'c5', value: 500, kind: 'coin', label: '₱5' },
  { id: 'c10', value: 1000, kind: 'coin', label: '₱10' },
  { id: 'c20', value: 2000, kind: 'coin', label: '₱20' },
  { id: 'c025', value: 25, kind: 'coin', label: '25¢', centavo: true }, // Hard only
];

// ---- Routes and fare matrices ----
// fares[i][k] = fare from stops[i] to stops[i + 1 + k]  (upper triangle of the taripa)
export const ROUTES = {
  tutorial: { stops: ['Terminal', 'Palengke'], fares: [[10]] },
  level1: {
    stops: ['Palengke', 'Paaralan', 'Simbahan', 'Plaza', 'Terminal'],
    fares: [[10, 12, 15, 20], [10, 12, 15], [10, 12], [10]],
  },
  level2: {
    stops: ['Tindahan', 'Barangay Hall', 'Ospital', 'Parke', 'Munisipyo', 'Sakayan'],
    fares: [[10, 15, 20, 25, 30], [10, 15, 20, 25], [10, 15, 20], [10, 15], [10]],
  },
  level3: {
    stops: ['Bukid', 'Ilog', 'Tulay', 'Eskwela', 'Simbahan', 'Plaza', 'Terminal'],
    fares: [[10, 12, 15, 20, 25, 30], [10, 12, 15, 20, 25], [10, 12, 15, 20], [10, 12, 15], [10, 12], [10]],
  },
  endlessEasy: {
    stops: ['Bayan', 'Palengke', 'Paaralan', 'Simbahan', 'Plaza', 'Ospital', 'Terminal'],
    fares: [[10, 15, 15, 20, 25, 30], [10, 15, 15, 20, 25], [10, 15, 20, 25], [10, 15, 20], [10, 15], [10]],
  },
  endlessMedium: {
    stops: ['Bayan', 'Palengke', 'Paaralan', 'Simbahan', 'Plaza', 'Ospital', 'Terminal'],
    fares: [[11, 13, 14, 17, 19, 22], [11, 12, 14, 16, 18], [11, 13, 14, 17], [11, 12, 15], [12, 14], [13]],
  },
  endlessHard: {
    stops: ['Bayan', 'Palengke', 'Paaralan', 'Simbahan', 'Plaza', 'Ospital', 'Terminal'],
    fares: [
      [11.5, 13, 14.75, 17.25, 19.5, 22],
      [11.25, 12.5, 14, 16.75, 18.5],
      [11.5, 13.25, 14.5, 17],
      [11, 12.75, 15.5],
      [12.25, 14.5],
      [13.75],
    ],
  },
};

// ---- Vocabulary (pesos) used in fare questions; grows with each level ----
const VOCAB_L1 = [5, 10, 20, 50];
const VOCAB_L2 = [...VOCAB_L1, 15, 25, 30];
export const WORDLIST_ALL = [5, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 30, 40, 50, 100];

// ---- Scoring (placeholder: the group will finalize this) ----
export const SCORING = {
  correct: 100, // correct sukli
  streakBonus: 10, // + per passenger in the current streak
  streakBonusMax: 50,
  fareQuestion: 20, // correct answer to "Magkano po?"
};

// ---- Stages ----
// pay: how passengers pay. 'bills' uses stage.bills; 'easy' | 'medium' | 'hard' for Endless.
// qProb: chance a passenger asks "Magkano po?" (only when the fare is in the vocab).
export const STAGES = {
  tutorial: {
    id: 'tutorial', name: 'Tutorial', route: ROUTES.tutorial, practice: true,
    lives: 0, hints: 0, passengers: 1, maxGroup: 1, pay: 'bills', bills: [2000],
    vocab: [10, 20], qProb: 0, centavos: false, mult: 1,
    fixed: { board: 0, dest: 1, count: 1, payment: 2000 },
    next: 'level1',
  },
  level1: {
    id: 'level1', name: 'Level 1', route: ROUTES.level1, lives: 5, hints: 3, passengers: 8,
    maxGroup: 2, pay: 'bills', bills: [2000, 5000], vocab: VOCAB_L1, qProb: 0.7,
    centavos: false, mult: 1, next: 'level2',
  },
  level2: {
    id: 'level2', name: 'Level 2', route: ROUTES.level2, lives: 4, hints: 3, passengers: 10,
    maxGroup: 3, pay: 'bills', bills: [2000, 5000, 10000], vocab: VOCAB_L2, qProb: 0.7,
    centavos: false, mult: 1, next: 'level3',
  },
  level3: {
    id: 'level3', name: 'Level 3', route: ROUTES.level3, lives: 3, hints: 0, passengers: 12,
    maxGroup: 3, pay: 'bills', bills: [2000, 5000, 10000, 20000], vocab: VOCAB_L2, qProb: 0.7,
    centavos: false, mult: 1, next: null,
  },
};
export const LEVEL_ORDER = ['level1', 'level2', 'level3'];

export const DIFFICULTIES = {
  easy: { label: 'Easy', route: ROUTES.endlessEasy, pay: 'easy', maxGroup: 3, qProb: 0.3, mult: 1, centavos: false },
  medium: { label: 'Medium', route: ROUTES.endlessMedium, pay: 'medium', maxGroup: 4, qProb: 0.5, mult: 1.5, centavos: false },
  hard: { label: 'Hard', route: ROUTES.endlessHard, pay: 'hard', maxGroup: 4, qProb: 0.6, mult: 2, centavos: true },
};

export function getStage(id) {
  if (STAGES[id]) return STAGES[id];
  const diff = id.startsWith('endless-') ? id.slice(8) : null;
  const d = DIFFICULTIES[diff];
  if (!d) throw new Error(`Unknown stage: ${id}`);
  return {
    id, name: `Endless – ${d.label}`, difficulty: diff, route: d.route, lives: 5, hints: 0,
    passengers: Infinity, maxGroup: d.maxGroup, pay: d.pay, bills: null, vocab: null,
    qProb: d.qProb, centavos: d.centavos, mult: d.mult, next: null,
  };
}

// ---- Rewards ----
export const STAR_THRESHOLDS = [1000, 2500, 5000];

export const CUSTOM = {
  scenery: [
    { id: 'scenery1', name: 'Probinsya', stars: 0 },
    { id: 'scenery2', name: 'Siyudad', stars: 1 },
  ],
  interior: [
    { id: 'interior1', name: 'Klasik', stars: 0 },
    { id: 'interior2', name: 'Pula', stars: 2 },
  ],
  decor: [
    { id: 'decor1', name: 'Wala', stars: 0 },
    { id: 'decor2', name: 'Rosaryo', stars: 3 },
  ],
};
