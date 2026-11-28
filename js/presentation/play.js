// Gameplay screen: connects the Run (rules) to the pixel-art jeepney dashboard.
// Core flow:
//   1. Passengers keep paying (and occasionally ask "Magkano po?" for total fare)
//      while the bottom progress bar ticks pixel-by-pixel toward the next stop.
//   2. Player checks the Taripa and gives exact change (SUKLIAN) or exact fare (SAKTO NA).
//   3. Time bar snaps pixel-by-pixel and shifts Green -> Yellow -> Red as time runs out.
//   4. Reaching a stop fades to black, shows the stop landmark + "THANK YOU PO!",
//      then fades to black and resumes (or switches to Day 2/3/... in Endless Mode).
import { DENOMS, HINT_MS, COUNT_WORDS, WORDLIST_ALL } from '../domain/data.js?v=29';
import { fareOf } from '../domain/logic.js?v=26';
import { formatAmount, formatPeso } from '../domain/money.js?v=18';
import { pesoWord, amountWord, capitalize } from '../domain/numbers.js?v=1';
import { findCustomItem, isItemUnlocked } from '../domain/progress-rules.js?v=29';
import { createRun } from '../application/session.js?v=26';
import {
  DEFAULT_ROAD_LOOP_SRC,
  DEFAULT_INTERIOR_SRC,
  STOP_BACKGROUNDS,
  getCustomAssets,
} from './assets.js?v=1';

const $ = (id) => document.getElementById(id);
const FADE_MS = 500;
const THANK_YOU_MS = 3400;
const DAY_BANNER_MS = 2000;
const STOP_APPROACH_CUTOFF_SEC = 8; // Stop spawning new passengers in the final seconds before a stop
const ROUTE_PIXEL_STEP = 4; // snap jeepney & yellow progress bar in 4px art-pixel steps
const TIMER_PIXEL_STEP = 6; // snap passenger timer bar in 6px art-pixel steps

function freezeGifToCanvas(imgEl, canvasEl) {
  if (!imgEl || !canvasEl || !imgEl.complete || !imgEl.naturalWidth || !imgEl.naturalHeight) return false;
  canvasEl.width = imgEl.naturalWidth;
  canvasEl.height = imgEl.naturalHeight;
  const ctx = canvasEl.getContext('2d');
  if (!ctx) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  ctx.drawImage(imgEl, 0, 0, canvasEl.width, canvasEl.height);
  return true;
}

/** Freeze or unfreeze RoadLoop.gif and DriverHand.gif onto static canvas overlays (used while MENU is open). */
export function setAnimationsFrozen(frozen) {
  const pairs = [
    [$('road-img'), $('road-freeze')],
    [$('driver-hand'), $('hand-freeze')],
  ];
  for (const [img, canvas] of pairs) {
    if (!img || !canvas) continue;
    if (frozen) {
      if (freezeGifToCanvas(img, canvas)) {
        canvas.classList.toggle('stopped', img.classList.contains('stopped'));
        canvas.hidden = false;
        img.classList.add('gif-frozen');
      }
    } else {
      canvas.hidden = true;
      img.classList.remove('gif-frozen');
    }
  }
}

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
  constructor(stage, { bus, onEnd, rng, profile, audio } = {}) {
    this.stage = stage;
    this.bus = bus;
    this.onEnd = onEnd;
    this.profile = profile || null;
    this.sfx = (name) => audio?.sfx?.(name);
    this.run = createRun(stage, { rng });
    this.roadLoopSrc = DEFAULT_ROAD_LOOP_SRC;
    this.stopBackgrounds = STOP_BACKGROUNDS;
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
    this.coastingToStop = false;

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

    this.applyCustomization(this.profile);
    this.buildStatic();
    this.bind();
  }

  applyCustomization(profile) {
    const eq = profile?.equipped || {};

    // 1. Scenery: sync driving RoadLoop GIF + all 5 destination landmark stills
    const sceneryItem = findCustomItem('scenery', eq.scenery);
    if (sceneryItem && isItemUnlocked(profile, sceneryItem)) {
      const sceneryAssets = getCustomAssets(sceneryItem.id);
      this.roadLoopSrc = sceneryAssets.roadGif || DEFAULT_ROAD_LOOP_SRC;
      this.stopBackgrounds = sceneryAssets.stopBackgrounds || STOP_BACKGROUNDS;
    } else {
      this.roadLoopSrc = DEFAULT_ROAD_LOOP_SRC;
      this.stopBackgrounds = STOP_BACKGROUNDS;
    }

    // 2. Decor: mount hanging ornament beneath the rear-view mirror
    const decorEl = $('jeep-decor');
    const decorItem = findCustomItem('decor', eq.decor);
    if (decorEl) {
      decorEl.classList.remove('decor-dice', 'decor-freshener', 'decor-lily');
      const decorAssets = decorItem ? getCustomAssets(decorItem.id) : null;
      if (decorItem && isItemUnlocked(profile, decorItem) && decorAssets?.decorImg) {
        decorEl.src = decorAssets.decorImg;
        decorEl.alt = decorItem.name;
        decorEl.classList.add(decorItem.id);
        decorEl.hidden = false;
      } else {
        decorEl.hidden = true;
      }
    }

    // 3. Jeep Interior: swap overlay cutout when available & adjust #side-tabs clearance
    const interiorEl = $('jeep-interior');
    const sideTabs = $('side-tabs');
    const interiorItem = findCustomItem('interior', eq.interior);
    if (interiorEl) {
      const interiorAssets = interiorItem ? getCustomAssets(interiorItem.id) : null;
      if (interiorItem && isItemUnlocked(profile, interiorItem) && interiorAssets?.interiorImg) {
        interiorEl.src = interiorAssets.interiorImg;
        if (sideTabs && interiorAssets.sideTabsTop) {
          sideTabs.style.top = `${interiorAssets.sideTabsTop}px`;
        }
      } else {
        interiorEl.src = DEFAULT_INTERIOR_SRC;
        if (sideTabs) sideTabs.style.top = '';
      }
    }
  }

  // ---------- lifecycle ----------
  start() {
    this.run.start();
    this.routePct = 0;
    this.coastingToStop = false;
    this.resetPatience();
    this.setRoadMoving(true);
    this.updateRouteBarVisual(0);
    setAnimationsFrozen(false);

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!this.ended && this.panel) this.fitDrawerContent();
      });
    }

    if (this.run.endless) {
      // Fade smoothly into the Day 1 transition screen, hold, then fade out to the road
      const curtain = $('fade-curtain');
      this.render(false);
      this.showBubbleText('');
      this.isAtStopScene = true;
      this.progressPaused = true;
      if (curtain) {
        curtain.classList.remove('instant', 'dark');
        void curtain.offsetWidth;
        curtain.classList.add('dark');
      }
      this.showDayBanner(this.run.day, '', false);
      this.startLoop();
      this.later(FADE_MS + DAY_BANNER_MS, () => {
        this.hideDayBanner();
        this.isAtStopScene = false;
        this.progressPaused = false;
        this.resetPatience();
        this.render(false);
        this.showBubbleText('');
        if (curtain) curtain.classList.remove('dark');
        this.later(FADE_MS, () => {
          const banner = $('day-banner');
          if (banner && !banner.classList.contains('visible')) banner.hidden = true;
        });
        this.later(260, () => this.render(true));
      });
      return;
    }

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
    setAnimationsFrozen(false);
    const curtain = $('fade-curtain');
    if (curtain) curtain.classList.remove('dark', 'instant');
    const banner = $('day-banner');
    if (banner) {
      banner.classList.remove('visible', 'instant');
      banner.hidden = true;
    }
  }

  showDayBanner(day, subtitle = '', immediate = false) {
    const banner = $('day-banner');
    if (!banner) return;
    $('day-banner-title').textContent = `DAY ${day}`;
    const subEl = $('day-banner-sub');
    if (subEl) {
      subEl.textContent = subtitle;
      subEl.hidden = !subtitle;
    }
    const heartsWrap = $('day-banner-hearts');
    if (heartsWrap) {
      heartsWrap.replaceChildren();
      const total = Math.max(1, this.run.maxLives || 5);
      for (let i = 0; i < total; i++) {
        const cls = i >= this.run.lives ? 'heart-icon lost' : 'heart-icon';
        heartsWrap.append(el('img', { class: cls, src: '../assets/hearts.png?v=10', alt: 'Life' }));
      }
    }
    const livesTxt = $('day-banner-lives-text');
    if (livesTxt) {
      livesTxt.textContent = `LIVES LEFT: ${this.run.lives} / ${Math.max(1, this.run.maxLives || 5)}`;
    }
    banner.hidden = false;
    if (immediate) {
      banner.classList.add('instant', 'visible');
      void banner.offsetWidth;
      banner.classList.remove('instant');
    } else {
      banner.classList.remove('instant', 'visible');
      void banner.offsetWidth;
      banner.classList.add('visible');
    }
  }

  hideDayBanner() {
    const banner = $('day-banner');
    if (!banner) return;
    banner.classList.remove('visible');
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
    const minLeg = this.stage.patienceSec > 0 ? this.stage.patienceSec + 10 : 24;
    if (this.run.endless) return Math.max(minLeg, base - (this.run.day - 1) * 2);
    return base;
  }

  remainingLegSeconds() {
    const segs = Math.max(1, this.run.route.stops.length - 1);
    const segSize = 1 / segs;
    const targetNext = Math.min(1, (this.run.stopIdx + 1) * segSize);
    const speed = segSize / this.currentLegSeconds();
    return Math.max(0, (targetNext - this.routePct) / speed);
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

      const feedbackBlocking = !($('feedback')?.hidden) && !($('feedback-btn')?.hidden);
      const paused = this.progressPaused || this.isAtStopScene || this.isMenuPaused() || feedbackBlocking;

      if (!paused) {
        // 1. Drain passenger patience timer in Normal & Endless while waiting for player input
        if (!this.coastingToStop && this.patienceMax > 0 && (this.run.phase === 'question' || this.run.phase === 'paying')) {
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
      if (img.getAttribute('src') !== this.roadLoopSrc) img.src = this.roadLoopSrc;
      hand?.classList.remove('stopped');
    } else {
      const stillSrc = (stopName && this.stopBackgrounds[stopName]) || this.stopBackgrounds.Jollibee;
      img.src = stillSrc;
      hand?.classList.add('stopped');
    }
  }

  // ---------- fade-to-black stop arrival -> "THANK YOU PO!" -> fade-to-black resume ----------
  arriveAtDestinationStop() {
    if (this.isAtStopScene || this.ended) return;
    this.isAtStopScene = true;
    this.coastingToStop = false;
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

    const missedOnArrival = !run.practice && (run.phase === 'question' || run.phase === 'paying');

    this.showBubbleText('');
    if (missedOnArrival) {
      this.sfx('wrong');
      const icons = document.querySelectorAll('#hud-lives .heart-icon');
      const nextLives = Math.max(0, run.lives - 1);
      icons.forEach((img, i) => img.classList.toggle('lost', i >= nextLives));
      this.triggerHeartLoss($('timer-bar-wrap'), nextLives);
    } else {
      this.sfx('stop');
    }
    curtain.classList.add('dark');

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
            this.hideDayBanner();
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
            this.later(FADE_MS, () => {
              if (banner && !banner.classList.contains('visible')) banner.hidden = true;
            });
            this.later(260, () => this.render(true));
          };

          if (isEndlessNewDay) {
            $('hud-stage').textContent = shortStageBadge(this.stage, run.day);
            this.buildRouteBar();
            this.buildFareTable();
            this.routePct = 0;
            this.updateRouteBarVisual(0);
            this.showDayBanner(run.day, '');
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
    const destCount = route.stops.length - 1;
    const head = el('tr', {}, [
      el('th', { class: 'corner', text: 'From/To' }),
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
    const table = $('fare-table');
    table.dataset.cols = String(destCount);
    table.replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
    this.fitDrawerContent();
  }

  fitDrawerContent() {
    const drawer = $('drawer');
    const table = $('fare-table');
    const wordList = $('word-list');
    if (!drawer || drawer.hidden) return;

    // Max content width fits cleanly between left=84px and right HUD (tray at 808px),
    // and height stays well above the bottom progress bar (top=134px..646px).
    const MAX_DRAWER_W = 712;
    const MAX_DRAWER_H = 500;
    const MAX_CONTENT_W = MAX_DRAWER_W - 32; // accounts for drawer borders + horizontal padding

    if (this.panel === 'taripa' && table) {
      let fontSize = 14;
      let padY = 6;
      let padX = 9;
      let letterSpacing = 0;

      const applyTableMetrics = () => {
        table.style.fontSize = `${fontSize}px`;
        table.style.setProperty('--cell-py', `${padY}px`);
        table.style.setProperty('--cell-px', `${padX}px`);
        table.style.setProperty('--cell-ls', `${letterSpacing}px`);
      };

      applyTableMetrics();

      while (
        (table.scrollWidth > MAX_CONTENT_W ||
          drawer.scrollWidth > drawer.clientWidth + 1 ||
          drawer.scrollHeight > MAX_DRAWER_H) &&
        fontSize > 7.5
      ) {
        fontSize = Math.round((fontSize - 0.5) * 10) / 10;
        if (padX > 3) padX = Math.max(3, padX - 1);
        if (padY > 3) padY = Math.max(3, padY - 0.5);
        if (fontSize <= 11) letterSpacing = -0.5;
        applyTableMetrics();
      }
    } else if (this.panel === 'salita' && wordList) {
      const count = wordList.children.length;
      wordList.dataset.cols = count > 14 ? '3' : '2';
      let fontSize = count > 14 ? 13 : 14;
      wordList.style.fontSize = `${fontSize}px`;
      while (
        (wordList.scrollWidth > MAX_CONTENT_W ||
          drawer.scrollWidth > drawer.clientWidth + 1 ||
          drawer.scrollHeight > MAX_DRAWER_H) &&
        fontSize > 9
      ) {
        fontSize -= 0.5;
        wordList.style.fontSize = `${fontSize}px`;
      }
    }
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

    // Build pixel heart icons using custom assets/hearts.png
    const heartTotal = run.practice ? 5 : Math.max(1, run.maxLives);
    const livesEl = $('hud-lives');
    livesEl.replaceChildren();
    for (let i = 0; i < heartTotal; i++) {
      livesEl.append(el('img', { class: 'heart-icon', src: '../assets/hearts.png?v=10', alt: 'Life' }));
    }

    // Money container (bills in top recessed slot, coins in lower row — pure pixel art + instant hover tooltip)
    const billsWrap = $('tray-bills');
    const coinsWrap = $('tray-coins');
    billsWrap.replaceChildren();
    coinsWrap.replaceChildren();
    for (const d of DENOMS) {
      if (d.centavo && !stage.centavos) continue;
      const children = d.centavo ? [el('span', { class: 'money-tag', text: d.label })] : [];
      const pesoTip = formatPeso(d.value);
      const b = el('button', {
        class: `money ${d.kind} ${d.id}`,
        type: 'button',
        'aria-label': pesoTip,
        dataset: { value: d.value, tooltip: pesoTip },
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
    this.sfx('coin');
    this.render();
    this.emit('change', this.run.givenTotal);
  }

  changeMoney(action) {
    if (this.isAtStopScene || action() === null) return;
    this.sfx('tap');
    this.render();
    this.emit('change', this.run.givenTotal);
  }

  answer(value) {
    if (this.isAtStopScene) return;
    const a = this.run.answer(value);
    if (!a) return;
    this.setHint(false);
    this.sfx(a.correct ? 'correct' : 'wrong');

    if (!a.correct && !this.run.practice) {
      if (a.livesLeft <= 0) this.progressPaused = true;
      this.render(false);
      this.triggerHeartLoss($('choices'));
      this.showFeedback(`Correct fare: ₱${a.answer}`, 'bad');
      this.emit('answer', a);
      if (a.livesLeft <= 0) {
        this.cancel(this.advanceTimer);
        this.advanceTimer = this.later(1100, () => this.end());
        return;
      }
      this.feedbackTimer = this.later(1500, () => this.hideFeedback());
      if (this.patienceMax > 0) {
        this.patienceLeft = Math.min(this.patienceMax, Math.max(this.patienceLeft + 5, this.patienceMax * 0.65));
        this.updateTimerBarVisual();
      }
      this.render(true);
      return;
    }

    // Give a capped top-up after answering "Magkano po?" so kids have time to count change without stalling past a leg
    if (this.patienceMax > 0) {
      this.patienceLeft = Math.min(this.patienceMax, Math.max(this.patienceLeft + 5, this.patienceMax * 0.65));
      this.updateTimerBarVisual();
    }
    this.render(true);
    if (!a.correct) {
      this.showFeedback(`Correct fare: ₱${a.answer}`, 'bad');
      this.feedbackTimer = this.later(1500, () => this.hideFeedback());
    }
    this.emit('answer', a);
  }

  useHint() {
    if (this.isAtStopScene || this.hintOn || !this.run.useHint()) return;
    this.sfx('tap');
    this.setHint(true);
    this.emit('hint', this.run.hintsLeft);
  }

  setHint(on) {
    this.hintOn = on;
    this.cancel(this.hintTimer);
    this.hintTimer = on ? this.later(HINT_MS, () => this.setHint(false)) : null;
    if (!this.isAtStopScene) this.render();
  }

  triggerHeartLoss(targetEl = null, lostHeartIdx = this.run.lives) {
    const livesEl = $('hud-lives');
    if (livesEl) {
      livesEl.classList.remove('hurt');
      void livesEl.offsetWidth;
      livesEl.classList.add('hurt');
      this.later(400, () => livesEl.classList.remove('hurt'));

      const icons = livesEl.querySelectorAll('.heart-icon');
      const lostIdx = Math.max(0, Math.min(icons.length - 1, lostHeartIdx));
      const lostIcon = icons[lostIdx];
      let popLeft = livesEl.clientWidth - 24;
      if (lostIcon) {
        lostIcon.classList.remove('just-lost');
        void lostIcon.offsetWidth;
        lostIcon.classList.add('just-lost');
        this.later(420, () => lostIcon.classList.remove('just-lost'));
        popLeft = lostIcon.offsetLeft + lostIcon.offsetWidth / 2;
      }

      const pop = el('span', { class: 'heart-loss-pop', text: '-1 ♥' });
      pop.style.left = `${popLeft}px`;
      livesEl.append(pop);
      this.later(1000, () => pop.remove());
    }

    if (targetEl) {
      targetEl.classList.remove('hurt-shake');
      void targetEl.offsetWidth;
      targetEl.classList.add('hurt-shake');
      this.later(400, () => targetEl.classList.remove('hurt-shake'));
    }
  }

  handleTimeout() {
    if (this.isAtStopScene) return;
    const res = this.run.timeout();
    if (!res) return;
    this.sfx('wrong');
    this.setHint(false);
    if (res.livesLeft <= 0) this.progressPaused = true;
    this.render();
    this.triggerHeartLoss($('timer-bar-wrap'));
    this.showFeedback('Too slow!', 'bad');
    this.cancel(this.advanceTimer);
    this.advanceTimer = this.later(res.livesLeft <= 0 ? 1050 : 1200, () => this.advance());
  }

  submit(exact) {
    if (this.isAtStopScene) return;
    const res = this.run.submit(exact);
    if (!res) return;
    this.emit('submit', res);
    if (res.retry) {
      this.sfx('wrong');
      this.render();
      this.showFeedback('Wrong change! Try again!', 'bad');
      this.feedbackTimer = this.later(1500, () => this.hideFeedback());
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
      this.sfx('correct');
      this.showBubbleText('SALAMAT PO!', '', true);
      this.cancel(this.advanceTimer);
      this.advanceTimer = this.later(850, () => this.advance());
    } else {
      this.sfx('wrong');
      this.triggerHeartLoss($('payment-box'));
      this.showFeedback(`Wrong change! Exact change: ₱${formatAmount(res.expected)}`, 'bad');
      this.cancel(this.advanceTimer);
      this.advanceTimer = this.later(res.livesLeft <= 0 ? 1100 : 1350, () => this.advance());
    }
  }

  advance() {
    this.cancel(this.advanceTimer);
    this.advanceTimer = null;
    if (this.isAtStopScene) return;
    // If the player ran out of hearts, end the run immediately instead of coasting to the stop
    if (!this.run.practice && this.run.lives <= 0) {
      const phase = this.run.next();
      this.hideFeedback();
      if (phase === 'failed' || phase === 'gameover') return this.end();
      return;
    }
    // Stop-approach cutoff: don't spawn a new passenger in the last few seconds before a stop
    if (this.tutorialStartedMoving && this.remainingLegSeconds() <= STOP_APPROACH_CUTOFF_SEC) {
      this.hideFeedback();
      this.setHint(false);
      this.coastingToStop = true;
      this.resetPatience();
      this.render(false);
      return;
    }
    const phase = this.run.next();
    if (!phase) return;
    this.hideFeedback();
    if (phase === 'failed' || phase === 'gameover') return this.end();
    this.resetPatience();
    this.render(true);
  }

  setDrawer(panel, emit = true) {
    this.panel = panel;
    const drawer = $('drawer');
    drawer.hidden = !panel;
    $('panel-taripa').hidden = panel !== 'taripa';
    $('panel-salita').hidden = panel !== 'salita';
    for (const t of document.querySelectorAll('#side-tabs [data-panel]')) {
      t.classList.toggle('active', t.dataset.panel === panel);
    }
    if (panel) {
      this.fitDrawerContent();
      drawer.classList.remove('pop-in');
      void drawer.offsetWidth;
      drawer.classList.add('pop-in');
    }
    if (emit) { this.sfx('tap'); this.emit('drawer', panel); }
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
    $('hud-streak').textContent = run.streak;
    $('hint-count').textContent = run.hintsLeft;

    // While coasting into an upcoming stop, keep the speech bubble and payment controls cleared
    if (this.coastingToStop) {
      this.showBubbleText('');
      $('choices').hidden = true;
      $('paid-amount').textContent = '';
      $('given-amount').textContent = '';
      for (const id of ['btn-suklian', 'btn-sakto', 'btn-undo', 'btn-clear']) $(id).disabled = true;
      for (const b of document.querySelectorAll('#tray-box .money')) b.disabled = true;
    } else {
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
    }

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
