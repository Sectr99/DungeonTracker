# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dungeon Tracker is a vanilla HTML/CSS/JS web app — no build system, no npm, no framework. Open `index.html` directly in a browser, or serve it.

A rebuild is in progress (architecture first, then a full visual redesign — the current themes are slated for replacement, and the DungeonTools hub is being redesigned too):
1. ✅ Split the single file into `css/` + `js/` with no behaviour change; tests for pure rules
2. Single state object + `render(state)`, versioned save schema, delegated `data-action` events (then drop `'unsafe-inline'` from the CSP)
3. New design on top of the new render layer; SVG die replaces Three.js

## Development

- Preview: `python -m http.server 8080` (also in `.claude/launch.json` as `static`)
- Tests: `node --test` (runs `test/*.test.js`; single test: `node --test --test-name-pattern "XP"`)

No dependencies to install; tests use Node's built-in runner.

## Architecture

`index.html` holds markup only. Scripts are **classic scripts sharing one global scope**, loaded at the end of `<body>` in this order — order matters, because top-level code in later files uses earlier ones and the inline `onclick=` handlers call globals:

| File | Contents |
|---|---|
| `js/data.js` | `MONSTER_TABLES` — 3 built-in tables × 20 entries with 5e stat blocks |
| `js/rules.js` | Pure rules, no DOM: `esc`, `DIE_SIDES`, dice rolls, `rollCountExpr`, CR→XP, encounter multipliers, level thresholds |
| `js/tables.js` | Pure CSV/JSON table parsing + validation for uploads |
| `js/dice3d.js` | Three.js r128 icosahedron (`Die3D`, `THEME_DICE`, `initDice`) |
| `js/audio.js` | All Web Audio synthesized SFX (no audio files) |
| `js/app.js` | Everything else: `EL` DOM cache, persistence, game loop (`advanceTurn`/`undoTurn`), torch timer, settings, upload UI, XP tracker UI |
| `js/bg.js` | Animated canvas background (IIFE, runs immediately) |

`rules.js` and `tables.js` end with `if (typeof module !== 'undefined') module.exports = …` so tests can `require` them; keep new pure logic there and DOM code out of them.

### State
Game state is ~30 top-level `let` vars in `app.js` (`turn`, `history`, `combatActive`, `THRESHOLD`, `DIE_TYPE`, `xpPlayers`, …). `cookieSave()` / `restoreState()` (names are historical) serialise to `localStorage` key `dungeonTracker_v1`; any new persistent var must be added to **both**, and `restoreState` must re-sync its UI by hand. Custom tables live in `localStorage` key `dt_custom_tables` as 3 slots overriding the built-in tables by index (`null` = built-in).

### Themes
`:root` CSS vars in `css/app.css` define the default palette; `[data-theme="X"]` on `<html>` overrides it (`castlevania`, `vampire`, `dungeon`, `escape`, `torchlight`). Each also needs a `THEME_DICE` entry and a `.theme-btn`. `torchlight` re-scopes vars on `.card` to paper/ink and overrides base rules with hard-coded dark backgrounds.

### Custom encounter tables
CSV (`roll,name,cr,count,desc`) or JSON array, max 1 MB / 100 rows:
```json
[ { "roll": 1, "name": "Monster", "cr": "1/2", "count": "1d4", "desc": "...", "stats": {...}, "lore": "..." } ]
```
Uploaded data and saved state are untrusted: anything interpolated into `innerHTML` must go through `esc()`.

## Key constraints
- External resources: Three.js r128 (cdnjs, pinned with SRI) and Google Fonts only — the CSP meta tag in `index.html` enforces this
- Sound is synthesized via Web Audio API — no audio asset files
