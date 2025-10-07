// RIALO GAME 2048 MUMET LUR — full logic (no external libs)
const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl  = document.getElementById('best');
const newBtn  = document.getElementById('newBtn');
const undoBtn = document.getElementById('undoBtn');
const resetBestBtn = document.getElementById('resetBestBtn');
const sizeSel = document.getElementById('sizeSel');
const themeToggle = document.getElementById('themeToggle');
const soundToggle = document.getElementById('soundToggle');
const hardToggle = document.getElementById('hardToggle');
const fastToggle = document.getElementById('fastToggle');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlayMsg');

let N = 4;
let tiles = []; // {id,value,x,y, merged:false,pop?:bool}
let score = 0; let best = 0; let nextId = 1;
let undoStack = []; // up to 5 states

const cfgKey = 'cfg-2048';
const stateKey = 'state-2048';

function storage(){ try{ return window.localStorage }catch{ return {getItem(){},setItem(){},removeItem(){}} } }
const LS = storage();
function keyBest(){ return `best-2048-${N}` }

function setTheme(dark){ document.documentElement.setAttribute('data-theme', dark? 'dark':'' ); themeToggle.checked=!!dark }
function beep(type='merge'){
  if(!soundToggle.checked) return;
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = type==='merge'? 620 : 220;
    gain.gain.value = 0.06; osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); setTimeout(()=>{osc.stop(); ctx.close()}, type==='merge'? 90:120);
  }catch{}
}
function vibrate(ms=20){ if(navigator.vibrate) navigator.vibrate(ms) }
function updateAnimSpeed(){ boardEl.style.setProperty('--anim', fastToggle.checked? '.04s':'.08s') }

function buildStaticGrid(){
  boardEl.innerHTML=''; boardEl.style.setProperty('--n', N);
  const gap=12, pad=12; const rect=boardEl.getBoundingClientRect();
  const cellSize = (rect.width - pad*2 - gap*(N-1)) / N;
  boardEl.style.setProperty('--tile-size', cellSize + 'px');
  for(let i=0;i<N*N;i++){ const cell=document.createElement('div'); cell.className='cell'; boardEl.appendChild(cell) }
}
function coordsToPx(x,y){
  const gap=12, pad=12;
  const sizePx=parseFloat(getComputedStyle(boardEl).getPropertyValue('--tile-size'));
  const pxX=pad + x*(sizePx+gap);
  const pxY=pad + y*(sizePx+gap);
  return {x:pxX+'px', y:pxY+'px'};
}
function drawTiles(){
  [...boardEl.querySelectorAll('.tile')].forEach(n=>n.remove());
  tiles.forEach(t=>{
    const d=document.createElement('div');
    d.className=`tile v${t.value} ${t.pop?'pop':''}`;
    const {x,y}=coordsToPx(t.x,t.y);
    d.style.setProperty('--x',x);
    d.style.setProperty('--y',y);
    const inner=document.createElement('div'); inner.className='tile-inner'; inner.textContent=t.value;
    d.appendChild(inner); boardEl.appendChild(d); t.pop=false;
  });
}
function emptyCells(){
  const occ=new Set(tiles.map(t=>t.y*N+t.x));
  const out=[];
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    const idx=y*N+x; if(!occ.has(idx)) out.push({x,y});
  }
  return out;
}
function addRandomTile(){
  const empties=emptyCells(); if(!empties.length) return false;
  const spot=empties[Math.floor(Math.random()*empties.length)];
  const value = Math.random() < (hardToggle.checked? 1:0.9) ? 2 : 4;
  tiles.push({id:nextId++, value, x:spot.x, y:spot.y, pop:true});
  return true;
}
function cellContent(x,y){ return tiles.find(t=>t.x===x && t.y===y) || null }

function within(x,y){ return x>=0 && x<N && y>=0 && y<N }
function vectorFor(dir){ return [ {x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0} ][dir] }
function buildTraversal(dir){
  const xs=[...Array(N).keys()], ys=[...Array(N).keys()];
  const v=vectorFor(dir); if(v.x===1) xs.reverse(); if(v.y===1) ys.reverse();
  return {xs,ys};
}
function saveUndo(){
  const snap={N, tiles:JSON.parse(JSON.stringify(tiles)), score, nextId};
  undoStack.push(snap); if(undoStack.length>5) undoStack.shift();
}
function restoreUndo(){
  const snap=undoStack.pop(); if(!snap) return;
  N=snap.N; tiles=JSON.parse(JSON.stringify(snap.tiles)); score=snap.score; nextId=snap.nextId;
  sizeSel.value=String(N); best = +LS.getItem(keyBest())||0; bestEl.textContent=best; scoreEl.textContent=score;
  buildStaticGrid(); drawTiles(); overlay.classList.remove('show'); persistState();
}

function move(dir){
  saveUndo(); let moved=false; let gained=0;
  const {xs,ys}=buildTraversal(dir); const v=vectorFor(dir);
  tiles.forEach(t=>t.merged=false);
  for(const y of ys){
    for(const x of xs){
      const tile=cellContent(x,y); if(!tile) continue; let nx=tile.x, ny=tile.y;
      while(true){
        const px=nx+v.x, py=ny+v.y; if(!within(px,py)) break;
        const next=cellContent(px,py);
        if(next){
          if(!next.merged && !tile.merged && next.value===tile.value){
            next.value*=2; next.merged=true; gained+=next.value; beep('merge'); vibrate(15);
            tiles = tiles.filter(t=>t.id!==tile.id);
            tile.x=px; tile.y=py; moved=true; next.pop=true;
          }
          break;
        } else { nx=px; ny=py; }
      }
      if(nx!==tile.x||ny!==tile.y){ tile.x=nx; tile.y=ny; moved=true }
    }
  }
  if(moved){
    score+=gained; scoreEl.textContent=score;
    if(score>best){ best=score; LS.setItem(keyBest(),best); bestEl.textContent=best }
    addRandomTile(); drawTiles(); persistState(); checkEnd();
  } else {
    boardEl.classList.remove('shake'); void boardEl.offsetWidth; boardEl.classList.add('shake'); beep('block');
  }
}
function movesAvailable(){
  if(emptyCells().length) return true;
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    const t=cellContent(x,y); if(!t) continue;
    const r=cellContent(x+1,y); if(r&&r.value===t.value) return true;
    const d=cellContent(x,y+1); if(d&&d.value===t.value) return true;
  }
  return false;
}
function checkEnd(){
  if(tiles.some(t=>t.value===2048)){
    showOverlay('🎉 You made 2048! Keep going or start a new game.');
  } else if(!movesAvailable()){
    showOverlay('💀 Game Over — No moves left.');
  }
}
function showOverlay(msg){ overlayMsg.textContent=msg; overlay.classList.add('show') }
overlay.addEventListener('click', ()=> overlay.classList.remove('show'))

function persistCfg(){ const cfg={N, dark:themeToggle.checked, sound:soundToggle.checked, hard:hardToggle.checked, fast:fastToggle.checked}; LS.setItem(cfgKey, JSON.stringify(cfg)) }
function loadCfg(){
  try{
    const cfg=JSON.parse(LS.getItem(cfgKey)||'{}');
    if(cfg.N) N=cfg.N; sizeSel.value=String(N);
    themeToggle.checked=!!cfg.dark;
    soundToggle.checked = cfg.sound!==false;
    hardToggle.checked=!!cfg.hard;
    fastToggle.checked=!!cfg.fast;
    setTheme(themeToggle.checked); updateAnimSpeed();
  }catch{}
}
function persistState(){ const st={N, tiles, score, nextId}; LS.setItem(stateKey, JSON.stringify(st)) }
function tryResume(){
  try{
    const st=JSON.parse(LS.getItem(stateKey)||'null'); if(!st) return false;
    N=st.N; tiles=st.tiles||[]; score=st.score||0; nextId=st.nextId||1; sizeSel.value=String(N);
    return true;
  }catch{ return false }
}

function setup(newBoard=false){
  undoStack.length=0; overlay.classList.remove('show');
  buildStaticGrid();
  if(newBoard || tiles.length===0){ tiles=[]; score=0; nextId=1; addRandomTile(); addRandomTile(); }
  best=+LS.getItem(keyBest())||0; bestEl.textContent=best; scoreEl.textContent=score;
  drawTiles(); persistState();
}

window.addEventListener('keydown', (e)=>{
  const map={ArrowUp:0,KeyW:0,ArrowRight:1,KeyD:1,ArrowDown:2,KeyS:2,ArrowLeft:3,KeyA:3};
  const code=map[e.code]; if(code===undefined) return; e.preventDefault(); move(code);
}, {passive:false});

let touchStart=null;
boardEl.addEventListener('touchstart', e=>{
  const t=e.changedTouches[0]; touchStart={x:t.clientX,y:t.clientY,time:Date.now()};
}, {passive:true});
boardEl.addEventListener('touchend', e=>{
  if(!touchStart) return; const t=e.changedTouches[0];
  const dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y;
  const adx=Math.abs(dx), ady=Math.abs(dy); const dt=Date.now()-touchStart.time; touchStart=null;
  if(Math.max(adx,ady)<20||dt>600) return;
  if(adx>ady) move(dx>0?1:3); else move(dy>0?2:0);
}, {passive:true});

newBtn.addEventListener('click', ()=>{ tiles=[]; score=0; nextId=1; setup(true) });
undoBtn.addEventListener('click', ()=> restoreUndo());
resetBestBtn.addEventListener('click', ()=>{ LS.removeItem(keyBest()); best=0; bestEl.textContent=best });

sizeSel.addEventListener('change', ()=>{ N=+sizeSel.value; persistCfg(); tiles=[]; score=0; nextId=1; setup(true) });
themeToggle.addEventListener('change', ()=>{ setTheme(themeToggle.checked); persistCfg() });
soundToggle.addEventListener('change', ()=> persistCfg());
hardToggle.addEventListener('change', ()=> persistCfg());
fastToggle.addEventListener('change', ()=>{ updateAnimSpeed(); persistCfg() });

let rT; window.addEventListener('resize', ()=>{ clearTimeout(rT); rT=setTimeout(()=>{ buildStaticGrid(); drawTiles(); }, 80) });

// Init
loadCfg();
if(!tryResume()){ addRandomTile(); addRandomTile() }
setup();
