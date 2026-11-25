// One play-through of a stage (a "run"). A small state machine with no DOM.
//
// Continuous-route progress bar logic:
//   - Passengers keep coming one after another on the current leg (stopIdx)
//     until the progress bar reaches the next stop and triggers arrive().
//   - Occasional "Magkano po?" fare questions ask for TOTAL fare (fare * count)
//     and never trigger twice in a row.
//   - Normal Mode: keep lives > 0 until reaching the final stop -> 'complete'.
//   - Endless Mode: the 5 stops are jumbled each Day. Reaching the final stop
//     with lives > 0 advances to Day 2, Day 3, ... with freshly jumbled stops!
//   - Running out of lives -> 'failed' (Normal) or 'gameover' (Endless).
import { DENOMS, MAX_PIECES, SCORING } from './data.js?v=21';
import { makePassenger, fixedPassenger, validateRoute, jumbleRoute, scorePoints } from './logic.js?v=17';
import { sum } from './money.js?v=17';

export class Run {
  constructor(stage, rng = Math.random) {
    validateRoute(stage.route);
    this.stage = stage;
    this.rng = rng;
    this.endless = !Number.isFinite(stage.passengers);
    this.practice = !!stage.practice;
    this.route = this.endless ? jumbleRoute(this.rng, stage.route) : stage.route;
    this.allowed = new Set(DENOMS.filter((d) => stage.centavos || !d.centavo).map((d) => d.value));

    this.phase = 'idle';
    this.stopIdx = 0;
    this.day = 1;
    this.lap = 0;
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
    this._tutorialSpawned = 0;
    this._lastAskedQuestion = false;
  }

  get lastStop() { return this.route.stops.length - 1; }
  get givenTotal() { return sum(this.given); }

  start() {
    if (this.phase !== 'idle') return null;
    this._spawnPassenger();
    return this.phase;
  }

  _spawnPassenger() {
    this.given = [];
    this.lastAnswer = null;
    this.lastResult = null;

    if (this.practice && this.stage.fixedQueue && this._tutorialSpawned < this.stage.fixedQueue.length) {
      const f = this.stage.fixedQueue[this._tutorialSpawned];
      if (f.board === this.stopIdx) {
        this.current = fixedPassenger(this.stage, this._tutorialSpawned);
        this._tutorialSpawned++;
        this._lastAskedQuestion = !!this.current.question;
        this.phase = this.current.question ? 'question' : 'paying';
        return;
      }
    }

    // Never ask a "Magkano po?" question twice in a row so it stays kid-friendly
    this.current = makePassenger(this.rng, this.stage, this.stopIdx, this.route, {
      allowQuestion: !this._lastAskedQuestion,
    });
    this._lastAskedQuestion = !!this.current.question;
    this.phase = this.current.question ? 'question' : 'paying';
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
    const res = { correct, given, expected: p.change, exact, points: 0, retry: false, timeout: false, livesLeft: this.lives };

    if (this.practice) {
      if (!correct) { this.given = []; res.retry = true; return res; }
      this.served++;
      this.correct++;
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

  /** Called when the passenger's patience timer runs out (Normal & Endless only). */
  timeout() {
    if (this.practice || (this.phase !== 'question' && this.phase !== 'paying')) return null;
    this.served++;
    this.streak = 0;
    this.lives = Math.max(0, this.lives - 1);
    const res = {
      correct: false, given: this.givenTotal, expected: this.current ? this.current.change : 0,
      exact: false, points: 0, retry: false, timeout: true, livesLeft: this.lives,
    };
    this.phase = 'result';
    return (this.lastResult = res);
  }

  /** Advance to the next passenger on the current leg (or end if out of lives). */
  next() {
    if (this.phase !== 'result') return null;
    if (!this.practice && this.lives <= 0) {
      this.phase = this.endless ? 'gameover' : 'failed';
      return this.phase;
    }
    this._spawnPassenger();
    return this.phase;
  }

  /** Called when the bottom progress bar reaches the next stop. */
  arrive() {
    if (this.phase === 'idle' || this.phase === 'complete' || this.phase === 'failed' || this.phase === 'gameover') {
      return null;
    }
    if (!this.practice && this.lives <= 0) {
      this.phase = this.endless ? 'gameover' : 'failed';
      return this.phase;
    }
    this.stopIdx++;
    if (this.stopIdx >= this.lastStop) {
      if (!this.endless) {
        this.current = null;
        this.phase = 'complete';
        return this.phase;
      }
      // Endless Mode: switch to Day 2, Day 3, ... with freshly jumbled 5 stops!
      this.day++;
      this.lap++;
      this.stopIdx = 0;
      this.route = jumbleRoute(this.rng, this.stage.route);
    }
    this._spawnPassenger();
    return this.phase;
  }

  summary() {
    return {
      stageId: this.stage.id, outcome: this.phase, score: this.score, bestStreak: this.bestStreak,
      served: this.served, correct: this.correct, livesLeft: this.lives, day: this.day,
    };
  }
}

export const createRun = (stage, { rng } = {}) => new Run(stage, rng || Math.random);
