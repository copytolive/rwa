(()=>{
'use strict';
if(window.RWARenkoV10)return;

const $=id=>document.getElementById(id);
const RESTS=['https://data-api.binance.vision','https://api.binance.com'];
const PAGE=1000,BATCH=4,FIRST_VIEW=60,MINUTE=60000;
const STORE='rwa_renko_v10_settings';
const BAR_CACHE='rwa_renko_v10_bars_';
const MODES=new Set(['auto','traditional','atr','percentage']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmt=n=>{n=Number(n);if(!Number.isFinite(n))return'—';const a=Math.abs(n),d=a>=1000?2:a>=100?3:a>=1?4:a>=.01?6:8;return n.toLocaleString(undefined,{maximumFractionDigits:d})};
const fmtPct=n=>Number.isFinite(Number(n))?`${(Number(n)*100).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')}%`:'—';
const fmtDate=ms=>Number(ms)?new Date(Number(ms)).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'2-digit'}):'—';
const now=()=>Date.now();

const C={
  mode:'auto',
  traditionalBox:100,
  atrLength:14,
  atrFactor:1,
  autoFactor:.5,
  autoLockMinutes:30,
  percentage:.001,
  projection:true,
  confirmBricks:2
};
try{Object.assign(C,JSON.parse(localStorage.getItem(STORE)||'{}')||{})}catch{}
if(!MODES.has(C.mode))C.mode='auto';
C.atrLength=clamp(Math.floor(Number(C.atrLength)||14),2,200);
C.atrFactor=clamp(Number(C.atrFactor)||1,.05,10);
C.autoFactor=clamp(Number(C.autoFactor)||.5,.05,5);
C.autoLockMinutes=clamp(Math.floor(Number(C.autoLockMinutes)||30),5,240);
C.percentage=clamp(Number(C.percentage)||.001,.00001,.1);
C.confirmBricks=Number(C.confirmBricks)===1?1:2;

const S={
  version:'10.0.0',generation:0,symbol:'',mode:C.mode,box:Number(C.traditionalBox)||100,atr:NaN,
  autoLockUntil:0,autoPending:false,bars:[],bricks:[],data:[],loading:false,building:false,booting:false,
  exhausted:false,following:true,latestClosedTime:0,buildSeq:0,loadSeq:0,lastLiveId:null,lastRefreshAt:0,
  lastSignalKey:'',signal:null,historyAbort:null,projectionPrice:NaN
};
let chart=null,series=null,projectionSeries=null,liveLine=null,worker=null,resizeObserver=null,rangeTimer=0,watchTimer=0,barTimer=0,autoTimer=0,lastSymbol='',metaFrame=0;

function saveSettings(){try{localStorage.setItem(STORE,JSON.stringify(C))}catch{}}
function setText(id,text){const e=$(id);if(e)e.textContent=text}
function setStatus(text,kind='ready'){const e=$('tvLoadState');if(e){e.textContent=text;e.dataset.kind=kind}const l=$('tvLoading');if(l)l.hidden=kind!=='loading'}
function modeName(mode=S.mode){return mode==='auto'?'AUTO ADAPTIVE':mode==='traditional'?'TRADITIONAL':mode==='atr'?'ATR':'PERCENTAGE'}
function setModePill(){setText('modePill',`${modeName()} · V10 · CONFIRMED SIGNALS`);setText('sourceText','History: completed Binance 1m OHLC · Live: individual @trade ticks · Orders/signals use real venue price, not synthetic Renko price.');}
function queueMeta(){if(metaFrame)return;metaFrame=requestAnimationFrame(()=>{metaFrame=0;setMeta()})}
function currentBox(price){
  if(S.mode==='percentage'){
    const last=Number(S.data.at(-1)?.close),base=Number.isFinite(last)&&last!==0?Math.abs(last):Math.abs(Number(price));
    return Math.max(Number.EPSILON,base*C.percentage);
  }
  if(S.mode==='atr'){
    const b=Number(S.atr)*C.atrFactor;
    return b>0?b:S.box;
  }
  return S.box;
}
function setMeta(){
  const r=chart?.timeScale?.().getVisibleLogicalRange?.();
  const width=r?Math.max(1,Math.round(r.to-r.from)):FIRST_VIEW;
  setText('tvZoomValue',String(width));
  setText('tvBrickMeta',`${Math.min(width,S.data.length)} visible · ${S.data.length.toLocaleString()} confirmed`);
  setText('tvCoverage',S.bars.length?`${fmtDate(S.bars[0]?.[0])} → live`:'Preparing history');
  const p=Number(window.RWARenkoV3?.state?.lastPrice);
  setText('brickValue',fmt(currentBox(p)));
  setText('brickCount',S.data.length.toLocaleString());
  setText('v10CurrentBox',fmt(currentBox(p)));
  setText('v10ModeLabel',modeName());
  setText('v10AtrNow',Number.isFinite(S.atr)?fmt(S.atr):'—');
  if(S.mode==='auto'){
    const left=Math.max(0,S.autoLockUntil-now());
    setText('v10LockState',S.autoPending?'Recalc queued until flat':`Locked ${Math.ceil(left/60000)}m`);
  }else setText('v10LockState','—');
}

async function fetchJson(path,timeout=10000,signal){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const attempts=RESTS.map(root=>new Promise(async(resolve,reject)=>{
    const c=new AbortController(),abort=()=>c.abort(),tm=setTimeout(abort,timeout);
    signal?.addEventListener('abort',abort,{once:true});
    try{const r=await fetch(root+path,{cache:'no-store',credentials:'omit',signal:c.signal});if(!r.ok)throw Error(`HTTP ${r.status}`);resolve(await r.json())}
    catch(e){reject(e)}finally{clearTimeout(tm);signal?.removeEventListener('abort',abort)}
  }));
  try{return await Promise.any(attempts)}catch(e){throw e?.errors?.at?.(-1)||e||Error('market data unavailable')}
}
async function fetchPage(endTime,symbol=S.symbol,signal=S.historyAbort?.signal){
  const q=`/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=1m&limit=${PAGE}${Number.isFinite(endTime)?`&endTime=${Math.floor(endTime)}`:''}`;
  const rows=await fetchJson(q,15000,signal),t=now();
  return(Array.isArray(rows)?rows:[]).filter(r=>Number(r?.[0])&&Number(r?.[6]||0)<t);
}
function dedupe(rows){const m=new Map();for(const r of rows||[]){const t=Number(r?.[0]);if(Number.isFinite(t))m.set(t,r)}return[...m.values()].sort((a,b)=>Number(a[0])-Number(b[0]))}
function calcAtr(bars,len=C.atrLength){
  const q=[];let prev=NaN,atr=NaN;
  for(const b of bars||[]){const h=Number(b?.[2]),l=Number(b?.[3]),c=Number(b?.[4]);if(![h,l,c].every(Number.isFinite))continue;const tr=Number.isFinite(prev)?Math.max(h-l,Math.abs(h-prev),Math.abs(l-prev)):h-l;prev=c;q.push(Math.max(0,tr));if(q.length>len)q.shift();if(q.length===len)atr=q.reduce((a,x)=>a+x,0)/len;}
  return atr;
}
function roundBox(v){v=Number(v);if(!(v>0))return 1;return Number(v.toPrecision(4))}
function computeFixedBox(){
  const p=Number(window.RWARenkoV3?.state?.lastPrice)||Number(S.bars.at(-1)?.[4])||1;
  S.atr=calcAtr(S.bars,C.atrLength);
  if(S.mode==='traditional')S.box=Math.max(Number.EPSILON,Number(C.traditionalBox)||p*.001);
  else if(S.mode==='auto'){
    const base=(Number.isFinite(S.atr)&&S.atr>0?S.atr:p*.002)*C.autoFactor;
    S.box=roundBox(Math.max(Number.EPSILON,base));
    S.autoLockUntil=now()+C.autoLockMinutes*60000;
    S.autoPending=false;
  }else if(S.mode==='atr')S.box=roundBox(Math.max(Number.EPSILON,(Number.isFinite(S.atr)?S.atr:p*.002)*C.atrFactor));
  else S.box=roundBox(Math.max(Number.EPSILON,p*C.percentage));
  setMeta();
}

function ensureWorker(){if(worker)return worker;worker=new Worker('renko-v10-worker.js?v=100');return worker}
function normalize(bricks){
  let last=0;
  return(bricks||[]).map((b,i)=>{
    let t=Math.max(1,Math.floor(Number(b.time||0)/1000));if(t<=last)t=last+1;last=t;
    const o=Number(b.open),c=Number(b.close),h=Number(b.high),l=Number(b.low),dir=Number(b.direction)||0;
    return{time:t,open:o,high:Number.isFinite(h)?Math.max(h,o,c):Math.max(o,c),low:Number.isFinite(l)?Math.min(l,o,c):Math.min(o,c),close:c,
      color:dir>=0?'#089981':'#f23645',borderColor:dir>=0?'#22ab94':'#f7525f',wickColor:dir>=0?'#089981':'#f23645',_ms:Number(b.time||0),_dir:dir,_box:Number(b.box)||S.box,_i:i};
  });
}
function rebuild(anchor=null){
  if(!S.bars.length)return Promise.resolve(false);
  computeFixedBox();
  const generation=S.generation,id=++S.buildSeq,bars=S.bars.map(r=>r.slice(0,7)),mode=S.mode;
  S.building=true;setStatus('Building Renko…','loading');
  return new Promise((resolve,reject)=>{
    const w=ensureWorker();
    const on=e=>{const m=e.data||{};if(m.type!=='built'||m.id!==id)return;w.removeEventListener('message',on);if(generation!==S.generation){resolve(false);return}
      S.bricks=Array.isArray(m.bricks)?m.bricks:[];S.data=normalize(S.bricks);if(Number.isFinite(Number(m.atr)))S.atr=Number(m.atr);
      S.latestClosedTime=Number(S.bars.at(-1)?.[6]||0);S.building=false;series?.setData(S.data);showChart();restoreAnchor(anchor);setStatus('Ready','ready');
      appendBufferedTicks();refreshProjection();evaluateSignal();setMeta();resolve(true);
    };
    w.addEventListener('message',on);
    try{w.postMessage({type:'build',id,generation,mode,box:S.box,atrLength:C.atrLength,atrFactor:C.atrFactor,percent:C.percentage,bars})}
    catch(e){w.removeEventListener('message',on);S.building=false;reject(e)}
  });
}
function showChart(){const e=$('chartEmpty');if(e)e.classList.add('hide');const h=$('lwcRenkoHost');if(h)h.style.visibility='visible'}
function latestView(){if(!chart||!S.data.length)return;const n=S.data.length;chart.timeScale().setVisibleLogicalRange({from:Math.max(0,n-FIRST_VIEW),to:n+5});S.following=true;setMeta()}
function rangeAnchor(){const r=chart?.timeScale?.().getVisibleLogicalRange?.();if(!r||!S.data.length)return null;const idx=clamp(Math.floor(r.from),0,S.data.length-1),d=S.data[idx];return{range:r,index:idx,time:d?.time,close:d?.close}}
function restoreAnchor(a){if(!a||!chart||!S.data.length)return;let idx=S.data.findIndex(d=>d.time===a.time&&Math.abs(Number(d.close)-Number(a.close))<Math.max(1e-10,Math.abs(Number(a.close))*1e-9));if(idx<0)idx=S.data.findIndex(d=>d.time>=a.time);if(idx<0)return;const shift=idx-a.index;chart.timeScale().setVisibleLogicalRange({from:a.range.from+shift,to:a.range.to+shift})}

async function olderBatch(count=BATCH){
  if(S.loading||S.exhausted||!S.bars.length)return false;
  const generation=S.generation,seq=++S.loadSeq,symbol=S.symbol,first=Number(S.bars[0][0]),anchor=rangeAnchor();
  S.loading=true;setStatus('Loading older history…','loading');
  try{
    const ends=Array.from({length:count},(_,i)=>first-1-i*PAGE*MINUTE);
    const settled=await Promise.allSettled(ends.map(end=>fetchPage(end,symbol)));
    if(generation!==S.generation||seq!==S.loadSeq||symbol!==S.symbol)return false;
    const pages=settled.filter(x=>x.status==='fulfilled').map(x=>x.value),rows=pages.flat();
    if(!rows.length){S.exhausted=true;setStatus('History start reached','ready');return false}
    const before=S.bars.length;S.bars=dedupe([...rows,...S.bars]);const added=S.bars.length-before;
    if(added===0||pages.every(p=>p.length<PAGE))S.exhausted=true;
    if(added>0)await rebuild(anchor);
    return added>0;
  }catch(e){if(generation===S.generation)setStatus('History retry','bad');console.warn('[Renko V10 older]',e);return false}
  finally{if(generation===S.generation){S.loading=false;setMeta()}}
}
function scheduleOlder(){clearTimeout(rangeTimer);rangeTimer=setTimeout(()=>{if(S.loading||S.booting||S.exhausted||S.building)return;const r=chart?.timeScale?.().getVisibleLogicalRange?.();if(r&&r.from<24)void olderBatch(BATCH)},160)}
function barCacheKey(){return`${BAR_CACHE}${S.symbol}`}
function saveBars(){try{localStorage.setItem(barCacheKey(),JSON.stringify({v:100,savedAt:now(),bars:S.bars.slice(-PAGE)}))}catch{}}
async function loadBarsCache(generation){try{const x=JSON.parse(localStorage.getItem(barCacheKey())||'null');if(!x||x.v!==100||now()-Number(x.savedAt)>86400000||!Array.isArray(x.bars)||!x.bars.length)return false;S.bars=dedupe(x.bars);await rebuild();if(generation!==S.generation)return false;latestView();setStatus('Cached · refreshing','ready');return true}catch{return false}}
async function bootHistory(generation){
  S.booting=true;
  try{
    const painted=await loadBarsCache(generation);if(generation!==S.generation)return;
    setStatus(painted?'Refreshing latest…':'Loading chart…',painted?'ready':'loading');
    const latest=await fetchPage(undefined,S.symbol);if(generation!==S.generation)return;
    if(latest.length){S.bars=dedupe(latest);await rebuild();saveBars()}
    let rounds=0;while(generation===S.generation&&S.data.length<FIRST_VIEW&&!S.exhausted&&rounds++<5){const ok=await olderBatch(BATCH);if(!ok)break;await sleep(0)}
    if(generation!==S.generation)return;
    if(S.data.length){latestView();setStatus('Ready','ready')}else setStatus('Offline · retrying','bad');
    setMeta();setTimeout(scheduleOlder,250);
  }catch(e){if(generation===S.generation)setStatus(S.data.length?'Cached · feed retry':'Offline · retrying','bad');console.error('[Renko V10 boot]',e)}
  finally{if(generation===S.generation)S.booting=false}
}
function resetForSymbol(symbol){
  S.historyAbort?.abort();S.historyAbort=new AbortController();clearTimeout(rangeTimer);
  S.generation++;S.symbol=symbol;S.mode=C.mode;S.bars=[];S.bricks=[];S.data=[];S.loading=false;S.building=false;S.booting=false;S.exhausted=false;S.following=true;S.latestClosedTime=0;S.lastLiveId=null;S.lastSignalKey='';
  series?.setData([]);projectionSeries?.setData([]);if(liveLine){try{series.removePriceLine(liveLine)}catch{}liveLine=null}
  setModePill();setStatus('Chart ready · connecting data','ready');setMeta();void bootHistory(S.generation);
}

function appendLiveTick(t){
  if(!series||!S.data.length||Number(t.time)<=S.latestClosedTime)return;
  const id=t.id??t.time;if(id===S.lastLiveId)return;S.lastLiveId=id;
  const p=Number(t.price);if(!Number.isFinite(p))return;
  let last=S.data.at(-1),lastClose=Number(last.close),direction=Number(last._dir)||1,guard=0,changed=false;
  const add=(open,close,dir,box)=>{const prev=S.data.at(-1);const time=Math.max(Math.floor(Number(t.time)/1000),Number(prev?.time||0)+1);const d={time,open,high:Math.max(open,close),low:Math.min(open,close),close,color:dir>=0?'#089981':'#f23645',borderColor:dir>=0?'#22ab94':'#f7525f',wickColor:dir>=0?'#089981':'#f23645',_ms:Number(t.time),_dir:dir,_box:box,_i:S.data.length};S.data.push(d);series.update(d);lastClose=close;direction=dir;changed=true};
  while(guard++<2001){const box=currentBox(lastClose);if(!(box>0))break;
    if(direction>=0){
      if(p>=lastClose+box){add(lastClose,lastClose+box,1,box);continue}
      if(p<=lastClose-2*box){add(lastClose-box,lastClose-2*box,-1,box);continue}
      break;
    }else{
      if(p<=lastClose-box){add(lastClose,lastClose-box,-1,box);continue}
      if(p>=lastClose+2*box){add(lastClose+box,lastClose+2*box,1,box);continue}
      break;
    }
  }
  updateLiveLine(p);S.projectionPrice=p;refreshProjection();
  if(changed){if(S.following)chart.timeScale().scrollToRealTime?.();evaluateSignal();queueMeta()}
}
function appendBufferedTicks(){const ticks=window.RWARenkoV3?.state?.historyTicks;if(!Array.isArray(ticks))return;for(const t of ticks)if(Number(t.time)>S.latestClosedTime)appendLiveTick(t)}
function updateLiveLine(p){if(!series||!Number.isFinite(p))return;if(liveLine){try{liveLine.applyOptions({price:p})}catch{}}else{try{liveLine=series.createPriceLine({price:p,color:'#2962ff',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'REAL'})}catch{}}}
function watchTick(){const v=window.RWARenkoV3?.state;if(!v)return;const t=v.historyTicks?.at?.(-1);if(t)appendLiveTick(t);const p=Number(v.lastPrice);if(Number.isFinite(p)){S.projectionPrice=p;updateLiveLine(p);refreshProjection();updateSignalPanel()}}

function refreshProjection(){
  if(!projectionSeries)return;
  if(!C.projection||!S.data.length){projectionSeries.setData([]);setText('projectionState','OFF');return}
  const last=S.data.at(-1),p=Number(S.projectionPrice||window.RWARenkoV3?.state?.lastPrice);if(!Number.isFinite(p)){projectionSeries.setData([]);return}
  const box=currentBox(p),dir=Number(last._dir)||1,lastClose=Number(last.close);
  let threshold,kind;
  if(dir>=0){if(p>=lastClose) {threshold=lastClose+box;kind='UP continuation'} else {threshold=lastClose-2*box;kind='DOWN reversal'}}
  else {if(p<=lastClose){threshold=lastClose-box;kind='DOWN continuation'}else{threshold=lastClose+2*box;kind='UP reversal'}}
  const open=lastClose,close=p,time=Number(last.time)+1,up=close>=open;
  projectionSeries.setData([{time,open,high:Math.max(open,close),low:Math.min(open,close),close,color:up?'rgba(8,153,129,.22)':'rgba(242,54,69,.22)',borderColor:up?'rgba(34,171,148,.55)':'rgba(247,82,95,.55)',wickColor:'rgba(149,152,161,.55)'}]);
  const distance=Math.abs(threshold-p),pct=box>0?distance/box:0;
  setText('projectionState',`PROJECTED · NO SIGNAL · ${kind} ${fmt(distance)} away (${pct.toFixed(2)} box)`);
}

function deriveSignal(){
  const a=S.data;if(a.length<3)return{position:'flat',action:'WAIT',reason:'Need more confirmed bricks'};
  const confirm=C.confirmBricks;let position='flat',entry=NaN,entryBox=NaN,lastEvent='WAIT',eventIndex=-1;
  for(let i=1;i<a.length;i++){
    const d=Number(a[i]._dir),prev=Number(a[i-1]._dir);
    if(position==='long'&&d<0){position='flat';lastEvent='EXIT LONG · confirmed reversal';eventIndex=i;continue}
    if(position==='short'&&d>0){position='flat';lastEvent='EXIT SHORT · confirmed reversal';eventIndex=i;continue}
    if(position!=='flat')continue;
    if(confirm===1){
      if(prev<0&&d>0){position='long';entry=Number(a[i].close);entryBox=Number(a[i]._box)||currentBox(entry);lastEvent='BUY READY · reversal confirmed';eventIndex=i}
      else if(prev>0&&d<0){position='short';entry=Number(a[i].close);entryBox=Number(a[i]._box)||currentBox(entry);lastEvent='SELL READY · reversal confirmed';eventIndex=i}
    }else if(i>=2){
      const p2=Number(a[i-2]._dir);
      if(p2<0&&prev>0&&d>0){position='long';entry=Number(a[i].close);entryBox=Number(a[i]._box)||currentBox(entry);lastEvent='BUY READY · reversal + 1 continuation';eventIndex=i}
      else if(p2>0&&prev<0&&d<0){position='short';entry=Number(a[i].close);entryBox=Number(a[i]._box)||currentBox(entry);lastEvent='SELL READY · reversal + 1 continuation';eventIndex=i}
    }
  }
  const last=a.at(-1),box=Number(last?._box)||currentBox(last?.close),market=Number(window.RWARenkoV3?.state?.lastPrice),close=Number(last?.close);
  let hard=NaN,trail=NaN,action=lastEvent,reason='Confirmed Renko only; projected brick never triggers an entry.';
  if(position==='long'){hard=entry-2*entryBox;trail=close-box;if(Number.isFinite(market)&&market<=hard){action='EXIT NOW · raw market hard stop';reason='Real market price crossed the hard stop before the Renko reversal completed.'}else if(eventIndex<a.length-1)action='LONG ACTIVE'}
  else if(position==='short'){hard=entry+2*entryBox;trail=close+box;if(Number.isFinite(market)&&market>=hard){action='EXIT NOW · raw market hard stop';reason='Real market price crossed the hard stop before the Renko reversal completed.'}else if(eventIndex<a.length-1)action='SHORT ACTIVE'}
  else if(lastEvent.startsWith('EXIT'))action=lastEvent;
  else action='WAIT';
  return{position,action,entry,entryBox,hard,trail,market,close,reason,eventIndex};
}
function evaluateSignal(){S.signal=deriveSignal();updateSignalPanel()}
function updateSignalPanel(){
  if(!S.signal)S.signal=deriveSignal();
  const x=S.signal,age=now()-Number(window.RWARenkoV3?.state?.lastTickTime||0),fresh=age<5000;
  setText('signalAction',x.action||'WAIT');setText('signalPosition',(x.position||'flat').toUpperCase());setText('signalEntry',fmt(x.entry));setText('signalMarket',fmt(Number(window.RWARenkoV3?.state?.lastPrice)));setText('signalHardStop',fmt(x.hard));setText('signalTrail',fmt(x.trail));setText('signalReason',x.reason||'—');
  const e=$('signalAction');if(e)e.dataset.kind=(x.action||'').includes('EXIT')?'exit':(x.action||'').includes('BUY')?'buy':(x.action||'').includes('SELL')?'sell':(x.position==='long'?'buy':x.position==='short'?'sell':'wait');
  setText('signalFreshness',fresh?`LIVE ${Math.max(0,age)} ms`:`STALE ${Math.floor(age/1000)} s`);
  const f=$('signalFreshness');if(f)f.dataset.kind=fresh?'live':'stale';
}

function createChart(){
  const wrap=$('chartWrap'),L=window.LightweightCharts;if(!wrap||!L)return false;
  let host=$('lwcRenkoHost');if(!host){host=document.createElement('div');host.id='lwcRenkoHost';host.setAttribute('aria-label','RENKO V10 TradingView-style chart');wrap.prepend(host)}
  chart=L.createChart(host,{localization:{locale:'en-US'},layout:{background:{type:L.ColorType?.Solid??'solid',color:'#131722'},textColor:'#b2b5be',attributionLogo:true},grid:{vertLines:{color:'rgba(120,123,134,.14)'},horzLines:{color:'rgba(120,123,134,.14)'}},rightPriceScale:{borderColor:'#2a2e39',minimumWidth:64,scaleMargins:{top:.04,bottom:.05}},timeScale:{borderColor:'#2a2e39',timeVisible:true,secondsVisible:false,rightOffset:8,barSpacing:10,minBarSpacing:2,maxBarSpacing:28,lockVisibleTimeRangeOnResize:true},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:true},handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:{time:true,price:true},axisDoubleClickReset:{time:true,price:true}},kineticScroll:{mouse:true,touch:true},crosshair:{mode:L.CrosshairMode?.Normal??0}});
  series=chart.addSeries(L.CandlestickSeries,{upColor:'#089981',downColor:'#f23645',borderUpColor:'#22ab94',borderDownColor:'#f7525f',wickUpColor:'#089981',wickDownColor:'#f23645',priceLineVisible:false,lastValueVisible:true});
  projectionSeries=chart.addSeries(L.CandlestickSeries,{upColor:'rgba(8,153,129,.22)',downColor:'rgba(242,54,69,.22)',borderUpColor:'rgba(34,171,148,.55)',borderDownColor:'rgba(247,82,95,.55)',wickUpColor:'rgba(149,152,161,.55)',wickDownColor:'rgba(149,152,161,.55)',priceLineVisible:false,lastValueVisible:false});
  chart.timeScale().subscribeVisibleLogicalRangeChange?.(r=>{if(r&&S.data.length)S.following=r.to>=S.data.length-1;queueMeta();scheduleOlder()});
  resizeObserver=new ResizeObserver(entries=>{const r=entries[0]?.contentRect;if(r?.width&&r?.height)chart.resize(Math.floor(r.width),Math.floor(r.height))});resizeObserver.observe(wrap);wireNav();return true;
}
function shiftRange(frac){const r=chart?.timeScale?.().getVisibleLogicalRange?.();if(!r)return;const w=r.to-r.from,d=w*frac;chart.timeScale().setVisibleLogicalRange({from:r.from+d,to:r.to+d})}
function zoomRange(f){const r=chart?.timeScale?.().getVisibleLogicalRange?.();if(!r)return;const mid=(r.from+r.to)/2,w=clamp((r.to-r.from)*f,20,300);chart.timeScale().setVisibleLogicalRange({from:mid-w/2,to:mid+w/2})}
function wireNav(){const click=(id,fn)=>$(id)?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();fn()},{capture:true});click('tvPanOlder',()=>shiftRange(-.72));click('tvPanNewer',()=>shiftRange(.72));click('tvZoomOut',()=>zoomRange(1.25));click('tvZoomIn',()=>zoomRange(.8));click('tvReset',latestView);click('tvLive',latestView)}

function syncForm(){
  document.querySelectorAll('[data-renko-mode]').forEach(b=>b.classList.toggle('active',b.dataset.renkoMode===C.mode));
  const set=(id,v)=>{const e=$(id);if(e)e.value=String(v)};set('brickSize',C.traditionalBox);set('v10AtrLength',C.atrLength);set('v10AtrFactor',C.atrFactor);set('v10AutoFactor',C.autoFactor);set('v10AutoLock',C.autoLockMinutes);set('v10Percent',C.percentage*100);if($('v10Projection'))$('v10Projection').checked=!!C.projection;if($('v10Confirm'))$('v10Confirm').value=String(C.confirmBricks);
  document.querySelectorAll('[data-mode-fields]').forEach(e=>e.hidden=e.dataset.modeFields!==C.mode);
  setModePill();setMeta();
}
async function applyMode(mode,{force=false}={}){
  if(!MODES.has(mode))return;C.mode=mode;S.mode=mode;saveSettings();syncForm();if(!S.bars.length)return;
  const anchor=rangeAnchor();await rebuild(anchor);if(force||S.following)latestView();evaluateSignal();
}
function readSettingsFromForm(){
  C.traditionalBox=Math.max(Number.EPSILON,Number($('brickSize')?.value)||C.traditionalBox);
  C.atrLength=clamp(Math.floor(Number($('v10AtrLength')?.value)||14),2,200);
  C.atrFactor=clamp(Number($('v10AtrFactor')?.value)||1,.05,10);
  C.autoFactor=clamp(Number($('v10AutoFactor')?.value)||.5,.05,5);
  C.autoLockMinutes=clamp(Math.floor(Number($('v10AutoLock')?.value)||30),5,240);
  C.percentage=clamp((Number($('v10Percent')?.value)||.1)/100,.00001,.1);
  C.projection=!!$('v10Projection')?.checked;C.confirmBricks=Number($('v10Confirm')?.value)===1?1:2;saveSettings();
}
function wireSettings(){
  document.querySelectorAll('[data-renko-mode]').forEach(b=>b.addEventListener('click',()=>applyMode(b.dataset.renkoMode,{force:true})));
  $('v10Apply')?.addEventListener('click',async()=>{readSettingsFromForm();S.mode=C.mode;await rebuild(rangeAnchor());latestView();refreshProjection();evaluateSignal();syncForm()});
  $('v10Recalc')?.addEventListener('click',async()=>{readSettingsFromForm();S.autoLockUntil=0;S.autoPending=false;await rebuild(rangeAnchor());latestView();syncForm()});
  $('v10Projection')?.addEventListener('change',()=>{readSettingsFromForm();refreshProjection()});
  $('v10Confirm')?.addEventListener('change',()=>{readSettingsFromForm();evaluateSignal()});
}

async function refreshLatestBars(){
  if(document.hidden||S.booting||S.loading||!S.symbol||now()-S.lastRefreshAt<25000)return;S.lastRefreshAt=now();
  try{const rows=await fetchJson(`/api/v3/klines?symbol=${encodeURIComponent(S.symbol)}&interval=1m&limit=4`,8000),t=now(),closed=(Array.isArray(rows)?rows:[]).filter(r=>Number(r?.[6]||0)<t);if(!closed.length)return;const before=Number(S.bars.at(-1)?.[0]||0),after=Number(closed.at(-1)?.[0]||0);S.bars=dedupe([...S.bars,...closed]);if(after>=before){await rebuild(rangeAnchor());saveBars();if(S.following)latestView()}}catch(e){console.warn('[Renko V10 refresh]',e)}
}
function autoLockTick(){
  if(C.mode!=='auto'||!S.bars.length)return;
  if(now()<S.autoLockUntil){setMeta();return}
  const sig=deriveSignal();if(sig.position!=='flat'){S.autoPending=true;setMeta();return}
  void (async()=>{S.autoPending=false;await rebuild(rangeAnchor());if(S.following)latestView();syncForm()})();
}

async function boot(){
  for(let i=0;i<240&&(!window.LightweightCharts||!window.RWARenkoV3);i++)await sleep(50);
  if(!window.LightweightCharts)throw Error('Lightweight Charts unavailable');if(!window.RWARenkoV3)throw Error('Renko market engine unavailable');
  if(!createChart())throw Error('chart host unavailable');wireSettings();syncForm();showChart();
  window.RWARenkoV10={version:'10.0.0',renderer:'tradingview-lightweight-charts-5.1',modes:['auto','traditional','atr','percentage'],historicalSource:'binance-1m-ohlc',liveSource:'binance-individual-@trade',executionPrice:'real-market-price',signalRule:'confirmed-renko-only',state:S,settings:C,setMode:applyMode,loadOlder:olderBatch,goLive:latestView,recalculate:()=>$('v10Recalc')?.click()};
  watchTimer=setInterval(()=>{const v=window.RWARenkoV3?.state;if(!v)return;const sym=String(v.selected||'');if(sym&&sym!==lastSymbol){lastSymbol=sym;resetForSymbol(sym)}watchTick()},100);
  barTimer=setInterval(()=>void refreshLatestBars(),30000);autoTimer=setInterval(autoLockTick,15000);
  const initial=String(window.RWARenkoV3.state.selected||'BTCUSDT');lastSymbol=initial;resetForSymbol(initial);
}

boot().catch(e=>{console.error('[Renko V10]',e);setStatus('Chart retry','bad')});
})();
