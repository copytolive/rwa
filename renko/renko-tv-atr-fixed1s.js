/* Fixed-1s XAUT ATR matrix runtime. Deep history is computed off-main-thread and loaded only when explicitly requested. */
(()=>{
'use strict';
if(window.RWARenkoATRFixed1s)return;
const MATRIX=[1,10,100,1000,10000,100000,1000000], SET=new Set(MATRIX), XAUT='XAUTUSDT';
const STORE='rwa_renko_tradingview_settings_v1', PACK='xaut-okx-1s-pack.csv.gz?v=2', META='xaut-okx-1s-pack.meta.json?v=2';
let worker=null, token=0, warmPromise=null, warmReject=null, entries=new Map(), revision=0, warmMs=0, applying=false;
const longTasks=[];
try{const po=new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push({start:e.startTime,duration:e.duration});while(longTasks.length>500)longTasks.shift()});po.observe({type:'longtask',buffered:true})}catch{}
const tv=()=>window.RWARenkoTV||null;
const parseLength=v=>{const n=Math.floor(Number(v));return Number.isFinite(n)&&n>=1?n:14};
const same=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-12,Math.abs(Number(b))*1e-10);
const currentRevision=T=>{const b=T?.state?.closedBars?.at?.(-1);return Number(b?.closeTime||b?.openTime)||0};
function lock(T=tv()){if(!T)return;T.settings.interval='1s';document.documentElement.dataset.fixedInterval='1s';document.querySelector('#intervalSelect')?.remove();const e=document.getElementById('currentInterval');if(e)e.textContent='1s'}
function save(n){try{const r=JSON.parse(localStorage.getItem(STORE)||'{}')||{};r.interval='1s';r.atrLength=n;r.method='atr';localStorage.setItem(STORE,JSON.stringify(r))}catch{}}
function badge(s){const e=document.querySelector('.method[data-method="atr"] .method-title span');if(e)e.textContent=s}
function load(s,live=false){const e=document.getElementById('tvLoadState');if(e){e.textContent=s;e.className=`load-state ${live?'live':''}`}}
function metric(){let e=document.getElementById('atrFixed1sMetric');if(e)return e;const a=document.getElementById('tvLoadState');if(!a?.parentNode)return null;e=document.createElement('span');e.id='atrFixed1sMetric';e.className='pill';a.parentNode.insertBefore(e,a);return e}
function setMetric(s){const e=metric();if(e)e.textContent=s}
function makeWorker(){
  if(worker)return worker;
  const src=String.raw`
'use strict';
const MATRIX=[1,10,100,1000,10000,100000,1000000];
let state=new Map(),prev=NaN,count=0,from=0,to=0,packTo=0,active=0;
function reset(){state=new Map(MATRIX.map(n=>[n,{n,seen:0,sum:0,atr:NaN}]));prev=NaN;count=0;from=0;to=0;packTo=0}
function push(t,h,l,c){const tr=Number.isFinite(prev)?Math.max(h-l,Math.abs(h-prev),Math.abs(l-prev)):h-l;prev=c;if(!from)from=t;to=t+999;count++;for(const n of MATRIX){const s=state.get(n);s.seen++;if(s.seen<=n){s.sum+=tr;if(s.seen===n)s.atr=s.sum/n}else{s.atr=((s.atr*(n-1))+tr)/n}}}
function output(){return MATRIX.map(n=>{const s=state.get(n),a=Number(s.atr);return{length:n,rawAtr:a,box:a,sourceCount:count,fromTime:from,toTime:to,satisfied:s.seen>=n&&Number.isFinite(a)&&a>0}})}
async function getMeta(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('meta HTTP '+r.status);const m=await r.json();if(m?.schema!=='renko-xaut-okx-1s-pack-v2'||m?.instrument!=='XAUT-USDT'||m?.interval!=='1s'||Number(m?.intervalMs)!==1000||Number(m?.rows)<1000000||m?.provenance?.sourceBar!=='1s'||Number(m?.provenance?.sourceIntervalMs)!==1000||m?.provenance?.upsampled!==false||m?.provenance?.synthetic1s!==false)throw new Error('invalid XAUT fixed-1s pack v2');return m}
async function gunzipText(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('pack HTTP '+r.status);if(typeof DecompressionStream!=='function')throw new Error('DecompressionStream gzip unavailable');return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text()}
function addBars(a){for(const b of a||[]){const t=Number(b.openTime),h=Number(b.high),l=Number(b.low),c=Number(b.close);if(![t,h,l,c].every(Number.isFinite)||t<=packTo)continue;push(t,h,l,c);packTo=t}}
async function warm(d){active=d.token;reset();const start=Date.now();postMessage({type:'progress',token:d.token,pct:1,stage:'metadata'});const m=await getMeta(d.metaUrl);postMessage({type:'progress',token:d.token,pct:5,stage:'download'});const text=await gunzipText(d.packUrl);postMessage({type:'progress',token:d.token,pct:20,stage:'atr'});let last=0,i=0,pos=0;while(pos<text.length){let end=text.indexOf('\n',pos);if(end<0)end=text.length;const line=text.slice(pos,end);pos=end+1;if(!line)continue;const p=line.split(',');if(p.length<6)continue;const t=Number(p[0]),h=Number(p[2]),l=Number(p[3]),c=Number(p[4]);if(![t,h,l,c].every(Number.isFinite))continue;if(last&&t-last!==1000)throw new Error('1s pack discontinuity at '+t);push(t,h,l,c);last=t;i++;if(i%100000===0)postMessage({type:'progress',token:d.token,pct:20+Math.min(70,Math.round(i/Number(m.rows)*70)),stage:'atr',available:i})}
packTo=last;if(count!==Number(m.rows))throw new Error('pack row mismatch '+count+' != '+m.rows);addBars(d.displayBars);postMessage({type:'ready',token:d.token,entries:output(),available:count,revision:Number(d.revision)||to,warmMs:Date.now()-start,meta:m})}
function refresh(d){if(d.token!==active)return;addBars((d.newBars||[]).sort((a,b)=>Number(a.openTime)-Number(b.openTime)));postMessage({type:'ready',token:d.token,entries:output(),available:count,revision:Number(d.revision)||to,warmMs:0,refresh:true})}
onmessage=e=>{const d=e.data||{};if(d.type==='warm')warm(d).catch(err=>postMessage({type:'error',token:d.token,error:String(err?.message||err)}));else if(d.type==='refresh')try{refresh(d)}catch(err){postMessage({type:'error',token:d.token,error:String(err?.message||err)})}};
`;
  worker=new Worker(URL.createObjectURL(new Blob([src],{type:'application/javascript'})));
  return worker;
}
function accept(d,T,resolve,reject){
  if(d.token!==token||!T)return;
  if(d.type==='progress'){document.documentElement.dataset.atrMatrixProgress=String(d.pct||0);setMetric(`ATR 1s MATRIX · ${d.pct||0}% · ${d.stage||'working'}${d.available?` · ${Number(d.available).toLocaleString()} bars`:''}`);return}
  if(d.type==='error'){document.documentElement.dataset.atrMatrixReady='error';document.documentElement.dataset.atrMatrixError=String(d.error||'unknown').slice(0,500);setMetric(`ATR 1s MATRIX · ERROR · ${d.error}`);reject?.(new Error(d.error));return}
  if(d.type!=='ready')return;
  entries=new Map((d.entries||[]).map(x=>[Number(x.length),x]));revision=Number(d.revision)||0;warmMs=Number(d.warmMs)||warmMs;
  const ok=MATRIX.every(n=>entries.get(n)?.satisfied);
  document.documentElement.dataset.atrMatrixReady=ok?'true':'partial';
  document.documentElement.dataset.atrMatrixError='';
  document.documentElement.dataset.atrMatrixAvailable=String(d.available||0);
  document.documentElement.dataset.atrMatrixRevision=String(revision);
  document.documentElement.dataset.atrMatrixWarmMs=String(warmMs);
  document.documentElement.dataset.atrMatrixProvider='OKX Spot XAUT-USDT fixed 1s';
  setMetric(ok?`ATR 1s MATRIX · READY 7/7 · ${Number(d.available).toLocaleString()} OKX 1s bars`:`ATR 1s MATRIX · PARTIAL`);
  if(!d.refresh){ok?resolve?.(true):reject?.(new Error('fixed-1s ATR matrix incomplete'))}
}
function dispose(reason='dispose'){
  token++;
  if(worker){try{worker.terminate()}catch{}worker=null}
  if(warmReject){try{warmReject(new Error(`ATR warm cancelled: ${reason}`))}catch{}warmReject=null}
  warmPromise=null;entries.clear();revision=0;warmMs=0;applying=false;
  const d=document.documentElement.dataset;d.atrMatrixReady='idle';d.atrMatrixProgress='0';d.atrMatrixAvailable='0';d.atrMatrixRevision='0';d.atrMatrixWarmMs='0';d.atrMatrixError='';d.atrMatrixProvider='OKX Spot XAUT-USDT fixed 1s · on demand';
  setMetric('ATR 1s MATRIX · ON DEMAND');
}
async function warm(T=tv()){
  if(!T||T.state?.symbol!==XAUT||T.state?.status!=='live'||!T.state?.closedBars?.length)return false;
  lock(T);const rev=currentRevision(T);
  if(entries.size===MATRIX.length&&document.documentElement.dataset.atrMatrixReady==='true')return true;
  if(warmPromise&&document.documentElement.dataset.atrMatrixReady==='warming')return warmPromise;
  if(worker){try{worker.terminate()}catch{}worker=null}
  entries.clear();document.documentElement.dataset.atrMatrixReady='warming';document.documentElement.dataset.atrMatrixError='';setMetric('ATR 1s MATRIX · preparing on demand 0%');
  const w=makeWorker(),my=++token;
  warmPromise=new Promise((resolve,reject)=>{warmReject=reject;w.onmessage=e=>accept(e.data||{},T,resolve,reject);w.onerror=e=>reject(new Error(e.message||'ATR worker failed'))});
  w.postMessage({type:'warm',token:my,packUrl:new URL(PACK,location.href).href,metaUrl:new URL(META,location.href).href,displayBars:T.state.closedBars,revision:rev});
  try{return await warmPromise}catch(e){const msg=String(e?.message||e);if(!/cancelled/.test(msg))console.warn('[RENKO fixed 1s ATR]',e);document.documentElement.dataset.atrMatrixReady='error';document.documentElement.dataset.atrMatrixError=msg.slice(0,500);setMetric(`ATR 1s MATRIX · ERROR · ${msg}`);return false}finally{warmPromise=null;warmReject=null}
}
function tbtSince(mark){return longTasks.filter(x=>x.start>=mark).reduce((a,x)=>a+Math.max(0,x.duration-50),0)}
async function apply(length){
  const T=tv();if(!T)return false;lock(T);const n=parseLength(length);
  if(!SET.has(n)){delete T.settings._exactBox;T.settings.atrLength=n;T.settings.method='atr';save(n);if(T.state.closedBars.length<n){badge(`NEEDS HISTORY · ${n}`);load(`ATR ${n.toLocaleString()} needs fixed-1s history`);return false}T.rebuild({fit:false});badge(`ACTIVE · ${n}`);return true}
  let e=entries.get(n);if(!e?.satisfied){badge(`PREPARING · ${n}`);load(`ATR ${n.toLocaleString()} · preparing fixed 1s OKX history on demand…`);if(!await warm(T))return false;e=entries.get(n)}
  if(!e?.satisfied)return false;
  const mark=performance.now();applying=true;
  try{T.settings.atrLength=n;T.settings.method='atr';T.settings._exactBox=Number(e.rawAtr);save(n);T.rebuild({fit:false});Object.assign(T.state,{atr:Number(e.rawAtr),box:Number(e.rawAtr),atrRaw:Number(e.rawAtr),atrRequestedLength:n,atrAppliedLength:n,atrHistorySatisfied:true,atrHistorySourceCount:Number(e.sourceCount),atrHistoryFrom:Number(e.fromTime),atrHistoryTo:Number(e.toTime),atrHistoryGeneration:T.state.generation,atrMatrixPrepared:true,atrMatrixProvider:'OKX Spot XAUT-USDT fixed 1s'})}finally{applying=false}
  const elapsed=performance.now()-mark,tbt=tbtSince(mark),pass=same(T.state.box,e.rawAtr);
  Object.assign(document.documentElement.dataset,{atrLength:String(n),atrAppliedLength:String(n),atrHistorySatisfied:'true',atrRawBoxPass:pass?'true':'false',atrMatrixApplyMs:String(elapsed),atrMatrixTbtMs:String(tbt)});
  const inp=document.getElementById('atrLength');if(inp){inp.value=String(n);inp.dataset.appliedLength=String(n)}
  const a=document.getElementById('currentAtr');if(a)a.textContent=Number(e.rawAtr).toLocaleString(undefined,{maximumFractionDigits:10});
  const c=document.getElementById('sourceBarCount');if(c)c.textContent=Number(e.sourceCount).toLocaleString();
  badge(`ACTIVE · ${n}`);load(`LIVE · fixed 1s · ATR ${n.toLocaleString()} · raw Wilder = box · TBT ${tbt.toFixed(1)} ms`,true);
  T.state.atrLastApply={length:n,rawAtr:Number(e.rawAtr),box:Number(T.state.box),rawBoxPass:pass,sourceCount:Number(e.sourceCount),elapsedMs:elapsed,tbtMs:tbt,interval:'1s',at:Date.now()};
  return pass&&T.settings.interval==='1s';
}
async function fromInput(){return apply(parseLength(document.getElementById('atrLength')?.value))}
document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-apply-method="atr"]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void fromInput()},true);
const input=document.getElementById('atrLength');if(input){input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void fromInput()}},true);input.addEventListener('change',e=>{e.stopImmediatePropagation();void fromInput()},true)}
window.addEventListener('renko:tv-ready',()=>{const T=tv();lock(T);if(T?.state?.symbol===XAUT){document.documentElement.dataset.atrMatrixReady='idle';document.documentElement.dataset.atrMatrixProvider='OKX Spot XAUT-USDT fixed 1s · on demand';setMetric('ATR 1s MATRIX · ON DEMAND')}},{once:true});
window.addEventListener('renko:symbol-switch-start',e=>{const d=e.detail||{};if(d.from===XAUT&&d.to!==XAUT)dispose('pair-switch')});
setInterval(()=>{const T=tv();if(!T)return;lock(T);if(T.state?.symbol!==XAUT||T.state?.status!=='live'||!worker)return;const cur=currentRevision(T);if(revision&&cur>revision){const newer=(T.state.closedBars||[]).filter(b=>Number(b.closeTime)>revision);if(newer.length)worker.postMessage({type:'refresh',token,newBars:newer,revision:cur})}},1500);
const api={version:'2.2.1-lazy-pack-v2',matrix:MATRIX,parseLength,warm,apply,dispose,get entries(){return entries},get revision(){return revision},get warmMs(){return warmMs},get applying(){return applying},get workerActive(){return !!worker},get entryCount(){return entries.size}};
window.RWARenkoATRFixed1s=api;
window.RWARenkoATRParity={version:'fixed-1s-2.2.1-lazy-pack-v2',rule:'fixed-1s-okx-deep-wilder-matrix-on-demand',matrix:MATRIX,parseLength,warmMatrix:warm,applyPreparedMatrix:apply,ensureAtrHistory:apply,applyAtrFromInput:fromInput,drainApplyQueue:apply,dispose,get applying(){return applying},get matrixReady(){return document.documentElement.dataset.atrMatrixReady},get matrixWarmMs(){return warmMs},get matrixEntries(){return entries},get workerActive(){return !!worker}};
})();
