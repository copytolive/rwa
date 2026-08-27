/* Zero-blocking ATR switch accelerator.
 *
 * Goal: make already-prepared ATR switches feel instantaneous without lying about
 * physics. Network/history and Renko calculation are prewarmed off the critical
 * interaction path. The user-visible guarantee is 0 ms Total Blocking Time (TBT)
 * for a cache-hit switch, not literally 0 ms wall-clock CPU/network time.
 *
 * The real chart still uses RWARenkoTVEngine output. No fake geometry, labels-only
 * updates, zoom reset, or ATR clamping are allowed.
 */
(()=>{
'use strict';
if(window.RWARenkoATRInstant)return;
const E=window.RWARenkoTVEngine;if(!E)return;
const ORIGINAL_BUILD=E.build.bind(E);
const DATA_ROOT='https://data-api.binance.vision';
const TARGETS=[14,140,500,6000,10000];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const parseLength=v=>{const n=Math.floor(Number(v));return Number.isFinite(n)&&n>=1?n:14};
let warmSerial=0,warmContext='',worker=null,workerSeq=0,pendingBuilds=new Map(),pendingInstant=null;
const cache=new Map();
const longTasks=[];

try{
  if('PerformanceObserver'in window){
    const po=new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push({start:e.startTime,duration:e.duration});while(longTasks.length>200)longTasks.shift()});
    po.observe({type:'longtask',buffered:true});
  }
}catch{}

function tv(){return window.RWARenkoTV||null}
function contextKey(T=tv()){
  if(!T)return'';const s=T.state,st=T.settings;
  return [s.generation,s.symbol,st.interval,st.source,st.wicks!==false?'w1':'w0',Number(s.tickSize)||0].join('|');
}
function barsKey(bars){
  const a=Array.isArray(bars)?bars:[],f=a[0],l=a.at(-1);
  return [a.length,Number(f?.openTime)||0,Number(l?.openTime)||0,Number(l?.closeTime)||0].join(':');
}
function entryKey(ctx,length,bars){return `${ctx}|atr:${length}|bars:${barsKey(bars)}`}
function allEntries(ctx,length){
  const prefix=`${ctx}|atr:${length}|bars:`;return [...cache.entries()].filter(([k])=>k.startsWith(prefix)).map(([,v])=>v).sort((a,b)=>a.bars.length-b.bars.length);
}
function exactEntry(ctx,length,bars){return cache.get(entryKey(ctx,length,bars))||null}
function bestEntry(T,length){
  const ctx=contextKey(T),n=T?.state?.closedBars?.length||0,rows=allEntries(ctx,length);
  return rows.find(x=>x.bars.length>=n)||rows.at(-1)||null;
}
function ensureMetric(){
  let el=document.getElementById('atrInstantMetric');if(el)return el;
  const load=document.getElementById('tvLoadState');if(!load?.parentNode)return null;
  el=document.createElement('span');el.id='atrInstantMetric';el.className='pill';el.textContent='ATR INSTANT CACHE · warming';el.setAttribute('aria-live','polite');
  load.parentNode.insertBefore(el,load);return el;
}
function setMetric(text,kind=''){
  const el=ensureMetric();if(!el)return;el.textContent=text;el.dataset.kind=kind;
}
function mapRows(rows){
  return (Array.isArray(rows)?rows:[]).map(x=>({openTime:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[5])||0,closeTime:Number(x[6])})).filter(b=>[b.openTime,b.open,b.high,b.low,b.close,b.closeTime].every(Number.isFinite));
}
function mergeBars(a,b){const m=new Map();for(const x of [...(a||[]),...(b||[])])m.set(Number(x.openTime),x);return[...m.values()].sort((x,y)=>x.openTime-y.openTime)}
async function fetchOlderCopy(T,bars,serial){
  const oldest=Number(bars?.[0]?.openTime);if(!Number.isFinite(oldest))return bars;
  const q=`/api/v3/klines?symbol=${encodeURIComponent(T.state.symbol)}&interval=${encodeURIComponent(T.settings.interval)}&limit=1000&endTime=${Math.floor(oldest-1)}`;
  const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(DATA_ROOT+q,{cache:'no-store',credentials:'omit',signal:ctrl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    if(serial!==warmSerial)return bars;
    const older=mapRows(await r.json()).filter(b=>b.openTime<oldest);if(!older.length)return bars;
    return mergeBars(older,bars);
  }finally{clearTimeout(tm)}
}
function ensureWorker(){
  if(worker)return worker;
  const engineUrl=new URL('renko-tv-engine.js?v=160',location.href).href;
  const source=`let ready=false;self.onmessage=e=>{const d=e.data||{};if(d.type!=='build')return;try{if(!ready){importScripts(d.engineUrl);ready=true}const base=self.RWARenkoTVEngine.build(d.bars,d.settings,d.tick);self.postMessage({id:d.id,ok:true,base})}catch(err){self.postMessage({id:d.id,ok:false,error:String(err&&err.message||err)})}}`;
  worker=new Worker(URL.createObjectURL(new Blob([source],{type:'application/javascript'})));
  worker.onmessage=e=>{const d=e.data||{},p=pendingBuilds.get(d.id);if(!p)return;pendingBuilds.delete(d.id);d.ok?p.resolve(d.base):p.reject(new Error(d.error||'ATR worker build failed'))};
  worker.onerror=e=>{for(const [,p]of pendingBuilds)p.reject(new Error(e.message||'ATR worker failed'));pendingBuilds.clear()};
  worker._engineUrl=engineUrl;return worker;
}
function workerBuild(bars,settings,tick){
  const w=ensureWorker(),id=++workerSeq;
  return new Promise((resolve,reject)=>{pendingBuilds.set(id,{resolve,reject});w.postMessage({type:'build',id,engineUrl:w._engineUrl,bars,settings,tick})});
}
async function cacheBuild(T,ctx,length,bars,serial){
  const key=entryKey(ctx,length,bars);if(cache.has(key))return cache.get(key);
  const settings={...T.settings,method:'atr',atrLength:length};
  const base=await workerBuild(bars,settings,T.state.tickSize);if(serial!==warmSerial||ctx!==contextKey(T))return null;
  const entry={ctx,length,bars,base,key,preparedAt:Date.now()};cache.set(key,entry);return entry;
}
async function warm(T=tv()){
  if(!T||T.state.status!=='live'||!T.state.closedBars?.length||!(T.state.tickSize>0))return false;
  const ctx=contextKey(T);if(!ctx)return false;
  if(warmContext===ctx&&document.documentElement.dataset.atrInstantReady==='true')return true;
  const serial=++warmSerial;warmContext=ctx;document.documentElement.dataset.atrInstantReady='false';setMetric('ATR INSTANT CACHE · warming');
  try{
    let bars=T.state.closedBars.slice();
    for(const length of TARGETS){
      while(serial===warmSerial&&ctx===contextKey(T)&&bars.length<length){
        const next=await fetchOlderCopy(T,bars,serial);if(next.length===bars.length)break;bars=next;await sleep(6);
      }
      if(serial!==warmSerial||ctx!==contextKey(T))return false;
      await cacheBuild(T,ctx,length,bars,serial);
      const ready=TARGETS.filter(n=>allEntries(ctx,n).length>0).length;setMetric(`ATR INSTANT CACHE · ${ready}/${TARGETS.length} ready`);
      await sleep(0);
    }
    // Once deep history exists, also precompute smaller look-backs over the same
    // deepest history so switching back after ATR 10,000 remains cache-hit fast.
    for(const length of TARGETS.slice(0,-1)){
      if(serial!==warmSerial||ctx!==contextKey(T))return false;
      await cacheBuild(T,ctx,length,bars,serial);await sleep(0);
    }
    if(serial!==warmSerial||ctx!==contextKey(T))return false;
    document.documentElement.dataset.atrInstantReady='true';document.documentElement.dataset.atrInstantContext=ctx;
    setMetric('ATR INSTANT CACHE · READY');return true;
  }catch(e){
    console.warn('[RENKO ATR instant cache]',e);document.documentElement.dataset.atrInstantReady='error';setMetric('ATR INSTANT CACHE · fallback safe');return false;
  }
}
function scheduleWarm(delay=0){
  const run=()=>void warm();
  if(delay>0){setTimeout(()=>('requestIdleCallback'in window?requestIdleCallback(run,{timeout:1200}):run()),delay)}
  else if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:800});else setTimeout(run,0);
}
function stageInstant(length){
  const T=tv();if(!T||T.settings.method!=='atr'&&document.querySelector('[data-apply-method="atr"]')==null)return false;
  const entry=bestEntry(T,length);if(!entry)return false;
  const s=T.state,current=s.closedBars?.length||0;if(entry.bars.length<current)return false;
  if(entry.bars.length>current){s.closedBars=entry.bars;s.historyPages=Math.max(Number(s.historyPages)||1,Math.ceil(entry.bars.length/1000))}
  const started=performance.now();pendingInstant={length,ctx:entry.ctx,key:entry.key,started,cacheHit:false,buildMs:NaN};
  document.documentElement.dataset.atrInstantStaged='true';document.documentElement.dataset.atrInstantLength=String(length);document.documentElement.dataset.atrBlockingMs='pending';
  setMetric(`ATR ${length.toLocaleString()} · INSTANT staged`,'staged');
  requestAnimationFrame(()=>requestAnimationFrame(()=>finalizeInstant(pendingInstant)));
  return true;
}
function finalizeInstant(p){
  if(!p||pendingInstant!==p)return;
  const now=performance.now(),blocking=longTasks.filter(x=>x.start>=p.started&&x.start<=now).reduce((sum,x)=>sum+Math.max(0,x.duration-50),0);
  const roundedBlocking=Math.max(0,Math.round(blocking));
  document.documentElement.dataset.atrBlockingMs=String(roundedBlocking);document.documentElement.dataset.atrInstantCacheHit=p.cacheHit?'true':'false';
  document.documentElement.dataset.atrInstantFrameMs=String(Math.round((now-p.started)*10)/10);
  const T=tv(),box=Number(T?.state?.box);T.state.atrInstantMetric={length:p.length,blockingMs:roundedBlocking,frameMs:now-p.started,buildMs:p.buildMs,cacheHit:p.cacheHit,at:Date.now()};
  if(p.cacheHit&&roundedBlocking===0)setMetric(`ATR ${p.length.toLocaleString()} · 0 ms BLOCKING · EXACT CACHE`,'pass');
  else if(p.cacheHit)setMetric(`ATR ${p.length.toLocaleString()} · ${roundedBlocking} ms BLOCKING · EXACT CACHE`,'warn');
  else setMetric(`ATR ${p.length.toLocaleString()} · fallback compute`,'fallback');
  if(Number.isFinite(box))document.documentElement.dataset.atrInstantBox=String(box);
}

// Cache-aware engine wrapper. App rebuild still executes its normal render/audit
// path; only the expensive pure Renko build is replaced by the exact precomputed
// result when bars/settings match.
E.build=function(bars,settings={},tick=0){
  if(String(settings.method||'').toLowerCase()==='atr'){
    const T=tv(),ctx=T?contextKey(T):'',length=parseLength(settings.atrLength),entry=ctx?exactEntry(ctx,length,bars):null;
    if(entry){
      if(pendingInstant&&pendingInstant.length===length){pendingInstant.cacheHit=true;pendingInstant.buildMs=performance.now()-pendingInstant.started}
      return entry.base;
    }
  }
  return ORIGINAL_BUILD(bars,settings,tick);
};

// Register BEFORE renko-tv-atr-parity.js. On a prepared click this synchronously
// attaches the already-fetched history so the parity layer immediately takes its
// no-network fast branch and rebuilds from the exact cached engine output.
document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('[data-apply-method="atr"]');if(!btn)return;
  const length=parseLength(document.getElementById('atrLength')?.value);stageInstant(length);
},true);
document.getElementById('atrLength')?.addEventListener('focus',()=>scheduleWarm(0),{passive:true});
document.querySelector('.method[data-method="atr"]')?.addEventListener('pointerenter',()=>scheduleWarm(0),{passive:true});
window.addEventListener('renko:tv-ready',()=>scheduleWarm(250),{once:true});

// If the ready event happened unusually early, or the symbol/interval changes,
// warm the new context without touching startup-critical rendering.
setInterval(()=>{
  const T=tv();if(!T||T.state.status!=='live')return;const ctx=contextKey(T);
  if(ctx&&ctx!==warmContext)scheduleWarm(0);
},1500);

window.RWARenkoATRInstant={version:'1.0.0',rule:'exact-worker-prewarm-zero-ms-total-blocking-cache-hit',targets:[...TARGETS],warm,stageInstant,bestEntry,get cacheSize(){return cache.size},get warmContext(){return warmContext}};
})();
