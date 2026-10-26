// App glue: state → render, actions, and the animated effects around them.
// Flow: every user action mutates S inside commit(), which saves and re-renders.
// Effects (dice spins, flashes, sounds, scrolls) are fired by actions, never by render().

// ══════════════════════════════════════════════════
// CUSTOM TABLES — separate localStorage key; 3 slots, null = built-in
// ══════════════════════════════════════════════════
const CUSTOM_TABLE_KEY = 'dt_custom_tables';
const TIER_NAMES = ['Shallow Dungeon', 'Deep Dungeon', 'The Abyss'];

let customTables = [null, null, null];
try {
  const parsed = JSON.parse(localStorage.getItem(CUSTOM_TABLE_KEY));
  if(Array.isArray(parsed) && parsed.length === 3) customTables = parsed;
} catch(e) {}

function saveCustomTables() {
  try { localStorage.setItem(CUSTOM_TABLE_KEY, JSON.stringify(customTables)); }
  catch(e) { console.warn('localStorage save failed:', e); }
}

const activeTable = () => customTables[S.tableIndex] || MONSTER_TABLES[S.tableIndex];

// ══════════════════════════════════════════════════
// DOM CACHE
// ══════════════════════════════════════════════════
const $ = id => document.getElementById(id);

const EL = {
  advBtn: () => $('advBtn'), undoBtn: () => $('undoBtn'), turnCounter: () => $('turnCounter'),
  timeLabel: () => $('timeLabel'), combatLockedLabel: () => $('combatLockedLabel'), defeatWrap: () => $('defeatWrap'),
  d100label: () => $('d100label'), d20block: () => $('d20block'), d20label: () => $('d20label'),
  encCard: () => $('encCard'), encBadgeRoll: () => $('encBadgeRoll'), encName: () => $('encName'),
  encCR: () => $('encCR'), encDesc: () => $('encDesc'), encCountRow: () => $('encCountRow'),
  encCountNum: () => $('encCountNum'), encCountLabel: () => $('encCountLabel'), encCountRoll: () => $('encCountRoll'),
  statBlock: () => $('statBlock'),
  logEntries: () => $('logEntries'), tBody: () => $('tBody'), tableWrap: () => $('tableWrap'), caret: () => $('caret'),
  encFlash: () => $('enc-flash'), particles: () => $('particles'),
  lvlupOverlay: () => $('lvlup-overlay'), lvlupName: () => $('lvlup-name'), lvlupNum: () => $('lvlup-num'),
  lvlupSub: () => $('lvlup-sub'), lvlupContent: () => $('lvlup-content'),
  settingsOverlay: () => $('settingsOverlay'), threshSlider: () => $('threshSlider'), threshVal: () => $('threshVal'),
  tdBig: () => $('tdBig'), tdPct: () => $('tdPct'), tdExpected: () => $('tdExpected'), sliderHint: () => $('sliderHint'),
  freqThresh: () => $('freqThresh'), freqDie: () => $('freqDie'), freqPct: () => $('freqPct'),
  checkDieLabel: () => $('checkDieLabel'), volSfx: () => $('volSfx'), volSfxVal: () => $('volSfxVal'),
  soundToggle: () => $('soundToggle'), soundLabel: () => $('soundLabel'),
  iconSoundOn: () => $('iconSoundOn'), iconSoundOff: () => $('iconSoundOff'),
  xpPartyCount: () => $('xpPartyCount'), xpPlayerGrid: () => $('xpPlayerGrid'), xpTotal: () => $('xpTotal'),
  xpPerPlayer: () => $('xpPerPlayer'), xpNextNote: () => $('xpNextNote'), xpEncLog: () => $('xpEncLog'),
  xpDefeated: () => $('xpDefeatedCount'), xpCard: () => $('xpCard'),
};

// ══════════════════════════════════════════════════
// STATE + PERSISTENCE
// ══════════════════════════════════════════════════
let S = defaultState();
// Transient UI state — never saved
const ui = { rolling: false, defeating: false, tableOpen: false, settingsOpen: false, draft: null };

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }
  catch(e) { console.warn('Save failed:', e); }
}

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch(e) {}
  if(!raw) {
    // One-time migration from the original cookie save
    const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(SAVE_KEY + '='));
    if(match) {
      try { raw = JSON.parse(decodeURIComponent(match.slice(SAVE_KEY.length + 1))); } catch(e) {}
      document.cookie = `${SAVE_KEY}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    }
  }
  return raw ? migrate(raw) : null;
}

function commit(mutate) { mutate(S); save(); render(); }

function showSaveIndicator(msg) {
  let ind = $('saveIndicator');
  if(!ind) {
    ind = document.createElement('div');
    ind.id = 'saveIndicator';
    Object.assign(ind.style, {
      position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: '300',
      font: '500 13px/1 var(--display)', letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--paper)', background: 'var(--ink)', padding: '10px 14px', pointerEvents: 'none',
      opacity: '0', transition: 'opacity 0.3s',
    });
    document.body.appendChild(ind);
  }
  ind.textContent = msg;
  ind.style.opacity = '1';
  clearTimeout(ind._t);
  ind._t = setTimeout(() => { ind.style.opacity = '0'; }, 2000);
}

// ══════════════════════════════════════════════════
// RENDER — derive the page from S + ui. Safe to call any time.
// ══════════════════════════════════════════════════
const applied = {}; // last-applied values for work worth skipping (die shapes, table rows)

function render() {
  renderTheme();
  renderToggles();
  renderTurn();
  renderRoll();
  renderCombat();
  renderLog();
  renderTable();
  renderTorch();
  renderXP();
  renderSettings();
}

function renderTheme() {
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.arg === S.theme));
  if(S.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = S.theme;
}

function renderToggles() {
  EL.soundLabel().textContent     = S.sound ? 'Sound' : 'Muted';
  EL.iconSoundOn().style.display  = S.sound ? '' : 'none';
  EL.iconSoundOff().style.display = S.sound ? 'none' : '';
  EL.soundToggle().classList.toggle('hdr-btn--muted', !S.sound);
  EL.soundToggle().setAttribute('aria-pressed', S.sound);

  $('animLabel').textContent = S.anim ? 'On' : 'Off';
  $('animToggle').classList.toggle('active', S.anim);
  document.documentElement.classList.toggle('no-motion', !S.anim);

  const vol = Math.round(S.volume * 100);
  EL.volSfx().value = vol;
  EL.volSfxVal().textContent = vol;
}

function renderTurn() {
  if(!ui.rolling) EL.turnCounter().textContent = S.turn;
  EL.timeLabel().textContent = S.turn ? `${S.turn * 10} minutes in` : 'The delve begins';
  EL.undoBtn().disabled = !S.history.length;
  EL.advBtn().classList.toggle('rolling', ui.rolling);

  const c = S.combat;
  EL.advBtn().classList.toggle('combat-locked', !!c);
  EL.combatLockedLabel().classList.toggle('visible', !!c);
  if(c) EL.combatLockedLabel().textContent = `Resolve the ${c.monster.name} before the next turn.`;
  EL.defeatWrap().style.display = c ? 'block' : 'none';
  if(!ui.defeating) EL.defeatWrap().querySelector('.defeat-btn').textContent = 'Monster defeated';

  EL.freqThresh().textContent = S.threshold;
  EL.freqDie().textContent    = S.die;
  EL.freqPct().textContent    = (S.threshold / DIE_SIDES[S.die] * 100).toFixed(0) + '%';
  EL.checkDieLabel().textContent = S.die;
}

// The dice show the latest turn, unless that turn's encounter is already resolved
function renderRoll() {
  if(ui.rolling) return; // the roll animation owns the dice mid-roll
  const last = S.history[0];
  if(!last || (last.enc && !S.combat)) { clearRollDisplay(); return; }
  setCheckRoll(last.roll, last.enc, last.die);
  EL.d20block().style.display = last.enc ? 'grid' : 'none';
  if(last.enc) setMonsterRoll(last.mroll, last.monster?.name || '');
}

function renderCombat() {
  const c = S.combat;
  EL.encCard().classList.toggle('visible', !!c);
  document.querySelectorAll('#tBody tr').forEach(r => r.classList.toggle('hl', !!c && r.id === `mr${c.mroll}`));
  if(!c) { EL.statBlock().innerHTML = ''; return; }

  const m = c.monster;
  EL.encBadgeRoll().textContent = c.mroll;
  EL.encName().textContent = m.name;
  EL.encCR().textContent   = m.cr;
  EL.encDesc().textContent = m.desc;
  EL.statBlock().innerHTML = renderStatBlock(m);

  const expr = m.count || '1';
  EL.encCountRow().style.display = expr === '1' ? 'none' : '';
  EL.encCountNum().textContent   = c.count;
  EL.encCountLabel().textContent = c.count === 1 ? 'creature' : 'creatures';
  EL.encCountRoll().textContent  = `(${expr})`;
}

function renderLog() {
  EL.logEntries().innerHTML = !S.history.length
    ? '<li class="log-empty">No turns yet. Press Space to take the first one.</li>'
    : S.history.slice(0, 40).map((e, i) => `
    <li class="${e.enc ? 'enc' : ''}">
      <span class="log-turn">T${esc(e.turn)}</span>
      <span class="log-roll">${esc(e.roll)}</span>
      <span class="log-note">${e.enc ? `${esc(e.monster?.name)} <span class="dim">(d20 ${esc(e.mroll)})</span>` : quietFlavor(e.roll)}</span>
      ${i === 0 ? '<button class="btn-link log-undo" data-action="undo">Undo</button>' : '<span></span>'}
    </li>`).join('');

  const encCount = S.history.filter(e => e.enc).length;
  $('freqBadgeExtra').textContent = S.turn > 0 ? ` · ${encCount} of ${S.turn} so far` : '';
}

function quietFlavor(roll) {
  const x = roll / DIE_SIDES[S.die];
  if(x <= 0.42) return 'Distant sounds. Nothing emerges.';
  if(x <= 0.62) return 'Dripping water, nothing more.';
  if(x <= 0.82) return 'Cold silence.';
  return 'All is still.';
}

function renderTable() {
  EL.tableWrap().classList.toggle('open', ui.tableOpen);
  EL.caret().classList.toggle('open', ui.tableOpen);
  document.querySelector('.table-toggle').setAttribute('aria-expanded', ui.tableOpen);

  const table = activeTable();
  if(applied.table !== table) {
    applied.table = table;
    EL.tBody().innerHTML = table.map(m =>
      `<tr id="mr${esc(m.roll)}">
        <td class="td-roll">${esc(m.roll)}</td>
        <td class="td-name">${esc(m.name)}</td>
        <td class="td-cr">${esc(m.cr)}</td>
        <td class="td-desc">${esc(m.desc)}</td>
      </tr>`).join('');
    if(S.combat) $(`mr${S.combat.mroll}`)?.classList.add('hl');
  }
  const isCustom = !!customTables[S.tableIndex];
  document.querySelector('.table-toggle .card-label').textContent =
    `Encounters — ${TIER_NAMES[S.tableIndex]}${isCustom ? ' (custom)' : ''}`;
}

function renderTorch() {
  const ms = torchRemaining(S.torch);
  const s  = Math.ceil(ms / 1000);
  $('torchTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('torchBar').style.width  = `${ms / TORCH_MS * 100}%`;
  $('torchBtn').textContent  = S.torch.endsAt ? 'Pause' : ms === 0 ? 'Relight' : ms === TORCH_MS ? 'Light' : 'Resume';
  $('torchTimer').classList.toggle('low', ms > 0 && ms <= 10 * 60 * 1000);
  $('torchTimer').classList.toggle('out', ms === 0);
}

function renderXP() {
  const { size, players } = S.party;
  EL.xpPartyCount().textContent = size;

  EL.xpPlayerGrid().innerHTML = players.slice(0, size).map((p, i) => {
    const needed = xpToNextLevel(p.level);
    const prevXP = xpForLevel(p.level);
    const pct    = needed ? Math.min(100, Math.round((p.xp - prevXP) / (needed - prevXP) * 100)) : 100;
    return `<li class="player" id="xpPCard${i}">
      <div id="xpName${i}"><button class="player-name" data-action="edit-name" data-arg="${i}" title="Rename">${esc(p.name)}</button></div>
      <div class="player-level">
        <button class="btn-small" data-action="level" data-arg="${i},-1" aria-label="Level down ${esc(p.name)}">−</button>
        Lv <b>${p.level}</b>
        <button class="btn-small" data-action="level" data-arg="${i},1" aria-label="Level up ${esc(p.name)}">+</button>
      </div>
      <div class="player-bar" aria-hidden="true"><div style="width:${pct}%"></div></div>
      <div class="player-xp"><span>${p.xp.toLocaleString()} XP</span><span>${needed ? (needed - p.xp).toLocaleString() + ' to next' : 'Max level'}</span></div>
    </li>`;
  }).join('');

  EL.xpTotal().textContent     = S.xpLog.reduce((s, e) => s + (+e.adjustedXP || 0), 0).toLocaleString();
  EL.xpPerPlayer().textContent = S.xpLog.reduce((s, e) => s + (+e.perPlayer || 0), 0).toLocaleString();
  EL.xpDefeated().textContent  = S.xpLog.length;

  const closest = players.slice(0, size).filter(p => p.level < 20)
    .map(p => ({ p, rem: xpToNextLevel(p.level) - p.xp })).sort((a, b) => a.rem - b.rem)[0];
  EL.xpNextNote().textContent = closest
    ? `${closest.p.name} is ${closest.rem.toLocaleString()} XP from level ${closest.p.level + 1}.`
    : 'The whole party is at level 20.';

  EL.xpEncLog().innerHTML = S.xpLog.map(e => `
    <li>
      <span class="log-turn">T${esc(e.turn)}</span>
      <span>${esc(e.monsterName)} <span class="dim">${esc(e.cr)}${e.count > 1 ? ` × ${esc(e.count)}` : ''}</span></span>
      <span class="log-xp">+${(+e.perPlayer || 0).toLocaleString()} each</span>
    </li>`).join('');
}

function renderSettings() {
  EL.settingsOverlay().classList.toggle('open', ui.settingsOpen);

  document.querySelectorAll('.monster-table-btn').forEach((b, i) => {
    b.classList.toggle('active', i === S.tableIndex);
    b.classList.toggle('has-custom', !!customTables[i]);
  });
  $('mtbUploadTitle').textContent = `Custom table for ${TIER_NAMES[S.tableIndex]}`;
  const custom = customTables[S.tableIndex];
  const status = $('mtbUploadStatus');
  status.textContent = custom ? `Custom table loaded: ${custom.length} entr${custom.length === 1 ? 'y' : 'ies'}.` : 'Using the built-in table.';
  status.className   = 'upload-status' + (custom ? ' ok' : '');
  $('mtbResetBtn').style.display = custom ? '' : 'none';

  const d = ui.draft;
  if(!d) return;
  const sides = DIE_SIDES[d.die];
  const pct   = (d.threshold / sides * 100).toFixed(1).replace(/\.0$/, '');
  const slider = EL.threshSlider();
  slider.max   = sides;
  slider.value = d.threshold;
  document.querySelectorAll('.die-type-btn').forEach(b => b.classList.toggle('active', b.dataset.arg === d.die));
  document.querySelectorAll('.preset-btn').forEach(b =>
    b.classList.toggle('active', d.die === 'd100' && Math.abs(d.threshold - +b.dataset.arg) < 1));
  EL.threshVal().textContent  = d.threshold;
  EL.tdBig().textContent      = `${pct}%`;
  EL.tdPct().textContent      = 'chance per turn';
  const every = (sides / d.threshold).toFixed(1).replace(/\.0$/, '');
  EL.tdExpected().textContent = every === '1' ? 'an encounter every turn' : `about one encounter every ${every} turns`;
  EL.sliderHint().textContent = `${d.threshold} in ${sides} on a ${d.die}.`;
}

// ── Render helpers ─────────────────────────────────
function renderStatBlock(monster) {
  const s       = monster.stats;
  const lore    = monster.lore    ? `<p class="sb-lore">${esc(monster.lore)}</p>` : '';
  const tactics = monster.tactics ? `<p class="sb-note"><b>Tactics</b> ${esc(monster.tactics)}</p>` : '';
  const habitat = monster.habitat ? `<p class="sb-note"><b>Habitat</b> ${esc(monster.habitat)}</p>` : '';
  // CSV / partial JSON uploads have no stat block
  if(!s || typeof s !== 'object') return lore + tactics + habitat;

  const ATTRS = ['STR','DEX','CON','INT','WIS','CHA'];
  const vals  = [s.str, s.dex, s.con, s.int, s.wis, s.cha];
  const abilities = ATTRS.map((attr, i) => {
    const [base, mod = '—)'] = String(vals[i] ?? '—').split('(');
    return `<div><dt>${attr}</dt><dd>${esc(base.trim())}<small>(${esc(mod)}</small></dd></div>`;
  }).join('');
  const props = (Array.isArray(s.props) ? s.props : []).map(p => `<li>${esc(p)}</li>`).join('');

  return `<div class="sb">
      <p class="sb-line"><b>AC</b> ${esc(s.ac)} &nbsp; <b>HP</b> ${esc(s.hp)} &nbsp; <b>Speed</b> ${esc(s.spd)}</p>
      <dl class="sb-abilities">${abilities}</dl>
      ${props ? `<ul class="sb-props">${props}</ul>` : ''}
    </div>
    ${lore}${tactics}${habitat}`;
}

// `die` is the die that turn was rolled on (older saves lack it: infer from the roll)
function setCheckRoll(roll, isEnc, die = S.die) {
  if(!DIE_SIDES[die] || roll > DIE_SIDES[die]) die = 'd100';
  const lbl = EL.d100label();
  lbl.textContent = isEnc ? 'Encounter' : 'Quiet turn';
  lbl.className   = isEnc ? 'enc' : '';
  drawDie('checkDieFace', die, roll);
  $('checkTotal').textContent = die === 'd100' ? roll : '';
  $('checkDieWrap').classList.toggle('glow-enc', isEnc);
}

function setMonsterRoll(mroll, monsterName) {
  EL.d20label().textContent = monsterName;
  drawDie('monsterDieFace', 'd20', mroll);
  $('d20block').classList.add('glow-mon');
}

function clearRollDisplay() {
  EL.d100label().textContent = 'No roll yet';
  EL.d100label().className   = '';
  EL.d20label().textContent  = '';
  EL.d20block().style.display = 'none';
  drawDie('checkDieFace', S.die, null);
  $('checkTotal').textContent = '';
  $('checkDieWrap').classList.remove('glow-enc');
}

// ══════════════════════════════════════════════════
// EFFECTS — one-shot animations fired by actions
// ══════════════════════════════════════════════════
function popCounter(n) {
  const ctr = EL.turnCounter();
  ctr.textContent = n;
  ctr.classList.remove('pop');
  void ctr.offsetWidth;
  ctr.classList.add('pop');
}

function triggerEncounterFX() {
  const flash = EL.encFlash();
  flash.classList.remove('enc-flashing');
  void flash.offsetWidth;
  flash.classList.add('enc-flashing');
}

function xpFlashLevelUp(playerIndexes) {
  if(S.sound) playLevelUpFanfare();
  playerIndexes.forEach(i => {
    const card = $('xpPCard' + i);
    if(!card) return;
    const flash = document.createElement('div');
    flash.className = 'xp-level-up-flash';
    card.appendChild(flash);
    setTimeout(() => flash.remove(), 1300);
  });
  const p = S.party.players[playerIndexes[0]];
  showLevelUpOverlay(p.name, p.level);
  setTimeout(() => {
    EL.xpCard().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    EL.xpCard().focus();
  }, 3400);
}

const LEVEL_FLAVOUR = {
  2:'A spark of potential ignites.', 3:'The dungeon begins to fear you.', 4:'Your name is whispered in the dark.',
  5:'Power flows through you like blood.', 6:'Monsters hesitate before charging.', 7:'You have walked where others fled.',
  8:'The shadows show you respect.', 9:'Legends are forged in moments like this.', 10:"Half the world's horrors cannot touch you.",
  11:'You stand apart from common warriors.', 12:'The dungeon shifts to account for you.', 13:'Death has looked you in the eye and blinked.',
  14:'Your deeds echo through these stone halls.', 15:'Even warlords speak your name carefully.', 16:'You are becoming something beyond mortal.',
  17:'The gods have noticed.', 18:'Few in history have stood where you stand.', 19:'One final threshold remains.',
  20:'You have reached the apex of mortal power.',
};

function showLevelUpOverlay(playerName, newLevel) {
  const overlay = EL.lvlupOverlay();
  EL.lvlupName().textContent = playerName;
  EL.lvlupNum().textContent  = newLevel;
  EL.lvlupSub().textContent  = LEVEL_FLAVOUR[newLevel] || 'A new power awakens in the darkness.';
  overlay.classList.add('active');
  const dismiss = () => overlay.classList.remove('active');
  overlay.onclick = dismiss;
  setTimeout(dismiss, 3300);
}

// ══════════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════════
function advanceTurn() {
  if(ui.rolling || S.combat) return;
  ui.rolling = true;
  render();
  if(S.sound) { playAdvanceClick(); playDiceRattle(); }

  const roll  = rDie(S.die);
  const isEnc = roll <= S.threshold;
  const turn  = S.turn + 1;

  EL.d20block().style.display = 'none';
  $('checkDieWrap').classList.remove('glow-enc');
  $('checkTotal').textContent = '';
  EL.d100label().textContent = 'Rolling…';
  EL.d100label().className = '';
  EL.d20label().textContent = '';

  rollDie('checkDieFace', S.die, roll, () => {
    popCounter(turn);
    setCheckRoll(roll, isEnc);

    if(!isEnc) {
      if(S.sound) playTurnTock();
      EL.d20block().style.display = 'none';
      finishTurn({ turn, roll, die: S.die, enc: false, monster: null, mroll: null, count: null });
      return;
    }

    if(S.sound) setTimeout(playEncounterSting, 150);
    triggerEncounterFX();
    const table   = activeTable();
    const mroll   = r20();
    // Custom tables needn't cover 1–20; fall back to a random entry
    const monster = table.find(m => m.roll === mroll) || table[Math.floor(Math.random() * table.length)];
    EL.d20block().style.display = 'grid';
    $('d20block').classList.remove('glow-mon');

    rollDie('monsterDieFace', 'd20', mroll, () => {
      setMonsterRoll(mroll, monster.name);
      ui.tableOpen = true;
      finishTurn({ turn, roll, die: S.die, enc: true, monster, mroll, count: rollCountExpr(monster.count || '1') });

      setTimeout(() => {
        const r = EL.encCard().getBoundingClientRect();
        window.scrollBy({ top: r.top + r.height / 2 - window.innerHeight / 2, behavior: 'smooth' });
      }, 80);
      setTimeout(() => $(`mr${mroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 350);
    });
  });
}

function finishTurn(entry) {
  ui.rolling = false;
  commit(s => {
    s.turn = entry.turn;
    s.history.unshift(entry);
    s.history.length = Math.min(s.history.length, 100);
    if(entry.enc) s.combat = { monster: entry.monster, mroll: entry.mroll, count: entry.count, turn: entry.turn };
  });
}

function monsterDefeated() {
  const c = S.combat;
  if(!c || ui.defeating) return;
  ui.defeating = true;
  if(S.sound) playMonsterDefeated();

  // XP lands immediately; the card clears after the "Slain!" beat
  const xp = encounterXP(c.monster.cr, c.count, S.party.size);
  let levelUps = [];
  if(xp.rawXP > 0) commit(s => {
    const entry = s.history.find(e => e.enc && e.turn === c.turn);
    if(entry) entry.partyBefore = s.party.players.map(p => ({ ...p })); // lets undo take the XP back
    const r = awardXP(s.party.players, s.party.size, xp.perPlayer);
    s.party.players = r.players;
    levelUps = r.levelUps;
    s.xpLog.unshift({ turn: c.turn, monsterName: c.monster.name, cr: c.monster.cr, ...xp });
    s.xpLog.length = Math.min(s.xpLog.length, 100);
  });
  if(levelUps.length) xpFlashLevelUp(levelUps);

  EL.defeatWrap().querySelector('.defeat-btn').textContent = 'Slain';

  setTimeout(() => {
    ui.defeating = false;
    commit(s => { s.combat = null; });
    EL.advBtn().focus();
  }, 420);
}

function undoTurn() {
  if(ui.rolling || ui.defeating || !S.history.length) return;
  commit(s => {
    const e = s.history.shift();
    if(e.partyBefore) {
      s.party.players = e.partyBefore;
      while(s.party.players.length < s.party.size) s.party.players.push(defaultPlayer(s.party.players.length));
      s.xpLog = s.xpLog.filter(x => x.turn !== e.turn);
    }
    s.combat = null;
    s.turn   = Math.max(0, s.turn - 1);
  });
}

function abandonSession() {
  if(ui.rolling || !S.turn || !confirm('Abandon session? All history will be lost.')) return;
  commit(s => { s.turn = 0; s.history = []; s.combat = null; });
}

// ── Torch ──────────────────────────────────────────
function torchToggle() {
  commit(({ torch }) => {
    if(torch.endsAt) { torch.left = torchRemaining(torch); torch.endsAt = null; }
    else {
      if(torchRemaining(torch) === 0) torch.left = TORCH_MS;
      torch.endsAt = Date.now() + torch.left;
    }
  });
}

setInterval(() => {
  if(S.torch.endsAt && torchRemaining(S.torch) === 0) {
    commit(({ torch }) => { torch.left = 0; torch.endsAt = null; });
    playTorchOut();
    showSaveIndicator('The torch gutters out — darkness');
  }
  renderTorch();
}, 1000);

// ── XP ─────────────────────────────────────────────
function startEditName(i) {
  const nameEl = $('xpName' + i);
  nameEl.innerHTML = `<input class="xp-name-input" data-name-idx="${i}" value="${esc(S.party.players[i].name)}" maxlength="12">`;
  nameEl.firstChild.select();
}

function saveName(input) {
  const i = +input.dataset.nameIdx;
  commit(s => { s.party.players[i].name = input.value.trim() || `Player ${i + 1}`; });
}

document.addEventListener('focusout', e => { if(e.target.dataset?.nameIdx !== undefined) saveName(e.target); });

// ── Settings ───────────────────────────────────────
function openSettings() {
  ui.draft = { threshold: S.threshold, die: S.die, prevTheme: S.theme };
  ui.settingsOpen = true;
  render();
}

function closeSettings() { ui.settingsOpen = false; ui.draft = null; render(); }

function cancelSettings() {
  if(ui.draft && ui.draft.prevTheme !== S.theme) { const t = ui.draft.prevTheme; commit(s => { s.theme = t; }); }
  closeSettings();
}

function saveSettings() {
  const { threshold, die } = ui.draft;
  commit(s => { s.threshold = threshold; s.die = die; });
  closeSettings();
}

function loadTableFile(file) {
  const status = $('mtbUploadStatus');
  const fail = msg => { status.textContent = `✕ ${msg}`; status.className = 'mtb-upload-status err'; };
  if(file.size > 1024 * 1024) return fail('File too large (max 1 MB)');
  status.textContent = 'Reading…';
  status.className = 'mtb-upload-status';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      customTables[S.tableIndex] = parseTableFile(file.name, e.target.result);
      saveCustomTables();
      render();
      showSaveIndicator('Custom table loaded');
    } catch(err) { fail(err.message); }
  };
  reader.onerror = () => fail('Could not read file');
  reader.readAsText(file);
}

function downloadTemplate() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = activeTable().map(m => [m.roll, q(m.name), q(m.cr), q(m.count || '1'), q(m.desc)].join(','));
  const url = URL.createObjectURL(new Blob(['roll,name,cr,count,desc\n' + rows.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `encounter-table-${TIER_NAMES[S.tableIndex].toLowerCase().replace(/\s+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════
// EVENTS — one delegated listener per event type; markup names actions with data-action/data-arg
// ══════════════════════════════════════════════════
const ACTIONS = {
  'advance':          () => advanceTurn(),
  'undo':             () => undoTurn(),
  'abandon':          () => abandonSession(),
  'defeat':           () => monsterDefeated(),
  'torch-toggle':     () => torchToggle(),
  'torch-reset':      () => commit(s => { s.torch = { left: TORCH_MS, endsAt: null }; }),
  'toggle-table':     () => { ui.tableOpen = !ui.tableOpen; render(); },
  'toggle-sound':     () => commit(s => { s.sound = !s.sound; }),
  'toggle-anim':      () => commit(s => { s.anim = !s.anim; }),
  'settings-open':    () => openSettings(),
  'settings-cancel':  () => cancelSettings(),
  'settings-save':    () => saveSettings(),
  'settings-backdrop':(arg, el, e) => { if(e.target === el) cancelSettings(); },
  'theme':            arg => commit(s => { s.theme = arg; }),
  'table':            arg => commit(s => { s.tableIndex = +arg; }),
  'preset':           arg => { ui.draft.die = 'd100'; ui.draft.threshold = Math.max(1, Math.round(DIE_SIDES.d100 * arg / 100)); render(); },
  'die':              arg => {
    const d = ui.draft, sides = DIE_SIDES[arg];
    d.threshold = Math.max(1, Math.min(sides, Math.round(d.threshold * sides / DIE_SIDES[d.die])));
    d.die = arg;
    render();
  },
  'download-template':() => downloadTemplate(),
  'reset-table':      () => { customTables[S.tableIndex] = null; saveCustomTables(); render(); showSaveIndicator('Built-in table restored'); },
  'party':            arg => commit(s => {
    s.party.size = Math.max(1, Math.min(MAX_PARTY, s.party.size + +arg));
    while(s.party.players.length < s.party.size) s.party.players.push(defaultPlayer(s.party.players.length));
  }),
  'xp-reset':         () => {
    if(!confirm('Reset all XP and levels?')) return;
    commit(s => { s.xpLog = []; s.party.players = s.party.players.map((_, i) => defaultPlayer(i)); });
  },
  'level':            arg => {
    const [i, delta] = arg.split(',').map(Number);
    commit(s => { const p = s.party.players[i]; p.level = Math.max(1, Math.min(20, p.level + delta)); p.xp = xpForLevel(p.level); });
  },
  'edit-name':        arg => startEditName(+arg),
};

// Input-type actions (sliders, file picker)
const INPUTS = {
  'volume':    el => commit(s => { s.volume = el.value / 100; }),
  'threshold': el => { ui.draft.threshold = parseInt(el.value); render(); },
  'upload':    el => { if(el.files[0]) loadTableFile(el.files[0]); el.value = ''; },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if(el && ACTIONS[el.dataset.action]) ACTIONS[el.dataset.action](el.dataset.arg, el, e);
});
for(const type of ['input', 'change']) document.addEventListener(type, e => {
  const fn = INPUTS[e.target.dataset?.action];
  if(fn && (type === 'change') === (e.target.type === 'file')) fn(e.target);
});

const dropZone = $('mtbDropZone');
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if(e.dataTransfer.files[0]) loadTableFile(e.dataTransfer.files[0]);
});

document.addEventListener('keydown', e => {
  if(e.target.dataset?.nameIdx !== undefined && e.key === 'Enter') { saveName(e.target); return; }
  if(e.key === 'Escape' && ui.settingsOpen)                        { closeSettings(); return; }
  // Let inputs (player names) and focused buttons keep Space/Enter/Ctrl+Z
  if(e.target.closest('input, textarea, select, button'))          return;
  if(e.key === 'z' && (e.ctrlKey || e.metaKey))                    { e.preventDefault(); undoTurn(); return; }
  if((e.code === 'Space' || e.code === 'Enter') && !ui.settingsOpen) { e.preventDefault(); advanceTurn(); }
});

// ══════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════
// Scripts sit at the end of <body>, so the DOM is ready: load before the first paint
const saved = load();
if(saved) { S = saved; save(); } // re-save in the current shape
render();
if(saved) showSaveIndicator('Session restored');
