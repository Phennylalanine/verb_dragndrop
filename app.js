const tableBody = document.getElementById('tableBody');
const tileBank = document.getElementById('tileBank');
const scoreEl = document.getElementById('score');
const resetBtn = document.getElementById('resetBtn');
const revealBtn = document.getElementById('revealBtn');
const csvInput = document.getElementById('csvInput');

let dataRows = [];
let placedCount = 0;

async function loadDefaultCSV(){
  try{
    const res = await fetch('words.csv', {cache: 'no-store'});
    if(!res.ok) throw new Error();
    const text = await res.text();
    initFromCSV(text);
  }catch(e){
    console.info("No default CSV found.");
  }
}

csvInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  initFromCSV(text);
});

function parseCSV(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  lines[0] = lines[0].replace(/^\ufeff/, '');

  const header = lines[0].split(',');
  const iJP = header.indexOf("jpB");
  const iENB = header.indexOf("enB");
  const iENP = header.indexOf("enP");

  if(iJP===-1 || iENB===-1 || iENP===-1)
    throw new Error("CSV must include jpB,enB,enP");

  const rows = [];
  for(let i=1;i<lines.length;i++){
    const p = lines[i].split(',');
    rows.push({ jpB:p[iJP], enB:p[iENB], enP:p[iENP] });
  }
  return rows;
}

function initFromCSV(text){
  dataRows = parseCSV(text);
  buildBoard();
  buildTiles();
  updateScore();
}

function buildBoard(){
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

function makeDropCell(row, kind){
  const td = document.createElement("td");
  const dz = document.createElement("div");
  dz.className = "dropzone";
  dz.dataset.row = row;
  dz.dataset.kind = kind;

  dz.addEventListener("dragover", e => {
    e.preventDefault();
    dz.classList.add("hover");
  });
  dz.addEventListener("dragleave", ()=>dz.classList.remove("hover"));

  dz.addEventListener("drop", e=>{
    e.preventDefault();
    dz.classList.remove("hover");

    const id = e.dataTransfer.getData("text/plain");
    const tile = document.getElementById(id);

    if(!tile) return;
    if(dz.querySelector(".tile")) return;

    const ok = tile.dataset.kind === kind && tile.dataset.row === String(row);
    if(ok){
      dz.appendChild(tile);
      placedCount++;
      updateScore();
      tile.classList.add("correct");
      tile.draggable = false;
    }else{
      tile.classList.add("wrong");
      setTimeout(()=>{
        tile.classList.remove("wrong");
        tileBank.appendChild(tile);
      },300);
    }
  });

  td.appendChild(dz);
  return td;
}

function buildTiles(){
  tileBank.innerHTML = "";
  const tiles = [];

  dataRows.forEach((r,i)=>{
    tiles.push({ txt:r.enB, kind:"enB", row:i });
    tiles.push({ txt:r.enP, kind:"enP", row:i });
  });

  tiles.sort(()=>Math.random()-0.5);

  tiles.forEach((t,idx)=>{
    const div = document.createElement("div");
    div.className = "tile";
    div.id = "tile-"+idx;
    div.textContent = t.txt;
    div.draggable = true;
    div.dataset.kind = t.kind;
    div.dataset.row = t.row;

    div.addEventListener("dragstart", e=>{
      e.dataTransfer.setData("text/plain", div.id);
    });

    tileBank.appendChild(div);
  });
}

function updateScore(){
  const total = dataRows.length * 2;
  scoreEl.textContent = `${placedCount} / ${total}`;
}

resetBtn.addEventListener("click", ()=>{
  buildBoard();
  buildTiles();
  updateScore();
});

revealBtn.addEventListener("click", ()=>{
  document.querySelectorAll(".tile").forEach(tile=>{
    const row = tile.dataset.row;
    const kind = tile.dataset.kind;
    const dz = document.querySelector(`.dropzone[data-row="${row}"][data-kind="${kind}"]`);
    if(dz && !dz.querySelector(".tile")){
      dz.appendChild(tile);
      tile.classList.add("correct");
      tile.draggable = false;
    }
  });
  placedCount = dataRows.length * 2;
  updateScore();
});

loadDefaultCSV();
