/****************************************************
 * Verb Match Game — Single Verb Mode
 * One verb at a time (JP shown, drag correct EN form)
 * Features preserved:
 *  - XP + Levels (persistent)
 *  - Combo streak
 *  - Timer + Best Time
 *  - SFX
 ****************************************************/

// ---------- DOM ----------
const verbPrompt = document.getElementById('verbPrompt'); // NEW: display current jpB
const answerZone = document.getElementById('answerZone'); // NEW: single dropzone
const tileBank = document.getElementById('tileBank');
const scoreEl = document.getElementById('score');
const resetBtn = document.getElementById('resetBtn');

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
let dataRows = [];
let currentIndex = 0;
let currentKind = 'enB'; // enB or enP
let placedCount = 0;

let combo = 1;
let sessionStarted = false;
let startTimeMs = 0;
let timerInterval = null;

let level = 1;
let xp = 0;

// ---------- Config ----------
const BASE_XP_PER_SLOT = 10;
const PENALTY_MULTIPLIER = 0.5;
const COMBO_STEP = 1;
const COMBO_BONUS_PER_X = 0.05;
const MAX_COMBO_BONUS_X = 10;

// ---------- SFX ----------
const SFX = {
  correct: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAACAgICAAD///8AAP///wAA'),
  wrong:   new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAP///8AAAD///8AAP///wAA'),
  levelup: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAP///8AAAAAAP///wAAAP///wAA'),
  finish:  new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAP///8A////AP///wAA////AA==')
};
Object.values(SFX).forEach(a => a.volume = 0.7);

// ---------- Persistent ----------
function loadPersistent() {
  const L = parseInt(localStorage.getItem(LS_LEVEL), 10);
  const X = parseInt(localStorage.getItem(LS_XP), 10);
  const B = parseFloat(localStorage.getItem(LS_BEST));

  if (!isNaN(L) && L > 0) level = L;
  if (!isNaN(X) && X >= 0) xp = X;

  if (!isNaN(B) && B > 0) bestTimeDisplay.textContent = formatSeconds(B);
  else bestTimeDisplay.textContent = '--';

  updateHUD();
}

function savePersistent() {
  localStorage.setItem(LS_LEVEL, String(level));
  localStorage.setItem(LS_XP, String(xp));
}

// ---------- XP ----------
function xpToNextLevel(lv) {
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
  const pct = Math.min(100, Math.round((xp / need) * 100));

  xpBar.style.width = pct + '%';
  xpText.textContent = `${xp} / ${need}`;
  comboDisplay.textContent = 'x' + Math.max(1, combo);
}

function showLevelUp() {
  levelUpPopup.style.display = 'block';
  setTimeout(() => levelUpPopup.style.display = 'none', 1300);
}

// ---------- Timer ----------
function startTimer() {
  if (sessionStarted) return;

  sessionStarted = true;
  startTimeMs = performance.now();

  timerInterval = setInterval(() => {
    const t = (performance.now() - startTimeMs) / 1000;
    timerDisplay.textContent = formatSeconds(t);
  }, 100);
}

function stopTimerAndMaybeSetBest() {
  if (!sessionStarted) return;

  clearInterval(timerInterval);
  timerInterval = null;

  const t = (performance.now() - startTimeMs) / 1000;
  timerDisplay.textContent = formatSeconds(t);

  const prev = parseFloat(localStorage.getItem(LS_BEST));

  if (isNaN(prev) || t < prev) {
    localStorage.setItem(LS_BEST, String(t));
    bestTimeDisplay.textContent = formatSeconds(t);
  }
}

function formatSeconds(s) {
  return s.toFixed(1) + 's';
}

// ---------- Audio ----------
function safePlay(a) {
  try {
    a.currentTime = 0;
    a.play();
  } catch {}
}

// ---------- CSV ----------
async function loadDefaultCSV() {
  let base = window.location.href.replace(/index\.html?$/, '');
  const csvURL = base + 'words.csv';

  try {
    const res = await fetch(csvURL, { cache: 'no-store' });
    if (!res.ok) throw new Error();

    const txt = await res.text();
    initFromCSV(txt);
  } catch {
    console.warn('Could not load words.csv');
  }
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  if (!lines.length) return [];

  lines[0] = lines[0].replace(/^\ufeff/, '');

  const h = lines[0].split(',');
  const iJP = h.indexOf('jpB');
  const iENB = h.indexOf('enB');
  const iENP = h.indexOf('enP');

  if (iJP < 0 || iENB < 0 || iENP < 0)
    throw new Error('Header must be jpB,enB,enP');

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;

    const p = lines[i].split(',');
    if (p.length < 3) continue;

    rows.push({
      jpB: p[iJP],
      enB: p[iENB],
      enP: p[iENP]
    });
  }

  return rows;
}

function initFromCSV(text) {
  dataRows = parseCSV(text);

  currentIndex = 0;
  placedCount = 0;

  combo = 1;
  sessionStarted = false;

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerDisplay.textContent = '0.0s';

  nextRound();
  updateScore();
  updateHUD();
}

// ---------- Game Logic ----------
function nextRound() {
  if (currentIndex >= dataRows.length * 2) {
    stopTimerAndMaybeSetBest();
    safePlay(SFX.finish);
    return;
  }

  tileBank.innerHTML = '';
  answerZone.innerHTML = '';

  const row = dataRows[Math.floor(currentIndex / 2)];

  currentKind = currentIndex % 2 === 0 ? 'enB' : 'enP';

  verbPrompt.textContent = row.jpB + ' (' + (currentKind === 'enB' ? 'Base' : 'Past') + ')';

  const options = shuffle([
    row.enB,
    row.enP,
    ...getRandomDistractors(row)
  ]).slice(0, 4);

  options.forEach((txt, i) => createTile(txt, i));
}

function getRandomDistractors(currentRow) {
  const pool = dataRows.filter(r => r !== currentRow);
  shuffle(pool);

  const out = [];

  for (let i = 0; i < pool.length && out.length < 2; i++) {
    out.push(pool[i].enB, pool[i].enP);
  }

  return out;
}

function createTile(text, i) {
  const el = document.createElement('div');

  el.className = 'tile';
  el.id = 'tile-' + i;
  el.textContent = text;
  el.draggable = true;
  el.dataset.missed = '0';

  el.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', el.id);
    startTimer();
  });

  tileBank.appendChild(el);
}

// ---------- Dropzone ----------
answerZone.addEventListener('dragover', e => {
  e.preventDefault();
  answerZone.classList.add('hover');
});

answerZone.addEventListener('dragleave', () => {
  answerZone.classList.remove('hover');
});

answerZone.addEventListener('drop', e => {
  e.preventDefault();
  answerZone.classList.remove('hover');

  if (answerZone.querySelector('.tile')) return;

  const id = e.dataTransfer.getData('text/plain');
  const tile = document.getElementById(id);
  if (!tile) return;

  startTimer();

  const row = dataRows[Math.floor(currentIndex / 2)];
  const correct = currentKind === 'enB' ? row.enB : row.enP;

  if (tile.textContent === correct) {
    answerZone.appendChild(tile);
    tile.classList.add('correct');
    tile.draggable = false;

    placedCount++;
    updateScore();

    const missed = tile.dataset.missed === '1';
    const base = BASE_XP_PER_SLOT * (missed ? PENALTY_MULTIPLIER : 1);

    if (!missed)
      combo = Math.min(MAX_COMBO_BONUS_X, combo + COMBO_STEP);

    const bonus = 1 + Math.min(combo - 1, MAX_COMBO_BONUS_X) * COMBO_BONUS_PER_X;

    addXP(base * bonus);

    safePlay(SFX.correct);

    currentIndex++;

    setTimeout(nextRound, 400);
  }
  else {
    tile.classList.add('wrong');
    tile.dataset.missed = '1';

    combo = 1;
    updateHUD();

    safePlay(SFX.wrong);

    setTimeout(() => tile.classList.remove('wrong'), 250);
  }
});

// ---------- Utils ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function updateScore() {
  const total = dataRows.length * 2;
  scoreEl.textContent = `${placedCount} / ${total}`;
}

// ---------- Controls ----------
resetBtn.addEventListener('click', () => {
  currentIndex = 0;
  placedCount = 0;
  combo = 1;

  sessionStarted = false;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;

  timerDisplay.textContent = '0.0s';

  updateHUD();
  updateScore();

  nextRound();
});

// ---------- Boot ----------
loadPersistent();
loadDefaultCSV();
