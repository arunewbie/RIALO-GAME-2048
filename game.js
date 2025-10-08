// RIALO GAME 2048 MUMET LUR — Final clean version
// ✅ 2-phase move, ✅ stable rendering, ✅ no top-left flash on tile spawn

/************ DOM ************/
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

/************ State ************/
let N = 4;
let tiles = [];
let score = 0;
let best = 0;
let nextId = 1;
let undoStack = [];

const PAD = 12;
const GAP = 12;
let tileSizePx = 0;

const cfgKey = 'cfg-2048';
const stateKey = 'state-2048';
function storage(){ try{ return window.localStorage }catch{ return {getItem(){},setItem(){},removeItem(){}} } }
const LS = storage();
function keyBest(){ return `best-2048-${N}` }

/************ Utils ************/
function setTheme(dark){ document.documentElement.setAttribute('data-theme', dark? 'dark':'' ); themeToggle.checked=!!dark }
function beep(type='merge'){
  if(!soundToggle.checked) return;
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type='sine'; osc.frequency.value = type==='merge'? 620:220;
    gain.gain.value=.06; osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); setTimeout(()=>{osc.stop(); ctx.close()}, type==='merge'? 90:120);
  }catch{}
}
function vibrate(ms=20){ if(navigator.vibrate) navigator.vibrate(ms) }
function updateAnimSpeed(){ boardEl.style.setProperty('--anim', fastToggle.checked? '.04s':'.08s') }
function within(x,y){ return x>=0 && x<N && y>=0 && y<N }
function cellAt(x,y){ return tiles.find(t=>t.x===x && t.y===y) || null }
function emptyCells(){
  const occ=new Set(tiles.map(t=>t.y*N+t.x));
  const out=[];
  for(let y=0;y<N;y++) for(let x=0;x<N;x++) if(!occ.has(y*N+x)) out.push({x,y});
  return out;
}

/************ Layout & Render ************/
function computeTileSize(){
  const rect = boardEl.getBoundingClientRect();
  let s = (rect.width - PAD*2 - GAP*(N-1)) / N;
  if(!isFinite(s) || s<=0) s = 80;
  tileSizePx = s;
  boardEl.style.setProperty('--tile-size', s+'px');
}
function buildStaticGrid(){
  boardEl.innerHTML=''; boardEl.style.setProperty('--n', N);
  computeTileSize();
  for(let i=0;i<N*N;i++){ const cell=document.createElement('div'); cell.className='cell'; boardEl.appendChild(cell) }
}
function coordsToPx(x,y){ return { x: PAD + x*(tileSizePx+GAP), y: PAD + y*(tileSizePx+GAP) } }
function drawTiles(){
  if(!isFinite(tileSizePx)||tileSizePx<=0) computeTileSize();
  [...boardEl.querySelectorAll('.tile')].forEach(n=>n.remove());
  tiles.forEach(t=>{
    const d=document.createElement('div');
    d.className=`tile v${t.value} ${t.pop?'pop':''}`;
    const {x,y}=coordsToPx(t.x,t.y);
    d.style.transform=`translate3d(${x}px,${y}px,0)`;
    d.style.width=tileSizePx+'px';
    d.style.height=tileSizePx+'px';
    const inner=document.createElement('div');
    inner.className='tile-inner';
    inner.textContent=t.value;
    d.appendChild(inner);
    boardEl.appendChild(d);
    t.pop=false;
  });
}

/************ Persistence ************/
function persistCfg(){
  const cfg={N, dark:themeToggle.checked, sound:soundToggle.checked, hard:hardToggle.checked, fast:fastToggle.checked};
  LS.setItem(cfgKey, JSON.stringify(cfg));
}
function loadCfg(){
  try{
    const cfg=JSON.parse(LS.getItem(cfgKey)||'{}');
    if(cfg.N) N=cfg.N;
    sizeSel.value=String(N);
    themeToggle.checked=!!cfg.dark;
    soundToggle.checked = cfg.sound!==false;
    hardToggle.checked=!!cfg.hard;
    fastToggle.checked=!!cfg.fast;
    setTheme(themeToggle.checked); updateAnimSpeed();
  }catch{}
}
function persistState(){ LS.setItem(stateKey, JSON.stringify({N, tiles, score, nextId})) }
function tryResume(){
  try{
    const st=JSON.parse(LS.getItem(stateKey)||'null');
    if(!st) return false;
    N=st.N; tiles=st.tiles||[]; score=st.score||0; nextId=st.nextId||1; sizeSel.value=String(N);
    return true;
  }catch{ return false }
}

/************ Game Flow ************/
function addRandomTile(){
  const e=emptyCells();
  if(!e.length) return false;
  const spot=e[Math.floor(Math.random()*e.length)];
  const value=Math.random()<(hardToggle.checked?1:0.9)?2:4;
  const tile={id:nextId++, value, x:spot.x, y:spot.y, pop:true};
  tiles.push(tile);
  // spawn tile next frame after layout → no flash top-left
  requestAnimationFrame(() => { drawTiles(); });
  return true;
}
function saveUndo(){ undoStack.push({N, tiles:JSON.parse(JSON.stringify(tiles)), score, nextId}); if(undoStack.length>5) undoStack.shift() }
function restoreUndo(){
  const s=undoStack.pop(); if(!s) return;
  N=s.N; tiles=JSON.parse(JSON.stringify(s.tiles)); score=s.score; nextId=s.nextId;
  sizeSel.value=String(N);
  best=+LS.getItem(keyBest())||0; bestEl.textContent=best; scoreEl.textContent=score;
  buildStaticGrid(); drawTiles(); overlay.classList.remove('show'); persistState();
}
function movesAvailable(){
  if(emptyCells().length) return true;
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    const t=cellAt(x,y); if(!t) continue;
    const r=cellAt(x+1,y); if(r&&r.value===t.value) return true;
    const d=cellAt(x,y+1); if(d&&d.value===t.value) return true;
  }
  return false;
}
function showOverlay(msg){ overlayMsg.textContent=msg; overlay.classList.add('show') }
function checkEnd(){
  if(tiles.some(t=>t.value===2048)) showOverlay('🎉 You made 2048!');
  else if(!movesAvailable()) showOverlay('💀 Game Over — No moves left.');
}

/************ MOVE (2 PHASE) ************/
function move(dir){
  const V=[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}][dir];
  const xs=[...Array(N).keys()], ys=[...Array(N).keys()];
  if(V.x===1) xs.reverse();
  if(V.y===1) ys.reverse();

  saveUndo();
  tiles.forEach(t=>t.merged=false);

  // Phase 1: slide
  function farthest(x,y){
    let nx=x, ny=y;
    while(true){
      const px=nx+V.x, py=ny+V.y;
      if(!within(px,py)||cellAt(px,py)) break;
      nx=px; ny=py;
    }
    return {x:nx,y:ny};
  }
  let moved=false;
  for(const y of ys){
    for(const x of xs){
      const t=cellAt(x,y); if(!t) continue;
      const f=farthest(t.x,t.y);
      if(f.x!==t.x||f.y!==t.y){ t.x=f.x; t.y=f.y; moved=true; }
    }
  }

  // Phase 2: merge
  let gained=0;
  for(const y of ys){
    for(const x of xs){
      const t=cellAt(x,y); if(!t) continue;
      const nx=x+V.x, ny=y+V.y;
      const n=cellAt(nx,ny);
      if(n && !t.merged && !n.merged && t.value===n.value){
        n.value*=2; n.merged=true; n.pop=true; gained+=n.value;
        beep('merge'); vibrate(15);
        tiles=tiles.filter(k=>k.id!==t.id);
        moved=true;
      }
    }
  }
  tiles.forEach(t=>t.merged=false);

  if(moved){
    score+=gained; scoreEl.textContent=score;
    if(score>best){ best=score; bestEl.textContent=best; LS.setItem(keyBest(),best) }
    addRandomTile();
    requestAnimationFrame(()=>{ drawTiles(); persistState(); checkEnd(); });
  }else{
    boardEl.classList.remove('shake'); void boardEl.offsetWidth; boardEl.classList.add('shake'); beep('block');
  }
}

/************ Input ************/
window.addEventListener('keydown', (e)=>{
  const map={ArrowUp:0,KeyW:0,ArrowRight:1,KeyD:1,ArrowDown:2,KeyS:2,ArrowLeft:3,KeyA:3};
  const code=map[e.code];
  if(code===undefined) return;
  e.preventDefault();
  move(code);
},{passive:false});

let touchStart=null;
boardEl.addEventListener('touchstart', e=>{
  const t=e.changedTouches[0];
  touchStart={x:t.clientX,y:t.clientY,time:Date.now()};
},{passive:true});
boardEl.addEventListener('touchend', e=>{
  if(!touchStart) return;
  const t=e.changedTouches[0];
  const dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y;
  const adx=Math.abs(dx), ady=Math.abs(dy); const dt=Date.now()-touchStart.time;
  touchStart=null;
  if(Math.max(adx,ady)<20||dt>600) return;
  if(adx>ady) move(dx>0?1:3); else move(dy>0?2:0);
},{passive:true});

/************ Controls ************/
newBtn.addEventListener('click', ()=>{ tiles=[]; score=0; nextId=1; setup(true) });
undoBtn.addEventListener('click', ()=> restoreUndo());
resetBestBtn.addEventListener('click', ()=>{ LS.removeItem(keyBest()); best=0; bestEl.textContent=best });

sizeSel.addEventListener('change', ()=>{ N=+sizeSel.value; persistCfg(); tiles=[]; score=0; nextId=1; setup(true) });
themeToggle.addEventListener('change', ()=>{ setTheme(themeToggle.checked); persistCfg() });
soundToggle.addEventListener('change', ()=> persistCfg());
hardToggle.addEventListener('change', ()=> persistCfg());
fastToggle.addEventListener('change', ()=>{ updateAnimSpeed(); persistCfg() });

let rT; window.addEventListener('resize', ()=>{ clearTimeout(rT); rT=setTimeout(()=>{ buildStaticGrid(); drawTiles(); }, 80) });

/************ Init ************/
function setup(newBoard=false){
  overlay.classList.remove('show'); buildStaticGrid();
  if(newBoard||tiles.length===0){ tiles=[]; score=0; nextId=1; addRandomTile(); addRandomTile(); }
  best=+LS.getItem(keyBest())||0; bestEl.textContent=best; scoreEl.textContent=score;
  drawTiles(); persistState();
}
loadCfg();
if(!tryResume()){ addRandomTile(); addRandomTile() }
setup();
