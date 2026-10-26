// ══════════════════════════════════════════════════
// 3D DICE ENGINE
// ══════════════════════════════════════════════════

// ── Per-theme die configuration ───────────────────────────────────────────
// Each entry: bodyHex, edgeHex, texture style, key light colour, fill light colour
const THEME_DICE = {
  default: {
    check:   { body:'#241828', edge:0x9a8a6a, tex:'stone',  keyCol:0xffd090, fillCol:0x4030c0, rimCol:0xff5010 },
    monster: { body:'#4a0808', edge:0xd4a840, tex:'stone',  keyCol:0xffd090, fillCol:0x4030c0, rimCol:0xff5010 },
  },
  castlevania: {
    check:   { body:'#160c28', edge:0x8060d8, tex:'crystal', keyCol:0xc0a0ff, fillCol:0x2040a0, rimCol:0x60c0ff },
    monster: { body:'#0c1830', edge:0x5090e0, tex:'crystal', keyCol:0xc0a0ff, fillCol:0x2040a0, rimCol:0x60c0ff },
  },
  vampire: {
    check:   { body:'#1e0808', edge:0xe89030, tex:'obsidian', keyCol:0xffc060, fillCol:0x800020, rimCol:0xff4060 },
    monster: { body:'#380008', edge:0xff3060, tex:'obsidian', keyCol:0xffc060, fillCol:0x800020, rimCol:0xff4060 },
  },
  dungeon: {
    check:   { body:'#081408', edge:0x70b860, tex:'moss',   keyCol:0x80d060, fillCol:0x103020, rimCol:0x40c870 },
    monster: { body:'#0a1c0c', edge:0x50d878, tex:'moss',   keyCol:0x80d060, fillCol:0x103020, rimCol:0x40c870 },
  },
  escape: {
    check:   { body:'#101010', edge:0xc0c0c0, tex:'ink',    keyCol:0xe8e8e8, fillCol:0x282828, rimCol:0xa0a0a0 },
    monster: { body:'#181818', edge:0xe8e8e8, tex:'ink',    keyCol:0xe8e8e8, fillCol:0x282828, rimCol:0xa0a0a0 },
  },
  torchlight: {
    check:   { body:'#e8e2d4', edge:0x141210, tex:'ink',    keyCol:0xffe0b0, fillCol:0x403020, rimCol:0xe0a040 },
    monster: { body:'#d8d0be', edge:0x141210, tex:'ink',    keyCol:0xffe0b0, fillCol:0x403020, rimCol:0xe0a040 },
  },
};

// ── Texture generator — different style per theme ─────────────────────────
function makeFaceTex(bodyHex, texStyle){
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');

  // Draw triangle face
  ctx.beginPath();
  ctx.moveTo(S*.5, S*.04);
  ctx.lineTo(S*.96, S*.92);
  ctx.lineTo(S*.04, S*.92);
  ctx.closePath();
  ctx.fillStyle = bodyHex;
  ctx.fill();
  ctx.save(); ctx.clip();

  if(texStyle === 'stone'){
    // Cracked stone: radial highlight + crack lines + grit noise
    const grd = ctx.createRadialGradient(S/2, S*.45, S*.02, S/2, S*.5, S*.48);
    grd.addColorStop(0,  'rgba(255,255,255,0.16)');
    grd.addColorStop(0.5,'rgba(255,255,255,0.04)');
    grd.addColorStop(1,  'rgba(0,0,0,0.35)');
    ctx.fillStyle = grd; ctx.fillRect(0,0,S,S);
    // Crack lines
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.2;
    [[.42,.18,.55,.62],[.55,.62,.68,.85],[.42,.18,.28,.52],[.28,.52,.22,.78]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1*S, y1*S); ctx.lineTo(x2*S, y2*S); ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.6;
    [[.43,.18,.56,.62],[.56,.62,.69,.85]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1*S, y1*S); ctx.lineTo(x2*S, y2*S); ctx.stroke();
    });
    // Grit: small random dots
    for(let i=0;i<60;i++){
      const px=(.1+Math.random()*.8)*S, py=(.12+Math.random()*.75)*S;
      const a = Math.random()>.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
      ctx.fillStyle=a; ctx.fillRect(px,py,1,1);
    }

  } else if(texStyle === 'crystal'){
    // Glassy faceted: sharp multi-tone gradient + specular glints
    const g1 = ctx.createLinearGradient(S*.1, S*.1, S*.9, S*.9);
    g1.addColorStop(0,  'rgba(180,150,255,0.22)');
    g1.addColorStop(0.4,'rgba(100,80,200,0.08)');
    g1.addColorStop(1,  'rgba(30,20,80,0.30)');
    ctx.fillStyle = g1; ctx.fillRect(0,0,S,S);
    // Facet line
    ctx.strokeStyle='rgba(200,180,255,0.30)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(S*.5,S*.04); ctx.lineTo(S*.5,S*.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(S*.5,S*.04); ctx.lineTo(S*.2,S*.85); ctx.stroke();
    // Specular glint top-left
    const glint = ctx.createRadialGradient(S*.38,S*.22,0, S*.38,S*.22, S*.12);
    glint.addColorStop(0,'rgba(255,255,255,0.55)');
    glint.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=glint; ctx.fillRect(0,0,S,S);

  } else if(texStyle === 'obsidian'){
    // Volcanic glass: deep sheen + sharp edge highlight + blood-red undertone
    const g1 = ctx.createRadialGradient(S*.4, S*.3, S*.02, S*.5, S*.5, S*.5);
    g1.addColorStop(0,  'rgba(200,60,40,0.18)');
    g1.addColorStop(0.4,'rgba(80,10,10,0.08)');
    g1.addColorStop(1,  'rgba(0,0,0,0.45)');
    ctx.fillStyle = g1; ctx.fillRect(0,0,S,S);
    // Mirror sheen line
    ctx.strokeStyle='rgba(255,180,100,0.22)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(S*.5,S*.04); ctx.lineTo(S*.15,S*.88); ctx.stroke();
    // Micro glint
    const glint = ctx.createRadialGradient(S*.46,S*.12,0, S*.46,S*.12,S*.07);
    glint.addColorStop(0,'rgba(255,200,150,0.6)');
    glint.addColorStop(1,'rgba(255,200,150,0)');
    ctx.fillStyle=glint; ctx.fillRect(0,0,S,S);
    // Dark vignette
    const vig = ctx.createRadialGradient(S*.5,S*.5,S*.1, S*.5,S*.5,S*.55);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.4)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,S,S);

  } else if(texStyle === 'moss'){
    // Rough mossy stone: green-tinted grain + lichen patches
    const g1 = ctx.createRadialGradient(S*.4,S*.35,S*.02, S*.5,S*.5,S*.5);
    g1.addColorStop(0,  'rgba(80,160,60,0.16)');
    g1.addColorStop(0.5,'rgba(30,80,20,0.06)');
    g1.addColorStop(1,  'rgba(0,10,0,0.35)');
    ctx.fillStyle=g1; ctx.fillRect(0,0,S,S);
    // Lichen blotches
    for(let i=0;i<5;i++){
      const lx=(0.2+Math.random()*0.6)*S, ly=(0.15+Math.random()*0.65)*S;
      const lr=S*(0.04+Math.random()*0.07);
      const lg=ctx.createRadialGradient(lx,ly,0,lx,ly,lr);
      lg.addColorStop(0,'rgba(60,130,30,0.28)'); lg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(lx,ly,lr,0,Math.PI*2); ctx.fill();
    }
    // Surface grain
    for(let i=0;i<50;i++){
      const px=(.1+Math.random()*.8)*S, py=(.1+Math.random()*.78)*S;
      ctx.fillStyle=Math.random()>.5?'rgba(100,180,60,0.08)':'rgba(0,0,0,0.14)';
      ctx.fillRect(px,py,1.5,1.5);
    }
    // Highlight
    const hl=ctx.createLinearGradient(S*.15,S*.1,S*.5,S*.55);
    hl.addColorStop(0,'rgba(150,220,100,0.14)'); hl.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=hl; ctx.fillRect(0,0,S,S);

  } else { // 'ink' — woodcut/stamp style
    // High contrast: stark white highlight, deep shadow, hatching lines
    const g1 = ctx.createLinearGradient(S*.1,S*.1, S*.9,S*.9);
    g1.addColorStop(0,'rgba(255,255,255,0.22)');
    g1.addColorStop(0.5,'rgba(128,128,128,0.04)');
    g1.addColorStop(1,'rgba(0,0,0,0.45)');
    ctx.fillStyle=g1; ctx.fillRect(0,0,S,S);
    // Cross-hatch lines
    ctx.strokeStyle='rgba(255,255,255,0.09)'; ctx.lineWidth=0.8;
    for(let i=0;i<8;i++){
      const t=i/8;
      ctx.beginPath(); ctx.moveTo(S*(0.1+t*0.8),S*0.1); ctx.lineTo(S*(0.05+t*0.8),S*0.9); ctx.stroke();
    }
    // Bold top-corner highlight
    const hl=ctx.createRadialGradient(S*.42,S*.14,0,S*.42,S*.14,S*.15);
    hl.addColorStop(0,'rgba(255,255,255,0.5)'); hl.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=hl; ctx.fillRect(0,0,S,S);
    // Strong edge vignette
    const vig=ctx.createRadialGradient(S*.5,S*.55,S*.1, S*.5,S*.55,S*.55);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.5)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,S,S);
  }

  ctx.restore();
  return new THREE.CanvasTexture(c);
}

// ── Build icosahedron faces with per-face texture ─────────────────────────
function buildIcoFaces(bodyHex, edgeHex, texStyle){
  const phi=(1+Math.sqrt(5))/2;
  const rawV=[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]].map(v=>{const l=Math.hypot(...v);return v.map(x=>x/l);});
  const FACES=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  return FACES.map(([ai,bi,ci])=>{
    const av=rawV[ai],bv=rawV[bi],cv=rawV[ci];
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute([...av,...bv,...cv],3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute([.5,.96,.96,.08,.04,.08],2));
    geo.computeVertexNormals();
    const norm=new THREE.Vector3(av[0]+bv[0]+cv[0],av[1]+bv[1]+cv[1],av[2]+bv[2]+cv[2]).normalize();
    const mat=new THREE.MeshStandardMaterial({map:makeFaceTex(bodyHex,texStyle),metalness:.45,roughness:.42,side:THREE.FrontSide});
    const mesh=new THREE.Mesh(geo,mat);
    const eg=new THREE.BufferGeometry();
    eg.setAttribute('position',new THREE.Float32BufferAttribute([...av,...bv,...bv,...cv,...cv,...av],3));
    mesh.add(new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:edgeHex,transparent:true,opacity:.55})));
    return {mesh,normal:norm};
  });
}

class Die3D{
  constructor(container,dieRole){
    this.container=container;
    this.dieRole=dieRole; // 'check' or 'monster'
    this.spinning=false;this.settling=false;
    this.velX=0;this.velY=0;this.velZ=0;
    this.rafId=null;this._targetQ=new THREE.Quaternion();this._settleCb=null;
    this._init();
  }
  _getScheme(){
    const theme=document.documentElement.getAttribute('data-theme')||'default';
    return (THEME_DICE[theme]||THEME_DICE['default'])[this.dieRole];
  }
  _init(){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    this.renderer.setSize(160,160);this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.container.appendChild(this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(42,1,.1,100);this.camera.position.set(0,0,4.2);
    // Lights stored so we can update them on theme change
    this.ambientLight=new THREE.AmbientLight(0xffffff,.32);
    this.keyLight=new THREE.DirectionalLight(0xffd090,1.55);
    this.keyLight.position.set(3,5,4);
    this.fillLight=new THREE.DirectionalLight(0x4030c0,.42);
    this.fillLight.position.set(-3,-2,2);
    this.rimLight=new THREE.DirectionalLight(0xff5010,.50);
    this.rimLight.position.set(0,-4,-3);
    this.scene.add(this.ambientLight,this.keyLight,this.fillLight,this.rimLight);
    this.dieGroup=new THREE.Group();this.scene.add(this.dieGroup);
    this._applyThemeLights();
    this._buildFaces();
    this.dieGroup.rotation.set(.5,.3,.1);
    this._loop();
  }
  _applyThemeLights(){
    const s=this._getScheme();
    this.keyLight.color.set(s.keyCol);
    this.fillLight.color.set(s.fillCol);
    this.rimLight.color.set(s.rimCol);
  }
  _buildFaces(){
    while(this.dieGroup.children.length)this.dieGroup.remove(this.dieGroup.children[0]);
    const s=this._getScheme();
    this.faceMeshes=buildIcoFaces(s.body,s.edge,s.tex);
    this.faceMeshes.forEach(f=>this.dieGroup.add(f.mesh));
  }
  rebuildForTheme(){
    // Dispose old face materials/textures to avoid GPU leak
    this.faceMeshes.forEach(f=>{
      f.mesh.children.forEach(c=>{if(c.material)c.material.dispose();});
      if(f.mesh.material){f.mesh.material.map&&f.mesh.material.map.dispose();f.mesh.material.dispose();}
    });
    this._applyThemeLights();
    this._buildFaces();
  }
  _loop(){
    this.rafId=requestAnimationFrame(()=>this._loop());
    if(!diceAnimOn) return; // skip render when dice anim disabled
    if(this.spinning){
      this.dieGroup.rotation.x+=this.velX;this.dieGroup.rotation.y+=this.velY;this.dieGroup.rotation.z+=this.velZ;
      this.velX*=.978;this.velY*=.978;this.velZ*=.978;
    }else if(this.settling){
      this.dieGroup.quaternion.slerp(this._targetQ,.07);
      if(this.dieGroup.quaternion.angleTo(this._targetQ)<.008){
        this.settling=false;this.dieGroup.quaternion.copy(this._targetQ);
        if(this._settleCb){this._settleCb();this._settleCb=null;}
      }
    }else{this.dieGroup.rotation.y+=.005;this.dieGroup.rotation.x+=.002;}
    this.renderer.render(this.scene,this.camera);
  }
  roll(faceIndex,onDone){
    if(!diceAnimOn){
      // Determine which flat die number element corresponds to this die
      const numElId = this.dieRole === 'check' ? 'checkFlatNum' : 'monsterFlatNum';
      const maxVal  = this.dieRole === 'check' ? 100 : 20;
      scrambleFlatDie(numElId, maxVal, 700, onDone);
      return;
    }
    this.spinning=true;this.settling=false;this._settleCb=onDone;
    this.velX=(Math.random()-.5)*.72;this.velY=(Math.random()-.5)*.72;this.velZ=(Math.random()-.5)*.32;
    setTimeout(()=>{this.spinning=false;this._settle(faceIndex);this.settling=true;},780);
  }
  _settle(fi){
    const n=this.faceMeshes[fi%20].normal;
    const q=new THREE.Quaternion().setFromUnitVectors(n,new THREE.Vector3(0,0,1));
    const tilt=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.14,.10,0));
    this._targetQ=tilt.premultiply(q);
  }
  destroy(){cancelAnimationFrame(this.rafId);this.renderer.dispose();}
}

let checkDie,monsterDie;
let diceAnimOn = true;

function initDice(){
  checkDie  =new Die3D(document.getElementById('checkDieWrap'),  'check');
  monsterDie=new Die3D(document.getElementById('monsterDieWrap'),'monster');
}
function rebuildDiceForTheme(){
  if(checkDie)  checkDie.rebuildForTheme();
  if(monsterDie)monsterDie.rebuildForTheme();
}

function syncDiceAnimBtn(){
  const btn = document.getElementById('diceAnimToggle');
  if(!btn) return;
  document.getElementById('diceAnimLabel').textContent = diceAnimOn ? 'On' : 'Off';
  btn.classList.toggle('active', !diceAnimOn);
}

function _applyDiceAnimState() {
  const canvases = [
    document.querySelector('#checkDieWrap canvas'),
    document.querySelector('#monsterDieWrap canvas'),
  ];
  const flats = [
    document.getElementById('checkFlatDie'),
    document.getElementById('monsterFlatDie'),
  ];
  canvases.forEach(c => { if(c) c.style.display = diceAnimOn ? '' : 'none'; });
  flats.forEach(f => { if(f) f.style.display = diceAnimOn ? 'none' : ''; });
}

function toggleDiceAnim(){
  diceAnimOn = !diceAnimOn;
  _applyDiceAnimState();
  syncDiceAnimBtn();
  saveNow();
}

// Scramble a flat die number display for `duration`ms then call onDone
function scrambleFlatDie(numElId, maxVal, duration, onDone) {
  const el = document.getElementById(numElId);
  if(!el) { if(onDone) onDone(); return; }
  el.className = 'flat-die-num rolling';
  const interval = 55;
  const iid = setInterval(() => {
    el.textContent = Math.ceil(Math.random() * maxVal);
  }, interval);
  setTimeout(() => {
    clearInterval(iid);
    if(onDone) onDone();
  }, duration);
}
