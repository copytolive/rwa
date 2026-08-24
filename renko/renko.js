(()=>{
'use strict';
if(window.RWARenko)return;

const API='https://data-api.binance.vision';
const WS='wss://data-stream.binance.vision/ws';
const STORE='rwa_renko_traditional_v1';
const EXCLUDED_BASES=new Set(['USDT','USDC','FDUSD','TUSD','USDP','DAI','BUSD','EUR','GBP','TRY','BRL','AUD','RUB','UAH','NGN','ZAR','PLN','RON','ARS','CZK','MXN','JPY','IDR','AED']);
const FALLBACK=['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','DOTUSDT','LTCUSDT','BCHUSDT','TRXUSDT','SUIUSDT','APTUSDT','NEARUSDT','ATOMUSDT','FILUSDT','UNIUSDT','AAVEUSDT','ETCUSDT','HBARUSDT','ICPUSDT','ARBUSDT','OPUSDT','INJUSDT','TIAUSDT','SEIUSDT','RENDERUSDT','PEPEUSDT'];
const $=id=>document.getElementById(id);
const state={symbols:[],selected:'BTCUSDT',box:100,boxManual:false,bricks:[],historyTicks:[],tickCount:0,lastPrice:NaN,lastTickTime:0,lastTradeId:null,lastClose:NaN,direction:0,anchor:NaN,visible:120,pan:0,ws:null,wsToken:0,retry:0,retryTimer:0,renderPending:false,renderSlice:null,drag:null};

function loadPrefs(){try{const p=JSON.parse(localStorage.getItem(STORE)||'{}');if(typeof p.selected==='string')state.selected=p.selected;if(Number.isFinite(Number(p.visible)))state.visible=Math.max(20,Math.min(300,Number(p.visible)));state.savedBoxes=p.boxes&&typeof p.boxes==='object'?p.boxes:{};}catch{state.savedBoxes={}}}
function savePrefs(){try{localStorage.setItem(STORE,JSON.stringify({selected:state.selected,visible:state.visible,boxes:state.savedBoxes||{}}))}catch{}}
function base(sym=state.selected){return String(sym).replace(/USDT$/,'')}
function fmt(v){const n=Number(v);if(!Number.isFinite(n))return '—';const a=Math.abs(n);let d=a>=1000?2:a>=100?3:a>=1?4:a>=.01?6:8;return n.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:d})}
function fmtInput(v){const n=Number(v);if(!Number.isFinite(n))return '';const a=Math.abs(n);const d=a>=100?2:a>=1?4:a>=.01?6:8;return n.toFixed(d).replace(/0+$/,'').replace(/\.$/,'')}
function niceNumber(x){if(!(x>0))return 1;const e=Math.floor(Math.log10(x));const f=x/10**e;const m=f<=1?1:f<=2?2:f<=5?5:10;return m*10**e}
function setFeed(kind,text){const e=$('feedPill');if(!e)return;e.className='feed-pill'+(kind?` ${kind}`:'');e.querySelector('b').textContent=text}
function withTimeout(url,ms=9000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return fetch(url,{cache:'no-store',signal:c.signal}).finally(()=>clearTimeout(t))}

async function loadSymbols(){
  let symbols=[];
  try{
    const r=await withTimeout(`${API}/api/v3/exchangeInfo`,10000);if(!r.ok)throw Error(`HTTP ${r.status}`);
    const j=await r.json();
    symbols=(j.symbols||[]).filter(x=>x.quoteAsset==='USDT'&&x.status==='TRADING'&&x.isSpotTradingAllowed!==false&&!EXCLUDED_BASES.has(x.baseAsset)).map(x=>x.symbol).sort();
  }catch(e){console.warn('Renko pair universe fallback',e);symbols=[...FALLBACK]}
  state.symbols=symbols.length?symbols:[...FALLBACK];
  if(!state.symbols.includes(state.selected))state.selected=state.symbols.includes('BTCUSDT')?'BTCUSDT':state.symbols[0];
  $('pairTotal').textContent=`${state.symbols.length} pairs`;renderPairs();
}

function renderPairs(){
  const q=String($('pairSearch')?.value||'').trim().toUpperCase();
  const a=state.symbols.filter(s=>!q||s.includes(q)).slice(0,220);
  const box=$('pairList');if(!box)return;const f=document.createDocumentFragment();
  for(const sym of a){const b=base(sym),row=document.createElement('div');row.className='pair-row'+(sym===state.selected?' active':'');row.dataset.symbol=sym;row.innerHTML=`<div class="left-meta"><span class="mini-icon">${b.slice(0,2)}</span><span><b>${b} / USDT</b><small>Raw tick Renko</small></span></div><span class="tag">CRYPTO</span>`;row.onclick=()=>selectSymbol(sym);f.appendChild(row)}
  box.replaceChildren(f);if(!a.length)box.innerHTML='<div class="empty">No crypto pair matches.</div>';
}

function resetEngine(){state.bricks=[];state.tickCount=0;state.lastPrice=NaN;state.lastTickTime=0;state.lastTradeId=null;state.lastClose=NaN;state.direction=0;state.anchor=NaN;state.pan=0}
function addBrick(open,close,direction,tick){state.bricks.push({i:state.bricks.length+1,open,close,high:Math.max(open,close),low:Math.min(open,close),direction,time:Number(tick.time||Date.now()),tradeId:tick.id??null});if(state.bricks.length>12000){state.bricks.splice(0,2000);for(let i=0;i<state.bricks.length;i++)state.bricks[i].i=i+1}state.lastClose=close;state.direction=direction}
function applyTick(tick,count=true){
  const p=Number(tick.price);if(!Number.isFinite(p)||!(state.box>0))return;
  const id=tick.id==null?null:Number(tick.id);if(id!=null&&Number.isFinite(id)&&state.lastTradeId!=null&&id<=state.lastTradeId)return;
  if(id!=null&&Number.isFinite(id))state.lastTradeId=id;
  state.lastPrice=p;state.lastTickTime=Number(tick.time||Date.now());if(count)state.tickCount++;
  if(!Number.isFinite(state.anchor)){state.anchor=Math.floor(p/state.box)*state.box;state.lastClose=state.anchor}
  let guard=0;
  while(guard++<5000){
    if(state.direction===0){
      if(p>=state.lastClose+state.box){addBrick(state.lastClose,state.lastClose+state.box,1,tick);continue}
      if(p<=state.lastClose-state.box){addBrick(state.lastClose,state.lastClose-state.box,-1,tick);continue}
      break;
    }
    if(state.direction===1){
      if(p>=state.lastClose+state.box){addBrick(state.lastClose,state.lastClose+state.box,1,tick);continue}
      if(p<=state.lastClose-2*state.box){addBrick(state.lastClose-state.box,state.lastClose-2*state.box,-1,tick);continue}
      break;
    }
    if(p<=state.lastClose-state.box){addBrick(state.lastClose,state.lastClose-state.box,-1,tick);continue}
    if(p>=state.lastClose+2*state.box){addBrick(state.lastClose+state.box,state.lastClose+2*state.box,1,tick);continue}
    break;
  }
  if(guard>=5000)console.warn('Renko guard reached; check brick size');
}

function rebuild(){
  const ticks=state.historyTicks.slice();const oldBox=state.box;resetEngine();state.box=oldBox;
  for(const t of ticks)applyTick(t,true);
  $('brickValue').textContent=fmt(state.box);$('brickSize').value=fmtInput(state.box);updateStats();scheduleDraw();
}

function suggestedBox(ticks){
  if(!ticks.length)return 1;const prices=ticks.map(x=>Number(x.price)).filter(Number.isFinite);if(!prices.length)return 1;
  const last=prices.at(-1),hi=Math.max(...prices),lo=Math.min(...prices),range=hi-lo;
  return niceNumber(Math.max(range/22,last*.00018,Number.EPSILON));
}

async function loadHistory(symbol){
  setFeed('','LOADING');$('historyState').textContent='Loading 1,000 raw trades…';$('chartEmpty').classList.remove('hide');
  let ticks=[];
  try{
    const r=await withTimeout(`${API}/api/v3/trades?symbol=${encodeURIComponent(symbol)}&limit=1000`,10000);if(!r.ok)throw Error(`HTTP ${r.status}`);const j=await r.json();
    ticks=(Array.isArray(j)?j:[]).map(x=>({id:Number(x.id),price:Number(x.price),qty:Number(x.qty),time:Number(x.time)})).filter(x=>Number.isFinite(x.price)&&Number.isFinite(x.time)).sort((a,b)=>(a.id-b.id)||(a.time-b.time));
  }catch(e){$('historyState').textContent=`Warmup unavailable · ${e.message}`;console.warn('Renko raw trade warmup',e)}
  if(symbol!==state.selected)return;
  state.historyTicks=ticks;
  const saved=Number(state.savedBoxes?.[symbol]);if(saved>0)state.box=saved;else if(ticks.length)state.box=suggestedBox(ticks);
  rebuild();
  $('historyState').textContent=ticks.length?`${ticks.length.toLocaleString()} raw trades loaded`:'Live ticks only · history unavailable';
  connectLive(symbol);
}

function closeLive(){state.wsToken++;clearTimeout(state.retryTimer);state.retryTimer=0;if(state.ws){try{state.ws.onclose=null;state.ws.close()}catch{}state.ws=null}}
function connectLive(symbol){
  closeLive();const token=state.wsToken;setFeed('','CONNECTING');const url=`${WS}/${symbol.toLowerCase()}@trade`;let ws;
  try{ws=new WebSocket(url)}catch(e){scheduleReconnect(symbol,token);return}
  state.ws=ws;
  ws.onopen=()=>{if(token!==state.wsToken)return;state.retry=0;setFeed('live','LIVE TICKS')};
  ws.onmessage=e=>{if(token!==state.wsToken)return;let x;try{x=JSON.parse(e.data)}catch{return}if(x.e!=='trade'||x.s!==symbol)return;applyTick({id:Number(x.t),price:Number(x.p),qty:Number(x.q),time:Number(x.T)},true);scheduleDraw()};
  ws.onerror=()=>{if(token===state.wsToken)setFeed('bad','FEED ERROR')};
  ws.onclose=()=>{if(token!==state.wsToken)return;setFeed('','RECONNECTING');scheduleReconnect(symbol,token)};
}
function scheduleReconnect(symbol,token){if(token!==state.wsToken)return;clearTimeout(state.retryTimer);const delay=Math.min(15000,800*2**Math.min(state.retry++,5));state.retryTimer=setTimeout(()=>{if(token===state.wsToken&&symbol===state.selected)connectLive(symbol)},delay)}

async function selectSymbol(symbol){
  if(!state.symbols.includes(symbol))return;state.selected=symbol;savePrefs();renderPairs();
  const b=base();$('pairName').textContent=`${b} / USDT`;$('pairIcon').textContent=b.slice(0,2);$('sourceText').textContent='Binance raw trade stream · @trade';
  state.historyTicks=[];resetEngine();updateStats();scheduleDraw();
  document.querySelector('.markets')?.classList.remove('open');await loadHistory(symbol);
}

function thresholds(){if(!Number.isFinite(state.lastClose)||!(state.box>0))return {up:NaN,down:NaN};if(state.direction===1)return{up:state.lastClose+state.box,down:state.lastClose-2*state.box};if(state.direction===-1)return{up:state.lastClose+2*state.box,down:state.lastClose-state.box};return{up:state.lastClose+state.box,down:state.lastClose-state.box}}
function updateStats(){
  $('lastPrice').textContent=fmt(state.lastPrice);$('brickValue').textContent=fmt(state.box);$('brickCount').textContent=state.bricks.length.toLocaleString();$('tickCount').textContent=state.tickCount.toLocaleString();$('visibleValue').textContent=state.visible;
  const t=thresholds();$('nextUp').textContent=fmt(t.up);$('nextDown').textContent=fmt(t.down);$('chartEmpty').classList.toggle('hide',state.tickCount>0||state.bricks.length>0);
}

function scheduleDraw(){if(state.renderPending)return;state.renderPending=true;requestAnimationFrame(()=>{state.renderPending=false;draw();updateStats()})}
function canvasSize(){const c=$('renkoCanvas'),r=c.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d)}const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);return{c,x,w,h,d}}
function sliceBricks(){const n=state.bricks.length,end=Math.max(0,n-state.pan),start=Math.max(0,end-state.visible);return{start,end,a:state.bricks.slice(start,end)}}
function draw(){
  const {x,w,h}=canvasSize();x.clearRect(0,0,w,h);x.fillStyle='#080b0f';x.fillRect(0,0,w,h);
  const pad={l:10,r:72,t:18,b:28},cw=Math.max(1,w-pad.l-pad.r),ch=Math.max(1,h-pad.t-pad.b);const sl=sliceBricks();state.renderSlice=sl;
  let lows=[],highs=[];for(const b of sl.a){lows.push(b.low);highs.push(b.high)}if(Number.isFinite(state.lastPrice)){lows.push(state.lastPrice);highs.push(state.lastPrice)}
  if(!lows.length){drawGrid(x,w,h,pad,0,1);return}
  let lo=Math.min(...lows),hi=Math.max(...highs);const extra=Math.max(state.box*1.5,(hi-lo)*.08||state.box);lo-=extra;hi+=extra;const range=hi-lo||1;const yy=v=>pad.t+(hi-v)/range*ch;
  drawGrid(x,w,h,pad,lo,hi,yy);
  const count=Math.max(state.visible,sl.a.length||1),step=cw/count,bw=Math.max(2,Math.min(24,step*.76));
  sl.a.forEach((b,i)=>{const cx=pad.l+(i+(count-sl.a.length)+.5)*step,y1=yy(b.open),y2=yy(b.close),top=Math.min(y1,y2),height=Math.max(1,Math.abs(y2-y1));x.fillStyle=b.direction>0?'#2dbb86':'#e65d70';x.strokeStyle=b.direction>0?'#55d8a8':'#ff7b8b';x.globalAlpha=.9;x.fillRect(cx-bw/2,top,bw,height);x.globalAlpha=1;x.strokeRect(cx-bw/2+.5,top+.5,Math.max(1,bw-1),Math.max(1,height-1))});
  const t=thresholds();for(const [v,col] of [[t.up,'#2f9f78'],[t.down,'#b34d5c']])if(Number.isFinite(v)&&v>=lo&&v<=hi){const y=yy(v);x.save();x.setLineDash([4,5]);x.strokeStyle=col;x.globalAlpha=.45;x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();x.restore()}
  if(Number.isFinite(state.lastPrice)){const y=yy(state.lastPrice);x.strokeStyle='#8d7ef4';x.globalAlpha=.65;x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();x.globalAlpha=1;x.fillStyle='#796bea';roundRect(x,w-pad.r+5,y-10,63,20,5,true,false);x.fillStyle='#fff';x.font='700 8px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(fmt(state.lastPrice),w-pad.r+36,y)}
  drawTimeLabels(x,sl.a,pad,w,h,count,step);
}
function drawGrid(x,w,h,pad,lo,hi,yy){x.lineWidth=1;x.font='600 7px system-ui';x.textAlign='left';x.textBaseline='middle';for(let i=0;i<=6;i++){const y=pad.t+(h-pad.t-pad.b)*i/6;x.strokeStyle='#151b22';x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();if(yy){const v=hi-(hi-lo)*i/6;x.fillStyle='#66727f';x.fillText(fmt(v),w-pad.r+8,y)}}for(let i=0;i<=8;i++){const xx=pad.l+(w-pad.l-pad.r)*i/8;x.strokeStyle='#11171e';x.beginPath();x.moveTo(xx,pad.t);x.lineTo(xx,h-pad.b);x.stroke()}}
function drawTimeLabels(x,a,pad,w,h,count,step){if(!a.length)return;x.font='600 6px system-ui';x.fillStyle='#56616d';x.textAlign='center';x.textBaseline='middle';const marks=4;for(let j=0;j<=marks;j++){const idx=Math.min(a.length-1,Math.round((a.length-1)*j/marks)),b=a[idx];if(!b)continue;const cx=pad.l+(idx+(count-a.length)+.5)*step;x.fillText(new Date(b.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),cx,h-12)}}
function roundRect(ctx,x,y,w,h,r,fill,stroke){if(w<2*r)r=w/2;if(h<2*r)r=h/2;ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();if(fill)ctx.fill();if(stroke)ctx.stroke()}

function applyBrickSize(){const v=Number($('brickSize').value);if(!(v>0)||!Number.isFinite(v)){setFeed('bad','INVALID BOX');return}$('brickSize').value=fmtInput(v);state.box=v;state.boxManual=true;state.savedBoxes=state.savedBoxes||{};state.savedBoxes[state.selected]=v;savePrefs();rebuild();setFeed(state.ws?.readyState===WebSocket.OPEN?'live':'','FIXED BOX')}
function zoom(delta){state.visible=Math.max(20,Math.min(300,state.visible+delta));savePrefs();scheduleDraw()}
function installChartEvents(){
  const c=$('renkoCanvas'),wrap=$('chartWrap'),tip=$('tooltip');
  c.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?10:-10)},{passive:false});
  c.addEventListener('pointerdown',e=>{state.drag={x:e.clientX,pan:state.pan};c.setPointerCapture?.(e.pointerId)});
  c.addEventListener('pointermove',e=>{
    if(state.drag){const width=Math.max(1,c.getBoundingClientRect().width-82),step=width/state.visible,shift=Math.round((e.clientX-state.drag.x)/Math.max(1,step));state.pan=Math.max(0,Math.min(Math.max(0,state.bricks.length-state.visible),state.drag.pan+shift));if(shift!==0)$('followLive').checked=false;scheduleDraw();return}
    const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,sl=state.renderSlice;if(!sl?.a?.length||x<10||x>r.width-72){tip.hidden=true;return}const cw=r.width-82,count=Math.max(state.visible,sl.a.length),step=cw/count,idx=Math.floor((x-10)/step-(count-sl.a.length));const b=sl.a[idx];if(!b){tip.hidden=true;return}tip.hidden=false;tip.style.left=`${Math.min(r.width-168,Math.max(6,x+10))}px`;tip.style.top=`${Math.min(r.height-88,Math.max(6,y+10))}px`;tip.innerHTML=`<b class="${b.direction>0?'up':'down'}">${b.direction>0?'UP':'DOWN'} BRICK #${b.i}</b><div>Open ${fmt(b.open)} → Close ${fmt(b.close)}</div><div>${new Date(b.time).toLocaleString()}</div><div>Trade ID ${b.tradeId??'—'}</div>`;
  });
  c.addEventListener('pointerup',()=>{state.drag=null});c.addEventListener('pointercancel',()=>{state.drag=null});c.addEventListener('mouseleave',()=>{if(!state.drag)tip.hidden=true});
  new ResizeObserver(()=>scheduleDraw()).observe(wrap);
}

function bind(){
  $('pairSearch').addEventListener('input',renderPairs);$('applyBrick').onclick=applyBrickSize;$('brickSize').addEventListener('keydown',e=>{if(e.key==='Enter')applyBrickSize()});$('zoomOut').onclick=()=>zoom(10);$('zoomIn').onclick=()=>zoom(-10);$('followLive').onchange=e=>{if(e.target.checked){state.pan=0;scheduleDraw()}};$('resetChart').onclick=()=>rebuild();
  const mobile=document.createElement('button');mobile.id='mobilePairs';mobile.className='mobile-pair-button';mobile.textContent='Pairs';mobile.onclick=()=>document.querySelector('.markets')?.classList.toggle('open');document.querySelector('.nav')?.after(mobile);
  installChartEvents();
}

async function boot(){loadPrefs();bind();await loadSymbols();await selectSymbol(state.selected);window.addEventListener('beforeunload',closeLive,{once:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(!state.ws||state.ws.readyState>1))connectLive(state.selected)});}
window.RWARenko={version:'1.0.0',method:'traditional-fixed-box',source:'raw-trade-ticks-only',reversalBoxes:2,state,selectSymbol,applyTick,rebuild,thresholds};
boot().catch(e=>{console.error(e);setFeed('bad','STARTUP ERROR');$('historyState').textContent=e.message});
})();
