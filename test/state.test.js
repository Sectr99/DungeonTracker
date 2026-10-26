// Run: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
global.DIE_SIDES = R.DIE_SIDES; // state.js expects rules.js globals, as in the browser
const S = require('../js/state.js');

test('XP uses the rolled group size', () => {
  // Skeleton Patrol: CR ¼ × 5 rolled → 250 raw, ×2 for 3–6 monsters, party of 4
  assert.deepEqual(R.encounterXP('CR ¼', 5, 4), { count: 5, rawXP: 250, adjustedXP: 500, perPlayer: 125 });
  assert.equal(R.encounterXP('CR 3', 1, 4).perPlayer, 175);
  assert.equal(R.encounterXP('CR ½×1d4+2', 1, 4).count, 5); // count from the CR string
});

test('awardXP only rewards the active party and reports level-ups', () => {
  const players = [{ name: 'A', level: 1, xp: 250 }, { name: 'B', level: 1, xp: 0 }, { name: 'C', level: 1, xp: 0 }];
  const r = R.awardXP(players, 2, 100);
  assert.deepEqual(r.players.map(p => [p.level, p.xp]), [[2, 350], [1, 100], [1, 0]]);
  assert.deepEqual(r.levelUps, [0]);
  assert.equal(players[0].xp, 250, 'input not mutated');
  assert.equal(R.awardXP([{ name: 'A', level: 1, xp: 0 }], 1, 7000).players[0].level, 5);
});

test('migrate: empty/garbage → defaults', () => {
  assert.deepEqual(S.migrate(null), S.defaultState());
  assert.deepEqual(S.migrate('nope'), S.defaultState());
});

test('migrate: v1 flat save maps onto v2', () => {
  const v1 = {
    turn: 7, soundOn: false, animOn: true, diceAnimOn: false, MONSTER_TABLE_INDEX: 2,
    history: [{ turn: 7, roll: 3, enc: true }], xpPartySize: 3,
    xpPlayers: [{ name: 'Brak', level: 3, xp: 1000 }],
    xpSessionLog: [{ turn: 2 }], theme: 'torchlight', THRESHOLD: 7, DIE_TYPE: 'd20',
    torchLeft: 1000, torchEndsAt: null,
  };
  const s = S.migrate(v1);
  assert.equal(s.v, S.SAVE_VERSION);
  assert.equal(s.turn, 7);
  assert.equal(s.sound, false);
  assert.equal(s.tableIndex, 2);
  assert.equal(s.die, 'd20');
  assert.equal(s.threshold, 7);
  assert.equal(s.theme, 'auto'); // retired colour themes fall back to auto
  assert.equal(s.party.size, 3);
  assert.deepEqual(s.party.players.map(p => p.name), ['Brak', 'Player 2', 'Player 3']);
  assert.equal(s.xpLog.length, 1);
  assert.equal(s.torch.left, 1000);
});

test('migrate: clamps hostile values', () => {
  const s = S.migrate({ v: 2, threshold: 999, die: 'd7', tableIndex: 9, theme: '<x>', volume: 5,
    party: { size: 50, players: [{ name: 'x'.repeat(40), level: 99, xp: -5 }] } });
  assert.equal(s.die, 'd100');
  assert.equal(s.threshold, 100);
  assert.equal(s.tableIndex, 2);
  assert.equal(s.theme, 'auto');
  assert.equal(s.volume, 1);
  assert.equal(s.party.size, 8);
  assert.deepEqual(s.party.players[0], { name: 'x'.repeat(12), level: 20, xp: 0 });
});

test('torchRemaining counts real time while burning', () => {
  assert.equal(S.torchRemaining({ left: 5000, endsAt: null }, 0), 5000);
  assert.equal(S.torchRemaining({ left: 0, endsAt: 10_000 }, 4_000), 6000);
  assert.equal(S.torchRemaining({ left: 0, endsAt: 10_000 }, 99_000), 0);
});
