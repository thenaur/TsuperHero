// Pure game rules: fares, passengers, payments, fare questions, scoring.
// No DOM here, so it can be tested with Node (see tests/).
import { MAX_PAYMENT, SCORING } from './data.js';
import { toCentavos } from './money.js';

/** Small seedable random generator, so tests are repeatable. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/** Throws if a route's fare matrix has the wrong shape or bad values. */
export function validateRoute(route) {
  const n = route.stops.length;
  if (n < 2) throw new Error('Route needs at least 2 stops');
  if (route.fares.length !== n - 1) throw new Error('fares must have one row per boarding stop');
  route.fares.forEach((row, i) => {
    if (row.length !== n - 1 - i) throw new Error(`fares row ${i} should have ${n - 1 - i} values`);
    for (const f of row) {
      const c = toCentavos(f);
      if (!(c > 0) || c % 25 !== 0) throw new Error(`Bad fare ${f} in row ${i}`);
    }
  });
  return true;
}

/** Fare in centavos from stop index `from` to stop index `to`. */
export function fareOf(route, from, to) {
  if (!(to > from) || from < 0 || to >= route.stops.length) throw new Error(`Bad trip ${from}->${to}`);
  return toCentavos(route.fares[from][to - from - 1]);
}

export function groupSize(rng, maxGroup) {
  return pick(rng, [1, 1, 1, 2, 2, 3, 4].filter((g) => g <= maxGroup));
}

/** How much the passenger hands over (centavos). Always >= total and <= MAX_PAYMENT. */
export function makePayment(rng, stage, total) {
  if (rng() < 0.12) return total; // exact payment -> "SAKTO NA"
  const up = (step) => Math.ceil(total / step) * step;
  const c = new Set();
  const bills = [2000, 5000, 10000, 20000];
  switch (stage.pay) {
    case 'bills':
      for (const b of stage.bills) { c.add(up(b)); if (b >= total) c.add(b); }
      break;
    case 'easy': // all multiples of ₱5
      for (const s of [1000, 2000, ...bills]) c.add(up(s));
      break;
    case 'medium': // whole pesos, including odd amounts like ₱37
      for (const s of bills) c.add(up(s));
      c.add(total + randInt(rng, 1, 15) * 100);
      break;
    case 'hard': // whole, odd, and amounts with centavos
      for (const s of bills) c.add(up(s));
      c.add(up(100) + randInt(rng, 1, 15) * 100);
      c.add(total + randInt(rng, 1, 8) * 25);
      break;
    default:
      throw new Error(`Unknown pay mode ${stage.pay}`);
  }
  const options = [...c].filter((p) => p > total && p <= MAX_PAYMENT);
  return options.length ? pick(rng, options) : total;
}

/** "Magkano po?" question with 2 options in pesos, or null if this fare can't be asked. */
export function makeFareQuestion(rng, stage, fare) {
  if (fare % 100 !== 0) return null; // centavo fares are never asked
  const pesos = fare / 100;
  let wrong;
  if (stage.vocab) {
    if (!stage.vocab.includes(pesos)) return null;
    const others = stage.vocab.filter((v) => v !== pesos)
      .sort((a, b) => Math.abs(a - pesos) - Math.abs(b - pesos));
    if (!others.length) return null;
    wrong = pick(rng, others.slice(0, 2));
  } else {
    wrong = pesos + pick(rng, [-3, -2, -1, 1, 2, 3, 5, -5].filter((d) => pesos + d >= 5));
  }
  return { answer: pesos, options: rng() < 0.5 ? [pesos, wrong] : [wrong, pesos] };
}

function buildPassenger(board, dest, count, fare, payment, question) {
  const total = fare * count;
  return { board, dest, count, fare, total, payment, change: payment - total, question };
}

export function makePassenger(rng, stage, board) {
  const route = stage.route;
  const dest = randInt(rng, board + 1, route.stops.length - 1);
  const count = groupSize(rng, stage.maxGroup);
  const fare = fareOf(route, board, dest);
  const question = rng() < stage.qProb ? makeFareQuestion(rng, stage, fare) : null;
  const payment = makePayment(rng, stage, fare * count);
  return buildPassenger(board, dest, count, fare, payment, question);
}

export function fixedPassenger(stage) {
  const f = stage.fixed;
  const fare = fareOf(stage.route, f.board, f.dest);
  if (f.payment < fare * f.count) throw new Error('Fixed passenger pays too little');
  return buildPassenger(f.board, f.dest, f.count, fare, f.payment, null);
}

export function scorePoints(streak, mult = 1) {
  const bonus = Math.min(SCORING.streakBonus * Math.max(0, streak - 1), SCORING.streakBonusMax);
  return Math.round((SCORING.correct + bonus) * mult);
}
