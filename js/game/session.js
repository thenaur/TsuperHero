// One play-through of a stage (a "run"). A small state machine with no DOM.
//
// phases: idle -> question? -> paying -> result -> (next passenger | driving)
//         driving -> arrive -> (passengers | complete)
//         result -> failed (Normal, no lives) | gameover (Endless, no lives)
// Every action checks the phase first, so double clicks can't break the game.
import { DENOMS, MAX_PIECES, SCORING } from './data.js';
import { makePassenger, fixedPassenger, validateRoute, scorePoints, randInt } from './logic.js';
import { sum } from './money.js';

export function distribute(total, slots) {
  const base = Math.floor(total / slots), rem = total % slots;
  return Array.from({ length: slots }, (_, i) => base + (i < rem ? 1 : 0));
}

export class Run {
  constructor(stage, rng = Math.random) {
    validateRoute(stage.route);
    this.stage = stage;
    this.route = stage.route;
    this.rng = rng;
    this.endless = !Number.isFinite(stage.passengers);
    this.practice = !!stage.practice;
    this.allowed = new Set(DENOMS.filter((d) => stage.centavos || !d.centavo).map((d) => d.value));
    this.plan = this.endless ? null : distribute(stage.passengers, this.route.stops.length - 1);

    this.phase = 'idle';
    this.stopIdx = 0;
    this.lap = 0;
    this.queue = [];
    this.current = null;
    this.lives = stage.lives;
    this.maxLives = stage.lives;
    this.hintsLeft = stage.hints;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.served = 0;
    this.correct = 0;
    this.given = [];
    this.lastAnswer = null;
    this.lastResult = null;
  }

  get lastStop() { return this.route.stops.length - 1; }
  get givenTotal() { return sum(this.given); }

  start() {
    if (this.phase !== 'idle') return null;
    this._loadStop();
    return this.phase;
  }

  _loadStop() {
    const n = this.endless ? randInt(this.rng, 1, 2) : this.plan[this.stopIdx];
    this.queue = [];
    for (let k = 0; k < n; k++) {
      this.queue.push(this.stage.fixed ? fixedPassenger(this.stage) : makePassenger(this.rng, this.stage, this.stopIdx));
    }
    this._nextPassenger();
  }

  _nextPassenger() {
    this.given = [];
    this.lastAnswer = null;
    this.lastResult = null;
    this.current = this.queue.shift() || null;
    this.phase = !this.current ? 'driving' : this.current.question ? 'question' : 'paying';
  }

  /** Answer the "Magkano po?" question (value in pesos). A wrong answer costs no life. */
  answer(value) {
    if (this.phase !== 'question') return null;
    const q = this.current.question;
    const correct = value === q.answer;
    if (correct && !this.practice) this.score += Math.round(SCORING.fareQuestion * this.stage.mult);
    this.lastAnswer = { value, correct, answer: q.answer };
    this.phase = 'paying';
    return this.lastAnswer;
  }

  useHint() {
    if (this.phase !== 'question' || this.hintsLeft <= 0) return false;
    this.hintsLeft--;
    return true;
  }

  addMoney(value) {
    if (this.phase !== 'paying' || !this.allowed.has(value) || this.given.length >= MAX_PIECES) return null;
    this.given.push(value);
    return this.givenTotal;
  }

  undoMoney() {
    if (this.phase !== 'paying' || !this.given.length) return null;
    this.given.pop();
    return this.givenTotal;
  }

  clearMoney() {
    if (this.phase !== 'paying') return null;
    this.given = [];
    return 0;
  }

  /** Give the sukli. exact=true means "SAKTO NA" (no change). */
  submit(exact = false) {
    if (this.phase !== 'paying') return null;
    const p = this.current;
    const given = exact ? 0 : this.givenTotal;
    const correct = given === p.change;
    const res = { correct, given, expected: p.change, exact, points: 0, retry: false, livesLeft: this.lives };

    if (this.practice) {
      if (!correct) { this.given = []; res.retry = true; return res; }
      this.phase = 'result';
      return (this.lastResult = res);
    }

    this.served++;
    if (correct) {
      this.correct++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      res.points = scorePoints(this.streak, this.stage.mult);
      this.score += res.points;
    } else {
      this.streak = 0;
      this.lives = Math.max(0, this.lives - 1);
    }
    res.livesLeft = this.lives;
    this.phase = 'result';
    return (this.lastResult = res);
  }

  next() {
    if (this.phase !== 'result') return null;
    if (!this.practice && this.lives <= 0) {
      this.phase = this.endless ? 'gameover' : 'failed';
      return this.phase;
    }
    this._nextPassenger();
    return this.phase;
  }

  /** Called when the jeepney reaches the next stop. */
  arrive() {
    if (this.phase !== 'driving') return null;
    this.stopIdx++;
    if (this.stopIdx >= this.lastStop) {
      if (!this.endless) { this.phase = 'complete'; return this.phase; }
      this.stopIdx = 0; // Endless: loop back to the first stop
      this.lap++;
    }
    this._loadStop();
    return this.phase;
  }

  summary() {
    return {
      stageId: this.stage.id, outcome: this.phase, score: this.score, bestStreak: this.bestStreak,
      served: this.served, correct: this.correct, livesLeft: this.lives,
    };
  }
}

export const createRun = (stage, { rng } = {}) => new Run(stage, rng || Math.random);
