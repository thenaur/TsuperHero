# TsuperHero

A pixel-art educational web game for young Filipino learners to practice jeepney fares, Filipino commuter lingo (*Salita ng Tsuper*), and giving exact change (*sukli*).

---

## Quick Start (Run Locally)

1. Open a terminal in the project folder (`TsuperHero`).
2. Start a local static server:
   ```powershell
   python -m http.server 8000
   ```
3. Open your browser to **`http://127.0.0.1:8000`**.
4. After making edits, press **`Ctrl + F5`** to bypass browser cache.

### Direct Gameplay Test Links
- Tutorial (Level 0): `http://127.0.0.1:8000/html/game.html?stage=tutorial`
- Normal Mode: `http://127.0.0.1:8000/html/game.html?stage=level1` (`level2`, `level3`)
- Endless Mode: `http://127.0.0.1:8000/html/game.html?stage=endless-easy` (`endless-medium`, `endless-hard`)

---

## Run Automated Tests

```powershell
node --test tests/money.test.js tests/game.test.js tests/progress.test.js
```

---

## Architecture

- **Physical Architecture:** **Two-Tier Client–BaaS** (Static HTML/CSS/JS frontend on GitHub Pages communicating directly with Firebase Authentication & Cloud Firestore, plus `localStorage` caching).
- **Logical Layers (inside client):**
  - **Presentation / UI:** `html/`, `css/`, `js/game/play.js`, `tutorial.js`, `layout.js`, `main.js`
  - **Domain / Pure Game Logic (no DOM):** `js/game/data.js`, `logic.js`, `session.js`, `money.js`, `numbers.js`, `progress-rules.js`
  - **Data Access:** `js/firebase-config.js`, `auth.js`, `storage.js`, `js/game/progress.js`, `settings.js`

---

## Git Branching Workflow

**Never commit directly to `main`.** Always work on your assigned section branch, open a PR into `staging` to test, and then PR into `main`.

| Branch | Scope |
| :--- | :--- |
| `auth-backend` | Firebase Auth, Firestore, profile/storage |
| `menu-screens` | Start-Up, Log-In, Sign-Up, Main Menu, Choose Gamemode (`html/login.html`, `css/menu.css`) |
| `game-logic` | Routes, fare matrices, `Run` state machine, Endless Days, unit tests (`js/game/`, `tests/`) |
| `game-visuals` | Gameplay screen, layout, animations, pixel-art assets (`html/game.html`, `css/game.css`, `assets/`) |
| `audio-and-settings` | BGM, SFX, volume/mute controls (`js/game/audio.js`, `settings.js`) |
| `customization-rewards` | Customize screen, star-unlockable sceneries/interiors/decors |

---

## Note for Groupmates Using AI Coding Assistants
This repository includes **[AGENTS.md](./AGENTS.md)** at the root, which AI agents (Antigravity, Cursor, Codex, etc.) automatically load so every prompt follows the exact same gameplay rules, visual standards, and Git workflow.
