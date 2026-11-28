# TsuperHero – Agent & Team Guidelines

Read this file carefully before making any changes to **TsuperHero**. Every rule below reflects locked-in team, professor, and design decisions. Follow them strictly so the project stays consistent across all groupmates and AI sessions.

---

## 1. Project Overview & Tech Stack
- **What it is:** A web-based pixel-art educational math game for young Filipino learners practicing jeepney fares, commuter lingo (*Salita ng Tsuper*), and making exact change (*sukli*).
- **Tech Stack:** Plain HTML5, CSS3, and vanilla **ES-module JavaScript** (`type="module"`). **Do NOT add React, Vue, TypeScript, Tailwind, or build bundlers** — the site deploys directly as static files on **GitHub Pages**.
- **Architecture:**
  - **Physical (Deployment):** **Two-Tier Client–BaaS** (Static Web Client ↔ Firebase Auth + Cloud Firestore + `localStorage` cache). No custom backend server.
  - **Logical (Inside Client):** **Strict 4-Ring Onion (Onionskin) Architecture** (all dependencies point **inward only**, enforced by `tests/architecture.test.js`):
    1. **Ring 1 — Domain Core (`js/domain/`):** `money.js`, `numbers.js`, `profile.js`, `data.js`, `logic.js`, `progress-rules.js` — **100% pure & dependency-free** (imports ONLY `js/domain/*`; zero DOM, Firebase, `localStorage`, or UI asset paths).
    2. **Ring 2 — Application Services & Ports (`js/application/`):** `emitter.js`, `session.js`, `progress-service.js`, `auth-service.js` — pure use cases & state machines depending ONLY on `js/domain/*` and injected ports (`ProfileRepository`, `AuthGateway`, `SessionGateway`).
    3. **Ring 3 — Outer Adapters & Presentation:**
       - **Infrastructure (`js/infrastructure/`):** `firebase-config.js`, `firebase-profile-repo.js`, `firebase-auth-gateway.js`, `firebase-session-gateway.js`, `settings-store.js`, `web-audio.js` — concrete Firebase, `localStorage`, and Web Audio adapters.
       - **Presentation (`js/presentation/`):** `assets.js`, `layout.js`, `play.js`, `tutorial.js`, `customize.js`, `menu-controller.js` (+ `html/`, `css/`) — DOM views, asset catalog, and UI controllers. **Never imports `js/infrastructure/*` or Firebase directly.**
    4. **Ring 4 — Composition Roots (`js/composition/`):** `menu-app.js` (for `html/login.html`) and `game-app.js` (for `html/game.html`) — the ONLY entry points that instantiate Infrastructure adapters and inject them into Application services and Presentation controllers.

---

## 2. Strict Git Branching Workflow
- **NEVER edit or commit directly on `main`!** Always check `git branch --show-current` first and switch to the appropriate section branch:
  - `auth-backend` — Firebase Auth, Cloud Firestore, account/profile sync
  - `menu-screens` — `index.html`, `html/login.html`, `css/menu.css` (Start-Up, Log-In, Sign-Up, Main Menu, Choose Gamemode)
  - `game-logic` — `js/game/data.js`, `logic.js`, `session.js`, `money.js`, `numbers.js`, `progress-rules.js`, `tests/`
  - `game-visuals` — `html/game.html`, `css/game.css`, `js/game/play.js`, `tutorial.js`, `layout.js`, `assets/`
  - `audio-and-settings` — `js/game/audio.js`, `settings.js`, BGM/SFX audio files, Settings screen
  - `customization-rewards` — Customize screen, star-unlocked sceneries/interiors/decors
- **Merge flow:** Section branch → Pull Request to `staging` (verify & test) → Pull Request to `main` (reviewed by lead).
- **Commit style:** Use Conventional Commits (e.g., `feat: ...`, `fix: ...`, `docs: ...`, `style: ...`).

---

## 3. Hard Engineering Rules (Never Break These)
1. **Zero `4xx` HTTP Errors:** Every HTML page MUST keep `<link rel="icon" href="data:,">`. Every asset path MUST exist with **exact capitalization** (Windows is case-insensitive, GitHub Pages Linux is case-sensitive!) — enforced by `tests/architecture.test.js`. Preserve `localStorage` fallbacks in `js/infrastructure/firebase-auth-gateway.js` and `firebase-profile-repo.js`.
2. **Integer Centavos Only:** All currency logic MUST use integer centavos (`₱10` = `1000`, `₱12.50` = `1250`) via `js/domain/money.js`. Never use floating-point peso math.
3. **Preserve Onion Ring Boundaries:**
   - Never reference `document`, `window`, `localStorage`, `sessionStorage`, `firebase`, or `../assets/` inside `js/domain/` or `js/application/`.
   - Never import `js/infrastructure/` or Firebase directly inside `js/presentation/` or `html/*.html` — always inject adapters from `js/composition/`.
4. **ES Module Cache-Busting:** Browsers cache nested ES module imports aggressively. When modifying files under `js/` or `css/`, bump the `?v=N` query string consistently along the import chain.
5. **Firebase API Key:** The web API key in `js/infrastructure/firebase-config.js` is intentionally public and domain-restricted in Google Cloud (`localhost`, `127.0.0.1:8000`, `https://thenaur.github.io/*`). Do not remove or break `firebase-config.js`.

---

## 4. Locked-In Gameplay Rules (Do Not Contradict)
- **5 Core Stops (+ starting `Terminal`):**
  - `Jollibee` (`assets/resto.png`), `Palengke` (`assets/palengke.png`), `Munisipyo` (`assets/munisipyo.png`), `Hospital` (`assets/hospital.png`), `School` (`assets/school.png`).
- **Stage Definitions (`js/game/data.js`):**
  - **Tutorial (Level 0):** `Terminal` → `Jollibee` → `Palengke` (2 stops). Practice mode (no hearts lost, unlimited patience, 3 hints). Progress bar stays parked at `Terminal` until Passenger 1's guided steps are completed.
  - **Level 1:** `Terminal` + 3 stops (`Jollibee`, `Palengke`, `Munisipyo`), 5 lives, 3 hints, `legSeconds: 42`.
  - **Level 2:** `Terminal` + 4 stops (`...`, `Hospital`), 4 lives, 3 hints, `legSeconds: 40`.
  - **Level 3:** `Terminal` + 5 stops (`...`, `School`), 3 lives, 0 hints, `legSeconds: 36`.
  - **Endless Mode (Easy / Medium / Hard):** Unlocks after Level 3. 5 lives, 0 hints. Hard enables 25¢ centavos. Stars are earned **ONLY in Endless Mode** at `1,000` (1★), `2,500` (2★), and `5,000` (3★).
- **Continuous Progress Bar Loop:**
  - Passengers keep coming one after another while the bottom progress bar slowly advances toward the next stop.
  - **Normal Mode goal:** Keep `lives > 0` until the progress bar reaches the final stop.
  - **Endless Mode Day System:** Starts at `Terminal` with the **5 stops jumbled** (`jumbleRoute()`). Reaching the final stop with lives left switches to **`DAY 2`**, **`DAY 3`**, etc. with a `DAY X — NEW JUMBLED ROUTE!` banner, freshly jumbled stops, and rebuilt bottom bar + Taripa, continuing until hearts hit 0.
- **Stop Arrival Sequence:**
  - Reaching a stop fades to black (`500ms`) → displays that stop's landmark PNG → pops `"THANK YOU PO!"` (`3.4s`) → fades to black (`500ms`) → resumes driving on `RoadLoop.gif`.
- **`"Magkano po?"` Fare Question Rules:**
  - Triggers occasionally (`22%–30%` probability) and **NEVER twice in a row** (`_lastAskedQuestion` guard in `session.js`).
  - Always asks for the **total fare (`fare × count`)** — e.g., 2 people going to a ₱10 stop asks `"MAGKANO PO PARA SA DALAWA PAPUNTANG JOLLIBEE?"` with **`BENTE` (₱20)** as the correct answer.
  - Clicking the `?` hint button (`assets/hint_question.png`) reveals peso numbers (`₱20` / `₱10`) for `HINT_MS` (`5s`) and decrements `HINTS: x3`.
  - Wrong fare-question answer costs **1 heart** and resets streak in Normal & Endless (costs no life in Tutorial; shows a brief feedback toast, NOT inside `speech.png`).
- **Exact Payment:** Players can click **`SAKTO NA`** (or `SUKLIAN` with `0` sukli) when payment equals the exact fare.

---

## 5. Locked-In Customization Tab Plan (`customization-rewards`)
- **Structure:** **3 categories × 3 unlockable items each** (plus each category's default/none state):
  1. **Decor** *(hung from the **stem** of the rear-view mirror; default = None)*:
     - **1st (Easy):** Fuzzy Dice *(longer cord wrapped on mirror stem)*
     - **2nd (Medium):** Air Freshener *(longer cord wrapped on mirror stem)*
     - **3rd (Hard):** Knitted Lily of the Valley Ornament *(sage-green crochet wrap & leaves + 5 white bell blooms on mirror stem)*
     - *Placement rule:* Mount on the mirror stem (`x ≈ 646px`, `y ≈ 52px` on the `1280×720` stage) with the middle cord tucked cleanly **behind** the mirror glass (`y = 74..171px`) so the mirror stays unobstructed and the ornament dangles beneath.
  2. **Jeep Interior** *(holiday themes built on `JeepInterior.png`'s exact `1920×1080` cutout; default = Classic `JeepInterior.png`)*:
     - **1st (Easy):** Fiesta *(push `#side-tabs` Taripa & Salita icons down to `top: 114px` so they clear the hanging banderitas)*
     - **2nd (Medium):** Christmas *(push `#side-tabs` down to `top: 78px` to clear the top pine garland)*
     - **3rd (Hard):** New Year *(push `#side-tabs` down to `top: 78px` to clear the top gold tinsel)*
     - *Zero re-layouting rule:* Equipping an interior swaps `#jeep-interior`'s `src` directly without moving `SukliContainer`, `MoneyContainer`, `DriverHand`, or the mirror.
  3. **Sceneries** *(looping road GIF **AND** matching modified stills for all 5 stops; default = Dusk `RoadLoop.gif` + base landmark PNGs)*:
     - **1st (Easy):** Morning *(bright daytime sky with sun **high in the sky**, not on the horizon; `RoadLoop_Morning.gif` + `*_morning.png`)*
     - **2nd (Medium):** Night *(indigo sky, crescent moon, stars, lit windows, and **clean electrical poles with NO streetlamp lights**; `RoadLoop_Night.gif` + `*_night.png`)*
     - **3rd (Hard):** Dawn *(violet-rose-coral sunrise at the horizon + fading morning stars; `RoadLoop_Dawn.gif` + `*_dawn.png`)*
     - *Landmark sync rule:* Equipping a scenery MUST update both the driving `RoadLoop_*.gif` and all 5 stop landmark stills (`Jollibee`, `Palengke`, `Munisipyo`, `Hospital`, `School`).
- **Two-Tier Unlock Logic (Endless Mode Only):**
  - **Category Unlock (score reached in ANY Endless difficulty — Easy, Medium, or Hard):**
    - **Decor category:** unlocks at **`1,000`** points *(1★)*
    - **Jeep Interior category:** unlocks at **`2,500`** points *(2★)*
    - **Sceneries category:** unlocks at **`5,000`** points *(3★)*
  - **Per-Item Unlock (specific score thresholds per difficulty in `profile.bestScore.{easy, medium, hard}`):**
    - Inside every category: **1st item** unlocks at a target score in **Endless Easy**, **2nd item** at a target score in **Endless Medium**, and **3rd item** at a target score in **Endless Hard** *(exact per-item thresholds to be finalized by the team in `js/game/data.js` & `js/game/progress-rules.js`)*.
- **Icons & UI Assets:** 6 custom `128×128` pixel icons (Fiesta banderitas, Christmas Parol, New Year fireworks, Morning sun & cloud, Night moon & stars, Dawn sunrise) + `Equipped.png` / `Unequipped.png` / `Gas*.png`.

---

## 6. Locked-In Visual, UI & Language Standards
- **Virtual Stage & Scaling:** Fixed `1280×720` `#stage` stretched edge-to-edge (`scale(scaleX, scaleY)`) via `js/game/layout.js` (no black side bars). Always keep `image-rendering: pixelated;`.
- **Fonts:** `'Silkscreen', 'Press Start 2P', monospace`.
- **Language Policy:**
  - All **UI chrome, tutorial instructions, Taripa headers, modals, and feedback toasts** MUST be in **English**.
  - **`speech.png` is strictly for passenger dialogue only** (Filipino commuter shouts like `"MAGKANO PO PAPUNTANG JOLLIBEE?"`, `"ISA PO PAPUNTANG JOLLIBEE, BAYAD PO! (BENTE)"`, `"SALAMAT PO!"`, `"THANK YOU PO!"`). **NEVER put system messages (`"Correct!"`, `"+100"`, errors) inside `speech.png`.**
- **Pixel-Stepped Bars:**
  - Bottom route progress bar (`#progress-fill` + `MiniJeepney.png`) MUST advance in **4px discrete pixel steps** (never smooth subpixel animation).
  - Passenger timer bar (`#timer-fill`) MUST tick down in **6px discrete pixel steps** (no CSS `width` transition) and shift **Green (`>55%`) → Yellow (`25%–55%`) → Red (`≤25%`)**.
- **Bills & Coins:** Pure pixel-art assets (`Singkwenta.png`, `IsangDaan.png`, `Piso.png`, `Lima.png`, `Sampo.png`, `Bente.png`) — **NO numeric text overlays** on bills or coins (except the fallback 25¢ Hard coin).
- **Per-Asset Hover & Click Highlights (`css/game.css`):**
  - Every clickable gameplay asset defines CSS custom properties `--hi` (light color-matched hover accent) and `--lo` (dark color-matched clicked accent + `translateY(3px)` sink + `brightness(0.75)`). Match this exact convention for any new clickable assets.
- **Custom Pixel-Art Assets (Do Not Overwrite with Non-Pixel Art):**
  - `assets/MiniJeepney.png`, `assets/hearts.png`, `assets/speech.png` (9-sliced `border-image-slice: 16 fill`), `assets/hint_question.png`.
- **Top HUD Layout:** Left side shows `SCORE:` and `STREAK:`; right side shows `HINTS: x3` immediately to the left of the `MENU` button.
- **Reserved Uploaded Assets (Do Not Delete):**
  - `assets/Equipped.png`, `assets/Unequipped.png`, `assets/Gas.png`, `assets/GasButton1.png`, `assets/GasButton2.png`, `assets/GasButton3.png` — uploaded by the team for upcoming Customization / Settings screens.

---

## 7. Commands & Verification Checklist
- **Run local web server** (from repo root):
  ```powershell
  python -m http.server 8000
  ```
  - Home / Login: `http://127.0.0.1:8000`
  - Direct Gameplay shortcuts:
    - `http://127.0.0.1:8000/html/game.html?stage=tutorial`
    - `http://127.0.0.1:8000/html/game.html?stage=level1` (or `level2`, `level3`)
    - `http://127.0.0.1:8000/html/game.html?stage=endless-easy` (or `endless-medium`, `endless-hard`)
  - Always hard-refresh with **`Ctrl + F5`** after edits.
- **Run automated unit & Onion architecture tests** (MUST pass with 0 failures before any commit):
  ```powershell
  npm test
  ```
- **Syntax check all JS modules across all rings:**
  ```powershell
  Get-ChildItem -Recurse js -Filter *.js | ForEach-Object { node --check $_.FullName }
  ```

---

## 8. Current Handover Status
- **Completed:**
  - `auth-backend`: Firebase Auth + Firestore (`users/{uid}`) + offline-only `localStorage` fallback (surfaces Firebase domain/port errors cleanly), zero `4xx` errors.
  - `menu-screens`: Start-Up, Log-In, Sign-Up, Main Menu, and Choose Gamemode screens (`html/login.html`, `css/menu.css`).
  - `game-logic` & `game-visuals`: Complete Driver-POV gameplay screen, calibrated tight-cropped assets, dynamic 9-slice speech bubble, pixel-stepped route progress bar & Green→Yellow→Red timer bar, per-asset hover/click highlights, multi-passenger `"Magkano po?"` + `?` hints, English guided Tutorial, Normal Levels 1–3, Endless Mode jumbled 5 stops + Day 1/2/3 system, and 22 passing unit tests.
- **Next Up for Groupmates:**
  1. **`customization-rewards` branch:** Add finalized Decor, Jeep Interior, Scenery (GIFs + 15 landmarks), and 6 icon assets to `assets/`, implement the two-tier Endless unlock logic (`1,000` / `2,500` / `5,000` category unlocks + Easy/Medium/Hard per-item thresholds), build the Customize screen (`Equipped.png` / `Unequipped.png` / `Gas*.png`), and apply equipped items in `html/game.html` / `play.js`.
  2. **`audio-and-settings` branch:** Wire real BGM & SFX audio files into `js/game/audio.js` and connect the Settings screen from the Main Menu.
  3. **Final Polish & Merge:** Merge tested section branches → `staging` → `main` and verify live GitHub Pages deployment.
