import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, ROUTES, ENDLESS_STOPS, DENOMS, MAX_PAYMENT, LEVEL_ORDER, getStage } from '../js/domain/data.js';
import { mulberry32, validateRoute, fareOf, upcomingStops, makePassenger, fixedPassenger, jumbleRoute } from '../js/domain/logic.js';
import { createRun } from '../js/application/session.js';
import { breakdown } from '../js/domain/money.js';
import { pesoWord, amountWord } from '../js/domain/numbers.js';

const ALL_STAGES = ['tutorial', ...LEVEL_ORDER, 'endless-easy', 'endless-medium', 'endless-hard'];
const denomsFor = (stage) => DENOMS.filter((d) => stage.centavos || !d.centavo).map((d) => d.value);

test('every route has a valid fare matrix', () => {
  for (const [name, r] of Object.entries(ROUTES)) assert.ok(validateRoute(r), name);
});

test('Level 1..3 have 3, 4, and 5 destination stops after Terminal', () => {
  assert.deepEqual(ROUTES.tutorial.stops, ['Terminal', 'Jollibee', 'Palengke']);
  assert.equal(ROUTES.level1.stops.length - 1, 3);
  assert.equal(ROUTES.level2.stops.length - 1, 4);
  assert.equal(ROUTES.level3.stops.length - 1, 5);
});

test('tutorial passengers: guided question + ₱20->₱10 change, then exact ₱10 SAKTO NA', () => {
  const p0 = fixedPassenger(STAGES.tutorial, 0);
  assert.equal(p0.fare, 1000);
  assert.equal(p0.payment, 2000);
  assert.equal(p0.change, 1000);
  assert.deepEqual(p0.question, { answer: 10, options: [20, 10] });

  const p1 = fixedPassenger(STAGES.tutorial, 1);
  assert.equal(p1.fare, 1000);
  assert.equal(p1.payment, 1000);
  assert.equal(p1.change, 0);
  assert.equal(p1.question, null);
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
        assert.equal(q.answer * 100, p.total, `question answer equals total (fare * count) ${where}`);
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

// Simulates continuous progress bar: serves `paxPerLeg` passengers per stop leg, then arrives at the next stop!
function playRun(stage, seed, { wrong = false, paxPerLeg = 2, maxDays = 3 } = {}) {
  const run = createRun(stage, { rng: mulberry32(seed) });
  const denoms = denomsFor(stage);
  run.start();
  let legServed = 0;

  for (let guard = 0; guard < 20000; guard++) {
    if (run.phase === 'complete' || run.phase === 'failed' || run.phase === 'gameover') return run;
    if (run.endless && run.day > maxDays) return run;

    if (run.phase === 'question') {
      const q = run.current.question;
      const choice = wrong ? q.options.find((o) => o !== q.answer) : q.answer;
      run.answer(choice);
    } else if (run.phase === 'paying') {
      const target = run.current.change + (wrong ? 100 : 0);
      if (target === 0 && !wrong) {
        run.submit(true);
      } else {
        for (const d of breakdown(target, denoms)) assert.notEqual(run.addMoney(d), null);
        assert.equal(run.givenTotal, target);
        run.submit(false);
      }
    } else if (run.phase === 'result') {
      legServed++;
      if (legServed >= paxPerLeg) {
        legServed = 0;
        run.arrive();
      } else {
        const nextPhase = run.next();
        if (nextPhase === 'failed' || nextPhase === 'gameover') return run;
      }
    }
  }
  throw new Error('run never ended');
}

test('perfect play completes every Normal stage with full lives and continuous passengers', () => {
  for (const id of ['tutorial', ...LEVEL_ORDER]) {
    const stage = getStage(id);
    const legs = stage.route.stops.length - 1;
    for (let seed = 1; seed <= 25; seed++) {
      const run = playRun(stage, seed, { paxPerLeg: 3 });
      assert.equal(run.phase, 'complete', `${id} seed ${seed}`);
      assert.equal(run.lives, stage.lives);
      assert.equal(run.served, legs * 3);
      assert.equal(run.correct, legs * 3);
      if (!stage.practice) assert.ok(run.score > 0);
    }
  }
});

test('always-wrong play loses lives and ends run with 0 score', () => {
  for (const id of [...LEVEL_ORDER, 'endless-easy', 'endless-medium', 'endless-hard']) {
    const stage = getStage(id);
    for (let seed = 1; seed <= 20; seed++) {
      const run = playRun(stage, seed, { wrong: true, paxPerLeg: 10 });
      assert.equal(run.phase, id.startsWith('endless') ? 'gameover' : 'failed', `${id} ${seed}`);
      assert.equal(run.lives, 0);
      assert.ok(run.served <= stage.lives && run.served >= 1);
      assert.equal(run.score, 0);
    }
  }
});

test('wrong "Magkano po?" answer deducts 1 heart in Normal/Endless (0 in Tutorial) and ends run at 0 lives', () => {
  // Tutorial: wrong fare-question answer costs no life
  const tut = createRun(STAGES.tutorial, { rng: mulberry32(1) });
  tut.start();
  assert.equal(tut.phase, 'question');
  const tutRes = tut.answer(20); // correct is 10
  assert.equal(tutRes.correct, false);
  assert.equal(tut.lives, 0);
  assert.equal(tut.phase, 'paying');

  // Level 1: wrong fare-question answer deducts 1 heart and resets streak
  const run = createRun(STAGES.level1, { rng: mulberry32(123) });
  run.start();
  let testedWrongQ = false;
  for (let i = 0; i < 30 && !testedWrongQ; i++) {
    if (run.phase === 'question') {
      const before = run.lives;
      const wrongOpt = run.current.question.options.find((o) => o !== run.current.question.answer);
      const res = run.answer(wrongOpt);
      assert.equal(res.correct, false);
      assert.equal(res.livesLeft, before - 1);
      assert.equal(run.lives, before - 1);
      assert.equal(run.streak, 0);
      testedWrongQ = true;
    } else {
      run.submit(run.current.change === 0);
      run.next();
    }
  }
  assert.ok(testedWrongQ, 'should have encountered a fare question');
});

test('Endless Mode uses lowered difficulty multipliers (0.5 / 0.75 / 1.0)', () => {
  assert.equal(getStage('endless-easy').mult, 0.5);
  assert.equal(getStage('endless-medium').mult, 0.75);
  assert.equal(getStage('endless-hard').mult, 1);
});

test('patience timeout removes 1 heart and ends run when hearts hit 0', () => {
  const run = createRun(STAGES.level3, { rng: mulberry32(42) }); // 3 lives
  run.start();
  for (let i = 0; i < 3; i++) {
    const res = run.timeout();
    assert.equal(res.timeout, true);
    assert.equal(res.livesLeft, 2 - i);
    run.next();
  }
  assert.equal(run.phase, 'failed');
  assert.equal(run.lives, 0);
});

test('Endless jumbles the 5 stops and switches to Day 2, Day 3, ... when reaching final stop with lives', () => {
  for (const id of ['endless-easy', 'endless-medium', 'endless-hard']) {
    const stage = getStage(id);
    const denoms = denomsFor(stage);
    const run = createRun(stage, { rng: mulberry32(99) });
    run.start();
    assert.equal(run.day, 1);
    assert.equal(run.route.stops[0], 'Terminal');
    assert.deepEqual(run.route.stops.slice(1).slice().sort(), ENDLESS_STOPS.slice().sort());

    const dayOrders = new Set([run.route.stops.slice(1).join(',')]);
    // Serve active passenger before arriving through 5 stops -> Day 2, 5 more -> Day 3, 5 more -> Day 4
    for (let step = 0; step < 15; step++) {
      if (run.phase === 'question') run.answer(run.current.question.answer);
      if (run.phase === 'paying') {
        if (run.current.change === 0) {
          run.submit(true);
        } else {
          for (const d of breakdown(run.current.change, denoms)) run.addMoney(d);
          run.submit(false);
        }
      }
      run.arrive();
      assert.equal(run.route.stops[0], 'Terminal');
      assert.deepEqual(run.route.stops.slice(1).slice().sort(), ENDLESS_STOPS.slice().sort());
      assert.ok(run.current.dest > run.stopIdx, 'new passenger destination must be strictly ahead of current origin');
      dayOrders.add(run.route.stops.slice(1).join(','));
    }
    assert.equal(run.day, 4);
    assert.equal(run.lives, 5);
    assert.ok(dayOrders.size > 1, 'Endless stops should be jumbled across days');
  }
});

test('jumbleRoute preserves Terminal at index 0 and all 5 stops', () => {
  const r = jumbleRoute(mulberry32(7), ROUTES.endlessEasy);
  assert.equal(r.stops[0], 'Terminal');
  assert.deepEqual(r.stops.slice(1).sort(), ENDLESS_STOPS.slice().sort());
  assert.ok(validateRoute(r));
});

test('fare questions never appear twice in a row and multiply fare by group size', () => {
  const run = createRun(STAGES.level1, { rng: mulberry32(123) });
  run.start();
  let prevAsked = false;
  let askedCount = 0;
  let multiAsked = 0;
  for (let i = 0; i < 60; i++) {
    const asked = run.phase === 'question';
    if (asked) {
      assert.equal(prevAsked, false, 'should never ask fare question twice in a row');
      askedCount++;
      assert.equal(run.current.question.answer * 100, run.current.fare * run.current.count);
      if (run.current.count > 1) multiAsked++;
      run.answer(run.current.question.answer);
    }
    prevAsked = asked;
    run.submit(run.current.change === 0);
    run.next();
  }
  assert.ok(askedCount > 0 && askedCount < 35, `occasional questions (${askedCount}/60)`);
  assert.ok(multiAsked > 0, 'multi-passenger questions should occur with multiplied answer');
});

test('tutorial never removes lives, retries wrong change, and supports question + hints + SAKTO NA', () => {
  const run = createRun(STAGES.tutorial, { rng: mulberry32(5) });
  run.start();
  // Passenger 1 starts with "Magkano po?" question + 3 hints available
  assert.equal(run.phase, 'question');
  assert.equal(run.hintsLeft, 3);
  assert.equal(run.useHint(), true);
  assert.equal(run.hintsLeft, 2);
  assert.equal(run.answer(10).correct, true);
  assert.equal(run.phase, 'paying');
  // Wrong change retries without losing lives
  run.addMoney(500);
  const r = run.submit();
  assert.equal(r.retry, true);
  assert.equal(run.phase, 'paying');
  assert.equal(run.givenTotal, 0);
  // Correct ₱10 change on Passenger 1
  run.addMoney(1000);
  assert.equal(run.submit().correct, true);
  // Next passenger keeps coming before Jollibee: Passenger 2 is exact ₱10 fare!
  assert.equal(run.next(), 'paying');
  assert.equal(run.current.change, 0);
  assert.equal(run.submit(true).correct, true);
  // Progress bar reaches Jollibee -> arrive() -> Palengke leg
  run.arrive();
  assert.equal(run.stopIdx, 1);
  // Progress bar reaches Palengke -> Tutorial complete!
  assert.equal(run.arrive(), 'complete');
});

test('actions in the wrong phase are ignored (no double submits)', () => {
  const run = createRun(STAGES.level1, { rng: mulberry32(3) });
  assert.equal(run.submit(), null); // before start
  assert.equal(run.arrive(), null); // before start
  run.start();
  if (run.phase === 'question') {
    assert.equal(run.addMoney(1000), null); // can't pay before answering
    run.answer(run.current.question.answer);
  }
  run.submit(true);
  assert.equal(run.submit(true), null); // second submit ignored
  assert.equal(run.addMoney(1000), null);
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
  for (let i = 0; i < 12 && !['complete', 'failed'].includes(run.phase); i++) {
    if (run.phase === 'question') {
      while (run.useHint()) used++;
      run.answer(run.current.question.answer);
    }
    if (run.phase === 'paying') run.submit(run.current.change === 0);
    if (run.phase === 'result') run.next();
  }
  assert.ok(used <= 3);
  const l3 = createRun(STAGES.level3);
  assert.equal(l3.hintsLeft, 0);
});

test('origin stop and passed stops can never be picked as a passenger destination', () => {
  for (const id of ALL_STAGES) {
    const stage = getStage(id);
    const n = stage.route.stops.length;
    for (let origin = 0; origin < n - 1; origin++) {
      const up = upcomingStops(stage.route, origin);
      assert.ok(up.length > 0, `${id} origin ${origin} should have upcoming stops`);
      for (const idx of up) {
        assert.ok(idx > origin && idx < n);
        assert.notEqual(stage.route.stops[idx], stage.route.stops[origin]);
      }
      for (let seed = 1; seed <= 50; seed++) {
        const p = makePassenger(mulberry32(seed), stage, origin);
        assert.equal(p.board, origin);
        assert.ok(p.dest > origin, `${id} origin ${origin} picked dest ${p.dest}`);
        assert.notEqual(stage.route.stops[p.dest], stage.route.stops[origin]);
      }
    }
    assert.deepEqual(upcomingStops(stage.route, n - 1), []);
    assert.throws(() => makePassenger(mulberry32(1), stage, n - 1));
  }
});

test('patience timer is always noticeably faster than leg duration on every timed stage', () => {
  for (const id of [...LEVEL_ORDER, 'endless-easy', 'endless-medium', 'endless-hard']) {
    const stage = getStage(id);
    assert.ok(stage.patienceSec > 0, `${id} should have patience timer`);
    assert.ok(
      stage.legSeconds - stage.patienceSec >= 15,
      `${id} patienceSec (${stage.patienceSec}) must be noticeably faster than legSeconds (${stage.legSeconds})`
    );
  }
});

test('anti-stall safeguard: arriving with an unanswered or unpaid passenger deducts 1 life and resets streak', () => {
  const stage = STAGES.level3; // 3 lives, 5 stops
  const denoms = denomsFor(stage);
  const run = createRun(stage, { rng: mulberry32(42) });
  run.start();

  // Serve first passenger cleanly on leg 0 to build streak = 1, then arrive cleanly at stop 1
  if (run.phase === 'question') run.answer(run.current.question.answer);
  if (run.current.change === 0) run.submit(true);
  else {
    for (const d of breakdown(run.current.change, denoms)) run.addMoney(d);
    run.submit(false);
  }
  assert.equal(run.streak, 1);
  assert.equal(run.lives, 3);
  run.arrive();
  assert.equal(run.lastMissedOnArrival, false);
  assert.equal(run.lives, 3);
  assert.equal(run.streak, 1);
  assert.equal(run.stopIdx, 1);
  assert.ok(run.current.dest > 1, 'after arriving at stop 1, new passenger must go past stop 1');

  // Now stall on leg 1 without serving anyone -> arrive() triggers missed-passenger penalty!
  assert.ok(run.phase === 'question' || run.phase === 'paying');
  run.arrive();
  assert.equal(run.lastMissedOnArrival, true);
  assert.equal(run.lives, 2);
  assert.equal(run.streak, 0);
  assert.equal(run.stopIdx, 2);
  assert.ok(run.current.dest > 2, 'after arriving at stop 2, new passenger must go past stop 2');

  // Stall 2 more legs -> lives hit 0 -> run fails instead of completing
  run.arrive();
  assert.equal(run.lives, 1);
  const finalPhase = run.arrive();
  assert.equal(finalPhase, 'failed');
  assert.equal(run.lives, 0);
});
