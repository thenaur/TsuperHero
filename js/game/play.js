// Gameplay screen: connects the Run (rules) to the pixel-art jeepney dashboard.
// Core flow:
//   1. Passengers keep paying (and occasionally ask "Magkano po?" for total fare)
//      while the bottom progress bar ticks pixel-by-pixel toward the next stop.
//   2. Player checks the Taripa and gives exact change (SUKLIAN) or exact fare (SAKTO NA).
//   3. Time bar snaps pixel-by-pixel and shifts Green -> Yellow -> Red as time runs out.
//   4. Reaching a stop fades to black, shows the stop landmark + "THANK YOU PO!",
//      then fades to black and resumes (or switches to Day 2/3/... in Endless Mode).
import { DENOMS, HINT_MS, COUNT_WORDS, WORDLIST_ALL, STOP_BACKGROUNDS } from './data.js?v=19';
import { createRun } from './session.js?v=19';
import { fareOf } from './logic.js?v=17';
import { formatAmount, formatPeso } from './money.js?v=17';
import { pesoWord, amountWord, capitalize } from './numbers.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const ROAD_LOOP_SRC = '../assets/RoadLoop.gif';
const FADE_MS = 500;
const THANK_YOU_MS = 3400;
const DAY_BANNER_MS = 1800;
const ROUTE_PIXEL_STEP = 4; // snap jeepney & yellow progress bar in 4px art-pixel steps
const TIMER_PIXEL_STEP = 6; // snap passenger timer bar in 6px art-pixel steps

function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') e.textContent = v;
    else if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) e.append(c);
  return e;
}

function formatDisplayMoney(centavos, showCentavos) {
  if (!showCentavos && centavos % 100 === 0) return String(centavos / 100);
  return formatAmount(centavos);
}

function shortStageBadge(stage, day = 1) {
  if (stage.id === 'tutorial') return 'LVL 0';
  if (stage.id.startsWith('level')) return `LVL ${stage.id.slice(5)}`;
  if (stage.id.startsWith('endless-')) return `DAY ${day}`;
  return stage.name.toUpperCase();
}

export class Play {
  constructor(stage, { bus, onEnd, rng } = {}) {
    this.stage = stage;
    this.bus = bus;
    this.onEnd = onEnd;
    this.run = createRun(stage, { rng });
    this.timers = new Set();
    this.ac = new AbortController();
    this.ended = false;
    this.hintOn = false;
    this.hintTimer = null;
    this.feedbackTimer = null;
    this.advanceTimer = null;
    this.panel = null;
    this.lastBubbleText = '';
    this.isAtStopScene = false;

    // Continuous route progress bar state (0.0 -> 1.0 across stops, snapped to pixel steps)
    this.routePct = 0;
    this.rafId = null;
    this.lastFrameTs = null;
    this.progressPaused = false;
    // In Tutorial, stay parked at Terminal while the player reads the guided steps on Passenger 1
    this.tutorialStartedMoving = !stage.practice;

    // Per-passenger patience timer (seconds)
    this.patienceMax = stage.patienceSec || 0;
    this.patienceLeft = this.patienceMax;

    this.buildStatic();
    this.bind();
  }

  // ---------- lifecycle ----------
  start() {
    this.run.start();
    this.routePct = 0;
    this.resetPatience();
    this.setRoadMoving(true);
    this.updateRouteBarVisual(0);
    this.render(true);
    this.startLoop();
  }

  destroy() {
    this.ended = true;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.ac.abort();
    this.hideFeedback();
    this.setDrawer(null, false);
    const curtain = $('fade-curtain');
    if (curtain) curtain.classList.remove('dark');
    const banner = $('day-banner');
    if (banner) banner.hidden = true;
  }

  later(ms, fn) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.ended) fn();
    }, ms);
    this.timers.add(t);
    return t;
  }

  cancel(t) {
    if (t) { clearTimeout(t); this.timers.delete(t); }
  }

  emit(event, data) { this.bus?.emit(event, data); }

  isMenuPaused() {
    const m = $('modal-menu');
    return !!(m && !m.hidden);
  }

  end() {
    if (this.ended) return;
    const summary = this.run.summary();
    this.destroy();
    this.onEnd?.(summary);
  }

  // ---------- stepped pixel-art progress bar + patience timer loop ----------
  currentLegSeconds() {
    const base = this.stage.legSeconds || 38;
    if (this.run.endless) return Math.max(24, base - (this.run.day - 1) * 2);
    return base;
  }

  resetPatience() {
    this.patienceMax = this.stage.patienceSec || 0;
    this.patienceLeft = this.patienceMax;
    this.updateTimerBarVisual();
  }

  updateTimerBarVisual() {
    const fill = $('timer-fill');
    const wrap = $('timer-bar-wrap');
    if (!fill) return;
    const pct = this.patienceMax > 0 ? Math.max(0, Math.min(1, this.patienceLeft / this.patienceMax)) : 1;

    // Snap timer width to chunky pixel-art blocks instead of smooth subpixels
    const innerW = wrap ? wrap.clientWidth : 386;
    if (innerW > 0) {
      const snappedPx = pct >= 1
        ? innerW
        : Math.min(innerW, Math.ceil((pct * innerW) / TIMER_PIXEL_STEP) * TIMER_PIXEL_STEP);
      fill.style.width = `${Math.max(0, snappedPx)}px`;
    } else {
      fill.style.width = `${pct * 100}%`;
    }

    // Color shifts: Green (> 55%) -> Yellow (25%..55%) -> Red (<= 25%)
    fill.classList.toggle('warn', pct <= 0.55 && pct > 0.25);
    fill.classList.toggle('danger', pct <= 0.25);
  }

  startLoop() {
    this.lastFrameTs = performance.now();
    const tick = (now) => {
      if (this.ended) return;
      const dt = Math.min(0.1, (now - this.lastFrameTs) / 1000);
      this.lastFrameTs = now;

      const paused = this.progressPaused || this.isAtStopScene || this.isMenuPaused();

      if (!paused) {
        // 1. Drain passenger patience timer in Normal & Endless while waiting for player input
        if (this.patienceMax > 0 && (this.run.phase === 'question' || this.run.phase === 'paying')) {
          this.patienceLeft = Math.max(0, this.patienceLeft - dt);
          this.updateTimerBarVisual();
          if (this.patienceLeft <= 0) {
            this.handleTimeout();
            this.rafId = requestAnimationFrame(tick);
            return;
          }
        }

        // 2. Continuously advance the bottom progress bar (snapped to pixel steps visually)
        if (this.tutorialStartedMoving) {
          const segs = Math.max(1, this.run.route.stops.length - 1);
          const segSize = 1 / segs;
          const targetNext = Math.min(1, (this.run.stopIdx + 1) * segSize);
          const speed = segSize / this.currentLegSeconds();

          this.routePct = Math.min(targetNext, this.routePct + speed * dt);
          this.updateRouteBarVisual(this.routePct);

          if (this.routePct >= targetNext - 0.0005) {
            this.routePct = targetNext;
            this.updateRouteBarVisual(this.routePct);
            this.arriveAtDestinationStop();
          }
        }
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  updateRouteBarVisual(pct) {
    const clamped = Math.max(0, Math.min(1, pct));
    const track = $('route-track-wrap');
    const fill = $('progress-fill');
    const jeep = $('mini-jeepney');
    const trackW = track ? track.clientWidth : 0;

    if (trackW > 0) {
      // Snap both the yellow fill and MiniJeepney to discrete pixel-art steps!
      const rawPx = clamped * trackW;
      const snappedPx = clamped >= 1
        ? trackW
        : Math.floor(rawPx / ROUTE_PIXEL_STEP) * ROUTE_PIXEL_STEP;
      if (fill) fill.style.width = `${snappedPx}px`;
      if (jeep) jeep.style.left = `${snappedPx}px`;
    } else {
      const p = `${clamped * 100}%`;
      if (fill) fill.style.width = p;
      if (jeep) jeep.style.left = p;
    }
  }

  setRoadMoving(moving, stopName = null) {
    const img = $('road-img');
    const hand = $('driver-hand');
    if (!img) return;
    if (moving) {
      if (!img.src.endsWith('RoadLoop.gif')) img.src = ROAD_LOOP_SRC;
      hand?.classList.remove('stopped');
    } else {
      const stillSrc = (stopName && STOP_BACKGROUNDS[stopName]) || STOP_BACKGROUNDS.Jollibee;
      img.src = stillSrc;
      hand?.classList.add('stopped');
    }
  }

  // ---------- fade-to-black stop arrival -> "THANK YOU PO!" -> fade-to-black resume ----------
  arriveAtDestinationStop() {
    if (this.isAtStopScene || this.ended) return;
    this.isAtStopScene = true;
    this.progressPaused = true;
    this.cancel(this.advanceTimer);
    this.advanceTimer = null;
    this.hideFeedback();
    this.setHint(false);

    const run = this.run;
    const stops = run.route.stops;
    const arrivedStopIdx = Math.min(run.stopIdx + 1, stops.length - 1);
    const arrivedStopName = stops[arrivedStopIdx];
    const isEndlessNewDay = run.endless && arrivedStopIdx >= run.lastStop;

    const curtain = $('fade-curtain');
    const banner = $('day-banner');
    if (banner) banner.hidden = true;

    this.showBubbleText('');
    curtain.classList.add('dark');
    sfx('stop');

    this.later(FADE_MS, () => {
      this.setRoadMoving(false, arrivedStopName);
      this.renderStopScene(arrivedStopIdx);
      this.showBubbleText('');

      curtain.classList.remove('dark');

      this.later(220, () => {
        this.showBubbleText('THANK YOU PO!', '', true);
      });

      this.later(FADE_MS + THANK_YOU_MS, () => {
        curtain.classList.add('dark');

        this.later(FADE_MS, () => {
          this.showBubbleText('');
          const phase = run.arrive();

          if (phase === 'complete' || phase === 'failed' || phase === 'gameover') {
            this.isAtStopScene = false;
            curtain.classList.remove('dark');
            return this.end();
          }

          const finishResume = () => {
            if (banner) banner.hidden = true;
            const segs = Math.max(1, run.route.stops.length - 1);
            this.routePct = run.stopIdx / segs;
            this.updateRouteBarVisual(this.routePct);
            this.resetPatience();

            this.isAtStopScene = false;
            this.setRoadMoving(true);
            this.progressPaused = false;
            this.emit('stop', run.stopIdx);
            this.render(false);
            this.showBubbleText('');

            curtain.classList.remove('dark');
            this.later(220, () => this.render(true));
          };

          if (isEndlessNewDay) {
            $('hud-stage').textContent = shortStageBadge(this.stage, run.day);
            this.buildRouteBar();
            this.buildFareTable();
            this.routePct = 0;
            this.updateRouteBarVisual(0);

            if (banner) {
              $('day-banner-title').textContent = `DAY ${run.day}`;
              $('day-banner-sub').textContent = 'NEW JUMBLED ROUTE!';
              banner.hidden = false;
            }
            this.later(DAY_BANNER_MS, finishResume);
          } else {
            finishResume();
          }
        });
      });
    });
  }

  renderStopScene(arrivedStopIdx) {
    $('paid-amount').textContent = '';
    $('given-amount').textContent = '';
    $('choices').hidden = true;
    for (const id of ['btn-suklian', 'btn-sakto', 'btn-undo', 'btn-clear']) $(id).disabled = true;
    for (const b of document.querySelectorAll('#tray-box .money')) b.disabled = true;

    for (const d of document.querySelectorAll('#progress-stops .stop-dot')) {
      const i = Number(d.dataset.i);
      d.classList.toggle('done', i < arrivedStopIdx);
      d.classList.toggle('here', i === arrivedStopIdx);
    }
    for (const l of document.querySelectorAll('#progress-stops .stop-label')) {
      const i = Number(l.dataset.i);
      l.classList.toggle('active-stop', i === arrivedStopIdx);
    }
  }

  // ---------- one-time & dynamic route setup ----------
  buildRouteBar() {
    const route = this.run.route;
    const n = route.stops.length;
    const stops = $('progress-stops');
    stops.replaceChildren();
    route.stops.forEach((name, i) => {
      const left = `${(i / Math.max(1, n - 1)) * 100}%`;
      stops.append(el('div', { class: 'stop-dot', style: `left:${left}`, dataset: { i } }));
      stops.append(el('div', { class: 'stop-label', style: `left:${left}`, text: name.toUpperCase(), dataset: { i } }));
    });
  }

  buildFareTable() {
    const route = this.run.route;
    const head = el('tr', {}, [
      el('th', { class: 'corner', text: 'From \\ To' }),
      ...route.stops.slice(1).map((s) => el('th', { text: s })),
    ]);
    const rows = route.stops.slice(0, -1).map((from, i) =>
      el('tr', { dataset: { row: i } }, [
        el('th', { text: from }),
        ...route.stops.slice(1).map((_, k) => {
          const j = k + 1;
          return el('td', { text: j > i ? formatPeso(fareOf(route, i, j)) : '–' });
        }),
      ]));
    $('fare-table').replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
  }

  buildStatic() {
    const { stage, run } = this;

    $('hud-stage').textContent = shortStageBadge(stage, run.day);
    $('hud-lives').hidden = false;
    $('timer-bar-wrap').hidden = false;
    $('hud-score-wrap').hidden = run.practice;
    $('hud-streak-wrap').hidden = run.practice;
    $('hud-hint-top').hidden = !(stage.hints > 0);
    $('btn-hint').hidden = !(stage.hints > 0);
    $('bottom-score-badge').hidden = run.practice;

    // Build pixel heart icons using custom assets/hearts.png
    const heartTotal = run.practice ? 5 : Math.max(1, run.maxLives);
    const livesEl = $('hud-lives');
    livesEl.replaceChildren();
    for (let i = 0; i < heartTotal; i++) {
      livesEl.append(el('img', { class: 'heart-icon', src: '../assets/hearts.png?v=10', alt: 'Life' }));
    }

    // Money container (bills in top recessed slot, coins in lower row — pure pixel art)
    const billsWrap = $('tray-bills');
    const coinsWrap = $('tray-coins');
    billsWrap.replaceChildren();
    coinsWrap.replaceChildren();
    for (const d of DENOMS) {
      if (d.centavo && !stage.centavos) continue;
      const children = d.centavo ? [el('span', { class: 'money-tag', text: d.label })] : [];
      const b = el('button', {
        class: `money ${d.kind} ${d.id}`,
        type: 'button',
        'aria-label': d.label,
        title: d.label,
        dataset: { value: d.value },
      }, children);
      (d.kind === 'bill' ? billsWrap : coinsWrap).append(b);
    }

    this.buildRouteBar();
    this.buildFareTable();

    // Salita ng Tsuper
    const words = (stage.vocab || WORDLIST_ALL).slice().sort((a, b) => a - b);
    $('word-list').replaceChildren(...words.map((v) =>
      el('li', {}, [el('b', { text: capitalize(pesoWord(v)) }), ` = ${v}`])));
  }

  bind() {
    const on = (node, ev, fn) => node.addEventListener(ev, fn, { signal: this.ac.signal });
    on($('tray-box'), 'click', (e) => {
      const b = e.target.closest('[data-value]');
      if (b) this.addMoney(Number(b.dataset.value));
    });
    on($('btn-undo'), 'click', () => this.changeMoney(() => this.run.undoMoney()));
    on($('btn-clear'), 'click', () => this.changeMoney(() => this.run.clearMoney()));
    on($('btn-suklian'), 'click', () => this.submit(false));
    on($('btn-sakto'), 'click', () => this.submit(true));
    on($('choices'), 'click', (e) => {
      const b = e.target.closest('.choice');
      if (b) this.answer(Number(b.dataset.value));
    });
    on($('btn-hint'), 'click', () => this.useHint());
    on($('side-tabs'), 'click', (e) => {
      const b = e.target.closest('[data-panel]');
      if (b) this.setDrawer(this.panel === b.dataset.panel ? null : b.dataset.panel);
    });
    on($('drawer-close'), 'click', () => this.setDrawer(null));
    on($('feedback-btn'), 'click', () => this.advance());
  }

  // ---------- actions ----------
  addMoney(value) {
    if (this.isAtStopScene || this.run.addMoney(value) === null) return;
    sfx('coin');
    this.render();
    this.emit('change', this.run.givenTotal);
  }

  changeMoney(action) {
    if (this.isAtStopScene || action() === null) return;
    sfx('tap');
    this.render();
    this.emit('change', this.run.givenTotal);
  }

  answer(value) {
    if (this.isAtStopScene) return;
    const a = this.run.answer(value);
    if (!a) return;
    this.setHint(false);
    sfx(a.correct ? 'correct' : 'wrong');
    this.render(true);
    if (!a.correct) {
      this.showFeedback(`"${capitalize(pesoWord(a.value))}" is ₱${a.value}. Correct fare: ₱${a.answer}.`, 'bad');
      this.feedbackTimer = this.later(1800, () => this.hideFeedback());
    }
    this.emit('answer', a);
  }

  useHint() {
    if (this.isAtStopScene || this.hintOn || !this.run.useHint()) return;
    sfx('tap');
    this.setHint(true);
    this.emit('hint', this.run.hintsLeft);
  }

  setHint(on) {
    this.hintOn = on;
    this.cancel(this.hintTimer);
    this.hintTimer = on ? this.later(HINT_MS, () => this.setHint(false)) : null;
    if (!this.isAtStopScene) this.render();
  }

  handleTimeout() {
    if (this.isAtStopScene) return;
    const res = this.run.timeout();
    if (!res) return;
    sfx('wrong');
    this.setHint(false);
    if (res.livesLeft <= 0) this.progressPaused = true;
    this.render();
    const lost = res.livesLeft > 0 ? '\nYou lost 1 heart.' : '\nNo hearts left!';
    this.showFeedback(`Too slow! The passenger got impatient.${lost}`, 'bad', true);
  }

  submit(exact) {
    if (this.isAtStopScene) return;
    const res = this.run.submit(exact);
    if (!res) return;
    this.emit('submit', res);
    if (res.retry) {
      sfx('wrong');
      this.render();
      this.showFeedback('Wrong change! Try again!', 'bad');
      this.feedbackTimer = this.later(1600, () => this.hideFeedback());
      return;
    }

    // Start the progress bar ticking once the player finishes the first guided Tutorial passenger
    if (this.run.practice && !this.tutorialStartedMoving) {
      this.tutorialStartedMoving = true;
    }

    if (!this.run.practice && res.livesLeft <= 0) {
      this.progressPaused = true;
    }

    this.render();
    if (res.correct) {
      sfx('correct');
      this.showBubbleText('SALAMAT PO!', '', true);
      this.cancel(this.advanceTimer);
      this.advanceTimer = this.later(850, () => this.advance());
    } else {
      sfx('wrong');
      const lost = res.livesLeft > 0 ? '\nYou lost 1 heart.' : '\nNo hearts left!';
      this.showFeedback(`Wrong change! Correct change: ₱${formatAmount(res.expected)}.\nYou gave: ₱${formatAmount(res.given)}.${lost}`, 'bad', true);
    }
  }

  advance() {
    this.cancel(this.advanceTimer);
    this.advanceTimer = null;
    if (this.isAtStopScene) return;
    const phase = this.run.next();
    if (!phase) return;
    this.hideFeedback();
    if (phase === 'failed' || phase === 'gameover') return this.end();
    this.resetPatience();
    this.render(true);
  }

  setDrawer(panel, emit = true) {
    this.panel = panel;
    $('drawer').hidden = !panel;
    $('panel-taripa').hidden = panel !== 'taripa';
    $('panel-salita').hidden = panel !== 'salita';
    for (const t of document.querySelectorAll('#side-tabs [data-panel]')) {
      t.classList.toggle('active', t.dataset.panel === panel);
    }
    if (emit) { sfx('tap'); this.emit('drawer', panel); }
  }

  showFeedback(text, kind, withButton = false) {
    this.cancel(this.feedbackTimer);
    this.feedbackTimer = null;
    $('feedback-text').textContent = text;
    $('feedback').className = kind;
    $('feedback-btn').hidden = !withButton;
    $('feedback').hidden = false;
  }

  hideFeedback() {
    this.cancel(this.feedbackTimer);
    this.feedbackTimer = null;
    $('feedback').hidden = true;
  }

  // ---------- speech bubble stepped pixel pop-in + automatic font fitting ----------
  showBubbleText(text, note = '', forcePop = false, noteClass = '') {
    const bubble = $('speech-bubble');
    const textEl = $('speech-text');
    const noteEl = $('speech-note');

    if (!text) {
      bubble.hidden = true;
      this.lastBubbleText = '';
      return;
    }

    const changed = text !== this.lastBubbleText;
    this.lastBubbleText = text;
    bubble.hidden = false;
    textEl.textContent = text;
    noteEl.textContent = note;
    noteEl.className = noteClass;

    let size = 15;
    textEl.style.fontSize = `${size}px`;
    while (size > 11 && bubble.offsetHeight > 128) {
      size -= 1;
      textEl.style.fontSize = `${size}px`;
    }

    if (changed || forcePop) {
      bubble.classList.remove('pop-in');
      void bubble.offsetWidth;
      bubble.classList.add('pop-in');
    }
  }

  // ---------- drawing ----------
  render(forcePop = false) {
    if (this.isAtStopScene) return;

    const { run } = this;
    const p = run.current;
    const phase = run.phase;
    const stops = run.route.stops;

    // Hearts, score, streak, hints
    const activeLives = run.practice ? 5 : run.lives;
    document.querySelectorAll('#hud-lives .heart-icon').forEach((img, i) => {
      img.classList.toggle('lost', i >= activeLives);
    });
    $('hud-stage').textContent = shortStageBadge(this.stage, run.day);
    $('hud-score').textContent = run.score;
    $('bottom-score').textContent = run.score;
    $('hud-streak').textContent = run.streak;
    $('hint-count').textContent = run.hintsLeft;

    // Passenger dialogue bubble (strictly passenger speech — never system "Correct!" text)
    let speech = '';
    if (p) {
      const destUpper = stops[p.dest].toUpperCase();
      const countUpper = COUNT_WORDS[p.count].toUpperCase();
      if (phase === 'question') {
        speech = p.count === 1
          ? `MAGKANO PO PAPUNTANG ${destUpper}?`
          : `MAGKANO PO PARA SA ${countUpper} PAPUNTANG ${destUpper}?`;
      } else {
        speech = `${countUpper} PO PAPUNTANG ${destUpper}, BAYAD PO! (${amountWord(p.payment).toUpperCase()})`;
      }
    }
    this.showBubbleText(speech, '', forcePop);

    // Fare question choices + pixel-art "?" hint button
    const asking = phase === 'question';
    $('choices').hidden = !asking;
    if (asking) {
      const btns = document.querySelectorAll('#choices .choice');
      p.question.options.forEach((v, i) => {
        btns[i].dataset.value = v;
        btns[i].textContent = this.hintOn ? `₱${v}` : pesoWord(v).toUpperCase();
      });
      $('btn-hint').disabled = this.hintOn || run.hintsLeft <= 0;
    }

    // Payment & change display (SukliContainer)
    const paying = phase === 'paying';
    const showPaid = p && (phase === 'paying' || phase === 'result');
    $('paid-amount').textContent = showPaid ? formatDisplayMoney(p.payment, this.stage.centavos) : asking ? '—' : '';
    $('given-amount').textContent = paying || phase === 'result' ? formatDisplayMoney(run.givenTotal, this.stage.centavos) : '';

    for (const id of ['btn-suklian', 'btn-sakto']) $(id).disabled = !paying;
    $('btn-undo').disabled = !paying || !run.given.length;
    $('btn-clear').disabled = !paying || !run.given.length;
    for (const b of document.querySelectorAll('#tray-box .money')) b.disabled = !paying;

    // Highlight active stop & taripa row
    for (const d of document.querySelectorAll('#progress-stops .stop-dot')) {
      const i = Number(d.dataset.i);
      d.classList.toggle('done', i < run.stopIdx);
      d.classList.toggle('here', i === run.stopIdx);
    }
    for (const l of document.querySelectorAll('#progress-stops .stop-label')) {
      const i = Number(l.dataset.i);
      l.classList.toggle('active-stop', i === run.stopIdx);
    }
    for (const r of document.querySelectorAll('#fare-table tbody tr')) {
      r.classList.toggle('here', Number(r.dataset.row) === run.stopIdx);
    }
  }
}
