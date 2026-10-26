// 3D dice drawn on canvas with our own projection — no library.
// Each die is a real polyhedron (d6, d10, d12, d20) with numbered faces, shaded per frame
// against a fixed light. A roll picks the result first, then animates a throw that tumbles and
// lands with that face toward the viewer, upright. d100 is a tens d10 (00–90) + units d10 (0–9).

// ── Vector / quaternion helpers ────────────────────
const PHI = (1 + Math.sqrt(5)) / 2;
const vdot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const vsub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const vadd = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const vmul = (a, k) => [a[0]*k, a[1]*k, a[2]*k];
const vlen = a => Math.hypot(a[0], a[1], a[2]);
const vnrm = a => vmul(a, 1 / vlen(a));
const vcross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const vavg = ps => vmul(ps.reduce(vadd, [0, 0, 0]), 1 / ps.length);
const randAxis = () => vnrm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);

const qmul = (a, b) => [
  a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3], a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
  a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1], a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0]];
const qaxis = (ax, an) => { const s = Math.sin(an / 2); return [Math.cos(an / 2), ax[0]*s, ax[1]*s, ax[2]*s]; };
function qslerp(a, b, t) {
  let d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
  if(d < 0) { b = b.map(v => -v); d = -d; }
  if(d > 0.9995) { const r = a.map((v, i) => v + (b[i] - v) * t), l = Math.hypot(...r); return r.map(v => v / l); }
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((v, i) => (v * Math.sin((1 - t) * th) + b[i] * Math.sin(t * th)) / s);
}
const qmat = ([w, x, y, z]) => [
  [1 - 2*(y*y + z*z), 2*(x*y - w*z), 2*(x*z + w*y)],
  [2*(x*y + w*z), 1 - 2*(x*x + z*z), 2*(y*z - w*x)],
  [2*(x*z - w*y), 2*(y*z + w*x), 1 - 2*(x*x + y*y)]];
function matq(m) {
  const t = m[0][0] + m[1][1] + m[2][2];
  if(t > 0) { const s = Math.sqrt(t + 1) * 2; return [s/4, (m[2][1]-m[1][2])/s, (m[0][2]-m[2][0])/s, (m[1][0]-m[0][1])/s]; }
  if(m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; return [(m[2][1]-m[1][2])/s, s/4, (m[0][1]+m[1][0])/s, (m[0][2]+m[2][0])/s]; }
  if(m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; return [(m[0][2]-m[2][0])/s, (m[0][1]+m[1][0])/s, s/4, (m[1][2]+m[2][1])/s]; }
  const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; return [(m[1][0]-m[0][1])/s, (m[0][2]+m[2][0])/s, (m[1][2]+m[2][1])/s, s/4];
}
const mmul = (a, b) => a.map(r => [0, 1, 2].map(j => r[0]*b[0][j] + r[1]*b[1][j] + r[2]*b[2][j]));
const rotX = a => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const rotY = a => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];

// ── Geometry ───────────────────────────────────────
function signs(base) {
  let out = [[]];
  base.forEach(v => { out = out.flatMap(p => v === 0 ? [[...p, 0]] : [[...p, v], [...p, -v]]); });
  return out;
}
const CUBE = signs([1, 1, 1]);
const ICO  = [...signs([0, 1, PHI]), ...signs([1, PHI, 0]), ...signs([PHI, 0, 1])];
// The dodecahedron is the icosahedron's dual: its corners are the icosahedron's face centres
// (triangles of edge length 2), so each solid's corners line up with the other's face normals.
const DOD = (() => {
  const out = [], close = (a, b) => Math.abs(vlen(vsub(a, b)) - 2) < 1e-6;
  for(let i = 0; i < 12; i++) for(let j = i + 1; j < 12; j++) for(let k = j + 1; k < 12; k++)
    if(close(ICO[i], ICO[j]) && close(ICO[j], ICO[k]) && close(ICO[i], ICO[k])) out.push(vavg([ICO[i], ICO[j], ICO[k]]));
  return out;
})();

// A convex solid's faces: for each face normal, the vertices furthest along it, in winding order
function facesByNormals(verts, normals) {
  return normals.map(n => {
    n = vnrm(n);
    const ds = verts.map(p => vdot(p, n)), m = Math.max(...ds);
    const fv = verts.filter((p, i) => ds[i] > m - 1e-6);
    const c = vavg(fv), a = vnrm(vsub(fv[0], c)), b = vcross(n, a);
    const ang = p => Math.atan2(vdot(vsub(p, c), b), vdot(vsub(p, c), a));
    fv.sort((p, q) => ang(p) - ang(q));
    return { verts: fv, n, up: fv[0] };
  });
}

// Pentagonal trapezohedron; ring height chosen so every kite is planar
function d10Faces() {
  const c36 = Math.cos(Math.PI / 5), z = 0.1, h = z * (1 + c36) / (1 - c36);
  const T = [0, -h, 0], B = [0, h, 0];
  const U = k => [Math.cos(k * 2 * Math.PI / 5), -z, Math.sin(k * 2 * Math.PI / 5)];
  const L = k => [Math.cos((k + 0.5) * 2 * Math.PI / 5), z, Math.sin((k + 0.5) * 2 * Math.PI / 5)];
  const F = [];
  for(let k = 0; k < 5; k++) { F.push([T, U(k), L(k), U(k + 1)]); F.push([B, L(k), U(k + 1), L(k + 1)]); }
  return F.map(vs => {
    let n = vnrm(vcross(vsub(vs[1], vs[0]), vsub(vs[3], vs[0])));
    if(vdot(n, vavg(vs)) < 0) n = vmul(n, -1);
    return { verts: vs, n, up: vs[0] }; // numbers read with their top toward the apex
  });
}

function unitRadius(faces) {
  const r = Math.max(...faces.flatMap(f => f.verts.map(vlen)));
  faces.forEach(f => { f.verts = f.verts.map(p => vmul(p, 1 / r)); f.up = vmul(f.up, 1 / r); });
  return faces;
}

const GEOMETRY = {
  d6:  () => unitRadius(facesByNormals(CUBE, [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]])),
  d20: () => unitRadius(facesByNormals(ICO, DOD)),
  d12: () => unitRadius(facesByNormals(DOD, ICO)),
  d10: () => unitRadius(d10Faces()),
};

// Number the faces so opposite faces sum like real dice (d20: 21, d12: 13, d6: 7, d10: 9)
function numberFaces(faces, isD10) {
  const N = faces.length, half = isD10 ? [0, 1, 2, 3, 4] : [...Array(N / 2)].map((_, i) => i + 1);
  const comp = isD10 ? v => 9 - v : v => N + 1 - v;
  const done = new Set();
  let k = 0;
  faces.forEach((f, i) => {
    if(done.has(i)) return;
    const j = faces.findIndex((g, jj) => !done.has(jj) && jj !== i && vdot(g.n, f.n) < -0.999);
    f.v = half[k++]; done.add(i);
    if(j >= 0) { faces[j].v = comp(f.v); done.add(j); }
  });
}

// Area centroid of a 2D polygon — the visual middle (corner averages sit low on kites)
function areaCentroid(P) {
  let a = 0, cx = 0, cy = 0;
  for(let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length], cr = x0 * y1 - x1 * y0;
    a += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

// Digit height as a fraction of font size, so a number centres on its glyphs rather than the em box
let DIGIT_HEIGHT = 0.72;
function measureDigits() {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '600 100px Oswald';
  const m = ctx.measureText('0123456789');
  if(m.actualBoundingBoxAscent) DIGIT_HEIGHT = (m.actualBoundingBoxAscent - (m.actualBoundingBoxDescent || 0)) / 100;
  Object.values(DICE_SETS).forEach(paintSet); // repaint now the real font is in
}
document.fonts?.load('600 40px Oswald').then(measureDigits).catch(() => {});

// ── One die (pure data; painted onto its set's canvas) ──
const faceLabel = (kind, v) => kind === 'tens' ? String(v * 10).padStart(2, '0') : (v === 6 || v === 9) ? `${v}.` : String(v);

function makeDie(kind, S) {
  const geom = kind === 'tens' || kind === 'units' ? 'd10' : kind;
  const faces = GEOMETRY[geom]();
  numberFaces(faces, geom === 'd10');

  faces.forEach(f => {
    // Face-local axes: z = outward normal, y = down the face (away from `up`), x = y × z
    const c = vavg(f.verts), z = f.n;
    let up = vsub(f.up, c);
    up = vnrm(vsub(up, vmul(z, vdot(up, z))));
    const y = vmul(up, -1), x = vcross(y, z);

    const P = f.verts.map(p => [vdot(vsub(p, c), x) * S, vdot(vsub(p, c), y) * S]);
    const [mx, my] = areaCentroid(P);
    let inr = Infinity; // distance from the middle to the nearest edge bounds the number's size
    for(let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], e = [b[0] - a[0], b[1] - a[1]];
      inr = Math.min(inr, Math.abs((a[0] - mx) * e[1] - (a[1] - my) * e[0]) / Math.hypot(...e));
    }
    const txt = faceLabel(kind, f.v);
    Object.assign(f, { x, y, z, c: vmul(c, S), mx, my, txt,
      fs: inr * (txt.length > 1 ? 1.0 : 1.25) * (geom === 'd10' ? 1.15 : 1),
      pts: f.verts.map(p => vmul(p, S)) });
  });
  return { faces, q: qaxis(randAxis(), Math.random() * 6), off: 0, tx: 0, ty: 0, S };
}

// Rest pose for a value: that face toward the viewer, upright, tilted a little to show depth
function restQ(die, value) {
  const f = die.faces.find(g => g.v === value) || die.faces[0];
  return matq(mmul(mmul(rotX(0.2), rotY(0.12)), [f.x, f.y, f.z]));
}

// ── Painting ───────────────────────────────────────
// Canvas, not CSS 3D: the browser can't smooth text on steeply tilted CSS layers, but canvas
// paths and text are anti-aliased and drawn at the screen's full pixel density.
const LIGHT = vnrm([-0.45, -0.7, 0.75]);
const FOCAL = 700; // perspective distance, px
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function paintSet(set) {
  const { ctx, cv, ox, oy, el } = set;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);

  const css = getComputedStyle(el.closest('.die') || el);
  const face = css.getPropertyValue('--die-face').trim() || css.getPropertyValue('--paper').trim();
  const ink  = css.getPropertyValue('--ink').trim();
  const num  = css.getPropertyValue('--die-ink').trim() || ink;

  set.dice.forEach(d => {
    const m = qmat(d.q), S = d.S;
    const rot = p => [vdot(m[0], p), vdot(m[1], p), vdot(m[2], p)];
    const proj = w => { const k = FOCAL / (FOCAL - w[2]); return [ox + (w[0] + d.tx) * k, oy + (w[1] + d.ty) * k]; };

    // Shadow on the table, shrinking and fading as the die lifts
    const lift = Math.min(0, d.ty), sc = 1 + lift / (S * 5);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.translate(ox + d.tx, oy + S * 0.98);
    ctx.scale(sc, sc * 0.22);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.85);
    g.addColorStop(0, `rgba(0,0,0,${(0.2 * (1 + lift / (S * 4))).toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, S * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Faces toward the viewer, far to near
    d.faces
      .map(f => ({ f, n: rot(f.z), c: rot(f.c) }))
      .filter(o => o.n[2] > 0.01)
      .sort((a, b) => a.c[2] - b.c[2])
      .forEach(({ f, n, c }) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.beginPath();
        f.pts.forEach((p, i) => { const [sx, sy] = proj(rot(p)); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
        ctx.closePath();
        ctx.fillStyle = face; ctx.fill();
        ctx.fillStyle = `rgba(0,0,0,${(0.42 * (1 - Math.max(0, vdot(n, LIGHT)))).toFixed(3)})`; ctx.fill();
        ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke();

        // Number: map the face's local 2D frame onto screen (affine fit of the projection);
        // fade it out as the face turns edge-on, like a real die
        const alpha = smooth(0.12, 0.45, n[2]);
        if(alpha <= 0) return;
        const O = proj(c), X = proj(vadd(c, rot(f.x))), Y = proj(vadd(c, rot(f.y)));
        ctx.setTransform(dpr * (X[0] - O[0]), dpr * (X[1] - O[1]), dpr * (Y[0] - O[0]), dpr * (Y[1] - O[1]), dpr * O[0], dpr * O[1]);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = num;
        ctx.font = `600 ${f.fs.toFixed(1)}px Oswald, 'Arial Narrow', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(f.txt, f.mx, f.my + DIGIT_HEIGHT * f.fs / 2);
        ctx.globalAlpha = 1;
      });
  });
}

// ── Public API (used by app.js) ────────────────────
// Each .die-face element holds a set: one die, or the tens + units pair for d100, on one canvas
// that extends past the box so throws can fly in from the left.
const DICE_SETS = {};
const dieParts = (die, v) => die === 'd100' ? [['tens', Math.floor((v % 100) / 10)], ['units', v % 10]] : [[die, v]];
const THROW_TRAVEL = 3.2, THROW_HOP = 1.1; // in die radii

function diceSet(faceId, die) {
  const el = $(faceId);
  const box = parseFloat(getComputedStyle(el).height) || 112; // works while hidden, unlike clientHeight
  const dpr = window.devicePixelRatio || 1;
  const cached = DICE_SETS[faceId];
  if(cached && cached.die === die && cached.box === box && cached.dpr === dpr) return cached;

  el.classList.toggle('pair', die === 'd100');
  const S = box * 0.4, w = box * (die === 'd100' ? 2 : 1);
  const padL = S * (THROW_TRAVEL + 1.4), padT = S * (THROW_HOP + 1.4), pad = S * 1.4;
  const cv = document.createElement('canvas');
  const cw = w + padL + pad, ch = box + padT + pad;
  cv.width = Math.ceil(cw * dpr); cv.height = Math.ceil(ch * dpr);
  cv.style.cssText = `left:${-padL}px;top:${-padT}px;width:${cw}px;height:${ch}px`;
  el.replaceChildren(cv);

  const parts = dieParts(die, DIE_SIDES[die]);
  const dice = parts.map(([kind], i) => {
    const d = makeDie(kind, S);
    d.off = d.tx = parts.length > 1 ? (i ? 1 : -1) * S * 1.2 : 0;
    if(cached?.dice[i]) d.q = cached.dice[i].q; // keep orientation across a resize
    return d;
  });
  return (DICE_SETS[faceId] = { die, dice, el, cv, ctx: cv.getContext('2d'), box, dpr, ox: padL + w / 2, oy: padT + box / 2 });
}

// Show `value` (1..sides) at rest; null = the die's top value
function drawDie(faceId, die, value) {
  const set = diceSet(faceId, die);
  dieParts(die, value ?? DIE_SIDES[die]).forEach(([, v], i) => {
    const d = set.dice[i];
    d.q = restQ(d, v); d.tx = d.off; d.ty = 0;
  });
  set.value = value;
  paintSet(set);
  set.el.setAttribute('aria-label', `${die}: ${value ?? 'not rolled'}`);
}

// Dice are sized from their box (it shrinks on small screens) and the screen's pixel density:
// rebuild at rest when either changes. Mid-throw sets are left alone; they repaint every frame.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => Object.entries(DICE_SETS).forEach(([id, set]) => {
    if(!set.rolling) drawDie(id, set.die, set.value);
  }), 120);
});

// Throw: enters from the left, bounces, slides to a stop, tumbling the whole way and landing on `final`
const THROW_MS = 1250;
const easeOut = t => 1 - Math.pow(1 - t, 3);

function rollDie(faceId, die, final, done) {
  if(!S.anim) { drawDie(faceId, die, final); done(); return; }
  const set = diceSet(faceId, die);
  const plans = dieParts(die, final).map(([, v], i) => {
    const d = set.dice[i];
    return { d, q0: d.q, qf: restQ(d, v), ax: randAxis(), spin: (2.2 + Math.random()) * 2 * Math.PI, delay: i * 90 };
  });
  const start = performance.now();
  set.rolling = true;
  const frame = now => {
    let running = false;
    plans.forEach(({ d, q0, qf, ax, spin, delay }) => {
      const t = Math.min(1, Math.max(0, (now - start - delay) / THROW_MS)), e = easeOut(t);
      if(t < 1) running = true;
      d.q  = t < 1 ? qmul(qaxis(ax, spin * (1 - e)), qslerp(q0, qf, e)) : qf;
      d.tx = d.off - d.S * THROW_TRAVEL * (1 - e);
      d.ty = -Math.abs(Math.sin(t * Math.PI * 3.2)) * d.S * THROW_HOP * Math.pow(1 - t, 1.6);
    });
    paintSet(set);
    if(running) requestAnimationFrame(frame);
    else { set.rolling = false; set.value = final; done(); }
  };
  requestAnimationFrame(frame);
  set.el.setAttribute('aria-label', `${die}: ${final}`);
}
