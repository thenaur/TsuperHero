import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, ROUTES, DENOMS, MAX_PAYMENT, LEVEL_ORDER, getStage } from '../js/game/data.js';
import { mulberry32, validateRoute, fareOf, makePassenger, fixedPassenger } from '../js/game/logic.js';
import { createRun } from '../js/game/session.js';
import { breakdown } from '../js/game/money.js';
import { pesoWord, amountWord } from '../js/game/numbers.js';

const ALL_STAGES = ['tutorial', ...LEVEL_ORDER, 'endless-easy', 'endless-medium', 'endless-hard'];
const denomsFor = (stage) => DENOMS.filter((d) => stage.centavos || !d.centavo).map((d) => d.value);

test('every route has a valid fare matrix', () => {
  for (const [name, r] of Object.entries(ROUTES)) assert.ok(validateRoute(r), name);
});

test('sample round from the document: Palengke -> Plaza, 2 pax, pays 50', () => {
  // Level 1 uses the document's stop names; Palengke(0) -> Plaza(3)
  const fare = fareOf(ROUTES.level1, 0, 3);
  assert.equal(fare, 1500);
  assert.equal(5000 - 2 * fare, 2000);
});

test('tutorial passenger: Terminal -> Palengke, ₱10 fare, pays ₱20', () => {
  const p = fixedPassenger(STAGES.tutorial);
  assert.equal(p.fare, 1000);
  assert.equal(p.payment, 2000);
  assert.equal(p.change, 1000);
});

test('random passengers always make sense (thousands per stage)', () => {
  for (const id of ALL_STAGES) {
    const stage = getStage(id);
    if (stage.fixed) continue;
    const denoms = denomsFor(stage);
    const n = stage.route.stops.length;
    for (let seed = 1; seed <= 250; seed++) {
      const rng = mulberry32(seed);
      const board = seed % (n - 1);
      const p = makePassenger(rng, stage, board);
      const where = `${id} seed ${seed}`;
      assert.ok(p.dest > board && p.dest < n, `dest ${where}`);
      assert.ok(p.count >= 1 && p.count <= stage.maxGroup, `count ${where}`);
      assert.ok(p.payment >= p.total, `payment >= fare ${where}`);
      assert.ok(p.payment <= MAX_PAYMENT, `payment cap ${where}`);
      assert.equal(p.change, p.payment - p.total);
      assert.ok(breakdown(p.change, denoms) !== null, `change formable ${where}`);
      assert.doesNotThrow(() => amountWord(p.payment));
      if (!stage.centavos) {
        assert.equal(p.payment % 100, 0, `no centavos ${where}`);
        assert.equal(p.change % 100, 0, `no centavos ${where}`);
      }
      if (stage.pay === 'easy') {
        assert.equal(p.payment % 500, 0, `easy multiple of 5 ${where}`);
        assert.equal(p.total % 500, 0, `easy multiple of 5 ${where}`);
      }
      if (p.question) {
        const q = p.question;
        assert.equal(q.answer * 100, p.fare, `question answer ${where}`);
        assert.equal(q.options.length, 2);
        assert.ok(q.options.includes(q.answer));
        assert.notEqual(q.options[0], q.options[1]);
        for (const o of q.options) {
          assert.ok(o >= 5, `option >= 5 ${where}`);
          if (stage.vocab) assert.ok(stage.vocab.includes(o), `vocab only ${where}`);
          assert.doesNotThrow(() => pesoWord(o));
        }
      }
    }
  }
});

// Bot that plays perfectly
function playRun(stage, seed, { wrong = false, maxServed = 300 } = {}) {
  const run = createRun(stage, { rng: mulberry32(seed) });
  const denoms = denomsFor(stage);
  run.start();
  for (let guard = 0; guard < 20000; guard++) {
    switch (run.phase) {
      case 'question': {
        const q = run.current.question;
        const choice = wrong ? q.options.find((o) => o !== q.answer) : q.answer;
        run.answer(choice);
        break;
      }
      case 'paying': {
        const target = run.current.change + (wrong ? 100 : 0);
        for (const d of breakdown(target, denoms)) assert.notEqual(run.addMoney(d), null);
        assert.equal(run.givenTotal, target);
        run.submit(false);
        break;
      }
      case 'result':
        if (run.served >= maxServed) return run;
        run.next();
        break;
      case 'driving': run.arrive(); break;
      default: return run; // complete | failed | gameover
    }
  }
  throw new Error('run never ended');
}

test('perfect play completes every Normal stage with full lives', () => {
  for (const id of ['tutorial', ...LEVEL_ORDER]) {
    const stage = getStage(id);
    for (let seed = 1; seed <= 30; seed++) {
      const run = playRun(stage, seed);
      assert.equal(run.phase, 'complete', `${id} seed ${seed}`);
      assert.equal(run.lives, stage.lives);
      if (!stage.practice) {
        assert.equal(run.served, stage.passengers);
        assert.equal(run.correct, stage.passengers);
        assert.ok(run.score > 0);
      }
    }
  }
});

test('always-wrong play loses exactly one life per passenger', () => {
  for (const id of [...LEVEL_ORDER, 'endless-easy', 'endless-medium', 'endless-hard']) {
    const stage = getStage(id);
    for (let seed = 1; seed <= 20; seed++) {
      const run = playRun(stage, seed, { wrong: true });
      assert.equal(run.phase, stage.lives && id.startsWith('endless') ? 'gameover' : 'failed', `${id} ${seed}`);
      assert.equal(run.lives, 0);
      assert.equal(run.served, stage.lives);
      assert.equal(run.score, 0);
    }
  }
});

test('Endless keeps going (loops the route) while the player is correct', () => {
  for (const id of ['endless-easy', 'endless-medium', 'endless-hard']) {
    const run = playRun(getStage(id), 7, { maxServed: 250 });
    assert.equal(run.served, 250);
    assert.equal(run.lives, 5);
    assert.ok(run.lap > 0, 'route looped');
  }
});

test('tutorial never removes lives and lets the player retry', () => {
  const run = createRun(STAGES.tutorial);
  run.start();
  assert.equal(run.phase, 'paying');
  run.addMoney(500);
  const r = run.submit();
  assert.equal(r.retry, true);
  assert.equal(run.phase, 'paying');
  assert.equal(run.givenTotal, 0);
  run.addMoney(1000);
  assert.equal(run.submit().correct, true);
  assert.equal(run.next(), 'driving');
  assert.equal(run.arrive(), 'complete');
});

test('actions in the wrong phase are ignored (no double submits)', () => {
  const run = createRun(STAGES.level1, { rng: mulberry32(3) });
  assert.equal(run.submit(), null); // before start
  run.start();
  if (run.phase === 'question') {
    assert.equal(run.addMoney(1000), null); // can't pay before answering
    run.answer(run.current.question.answer);
  }
  run.submit(true);
  assert.equal(run.submit(true), null); // second submit ignored
  assert.equal(run.addMoney(1000), null);
  assert.equal(run.arrive(), null);
  assert.equal(run.served, 1);
});

test('centavo coin is only accepted on Hard', () => {
  const easy = createRun(getStage('endless-easy'), { rng: mulberry32(1) });
  easy.start();
  if (easy.phase === 'question') easy.answer(easy.current.question.answer);
  assert.equal(easy.addMoney(25), null);
  const hard = createRun(getStage('endless-hard'), { rng: mulberry32(1) });
  hard.start();
  if (hard.phase === 'question') hard.answer(hard.current.question.answer);
  assert.equal(hard.addMoney(25), 25);
});

test('hints: limited per level, none in Level 3', () => {
  const run = createRun(STAGES.level1, { rng: mulberry32(11) });
  run.start();
  let used = 0;
  for (let i = 0; i < 10 && !['complete', 'failed'].includes(run.phase); i++) {
    while (!['question', 'complete', 'failed'].includes(run.phase)) {
      if (run.phase === 'paying') { run.submit(run.current.change === 0); }
      if (run.phase === 'result') run.next();
      if (run.phase === 'driving') run.arrive();
    }
    if (run.phase === 'question') {
      while (run.useHint()) used++;
      run.answer(run.current.question.answer);
    }
  }
  assert.ok(used <= 3);
  const l3 = createRun(STAGES.level3);
  assert.equal(l3.hintsLeft, 0);
});
