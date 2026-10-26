// Flat SVG dice, drawn front-on with their visible faces numbered.
// The face toward you shows the result; side faces show other numbers (never the opposite face).
// d100 is a percentile pair: a tens d10 (00–90) and a units d10 (0–9); 00 + 0 reads as 100.

// Geometry in a 0–100 viewBox. faces[0] is the face toward the viewer; `at`/`size` place its number.
const DIE_GEOM = {
  d20: (() => {
    const H = [[50,4],[90,27],[90,73],[50,96],[10,73],[10,27]];
    const P1 = [50,26], P2 = [74,67], P3 = [26,67];
    return {
      outline: H, at: [50, 54], size: 24,
      faces: [[P1,P2,P3], [P1,H[1],P2], [P2,H[3],P3], [P3,H[5],P1],
              [H[5],H[0],P1], [H[0],H[1],P1], [H[1],H[2],P2], [H[2],H[3],P2], [H[3],H[4],P3], [H[4],H[5],P3]],
    };
  })(),
  d10: (() => {
    const T = [50,3], A = [6,40], L = [27,47], M = [50,61], R = [73,47], D = [94,40], E = [10,63], F = [90,63], B = [50,97];
    return {
      outline: [T,D,F,B,E,A], at: [50, 40], size: 22,
      faces: [[T,L,M,R], [T,A,E,L], [T,R,F,D], [L,E,B,M], [M,B,F,R]],
    };
  })(),
  d12: (() => {
    const O = [[50,4],[94,36],[77,91],[23,91],[6,36]];
    const I = [[50,24],[74,41],[65,70],[35,70],[26,41]];
    return {
      outline: O, at: [50, 51], size: 24,
      faces: [I, ...O.map((o, i) => [I[i], o, O[(i + 1) % 5], I[(i + 1) % 5]])],
    };
  })(),
  d6: {
    outline: [[8,22],[22,8],[92,8],[92,78],[78,92],[8,92]], at: [43, 57], size: 0, // pips instead of a number
    faces: [[[8,22],[78,22],[78,92],[8,92]], [[8,22],[22,8],[92,8],[78,22]], [[78,22],[92,8],[92,78],[78,92]]],
  },
};

// Per die: shape, face values, opposite face, label
const DIE_KIND = {
  d20:   { geom: 'd20', values: range(1, 20), opp: n => 21 - n, label: mark69 },
  d12:   { geom: 'd12', values: range(1, 12), opp: n => 13 - n, label: mark69 },
  d6:    { geom: 'd6',  values: range(1, 6),  opp: n => 7 - n,  label: String },
  units: { geom: 'd10', values: range(0, 9),  opp: n => 9 - n,  label: mark69 },
  tens:  { geom: 'd10', values: range(0, 9),  opp: n => 9 - n,  label: n => String(n * 10).padStart(2, '0') },
};

function range(a, b) { return Array.from({ length: b - a + 1 }, (_, i) => a + i); }
function mark69(n) { return n === 6 || n === 9 ? `${n}.` : String(n); } // like real dice: tell 6 from 9

// Side-face numbers: stable per result, distinct, never the result or its opposite
function sideValues(kind, value, count) {
  const pool = kind.values.filter(v => v !== value && v !== kind.opp(value));
  let seed = value * 7919 + 17;
  for(let i = pool.length - 1; i > 0; i--) {
    seed = (seed * 48271) % 2147483647;
    const j = seed % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

const pts = poly => poly.map(p => p.join(',')).join(' ');
const centroid = poly => poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);

const PIPS = { 1: [[0,0]], 2: [[-1,-1],[1,1]], 3: [[-1,-1],[0,0],[1,1]], 4: [[-1,-1],[1,-1],[-1,1],[1,1]],
               5: [[-1,-1],[1,-1],[0,0],[-1,1],[1,1]], 6: [[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]] };

function dieSVG(kindName, value) {
  const kind = DIE_KIND[kindName], g = DIE_GEOM[kind.geom];
  const sides = sideValues(kind, value, g.faces.length - 1);
  // Body (outline + faces) turns while rolling; numbers sit in their own group and stay upright
  let body = `<polygon class="edge" points="${pts(g.outline)}"/>`;
  g.faces.forEach((f, i) => { body += `<polygon class="${i ? 'face' : 'face face-main'}" points="${pts(f)}"/>`; });

  let nums = `<g class="n-main-g">${mainMark(kindName, value)}</g>`;
  if(kind.geom !== 'd6') g.faces.slice(1).forEach((f, i) => { // d6 sides stay plain (pips would be noise)
    const [x, y] = centroid(f);
    nums += `<text class="n-side" x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${kind.geom === 'd10' ? 8 : 9}">${kind.label(sides[i])}</text>`;
  });
  return `<svg class="die-shape" viewBox="0 0 100 100" aria-hidden="true"><g class="body">${body}</g>${nums}</svg>`;
}

// The front-face mark: a number, or pips on a d6
function mainMark(kindName, value) {
  const kind = DIE_KIND[kindName], g = DIE_GEOM[kind.geom];
  if(kind.geom === 'd6')
    return PIPS[value].map(([x, y]) => `<circle class="pip" cx="${g.at[0] + x * 19}" cy="${g.at[1] + y * 19}" r="6.5"/>`).join('');
  const label = kind.label(value);
  return `<text class="n-main" x="${g.at[0]}" y="${g.at[1]}" font-size="${label.length > 2 ? g.size * 0.8 : g.size}">${label}</text>`;
}

// d100 → [['tens', 6], ['units', 6]]; other dice → [[die, value]]
function dieParts(die, v) {
  return die === 'd100' ? [['tens', Math.floor((v % 100) / 10)], ['units', v % 10]] : [[die, v]];
}

// Draw `die` showing `value` (1..sides) into the .die-face element; null = at rest on its top value
function drawDie(faceId, die, value) {
  const el = $(faceId);
  el.innerHTML = dieParts(die, value ?? DIE_SIDES[die]).map(([k, n]) => dieSVG(k, n)).join('');
  el.classList.toggle('pair', die === 'd100');
  el.setAttribute('aria-label', `${die}: ${value ?? 'not rolled'}`);
}

// Only the front numbers change mid-roll — the SVGs stay put so their turn animation runs once
function setFrontNumbers(faceId, die, value) {
  const svgs = $(faceId).querySelectorAll('.die-shape');
  dieParts(die, value).forEach(([k, n], i) => { svgs[i].querySelector('.n-main-g').innerHTML = mainMark(k, n); });
}

// One smooth, slowing turn; the front number ticks over like a slowing counter and lands on
// `final`, then the side faces fade back in. Instant when animations are off.
const ROLL_TICKS = [0, 55, 115, 185, 270, 370, 490]; // ms; gaps widen as the die slows
const ROLL_LAND = 620, ROLL_DONE = 860;

function rollDie(faceId, die, final, done) {
  if(!S.anim) { drawDie(faceId, die, final); done(); return; }
  const wrap = $(faceId).closest('.die');
  const sides = DIE_SIDES[die];
  const rand = () => 1 + Math.floor(Math.random() * sides);
  drawDie(faceId, die, rand());
  wrap.classList.remove('rolling', 'landed');
  void wrap.offsetWidth;
  wrap.classList.add('rolling');
  const timers = ROLL_TICKS.map(t => setTimeout(() => setFrontNumbers(faceId, die, rand()), t));
  timers.push(setTimeout(() => setFrontNumbers(faceId, die, final), ROLL_LAND));
  setTimeout(() => {
    drawDie(faceId, die, final); // side faces now match the result
    wrap.classList.remove('rolling');
    wrap.classList.add('landed');
    done();
  }, ROLL_DONE);
}
