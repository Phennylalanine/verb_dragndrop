const tableBody = document.getElementById('tableBody');
const tileBank = document.getElementById('tileBank');
const scoreEl = document.getElementById('score');
const resetBtn = document.getElementById('resetBtn');
const revealBtn = document.getElementById('revealBtn');
const csvInput = document.getElementById('csvInput');

let dataRows = [];
let placedCount = 0;

/* -------------------------------------------------------
   AUTO-DETECT CSV PATH (GitHub Pages compatible)
-------------------------------------------------------- */
async function loadDefaultCSV() {
  // Get full path like: https://user.github.io/repo/index.html
  let base = window.location.href;

  // Remove "index.html" (if present)
  base = base.replace(/index\.html?$/, "");

  // Construct final CSV path
  const csvURL = base + "words.csv";

  console.log("Loading CSV from:", csvURL);

  try {
    const res = await fetch(csvURL, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV not found");
    const text = await res.text();
    initFromCSV(text);
  } catch (e) {
    console.warn("Could not auto-load words.csv. Please upload manually.", e);
  }
}

/* -------------------------------------------------------
   CSV Upload (manual)
-------------------------------------------------------- */
csvInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  initFromCSV(text);
});

/* -------------------------------------------------------
   CSV Parser
-------------------------------------------------------- */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) return [];

  lines[0] = lines[0].replace(/^\ufeff/, ""); // remove BOM

  const header = lines[0].split(",");

  const iJP = header.indexOf("jpB");
  const iENB = header.indexOf("enB");
  const iENP = header.indexOf("enP");

  if (iJP === -1 || iENB === -1 || iENP === -1) {
    throw new Error("CSV header must be: jpB,enB,enP");
  }

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length >= 3) {
      rows.push({
        jpB: parts[iJP],
        enB: parts[iENB],
        enP: parts[iENP]
      });
    }
  }

  return rows;
}

function initFromCSV(text) {
  dataRows = parseCSV(text);
  buildBoard();
  buildTiles();
  updateScore();
}

/* -------------------------------------------------------
   Build Board (JP + Dropzones)
-------------------------------------------------------- */
function buildBoard() {
  tableBody.innerHTML = "";
  placedCount = 0;

  dataRows.forEach((row, i) => {
    const tr = document.createElement("tr");

    const jp = document.createElement("td");
    jp.className = "jp-cell";
    jp.textContent = row.jpB;
    tr.appendChild(jp);

    tr.appendChild(makeDropCell(i, "enB"));
    tr.appendChild(makeDropCell(i, "enP"));

    tableBody.appendChild(tr);
  });
}

function makeDropCell(row, kind) {
  const td = document.createElement("td");

  const dz = document.createElement("div");
  dz.className = "dropzone";
  dz.dataset.row = row;
  dz.dataset.kind = kind;

  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    dz.classList.add("hover");
  });

  dz.addEventListener("dragleave", () => dz.classList.remove("hover"));

  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("hover");

    const id = e.dataTransfer.getData("text/plain");
    const tile = document.getElementById(id);

    if (!tile) return;
    if (dz.querySelector(".tile")) return;

    const correct =
      tile.dataset.kind === kind &&
      tile.dataset.row === String(row);

    if (correct) {
      dz.appendChild(tile);
      placedCount++;
      updateScore();
      tile.classList.add("correct");
      tile.draggable = false;
    } else {
      tile.classList.add("wrong");
      setTimeout(() => {
        tile.classList.remove("wrong");
        tileBank.appendChild(tile);
      }, 300);
    }
  });

  td.appendChild(dz);
  return td;
}

/* -------------------------------------------------------
   Build Tiles (English words)
-------------------------------------------------------- */
function buildTiles() {
  tileBank.innerHTML = "";

  const tiles = [];

  dataRows.forEach((row, i) => {
    tiles.push({ txt: row.enB, kind: "enB", row: i });
    tiles.push({ txt: row.enP, kind: "enP", row: i });
  });

  tiles.sort(() => Math.random() - 0.5);

  tiles.forEach((t, i) => {
    const div = document.createElement("div");
    div.className = "tile";
    div.id = "tile-" + i;
    div.textContent = t.txt;
    div.draggable = true;
    div.dataset.kind = t.kind;
    div.dataset.row = t.row;

    div.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", div.id);
    });

    tileBank.appendChild(div);
  });
}

/* -------------------------------------------------------
   Score
-------------------------------------------------------- */
function updateScore() {
  const total = dataRows.length * 2;
  scoreEl.textContent = `${placedCount} / ${total}`;
}

/* -------------------------------------------------------
   Reset & Reveal
-------------------------------------------------------- */
resetBtn.addEventListener("click", () => {
  buildBoard();
  buildTiles();
  updateScore();
});

revealBtn.addEventListener("click", () => {
  document.querySelectorAll(".tile").forEach(tile => {
    const row = tile.dataset.row;
    const kind = tile.dataset.kind;
    const dz = document.querySelector(`.dropzone[data-row="${row}"][data-kind="${kind}"]`);

    if (dz && !dz.querySelector(".tile")) {
      dz.appendChild(tile);
      tile.classList.add("correct");
      tile.draggable = false;
    }
  });

  placedCount = dataRows.length * 2;
  updateScore();
});

/* -------------------------------------------------------
   Start
-------------------------------------------------------- */
loadDefaultCSV();
