// Step-by-step guided English tutorial for first-time players.
// Walks through every interactive UI element one by one with a yellow glow highlight:
//   - Passenger dialogue box (#speech-bubble) and response buttons (#choices, #btn-hint)
//   - Tariff (#tab-taripa, #panel-taripa) & Translation (#tab-salita, #panel-salita) icons/drawers
//   - Hints counter (#hud-hint-top: HINTS: x3) and yellow ? hint button (#btn-hint)
//   - BAYAD / SUKLI display (#payment-box) and SUKLIAN / SAKTO NA buttons (#pay-actions)
//   - Interactive Money Tray (#tray-box: clickable bills & coins) + UNDO and CLEAR buttons (#tray-tools)
//   - Hearts (#hud-lives), patience timer bar (#timer-bar-wrap), and bottom route progress bar (#bottom-route-bar)

const $ = (id) => document.getElementById(id);

const STEPS = [
  {
    targets: ['speech-bubble'],
    title: 'Step 1 of 16: Passenger Dialogue Box',
    text: 'Welcome, Tsuper! Passengers speak in Filipino inside this speech bubble on the right. They tell you how many are riding, their stop, and may ask "Magkano po?" (How much is the fare?). This passenger asks: "Magkano po papuntang Jollibee?"',
    btn: 'Next →',
  },
  {
    targets: ['tab-taripa'],
    title: 'Step 2 of 16: Tariff Icon (Taripa)',
    text: 'Look at the top-left of your windshield. Click the Taripa (Fare Matrix) icon to check how much the fare is from your current stop to each destination.',
    waitEvent: 'drawer',
    check: (panel) => panel === 'taripa',
    alreadyMet: (play) => play.panel === 'taripa',
  },
  {
    targets: ['panel-taripa'],
    title: 'Step 3 of 16: Reading the Dynamic Fare Matrix',
    text: 'The highlighted yellow row is your current stop (Terminal). From Terminal to Jollibee, the fare is ₱10.00 for 1 passenger (multiply the fare if 2 or more passengers ride together!). Click Next to continue.',
    btn: 'Next →',
    avoidDrawer: true,
    onEnter: (play) => { if (play.panel !== 'taripa') play.setDrawer('taripa', false); },
    onNext: (play) => play.setDrawer(null, false),
  },
  {
    targets: ['tab-salita'],
    title: 'Step 4 of 16: Translation Icon (Salita ng Tsuper)',
    text: 'Next to the Taripa icon is Salita ng Tsuper (Translations). Click it now to open your Filipino commuter number-word dictionary!',
    waitEvent: 'drawer',
    check: (panel) => panel === 'salita',
    alreadyMet: (play) => play.panel === 'salita',
  },
  {
    targets: ['panel-salita'],
    title: 'Step 5 of 16: Commuter Lingo Dictionary',
    text: 'Passengers shout payments and fares using Filipino words like "Diyes" (₱10), "Bente" (₱20), and "Singkwenta" (₱50). You can open this dictionary anytime! Click Next to close it.',
    btn: 'Next →',
    avoidDrawer: true,
    onEnter: (play) => { if (play.panel !== 'salita') play.setDrawer('salita', false); },
    onNext: (play) => play.setDrawer(null, false),
  },
  {
    targets: ['hud-hint-top', 'btn-hint'],
    title: 'Step 6 of 16: Hints Counter (HINTS: x3) & ? Button',
    text: 'Check "HINTS: x3" in the top-right bar and the yellow "?" button beside the fare choices. Clicking "?" translates the choices into peso numbers (₱20 / ₱10) for 5 seconds and uses 1 hint.',
    btn: 'Next →',
  },
  {
    targets: ['choices'],
    title: 'Step 7 of 16: Passenger Response Buttons',
    text: 'Now answer the passenger\'s "Magkano po?" question! Since the fare from Terminal to Jollibee is ₱10, click "DIYES" (or click "?" first to peek at the peso numbers).',
    waitEvent: 'answer',
    check: () => true,
    alreadyMet: (play) => play.run?.phase === 'paying',
  },
  {
    targets: ['payment-box'],
    title: 'Step 8 of 16: BAYAD & SUKLI Display (Top Right)',
    text: 'Now the passenger pays "Bente" (₱20)! At the top-right, BAYAD shows how much the passenger paid (20) and SUKLI shows the change you have counted out so far (0). ₱20 paid − ₱10 fare = ₱10 change needed!',
    btn: 'Next →',
  },
  {
    targets: ['pay-actions'],
    title: 'Step 9 of 16: SUKLIAN & SAKTO NA Buttons',
    text: 'Below the display are two action buttons: press green SUKLIAN after counting change into SUKLI, or press gray SAKTO NA when a passenger pays the exact fare and needs 0 change.',
    btn: 'Next →',
  },
  {
    targets: ['tray-box'],
    title: 'Step 10 of 16: Interactive Money Tray (Bills & Coins)',
    text: 'IMPORTANT: The wooden money tray at the bottom-right is interactive — NOT background decor! Every bill (₱50, ₱100 in the top slot) and coin (₱1, ₱5, ₱10, ₱20 in the bottom row) is a clickable button used to count out change.',
    btn: 'Next →',
  },
  {
    targets: ['tray-tools'],
    title: 'Step 11 of 16: UNDO & CLEAR Buttons',
    text: 'Inside the bottom-right corner of the money tray are UNDO and CLEAR. Click UNDO to remove the last bill or coin you added, or CLEAR to reset your SUKLI back to 0.',
    btn: 'Next →',
  },
  {
    targets: ['hud-lives'],
    title: 'Step 12 of 16: Hearts (Your Lives)',
    text: 'Above the money tray are your red Hearts (lives). Giving the wrong change costs 1 heart in Normal and Endless modes (in Tutorial practice mode, your hearts are completely safe!).',
    btn: 'Next →',
  },
  {
    targets: ['timer-bar-wrap'],
    title: 'Step 13 of 16: Change-Giving Timer Bar',
    text: 'Directly under your hearts is the green Timer Bar. During levels, it slowly ticks down (Green → Yellow → Red) while the passenger waits for change. Give change before time runs out to protect your hearts!',
    btn: 'Next →',
  },
  {
    targets: ['bottom-route-bar'],
    title: 'Step 14 of 16: Bottom Route Progress Bar',
    text: 'At the bottom of the screen, your mini jeepney moves along the Route Progress Bar from Terminal toward each stop (Jollibee, Palengke, etc.). Keep at least 1 heart until the final stop to win the level!',
    btn: 'Next →',
  },
  {
    targets: ['tray-box'],
    title: 'Step 15 of 16: Count Out ₱10 Change in the Money Tray',
    text: 'Your turn! Click the coins inside the Money Tray to count out ₱10 of change (for example, click one ₱10 coin or two ₱5 coins) until SUKLI shows 10. Use UNDO or CLEAR if you go over!',
    waitEvent: 'change',
    check: (total) => total === 1000,
    alreadyMet: (play) => play.run?.givenTotal === 1000,
  },
  {
    targets: ['btn-suklian'],
    title: 'Step 16 of 16: Press SUKLIAN to Give Change!',
    text: 'Great job — SUKLI shows 10 (₱10)! Now click the green SUKLIAN button to hand the change to your passenger and start driving toward Jollibee!',
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
    this.highlighted = [];
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
    const bar = $('tutorial-bar');
    if (bar) {
      bar.hidden = true;
      bar.classList.remove('drawer-avoid');
    }
    if (this.unsub) { this.unsub(); this.unsub = null; }
  }

  clearHighlight() {
    for (const el of this.highlighted) {
      el.classList.remove('tut-highlight');
    }
    this.highlighted = [];
  }

  showStep(i) {
    this.clearHighlight();
    this.idx = i;
    const step = STEPS[i];
    if (!step) {
      this.stop();
      return;
    }

    if (step.onEnter) step.onEnter(this.play);

    // If the player already completed this interactive condition earlier, advance smoothly
    if (step.alreadyMet && step.alreadyMet(this.play)) {
      this.showStep(i + 1);
      return;
    }

    const bar = $('tutorial-bar');
    if (bar) {
      bar.classList.toggle('drawer-avoid', !!step.avoidDrawer || !!this.play.panel);
    }

    const ids = step.targets || (step.target ? [step.target] : []);
    for (const id of ids) {
      const el = $(id);
      if (el) {
        el.classList.add('tut-highlight');
        this.highlighted.push(el);
      }
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
    const bar = $('tutorial-bar');
    const step = STEPS[this.idx];
    if (bar && ev === 'drawer') {
      bar.classList.toggle('drawer-avoid', !!step?.avoidDrawer || !!data);
    }
    if (!step) return;
    if (step.waitEvent === ev && (!step.check || step.check(data))) {
      this.showStep(this.idx + 1);
      return;
    }
    // If the player already answered the fare question on Step 6, jump straight to Step 8
    if (ev === 'answer' && this.idx < 7) {
      this.showStep(7);
    }
  }
}
