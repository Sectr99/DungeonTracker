// Session state shape, defaults, and load/migrate — no DOM. Needs rules.js (DIE_SIDES).
// Every persisted value lives in one object; app.js mutates it via commit() and render() reads it.
const SAVE_KEY     = 'dungeonTracker_v1';
const SAVE_VERSION = 2;
const TORCH_MS     = 60 * 60 * 1000;
const THEMES       = ['auto', 'light', 'dark'];
const MAX_PARTY    = 8;

const defaultPlayer = i => ({ name: `Player ${i + 1}`, level: 1, xp: 0 });

function defaultState() {
  return {
    v: SAVE_VERSION,
    turn: 0,
    history: [],        // newest first: { turn, roll, enc, monster, mroll, count, partyBefore? }
    combat: null,       // { monster, mroll, count, turn } while an encounter is unresolved
    threshold: 35, die: 'd100',
    tableIndex: 0,
    theme: 'auto',
    sound: true, anim: true, volume: 0.8,
    party: { size: 4, players: [0, 1, 2, 3].map(defaultPlayer) },
    xpLog: [],          // newest first: { turn, monsterName, cr, count, rawXP, adjustedXP, perPlayer }
    torch: { left: TORCH_MS, endsAt: null }, // endsAt set only while burning (real time)
  };
}

const int   = (v, lo, hi, d) => Number.isFinite(+v) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, Math.trunc(+v))) : d;
const bool  = (v, d) => typeof v === 'boolean' ? v : d;
const arr   = v => Array.isArray(v) ? v : [];
const player = (p, i) => ({
  name:  String(p?.name || defaultPlayer(i).name).slice(0, 12),
  level: int(p?.level, 1, 20, 1),
  xp:    int(p?.xp, 0, 1e9, 0),
});

// Accepts any saved blob (v1 = pre-refactor flat globals, v2 = this shape) and returns a
// complete, sanitised v2 state. Saved data is untrusted: clamp everything.
function migrate(raw) {
  const d = defaultState();
  if(!raw || typeof raw !== 'object') return d;
  const v1 = !raw.v;
  const g  = (v2Key, v1Key) => v1 ? raw[v1Key] : raw[v2Key];

  const die = Object.hasOwn(DIE_SIDES, g('die', 'DIE_TYPE')) ? g('die', 'DIE_TYPE') : d.die;
  const size = int(v1 ? raw.xpPartySize : raw.party?.size, 1, MAX_PARTY, d.party.size);
  const players = arr(v1 ? raw.xpPlayers : raw.party?.players).slice(0, MAX_PARTY).map(player);
  while(players.length < size) players.push(defaultPlayer(players.length));

  const torchLeft  = v1 ? raw.torchLeft   : raw.torch?.left;
  const torchEnds  = v1 ? raw.torchEndsAt : raw.torch?.endsAt;
  const combat     = v1 ? null : raw.combat;

  return {
    v: SAVE_VERSION,
    turn:       int(raw.turn, 0, 1e6, 0),
    history:    arr(raw.history).slice(0, 100).filter(e => e && typeof e === 'object'),
    combat:     combat && combat.monster ? { ...combat, count: int(combat.count, 1, 999, 1) } : null,
    threshold:  int(g('threshold', 'THRESHOLD'), 1, DIE_SIDES[die], d.threshold),
    die,
    tableIndex: int(g('tableIndex', 'MONSTER_TABLE_INDEX'), 0, 2, 0),
    theme:      THEMES.includes(raw.theme) ? raw.theme : d.theme, // old colour themes → auto
    sound:      bool(g('sound', 'soundOn'), d.sound),
    anim:       bool(g('anim', 'animOn'), d.anim),
    volume:     Number.isFinite(raw.volume) ? Math.min(1, Math.max(0, raw.volume)) : d.volume,
    party:      { size, players },
    xpLog:      arr(g('xpLog', 'xpSessionLog')).slice(0, 100).filter(e => e && typeof e === 'object'),
    torch: {
      left:   int(torchLeft, 0, TORCH_MS, TORCH_MS),
      endsAt: Number.isFinite(torchEnds) ? torchEnds : null,
    },
  };
}

function torchRemaining(torch, now = Date.now()) {
  return torch.endsAt ? Math.max(0, torch.endsAt - now) : torch.left;
}

// Node (test/) import hook — no-op in the browser
if (typeof module !== 'undefined') module.exports = { SAVE_VERSION, TORCH_MS, defaultState, migrate, torchRemaining };
