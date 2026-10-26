// ── ANIMATED BACKGROUND — scrolling dungeon stone walls ─────────────────
(function initBG(){
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H;

  // ── Brick dimensions ──────────────────────────────────────────────────
  const BW     = 92;   // brick face width  (px)
  const BH     = 36;   // brick face height (px)
  const MORTAR = 4;    // mortar gap
  const TW     = BW + MORTAR;
  const TH     = BH + MORTAR;
  const SPEED  = 0.38; // pixels per frame at 60 fps

  // ── Deterministic PRNG ────────────────────────────────────────────────
  function rng(a, b){
    let s = (Math.imul((a|0) ^ 0xdeadbeef, (b|0) ^ 0x9e3779b9) >>> 0);
    s ^= s >>> 13; s = Math.imul(s, 0x45d9f3b) >>> 0;
    s ^= s >>> 17; s = Math.imul(s, 0xc4ceb9fe) >>> 0;
    return (s >>> 0) / 0x100000000;
  }

  // ── Render one brick face using ImageData (pixel-level control) ───────
  function makeBrick(id){
    const oc = document.createElement('canvas');
    oc.width = BW; oc.height = BH;
    const c  = oc.getContext('2d');

    // --- Base stone colour (dark, slightly warm grey) ---
    const baseR = Math.round(18 + rng(id,1)*9);
    const baseG = Math.round(16 + rng(id,2)*8);
    const baseB = Math.round(19 + rng(id,3)*9);
    c.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
    c.fillRect(0, 0, BW, BH);

    // --- Pixel-level noise via ImageData ---
    const id2 = c.getImageData(0, 0, BW, BH);
    const d   = id2.data;
    for(let y = 0; y < BH; y++){
      for(let x = 0; x < BW; x++){
        const i = (y * BW + x) * 4;
        // micro-noise: jitter each pixel independently
        const noise = (rng(id*1000 + x*3, y*7 + 2) - 0.5) * 14;
        d[i]   = Math.max(0, Math.min(255, d[i]   + noise));
        d[i+1] = Math.max(0, Math.min(255, d[i+1] + noise * 0.9));
        d[i+2] = Math.max(0, Math.min(255, d[i+2] + noise * 1.1));
      }
    }
    c.putImageData(id2, 0, 0);

    // --- Damp staining: 2-4 vertical dark streaks ---
    const nStains = 2 + Math.round(rng(id,10) * 2);
    for(let s = 0; s < nStains; s++){
      const sx = rng(id, s*7+11) * BW;
      const sw = 3 + rng(id, s*7+12) * 9;
      const sa = 0.07 + rng(id, s*7+13) * 0.11;
      const sg = c.createLinearGradient(0, 0, 0, BH);
      sg.addColorStop(0,   `rgba(0,0,0,0)`);
      sg.addColorStop(0.25,`rgba(0,0,0,${sa.toFixed(3)})`);
      sg.addColorStop(1,   `rgba(0,0,0,${(sa*0.5).toFixed(3)})`);
      c.fillStyle = sg;
      // Irregular stain width using trapezoid
      c.beginPath();
      c.moveTo(sx - sw*0.4, 0);
      c.lineTo(sx + sw*0.4, 0);
      c.lineTo(sx + sw*(0.4 + rng(id,s+50)*0.4), BH);
      c.lineTo(sx - sw*(0.4 + rng(id,s+51)*0.4), BH);
      c.closePath();
      c.fill();
    }

    // --- Chips and pits: small dark depressions ---
    const nChips = 3 + Math.round(rng(id,20) * 5);
    for(let p = 0; p < nChips; p++){
      const cx = 2 + rng(id, p*5+21) * (BW-4);
      const cy = 1 + rng(id, p*5+22) * (BH-2);
      const cr = 0.8 + rng(id, p*5+23) * 2.5;
      const g  = c.createRadialGradient(cx,cy,0, cx,cy,cr);
      g.addColorStop(0,'rgba(0,0,0,0.45)');
      g.addColorStop(0.6,'rgba(0,0,0,0.15)');
      g.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, cr*1.5, 0, Math.PI*2); c.fill();
    }

    // --- Hairline crack (60% of bricks) ---
    if(rng(id,30) > 0.4){
      const x1 = Math.round(rng(id,31)*(BW-10)+5);
      const y1 = Math.round(rng(id,32)*(BH*0.3)+BH*0.1);
      // crack has 2-3 segments with slight jags
      const segs = 2 + Math.round(rng(id,33));
      c.lineWidth = 0.6;
      c.strokeStyle = `rgba(0,0,0,${(0.22+rng(id,34)*0.18).toFixed(3)})`;
      c.beginPath(); c.moveTo(x1, y1);
      let cx2 = x1, cy2 = y1;
      for(let seg = 0; seg < segs; seg++){
        cx2 += Math.round((rng(id,35+seg*2)-0.5)*14);
        cy2 += Math.round(rng(id,36+seg*2)*(BH*0.25)+3);
        c.lineTo(cx2, Math.min(cy2, BH-1));
      }
      c.stroke();
      // faint bright line beside it (rock split highlight)
      c.strokeStyle = 'rgba(255,255,255,0.06)';
      c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(x1+1, y1);
      cx2 = x1+1; cy2 = y1;
      for(let seg = 0; seg < segs; seg++){
        cx2 += Math.round((rng(id,35+seg*2)-0.5)*14);
        cy2 += Math.round(rng(id,36+seg*2)*(BH*0.25)+3);
        c.lineTo(cx2, Math.min(cy2, BH-1));
      }
      c.stroke();
    }

    // --- Lichen / efflorescence patch (40% of bricks) ---
    if(rng(id,40) > 0.6){
      const lx = rng(id,41)*BW;
      const ly = rng(id,42)*BH;
      const lr = 4 + rng(id,43)*9;
      const isGreen = rng(id,44) > 0.45;
      const lg = c.createRadialGradient(lx,ly,0,lx,ly,lr);
      if(isGreen){
        lg.addColorStop(0,'rgba(28,42,14,0.28)');
        lg.addColorStop(0.5,'rgba(22,34,12,0.12)');
      } else {
        lg.addColorStop(0,'rgba(190,184,168,0.18)');
        lg.addColorStop(0.5,'rgba(170,165,150,0.08)');
      }
      lg.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle = lg;
      c.beginPath(); c.arc(lx, ly, lr, 0, Math.PI*2); c.fill();
    }

    // --- Recessed bevel (light top/left, shadow bottom/right) ---
    // Top highlight
    const topGrad = c.createLinearGradient(0,0,0,BH*0.12);
    topGrad.addColorStop(0,'rgba(255,255,255,0.12)');
    topGrad.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle = topGrad; c.fillRect(0,0,BW,Math.ceil(BH*0.12));
    // Left highlight
    const leftGrad = c.createLinearGradient(0,0,BW*0.08,0);
    leftGrad.addColorStop(0,'rgba(255,255,255,0.07)');
    leftGrad.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle = leftGrad; c.fillRect(0,0,Math.ceil(BW*0.08),BH);
    // Bottom shadow
    const botGrad = c.createLinearGradient(0,BH*0.85,0,BH);
    botGrad.addColorStop(0,'rgba(0,0,0,0)');
    botGrad.addColorStop(1,'rgba(0,0,0,0.32)');
    c.fillStyle = botGrad; c.fillRect(0,Math.floor(BH*0.85),BW,Math.ceil(BH*0.15));
    // Right shadow
    const rightGrad = c.createLinearGradient(BW*0.88,0,BW,0);
    rightGrad.addColorStop(0,'rgba(0,0,0,0)');
    rightGrad.addColorStop(1,'rgba(0,0,0,0.22)');
    c.fillStyle = rightGrad; c.fillRect(Math.floor(BW*0.88),0,Math.ceil(BW*0.12),BH);

    return oc;
  }

  // Build brick library
  const NVARIANTS = 32;
  const brickLib  = [];
  for(let i = 0; i < NVARIANTS; i++) brickLib.push(makeBrick(i + 1));

  function brickAt(wRow, col){
    return brickLib[(rng(wRow * 997 + col, 13) * NVARIANTS) | 0];
  }

  // ── Pre-render wall strip ─────────────────────────────────────────────
  let strip = null;
  let STRIP_H = 0;

  function buildWallStrip(){
    if(!W || !H) return;
    const STRIP_ROWS = Math.ceil(H / TH) + 4;
    STRIP_H = STRIP_ROWS * TH;

    strip = document.createElement('canvas');
    strip.width  = W;
    strip.height = STRIP_H;
    const sc = strip.getContext('2d');

    // Mortar base
    sc.fillStyle = '#0c0b0d';
    sc.fillRect(0, 0, W, STRIP_H);

    const cols = Math.ceil(W / TW) + 2;
    for(let row = 0; row < STRIP_ROWS; row++){
      const oddRow = (row & 1) === 1;
      const xOff   = oddRow ? Math.round(TW / 2) : 0;
      for(let col = -1; col < cols + 1; col++){
        const bx = col * TW - xOff + MORTAR;
        const by = row * TH + MORTAR;
        sc.drawImage(brickAt(row, col + (oddRow ? 1000 : 0)), bx, by);
      }
    }
  }

  // ── Fog wisps ─────────────────────────────────────────────────────────
  const wisps = [];
  for(let i = 0; i < 14; i++) wisps.push({
    x: Math.random(), y: Math.random(),
    r: 180 + Math.random()*300,
    vx:(Math.random()-0.5)*0.00012, vy:(Math.random()-0.5)*0.00012,
    a: 0.05+Math.random()*0.08, ph: Math.random()*Math.PI*2
  });

  // ── Dust motes — barely-visible slow floaters catching torchlight ─────
  const DUST_COUNT = 55;
  const dust = [];
  function makeDust(randomY){
    return {
      x:  Math.random(),
      y:  randomY ? Math.random() : 1.02,
      vy: 0.000008 + Math.random() * 0.000015,     // much slower than embers
      vx: (Math.random() - 0.5) * 0.000010,
      wobbleAmp:  0.0001 + Math.random() * 0.0002,
      wobbleFreq: 0.05   + Math.random() * 0.12,
      wobblePh:   Math.random() * Math.PI * 2,
      size: 0.8 + Math.random() * 1.6,
      life: 0.18 + Math.random() * 0.22,          // more visible
      ph:   Math.random() * Math.PI * 2,
      flickFreq: 0.4 + Math.random() * 0.8,
    };
  }
  for(let i = 0; i < DUST_COUNT; i++) dust.push(makeDust(true));

  function hexToRgba(hex, a){
    const n = parseInt((hex||'#080608').replace('#',''), 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  function resize(){
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildWallStrip();
  }
  window.addEventListener('resize', resize);
  resize();

  let scrollY  = 0;
  let lastTime = null;
  const PX_PER_MS = SPEED / (1000/60);
  // t in seconds — used for sway; keep separate from the wall-scroll t
  let tSec = 0;




  function draw(ts){
    if(!animOn){ requestAnimationFrame(draw); return; }
    if(lastTime === null) lastTime = ts;
    const dt = Math.min(ts - lastTime, 50);
    lastTime = ts;
    tSec += dt * 0.001; // tSec in real seconds

    if(!strip || !W || !H){ requestAnimationFrame(draw); return; }

    ctx.clearRect(0, 0, W, H);

    // Scroll
    scrollY = (scrollY + PX_PER_MS * dt) % STRIP_H;
    const sy = Math.round(scrollY);
    ctx.drawImage(strip, 0, sy - STRIP_H);
    ctx.drawImage(strip, 0, sy);

    // Vignette
    const vig = ctx.createRadialGradient(W*0.5,H*0.35,0, W*0.5,H*0.55, Math.max(W,H)*0.8);
    vig.addColorStop(0,   'rgba(0,0,0,0.40)');
    vig.addColorStop(0.38,'rgba(0,0,0,0.58)');
    vig.addColorStop(1,   'rgba(0,0,0,0.92)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Theme tint
    const cs = getComputedStyle(document.documentElement);
    const c1 = (cs.getPropertyValue('--bg-from')||'#200c20').trim();
    const c2 = (cs.getPropertyValue('--bg-mid') ||'#0a0608').trim();
    const tint = ctx.createRadialGradient(W*0.5,0,0, W*0.5,H*0.6,H);
    tint.addColorStop(0, hexToRgba(c1, 0.30));
    tint.addColorStop(1, hexToRgba(c2, 0.45));
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);

    // Fog wisps (skipped on Escape theme — stark, no mist)
    const isEscape = ['escape','torchlight'].includes(document.documentElement.getAttribute('data-theme'));
    if(!isEscape){
      const fogHex = (cs.getPropertyValue('--fog-color')||'rgba(20,5,30,0.12)').trim();
      wisps.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<-0.3)p.x=1.3; if(p.x>1.3)p.x=-0.3;
        if(p.y<-0.3)p.y=1.3; if(p.y>1.3)p.y=-0.3;
        const pulse = p.a*(0.5+0.5*Math.sin(tSec*1.2+p.ph));
        const fg = ctx.createRadialGradient(p.x*W,p.y*H,0, p.x*W,p.y*H, p.r*W/1000);
        const mk = a => fogHex.replace(/[\d.]+\)$/, `${a.toFixed(3)})`);
        fg.addColorStop(0,   mk(pulse));
        fg.addColorStop(0.5, mk(pulse*0.25));
        fg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, W, H);
      });
    }

    // ── Dust motes — faint slow floaters ─────────────────────────────────
    // Sample theme colours once per frame for all motes
    const dustAccent = (cs.getPropertyValue('--gold-hi')  || '#d8b050').trim();
    const dustTint   = (cs.getPropertyValue('--accent1')  || '#e04040').trim();

    dust.forEach(p => {
      p.y -= p.vy * dt;
      p.x += p.vx * dt + Math.sin(tSec * p.wobbleFreq * Math.PI * 2 + p.wobblePh) * p.wobbleAmp;
      if(p.y < -0.02) Object.assign(p, makeDust(false));

      // Fade in from bottom, fade out near top
      const prog  = 1 - p.y;
      const fade  = Math.min(prog * 6, 1) * Math.min((1 - prog) * 4, 1);
      const flick = 0.6 + 0.4 * Math.sin(tSec * p.flickFreq * Math.PI * 2 + p.ph);
      const alpha = p.life * fade * flick;
      if(alpha < 0.008) return;

      const px = p.x * W, py = p.y * H;
      const rg = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3.5);
      rg.addColorStop(0,   hexToRgba(dustAccent, alpha));          // theme gold core
      rg.addColorStop(0.4, hexToRgba(dustTint,   alpha * 0.35));   // accent colour mid
      rg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
