// Step-by-step guided English tutorial for first-time players.
// Fixed first passenger asks "MAGKANO PO PAPUNTANG JOLLIBEE?" (BENTE vs DIYES + ? hint),
// then pays ₱20 ("Bente!") for a ₱10 fare.
// Highlights: Speech bubble, Taripa icon, Fare table, Fare choices & ? hint, BAYAD/SUKLI box,
// Hearts & Time Bar, Route progress bar, Money tray, and SUKLIAN button.

const $ = (id) => document.getElementById(id);

const STEPS = [
  {
    target: 'speech-bubble',
    title: 'Step 1: Listen to the Passenger',
    text: 'Welcome, Tsuper! Sometimes a passenger asks how much the fare is before paying. This passenger asks: "Magkano po papuntang Jollibee?"',
    btn: 'Next →',
  },
  {
    target: 'tab-taripa',
    title: 'Step 2: Open the Taripa (Fare Matrix)',
    text: 'Click the Taripa icon on the top-left to check the fare from Terminal to Jollibee.',
    waitEvent: 'drawer',
    check: (panel) => panel === 'taripa',
  },
  {
    target: 'fare-table',
    title: 'Step 3: Read the Fare',
    text: 'From Terminal to Jollibee, the fare is ₱10.00. Tip: if a passenger asks for 2 or more people, multiply the fare by the number of people! Click Next to close.',
    btn: 'Next →',
    onNext: (play) => play.setDrawer(null, false),
  },
  {
    target: 'choices',
    title: 'Step 4: Answer the Fare (or Use a Hint!)',
    text: 'Pick the Filipino word for ₱10 ("DIYES"). Need help reading the slang? Click the yellow ? hint button (your HINTS: x3 counter is next to MENU) or check Salita ng Tsuper!',
    waitEvent: 'answer',
    check: () => true,
  },
  {
    target: 'payment-box',
    title: 'Step 5: Check BAYAD & SUKLI',
    text: 'Now the passenger pays "Bente" (₱20)! BAYAD shows 20 and SUKLI shows your change. ₱20 − ₱10 = ₱10 change! (If the payment is exact, press SAKTO NA instead.)',
    btn: 'Next →',
  },
  {
    target: 'status-above-tray',
    title: 'Step 6: Watch Your Hearts & Time Bar',
    text: 'These hearts are your lives, and the bar below them is the passenger timer (Green → Yellow → Red). Wrong change or running out of time costs 1 heart — no penalty in Tutorial!',
    btn: 'Next →',
  },
  {
    target: 'bottom-route-bar',
    title: 'Step 7: Follow the Route Progress Bar',
    text: 'This progress bar tracks your jeepney to each stop. Passengers keep paying until you reach the next stop — keep at least 1 heart until the final stop to win!',
    btn: 'Next →',
  },
  {
    target: 'tray-box',
    title: 'Step 8: Pick Bills or Coins',
    text: 'Click ₱10 worth of coins from your money tray below (for example, one ₱10 coin or two ₱5 coins).',
    waitEvent: 'change',
    check: (total) => total === 1000,
  },
  {
    target: 'btn-suklian',
    title: 'Step 9: Give the Change',
    text: '₱10 change is ready! Click the green SUKLIAN button to give change and start driving toward Jollibee!',
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
