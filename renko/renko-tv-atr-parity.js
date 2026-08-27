/* ATR parity + live-settings regression lock for TradingView-documented Renko.
 *
 * Guarantees:
 * - ATR Length is the actual Wilder ATR look-back used by RWARenkoTVEngine.
 * - Apply / Enter / committed input changes always rebuild the real chart state.
 * - The latest user request wins; clicks are never silently dropped while older
 *   history is loading.
 * - Large ATR lengths pull older source candles progressively without blocking
 *   the UI, then perform one geometry rebuild.
 * - Applying ATR does not force a fit/reset, preserving a user's manual zoom.
 */
(()=>{
'use strict';
const STORE='rwa_renko_tradingview_settings_v1';
const DATA_ROOT='https://data-api.binance.vision';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const nextFrame=()=>new Promise(r=>(window.requestAnimationFrame||setTimeout)(r));
let applying=false,queuedLength=null,applySerial=0;

function tv(){return window.RWARenkoTV||null}
function parseLength(v){const n=Math.floor(Number(v));return Number.isFinite(n)&&n>=1?n:14}
function saveLength(length){
  try{
    const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{};
    raw.atrLength=length;raw.method='atr';
    localStorage.setItem(STORE,JSON.stringify(raw));
  }catch{}
}
function setLoad(text,live=false){
  const el=document.getElementById('tvLoadState');if(!el)return;
  el.textContent=text;el.className=`load-state ${live?'live':''}`;
}
function setAtrBadge(text){
  const badge=document.querySelector('.method[data-method="atr"] .method-title span');
  if(badge)badge.textContent=text;
}
function stamp(T,length,target,satisfied,exhausted=false){
  const s=T.state;
  s.atrRequestedLength=length;s.atrHistoryTarget=target;s.atrHistorySatisfied=!!satisfied;
  s.atrHistoryExhausted=!!exhausted;s.atrHistoryGeneration=s.generation;
  s.atrAppliedLength=length;s.atrAppliedAt=Date.now();
  const input=document.getElementById('atrLength');
  if(input){input.value=String(length);input.dataset.appliedLength=String(length);input.setAttribute('aria-label',`ATR Length ${length} applied to chart`)}
  document.documentElement.dataset.atrLength=String(length);
  document.documentElement.dataset.atrAppliedLength=String(length);
  document.documentElement.dataset.atrHistorySatisfied=satisfied?'true':'false';
}
function mapRows(rows){
  return (Array.isArray(rows)?rows:[]).map(x=>({
    openTime:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),
    volume:Number(x[5])||0,closeTime:Number(x[6])
  })).filter(b=>[b.openTime,b.open,b.high,b.low,b.close,b.closeTime].every(Number.isFinite));
}
function mergeBars(a,b){
  const m=new Map();for(const x of [...(a||[]),...(b||[])])m.set(Number(x.openTime),x);
  return [...m.values()].sort((x,y)=>x.openTime-y.openTime);
}
async function fetchOlderDirect(T,generation){
  const s=T.state,oldest=Number(s.closedBars?.[0]?.openTime);
  if(!Number.isFinite(oldest))return 0;
  const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),15000);
  try{
    const q=`/api/v3/klines?symbol=${encodeURIComponent(s.symbol)}&interval=${encodeURIComponent(T.settings.interval)}&limit=1000&endTime=${Math.floor(oldest-1)}`;
    const r=await fetch(DATA_ROOT+q,{cache:'no-store',credentials:'omit',signal:ctrl.signal});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const older=mapRows(await r.json()).filter(b=>b.openTime<oldest);
    if(generation!==s.generation||!older.length)return 0;
    const before=s.closedBars.length;
    s.closedBars=mergeBars(older,s.closedBars);
    s.historyPages=Math.max(1,Number(s.historyPages)||1)+1;
    return Math.max(0,s.closedBars.length-before);
  }finally{clearTimeout(tm)}
}
function mutationSnapshot(T){
  const s=T.state;
  return {box:Number(s.box),atr:Number(s.atr),count:Number(s.confirmed?.length||0),anchor:Number(s.base?.anchor),bars:Number(s.closedBars?.length||0)};
}
function markMutation(T,length,before){
  const s=T.state,after=mutationSnapshot(T),tick=Math.max(0,Number(s.tickSize)||0);
  const changed=(Number.isFinite(before.box)&&Number.isFinite(after.box)&&Math.abs(before.box-after.box)>Math.max(1e-12,tick*.5))||before.count!==after.count||before.anchor!==after.anchor;
  s.atrLastApply={length,before,after,changed,at:Date.now()};
  document.documentElement.dataset.atrChartRebuilt='true';
  document.documentElement.dataset.atrChartChanged=changed?'true':'same-effective-output';
  return {after,changed};
}

async function ensureAtrHistory(length,{fit=false}={}){
  const T=tv();if(!T)return false;
  const s=T.state,generation=s.generation,target=length,before=mutationSnapshot(T);
  T.settings.atrLength=length;T.settings.method='atr';saveLength(length);
  setAtrBadge(`APPLYING · ${length}`);

  if(s.closedBars.length>=target){
    stamp(T,length,target,true,false);
    T.rebuild({fit:false});
    const {changed}=markMutation(T,length,before);
    setAtrBadge(`ACTIVE · ${length}`);
    setLoad(`LIVE · ATR ${length.toLocaleString()} applied · box ${Number(s.box).toLocaleString(undefined,{maximumFractionDigits:8})} · chart rebuilt${changed?'':' · same rounded output'}`,true);
    return true;
  }

  let stagnant=0,attempts=0,exhausted=false;
  const maxAttempts=Math.max(2,Math.ceil(Math.max(0,target-s.closedBars.length)/1000)+3);
  try{
    setLoad(`ATR ${length.toLocaleString()} · loading source history ${s.closedBars.length.toLocaleString()} / ${target.toLocaleString()}…`,false);
    while(generation===s.generation&&s.closedBars.length<target&&attempts<maxAttempts){
      if(queuedLength!==null&&queuedLength!==length)break;
      const added=await fetchOlderDirect(T,generation);attempts++;
      if(!added){stagnant++;if(stagnant>=2){exhausted=true;break}}else stagnant=0;
      setLoad(`ATR ${length.toLocaleString()} · loading source history ${s.closedBars.length.toLocaleString()} / ${target.toLocaleString()}…`,false);
      await nextFrame();await sleep(8);
    }
    if(generation!==s.generation)return false;
    if(queuedLength!==null&&queuedLength!==length)return false;
    const satisfied=s.closedBars.length>=length;
    stamp(T,length,target,satisfied,exhausted);
    T.settings.atrLength=length;T.settings.method='atr';saveLength(length);
    T.rebuild({fit:false});
    const {changed}=markMutation(T,length,before);
    setAtrBadge(`ACTIVE · ${length}`);
    if(satisfied)setLoad(`LIVE · ATR ${length.toLocaleString()} applied · ${s.closedBars.length.toLocaleString()} source bars · box ${Number(s.box).toLocaleString(undefined,{maximumFractionDigits:8})} · chart rebuilt${changed?'':' · same rounded output'}`,true);
    else setLoad(`ATR ${length.toLocaleString()} needs ${length.toLocaleString()} bars; provider supplied ${s.closedBars.length.toLocaleString()} · chart rebuilt from available history`,false);
    return satisfied;
  }catch(e){
    console.warn('[RENKO ATR history]',e);
    stamp(T,length,target,false,true);setAtrBadge(`ACTIVE · ${length}`);
    setLoad(`ATR ${length.toLocaleString()} history load failed · chart remains interactive`,false);
    return false;
  }
}

async function drainApplyQueue(length){
  queuedLength=parseLength(length);
  if(applying)return false;
  applying=true;
  try{
    while(queuedLength!==null){
      const next=queuedLength;queuedLength=null;const serial=++applySerial;
      const T=tv();if(!T)break;
      T.state.atrApplySerial=serial;
      await ensureAtrHistory(next,{fit:false});
    }
    return true;
  }finally{applying=false}
}
async function applyAtrFromInput(){
  const T=tv();if(!T)return false;
  const length=parseLength(document.getElementById('atrLength')?.value);
  T.settings.atrLength=length;T.settings.method='atr';saveLength(length);
  return drainApplyQueue(length);
}
function restorePersistedLength(){
  const T=tv();if(!T)return;
  try{
    const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{},length=parseLength(raw.atrLength);
    T.settings.atrLength=length;const input=document.getElementById('atrLength');if(input)input.value=String(length);
  }catch{}
}
function reconcileWithoutLoading(){
  const T=tv();if(!T||T.settings.method!=='atr')return false;
  const length=parseLength(T.settings.atrLength),s=T.state;
  if(s.closedBars.length<length)return false;
  stamp(T,length,length,true,false);setAtrBadge(`ACTIVE · ${length}`);return true;
}
function markPending(){
  const input=document.getElementById('atrLength');if(!input)return;
  const length=parseLength(input.value),applied=Number(input.dataset.appliedLength||0);
  if(length!==applied)setAtrBadge(`PENDING · ${length}`);
}

// Capture before the app's legacy button listener. This prevents its old 500
// clamp and its fit=true chart reset from winning.
document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('[data-apply-method="atr"]');if(!btn)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void applyAtrFromInput();
},true);
const input=document.getElementById('atrLength');
if(input){
  input.addEventListener('input',markPending,{passive:true});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();void applyAtrFromInput()}},true);
  input.addEventListener('change',()=>void applyAtrFromInput(),true);
}

restorePersistedLength();
window.addEventListener('renko:tv-ready',()=>{
  restorePersistedLength();const T=tv();if(T?.settings?.method!=='atr')return;
  if(!reconcileWithoutLoading())void drainApplyQueue(parseLength(T.settings.atrLength));
},{once:true});

// Generation guard for symbol/timeframe changes. It never overwrites a newer
// input request and only fetches when the selected ATR look-back truly needs it.
setInterval(()=>{
  const T=tv();if(!T||applying||queuedLength!==null||T.settings.method!=='atr'||T.state.status!=='live')return;
  const length=parseLength(T.settings.atrLength),s=T.state;
  if(s.atrHistoryGeneration===s.generation&&s.atrRequestedLength===length&&(s.atrHistorySatisfied||s.atrHistoryExhausted))return;
  if(s.closedBars.length>=length){reconcileWithoutLoading();return}
  void drainApplyQueue(length);
},5000);

window.RWARenkoATRParity={version:'3.0.0',rule:'real-wilder-lookback-latest-request-wins-no-zoom-reset',parseLength,ensureAtrHistory,applyAtrFromInput,drainApplyQueue,get applying(){return applying},get queuedLength(){return queuedLength}};
})();
