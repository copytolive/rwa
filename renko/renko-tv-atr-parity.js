/* ATR parity + live-settings regression lock for TradingView-documented Renko.
 *
 * Generic path: any ATR length uses the actual Wilder ATR look-back and never
 * applies the historical 500-length clamp.
 *
 * XAUT/USDT 1m fast path: the explicit matrix
 *   1, 10, 100, 1000, 10000, 100000, 1000000
 * is prepared off the main thread from Gate Spot regular 1m OHLC candles. A
 * same-origin compressed history pack supplies the deep baseline; the newest
 * resident closed Gate candles are merged on top, so the prepared revision stays
 * current without asking a browser to fan out ~1000 cross-origin REST requests.
 * Positive raw Wilder ATR is used directly as Renko box size.
 */
(()=>{
'use strict';
const STORE='rwa_renko_tradingview_settings_v1';
const DATA_ROOT='https://data-api.binance.vision';
const MATRIX=[1,10,100,1000,10000,100000,1000000],MATRIX_SET=new Set(MATRIX);
const XAUT='XAUTUSDT',XAUT_INTERVAL='1m';
const E=window.RWARenkoTVEngine;
const ORIGINAL_BUILD=E?.build?.bind(E);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const nextFrame=()=>new Promise(r=>(window.requestAnimationFrame||setTimeout)(r));
const MATRIX_AUTO=new URLSearchParams(location.search).get('xautAtrMatrix')==='1';
let applying=false,queuedLength=null,applySerial=0;
let matrixWorker=null,matrixPromise=null,matrixToken=0,matrixContext='',matrixRevision=0,matrixLastWarmMs=0,matrixRefreshBusy=false,activeMatrixBase=null,activeMatrixLength=0;
const matrixEntries=new Map(),longTasks=[];
try{if('PerformanceObserver'in window){const po=new PerformanceObserver(list=>{for(const x of list.getEntries())longTasks.push({start:x.startTime,duration:x.duration});while(longTasks.length>500)longTasks.shift()});po.observe({type:'longtask',buffered:true})}}catch{}

function tv(){return window.RWARenkoTV||null}
function parseLength(v){const n=Math.floor(Number(v));return Number.isFinite(n)&&n>=1?n:14}
function saveLength(length){try{const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{};raw.atrLength=length;raw.method='atr';localStorage.setItem(STORE,JSON.stringify(raw))}catch{}}
function setLoad(text,live=false){const el=document.getElementById('tvLoadState');if(!el)return;el.textContent=text;el.className=`load-state ${live?'live':''}`}
function setAtrBadge(text){const badge=document.querySelector('.method[data-method="atr"] .method-title span');if(badge)badge.textContent=text}
function sourceRevision(T=tv()){const b=T?.state?.closedBars?.at?.(-1);return Number(b?.closeTime||b?.openTime)||0}
function matrixBaseContext(T=tv()){if(!T)return'';return[T.state.generation,T.state.symbol,T.settings.interval,T.settings.source,T.settings.wicks!==false?'w1':'w0',Number(T.state.tickSize)||0].join('|')}
function matrixEligible(length,T=tv()){return !!T&&T.state.symbol===XAUT&&T.settings.interval===XAUT_INTERVAL&&MATRIX_SET.has(parseLength(length))}
function fmtDate(ms){try{return new Date(Number(ms)).toLocaleString(undefined,{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return'—'}}
function matrixMetric(){let el=document.getElementById('atrMatrixMetric');if(el)return el;const load=document.getElementById('tvLoadState');if(!load?.parentNode)return null;el=document.createElement('span');el.id='atrMatrixMetric';el.className='pill';el.setAttribute('aria-live','polite');load.parentNode.insertBefore(el,load);return el}
function setMatrixMetric(text,kind=''){const el=matrixMetric();if(el){el.textContent=text;el.dataset.kind=kind}}

function stamp(T,length,target,satisfied,exhausted=false){
  const s=T.state;s.atrRequestedLength=length;s.atrHistoryTarget=target;s.atrHistorySatisfied=!!satisfied;s.atrHistoryExhausted=!!exhausted;s.atrHistoryGeneration=s.generation;s.atrAppliedLength=length;s.atrAppliedAt=Date.now();
  const input=document.getElementById('atrLength');if(input){input.value=String(length);input.dataset.appliedLength=String(length);input.setAttribute('aria-label',`ATR Length ${length} applied to chart`)}
  document.documentElement.dataset.atrLength=String(length);document.documentElement.dataset.atrAppliedLength=String(length);document.documentElement.dataset.atrHistorySatisfied=satisfied?'true':'false';
}
function mapRows(rows){return(Array.isArray(rows)?rows:[]).map(x=>({openTime:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[5])||0,closeTime:Number(x[6])})).filter(b=>[b.openTime,b.open,b.high,b.low,b.close,b.closeTime].every(Number.isFinite))}
function mergeBars(a,b){const m=new Map();for(const x of [...(a||[]),...(b||[])])m.set(Number(x.openTime),x);return[...m.values()].sort((x,y)=>x.openTime-y.openTime)}
async function fetchOlderDirect(T,generation){
  const s=T.state,oldest=Number(s.closedBars?.[0]?.openTime);if(!Number.isFinite(oldest))return 0;
  const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),18000);
  try{const q=`/api/v3/klines?symbol=${encodeURIComponent(s.symbol)}&interval=${encodeURIComponent(T.settings.interval)}&limit=1000&endTime=${Math.floor(oldest-1)}`;const r=await fetch(DATA_ROOT+q,{cache:'no-store',credentials:'omit',signal:ctrl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);const older=mapRows(await r.json()).filter(b=>b.openTime<oldest);if(generation!==s.generation||!older.length)return 0;const before=s.closedBars.length;s.closedBars=mergeBars(older,s.closedBars);s.historyPages=Math.max(1,Number(s.historyPages)||1)+1;return Math.max(0,s.closedBars.length-before)}finally{clearTimeout(tm)}
}
function mutationSnapshot(T){const s=T.state;return{box:Number(s.box),atr:Number(s.atr),count:Number(s.confirmed?.length||0),anchor:Number(s.base?.anchor),bars:Number(s.closedBars?.length||0)}}
function markMutation(T,length,before){const s=T.state,after=mutationSnapshot(T),tick=Math.max(0,Number(s.tickSize)||0),changed=(Number.isFinite(before.box)&&Number.isFinite(after.box)&&Math.abs(before.box-after.box)>Math.max(1e-12,tick*.5))||before.count!==after.count||before.anchor!==after.anchor;s.atrLastApply={length,before,after,changed,at:Date.now()};document.documentElement.dataset.atrChartRebuilt='true';document.documentElement.dataset.atrChartChanged=changed?'true':'same-effective-output';return{after,changed}}

/* Ordinary app rebuilds must retain the exact prepared deep base only when it is
 * for the same source context and the same latest closed source revision. */
if(E&&ORIGINAL_BUILD){
  E.build=function(bars,settings,tick){
    if(activeMatrixBase)return activeMatrixBase;
    const T=tv(),n=parseLength(settings?.atrLength),e=matrixEntries.get(n);
    if(T&&settings===T.settings&&settings?.method==='atr'&&matrixEligible(n,T)&&e&&e.context===matrixBaseContext(T)&&e.revision===sourceRevision(T)&&e.satisfied)return e.base;
    return ORIGINAL_BUILD(bars,settings,tick);
  };
}

function makeMatrixWorker(){
  if(matrixWorker)return matrixWorker;
  const engineUrl=new URL('renko-tv-engine.js?v=xaut-atr-pack-1',location.href).href;
  const src=`
'use strict';
let E=null,token=0,revision=0,source='close',wicks=true,tick=.01;
let times=[],opens=[],highs=[],lows=[],closes=[],targets=${JSON.stringify(MATRIX)},packMeta=null;
const STEP=60000;
const required=n=>n<=1000?1999:n+999;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function finite(v){return Number.isFinite(Number(v))}
function tr(h,l,pc){return Number.isFinite(pc)?Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)):h-l}
function lowerBound(a,v){let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>1;if(a[m]<v)lo=m+1;else hi=m}return lo}
async function gunzipText(url){const r=await fetch(url,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('history pack HTTP '+r.status);if(typeof DecompressionStream!=='function')throw new Error('gzip DecompressionStream unavailable');const stream=r.body.pipeThrough(new DecompressionStream('gzip'));return await new Response(stream).text()}
async function loadMeta(url){const r=await fetch(url,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('history meta HTTP '+r.status);const m=await r.json();if(m?.schema!=='renko-xaut-gate-1m-pack-v1'||m?.pair!=='XAUT_USDT'||m?.interval!=='1m'||Number(m?.rows)<1000999)throw new Error('invalid XAUT history pack metadata');return m}
function append(t,o,h,l,c){times.push(t);opens.push(o);highs.push(h);lows.push(l);closes.push(c)}
function parsePack(text,displayStart){let valid=0;const lines=text.split('\n');for(let i=0;i<lines.length;i++){const s=lines[i];if(!s)continue;const p=s.split(',');if(p.length<6)continue;const t=Number(p[0])*1000,c=Number(p[2]),h=Number(p[3]),l=Number(p[4]),o=Number(p[5]);if(![t,o,h,l,c].every(Number.isFinite)||t<=0)continue;if(Number.isFinite(displayStart)&&t>=displayStart)continue;append(t,o,h,l,c);valid++}return valid}
function appendDisplay(rows){for(const b of rows||[]){const t=Number(b.openTime),o=Number(b.open),h=Number(b.high),l=Number(b.low),c=Number(b.close);if(![t,o,h,l,c].every(Number.isFinite))continue;if(times.length&&t===times[times.length-1]){opens[opens.length-1]=o;highs[highs.length-1]=h;lows[lows.length-1]=l;closes[closes.length-1]=c}else if(!times.length||t>times[times.length-1])append(t,o,h,l,c)}}
function latestAtr(start,length){let prev=NaN,sum=0,atr=NaN,seen=0;for(let i=start;i<times.length;i++){const x=tr(highs[i],lows[i],prev);prev=closes[i];seen++;if(seen<=length){sum+=x;if(seen===length)atr=sum/length}else atr=((atr*(length-1))+x)/length}return{atr,seen}}
function baseFor(start,box){if(!(box>0)||start<0||start>=times.length)return null;const b0={open:opens[start],high:highs[start],low:lows[start],close:closes[start]},ps0=source==='ohlc'?E.ohlcPath(b0):[b0.close],first=Number(ps0[0]);if(!Number.isFinite(first))return null;const anchor=E.floorGrid(first,box,tick),st=E.initState(anchor),bricks=[];for(let i=start;i<times.length;i++){const b={open:opens[i],high:highs[i],low:lows[i],close:closes[i]},ps=source==='ohlc'?E.ohlcPath(b):[b.close],tm=times[i]+STEP-1;for(const p of ps)E.processPrice(st,p,bricks,{box,wicks,sourceTime:tm,sourceKind:'confirmed'})}return{bricks,box,atr:box,rawAtr:box,state:E.cloneState(st),anchor,source}}
function buildEntries(){const out=[];for(const n of targets){const req=required(n),start=Math.max(0,times.length-req),a=latestAtr(start,n),raw=Number(a.atr),count=times.length-start,satisfied=count>=n&&Number.isFinite(raw)&&raw>0,base=satisfied?baseFor(start,raw):null;out.push({length:n,rawAtr:raw,box:raw,sourceCount:count,fromTime:times[start]||0,toTime:times.length?times[times.length-1]+STEP-1:0,satisfied,base})}return out}
async function warm(d){token=d.token;source=d.source==='ohlc'?'ohlc':'close';wicks=d.wicks!==false;tick=Number(d.tick)||.01;revision=Number(d.anchor)||0;if(!E){importScripts(d.engineUrl);E=self.RWARenkoTVEngine}const display=(d.displayBars||[]).filter(b=>finite(b.openTime)&&finite(b.open)&&finite(b.high)&&finite(b.low)&&finite(b.close)).sort((a,b)=>Number(a.openTime)-Number(b.openTime)),displayStart=Number(display[0]?.openTime);times=[];opens=[];highs=[];lows=[];closes=[];const started=Date.now();self.postMessage({type:'progress',token,done:0,total:4,available:0,stage:'metadata'});packMeta=await loadMeta(d.packMetaUrl);self.postMessage({type:'progress',token,done:1,total:4,available:0,stage:'download'});const text=await gunzipText(d.packUrl);self.postMessage({type:'progress',token,done:2,total:4,available:0,stage:'parse'});parsePack(text,displayStart);appendDisplay(display);if(times.length<1000999)throw new Error('combined XAUT history '+times.length+' < 1,000,999');self.postMessage({type:'progress',token,done:3,total:4,available:times.length,stage:'build'});const entries=buildEntries();self.postMessage({type:'ready',token,revision,entries,available:times.length,warmMs:Date.now()-started,packMeta})}
function refresh(d){if(!E||d.token!==token)return;appendDisplay((d.newBars||[]).sort((a,b)=>Number(a.openTime)-Number(b.openTime)));revision=Number(d.revision)||revision;self.postMessage({type:'ready',token,revision,entries:buildEntries(),available:times.length,warmMs:0,packMeta,refresh:true})}
self.onmessage=e=>{const d=e.data||{};if(d.type==='warm')warm(d).catch(err=>self.postMessage({type:'error',token:d.token,error:String(err?.message||err)}));else if(d.type==='refresh')try{refresh(d)}catch(err){self.postMessage({type:'error',token:d.token,error:String(err?.message||err)})}};
`;
  matrixWorker=new Worker(URL.createObjectURL(new Blob([src],{type:'application/javascript'})));
  matrixWorker._engineUrl=engineUrl;
  return matrixWorker;
}
function clearMatrix(reason='context-change'){
  if(matrixWorker){try{matrixWorker.terminate()}catch{}matrixWorker=null}
  matrixPromise=null;matrixEntries.clear();matrixContext='';matrixRevision=0;matrixRefreshBusy=false;activeMatrixBase=null;
  document.documentElement.dataset.atrMatrixReady='false';document.documentElement.dataset.atrMatrixReason=reason;setMatrixMetric('XAUT ATR MATRIX · not prepared');
}
function acceptMatrixReady(d,T,context,resolve,reject){
  if(!T||d.token!==matrixToken||matrixBaseContext(T)!==context)return;
  matrixEntries.clear();for(const x of d.entries||[])matrixEntries.set(Number(x.length),{...x,context,revision:Number(d.revision)||0});
  matrixContext=context;matrixRevision=Number(d.revision)||0;matrixLastWarmMs=Number(d.warmMs)||matrixLastWarmMs;matrixRefreshBusy=false;
  const all=MATRIX.every(n=>matrixEntries.get(n)?.satisfied&&matrixEntries.get(n)?.base);
  document.documentElement.dataset.atrMatrixReady=all?'true':'partial';document.documentElement.dataset.atrMatrixWarmMs=String(matrixLastWarmMs);document.documentElement.dataset.atrMatrixRevision=String(matrixRevision);document.documentElement.dataset.atrMatrixAvailable=String(Number(d.available)||0);document.documentElement.dataset.atrMatrixPackRows=String(Number(d.packMeta?.rows)||0);document.documentElement.dataset.atrMatrixProvider='gate-history-pack-plus-live';
  setMatrixMetric(all?`XAUT ATR MATRIX · READY 7/7 · ${(Number(d.available)||0).toLocaleString()} Gate 1m bars`:`XAUT ATR MATRIX · PARTIAL · ${(Number(d.available)||0).toLocaleString()} Gate 1m bars`,all?'pass':'warn');
  if(d.refresh&&activeMatrixLength&&matrixEntries.get(activeMatrixLength)?.satisfied)queueMicrotask(()=>applyPreparedMatrix(activeMatrixLength,{automatic:true}));
  if(!d.refresh){if(all)resolve?.(true);else reject?.(new Error('Gate XAUT history cannot satisfy all seven ATR lengths'))}
}
async function warmMatrix(T=tv()){
  if(!T||T.state.status!=='live'||T.state.symbol!==XAUT||T.settings.interval!==XAUT_INTERVAL||!T.state.closedBars?.length||!(T.state.tickSize>0))return false;
  const context=matrixBaseContext(T),rev=sourceRevision(T);
  if(matrixPromise&&matrixContext===context&&matrixRevision===rev){try{await matrixPromise;return document.documentElement.dataset.atrMatrixReady==='true'}catch{return false}}
  if(matrixWorker){try{matrixWorker.terminate()}catch{}matrixWorker=null}
  matrixEntries.clear();matrixContext=context;matrixRevision=0;matrixLastWarmMs=0;document.documentElement.dataset.atrMatrixReady='warming';document.documentElement.dataset.atrMatrixProgress='0';setMatrixMetric('XAUT ATR MATRIX · preparing same-origin history pack');
  const w=makeMatrixWorker(),token=++matrixToken;
  const promise=new Promise((resolve,reject)=>{
    w.onmessage=e=>{const d=e.data||{};if(d.token!==token)return;if(d.type==='progress'){const pct=Math.min(99,Math.round((Number(d.done)||0)/(Number(d.total)||1)*100));document.documentElement.dataset.atrMatrixProgress=String(pct);document.documentElement.dataset.atrMatrixStage=String(d.stage||'');setMatrixMetric(`XAUT ATR MATRIX · ${pct}% · ${String(d.stage||'prepare')} · ${(Number(d.available)||0).toLocaleString()} bars`)}else if(d.type==='ready')acceptMatrixReady(d,T,context,resolve,reject);else if(d.type==='error'){matrixRefreshBusy=false;document.documentElement.dataset.atrMatrixReady='error';document.documentElement.dataset.atrMatrixError=String(d.error||'worker error');setMatrixMetric(`XAUT ATR MATRIX · ERROR · ${d.error}`,'warn');reject(new Error(d.error||'XAUT ATR matrix worker failed'))}};
    w.onerror=e=>{matrixRefreshBusy=false;document.documentElement.dataset.atrMatrixReady='error';document.documentElement.dataset.atrMatrixError=String(e.message||'worker error');reject(new Error(e.message||'XAUT ATR matrix worker failed'))};
  });
  matrixPromise=promise;
  w.postMessage({type:'warm',token,engineUrl:w._engineUrl,packUrl:new URL('data/xaut-gate-1m-pack.csv.gz',location.href).href,packMetaUrl:new URL('data/xaut-gate-1m-pack.meta.json',location.href).href,anchor:rev,tick:T.state.tickSize,source:T.settings.source,wicks:T.settings.wicks,displayBars:T.state.closedBars});
  try{await promise;document.documentElement.dataset.atrMatrixProgress='100';return true}catch(e){console.warn('[RENKO XAUT ATR matrix]',e);return false}
}
function stampPrepared(T,e,length,applyMs,longTaskDelta){
  const s=T.state;stamp(T,length,length,true,false);s.atrHistorySourceCount=e.sourceCount;s.atrHistoryFrom=e.fromTime;s.atrHistoryTo=e.toTime;s.atrRaw=e.rawAtr;s.atrRawBoxPass=Math.abs(Number(e.box)-Number(e.rawAtr))<=Math.max(1e-12,Math.abs(Number(e.rawAtr))*1e-10);s.atrMatrixPrepared=true;s.atrMatrixProvider='Gate Spot XAUT_USDT 1m · same-origin historical pack + live';s.atrMatrixLastApplyMs=applyMs;s.atrMatrixLongTaskDelta=longTaskDelta;s.atrMatrixWarmMs=matrixLastWarmMs;document.documentElement.dataset.atrRawBoxPass=s.atrRawBoxPass?'true':'false';document.documentElement.dataset.atrMatrixApplyMs=String(applyMs);document.documentElement.dataset.atrMatrixLongTasks=String(longTaskDelta);
}
function renderPreparedMeta(T,e,length){const count=document.getElementById('sourceBarCount'),cov=document.getElementById('tvCoverage'),atr=document.getElementById('currentAtr');if(count)count.textContent=Number(e.sourceCount).toLocaleString();if(cov)cov.textContent=`ATR LOOKBACK ${length.toLocaleString()} · ${fmtDate(e.fromTime)} → ${fmtDate(e.toTime)} · ${Number(e.sourceCount).toLocaleString()} Gate 1m OHLC bars`;if(atr)atr.textContent=Number(e.rawAtr).toLocaleString(undefined,{maximumFractionDigits:10});setAtrBadge(`ACTIVE · ${length}`);setLoad(`LIVE · ATR ${length.toLocaleString()} · raw Wilder ${Number(e.rawAtr).toLocaleString(undefined,{maximumFractionDigits:10})} = box · prepared deep history`,true)}
function refreshMatrixIfNeeded(T=tv()){
  if(!T||!matrixWorker||matrixRefreshBusy||matrixContext!==matrixBaseContext(T)||T.state.symbol!==XAUT||T.settings.interval!==XAUT_INTERVAL)return false;
  const rev=sourceRevision(T);if(!(rev>matrixRevision))return false;
  const rows=(T.state.closedBars||[]).filter(b=>Number(b.closeTime)>matrixRevision);if(!rows.length)return false;
  matrixRefreshBusy=true;matrixWorker.postMessage({type:'refresh',token:matrixToken,newBars:rows,revision:rev});return true;
}
async function waitMatrixRevision(T,timeout=8000){
  const rev=sourceRevision(T);if(matrixRevision===rev)return true;refreshMatrixIfNeeded(T);const end=Date.now()+timeout;while(Date.now()<end){if(matrixRevision===sourceRevision(T)&&matrixContext===matrixBaseContext(T))return true;await sleep(80)}return false;
}
async function applyPreparedMatrix(length,{automatic=false}={}){
  const T=tv();length=parseLength(length);if(!matrixEligible(length,T))return false;
  if(matrixWorker&&matrixContext===matrixBaseContext(T)&&matrixRevision!==sourceRevision(T))await waitMatrixRevision(T);
  let e=matrixEntries.get(length);
  if(!e||e.context!==matrixBaseContext(T)||e.revision!==sourceRevision(T)||!e.satisfied||!e.base){
    if(!automatic){setAtrBadge(`PREPARING · ${length}`);setLoad(`ATR ${length.toLocaleString()} · preparing Gate 1m history off the main thread…`,false)}
    const ok=await warmMatrix(T);if(!ok)return false;e=matrixEntries.get(length);
  }
  if(!e?.satisfied||!e?.base){stamp(T,length,length,false,true);setAtrBadge(`UNAVAILABLE · ${length}`);setLoad(`ATR ${length.toLocaleString()} cannot be calculated exactly from available Gate 1m history`,false);return false}
  const before=mutationSnapshot(T),lt0=longTasks.length,t0=performance.now();T.settings.atrLength=length;T.settings.method='atr';T.settings._exactBox=e.rawAtr;saveLength(length);activeMatrixLength=length;activeMatrixBase=e.base;
  try{T.rebuild({fit:false})}finally{activeMatrixBase=null}
  T.state.atr=e.rawAtr;T.state.box=e.rawAtr;const applyMs=Math.max(0,performance.now()-t0),longTaskDelta=Math.max(0,longTasks.length-lt0);stampPrepared(T,e,length,applyMs,longTaskDelta);markMutation(T,length,before);renderPreparedMeta(T,e,length);return true;
}

async function ensureAtrHistory(length,{fit=false}={}){
  const T=tv();if(!T)return false;if(matrixEligible(length,T))return applyPreparedMatrix(length);
  const s=T.state,generation=s.generation,target=length,before=mutationSnapshot(T);delete T.settings._exactBox;activeMatrixLength=0;T.settings.atrLength=length;T.settings.method='atr';saveLength(length);setAtrBadge(`APPLYING · ${length}`);
  if(s.closedBars.length>=target){stamp(T,length,target,true,false);T.rebuild({fit:false});const{changed}=markMutation(T,length,before);setAtrBadge(`ACTIVE · ${length}`);setLoad(`LIVE · ATR ${length.toLocaleString()} applied · box ${Number(s.box).toLocaleString(undefined,{maximumFractionDigits:8})} · chart rebuilt${changed?'':' · same effective output'}`,true);return true}
  let stagnant=0,attempts=0,exhausted=false,maxAttempts=Math.max(2,Math.ceil(Math.max(0,target-s.closedBars.length)/1000)+3);
  try{
    setLoad(`ATR ${length.toLocaleString()} · loading source history ${s.closedBars.length.toLocaleString()} / ${target.toLocaleString()}…`,false);
    while(generation===s.generation&&s.closedBars.length<target&&attempts<maxAttempts){if(queuedLength!==null&&queuedLength!==length)break;const added=await fetchOlderDirect(T,generation);attempts++;if(!added){stagnant++;if(stagnant>=2){exhausted=true;break}}else stagnant=0;setLoad(`ATR ${length.toLocaleString()} · loading source history ${s.closedBars.length.toLocaleString()} / ${target.toLocaleString()}…`,false);await nextFrame();await sleep(8)}
    if(generation!==s.generation||(queuedLength!==null&&queuedLength!==length))return false;
    const satisfied=s.closedBars.length>=length;stamp(T,length,target,satisfied,exhausted);T.settings.atrLength=length;T.settings.method='atr';saveLength(length);T.rebuild({fit:false});const{changed}=markMutation(T,length,before);setAtrBadge(`ACTIVE · ${length}`);setLoad(satisfied?`LIVE · ATR ${length.toLocaleString()} applied · ${s.closedBars.length.toLocaleString()} source bars · box ${Number(s.box).toLocaleString(undefined,{maximumFractionDigits:8})} · chart rebuilt${changed?'':' · same effective output'}`:`ATR ${length.toLocaleString()} needs ${length.toLocaleString()} bars; provider supplied ${s.closedBars.length.toLocaleString()} · chart rebuilt from available history`,satisfied);return satisfied;
  }catch(e){console.warn('[RENKO ATR history]',e);stamp(T,length,target,false,true);setAtrBadge(`ACTIVE · ${length}`);setLoad(`ATR ${length.toLocaleString()} history load failed · chart remains interactive`,false);return false}
}
async function drainApplyQueue(length){queuedLength=parseLength(length);if(applying)return false;applying=true;try{while(queuedLength!==null){const next=queuedLength;queuedLength=null;const T=tv();if(!T)break;T.state.atrApplySerial=++applySerial;await ensureAtrHistory(next,{fit:false})}return true}finally{applying=false}}
async function applyAtrFromInput(){const T=tv();if(!T)return false;const length=parseLength(document.getElementById('atrLength')?.value);T.settings.atrLength=length;T.settings.method='atr';saveLength(length);return drainApplyQueue(length)}
function restorePersistedLength(){const T=tv();if(!T)return;try{const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{},length=parseLength(raw.atrLength);T.settings.atrLength=length;const input=document.getElementById('atrLength');if(input)input.value=String(length)}catch{}}
function reconcileWithoutLoading(){const T=tv();if(!T||T.settings.method!=='atr')return false;const length=parseLength(T.settings.atrLength),s=T.state;if(matrixEligible(length,T))return false;if(s.closedBars.length<length)return false;stamp(T,length,length,true,false);setAtrBadge(`ACTIVE · ${length}`);return true}
function markPending(){const input=document.getElementById('atrLength');if(!input)return;const length=parseLength(input.value),applied=Number(input.dataset.appliedLength||0);if(length!==applied)setAtrBadge(`PENDING · ${length}`)}

/* Clear the deep exact box before the base app processes a source/context change. */
document.addEventListener('change',e=>{if(!['sourceSelect','intervalSelect','wicksToggle'].includes(e.target?.id))return;const T=tv();if(!T)return;delete T.settings._exactBox;activeMatrixLength=0;if(matrixWorker)queueMicrotask(()=>clearMatrix('source-context-change'))},true);
document.addEventListener('click',e=>{const other=e.target?.closest?.('[data-apply-method="traditional"],[data-apply-method="percentage"]');if(other){const T=tv();if(T){delete T.settings._exactBox;activeMatrixLength=0}}const btn=e.target?.closest?.('[data-apply-method="atr"]');if(!btn)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void applyAtrFromInput()},true);
const input=document.getElementById('atrLength');if(input){input.addEventListener('input',markPending,{passive:true});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();void applyAtrFromInput()}},true);input.addEventListener('change',()=>void applyAtrFromInput(),true)}
restorePersistedLength();
window.addEventListener('renko:tv-ready',()=>{
  restorePersistedLength();const T=tv();if(!T)return;
  if(MATRIX_AUTO&&T.state.symbol===XAUT&&T.settings.interval===XAUT_INTERVAL)void warmMatrix(T);
  if(T.settings.method!=='atr')return;
  const n=parseLength(T.settings.atrLength);if(matrixEligible(n,T))void drainApplyQueue(n);else if(!reconcileWithoutLoading())void drainApplyQueue(n);
},{once:true});
setInterval(()=>{
  const T=tv();if(!T)return;
  if(T.state.symbol===XAUT&&T.settings.interval===XAUT_INTERVAL&&T.state.status==='live'){
    const context=matrixBaseContext(T);if(matrixContext&&matrixContext!==context)clearMatrix('source-or-generation-change');if(matrixWorker)refreshMatrixIfNeeded(T);
  }else if(matrixWorker)clearMatrix('not-xaut-1m');
  if(applying||queuedLength!==null||T.settings.method!=='atr'||T.state.status!=='live')return;
  const length=parseLength(T.settings.atrLength),s=T.state;
  if(matrixEligible(length,T)){const e=matrixEntries.get(length);if(e?.revision===sourceRevision(T)&&e?.context===matrixBaseContext(T)&&e?.satisfied)return;if(matrixWorker||activeMatrixLength===length||MATRIX_AUTO)void drainApplyQueue(length);return}
  if(s.atrHistoryGeneration===s.generation&&s.atrRequestedLength===length&&(s.atrHistorySatisfied||s.atrHistoryExhausted))return;
  if(s.closedBars.length>=length){reconcileWithoutLoading();return}void drainApplyQueue(length);
},3000);
window.RWARenkoATRParity={version:'5.0.0',rule:'raw-wilder-plus-same-origin-xaut-million-history-pack',matrix:MATRIX,parseLength,ensureAtrHistory,applyAtrFromInput,drainApplyQueue,warmMatrix,applyPreparedMatrix,refreshMatrixIfNeeded,get applying(){return applying},get queuedLength(){return queuedLength},get matrixReady(){return document.documentElement.dataset.atrMatrixReady},get matrixWarmMs(){return matrixLastWarmMs},matrixEntries};
})();
