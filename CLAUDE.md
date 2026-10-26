# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dungeon Tracker is a vanilla HTML/CSS/JS web app — no build system, no npm, no framework. Open `index.html` directly in a browser, or serve it.

A rebuild is in progress (architecture first, then a full visual redesign — the current themes are slated for replacement, and the DungeonTools hub is being redesigned too):
1. ✅ Split the single file into `css/` + `js/` with no behaviour change; tests for pure rules
2. ✅ Single state object + `render()`, versioned save schema, delegated `data-action` events, strict script CSP
3. 🚧 New design (branch `redesign`): printed-page GM screen, SVG dice replace Three.js

## Development

- Preview: `python -m http.server 8080` (also in `.claude/launch.json` as `static`)
- Tests: `node --test` (runs `test/*.test.js`; single test: `node --test --test-name-pattern "XP"`)

No dependencies to install; tests use Node's built-in runner.

## Architecture

`index.html` holds markup only — no inline handlers or scripts (the CSP forbids them). Scripts are **classic scripts sharing one global scope**, loaded at the end of `<body>` in this order:

| File | Contents |
|---|---|
| `js/data.js` | `MONSTER_TABLES` — 3 built-in tables × 20 entries with 5e stat blocks |
| `js/rules.js` | Pure rules, no DOM: `esc`, `DIE_SIDES`, dice rolls, `rollCountExpr`, CR→XP, `encounterXP`, `awardXP`, level thresholds |
| `js/state.js` | Pure: state shape (`defaultState`), `migrate(raw)` for any saved version, `torchRemaining` |
| `js/tables.js` | Pure CSV/JSON table parsing + validation for uploads |
| `js/audio.js` | All Web Audio synthesized SFX (no audio files); reads `S.sound` / `S.volume` |
| `js/dice.js` | 3D dice in CSS transforms, no library: real d6/d10/d12/d20 solids with numbered SVG faces, shaded per frame; `drawDie` poses a result, `rollDie` throws and lands on it. d100 = tens + units d10 |
| `js/app.js` | State + `render()`, actions, effects, delegated events, boot |

`rules.js`, `state.js`, `tables.js` end with `if (typeof module !== 'undefined') module.exports = …` so tests can `require` them; keep pure logic there and DOM code out.

### State and rendering (app.js)
- **`S`** is the single persisted state object (shape in `defaultState()`); **`ui`** holds transient UI state (rolling, settings draft, table open) that is never saved.
- Every change goes through **`commit(s => { … })`**, which saves to `localStorage` key `dungeonTracker_v1` and calls `render()`. `render()` derives the whole page from `S` + `ui` and is safe to call any time; it must not trigger animations or sounds.
- One-shot **effects** (dice tumbles, the encounter flash, scrolls, sounds) are fired by actions, outside `render()`. Mid-roll, `ui.rolling` tells render to leave the dice display alone.
- Adding a persisted field: add it to `defaultState()` **and** `migrate()` (sanitise it — saves are untrusted), then read it in a render function. Bump `SAVE_VERSION` only if old saves need mapping.
- Undo restores `history[0].partyBefore` (snapshotted when XP is awarded), so it also takes back XP and level-ups.
- **Events:** markup uses `data-action="name" data-arg="…"`; clicks dispatch through `ACTIONS`, input/change through `INPUTS`. Render-generated HTML uses the same attributes.
- Custom tables live separately in `localStorage` key `dt_custom_tables` as 3 slots overriding the built-in tables by index (`null` = built-in).

### Design
One look: ink on bone paper with a single rubric red, Oswald (condensed caps) for structure and Crimson Pro for reading. All colours are tokens on `:root` in `css/app.css`; dark mode redefines them under `prefers-color-scheme` unless `data-theme="light"`, and under `data-theme="dark"`. `S.theme` is `auto` / `light` / `dark`. `S.anim` off adds `.no-motion` to `<html>`; `prefers-reduced-motion` is also honoured. Below 920px the layout is one column and the advance-turn bar sticks to the bottom.

### Custom encounter tables
CSV (`roll,name,cr,count,desc`) or JSON array, max 1 MB / 100 rows:
```json
[ { "roll": 1, "name": "Monster", "cr": "1/2", "count": "1d4", "desc": "...", "stats": {...}, "lore": "..." } ]
```
Uploaded data and saved state are untrusted: anything interpolated into `innerHTML` must go through `esc()`.

## Key constraints
- No external scripts at all; Google Fonts is the only outside resource — the CSP meta tag in `index.html` enforces this
- Sound is synthesized via Web Audio API — no audio asset files
