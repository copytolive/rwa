/* ATR parity + performance lock for TradingView-documented Renko behavior.
 * ATR Length is a real look-back period. Large values are never silently
 * clamped. Older klines are appended directly and the expensive Renko rebuild
 * runs once at the end, rather than once per history page.
 */
(()=>{
'use strict';
const STORE='rwa_renko_tradingview_settings_v1';
const DATA_ROOT='https://data-api.binance.vision';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const nextFrame=()=>new Promise(r=>(window.requestAnimationFrame||setTimeout)(r));
let applying=false;

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
function stamp(T,length,target,satisfied,exhausted=false){
  const s=T.state;
  s.atrRequestedLength=length;s.atrHistoryTarget=target;s.atrHistorySatisfied=!!satisfied;
  s.atrHistoryExhausted=!!exhausted;s.atrHistoryGeneration=s.generation;
  const input=document.getElementById('atrLength');
  if(input){input.value=String(length);input.dataset.appliedLength=String(length)}
  document.documentElement.dataset.atrLength=String(length);
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

async function ensureAtrHistory(length,{fit=true}={}){
  const T=tv();if(!T||applying)return false;
  const s=T.state,generation=s.generation,target=length;
  if(s.closedBars.length>=target){
    T.settings.atrLength=length;T.settings.method='atr';saveLength(length);
    stamp(T,length,target,true,false);T.rebuild({fit});
    return true;
  }
  applying=true;
  let stagnant=0,attempts=0,exhausted=false;
  const maxAttempts=Math.max(2,Math.ceil(Math.max(0,target-s.closedBars.length)/1000)+3);
  try{
    setLoad(`ATR ${length.toLocaleString()} · loading source history ${s.closedBars.length.toLocaleString()} / ${target.toLocaleString()}…`,false);
    while(generation===s.generation&&s.closedBars.length<target&&attempts<maxAttempts){
      const added=await fetchOlderDirect(T,generation);
      attempts++;
      if(!added){stagnant++;if(stagnant>=2){exhausted=true;break}}else stagnant=0;
      setLoad(`ATR ${length.toLocaleString()} · loading source history ${s.closedBars.length.toLocaleString()} / ${target.toLocaleString()}…`,false);
      // Yield between network pages so controls, scrolling and websocket paint
      // remain responsive even for very large look-back values.
      await nextFrame();await sleep(8);
    }
    if(generation!==s.generation)return false;
    const satisfied=s.closedBars.length>=length;
    stamp(T,length,target,satisfied,exhausted);
    T.settings.atrLength=length;T.settings.method='atr';saveLength(length);
    // One expensive geometry rebuild only, after all required history exists.
    T.rebuild({fit});
    if(satisfied)setLoad(`LIVE · ATR ${length.toLocaleString()} applied · ${s.closedBars.length.toLocaleString()} source bars · box ${Number(s.box).toLocaleString(undefined,{maximumFractionDigits:8})}`,true);
    else setLoad(`ATR ${length.toLocaleString()} needs ${length.toLocaleString()} bars; provider supplied ${s.closedBars.length.toLocaleString()} · using available history`,false);
    return satisfied;
  }catch(e){
    console.warn('[RENKO ATR history]',e);
    stamp(T,length,target,false,true);
    setLoad(`ATR ${length.toLocaleString()} history load failed · chart remains interactive`,false);
    return false;
  }finally{applying=false}
}

async function applyAtrFromInput(){
  const T=tv();if(!T)return;
  const length=parseLength(document.getElementById('atrLength')?.value);
  T.settings.atrLength=length;T.settings.method='atr';saveLength(length);
  await ensureAtrHistory(length,{fit:true});
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
  stamp(T,length,length,true,false);return true;
}

// Capture before the legacy target listener so values above 500 are never
// silently rewritten to 500.
document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('[data-apply-method="atr"]');if(!btn)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void applyAtrFromInput();
},true);

restorePersistedLength();
window.addEventListener('renko:tv-ready',()=>{
  restorePersistedLength();const T=tv();if(T?.settings?.method!=='atr')return;
  if(!reconcileWithoutLoading())void ensureAtrHistory(parseLength(T.settings.atrLength),{fit:false});
},{once:true});

// Low-frequency generation guard. If a symbol/timeframe reload already carries
// enough candles, merely stamp it; do not trigger another history fetch.
setInterval(()=>{
  const T=tv();if(!T||applying||T.settings.method!=='atr'||T.state.status!=='live')return;
  const length=parseLength(T.settings.atrLength),s=T.state;
  if(s.atrHistoryGeneration===s.generation&&s.atrRequestedLength===length&&(s.atrHistorySatisfied||s.atrHistoryExhausted))return;
  if(s.closedBars.length>=length){reconcileWithoutLoading();return}
  void ensureAtrHistory(length,{fit:false});
},5000);

window.RWARenkoATRParity={version:'2.0.0',parseLength,ensureAtrHistory,applyAtrFromInput,get applying(){return applying}};
})();
