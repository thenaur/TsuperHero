// =====================================================================
// TsuperHero game data. Everything the group may want to tweak lives here:
// routes, fare matrices, vocabulary, lives, hints, scoring, rewards.
// Fares are written in PESOS here; the rest of the code converts them to
// whole CENTAVOS (₱12.50 -> 1250) so there are never decimal errors.
// =====================================================================

export const VERSION = '0.2.0-dev';

export const MAX_PAYMENT = 20000; // ₱200 – the biggest amount a passenger pays
export const HINT_MS = 5000; // how long a hint shows number forms
export const DRIVE_MS = 1600; // fallback duration between stops
export const MAX_PIECES = 30; // max bills/coins the player can put in the sukli

export const COUNT_WORDS = { 1: 'Isa', 2: 'Dalawa', 3: 'Tatlo', 4: 'Apat' };

// ---- Money in the container (order = order on screen) ----
export const DENOMS = [
  { id: 'b50', value: 5000, kind: 'bill', label: '₱50' },
  { id: 'b100', value: 10000, kind: 'bill', label: '₱100' },
  { id: 'c1', value: 100, kind: 'coin', label: '₱1' },
  { id: 'c5', value: 500, kind: 'coin', label: '₱5' },
  { id: 'c10', value: 1000, kind: 'coin', label: '₱10' },
  { id: 'c20', value: 2000, kind: 'coin', label: '₱20' },
  { id: 'c025', value: 25, kind: 'coin', label: '25¢', centavo: true }, // Hard only
];

// ---- Stop Landmark Backgrounds ----
export const STOP_BACKGROUNDS = {
  Jollibee: '../assets/resto.png',
  Palengke: '../assets/palengke.png',
  Munisipyo: '../assets/munisipyo.png',
  Hospital: '../assets/hospital.png',
  School: '../assets/school.png',
  Terminal: '../assets/resto.png',
};

// The 5 core destination stops (jumbled each Day in Endless Mode)
export const ENDLESS_STOPS = ['Jollibee', 'Palengke', 'Munisipyo', 'Hospital', 'School'];

// ---- Routes and fare matrices ----
// fares[i][k] = fare from stops[i] to stops[i + 1 + k]  (upper triangle of the taripa)
export const ROUTES = {
  tutorial: {
    stops: ['Terminal', 'Jollibee', 'Palengke'],
    fares: [[10, 15], [10]],
  },
  level1: {
    stops: ['Terminal', 'Jollibee', 'Palengke', 'Munisipyo'],
    fares: [[10, 15, 20], [10, 15], [10]],
  },
  level2: {
    stops: ['Terminal', 'Jollibee', 'Palengke', 'Munisipyo', 'Hospital'],
    fares: [[10, 15, 20, 25], [10, 15, 20], [10, 15], [10]],
  },
  level3: {
    stops: ['Terminal', 'Jollibee', 'Palengke', 'Munisipyo', 'Hospital', 'School'],
    fares: [[10, 12, 15, 20, 25], [10, 12, 15, 20], [10, 12, 15], [10, 12], [10]],
  },
  endlessEasy: {
    stops: ['Terminal', ...ENDLESS_STOPS],
    fares: [[10, 15, 20, 25, 30], [10, 15, 20, 25], [10, 15, 20], [10, 15], [10]],
  },
  endlessMedium: {
    stops: ['Terminal', ...ENDLESS_STOPS],
    fares: [[11, 13, 16, 19, 22], [11, 13, 15, 18], [11, 14, 17], [12, 15], [13]],
  },
  endlessHard: {
    stops: ['Terminal', ...ENDLESS_STOPS],
    fares: [
      [11.5, 13.25, 15.75, 18.5, 21.25],
      [11.25, 13.5, 16.25, 19],
      [11.75, 14.5, 17.25],
      [12.25, 15.5],
      [13.75],
    ],
  },
};

// ---- Vocabulary (pesos) used in fare questions; includes multi-passenger totals ----
const VOCAB_L1 = [5, 10, 15, 20, 30, 40, 50];
const VOCAB_L2 = [5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75];
export const WORDLIST_ALL = [5, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 30, 40, 45, 50, 60, 75, 80, 100];

// ---- Scoring ----
export const SCORING = {
  correct: 100, // correct sukli
  streakBonus: 10, // + per passenger in the current streak
  streakBonusMax: 50,
  fareQuestion: 20, // correct answer to "Magkano po?"
};

// ---- Stages ----
// legSeconds: how long the bottom progress bar takes to creep between stops.
// patienceSec: per-passenger timer before losing a heart (0 = unlimited in Tutorial).
// pay: how passengers pay. 'bills' uses stage.bills; 'easy' | 'medium' | 'hard' for Endless.
// qProb: occasional chance a passenger asks "Magkano po?" (never back-to-back!).
export const STAGES = {
  tutorial: {
    id: 'tutorial', name: 'Tutorial', route: ROUTES.tutorial, practice: true,
    lives: 0, hints: 3, passengers: 2, maxGroup: 2, pay: 'bills', bills: [2000, 5000],
    vocab: [10, 15, 20, 30], qProb: 0.25, centavos: false, mult: 1,
    legSeconds: 36, patienceSec: 0,
    fixed: { board: 0, dest: 1, count: 1, payment: 2000, question: { answer: 10, options: [20, 10] } },
    fixedQueue: [
      // Guided Passenger 1: asks "MAGKANO PO PAPUNTANG JOLLIBEE?" (BENTE vs DIYES), then pays ₱20 -> ₱10 change
      { board: 0, dest: 1, count: 1, payment: 2000, question: { answer: 10, options: [20, 10] } },
      // Practice Passenger 2: exact ₱10 fare -> SAKTO NA
      { board: 0, dest: 1, count: 1, payment: 1000 },
    ],
    next: 'level1',
  },
  level1: {
    id: 'level1', name: 'Level 1', route: ROUTES.level1, lives: 5, hints: 3, passengers: 8,
    maxGroup: 2, pay: 'bills', bills: [2000, 5000], vocab: VOCAB_L1, qProb: 0.28,
    centavos: false, mult: 1, legSeconds: 42, patienceSec: 26, next: 'level2',
  },
  level2: {
    id: 'level2', name: 'Level 2', route: ROUTES.level2, lives: 4, hints: 3, passengers: 10,
    maxGroup: 3, pay: 'bills', bills: [2000, 5000, 10000], vocab: VOCAB_L2, qProb: 0.3,
    centavos: false, mult: 1, legSeconds: 40, patienceSec: 24, next: 'level3',
  },
  level3: {
    id: 'level3', name: 'Level 3', route: ROUTES.level3, lives: 3, hints: 0, passengers: 12,
    maxGroup: 3, pay: 'bills', bills: [2000, 5000, 10000, 20000], vocab: VOCAB_L2, qProb: 0.3,
    centavos: false, mult: 1, legSeconds: 36, patienceSec: 21, next: null,
  },
};
export const LEVEL_ORDER = ['level1', 'level2', 'level3'];

export const DIFFICULTIES = {
  easy: { label: 'Easy', route: ROUTES.endlessEasy, pay: 'easy', maxGroup: 3, qProb: 0.22, mult: 0.5, centavos: false, legSeconds: 42, patienceSec: 25 },
  medium: { label: 'Medium', route: ROUTES.endlessMedium, pay: 'medium', maxGroup: 4, qProb: 0.28, mult: 0.75, centavos: false, legSeconds: 40, patienceSec: 23 },
  hard: { label: 'Hard', route: ROUTES.endlessHard, pay: 'hard', maxGroup: 4, qProb: 0.3, mult: 1, centavos: true, legSeconds: 38, patienceSec: 21 },
};

export function getStage(id) {
  if (STAGES[id]) return STAGES[id];
  const diff = id.startsWith('endless-') ? id.slice(8) : null;
  const d = DIFFICULTIES[diff];
  if (!d) throw new Error(`Unknown stage: ${id}`);
  return {
    id, name: `Endless – ${d.label}`, difficulty: diff, route: d.route, lives: 5, hints: 0,
    passengers: Infinity, maxGroup: d.maxGroup, pay: d.pay, bills: null, vocab: null,
    qProb: d.qProb, centavos: d.centavos, mult: d.mult,
    legSeconds: d.legSeconds, patienceSec: d.patienceSec, next: null,
  };
}

// ---- Rewards & Customization Catalog ----
export const STAR_THRESHOLDS = [1000, 2500, 5000];
export const CUSTOM_PREVIEW_NORMAL = '../assets/customization/NormalPreview.png';

export const CUSTOM_CATEGORY_META = {
  decor: { label: 'DECOR', unlockScore: 1000, stars: 1 },
  interior: { label: 'INTERIOR', unlockScore: 2500, stars: 2 },
  scenery: { label: 'SCENERY', unlockScore: 5000, stars: 3 },
};

// Item order inside each category matches the Customization UI grid in ascending difficulty/score:
// [0] Easy (top-left), [1] Medium (top-right), [2] Hard (bottom-center)
export const CUSTOM = {
  decor: [
    {
      id: 'decor-dice',
      name: 'Fuzzy Dice',
      category: 'decor',
      tier: 'easy',
      stars: 1,
      minScore: 1000,
      icon: '../assets/customization/decor/DecorFuzzyDice.png',
      preview: '../assets/customization/decor/DicePreview.png',
      decorImg: '../assets/customization/decor/DecoreFuzzyDiceActual.png',
    },
    {
      id: 'decor-freshener',
      name: 'Air Freshener',
      category: 'decor',
      tier: 'medium',
      stars: 1,
      minScore: 1500,
      icon: '../assets/customization/decor/DecorAirFreshener.png',
      preview: '../assets/customization/decor/AirFreshPreview.png',
      decorImg: '../assets/customization/decor/DecorAirFreshenerActual.png',
    },
    {
      id: 'decor-lily',
      name: 'Lily of the Valley',
      category: 'decor',
      tier: 'hard',
      stars: 1,
      minScore: 2000,
      icon: '../assets/customization/decor/DecorLilyValley.png',
      preview: '../assets/customization/decor/LilyPreview.png',
      decorImg: '../assets/customization/decor/DecorLilyValleyActual.png',
    },
  ],
  interior: [
    {
      id: 'interior-fiesta',
      name: 'Fiesta',
      category: 'interior',
      tier: 'easy',
      stars: 2,
      minScore: 2500,
      icon: '../assets/customization/interior/IconFiesta.png',
      preview: '../assets/customization/interior/FiestaPreview.png',
      interiorImg: '../assets/customization/interior/JeepInteriorFiesta.png',
      sideTabsTop: 114,
    },
    {
      id: 'interior-christmas',
      name: 'Christmas',
      category: 'interior',
      tier: 'medium',
      stars: 2,
      minScore: 3500,
      icon: '../assets/customization/interior/IconChristmas.png',
      preview: '../assets/customization/interior/ChristmasPreview.png',
      interiorImg: '../assets/customization/interior/JeepInteriorChristmas.png',
      sideTabsTop: 78,
    },
    {
      id: 'interior-newyear',
      name: 'New Year',
      category: 'interior',
      tier: 'hard',
      stars: 2,
      minScore: 4500,
      icon: '../assets/customization/interior/IconNewYear.png',
      preview: '../assets/customization/interior/NewYearPreview.png',
      interiorImg: '../assets/customization/interior/JeepInteriorNewYear.png',
      sideTabsTop: 78,
    },
  ],
  scenery: [
    {
      id: 'scenery-morning',
      name: 'Morning',
      category: 'scenery',
      tier: 'easy',
      stars: 3,
      minScore: 5000,
      icon: '../assets/customization/morning/IconMorning.png',
      preview: '../assets/customization/morning/PreviewMorning.png',
      roadGif: '../assets/customization/morning/RoadLoopMorning.gif',
      stopBackgrounds: {
        Jollibee: '../assets/customization/morning/RestoMorning.png',
        Palengke: '../assets/customization/morning/PalengkeMorning.png',
        Munisipyo: '../assets/customization/morning/MunisipyoMorning.png',
        Hospital: '../assets/customization/morning/HospitalMorning.png',
        School: '../assets/customization/morning/SchoolMorning.png',
        Terminal: '../assets/customization/morning/RestoMorning.png',
      },
    },
    {
      id: 'scenery-night',
      name: 'Night',
      category: 'scenery',
      tier: 'medium',
      stars: 3,
      minScore: 6000,
      icon: '../assets/customization/night/IconNight.png',
      preview: '../assets/customization/night/PreviewNight.png',
      roadGif: '../assets/customization/night/RoadloopNight.gif',
      stopBackgrounds: {
        Jollibee: '../assets/customization/night/RestoNight.png',
        Palengke: '../assets/customization/night/PalengkeNight.png',
        Munisipyo: '../assets/customization/night/MunisipyoNight.png',
        Hospital: '../assets/customization/night/HospitalNight.png',
        School: '../assets/customization/night/SchoolNight.png',
        Terminal: '../assets/customization/night/RestoNight.png',
      },
    },
    {
      id: 'scenery-dawn',
      name: 'Dawn',
      category: 'scenery',
      tier: 'hard',
      stars: 3,
      minScore: 7500,
      icon: '../assets/customization/dawn/IconDawn.png',
      preview: '../assets/customization/dawn/PreviewDawn.png',
      roadGif: '../assets/customization/dawn/RoadLoopDawn.gif',
      stopBackgrounds: {
        Jollibee: '../assets/customization/dawn/RestoDawn.png',
        Palengke: '../assets/customization/dawn/PalengkeDawn.png',
        Munisipyo: '../assets/customization/dawn/MunisipyoDawn.png',
        Hospital: '../assets/customization/dawn/HospitalDawn.png',
        School: '../assets/customization/dawn/SchoolDawn.png',
        Terminal: '../assets/customization/dawn/RestoDawn.png',
      },
    },
  ],
};
