// Pure game rules — no DOM. Loaded before app.js; also required by test/rules.test.js
// Escape untrusted text (uploaded tables, player names, saved state) before innerHTML
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const DIE_SIDES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };

// ── Dice helpers ───────────────────────────────────
function rDie(type) { return Math.floor(Math.random() * DIE_SIDES[type]) + 1; }
function r20()      { return Math.floor(Math.random() * 20) + 1; }

function dieRollToFace(type, roll) {
  if(type === 'd100') return Math.floor((roll - 1) / 10) % 20;
  return (roll - 1) % 20;
}

// Evaluate dice expression: "1d4+2" → integer result
function rollCountExpr(expr) {
  if(!expr || expr === '1') return 1;
  const m = expr.match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/);
  if(!m) return parseInt(expr) || 1;
  const [, n, sides, sign, mod] = m.map((v, i) => i > 0 ? (v || 0) : v);
  let total = 0;
  for(let i = 0; i < +n; i++) total += 1 + Math.floor(Math.random() * +sides);
  return total + (sign === '+' ? +mod : sign === '-' ? -mod : 0);
}



// XP thresholds per level (index = level, value = XP to reach that level)
const XP_THRESHOLDS = [
  0,       // level 0 placeholder
  0,       // level 1
  300,     // level 2
  900,     // level 3
  2700,    // level 4
  6500,    // level 5
  14000,   // level 6
  23000,   // level 7
  34000,   // level 8
  48000,   // level 9
  64000,   // level 10
  85000,   // level 11
  100000,  // level 12
  120000,  // level 13
  140000,  // level 14
  165000,  // level 15
  195000,  // level 16
  225000,  // level 17
  265000,  // level 18
  305000,  // level 19
  355000,  // level 20
];

// XP values by CR
const CR_XP = {
  '0':25,'1/8':25,'⅛':25,'1/4':50,'¼':50,'1/2':100,'½':100,
  '1':200,'2':450,'3':700,'4':1100,'5':1800,'6':2300,'7':2900,
  '8':3900,'9':5000,'10':5900,'11':7200,'12':8400,'13':10000,
  '14':11500,'15':13000,'16':15000,'17':18000,'18':20000,
  '19':22000,'20':25000,'21':33000,'22':41000,'23':50000,
  '24':62000,'25':75000,'26':90000,'27':105000,'28':120000,
  '29':135000,'30':155000,
};

// Encounter multipliers based on monster count vs. party size
function getEncounterMultiplier(monsterCount, partySize){
  let m;
  if(monsterCount === 1)       m = 1;
  else if(monsterCount === 2)  m = 1.5;
  else if(monsterCount <= 6)   m = 2;
  else if(monsterCount <= 10)  m = 2.5;
  else if(monsterCount <= 14)  m = 3;
  else                         m = 4;
  // Adjust for small/large parties
  if(partySize <= 2) m = Math.min(m * 1.5, 4);
  if(partySize >= 6) m = Math.max(m * 0.5, 0.5);
  return m;
}

// Parse CR string like "CR 3", "CR ¼×1d4", "CR ½×1d4+2" etc.
// Returns [base_cr_string, avg_count]
function parseCR(crStr){
  // e.g. "CR ½×1d4+2" → base "½", count ~4
  // "CR " prefix optional: uploaded tables usually write just "1/2"
  const m = String(crStr).match(/(?:CR\s*)?([\d\/½¼⅛]+)\s*×?\s*([\d]+)?d?([\d]+)?(?:\+([\d]+))?/);
  if(!m) return ['0', 1];
  const base = m[1] || '0';
  // If there's a count expression like 1d4+2, compute average
  let count = 1;
  if(m[3]){
    const dice = parseInt(m[2]||1);
    const sides = parseInt(m[3]);
    const bonus = parseInt(m[4]||0);
    count = Math.round(dice * (sides/2+0.5) + bonus);
  }
  return [base, count];
}

function crToXP(crStr){
  const [base, count] = parseCR(crStr);
  const singleXP = CR_XP[base] || 0;
  return singleXP * count;
}


function xpForLevel(lvl){ return XP_THRESHOLDS[Math.min(lvl,20)] || 0; }
function xpToNextLevel(lvl){
  if(lvl >= 20) return null;
  return XP_THRESHOLDS[lvl+1];
}

// XP for one encounter. `count` is the group size actually rolled; a CR written as
// "CR ½×1d4" carries its own count, used when no larger count was rolled.
function encounterXP(cr, count, partySize) {
  const [base, crCount] = parseCR(cr);
  const n = count > 1 ? count : crCount;
  const rawXP      = (CR_XP[base] || 0) * n;
  const adjustedXP = Math.round(rawXP * getEncounterMultiplier(n, partySize));
  return { count: n, rawXP, adjustedXP, perPlayer: Math.floor(adjustedXP / partySize) };
}

// Give each of the first `size` players `perPlayer` XP. Returns new player objects and
// the indexes of players who levelled up (inputs are not mutated).
function awardXP(players, size, perPlayer) {
  const levelUps = [];
  const out = players.map((p, i) => {
    if(i >= size || p.level >= 20) return { ...p };
    const q = { ...p, xp: p.xp + perPlayer };
    while(q.level < 20 && q.xp >= xpToNextLevel(q.level)) q.level++;
    if(q.level > p.level) levelUps.push(i);
    return q;
  });
  return { players: out, levelUps };
}

// Node (test/) import hook — no-op in the browser
if (typeof module !== 'undefined') module.exports = { encounterXP, awardXP, esc, DIE_SIDES, rDie, r20, dieRollToFace, rollCountExpr, XP_THRESHOLDS, CR_XP, getEncounterMultiplier, parseCR, crToXP, xpForLevel, xpToNextLevel };
