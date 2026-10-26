// Run: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const T = require('../js/tables.js');

test('esc neutralises HTML', () => {
  assert.equal(R.esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
  assert.equal(R.esc(null), '');
});

test('rollCountExpr stays in range', () => {
  for (let i = 0; i < 500; i++) {
    const n = R.rollCountExpr('1d4+2');
    assert.ok(n >= 3 && n <= 6, `1d4+2 gave ${n}`);
  }
  assert.equal(R.rollCountExpr('1'), 1);
  assert.equal(R.rollCountExpr('5'), 5);
});

test('rDie stays in range for every die', () => {
  for (const [die, sides] of Object.entries(R.DIE_SIDES))
    for (let i = 0; i < 300; i++) {
      const r = R.rDie(die);
      assert.ok(r >= 1 && r <= sides);
    }
});

test('dieRollToFace maps onto 20 faces', () => {
  assert.equal(R.dieRollToFace('d20', 1), 0);
  assert.equal(R.dieRollToFace('d20', 20), 19);
  assert.equal(R.dieRollToFace('d100', 100), 9);
});

test('XP: CR parsing and totals', () => {
  assert.deepEqual(R.parseCR('CR 3'), ['3', 1]);
  assert.deepEqual(R.parseCR('CR ½×1d4+2'), ['½', 5]); // avg of 1d4 (2.5) + 2, rounded
  assert.equal(R.crToXP('CR 3'), 700);
  assert.equal(R.crToXP('CR ¼×2d6'), 50 * 7);
});

test('XP: uploaded tables write CR without the "CR" prefix', () => {
  assert.equal(R.crToXP('1/2'), 100);
  assert.equal(R.crToXP('5'), 1800);
});

test('XP: encounter multipliers (DMG table + party size)', () => {
  assert.equal(R.getEncounterMultiplier(1, 4), 1);
  assert.equal(R.getEncounterMultiplier(2, 4), 1.5);
  assert.equal(R.getEncounterMultiplier(6, 4), 2);
  assert.equal(R.getEncounterMultiplier(15, 4), 4);
  assert.equal(R.getEncounterMultiplier(1, 2), 1.5);
  assert.equal(R.getEncounterMultiplier(1, 6), 0.5);
});

test('XP: level thresholds', () => {
  assert.equal(R.xpForLevel(1), 0);
  assert.equal(R.xpForLevel(5), 6500);
  assert.equal(R.xpToNextLevel(4), 6500);
  assert.equal(R.xpToNextLevel(20), null);
});

test('tables: CSV with quoted commas and header', () => {
  const rows = T.parseTableFile('t.csv', 'roll,name,cr,count,desc\n1,"Rat, giant",1/8,2d4,"Bitey"\n2,Ghoul,1,1,');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { roll: 1, name: 'Rat, giant', cr: '1/8', count: '2d4', desc: 'Bitey' });
});

test('tables: JSON keeps rich fields, rejects bad input', () => {
  const rows = T.parseTableFile('t.json', JSON.stringify([{ roll: 1, name: 'Ogre', cr: '2', lore: 'Big' }]));
  assert.equal(rows[0].lore, 'Big');
  assert.throws(() => T.parseTableFile('t.json', '{"name":"x"}'));
  assert.throws(() => T.parseTableFile('t.json', '[]'));
  assert.throws(() => T.parseTableFile('t.json', JSON.stringify(Array(101).fill({ name: 'x' }))));
});
