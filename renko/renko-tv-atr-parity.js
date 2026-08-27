/* ATR parity lock for TradingView-documented Renko behavior.
 * Purpose: ATR Length is a real look-back period. Do not silently clamp large
 * values to 500. When the requested look-back exceeds loaded source history,
 * progressively pull older source bars before the final ATR rebuild.
 */
(()=>{
'use strict';
const STORE='rwa_renko_tradingview_settings_v1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let applying=false;

function tv(){return window.RWARenkoTV||null}
function parseLength(v){const n=Math.floor(Number(v));return Number.isFinite(n)&&n>=1?n:14}
function saveLength(length){
  try{
    const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{};
    raw.atrLength=length;
    raw.method='atr';
    localStorage.setItem(STORE,JSON.stringify(raw));
  }catch{}
}
function setLoad(text,live=false){
  const el=document.getElementById('tvLoadState');
  if(!el)return;
  el.textContent=text;
  el.className=`load-state ${live?'live':''}`;
}
function stamp(T,length,target,satisfied,exhausted=false){
  const s=T.state;
  s.atrRequestedLength=length;
  s.atrHistoryTarget=target;
  s.atrHistorySatisfied=!!satisfied;
  s.atrHistoryExhausted=!!exhausted;
  s.atrHistoryGeneration=s.generation;
  const input=document.getElementById('atrLength');
  if(input){input.value=String(length);input.dataset.appliedLength=String(length)}
  document.documentElement.dataset.atrLength=String(length);
  document.documentElement.dataset.atrHistorySatisfied=satisfied?'true':'false';
}

async function ensureAtrHistory(length,{fit=true}={}){
  const T=tv();if(!T||applying)return false;
  applying=true;
  const s=T.state;
  const generation=s.generation;
  const target=Math.max(1000,length+1);
  let stagnant=0,attempts=0,exhausted=false;
  try{
    setLoad(`ATR ${length.toLocaleString()} · loading source history ${s.closedBars.length.toLocaleString()} / ${target.toLocaleString()}…`,false);
    const maxAttempts=Math.max(8,Math.ceil(Math.max(0,target-s.closedBars.length)/1000)+10);
    while(generation===s.generation&&s.closedBars.length<target&&attempts<maxAttempts){
      // The base app originally had a five-page convenience cap. ATR look-back
      // must not inherit that UI cap, so reopen pagination while actual provider
      // history still exists.
      if(s.historyPages>=5)s.historyPages=4;
      const before=s.closedBars.length;
      const ok=await T.loadOlderPage();
      await sleep(ok?25:140);
      const after=s.closedBars.length;
      if(after<=before){stagnant++;if(stagnant>=5){exhausted=true;break}}
      else stagnant=0;
      attempts++;
      setLoad(`ATR ${length.toLocaleString()} · loading source history ${after.toLocaleString()} / ${target.toLocaleString()}…`,false);
    }
    if(generation!==s.generation)return false;
    const satisfied=s.closedBars.length>=length;
    stamp(T,length,target,satisfied,exhausted);
    T.settings.atrLength=length;
    T.settings.method='atr';
    saveLength(length);
    T.rebuild({fit});
    if(satisfied){
      setLoad(`LIVE · ATR ${length.toLocaleString()} applied · ${s.closedBars.length.toLocaleString()} source bars · box ${Number(s.box).toLocaleString(undefined,{maximumFractionDigits:8})}`,true);
    }else{
      setLoad(`ATR ${length.toLocaleString()} needs ${length.toLocaleString()} bars; provider supplied ${s.closedBars.length.toLocaleString()} · using available history`,false);
    }
    return satisfied;
  }finally{applying=false}
}

async function applyAtrFromInput(){
  const T=tv();if(!T)return;
  const input=document.getElementById('atrLength');
  const length=parseLength(input?.value);
  T.settings.atrLength=length;
  T.settings.method='atr';
  saveLength(length);
  await ensureAtrHistory(length,{fit:true});
}

function restorePersistedLength(){
  const T=tv();if(!T)return;
  try{
    const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{};
    const length=parseLength(raw.atrLength);
    T.settings.atrLength=length;
    const input=document.getElementById('atrLength');
    if(input)input.value=String(length);
  }catch{}
}

// Capture before the legacy target listener so values above 500 are never
// silently rewritten back to 500.
document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('[data-apply-method="atr"]');
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  void applyAtrFromInput();
},true);

restorePersistedLength();
window.addEventListener('renko:tv-ready',()=>{
  restorePersistedLength();
  const T=tv();if(T?.settings?.method==='atr')void ensureAtrHistory(parseLength(T.settings.atrLength),{fit:true});
},{once:true});

// Symbol/timeframe reloads are performed inside the base app's private event
// handlers. This small guard makes sure a large ATR look-back is re-satisfied
// after those reloads without changing Traditional or Percentage behavior.
setInterval(()=>{
  const T=tv();if(!T||applying||T.settings.method!=='atr'||T.state.status!=='live')return;
  const length=parseLength(T.settings.atrLength);
  const s=T.state;
  if(s.atrHistoryGeneration===s.generation&&s.atrRequestedLength===length&&(s.atrHistorySatisfied||s.atrHistoryExhausted))return;
  if(s.closedBars.length<length||s.atrHistoryGeneration!==s.generation)void ensureAtrHistory(length,{fit:false});
},1500);

window.RWARenkoATRParity={version:'1.0.0',parseLength,ensureAtrHistory,applyAtrFromInput,get applying(){return applying}};
})();
