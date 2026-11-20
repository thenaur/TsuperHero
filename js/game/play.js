// Gameplay screen: connects the Run (rules) to the page. All drawing happens in render().
import { DENOMS, HINT_MS, DRIVE_MS, COUNT_WORDS, WORDLIST_ALL } from './data.js';
import { createRun } from './session.js';
import { fareOf } from './logic.js';
import { formatAmount, formatPeso } from './money.js';
import { pesoWord, amountWord, capitalize } from './numbers.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const DENOM_BY_VALUE = new Map(DENOMS.map((d) => [d.value, d]));

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
    this.panel = null; // which drawer is open: 'taripa' | 'salita' | null
    this.buildStatic();
    this.bind();
  }

  // ---------- lifecycle ----------
  start() {
    this.run.start();
    this.render();
    if (this.run.phase === 'driving') this.drive();
  }

  destroy() {
    this.ended = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.ac.abort();
    this.hideFeedback();
    this.setDrawer(null, false);
    $('windshield').classList.remove('driving');
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

  end() {
    if (this.ended) return;
    const summary = this.run.summary();
    this.destroy();
    this.onEnd?.(summary);
  }

  // ---------- one-time setup for this stage ----------
  buildStatic() {
    const { stage, run } = this;
    const route = stage.route;
    const n = route.stops.length;

    $('hud-stage').textContent = stage.name;
    $('hud-lives').hidden = run.practice;
    $('hud-score-wrap').hidden = run.practice;
    $('hud-streak-wrap').hidden = run.practice;
    $('btn-hint').hidden = !(stage.hints > 0);

    // Money container
    const bills = el('div', { class: 'tray-row bills' });
    const coins = el('div', { class: 'tray-row coins' });
    for (const d of DENOMS) {
      if (d.centavo && !stage.centavos) continue;
      const b = el('button', { class: `money ${d.kind} ${d.id}`, type: 'button', 'aria-label': d.label, dataset: { value: d.value } }, [
        el('span', { text: d.label }),
      ]);
      (d.kind === 'bill' ? bills : coins).append(b);
    }
    $('tray').replaceChildren(bills, coins);

    // Route progress bar
    const stops = $('progress-stops');
    stops.replaceChildren();
    route.stops.forEach((name, i) => {
      const left = `${(i / (n - 1)) * 100}%`;
      stops.append(el('div', { class: 'stop-dot', style: `left:${left}`, dataset: { i } }));
      stops.append(el('div', { class: 'stop-label', style: `left:${left}`, text: name }));
    });

    // Fare matrix (taripa)
    const head = el('tr', {}, [el('th', { class: 'corner', text: 'Mula \\ Hanggang' }), ...route.stops.slice(1).map((s) => el('th', { text: s }))]);
    const rows = route.stops.slice(0, -1).map((from, i) =>
      el('tr', { dataset: { row: i } }, [
        el('th', { text: from }),
        ...route.stops.slice(1).map((_, k) => {
          const j = k + 1;
          return el('td', { text: j > i ? formatPeso(fareOf(route, i, j)) : '–' });
        }),
      ]));
    $('fare-table').replaceChildren(el('thead', {}, head), el('tbody', {}, rows));

    // Salita ng Tsuper
    const words = (stage.vocab || WORDLIST_ALL).slice().sort((a, b) => a - b);
    $('word-list').replaceChildren(...words.map((v) =>
      el('li', {}, [el('b', { text: capitalize(pesoWord(v)) }), ` = ${v}`])));
  }

  bind() {
    const on = (node, ev, fn) => node.addEventListener(ev, fn, { signal: this.ac.signal });
    on($('tray'), 'click', (e) => {
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
    if (this.run.addMoney(value) === null) return;
    sfx('coin');
    this.render();
    this.emit('change', this.run.givenTotal);
  }

  changeMoney(action) {
    if (action() === null) return;
    sfx('tap');
    this.render();
    this.emit('change', this.run.givenTotal);
  }

  answer(value) {
    const a = this.run.answer(value);
    if (!a) return;
    this.setHint(false);
    sfx(a.correct ? 'correct' : 'wrong');
    this.render();
    this.emit('answer', a);
  }

  useHint() {
    if (this.hintOn || !this.run.useHint()) return;
    sfx('tap');
    this.setHint(true);
  }

  setHint(on) {
    this.hintOn = on;
    this.cancel(this.hintTimer);
    this.hintTimer = on ? this.later(HINT_MS, () => this.setHint(false)) : null;
    this.render();
  }

  submit(exact) {
    const res = this.run.submit(exact);
    if (!res) return;
    this.emit('submit', res);
    if (res.retry) { // tutorial: no penalty, try again
      sfx('wrong');
      this.render();
      this.showFeedback('Mali ang sukli. Subukan ulit!', 'bad');
      this.feedbackTimer = this.later(1800, () => this.hideFeedback());
      return;
    }
    this.render();
    if (res.correct) {
      sfx('correct');
      this.showFeedback(this.run.practice ? 'Tama! Salamat po!' : `Tama! Salamat po!  +${res.points}`, 'good');
      this.later(1300, () => this.advance());
    } else {
      sfx('wrong');
      const lost = res.livesLeft > 0 ? `\nNabawasan ka ng isang buhay.` : '';
      this.showFeedback(`Mali! Ang tamang sukli ay ₱${formatAmount(res.expected)}.\nBinigay mo: ₱${formatAmount(res.given)}.${lost}`, 'bad', true);
    }
  }

  advance() {
    const phase = this.run.next();
    if (!phase) return; // already advanced (double click)
    this.hideFeedback();
    if (phase === 'failed' || phase === 'gameover') return this.end();
    if (phase === 'driving') return this.drive();
    this.render();
  }

  drive() {
    const run = this.run;
    const n = run.route.stops.length;
    const target = run.stopIdx + 1;
    this.render();
    const fill = $('progress-fill');
    fill.style.transition = `width ${DRIVE_MS}ms linear`;
    fill.style.width = `${(target / (n - 1)) * 100}%`;
    $('windshield').classList.add('driving');
    this.later(DRIVE_MS, () => {
      $('windshield').classList.remove('driving');
      const phase = run.arrive();
      if (phase === 'complete') return this.end();
      // Endless loops back to the first stop: jump the bar back without animating.
      fill.style.transition = 'none';
      fill.style.width = `${(run.stopIdx / (n - 1)) * 100}%`;
      void fill.offsetWidth;
      fill.style.transition = '';
      sfx('stop');
      this.emit('stop', run.stopIdx);
      if (phase === 'driving') return this.drive(); // nobody boarded here
      this.render();
    });
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

  // ---------- drawing ----------
  render() {
    const { run } = this;
    const p = run.current;
    const phase = run.phase;
    const stops = run.route.stops;
    const n = stops.length;

    // HUD
    $('hud-lives').textContent = '♥'.repeat(run.lives) + '♡'.repeat(Math.max(0, run.maxLives - run.lives));
    $('hud-score').textContent = run.score;
    $('hud-streak').textContent = run.streak;
    $('hint-count').textContent = run.hintsLeft;

    // Passenger speech (shown in the mirror box)
    let speech = '';
    let note = '';
    let noteClass = '';
    if (phase === 'driving') {
      speech = `Papunta sa ${stops[Math.min(run.stopIdx + 1, n - 1)]}...`;
    } else if (p) {
      const intro = `${COUNT_WORDS[p.count]} po, hanggang ${stops[p.dest]}.`;
      speech = phase === 'question' ? `${intro} Magkano po?` : `${intro} Bayad po, ${amountWord(p.payment)}!`;
      const a = run.lastAnswer;
      if (a && a.correct) {
        note = `Tama! ${capitalize(pesoWord(a.answer))} = ₱${a.answer} bawat isa.`;
        noteClass = 'good';
      } else if (a) {
        note = `Ang '${pesoWord(a.value)}' ay ${a.value}. Ang pamasahe ay ${pesoWord(a.answer)} (₱${a.answer}).`;
        noteClass = 'bad';
      }
    }
    $('speech-text').textContent = speech;
    $('speech-note').textContent = note;
    $('speech-note').className = noteClass;
    $('passenger').classList.toggle('empty', !p || phase === 'driving');
    $('passenger').dataset.count = p ? p.count : 0;

    // Fare question choices
    const asking = phase === 'question';
    $('choices').hidden = !asking;
    if (asking) {
      const btns = document.querySelectorAll('#choices .choice');
      p.question.options.forEach((v, i) => {
        btns[i].dataset.value = v;
        btns[i].textContent = this.hintOn ? `₱${v}` : capitalize(pesoWord(v));
      });
      $('btn-hint').disabled = this.hintOn || run.hintsLeft <= 0;
    }

    // Payment and change
    const paying = phase === 'paying';
    const showPaid = p && (phase === 'paying' || phase === 'result');
    $('paid-amount').textContent = showPaid ? formatAmount(p.payment) : asking ? '—' : '0.00';
    $('given-amount').textContent = formatAmount(run.givenTotal);
    const counts = new Map();
    for (const v of run.given) counts.set(v, (counts.get(v) || 0) + 1);
    $('given-list').textContent = [...counts].sort((a, b) => b[0] - a[0])
      .map(([v, c]) => `${DENOM_BY_VALUE.get(v).label}×${c}`).join('  ');
    for (const id of ['btn-suklian', 'btn-sakto']) $(id).disabled = !paying;
    $('btn-undo').disabled = !paying || !run.given.length;
    $('btn-clear').disabled = !paying || !run.given.length;
    for (const b of document.querySelectorAll('#tray .money')) b.disabled = !paying;

    // Route progress
    if (phase !== 'driving') $('progress-fill').style.width = `${(run.stopIdx / (n - 1)) * 100}%`;
    for (const d of document.querySelectorAll('#progress-stops .stop-dot')) {
      const i = Number(d.dataset.i);
      d.classList.toggle('done', i <= run.stopIdx);
      d.classList.toggle('here', i === run.stopIdx && phase !== 'driving');
    }
    for (const r of document.querySelectorAll('#fare-table tbody tr')) {
      r.classList.toggle('here', Number(r.dataset.row) === run.stopIdx);
    }
  }
}
