// AUDIO ENGINE
// ══════════════════════════════════════════════════
let AC=null;

function ac(){
  if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();
  if(AC.state==='suspended')AC.resume();
  return AC;
}
function makeNoise(ctx,secs,brown=false){
  const n=ctx.sampleRate*secs,buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);
  if(brown){let b=0;for(let i=0;i<n;i++){b=(b+(Math.random()*2-1)*.02)/1.02;d[i]=b*4;}}
  else{for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}
  return buf;
}

// ── SFX helpers ───────────────────────────────────
function sfxGain(){
  const ctx=ac(), g=ctx.createGain();
  g.gain.value=S.volume;
  g.connect(ctx.destination);
  return g;
}
function playDiceRattle(){
  const ctx=ac(), dest=sfxGain(), now=ctx.currentTime;
  // 5 rolling impacts, spacing tightens like a slowing tumble
  const gaps=[0, 0.18, 0.33, 0.45, 0.54];
  gaps.forEach((g,i)=>{
    const t=now+g+Math.random()*0.02;
    const vol=0.28+i*0.04;          // gets slightly louder as die slows
    diceImpact(ctx,dest,t,vol);
  });
  // Final hard stop
  diceLand(ctx,dest,now+0.68);
}

function diceImpact(ctx,dest,t,vol){
  const sr=ctx.sampleRate;

  // ── Noise transient (the "clack") ──────────────────
  const nLen=Math.floor(sr*0.032);
  const nBuf=ctx.createBuffer(1,nLen,sr);
  const nd=nBuf.getChannelData(0);
  for(let i=0;i<nLen;i++) nd[i]=(Math.random()*2-1)*Math.exp(-i/nLen*14);
  const nSrc=ctx.createBufferSource(); nSrc.buffer=nBuf;

  // Shape the noise: boost low-mids, cut highs hard
  const lp=ctx.createBiquadFilter(); lp.type='lowpass';  lp.frequency.value=1200; lp.Q.value=0.7;
  const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=300+Math.random()*120; bp.Q.value=1.2;
  const nGain=ctx.createGain();
  nGain.gain.setValueAtTime(vol*0.9,t);
  nGain.gain.exponentialRampToValueAtTime(0.0001,t+0.035);

  nSrc.connect(lp); lp.connect(bp); bp.connect(nGain); nGain.connect(dest);
  nSrc.start(t); nSrc.stop(t+0.045);

  // ── Tonal body (the die's mass resonating) ──────────
  const body=ctx.createOscillator();
  body.type='triangle';
  body.frequency.setValueAtTime(180+Math.random()*60, t);
  body.frequency.exponentialRampToValueAtTime(80, t+0.06);
  const bGain=ctx.createGain();
  bGain.gain.setValueAtTime(vol*0.55,t);
  bGain.gain.exponentialRampToValueAtTime(0.0001,t+0.07);
  body.connect(bGain); bGain.connect(dest);
  body.start(t); body.stop(t+0.08);

  // ── Sub thump (table resonance) ─────────────────────
  const sub=ctx.createOscillator();
  sub.type='sine';
  sub.frequency.setValueAtTime(70,t);
  sub.frequency.exponentialRampToValueAtTime(30,t+0.09);
  const sGain=ctx.createGain();
  sGain.gain.setValueAtTime(vol*0.35,t);
  sGain.gain.exponentialRampToValueAtTime(0.0001,t+0.10);
  sub.connect(sGain); sGain.connect(dest);
  sub.start(t); sub.stop(t+0.11);
}

function diceLand(ctx,dest,t){
  // Final impact — harder, more bass
  diceImpact(ctx,dest,t,0.55);

  // Extra low thud on the landing
  const thud=ctx.createOscillator();
  thud.type='sine';
  thud.frequency.setValueAtTime(55,t);
  thud.frequency.exponentialRampToValueAtTime(22,t+0.25);
  const tg=ctx.createGain();
  tg.gain.setValueAtTime(0.30,t);
  tg.gain.exponentialRampToValueAtTime(0.0001,t+0.28);
  thud.connect(tg); tg.connect(dest);
  thud.start(t); thud.stop(t+0.30);

  // Brief wood rattle after landing
  const rLen=Math.floor(ctx.sampleRate*0.06);
  const rBuf=ctx.createBuffer(1,rLen,ctx.sampleRate);
  const rd=rBuf.getChannelData(0);
  for(let i=0;i<rLen;i++) rd[i]=(Math.random()*2-1)*Math.exp(-i/rLen*20)*0.3;
  const rSrc=ctx.createBufferSource(); rSrc.buffer=rBuf;
  const rlp=ctx.createBiquadFilter(); rlp.type='lowpass'; rlp.frequency.value=600;
  const rg=ctx.createGain(); rg.gain.setValueAtTime(0.18,t+0.04); rg.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
  rSrc.connect(rlp); rlp.connect(rg); rg.connect(dest);
  rSrc.start(t+0.04); rSrc.stop(t+0.14);
}

// Torch snuffed: short hiss of low-passed noise falling away
function playTorchOut(){
  if(!S.sound) return;
  const ctx=ac(), t=ctx.currentTime, src=ctx.createBufferSource(), f=ctx.createBiquadFilter(), g=ctx.createGain();
  src.buffer=makeNoise(ctx,1.2);
  f.type='lowpass'; f.frequency.setValueAtTime(3000,t); f.frequency.exponentialRampToValueAtTime(200,t+1.1);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.5,t+0.05); g.gain.exponentialRampToValueAtTime(0.0001,t+1.15);
  src.connect(f).connect(g).connect(sfxGain()); src.start(t); src.stop(t+1.2);
}

function playEncounterSting(){
  const ctx=ac(), dest=sfxGain(), now=ctx.currentTime;
  const ib=makeNoise(ctx,1.5), imp=ctx.createBufferSource(); imp.buffer=ib;
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=180;
  const ie=ctx.createGain(); ie.gain.setValueAtTime(0,now); ie.gain.linearRampToValueAtTime(.55*S.volume,now+.025); ie.gain.exponentialRampToValueAtTime(.001,now+1.4);
  imp.connect(lp); lp.connect(ie); ie.connect(ctx.destination); imp.start(now); imp.stop(now+1.6);
  [82.4,87.3,116.5].forEach((f,i)=>{
    const o=ctx.createOscillator(), g=ctx.createGain(), cf=ctx.createBiquadFilter();
    o.type='sawtooth'; o.frequency.value=f; o.detune.value=(i-1)*8; cf.type='lowpass'; cf.frequency.value=900;
    g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(.14*S.volume,now+.06); g.gain.setValueAtTime(.14*S.volume,now+.8); g.gain.exponentialRampToValueAtTime(.001,now+2.8);
    o.connect(cf); cf.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now+3);
  });
  const sc=ctx.createOscillator(), sg=ctx.createGain(), sb=ctx.createBiquadFilter();
  sc.type='sawtooth'; sc.frequency.setValueAtTime(1200,now+.1); sc.frequency.exponentialRampToValueAtTime(600,now+.9);
  sb.type='bandpass'; sb.frequency.value=800; sb.Q.value=5;
  sg.gain.setValueAtTime(0,now+.1); sg.gain.linearRampToValueAtTime(.07*S.volume,now+.18); sg.gain.exponentialRampToValueAtTime(.001,now+1);
  sc.connect(sb); sb.connect(sg); sg.connect(ctx.destination); sc.start(now+.1); sc.stop(now+1.1);
}
function playTurnTock(){
  const ctx=ac(), dest=sfxGain(), now=ctx.currentTime;
  dungeonTick(ctx,dest,now,.1); dungeonTick(ctx,dest,now+.11,.06);
}
function dungeonTick(ctx,dest,t,vol){
  const len=Math.floor(ctx.sampleRate*.025), buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/len*12);
  const src=ctx.createBufferSource(); src.buffer=buf;
  const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=320; bp.Q.value=6;
  const g=ctx.createGain(); g.gain.setValueAtTime(vol*S.volume,t); g.gain.exponentialRampToValueAtTime(.0001,t+.04);
  src.connect(bp); bp.connect(g); g.connect(dest); src.start(t); src.stop(t+.05);
  const tn=ctx.createOscillator(), tg=ctx.createGain(); tn.type='sine'; tn.frequency.value=160;
  tg.gain.setValueAtTime(vol*.6*S.volume,t); tg.gain.exponentialRampToValueAtTime(.0001,t+.08);
  tn.connect(tg); tg.connect(dest); tn.start(t); tn.stop(t+.1);
}




// ══════════════════════════════════════════════════
// LEVEL-UP FANFARE — full orchestral-style brass sequence
// ══════════════════════════════════════════════════
// ── Advance-turn button click: heavy stone lever thud ─────────────────────
function playAdvanceClick(){
  const ctx=ac(), dest=sfxGain(), now=ctx.currentTime;

  // Deep thud body — low-passed brown noise, very low cutoff
  const nb=makeNoise(ctx,.12,true);
  const src=ctx.createBufferSource(); src.buffer=nb;
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=100;
  const eg=ctx.createGain();
  eg.gain.setValueAtTime(0,now);
  eg.gain.linearRampToValueAtTime(.65,now+.008);
  eg.gain.exponentialRampToValueAtTime(.001,now+.18);
  src.connect(lp); lp.connect(eg); eg.connect(dest);
  src.start(now); src.stop(now+.20);

  // Sub-bass sine bump to add weight
  const sub=ctx.createOscillator(); sub.type='sine';
  sub.frequency.setValueAtTime(55,now);
  sub.frequency.exponentialRampToValueAtTime(28,now+.14);
  const sg=ctx.createGain();
  sg.gain.setValueAtTime(0,now);
  sg.gain.linearRampToValueAtTime(.30,now+.01);
  sg.gain.exponentialRampToValueAtTime(.001,now+.18);
  sub.connect(sg); sg.connect(dest);
  sub.start(now); sub.stop(now+.20);

  // Dull mid-range scrape — bandpass around 180 Hz (stone-on-stone)
  const tb=makeNoise(ctx,.14);
  const ts=ctx.createBufferSource(); ts.buffer=tb;
  const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=180; bp.Q.value=.5;
  const tg=ctx.createGain();
  tg.gain.setValueAtTime(.10,now+.015);
  tg.gain.exponentialRampToValueAtTime(.001,now+.16);
  ts.connect(bp); bp.connect(tg); tg.connect(dest);
  ts.start(now+.015); ts.stop(now+.18);
}

// ── Monster defeated: heavy impact + low resolve chord ───────────────────
function playMonsterDefeated(){
  const ctx=ac(), dest=sfxGain(), now=ctx.currentTime;

  // Heavy blade impact — punchy low thud
  const ib=makeNoise(ctx,.09,true);
  const is2=ctx.createBufferSource(); is2.buffer=ib;
  const ilp=ctx.createBiquadFilter(); ilp.type='lowpass'; ilp.frequency.value=200;
  const ig=ctx.createGain();
  ig.gain.setValueAtTime(.65,now); ig.gain.exponentialRampToValueAtTime(.001,now+.12);
  is2.connect(ilp); ilp.connect(ig); ig.connect(dest);
  is2.start(now); is2.stop(now+.13);

  // Low metallic ring — drop the frequencies way down (sawtooth feels more brutal)
  const ring=ctx.createOscillator(); ring.type='sawtooth';
  ring.frequency.setValueAtTime(220,now);
  ring.frequency.exponentialRampToValueAtTime(110,now+.7);
  const lp2=ctx.createBiquadFilter(); lp2.type='lowpass'; lp2.frequency.value=600;
  const rg=ctx.createGain();
  rg.gain.setValueAtTime(0,now);
  rg.gain.linearRampToValueAtTime(.18,now+.01);
  rg.gain.exponentialRampToValueAtTime(.001,now+.75);
  ring.connect(lp2); lp2.connect(rg); rg.connect(dest);
  ring.start(now); ring.stop(now+.8);

  // Sub boom
  const sub=ctx.createOscillator(); sub.type='sine';
  sub.frequency.setValueAtTime(80,now);
  sub.frequency.exponentialRampToValueAtTime(35,now+.2);
  const subg=ctx.createGain();
  subg.gain.setValueAtTime(0,now);
  subg.gain.linearRampToValueAtTime(.35,now+.01);
  subg.gain.exponentialRampToValueAtTime(.001,now+.22);
  sub.connect(subg); subg.connect(dest);
  sub.start(now); sub.stop(now+.25);

  // Resolve: deep two-note drop (drop an octave lower — C3 → G2)
  const notes=[130,98]; // C3 → G2
  notes.forEach((freq,i)=>{
    const t=now+.15+i*.22;
    const osc=ctx.createOscillator(); osc.type='triangle';
    osc.frequency.value=freq;
    const lp3=ctx.createBiquadFilter(); lp3.type='lowpass'; lp3.frequency.value=800;
    const ng=ctx.createGain();
    ng.gain.setValueAtTime(0,t);
    ng.gain.linearRampToValueAtTime(.20,t+.025);
    ng.gain.exponentialRampToValueAtTime(.001,t+.45);
    osc.connect(lp3); lp3.connect(ng); ng.connect(dest);
    osc.start(t); osc.stop(t+.5);
  });
}

function playLevelUpFanfare(){
  if(!S.sound) return;
  const ctx=ac(), now=ctx.currentTime;

  // Shared reverb
  const rev=ctx.createConvolver();
  const rLen=ctx.sampleRate*2, rBuf=ctx.createBuffer(2,rLen,ctx.sampleRate);
  for(let c=0;c<2;c++){const d=rBuf.getChannelData(c);for(let i=0;i<rLen;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/rLen,2.5);}
  rev.buffer=rBuf;
  const revGain=ctx.createGain(); revGain.gain.value=0.28*S.volume;
  rev.connect(revGain); revGain.connect(ctx.destination);

  const dry=ctx.createGain(); dry.gain.value=S.volume;
  dry.connect(ctx.destination);

  function note(freq,type,t,dur,vol,dest,detune=0){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.value=freq; o.detune.value=detune;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol,t+0.015);
    g.gain.setValueAtTime(vol,t+dur*0.7);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t+dur+0.05);
  }

  // ── Trumpet-like sawtooth lead ──────────────────
  // Bar 1: short fanfare call  C4-E4-G4-C5  (pitched down a 4th)
  const BRASS=[{f:196.0,t:0},{f:247.0,t:0.12},{f:294.0,t:0.22},{f:392.0,t:0.34}];
  BRASS.forEach(({f,t})=>{
    note(f,'sawtooth',now+t,0.14,0.13,dry);
    note(f,'sawtooth',now+t,0.14,0.06,rev,7);
  });

  // Bar 2: triumphant G4-C5-E5-G5 run
  const RUN=[{f:294.0,t:0.58},{f:392.0,t:0.68},{f:494.0,t:0.78},{f:587.3,t:0.88}];
  RUN.forEach(({f,t})=>{
    note(f,'sawtooth',now+t,0.11,0.12,dry);
    note(f,'sawtooth',now+t,0.11,0.05,rev,5);
  });

  // Bar 3: held final chord  (full major triad, down a 4th)
  [[392.0,-8],[494.0,0],[587.3,6]].forEach(([f,det])=>{
    note(f,'sawtooth',now+1.08,0.75,0.11,dry,det);
    note(f,'sawtooth',now+1.08,0.75,0.05,rev,det+4);
  });

  // ── French horn sub-octave harmony ─────────────
  [[98.0,0],[123.5,0],[147.0,0],[196.0,0]].forEach(({0:f,1:_},i)=>{
    note(f,'triangle',now+[0,0.12,0.22,0.34][i],0.18,0.07,dry);
  });
  note(196.0,'triangle',now+1.08,0.75,0.09,dry,-5);
  note(147.0,'triangle',now+1.08,0.75,0.07,dry, 3);

  // ── Snare roll leading into chord ──────────────
  for(let i=0;i<18;i++){
    const t=now+0.85+i*0.012;
    const sLen=Math.floor(ctx.sampleRate*0.012);
    const sBuf=ctx.createBuffer(1,sLen,ctx.sampleRate);
    const sd=sBuf.getChannelData(0);
    for(let j=0;j<sLen;j++) sd[j]=(Math.random()*2-1)*Math.exp(-j/sLen*16);
    const sSrc=ctx.createBufferSource(); sSrc.buffer=sBuf;
    const shp=ctx.createBiquadFilter(); shp.type='bandpass'; shp.frequency.value=2200; shp.Q.value=2;
    const sg=ctx.createGain(); sg.gain.value=0.055*S.volume*(0.4+i/18*0.6);
    sSrc.connect(shp); shp.connect(sg); sg.connect(dry);
    sSrc.start(t); sSrc.stop(t+0.015);
  }

  // ── Cymbal crash on the chord ───────────────────
  {
    const t=now+1.06;
    const cLen=ctx.sampleRate*1.5, cBuf=ctx.createBuffer(1,cLen,ctx.sampleRate);
    const cd=cBuf.getChannelData(0);
    for(let i=0;i<cLen;i++) cd[i]=(Math.random()*2-1)*Math.exp(-i/cLen*2.5);
    const cSrc=ctx.createBufferSource(); cSrc.buffer=cBuf;
    const chp=ctx.createBiquadFilter(); chp.type='highpass'; chp.frequency.value=6000;
    const cg=ctx.createGain(); cg.gain.setValueAtTime(0.18*S.volume,t);
    cg.gain.exponentialRampToValueAtTime(0.0001,t+1.4);
    cSrc.connect(chp); chp.connect(cg); cg.connect(dry);
    cSrc.start(t); cSrc.stop(t+1.5);
    // Reverb on cymbal
    const cg2=ctx.createGain(); cg2.gain.value=0.12*S.volume;
    chp.connect(cg2); cg2.connect(rev);
  }

  // ── Kick drum on the chord ─────────────────────
  {
    const t=now+1.07;
    const ko=ctx.createOscillator(), kg=ctx.createGain();
    ko.type='sine'; ko.frequency.setValueAtTime(135,t); ko.frequency.exponentialRampToValueAtTime(30,t+0.12);
    kg.gain.setValueAtTime(0.4*S.volume,t); kg.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
    ko.connect(kg); kg.connect(dry); ko.start(t); ko.stop(t+0.2);
  }
}
// Keep old name as alias so nothing breaks
function playLevelUpSting(){ playLevelUpFanfare(); }
