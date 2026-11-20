// Step-by-step guided tutorial for first-time players (Page 4 of spec).
// Fixed passenger boards at Terminal -> Palengke, pays ₱20 ("Bente po!") for a ₱10 fare.
// Highlights each tool in turn: fare matrix, payment prompt, coin container, give-change button.

const $ = (id) => document.getElementById(id);

const STEPS = [
  {
    target: 'mirror-box',
    title: 'Hakbang 1: Pakinggan ang Pasahero',
    text: 'May sumakay sa Terminal papuntang Palengke! Sabi niya: "Bayad po, bente!" Ang "bente" ay ₱20 sa salita ng tsuper.',
    btn: 'Susunod →',
  },
  {
    target: 'tab-taripa',
    title: 'Hakbang 2: Buksan ang Taripa (Fare Matrix)',
    text: 'Pindutin ang tab na [>> TARIPA] sa kaliwa para makita kung magkano ang pamasahe mula Terminal hanggang Palengke.',
    waitEvent: 'drawer',
    check: (panel) => panel === 'taripa',
  },
  {
    target: 'fare-table',
    title: 'Hakbang 3: Basahin ang Taripa',
    text: 'Mula Terminal papuntang Palengke, ang pamasahe ay ₱10.00. Isara ang taripa o pindutin ang Susunod.',
    btn: 'Susunod →',
    onNext: (play) => play.setDrawer(null, false),
  },
  {
    target: 'payment-box',
    title: 'Hakbang 4: Tingnan ang Bayad',
    text: 'Nasa kanan ang bayad ng pasahero (20.00) at ang sukli na inihahanda mo (0.00). Dahil ₱20 ang bayad at ₱10 ang pamasahe: ₱20 − ₱10 = ₱10 ang sukli.',
    btn: 'Susunod →',
  },
  {
    target: 'tray-box',
    title: 'Hakbang 5: Pumili ng Barya o Pera',
    text: 'Pumili ng ₱10 mula sa lalagyan ng barya at pera sa ibaba (halimbawa: isang ₱10 na barya, o dalawang ₱5).',
    waitEvent: 'change',
    check: (total) => total === 1000,
  },
  {
    target: 'btn-suklian',
    title: 'Hakbang 6: Ibigay ang Sukli',
    text: 'Tama na ang ₱10.00 na sukli! Pindutin ang "SUKLIAN" para ibigay ang sukli sa pasahero.',
    waitEvent: 'submit',
    check: (res) => res && res.correct,
  },
];

export class TutorialGuide {
  constructor(play, bus, { onSkip } = {}) {
    this.play = play;
    this.bus = bus;
    this.onSkip = onSkip;
    this.idx = 0;
    this.unsub = null;
    this.highlighted = null;
  }

  start() {
    $('tutorial-bar').hidden = false;
    $('tut-next').onclick = () => this.next();
    $('tut-skip').onclick = () => {
      this.stop();
      this.onSkip?.();
    };
    this.unsub = this.bus.on((ev, data) => this.onEvent(ev, data));
    this.showStep(0);
  }

  stop() {
    this.clearHighlight();
    $('tutorial-bar').hidden = true;
    if (this.unsub) { this.unsub(); this.unsub = null; }
  }

  clearHighlight() {
    if (this.highlighted) {
      this.highlighted.classList.remove('tut-highlight');
      this.highlighted = null;
    }
  }

  showStep(i) {
    this.clearHighlight();
    this.idx = i;
    const step = STEPS[i];
    if (!step) {
      this.stop();
      return;
    }
    const el = $(step.target);
    if (el) {
      el.classList.add('tut-highlight');
      this.highlighted = el;
    }
    $('tut-title').textContent = step.title;
    $('tut-text').textContent = step.text;
    const nextBtn = $('tut-next');
    if (step.btn) {
      nextBtn.hidden = false;
      nextBtn.textContent = step.btn;
    } else {
      nextBtn.hidden = true;
    }
  }

  next() {
    const step = STEPS[this.idx];
    if (step?.onNext) step.onNext(this.play);
    this.showStep(this.idx + 1);
  }

  onEvent(ev, data) {
    const step = STEPS[this.idx];
    if (!step || step.waitEvent !== ev) return;
    if (!step.check || step.check(data)) {
      this.showStep(this.idx + 1);
    }
  }
}
