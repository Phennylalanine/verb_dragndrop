/****************************************************
 * Verb Match Game — Leveled Hybrid Mode
 * L1-3: Click Mode
 * L4+: Drag Mode
 ****************************************************/

// ---------- DOM ----------
const verbPrompt = document.getElementById('verbPrompt');
const answerZone = document.getElementById('answerZone');
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

// ---------- Storage ----------
const LS_LEVEL = 'vm_level';
const LS_XP = 'vm_xp';
const LS_BEST = 'vm_bestTime';

// ---------- State ----------
let dataRows = [];
let rounds = [];
let roundIndex = 0;

let currentMode = 'click'; // click | drag
let placedCount = 0;

let combo = 1;
let sessionStarted = false;
let startTime = 0;
let timerInt = null;

let level = 1;
let xp = 0;

// ---------- Config ----------
const BASE_XP = 10;
const PENALTY = 0.5;
const COMBO_STEP = 1;
const COMBO_BONUS = 0.05;
const MAX_COMBO = 10;

// ---------- Audio ----------
const SFX = {
  correct: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAACAgICAAD///8AAP///wAA'),
  wrong: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAP///8AAAD///8AAP///wAA'),
  levelup: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAP///8AAAAAAP///wAAAP///wAA'),
  finish: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAABAAAABAACAgICAAP///8A////AP///wAA////AA==')
};

Object.values(SFX).forEach(a => a.volume = 0.7);

// ---------- Persistence ----------
function loadPersistent() {
  level = parseInt(localStorage.getItem(LS_LEVEL)) || 1;
  xp = parseInt(localStorage.getItem(LS_XP)) || 0;

  const best = parseFloat(localStorage.getItem(LS_BEST));
  bestTimeDisplay.textContent = best ? formatTime(best) : '--';

  updateHUD();
}

function savePersistent() {
  localStorage.setItem(LS_LEVEL, level);
  localStorage.setItem(LS_XP, xp);
}

// ---------- XP ----------
function xpToNext(lv) {
  return 100 + (lv - 1) * 50;
}

function addXP(v) {
  xp += Math.floor(v);

  let leveled = false;

  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    leveled = true;
  }

  if (leveled) {
    showLevelUp();
    play(SFX.levelup);
  }

  savePersistent();
  updateHUD();
}

function updateHUD() {
  levelDisplay.textContent = level;

  const need = xpToNext(level);
  const pct = Math.min(100, (xp / need) * 100);

  xpBar.style.width = pct + '%';
  xpText.textContent = `${xp} / ${need}`;
  comboDisplay.textContent = 'x' + combo;
}

// ---------- Timer ----------
function startTimer() {
  if (sessionStarted) return;

  sessionStarted = true;
  startTime = performance.now();

  timerInt = setInterval(() => {
    const t = (performance.now() - startTime) / 1000;
    timerDisplay.textContent = formatTime(t);
  }, 100);
}

function stopTimer() {
  if (!sessionStarted) return;

  clearInterval(timerInt);

  const t = (performance.now() - startTime) / 1000;

  const prev = parseFloat(localStorage.getItem(LS_BEST));

  if (!prev || t < prev) {
    localStorage.setItem(LS_BEST, t);
    bestTimeDisplay.textContent = formatTime(t);
  }
}

// ---------- Helpers ----------
function play(a) {
  try {
    a.currentTime = 0;
    a.play();
  } catch {}
}

function formatTime(t) {
  return t.toFixed(1) + 's';
}

// ---------- CSV ----------
async function loadCSV() {
  const base = location.href.replace(/index\.html?$/, '');
  const url = base + 'words.csv';

  const res = await fetch(url, { cache: 'no-store' });
  const txt = await res.text();

  init(parseCSV(txt));
}

function parseCSV(txt) {
  const lines = txt.split(/\r?\n/).map(l => l.trim());
  const h = lines[0].split(',');

  const jp = h.indexOf('jpB');
  const enB = h.indexOf('enB');
  const enP = h.indexOf('enP');

  const out = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;

    const p = lines[i].split(',');

    out.push({
      jp: p[jp],
      base: p[enB],
      past: p[enP]
    });
  }

  return out;
}

// ---------- Init ----------
function init(rows) {
  dataRows = rows;

  buildRounds();
  resetSession();
}

// ---------- Round Builder ----------
function buildRounds() {
  rounds = [];

  dataRows.forEach(r => {
    rounds.push({ row: r, type: 'base' });
    rounds.push({ row: r, type: 'past' });
  });

  shuffle(rounds);
}

// ---------- Session ----------
function resetSession() {
  roundIndex = 0;
  placedCount = 0;
  combo = 1;

  sessionStarted = false;
  clearInterval(timerInt);

  timerDisplay.textContent = '0.0s';

  currentMode = level <= 3 ? 'click' : 'drag';

  updateScore();
  updateHUD();

  nextRound();
}

// ---------- Game Flow ----------
function nextRound() {
  if (roundIndex >= rounds.length) {
    stopTimer();
    play(SFX.finish);
    return;
  }

  tileBank.innerHTML = '';
  answerZone.innerHTML = '';

  const r = rounds[roundIndex];

  const label = r.type === 'base'
    ? '現在形（Base）'
    : '過去形（Past）';

  verbPrompt.innerHTML = `
    <div class="jp-big">${r.row.jp}</div>
    <div class="jp-label">${label}</div>
  `;

  const options = buildOptions(r);

  options.forEach(makeTile);
}

// ---------- Options ----------
function buildOptions(r) {
  let pool = [];

  dataRows.forEach(x => {
    pool.push(x.base, x.past);
  });

  const correct = r.type === 'base'
    ? r.row.base
    : r.row.past;

  pool = pool.filter(x => x !== correct);

  shuffle(pool);

  const opts = [correct, ...pool.slice(0, 3)];

  return shuffle(opts);
}

// ---------- Tiles ----------
function makeTile(text) {
  const el = document.createElement('div');

  el.className = 'tile';
  el.textContent = text;
  el.dataset.missed = '0';

  // Click support
  el.addEventListener('click', () => {
    if (currentMode === 'click') checkAnswer(el);
  });

  // Drag support
  if (currentMode === 'drag') {
    el.draggable = true;

    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', text);
      startTimer();
    });
  }

  tileBank.appendChild(el);
}

// ---------- Drop ----------
answerZone.addEventListener('dragover', e => {
  if (currentMode === 'drag') e.preventDefault();
});

answerZone.addEventListener('drop', e => {
  if (currentMode !== 'drag') return;

  e.preventDefault();

  const txt = e.dataTransfer.getData('text/plain');
  checkAnswerByText(txt);
});

// ---------- Check ----------
function checkAnswer(tile) {
  checkAnswerByText(tile.textContent, tile);
}

function checkAnswerByText(txt, tileEl) {
  startTimer();

  const r = rounds[roundIndex];

  const correct = r.type === 'base'
    ? r.row.base
    : r.row.past;

  if (txt === correct) {
    if (tileEl) {
      tileEl.classList.add('correct');
      tileEl.style.pointerEvents = 'none';
    }

    placedCount++;
    updateScore();

    const missed = tileEl?.dataset.missed === '1';

    if (!missed)
      combo = Math.min(MAX_COMBO, combo + COMBO_STEP);

    const base = BASE_XP * (missed ? PENALTY : 1);
    const bonus = 1 + (combo - 1) * COMBO_BONUS;

    addXP(base * bonus);

    play(SFX.correct);

    roundIndex++;

    setTimeout(nextRound, 400);
  }
  else {
    if (tileEl) {
      tileEl.classList.add('wrong');
      tileEl.dataset.missed = '1';

      setTimeout(() => tileEl.classList.remove('wrong'), 250);
    }

    combo = 1;
    updateHUD();

    play(SFX.wrong);
  }
}

// ---------- Utils ----------
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function updateScore() {
  scoreEl.textContent = `${placedCount} / ${rounds.length}`;
}

function showLevelUp() {
  levelUpPopup.style.display = 'block';
  setTimeout(() => levelUpPopup.style.display = 'none', 1300);
}

// ---------- Controls ----------
resetBtn.addEventListener('click', resetSession);

// ---------- Boot ----------
loadPersistent();
loadCSV();
