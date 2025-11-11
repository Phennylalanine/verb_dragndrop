/****************************************************
 * Verb Match Game — Gamified (Option A SFX)
 * Features:
 *  - XP + Levels (persistent)
 *  - Combo streak (session)
 *  - Timer + Best Time (persistent)
 *  - Cute arcade SFX (embedded)
 *  - Auto-load words.csv from same path
 *  - No CSV upload UI
 ****************************************************/

// ---------- DOM ----------
const tableBody = document.getElementById('tableBody');
const tileBank = document.getElementById('tileBank');
const scoreEl = document.getElementById('score');
const resetBtn = document.getElementById('resetBtn');
const revealBtn = document.getElementById('revealBtn');

const levelDisplay = document.getElementById('levelDisplay');
const xpBar = document.getElementById('xpBar');
const xpText = document.getElementById('xpText');
const comboDisplay = document.getElementById('comboDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const bestTimeDisplay = document.getElementById('bestTimeDisplay');
const levelUpPopup = document.getElementById('levelUpPopup');

// ---------- Persistent Keys ----------
const LS_LEVEL = 'vm_level';
const LS_XP = 'vm_xp';
const LS_BEST = 'vm_bestTime';

// ---------- Game State ----------
let dataRows = [];          // [{jpB,enB,enP}, ...]
let placedCount = 0;
let totalSlots = 0;

// Session stats (not persisted)
let combo = 1;
let sessionStarted = false;
let startTimeMs = 0;
let timerInterval = null;

// Persistent stats (loaded/saved)
let level = 1;
let xp = 0;

// XP / Combo config (tweak freely)
const BASE_XP_PER_SLOT = 10;       // full XP for correct on first try
const PENALTY_MULTIPLIER = 0.5;    // if tile had a wrong try before correct
const COMBO_STEP = 1;              // combo increases by 1 each correct (first try)
const COMBO_BONUS_PER_X = 0.05;    // +5% XP per combo step (e.g., x4 = +15%)
const MAX_COMBO_BONUS_X = 10;      // cap combo counted in bonus

// ---------- SFX (Option A: cute arcade) ----------
const SFX = {
  correct: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAACAgICAAD///8AAP///wAA'), // tiny click
  wrong:   new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAP///8AAAD///8AAP///wAA'), // tiny buzz-ish
  levelup: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAP///8AAAAAAP///wAAAP///wAA'), // tiny chime
  finish:  new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAP///8A////AP///wAA////AA==')  // tiny ping
};
// Make them play without delay on first interaction (mobile friendly-ish)
Object.values(SFX).forEach(a => { a.volume = 0.7; });

// ---------- Init persistent ----------
function loadPersistent() {
  const L = parseInt(localStorage.getItem(LS_LEVEL), 10);
  const X = parseInt(localStorage.getItem(LS_XP), 10);
  const B = parseFloat(localStorage.getItem(LS_BEST));

  if (!isNaN(L) && L > 0) level = L;
  if (!isNaN(X) && X >= 0) xp = X;
  if (!isNaN(B) && B > 0) {
    bestTimeDisplay.textContent = formatSeconds(B);
  } else {
    bestTimeDisplay.textContent = '--';
  }
  updateHUD();
}

function savePersistent() {
  localStorage.setItem(LS_LEVEL, String(level));
  localStorage.setItem(LS_XP, String(xp));
}

// ---------- XP / Levels ----------
function xpToNextLevel(lv) {
  // Simple curve: grows moderately each level
  // Feel free to tweak
  return 100 + (lv - 1) * 50;
}

function addXP(amount) {
  xp += Math.max(0, Math.floor(amount));
  let leveled = false;
  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level++;
    leveled = true;
  }
  if (leveled) {
    showLevelUp();
    safePlay(SFX.levelup);
  }
  savePersistent();
  updateHUD();
}

function updateHUD() {
  levelDisplay.textContent = String(level);
  const need = xpToNextLevel(level);
  const pct = need ? Math.min(100, Math.round((xp / need) * 100)) : 0;
  xpBar.style.width = pct + '%';
  xpText.textContent = `${xp} / ${need}`;
  comboDisplay.textContent = 'x' + Math.max(1, combo);
}

function showLevelUp() {
  levelUpPopup.style.display = 'block';
  // Hide after 1.3s
  setTimeout(() => {
    levelUpPopup.style.display = 'none';
  }, 1300);
}

// ---------- Timer ----------
function startTimer() {
  if (sessionStarted) return;
  sessionStarted = true;
  startTimeMs = performance.now();
  timerInterval = setInterval(() => {
    const elapsed = (performance.now() - startTimeMs) / 1000;
    timerDisplay.textContent = formatSeconds(elapsed);
  }, 100);
}

function stopTimerAndMaybeSetBest() {
  if (!sessionStarted) return;
  clearInterval(timerInterval);
  timerInterval = null;
  const elapsed = (performance.now() - startTimeMs) / 1000;
  timerDisplay.textContent = formatSeconds(elapsed);

  // Update best time
  const prev = parseFloat(localStorage.getItem(LS_BEST));
  if (isNaN(prev) || elapsed < prev) {
    localStorage.setItem(LS_BEST, String(elapsed));
    bestTimeDisplay.textContent = formatSeconds(elapsed);
  }
}

function formatSeconds(s) {
  return s.toFixed(1) + 's';
}

// ---------- Audio helper ----------
function safePlay(aud) {
  try { aud.currentTime = 0; aud.play(); } catch (_) {}
}

// ---------- CSV Loading ----------
async function loadDefaultCSV() {
  let base = window.location.href;
  base = base.replace(/index\.html?$/, '');
  const csvURL = base + 'words.csv';
  try {
    const res = await fetch(csvURL, { cache: 'no-store' });
    if (!res.ok) throw new Error('CSV not found');
    const text = await res.text();
    initFromCSV(text);
  } catch (e) {
    console.warn('Could not load words.csv.', e);
  }
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  if (!lines.length) return [];
  lines[0] = lines[0].replace(/^\ufeff/, ''); // BOM

  const header = lines[0].split(',');
  const iJP = header.indexOf('jpB');
  const iENB = header.indexOf('enB');
  const iENP = header.indexOf('enP');
  if (iJP === -1 || iENB === -1 || iENP === -1) {
    throw new Error('CSV header must be: jpB,enB,enP');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln) continue;
    const p = ln.split(',');
    if (p.length < 3) continue;
    rows.push({ jpB: p[iJP], enB: p[iENB], enP: p[iENP] });
  }
  return rows;
}

function initFromCSV(text) {
  dataRows = parseCSV(text);
  buildBoard();
  buildTiles();
  placedCount = 0;
  totalSlots = dataRows.length * 2;
  updateScore();

  // Reset session stats
  combo = 1;
  updateHUD();
  timerDisplay.textContent = '0.0s';
  sessionStarted = false;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ---------- Build UI ----------
function buildBoard() {
  tableBody.innerHTML = '';
  dataRows.forEach((row, i) => {
    const tr = document.createElement('tr');

    const jp = document.createElement('td');
    jp.className = 'jp-cell';
    jp.textContent = row.jpB;
    tr.appendChild(jp);

    tr.appendChild(makeDropCell(i, 'enB'));
    tr.appendChild(makeDropCell(i, 'enP'));

    tableBody.appendChild(tr);
  });
}

function makeDropCell(row, kind) {
  const td = document.createElement('td');
  const dz = document.createElement('div');
  dz.className = 'dropzone';
  dz.dataset.row = String(row);
  dz.dataset.kind = kind;

  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    dz.classList.add('hover');
  });
  dz.addEventListener('dragleave', () => dz.classList.remove('hover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('hover');
    const tileId = e.dataTransfer.getData('text/plain');
    const tile = document.getElementById(tileId);
    if (!tile) return;

    // Start timer on first interaction
    startTimer();

    // Only one tile per cell
    if (dz.querySelector('.tile')) return;

    const correctKind = tile.dataset.kind === dz.dataset.kind;
    const correctRow = tile.dataset.row === dz.dataset.row;

    if (correctKind && correctRow) {
      dz.appendChild(tile);
      tile.classList.add('correct');
      tile.draggable = false;
      placedCount++;
      updateScore();

      // XP gain
      const missed = tile.dataset.missed === '1';
      const base = BASE_XP_PER_SLOT * (missed ? PENALTY_MULTIPLIER : 1);
      // Combo only grows on first-try correct
      if (!missed) combo = Math.min(MAX_COMBO_BONUS_X, combo + COMBO_STEP);
      const comboBonus = 1 + Math.min(combo - 1, MAX_COMBO_BONUS_X) * COMBO_BONUS_PER_X;
      addXP(base * comboBonus);

      updateHUD();
      safePlay(SFX.correct);

      // Finish condition
      if (placedCount >= totalSlots) {
        stopTimerAndMaybeSetBest();
        safePlay(SFX.finish);
      }
    } else {
      // Wrong -> mark tile as having missed once (reduces XP and resets combo)
      tile.classList.add('wrong');
      tile.dataset.missed = '1';
      combo = 1;
      updateHUD();
      safePlay(SFX.wrong);
      setTimeout(() => {
        tile.classList.remove('wrong');
        tileBank.appendChild(tile);
      }, 250);
    }
  });

  td.appendChild(dz);
  return td;
}

function buildTiles() {
  tileBank.innerHTML = '';
  const tiles = [];

  dataRows.forEach((row, i) => {
    tiles.push({ txt: row.enB, kind: 'enB', row: i });
    tiles.push({ txt: row.enP, kind: 'enP', row: i });
  });

  // Shuffle
  for (let j = tiles.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [tiles[j], tiles[k]] = [tiles[k], tiles[j]];
  }

  tiles.forEach((t, idx) => {
    const el = document.createElement('div');
    el.className = 'tile';
    el.id = 'tile-' + idx;
    el.textContent = t.txt;
    el.draggable = true;
    el.dataset.kind = t.kind;
    el.dataset.row = String(t.row);
    el.dataset.missed = '0'; // 0 until a wrong drop

    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', el.id);
      // timer can also start here just in case
      startTimer();
    });

    tileBank.appendChild(el);
  });
}

// ---------- Score / Controls ----------
function updateScore() {
  scoreEl.textContent = `${placedCount} / ${totalSlots}`;
}

resetBtn.addEventListener('click', () => {
  // Rebuild board and tiles, keep persistent stats (level/xp/best)
  buildBoard();
  buildTiles();
  placedCount = 0;
  totalSlots = dataRows.length * 2;
  updateScore();

  // Reset session stats
  combo = 1;
  updateHUD();

  // Reset timer
  sessionStarted = false;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerDisplay.textContent = '0.0s';
});

revealBtn.addEventListener('click', () => {
  // Place all tiles correctly (no XP, no combo changes)
  document.querySelectorAll('.tile').forEach(tile => {
    const row = tile.dataset.row;
    const kind = tile.dataset.kind;
    const dz = document.querySelector(`.dropzone[data-row="${row}"][data-kind="${kind}"]`);
    if (dz && !dz.querySelector('.tile')) {
      dz.appendChild(tile);
      tile.classList.add('correct');
      tile.draggable = false;
    }
  });
  placedCount = dataRows.length * 2;
  updateScore();

  // Stop timer, set best if appropriate (we'll not set best on reveal to keep it fair)
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  sessionStarted = false;
  // Do not update best time on reveal; just freeze timer display
});

// ---------- Boot ----------
loadPersistent();
loadDefaultCSV();
