
const CUSTOM_TABLE_KEY = 'dt_custom_tables'; // localStorage key
const TIER_NAMES  = ['Shallow Dungeon', 'Deep Dungeon', 'The Abyss'];
const TIER_CLASSES = ['', 'tier-deep', 'tier-abyss'];

// Load custom tables from localStorage — array of 3, null = use built-in
let customTables = [null, null, null];
(function loadCustomTables() {
  try {
    const raw = localStorage.getItem(CUSTOM_TABLE_KEY);
    if(raw) {
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed) && parsed.length === 3) customTables = parsed;
    }
  } catch(e) {}
})();

function saveCustomTables() {
  try { localStorage.setItem(CUSTOM_TABLE_KEY, JSON.stringify(customTables)); }
  catch(e) { console.warn('localStorage save failed:', e); }
}

function activeTableForIndex(idx) {
  return customTables[idx] || MONSTER_TABLES[idx];
}

// Active table index (0 = Shallow, 1 = Deep, 2 = Abyss)
let MONSTER_TABLE_INDEX = 0;
let MONSTERS = activeTableForIndex(MONSTER_TABLE_INDEX);


// ══════════════════════════════════════════════════

// ══════════════════════════════════════════════════
// DOM CACHE — single query per element, zero repeated lookups
// ══════════════════════════════════════════════════
const $ = id => document.getElementById(id);

// Cached element references — called lazily so they resolve after DOM ready
const EL = {
  // Turn controls
  advBtn:            () => $('advBtn'),
  undoBtn:           () => $('undoBtn'),
  turnCounter:       () => $('turnCounter'),
  timeLabel:         () => $('timeLabel'),
  combatLockedLabel: () => $('combatLockedLabel'),
  defeatWrap:        () => $('defeatWrap'),

  // Roll display
  d100label:     () => $('d100label'),
  d20block:      () => $('d20block'),
  d20label:      () => $('d20label'),

  // Encounter card
  encCard:      () => $('encCard'),
  encBadgeRoll: () => $('encBadgeRoll'),
  encName:      () => $('encName'),
  encCR:        () => $('encCR'),
  encDesc:      () => $('encDesc'),
  encCountRow:  () => $('encCountRow'),
  encCountNum:  () => $('encCountNum'),
  encCountLabel:() => $('encCountLabel'),
  encCountRoll: () => $('encCountRoll'),
  statBlock:    () => $('statBlock'),

  // Log & table
  logEntries: () => $('logEntries'),
  tBody:      () => $('tBody'),
  tableWrap:  () => $('tableWrap'),
  caret:      () => $('caret'),

  // Effects
  encFlash:    () => $('enc-flash'),
  particles:   () => $('particles'),
  lvlupOverlay:() => $('lvlup-overlay'),
  lvlupName:   () => $('lvlup-name'),
  lvlupNum:    () => $('lvlup-num'),
  lvlupSub:    () => $('lvlup-sub'),
  lvlupContent:() => $('lvlup-content'),

  // Settings
  settingsOverlay: () => $('settingsOverlay'),
  threshSlider:    () => $('threshSlider'),
  threshVal:       () => $('threshVal'),
  tdBig:           () => $('tdBig'),
  tdPct:           () => $('tdPct'),
  tdExpected:      () => $('tdExpected'),
  sliderHint:      () => $('sliderHint'),
  freqThresh:      () => $('freqThresh'),
  freqDie:         () => $('freqDie'),
  freqPct:         () => $('freqPct'),
  checkDieLabel:   () => $('checkDieLabel'),
  volSfx:          () => $('volSfx'),
  volSfxVal:       () => $('volSfxVal'),

  // Sound toggle
  soundToggle:  () => $('soundToggle'),
  soundLabel:   () => $('soundLabel'),
  iconSoundOn:  () => $('iconSoundOn'),
  iconSoundOff: () => $('iconSoundOff'),

  // XP tracker
  xpPartyCount: () => $('xpPartyCount'),
  xpPlayerGrid: () => $('xpPlayerGrid'),
  xpTotal:      () => $('xpTotal'),
  xpPerPlayer:  () => $('xpPerPlayer'),
  xpNextNote:   () => $('xpNextNote'),
  xpEncLog:     () => $('xpEncLog'),
  xpDefeated:   () => $('xpDefeatedCount'),
  xpCard:       () => $('xpCard'),
};

// ══════════════════════════════════════════════════
// PERSISTENCE — cookie save/restore
// ══════════════════════════════════════════════════
const COOKIE_KEY  = 'dungeonTracker_v1';

function cookieSave() {
  const state = {
    turn, soundOn, animOn, diceAnimOn,
    MONSTER_TABLE_INDEX,
    history:      history.slice(0, 100),
    xpPartySize,
    xpPlayers:    xpPlayers.map(({ name, level, xp }) => ({ name, level, xp })),
    xpSessionLog: xpSessionLog.slice(0, 100),
    theme:        currentTheme,
    THRESHOLD, DIE_TYPE,
    torchLeft, torchEndsAt,
    savedAt:      Date.now(),
  };
  // localStorage, not a cookie: history with stat blocks blows past the 4KB cookie
  // limit (browser silently drops it), and cookies get sent with every request.
  try { localStorage.setItem(COOKIE_KEY, JSON.stringify(state)); }
  catch(e) { console.warn('Save failed:', e); }
}

function cookieLoad() {
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    if(raw) return JSON.parse(raw);
  } catch(e) { return null; }
  // One-time migration from the old cookie save
  const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE_KEY + '='));
  if(!match) return null;
  try { return JSON.parse(decodeURIComponent(match.slice(COOKIE_KEY.length + 1))); }
  catch(e) { return null; }
  finally { cookieClear(); }
}

function cookieClear() {
  try { localStorage.removeItem(COOKIE_KEY); } catch(e) {}
  document.cookie = `${COOKIE_KEY}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

function restoreState(state) {
  if(!state) return;

  turn = state.turn || 0;
  if(typeof state.soundOn    === 'boolean') soundOn    = state.soundOn;
  if(typeof state.animOn     === 'boolean') animOn     = state.animOn;
  if(typeof state.diceAnimOn === 'boolean') diceAnimOn = state.diceAnimOn;
  if(typeof state.MONSTER_TABLE_INDEX === 'number' && state.MONSTER_TABLE_INDEX >= 0 && state.MONSTER_TABLE_INDEX <= 2) {
    MONSTER_TABLE_INDEX = state.MONSTER_TABLE_INDEX;
    MONSTERS = activeTableForIndex(MONSTER_TABLE_INDEX);
    populateMonsterTable();
    syncMonsterTableButtons(MONSTER_TABLE_INDEX);
    syncUploadPanel(MONSTER_TABLE_INDEX);
    syncAllTierBadges();
  }
  EL.turnCounter().textContent = turn;

  history = state.history || [];
  renderLog();

  if(state.xpPartySize) xpPartySize = state.xpPartySize;
  EL.xpPartyCount().textContent = xpPartySize;

  if(Array.isArray(state.xpPlayers)) {
    state.xpPlayers.forEach((saved, i) => {
      if(!xpPlayers[i]) xpPlayers[i] = { name: `Player ${i + 1}`, level: 1, xp: 0 };
      xpPlayers[i].name  = String(saved.name || xpPlayers[i].name).slice(0, 12);
      xpPlayers[i].level = Math.min(20, Math.max(1, parseInt(saved.level) || 1));
      xpPlayers[i].xp    = Math.max(0, parseInt(saved.xp) || 0);
    });
    while(xpPlayers.length < xpPartySize)
      xpPlayers.push({ name: `Player ${xpPlayers.length + 1}`, level: 1, xp: 0 });
  }

  if(Array.isArray(state.xpSessionLog)) xpSessionLog = state.xpSessionLog;

  if(Object.hasOwn(DIE_SIDES, state.DIE_TYPE)) DIE_TYPE = state.DIE_TYPE;
  if(Number.isInteger(state.THRESHOLD)) THRESHOLD = Math.min(DIE_SIDES[DIE_TYPE], Math.max(1, state.THRESHOLD));
  pendingThresh = THRESHOLD; pendingDie = DIE_TYPE;
  updateFreqBadge();
  const cdl = EL.checkDieLabel();
  if(cdl) cdl.textContent = `${DIE_TYPE} Roll — Wandering Monsters`;

  const themeBtn = document.querySelector(`.theme-btn[data-theme-id="${CSS.escape(String(state.theme || ''))}"]`);
  if(themeBtn) applyTheme(themeBtn.dataset.themeId, themeBtn);

  // Torch keeps burning in real time while the page is closed
  if(Number.isFinite(state.torchLeft))   torchLeft   = Math.min(TORCH_MS, Math.max(0, state.torchLeft));
  if(Number.isFinite(state.torchEndsAt)) torchEndsAt = state.torchEndsAt;
  torchRender();

  xpRenderAll();
  showSaveIndicator('Session restored');
}

// ── Save indicator ─────────────────────────────────
function showSaveIndicator(msg = '✦ Saved') {
  let ind = $('saveIndicator');
  if(!ind) {
    ind = document.createElement('div');
    ind.id = 'saveIndicator';
    Object.assign(ind.style, {
      position: 'fixed', bottom: '1.2rem', right: '1.2rem', zIndex: '300',
      fontFamily: "'EB Garamond',Georgia,serif", fontSize: '0.65rem',
      letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold-hi)',
      background: 'rgba(7,5,10,0.88)', border: '1px solid var(--bone-faint)',
      padding: '0.35rem 0.8rem', borderRadius: '1px', pointerEvents: 'none',
      opacity: '0', transition: 'opacity 0.3s',
    });
    document.body.appendChild(ind);
  }
  ind.textContent = msg;
  ind.style.opacity = '1';
  clearTimeout(ind._t);
  ind._t = setTimeout(() => { ind.style.opacity = '0'; }, 2000);
}

let _autoSaveInterval = null;
function startAutoSave() {
  if(_autoSaveInterval) clearInterval(_autoSaveInterval);
  _autoSaveInterval = setInterval(() => {
    cookieSave();
    showSaveIndicator('✦ Auto-saved');
  }, 30000);
}

function saveNow() { cookieSave(); showSaveIndicator('✦ Saved'); }

// ── Torch timer — Shadowdark rule: a torch burns for 1 hour of real time ──
const TORCH_MS = 60 * 60 * 1000;
let torchLeft = TORCH_MS, torchEndsAt = null; // torchEndsAt set only while burning

function torchRemaining() { return torchEndsAt ? Math.max(0, torchEndsAt - Date.now()) : torchLeft; }

function torchRender() {
  const ms = torchRemaining();
  const s  = Math.ceil(ms / 1000);
  $('torchTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('torchBar').style.width  = `${ms / TORCH_MS * 100}%`;
  $('torchBtn').textContent  = torchEndsAt ? 'Pause' : ms === 0 ? 'Relight' : ms === TORCH_MS ? 'Light' : 'Resume';
  $('torchTimer').classList.toggle('low', ms > 0 && ms <= 10 * 60 * 1000);
  $('torchTimer').classList.toggle('out', ms === 0);
}

function torchToggle() {
  if(torchEndsAt) { torchLeft = torchRemaining(); torchEndsAt = null; }
  else {
    if(torchRemaining() === 0) torchLeft = TORCH_MS;
    torchEndsAt = Date.now() + torchLeft;
  }
  torchRender(); saveNow();
}

function torchReset() { torchLeft = TORCH_MS; torchEndsAt = null; torchRender(); saveNow(); }

setInterval(() => {
  if(torchEndsAt && torchRemaining() === 0) {
    torchLeft = 0; torchEndsAt = null;
    playTorchOut();
    showSaveIndicator('The torch gutters out — darkness');
    cookieSave();
  }
  torchRender();
}, 1000);

window.addEventListener('load', () => {
  initDice();
  const saved = cookieLoad();
  if(saved) restoreState(saved);
  torchRender();
  startAutoSave();
});

// ══════════════════════════════════════════════════
// GAME STATE
// ══════════════════════════════════════════════════
let THRESHOLD = 35, DIE_TYPE = 'd100';
let pendingThresh = 35, pendingDie = 'd100';
let turn = 0, history = [], sessionStart = null, tableOpen = false;
let combatActive = false, pendingMonster = null, pendingTurn = 0;

// Populate monster table
function populateMonsterTable() {
  EL.tBody().innerHTML = MONSTERS.map(m =>
    `<tr id="mr${m.roll}">
      <td class="td-roll">${esc(m.roll)}</td>
      <td class="td-name">${esc(m.name)}</td>
      <td class="td-cr">${esc(m.cr)}</td>
      <td class="td-desc">${esc(m.desc)}</td>
    </tr>`
  ).join('');
  const labels = ['Shallow Dungeon', 'Deep Dungeon', 'The Abyss'];
  const isCustom = !!customTables[MONSTER_TABLE_INDEX];
  const tLabel = document.querySelector('.table-toggle .card-label');
  if(tLabel) tLabel.textContent = `Wandering Monster Table — ${labels[MONSTER_TABLE_INDEX]}${isCustom ? ' ✦ Custom' : ''} (d20)`;
}
populateMonsterTable();
// Init upload panel + tier badges on page load (after DOM is ready)
setTimeout(() => { syncAllTierBadges(); syncUploadPanel(MONSTER_TABLE_INDEX); }, 0);

// ── Table helpers ──────────────────────────────────
function hlRow(roll) {
  document.querySelectorAll('#tBody tr').forEach(r => r.classList.remove('hl'));
  const row = $(`mr${roll}`);
  if(row) { row.classList.add('hl'); row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

function toggleTable() {
  tableOpen = !tableOpen;
  EL.tableWrap().classList.toggle('open', tableOpen);
  EL.caret().classList.toggle('open', tableOpen);
}

// ── Stat block renderer ────────────────────────────
function renderStatBlock(monster) {
  const s    = monster.stats;
  const lore    = monster.lore    ? `<div class="stat-lore">${esc(monster.lore)}</div>` : '';
  const tactics = monster.tactics ? `<div class="stat-tactics"><strong>Tactics:</strong> ${esc(monster.tactics)}</div>` : '';
  const habitat = monster.habitat ? `<div class="stat-habitat"><strong>Habitat:</strong> ${esc(monster.habitat)}</div>` : '';
  // CSV / partial JSON uploads have no stat block
  if(!s || typeof s !== 'object') return lore + tactics + habitat;

  const ATTRS = ['STR','DEX','CON','INT','WIS','CHA'];
  const vals  = [s.str, s.dex, s.con, s.int, s.wis, s.cha];

  const statItems = ATTRS.map((attr, i) => {
    const [base, mod = '—)'] = String(vals[i] ?? '—').split('(');
    return `<div class="stat-item">
      <div class="stat-name">${attr}</div>
      <div class="stat-val">${esc(base)}</div>
      <div class="stat-mod">(${esc(mod)}</div>
    </div>`;
  }).join('');

  const pills = [
    `<span class="stat-pill"><strong>AC</strong> ${esc(s.ac)}</span>`,
    `<span class="stat-pill"><strong>HP</strong> ${esc(s.hp)}</span>`,
    `<span class="stat-pill"><strong>Spd</strong> ${esc(s.spd)}</span>`,
    ...(Array.isArray(s.props) ? s.props : []).map(p => `<span class="stat-pill">${esc(p)}</span>`),
  ].join('');

  return `<div class="stat-block-title">☠ Stat Block</div>
    <div class="stat-grid">${statItems}</div>
    <div class="stat-props">${pills}</div>
    ${lore}${tactics}${habitat}`;
}

// ── Encounter card population ──────────────────────
function populateEncounterCard(monster, mroll) {
  // Badge & name
  EL.encBadgeRoll().textContent = mroll;
  EL.encName().textContent      = monster.name;
  EL.encCR().textContent        = monster.cr;
  EL.encDesc().textContent      = monster.desc;
  EL.statBlock().innerHTML      = renderStatBlock(monster);

  // Count display
  const countExpr = monster.count || '1';
  if(countExpr === '1') {
    EL.encCountRow().style.display = 'none';
  } else {
    const rolled = rollCountExpr(countExpr);
    EL.encCountNum().textContent   = rolled;
    EL.encCountLabel().textContent = rolled === 1 ? 'creature' : 'creatures';
    EL.encCountRoll().textContent  = `(${countExpr})`;
    EL.encCountRow().style.display = '';
  }
}

// Shorthand — also used by undoTurn when restoring an encounter
function showEncounterCard(monster, mroll) {
  const card = EL.encCard();
  card.classList.remove('visible');
  void card.offsetWidth; // force reflow for animation
  card.classList.add('visible');
  populateEncounterCard(monster, mroll);
}

// ── Roll display helpers ───────────────────────────
function showCheckRoll(roll, isEnc) {
  const lbl = EL.d100label();
  lbl.textContent = isEnc ? '☠ Encounter!' : 'No encounter';
  lbl.className   = 'die-result-label' + (isEnc ? ' enc' : '');
  // Freeze flat die on result
  const flatNum = document.getElementById('checkFlatNum');
  if(flatNum){ flatNum.textContent = roll; flatNum.className = 'flat-die-num' + (isEnc ? ' enc' : ''); }
  const wrap = document.getElementById('checkDieWrap');
  if(wrap){
    wrap.classList.remove('glow-normal','glow-enc','glow-mon');
    wrap.classList.add(isEnc ? 'glow-enc' : 'glow-normal');
  }
  flashDieOverlay('checkDieOverlay', roll, isEnc ? 'enc' : '');
}

function showMonsterRoll(mroll, monsterName) {
  const lbl = EL.d20label();
  lbl.textContent = monsterName;
  lbl.className   = 'die-result-label mon';
  // Freeze flat die on result
  const flatNum = document.getElementById('monsterFlatNum');
  if(flatNum){ flatNum.textContent = mroll; flatNum.className = 'flat-die-num mon'; }
  const wrap = document.getElementById('monsterDieWrap');
  if(wrap){
    wrap.classList.remove('glow-normal','glow-enc','glow-mon');
    wrap.classList.add('glow-mon');
  }
  flashDieOverlay('monsterDieOverlay', mroll, 'mon');
}

function flashDieOverlay(id, number, variant) {
  if(!diceAnimOn) return;
  const overlay = document.getElementById(id);
  if(!overlay) return;
  overlay.innerHTML = `<div class="die-overlay-card${variant ? ' '+variant : ''}"><span class="die-overlay-num${variant ? ' '+variant : ''}">${number}</span></div>`;
  overlay.classList.remove('show');
  void overlay.offsetWidth;
  overlay.classList.add('show');
}

function clearRollDisplay() {
  EL.d100label().textContent = 'No roll yet';
  EL.d100label().className   = 'die-result-label';
  EL.d20label().textContent  = '';
  EL.d20label().className    = 'die-result-label';
  // Reset flat dice
  const cn = document.getElementById('checkFlatNum');
  if(cn){ cn.textContent = '—'; cn.className = 'flat-die-num'; }
  const mn = document.getElementById('monsterFlatNum');
  if(mn){ mn.textContent = '—'; mn.className = 'flat-die-num'; }
  ['checkDieOverlay','monsterDieOverlay'].forEach(id => {
    const o = document.getElementById(id);
    if(o){ o.classList.remove('show'); o.innerHTML = ''; }
  });
  ['checkDieWrap','monsterDieWrap'].forEach(id => {
    const w = document.getElementById(id);
    if(w) w.classList.remove('glow-normal','glow-enc','glow-mon');
  });
}

function clearEncounterDisplay() {
  EL.encCard().classList.remove('visible');
  EL.d20block().style.display = 'none';
  document.querySelectorAll('#tBody tr').forEach(r => r.classList.remove('hl'));
}

// ── Encounter visual effects ───────────────────────
function triggerEncounterFX() {
  // Screen flash
  const flash = EL.encFlash();
  flash.classList.remove('enc-flashing');
  void flash.offsetWidth;
  flash.classList.add('enc-flashing');

  // Particle burst
  const container = EL.particles();
  const colors = ['#cc1122','#991010','#dd2233','#aa0818'];
  for(let i = 0; i < 22; i++) {
    const p    = document.createElement('div');
    const x    = 10 + Math.random() * 80;
    const size = 4  + Math.random() * 8;
    const dur  = 0.6 + Math.random() * 1.0;
    p.className = 'particle';
    Object.assign(p.style, {
      left:             `${x}%`,
      top:              `${-size}px`,
      width:            `${size}px`,
      height:           `${size * 1.5}px`,
      background:       colors[Math.floor(Math.random() * colors.length)],
      animationDuration:`${dur}s`,
      animationDelay:   `${Math.random() * 0.3}s`,
    });
    container.appendChild(p);
    setTimeout(() => p.remove(), (dur + 0.3) * 1000);
  }

  // Screen shake
  document.body.style.transform = 'translateX(0)';
  let shakes = 0;
  const shakeInt = setInterval(() => {
    const tx = (Math.random() - 0.5) * 6;
    const ty = (Math.random() - 0.5) * 3;
    document.body.style.transform = `translateX(${tx}px) translateY(${ty}px)`;
    if(++shakes > 6) { clearInterval(shakeInt); document.body.style.transform = ''; }
  }, 40);
}

// ── Combat state ───────────────────────────────────
function setCombatActive(active, monster = null, turnNum = 0) {
  combatActive   = active;
  pendingMonster = monster;
  pendingTurn    = turnNum;

  EL.advBtn().classList.toggle('combat-locked', active);
  EL.combatLockedLabel().classList.toggle('visible', active);
  EL.defeatWrap().style.display = active ? 'block' : 'none';

  // Update locked label text dynamically
  if(active && monster) {
    EL.combatLockedLabel().textContent = `☠ Defeat the ${monster.name} first`;
  }
}

function monsterDefeated() {
  if(!combatActive || !pendingMonster) return;
  if(soundOn) playMonsterDefeated();

  xpAwardEncounter(pendingMonster, pendingTurn);

  // Slain feedback on the defeat button before it disappears
  const defBtn = EL.defeatWrap().querySelector('.defeat-btn');
  if(defBtn) {
    defBtn.textContent = '✦ Slain!';
    defBtn.style.background = 'linear-gradient(180deg,rgba(60,120,30,0.6) 0%,rgba(20,60,10,0.6) 100%)';
    defBtn.style.borderColor = '#4a9a2a';
    defBtn.style.animation = 'none';
  }

  // Brief gold flash on the encounter card border
  const card = EL.encCard();
  card.style.transition  = 'border-color 0.2s, box-shadow 0.2s';
  card.style.borderColor = '#4a9a2a';
  card.style.boxShadow   = '0 0 24px rgba(74,154,42,0.4)';
  setTimeout(() => {
    card.style.borderColor = '';
    card.style.boxShadow   = '';
  }, 700);

  setTimeout(() => {
    EL.statBlock().innerHTML = '';
    EL.advBtn().focus();
    setCombatActive(false);
    // Clear encounter card and monster die block
    clearEncounterDisplay();
    // Reset roll display to initial state
    clearRollDisplay();
    saveNow();
  }, 420);
}

// ── Advance turn ───────────────────────────────────
function advanceTurn() {
  const btn = EL.advBtn();
  if(btn.classList.contains('rolling') || combatActive) return;

  btn.classList.add('rolling');
  if(soundOn) { playAdvanceClick(); playDiceRattle(); }

  const roll = rDie(DIE_TYPE);
  const isEnc = roll <= THRESHOLD;

  checkDie.roll(dieRollToFace(DIE_TYPE, roll), () => {
    turn++;

    // Turn counter pop animation
    const ctr = EL.turnCounter();
    ctr.textContent = turn;
    ctr.classList.remove('pop');
    void ctr.offsetWidth;
    ctr.classList.add('pop');

    showCheckRoll(roll, isEnc);

    let monster = null, mroll = null;

    if(isEnc) {
      if(soundOn) setTimeout(playEncounterSting, 150);
      triggerEncounterFX();
      mroll   = r20();
      monster = MONSTERS.find(m => m.roll === mroll);
      EL.d20block().style.display = 'block';
      // Ensure flat die / canvas visibility matches current diceAnimOn state
      _applyDiceAnimState();

      monsterDie.roll(mroll - 1, () => {
        showMonsterRoll(mroll, monster.name);
        showEncounterCard(monster, mroll);

        // Scroll encounter card into viewport centre
        setTimeout(() => {
          const card = EL.encCard();
          const r    = card.getBoundingClientRect();
          window.scrollBy({ top: r.top + r.height / 2 - window.innerHeight / 2, behavior: 'smooth' });
        }, 80);

        setCombatActive(true, monster, turn);
        if(!tableOpen) toggleTable();
        setTimeout(() => hlRow(mroll), 350);
      });
    } else {
      if(soundOn) playTurnTock();
      clearEncounterDisplay();
    }

    history.unshift({ turn, roll, enc: isEnc, monster, mroll });
    renderLog();
    btn.classList.remove('rolling');
    EL.undoBtn().disabled = false;
    if(!sessionStart) sessionStart = Date.now();
    EL.timeLabel().textContent = `${turn * 10} min in-game`;
  });
}

// ── Undo turn ──────────────────────────────────────
function undoTurn() {
  if(!history.length) return;

  // If we're mid-combat, cancelling the encounter is part of undo
  if(combatActive) {
    setCombatActive(false);
    EL.encCard().classList.remove('visible');
    EL.d20block().style.display = 'none';
    document.querySelectorAll('#tBody tr').forEach(r => r.classList.remove('hl'));
  }

  history.shift();
  turn = Math.max(0, turn - 1);
  EL.turnCounter().textContent = turn;
  EL.undoBtn().disabled = history.length === 0;

  if(history.length) {
    const last = history[0];
    showCheckRoll(last.roll, last.enc);
    if(last.enc && last.monster) {
      EL.d20block().style.display = 'block';
      showMonsterRoll(last.mroll, last.monster.name);
      showEncounterCard(last.monster, last.mroll);
      hlRow(last.mroll);
    } else {
      clearEncounterDisplay();
    }
  } else {
    clearRollDisplay();
    clearEncounterDisplay();
  }

  renderLog();
  EL.timeLabel().textContent = turn ? `${turn * 10} min in-game` : '';
  saveNow();
}

// ── History log ────────────────────────────────────
function renderLog() {
  const c = EL.logEntries();
  if(!history.length) {
    c.innerHTML = '<div class="log-empty">The dungeon awaits... no turns have passed.</div>';
    return;
  }
  c.innerHTML = history.slice(0, 40).map((e, i) => `
    <div class="log-row ${e.enc ? 'enc' : ''}">
      <span class="log-turn">T${esc(e.turn)}</span>
      <span class="log-d100 ${e.enc ? 'enc' : ''}">${esc(e.roll)}</span>
      <span class="log-note ${e.enc ? 'enc' : ''}">${e.enc ? `[d20·${esc(e.mroll)}] ${esc(e.monster?.name)}` : quietFlavor(e.roll)}</span>
      <span class="log-tag">${e.enc ? 'ENC' : ''}</span>
      ${i === 0 ? '<button class="log-undo-btn" onclick="undoTurn()" title="Undo">↩</button>' : '<span></span>'}
    </div>`).join('');

  // Live session encounter rate in freq badge
  const encCount = history.filter(e => e.enc).length;
  const rateNote = turn > 0
    ? ` &nbsp;·&nbsp; <strong style="color:var(--bone-dim)">${encCount}/${turn}</strong> this session`
    : '';
  const badge = document.getElementById('freqBadgeExtra');
  if(badge) badge.innerHTML = rateNote;
}

function quietFlavor(roll) {
  const x = roll / DIE_SIDES[DIE_TYPE];
  if(x <= 0.42) return 'distant sounds — nothing emerges';
  if(x <= 0.62) return 'dripping water, nothing more';
  if(x <= 0.82) return 'cold silence';
  return 'all is still';
}

function resetAll() {
  if(!turn || !confirm('Abandon session? All history will be lost.')) return;
  turn = 0; history = []; sessionStart = null;

  EL.turnCounter().textContent = '0';
  clearRollDisplay();
  clearEncounterDisplay();
  EL.logEntries().innerHTML = '<div class="log-empty">The dungeon awaits... no turns have passed.</div>';
  EL.timeLabel().textContent = '';
  EL.undoBtn().disabled = true;
}

document.addEventListener('keydown', e => {
  if(e.key === 'Escape')                                            { closeSettings(); return; }
  // Let inputs (player names) and focused buttons keep Space/Enter/Ctrl+Z
  if(e.target.closest('input, textarea, select, button'))          return;
  if(e.key === 'z' && (e.ctrlKey || e.metaKey))                   { e.preventDefault(); undoTurn(); return; }
  if((e.code === 'Space' || e.code === 'Enter')
     && !EL.settingsOverlay().classList.contains('open'))          { e.preventDefault(); advanceTurn(); }
});

// ══════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════
let previousTheme = '', currentTheme = 'default', VOL_SFX = 0.80;

// ══════════════════════════════════════════════════
// CUSTOM MONSTER TABLE UPLOAD
// ══════════════════════════════════════════════════



// ── Upload panel sync ───────────────────────────────
function syncUploadPanel(idx) {
  const title  = document.getElementById('mtbUploadTitle');
  const status = document.getElementById('mtbUploadStatus');
  const reset  = document.getElementById('mtbResetBtn');
  if(!title) return;

  title.textContent = `Custom Table — ${TIER_NAMES[idx]}`;

  if(customTables[idx]) {
    const n = customTables[idx].length;
    status.textContent = `✦ Custom — ${n} entr${n === 1 ? 'y' : 'ies'} loaded`;
    status.className = 'mtb-upload-status ok';
    reset.style.display = '';
  } else {
    status.textContent = 'Using built-in table';
    status.className = 'mtb-upload-status';
    reset.style.display = 'none';
  }
}

function syncAllTierBadges() {
  [0, 1, 2].forEach(i => {
    const btn = document.getElementById(`mtbBtn${i}`);
    if(btn) btn.classList.toggle('has-custom', !!customTables[i]);
  });
}

// ── File input / drag-drop handlers ────────────────
function mtbDragOver(e) {
  e.preventDefault();
  document.getElementById('mtbDropZone').classList.add('drag-over');
}
function mtbDragLeave(e) {
  document.getElementById('mtbDropZone').classList.remove('drag-over');
}
function mtbDrop(e) {
  e.preventDefault();
  document.getElementById('mtbDropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if(file) mtbLoadFile(file);
}
function mtbFileChosen(e) {
  const file = e.target.files[0];
  if(file) mtbLoadFile(file);
}

function mtbLoadFile(file) {
  const status = document.getElementById('mtbUploadStatus');
  if(file.size > 1024 * 1024) {
    status.textContent = '✕ File too large (max 1 MB)';
    status.className = 'mtb-upload-status err';
    return;
  }
  status.textContent = 'Reading…';
  status.className = 'mtb-upload-status';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const rows = parseTableFile(file.name, e.target.result);
      customTables[MONSTER_TABLE_INDEX] = rows;
      saveCustomTables();
      // Apply immediately if this is the active tier
      MONSTERS = activeTableForIndex(MONSTER_TABLE_INDEX);
      populateMonsterTable();
      syncUploadPanel(MONSTER_TABLE_INDEX);
      syncAllTierBadges();
      showSaveIndicator('✦ Custom table loaded');
    } catch(err) {
      status.textContent = `✕ ${err.message}`;
      status.className = 'mtb-upload-status err';
    }
  };
  reader.onerror = () => {
    status.textContent = '✕ Could not read file';
    status.className = 'mtb-upload-status err';
  };
  reader.readAsText(file);
}

// ── Reset to built-in ───────────────────────────────
function mtbReset() {
  customTables[MONSTER_TABLE_INDEX] = null;
  saveCustomTables();
  MONSTERS = MONSTER_TABLES[MONSTER_TABLE_INDEX];
  populateMonsterTable();
  syncUploadPanel(MONSTER_TABLE_INDEX);
  syncAllTierBadges();
  showSaveIndicator('Built-in table restored');
}

// ── Download CSV template ───────────────────────────
function mtbDownloadTemplate() {
  const src = activeTableForIndex(MONSTER_TABLE_INDEX);
  const header = 'roll,name,cr,count,desc\n';
  const rows = src.map(m =>
    `${m.roll},"${(m.name||'').replace(/"/g,'""')}","${(m.cr||'').replace(/"/g,'""')}","${(m.count||'1').replace(/"/g,'""')}","${(m.desc||'').replace(/"/g,'""')}"`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const name = TIER_NAMES[MONSTER_TABLE_INDEX].toLowerCase().replace(/\s+/g,'-');
  a.href     = url;
  a.download = `encounter-table-${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Table selection ─────────────────────────────────
function setMonsterTable(idx) {
  MONSTER_TABLE_INDEX = idx;
  MONSTERS = activeTableForIndex(idx);
  populateMonsterTable();
  syncMonsterTableButtons(idx);
  syncUploadPanel(idx);
  saveNow();
}

function syncMonsterTableButtons(idx) {
  document.querySelectorAll('.monster-table-btn').forEach((b, i) => {
    b.classList.toggle('active', i === idx);
  });
}

function openSettings() {
  pendingThresh = THRESHOLD;
  pendingDie    = DIE_TYPE;
  previousTheme = currentTheme;

  const slider = EL.threshSlider();
  slider.max   = DIE_SIDES[pendingDie];
  slider.value = pendingThresh;

  syncDieTypeButtons(pendingDie);
  updateThreshDisplay();
  syncPresetHighlight();
  syncMonsterTableButtons(MONSTER_TABLE_INDEX);
  syncUploadPanel(MONSTER_TABLE_INDEX);
  syncAllTierBadges();
  EL.settingsOverlay().classList.add('open');
}

function closeSettings()  { EL.settingsOverlay().classList.remove('open'); }

function cancelSettings() {
  if(previousTheme !== currentTheme) {
    const btn = document.querySelector(`.theme-btn[onclick*="'${previousTheme}'"]`)
             || document.querySelector('.theme-btn');
    applyTheme(previousTheme, btn || document.createElement('button'));
  }
  closeSettings();
}

function overlayClick(e) { if(e.target === EL.settingsOverlay()) cancelSettings(); }

function saveSettings() {
  THRESHOLD = pendingThresh;
  DIE_TYPE  = pendingDie;
  updateFreqBadge();
  const cdl = EL.checkDieLabel();
  if(cdl) cdl.textContent = `${DIE_TYPE} Roll — Wandering Monsters`;
  closeSettings();
  saveNow();
}

function applyPreset(pct, die, btn) {
  pendingDie    = die;
  pendingThresh = Math.max(1, Math.round(DIE_SIDES[die] * pct / 100));

  const slider  = EL.threshSlider();
  slider.max    = DIE_SIDES[die];
  slider.value  = pendingThresh;

  syncDieTypeButtons(die);
  updateThreshDisplay();
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setDieType(die, btn) {
  pendingDie = die;
  document.querySelectorAll('.die-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const slider  = EL.threshSlider();
  const sides   = DIE_SIDES[die];
  pendingThresh = Math.max(1, Math.min(sides, Math.round(pendingThresh * sides / (parseInt(slider.max) || sides))));
  slider.max    = sides;
  slider.value  = pendingThresh;

  updateThreshDisplay();
  syncPresetHighlight();
}

function syncDieTypeButtons(die) {
  document.querySelectorAll('.die-type-btn').forEach(b =>
    b.classList.toggle('active', b.textContent.trim() === die)
  );
}

function updateThreshDisplay() {
  pendingThresh = parseInt(EL.threshSlider().value);
  const sides   = DIE_SIDES[pendingDie] || 100;
  const pct     = (pendingThresh / sides * 100).toFixed(1);
  const exp     = (sides / pendingThresh).toFixed(1);

  EL.threshVal().textContent  = pendingThresh;
  EL.tdBig().textContent      = `≤ ${pendingThresh}`;
  EL.tdPct().textContent      = `${pct}% chance per turn`;
  EL.tdExpected().textContent = `~1 encounter every ${exp} turns`;
  EL.sliderHint().textContent = `${pendingThresh} in ${sides} chance per turn (${pct}%)`;
  syncPresetHighlight();
}

function syncPresetHighlight() {
  const pct = pendingThresh / (DIE_SIDES[pendingDie] || 100) * 100;
  [10, 35, 50, 75].forEach((p, i) =>
    document.querySelectorAll('.preset-btn')[i].classList.toggle('active', Math.abs(pct - p) < 1)
  );
}

function updateFreqBadge() {
  const pct = (THRESHOLD / (DIE_SIDES[DIE_TYPE] || 100) * 100).toFixed(0);
  EL.freqThresh().textContent = THRESHOLD;
  EL.freqDie().textContent    = DIE_TYPE;
  EL.freqPct().textContent    = pct + '%';
}

function applyTheme(theme, btn) {
  document.documentElement.setAttribute('data-theme', theme === 'default' ? '' : theme);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentTheme = theme;
  rebuildDiceForTheme();
}

function updateVolume() {
  VOL_SFX = EL.volSfx().value / 100;
  EL.volSfxVal().textContent = EL.volSfx().value;
}

// ── Animation toggle ───────────────────────────────
let animOn = true;

function toggleAnim() {
  animOn = !animOn;
  syncAnimBtn();
  const canvas    = document.getElementById('bg-canvas');
  const bgStatic  = document.getElementById('bg-static');
  if(canvas)   canvas.style.display   = animOn ? '' : 'none';
  if(bgStatic) bgStatic.style.display = animOn ? 'none' : '';
  // Pause/resume CSS animations on the page
  document.querySelectorAll('*').forEach(el => {
    el.style.animationPlayState = animOn ? '' : 'paused';
  });
  saveNow();
}

function syncAnimBtn() {
  const btn = document.getElementById('animToggle');
  if(!btn) return;
  document.getElementById('animLabel').textContent = animOn ? 'On' : 'Off';
  btn.classList.toggle('active', !animOn);
}


// ══════════════════════════════════════════════════
// XP TRACKER — D&D 5E standard XP rules
// ══════════════════════════════════════════════════
// XP state
let xpPartySize = 4;
let xpPlayers = [
  {name:'Player 1', level:1, xp:0},
  {name:'Player 2', level:1, xp:0},
  {name:'Player 3', level:1, xp:0},
  {name:'Player 4', level:1, xp:0},
];
let xpSessionLog = []; // {turn, monsterName, cr, rawXP, adjustedXP, perPlayer}


function xpAwardEncounter(monster, turnNum){
  const rawXP = crToXP(monster.cr);
  if(rawXP === 0) return;

  // Count monsters in this encounter (from CR expression)
  const [, count] = parseCR(monster.cr);
  const mult = getEncounterMultiplier(count, xpPartySize);
  const adjustedXP = Math.round(rawXP * mult);
  const perPlayer  = Math.floor(adjustedXP / xpPartySize);

  xpSessionLog.unshift({turn:turnNum, monsterName:monster.name, cr:monster.cr, rawXP, adjustedXP, perPlayer});

  // Award XP and check level-ups
  const levelUps = [];
  xpPlayers.forEach((p,i) => {
    if(p.level >= 20) return;
    p.xp += perPlayer;
    while(p.level < 20 && p.xp >= xpToNextLevel(p.level)){
      p.level++;
      levelUps.push(i);
    }
  });

  xpRenderAll();
  if(levelUps.length) xpFlashLevelUp(levelUps);
}

function xpFlashLevelUp(playerIndexes){
  playLevelUpFanfare();
  // Card flash on each levelled player
  playerIndexes.forEach(i => {
    const card = document.getElementById('xpPCard'+i);
    if(card){
      const flash = document.createElement('div');
      flash.className = 'xp-level-up-flash';
      card.appendChild(flash);
      setTimeout(()=>flash.remove(), 1300);
    }
  });
  // Full-screen overlay — show for the first player who levelled up
  const first = playerIndexes[0];
  const p = xpPlayers[first];
  showLevelUpOverlay(p.name, p.level);
  // Scroll XP tracker into view and focus it after overlay clears
  setTimeout(()=>{
    const xpCard = EL.xpCard();
    if(xpCard){
      xpCard.scrollIntoView({ behavior:'smooth', block:'nearest' });
      xpCard.focus();
    }
  }, 3400);
}

function showLevelUpOverlay(playerName, newLevel){
  const overlay = EL.lvlupOverlay();
  EL.lvlupName().textContent = playerName;
  EL.lvlupNum().textContent   = newLevel;

  // Sub-flavour based on level milestone
  const flavour = {
    2:'A spark of potential ignites.',
    3:'The dungeon begins to fear you.',
    4:'Your name is whispered in the dark.',
    5:'Power flows through you like blood.',
    6:'Monsters hesitate before charging.',
    7:'You have walked where others fled.',
    8:'The shadows show you respect.',
    9:'Legends are forged in moments like this.',
    10:"Half the world's horrors cannot touch you.",
    11:'You stand apart from common warriors.',
    12:'The dungeon shifts to account for you.',
    13:'Death has looked you in the eye and blinked.',
    14:'Your deeds echo through these stone halls.',
    15:'Even warlords speak your name carefully.',
    16:'You are becoming something beyond mortal.',
    17:'The gods have noticed.',
    18:'Few in history have stood where you stand.',
    19:'One final threshold remains.',
    20:'You have reached the apex of mortal power.'
  };
  EL.lvlupSub().textContent = flavour[newLevel] || 'A new power awakens in the darkness.';

  // Spawn gold particles
  const content = EL.lvlupContent();
  for(let i=0; i<28; i++){
    const p = document.createElement('div');
    p.className = 'lvlup-particle';
    const angle = (i/28)*Math.PI*2;
    const dist  = 120 + Math.random()*180;
    p.style.setProperty('--px', Math.cos(angle)*dist+'px');
    p.style.setProperty('--py', Math.sin(angle)*dist+'px');
    p.style.setProperty('--pd', (Math.random()*0.3)+'s');
    p.style.background = Math.random()>0.3 ? 'var(--gold-hi)' : '#fff';
    p.style.width  = (4+Math.random()*5)+'px';
    p.style.height = p.style.width;
    overlay.appendChild(p);
    setTimeout(()=>p.remove(), 1800);
  }

  overlay.classList.add('active');
  overlay.style.animation = 'none';

  // Dismiss on click or after 3.3s
  const dismiss = ()=>{
    overlay.classList.remove('active');
    overlay.style.opacity='0';
  };
  overlay.onclick = dismiss;
  setTimeout(dismiss, 3300);
}

function xpChangeParty(delta){
  xpPartySize = Math.max(1, Math.min(8, xpPartySize + delta));
  // Sync player array size
  while(xpPlayers.length < xpPartySize)
    xpPlayers.push({name:'Player '+(xpPlayers.length+1), level:1, xp:0});
  EL.xpPartyCount().textContent = xpPartySize;
  xpRenderAll();
}

function xpReset(){
  if(!confirm('Reset all XP and levels?')) return;
  xpSessionLog = [];
  xpPlayers.forEach((p,i) => { p.level=1; p.xp=0; p.name='Player '+(i+1); });
  xpRenderAll();
  saveNow();
}

function xpSetLevel(playerIdx, delta){
  const p = xpPlayers[playerIdx];
  p.level = Math.max(1, Math.min(20, p.level + delta));
  p.xp = xpForLevel(p.level);
  xpRenderAll();
}

function xpStartEditName(idx){
  const nameEl = document.getElementById('xpName'+idx);
  const current = xpPlayers[idx].name;
  nameEl.innerHTML = `<input class="xp-name-input" id="xpNameInput${idx}" value="${esc(current)}" maxlength="12"
    onblur="xpSaveName(${idx})" onkeydown="if(event.key==='Enter')this.blur()">`;
  document.getElementById('xpNameInput'+idx).select();
}

function xpSaveName(idx){
  const inp = document.getElementById('xpNameInput'+idx);
  if(inp) xpPlayers[idx].name = inp.value.trim() || ('Player '+(idx+1));
  xpRenderAll();
}

function xpRenderAll(){
  xpRenderPlayers();
  xpRenderSummary();
  xpRenderLog();
}

function xpRenderPlayers(){
  const grid = EL.xpPlayerGrid();
  grid.innerHTML = xpPlayers.slice(0, xpPartySize).map((p,i) => {
    const lvl = p.level;
    const curXP = p.xp;
    const needed = xpToNextLevel(lvl);
    const prevXP = xpForLevel(lvl);
    const pct = needed ? Math.min(100, Math.round((curXP - prevXP) / (needed - prevXP) * 100)) : 100;
    const nextXP = needed ? (needed - curXP).toLocaleString() + ' to next' : 'Max Level';
    return `<div class="xp-player-card" id="xpPCard${i}">
      <button class="xp-player-edit" onclick="xpStartEditName(${i})" title="Edit name">✎</button>
      <div class="xp-player-name" id="xpName${i}">${esc(p.name)}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:0.3rem;">
        <button class="xp-count-btn" style="width:20px;height:20px;font-size:0.65rem;" onclick="xpSetLevel(${i},-1)">−</button>
        <div class="xp-player-level">${lvl}</div>
        <button class="xp-count-btn" style="width:20px;height:20px;font-size:0.65rem;" onclick="xpSetLevel(${i},1)">+</button>
      </div>
      <div class="xp-player-xp">${curXP.toLocaleString()} XP</div>
      <div class="xp-player-bar-wrap"><div class="xp-player-bar" style="width:${pct}%"></div></div>
      <div class="xp-player-xp" style="margin-top:0.2rem;font-size:0.52rem;">${nextXP}</div>
    </div>`;
  }).join('');
}

function xpRenderSummary(){
  const totalXP = xpSessionLog.reduce((s,e)=>s+e.adjustedXP, 0);
  const perPlayer = xpSessionLog.reduce((s,e)=>s+e.perPlayer, 0);
  EL.xpTotal().textContent = totalXP.toLocaleString() + ' XP';
  EL.xpPerPlayer().textContent = perPlayer.toLocaleString() + ' XP';

  // Defeated count
  const defeatedEl = document.getElementById('xpDefeatedCount');
  if(defeatedEl) defeatedEl.textContent = xpSessionLog.length;

  // Show note about who's closest to levelling up
  const notes = xpPlayers.slice(0,xpPartySize).map(p=>{
    if(p.level>=20) return null;
    const rem = (xpToNextLevel(p.level)||0) - p.xp;
    return {name:p.name, rem};
  }).filter(Boolean).sort((a,b)=>a.rem-b.rem);

  if(notes.length){
    const closest = notes[0];
    EL.xpNextNote().textContent =
      `${closest.name} needs ${closest.rem.toLocaleString()} XP to reach level ${xpPlayers.find(p=>p.name===closest.name).level+1}`;
  } else {
    EL.xpNextNote().textContent = 'All players at maximum level';
  }
}

function xpRenderLog(){
  const el = EL.xpEncLog();
  if(!xpSessionLog.length){
    el.innerHTML = '<div class="xp-empty">No encounters yet — XP will appear here.</div>';
    return;
  }
  el.innerHTML = xpSessionLog.map(e=>`
    <div class="xp-enc-row">
      <span class="xp-enc-turn">T${esc(e.turn)}</span>
      <span class="xp-enc-name">${esc(e.monsterName)} <span style="font-size:0.62rem;color:var(--bone-faint);font-style:normal;">(${esc(e.cr)})</span></span>
      <span class="xp-enc-xp">+${(+e.perPlayer || 0).toLocaleString()} ea.</span>
      <span class="xp-enc-total">${(+e.adjustedXP || 0).toLocaleString()} total</span>
    </div>`).join('');
}


// Init XP display on load
window.addEventListener('load', ()=>{
  setTimeout(xpRenderAll, 100);
  syncSoundBtn();
  syncAnimBtn();
  syncDiceAnimBtn();
  if(!animOn) {
    const canvas   = document.getElementById('bg-canvas');
    const bgStatic = document.getElementById('bg-static');
    if(canvas)   canvas.style.display   = 'none';
    if(bgStatic) bgStatic.style.display = '';
    document.querySelectorAll('*').forEach(el => { el.style.animationPlayState = 'paused'; });
  }
  if(!diceAnimOn) {
    _applyDiceAnimState();
  }
});
