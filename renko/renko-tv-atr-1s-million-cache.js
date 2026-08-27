/* Deep ATR accelerator for the fixed 1-second Close production profile.
 *
 * Heavy history acquisition and Wilder ATR calculation run inside a Web Worker.
 * The main thread keeps only the normal visible chart history. For prepared
 * values, APPLY swaps in an exact precomputed Renko base and is gated at 0 ms
 * Total Blocking Time. This is not a claim of literal zero wall-clock latency.
 */
(()=>{
'use strict';
if(window.RWARenkoATRInstant)return;
const E=window.RWARenkoTVEngine;if(!E)return;
const ORIGINAL_BUILD=E.build.bind(E);
const STORE='rwa_renko_tradingview_settings_v1';
const TARGETS=[1,10,100,1000,10000,100000,1000000];
const TARGET_SET=new Set(TARGETS);
const DATA_ROOT='https://data-api.binance.vision';
const DEEP_VERSION='2.0.0';
const parseLength=v=>{const n=Math.floor(Number(v));return Number.isFinite(n)&&n>=1?n:14};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let worker=null,workerToken=0,warmPromise=null,warmContext='',warmBase='',activeApply=null,pendingMetric=null,lastWorkerRevision=0;
const entries=new Map(),longTasks=[];

try{if('PerformanceObserver'in window){const po=new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push({start:e.startTime,duration:e.duration});while(longTasks.length>300)longTasks.shift()});po.observe({type:'longtask',buffered:true})}}catch{}
function tv(){return window.RWARenkoTV||null}
function sourceRevision(T=tv()){const b=T?.state?.closedBars?.at?.(-1);return Number(b?.closeTime||b?.openTime)||0}
function baseContext(T=tv()){if(!T)return'';const s=T.state,st=T.settings;return[s.generation,s.symbol,'1s','close',st.wicks!==false?'w1':'w0',Number(s.tickSize)||0].join('|')}
function contextKey(T=tv()){const b=baseContext(T);return b?`${b}|${sourceRevision(T)}`:''}
function barsKey(bars){const a=Array.isArray(bars)?bars:[],f=a[0],l=a.at(-1);return[a.length,Number(f?.openTime)||0,Number(l?.openTime)||0,Number(l?.closeTime)||0].join(':')}
function ensureMetric(){let el=document.getElementById('atrInstantMetric');if(el)return el;const load=document.getElementById('tvLoadState');if(!load?.parentNode)return null;el=document.createElement('span');el.id='atrInstantMetric';el.className='pill';el.setAttribute('aria-live','polite');load.parentNode.insertBefore(el,load);return el}
function setMetric(text,kind=''){const el=ensureMetric();if(el){el.textContent=text;el.dataset.kind=kind}}
function fmtDate(ms){try{return new Date(Number(ms)).toLocaleString(undefined,{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch{return'—'}}
function saveLength(length){try{const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{};raw.atrLength=length;raw.method='atr';raw.source='close';raw.interval='1s';localStorage.setItem(STORE,JSON.stringify(raw))}catch{}}
function makeWorker(){
  if(worker)return worker;
  const token=++workerToken,engineUrl=new URL('renko-tv-engine.js?v=160',location.href).href;
  const src=`
  'use strict';
  let E=null,states=new Map(),targets=[],tick=.01,symbol='',revision=0,baseCount=0,coverageTo=0;
  const ROOT='${DATA_ROOT}',CONC=18,STEP=1000,CHUNK_MS=1000000;
  function decimals(x){const s=String(x);if(s.includes('e-'))return Math.min(12,Number(s.split('e-')[1])||0);const i=s.indexOf('.');return i<0?0:Math.min(12,s.length-i-1)}
  function roundTick(v,t){if(!(t>0))return v;const d=decimals(t);return Number((Math.round(v/t)*t).toFixed(d))}
  function required(n){return n<=1000?1999:n+999}
  async function fetchChunk(j,anchor){
    const end=Math.floor(anchor-j*CHUNK_MS),url=ROOT+'/api/v3/klines?symbol='+encodeURIComponent(symbol)+'&interval=1s&limit=1000&endTime='+end;
    let err=null;for(let a=0;a<4;a++){try{const r=await fetch(url,{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(e){err=e;await new Promise(r=>setTimeout(r,80*(a+1)))} }throw err||new Error('1s history fetch failed')
  }
  function tr(row,prev){const h=Number(row[2]),l=Number(row[3]),c=Number(row[4]);return{v:Number.isFinite(prev)?Math.max(h-l,Math.abs(h-prev),Math.abs(l-prev)):h-l,c}}
  function pushState(s,row){const t=tr(row,s.prev);s.prev=t.c;s.seen++;if(s.seen===1)s.from=Number(row[0]);s.to=Number(row[6]);if(s.seen<=s.length){s.sum+=t.v;if(s.seen===s.length)s.atr=s.sum/s.length}else{s.atr=((s.atr*(s.length-1))+t.v)/s.length}}
  function parseDisplay(rows){return(rows||[]).map(x=>({openTime:Number(x.openTime),open:Number(x.open),high:Number(x.high),low:Number(x.low),close:Number(x.close),volume:Number(x.volume)||0,closeTime:Number(x.closeTime)})).filter(b=>[b.openTime,b.open,b.high,b.low,b.close,b.closeTime].every(Number.isFinite))}
  function buildEntries(display,wicks){const bars=parseDisplay(display),out=[];for(const n of targets){const s=states.get(n),raw=Number(s?.atr),box=Math.max(tick,roundTick(raw,tick));const base=E.build(bars,{method:'traditional',boxSize:box,source:'close',wicks:wicks!==false},tick);base.atr=box;base.box=box;base.source='close';out.push({length:n,atr:box,box,sourceCount:s?.seen||0,fromTime:s?.from||0,toTime:s?.to||revision,base})}return out}
  async function warm(d){
    if(!E){importScripts(d.engineUrl);E=self.RWARenkoTVEngine}symbol=d.symbol;tick=Number(d.tick)||.01;targets=d.targets;revision=Number(d.anchor)||0;coverageTo=revision;
    const maxN=Math.max(...targets.map(required)),chunks=Math.ceil(maxN/1000),excess=chunks*1000-maxN;states=new Map();
    for(const n of targets)states.set(n,{length:n,required:required(n),start:maxN-required(n),seen:0,sum:0,atr:NaN,prev:NaN,from:0,to:0});
    let global=0,skip=excess;
    for(let hi=chunks-1;hi>=0;hi-=CONC){const ids=[];for(let j=hi;j>=Math.max(0,hi-CONC+1);j--)ids.push(j);const got=await Promise.all(ids.map(j=>fetchChunk(j,revision).then(rows=>({j,rows}))));got.sort((a,b)=>b.j-a.j);for(const g of got){for(const row of g.rows){if(skip>0){skip--;continue}for(const n of targets){const s=states.get(n);if(global>=s.start)pushState(s,row)}global++}}self.postMessage({type:'progress',token:d.token,done:Math.min(chunks,chunks-hi+CONC-1),total:chunks})}
    baseCount=global;const entries=buildEntries(d.displayBars,d.wicks);self.postMessage({type:'ready',token:d.token,revision,entries,baseCount});
  }
  function refresh(d){if(!E||d.symbol!==symbol)return;const rows=(d.newBars||[]).filter(b=>Number(b.closeTime)>revision).sort((a,b)=>Number(a.closeTime)-Number(b.closeTime));for(const b of rows){const row=[b.openTime,b.open,b.high,b.low,b.close,b.volume||0,b.closeTime];for(const n of targets)pushState(states.get(n),row);revision=Math.max(revision,Number(b.closeTime)||0)}if(Number(d.revision)>revision)revision=Number(d.revision);const entries=buildEntries(d.displayBars,d.wicks);self.postMessage({type:'ready',token:d.token,revision,entries,baseCount:baseCount+rows.length,refresh:true})}
  self.onmessage=e=>{const d=e.data||{};if(d.type==='warm')warm(d).catch(err=>self.postMessage({type:'error',token:d.token,error:String(err&&err.message||err)}));else if(d.type==='refresh')try{refresh(d)}catch(err){self.postMessage({type:'error',token:d.token,error:String(err&&err.message||err)})}};
  `;
  worker=new Worker(URL.createObjectURL(new Blob([src],{type:'application/javascript'})));
  worker._token=token;worker._engineUrl=engineUrl;return worker;
}
function entryFor(length,T=tv()){const e=entries.get(length);if(!e||!T)return null;const rev=sourceRevision(T),ctx=baseContext(T);return e.baseContext===ctx&&e.revision===rev&&e.displayKey===barsKey(T.state.closedBars)?e:null}
function acceptReady(d,T){
  if(!T||d.token!==worker?._warmToken)return;
  const currentBase=baseContext(T);if(currentBase!==warmBase)return;
  lastWorkerRevision=Number(d.revision)||0;for(const x of d.entries||[]){entries.set(x.length,{...x,revision:lastWorkerRevision,baseContext:currentBase,displayKey:barsKey(T.state.closedBars)})}
  warmContext=`${currentBase}|${lastWorkerRevision}`;document.documentElement.dataset.atrInstantContext=warmContext;
  if(lastWorkerRevision===sourceRevision(T)){document.documentElement.dataset.atrInstantReady='true';setMetric('ATR 1s CLOSE CACHE · READY 7/7','pass')}else{document.documentElement.dataset.atrInstantReady='syncing';setMetric('ATR 1s CLOSE CACHE · syncing latest 1s close')}
}
function attachWorkerHandlers(w,T,resolve,reject){
  w.onmessage=e=>{const d=e.data||{};if(d.token!==w._warmToken)return;if(d.type==='progress'){const pct=Math.min(100,Math.round((Number(d.done)||0)/(Number(d.total)||1)*100));setMetric(`ATR 1s CLOSE CACHE · ${pct}% background warm`);document.documentElement.dataset.atrInstantProgress=String(pct)}else if(d.type==='ready'){acceptReady(d,T);if(!d.refresh)resolve(true)}else if(d.type==='error'){document.documentElement.dataset.atrInstantReady='error';setMetric('ATR 1s CLOSE CACHE · fallback safe','warn');reject(new Error(d.error||'deep ATR worker failed'))}};
  w.onerror=e=>{document.documentElement.dataset.atrInstantReady='error';reject(new Error(e.message||'deep ATR worker failed'))};
}
async function warm(T=tv()){
  if(!T||T.state.status!=='live'||!T.state.closedBars?.length||!(T.state.tickSize>0))return false;
  T.settings.source='close';T.settings.interval='1s';const base=baseContext(T);if(!base)return false;
  if(warmPromise&&warmBase===base){await warmPromise.catch(()=>false);await catchUp(T);return document.documentElement.dataset.atrInstantReady==='true'}
  if(worker){try{worker.terminate()}catch{}worker=null}entries.clear();warmBase=base;warmContext='';lastWorkerRevision=0;document.documentElement.dataset.atrInstantReady='false';
  const w=makeWorker(),token=Date.now()+Math.random();w._warmToken=token;setMetric('ATR 1s CLOSE CACHE · background warm 0%');
  warmPromise=new Promise((resolve,reject)=>attachWorkerHandlers(w,T,resolve,reject));
  w.postMessage({type:'warm',token,engineUrl:w._engineUrl,symbol:T.state.symbol,tick:T.state.tickSize,anchor:sourceRevision(T),targets:TARGETS,displayBars:T.state.closedBars,wicks:T.settings.wicks});
  try{await warmPromise;await catchUp(T);return document.documentElement.dataset.atrInstantReady==='true'}catch(e){console.warn('[RENKO ATR 1s deep cache]',e);return false}
}
async function catchUp(T=tv()){
  if(!T||!worker||warmBase!==baseContext(T))return false;
  for(let i=0;i<12;i++){
    const rev=sourceRevision(T);if(lastWorkerRevision===rev){warmContext=contextKey(T);document.documentElement.dataset.atrInstantReady='true';return true}
    const newBars=T.state.closedBars.filter(b=>Number(b.closeTime)>lastWorkerRevision);const token=worker._warmToken;worker.postMessage({type:'refresh',token,symbol:T.state.symbol,revision:rev,newBars,displayBars:T.state.closedBars,wicks:T.settings.wicks});await sleep(40);
  }
  return false;
}
function stampDeepMeta(T,e){
  const s=T.state;s.atrRequestedLength=e.length;s.atrAppliedLength=e.length;s.atrAppliedAt=Date.now();s.atrHistoryTarget=e.length;s.atrHistorySatisfied=e.sourceCount>=e.length;s.atrHistoryExhausted=false;s.atrHistoryGeneration=s.generation;s.atrHistorySourceCount=e.sourceCount;s.atrHistoryFrom=e.fromTime;s.atrHistoryTo=e.toTime;
  document.documentElement.dataset.atrLength=String(e.length);document.documentElement.dataset.atrAppliedLength=String(e.length);document.documentElement.dataset.atrHistorySatisfied=s.atrHistorySatisfied?'true':'false';
  const input=document.getElementById('atrLength');if(input){input.value=String(e.length);input.dataset.appliedLength=String(e.length)}
}
function renderDeepMeta(T,e){
  const count=document.getElementById('sourceBarCount'),cov=document.getElementById('tvCoverage'),badge=document.querySelector('.method[data-method="atr"] .method-title span'),load=document.getElementById('tvLoadState');
  if(count)count.textContent=Number(e.sourceCount).toLocaleString();if(cov)cov.textContent=`${fmtDate(e.fromTime)} → ${fmtDate(e.toTime)} · ${Number(e.sourceCount).toLocaleString()} 1s CLOSE source bars`;if(badge)badge.textContent=`ACTIVE · ${e.length}`;if(load){load.textContent=`LIVE · ATR ${e.length.toLocaleString()} · 1s CLOSE · box ${Number(T.state.box).toLocaleString(undefined,{maximumFractionDigits:8})} · exact cache`;load.className='load-state live'}
}
function finalizeMetric(p){if(!p||pendingMetric!==p)return;const now=performance.now(),blocking=longTasks.filter(x=>x.start>=p.started&&x.start<=now).reduce((sum,x)=>sum+Math.max(0,x.duration-50),0),rounded=Math.max(0,Math.round(blocking));document.documentElement.dataset.atrBlockingMs=String(rounded);document.documentElement.dataset.atrInstantCacheHit=p.cacheHit?'true':'false';document.documentElement.dataset.atrInstantFrameMs=String(Math.round((now-p.started)*10)/10);const T=tv();if(T)T.state.atrInstantMetric={length:p.length,blockingMs:rounded,frameMs:now-p.started,buildMs:p.buildMs,cacheHit:p.cacheHit,at:Date.now()};setMetric(p.cacheHit?`ATR ${p.length.toLocaleString()} · ${rounded} ms BLOCKING · EXACT 1s CLOSE CACHE`:`ATR ${p.length.toLocaleString()} · fallback compute`,p.cacheHit&&rounded===0?'pass':'warn')}
function applyPrepared(length){
  const T=tv(),e=entryFor(length,T);if(!T||!e)return false;
  const before={box:Number(T.state.box),atr:Number(T.state.atr),count:T.state.confirmed?.length||0,anchor:Number(T.state.base?.anchor),bars:T.state.closedBars?.length||0};
  T.settings.source='close';T.settings.interval='1s';T.settings.method='atr';T.settings.atrLength=length;saveLength(length);stampDeepMeta(T,e);
  const started=performance.now(),p={length,started,cacheHit:false,buildMs:NaN,e};pendingMetric=p;activeApply=e;document.documentElement.dataset.atrInstantStaged='true';document.documentElement.dataset.atrBlockingMs='pending';
  T.rebuild({fit:false});activeApply=null;const after={box:Number(T.state.box),atr:Number(T.state.atr),count:T.state.confirmed?.length||0,anchor:Number(T.state.base?.anchor),bars:T.state.closedBars?.length||0};T.state.atrLastApply={length,before,after,changed:before.box!==after.box||before.count!==after.count||before.anchor!==after.anchor,at:Date.now()};document.documentElement.dataset.atrChartRebuilt='true';document.documentElement.dataset.atrChartChanged=T.state.atrLastApply.changed?'true':'same-effective-output';renderDeepMeta(T,e);requestAnimationFrame(()=>requestAnimationFrame(()=>finalizeMetric(p)));return true
}
E.build=function(bars,settings={},tick=0){
  if(activeApply&&String(settings.method||'').toLowerCase()==='atr'&&parseLength(settings.atrLength)===activeApply.length&&barsKey(bars)===activeApply.displayKey&&sourceRevision(tv())===activeApply.revision){activeApply.base.atr=activeApply.atr;activeApply.base.box=activeApply.box;if(pendingMetric){pendingMetric.cacheHit=true;pendingMetric.buildMs=performance.now()-pendingMetric.started}return activeApply.base}
  return ORIGINAL_BUILD(bars,settings,tick)
};
function intercept(e,length){
  if(!TARGET_SET.has(length))return false;
  if(applyPrepared(length)){e?.preventDefault?.();e?.stopImmediatePropagation?.();return true}
  e?.preventDefault?.();e?.stopImmediatePropagation?.();setMetric(`ATR ${length.toLocaleString()} · preparing exact 1s CLOSE cache`,'staged');void warm().then(()=>applyPrepared(length));return true
}
const input=document.getElementById('atrLength');if(input){input.addEventListener('change',e=>intercept(e,parseLength(input.value)),true);input.addEventListener('keydown',e=>{if(e.key==='Enter')intercept(e,parseLength(input.value))},true);input.addEventListener('focus',()=>void warm(),{passive:true})}
document.addEventListener('click',e=>{const btn=e.target?.closest?.('[data-apply-method="atr"]');if(btn)intercept(e,parseLength(document.getElementById('atrLength')?.value))},true);
document.querySelector('.method[data-method="atr"]')?.addEventListener('pointerenter',()=>void warm(),{passive:true});
setInterval(()=>{const T=tv();if(!T||T.state.status!=='live')return;if(baseContext(T)!==warmBase){warmPromise=null;void warm(T);return}if(lastWorkerRevision!==sourceRevision(T))void catchUp(T);const e=entries.get(parseLength(T.settings.atrLength));if(T.settings.method==='atr'&&e&&e.revision===sourceRevision(T))renderDeepMeta(T,e)},350);
window.addEventListener('renko:tv-ready',()=>{const skip=/tvOfficialReport=1|ultrafast/i.test(location.search);if(!skip)setTimeout(()=>void warm(),250)},{once:true});
window.RWARenkoATRInstant={version:DEEP_VERSION,rule:'worker-deep-history-fixed-1s-close-seven-target-zero-main-thread-blocking',targets:[...TARGETS],warm,applyPrepared,stageInstant:applyPrepared,contextKey,entryFor,get cacheSize(){return entries.size},get warmContext(){return warmContext},get lastWorkerRevision(){return lastWorkerRevision}};
})();
