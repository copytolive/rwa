/* ATR control router.
 * XAUT keeps the deep OKX 1s matrix runtime. Every other pair uses its own
 * Binance fixed-1s bars and must never be intercepted by the XAUT-only matrix.
 */
(()=>{
'use strict';
if(window.RWARenkoATRControl)return;
const XAUT='XAUTUSDT';
const STORE='rwa_renko_tradingview_settings_v1';
const tv=()=>window.RWARenkoTV||null;
const parse=v=>{const n=Math.floor(Number(v));return Number.isFinite(n)&&n>=1?n:14};
const same=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-12,Math.abs(Number(b))*1e-10);
function isLocal(){const T=tv();return !!T&&!!T.state?.symbol&&T.state.symbol!==XAUT}
function badge(s){const e=document.querySelector('.method[data-method="atr"] .method-title span');if(e)e.textContent=s}
function load(s,live=false){const e=document.getElementById('tvLoadState');if(e){e.textContent=s;e.className=`load-state ${live?'live':''}`}}
function save(T,n){try{const r=JSON.parse(localStorage.getItem(STORE)||'{}')||{};r.interval='1s';r.atrLength=n;r.method='atr';localStorage.setItem(STORE,JSON.stringify(r))}catch{};T.settings.atrLength=n;T.settings.method='atr'}
async function ensureHistory(T,n){
  if((T.state?.closedBars?.length||0)>=n)return true;
  let guard=0;
  while((T.state?.closedBars?.length||0)<n&&Number(T.state?.historyPages||0)<5&&guard++<5){
    const before=T.state.closedBars.length;
    const ok=await T.loadOlderPage?.();
    if(!ok||T.state.closedBars.length<=before)break;
  }
  return (T.state?.closedBars?.length||0)>=n;
}
async function applyLocal(value,source='control'){
  const T=tv();if(!T||T.state?.symbol===XAUT)return false;
  const n=parse(value),symbol=T.state.symbol;
  badge(`APPLYING · ${n}`);
  document.documentElement.dataset.atrControlStatus='applying';
  if(!await ensureHistory(T,n)){
    const available=Number(T.state?.closedBars?.length||0);
    badge(`NEEDS HISTORY · ${n}`);
    load(`ATR ${n.toLocaleString()} needs ${n.toLocaleString()} fixed-1s bars · ${available.toLocaleString()} available`);
    Object.assign(document.documentElement.dataset,{atrControlStatus:'needs-history',atrControlLength:String(n),atrControlAvailable:String(available),atrControlSymbol:symbol});
    window.dispatchEvent(new CustomEvent('renko:atr-control-applied',{detail:{symbol,length:n,pass:false,reason:'needs-history',available,source}}));
    return false;
  }
  window.dispatchEvent(new CustomEvent('renko:atr-control-before-apply',{detail:{symbol,length:n,source}}));
  delete T.settings._exactBox;
  delete T.state.atrMatrixPrepared;delete T.state.atrRaw;delete T.state.atrHistorySatisfied;delete T.state.atrAppliedLength;
  save(T,n);
  T.rebuild({fit:false});
  const raw=Number(T.state.atr),box=Number(T.state.box),available=Number(T.state.closedBars.length||0),pass=Number.isFinite(raw)&&raw>0&&Number.isFinite(box)&&box>0&&same(raw,box);
  if(pass)T.settings._exactBox=raw;
  Object.assign(T.state,{atrRaw:raw,atrRequestedLength:n,atrAppliedLength:n,atrHistorySatisfied:pass,atrHistorySourceCount:available,atrHistoryFrom:Number(T.state.closedBars[0]?.openTime)||0,atrHistoryTo:Number(T.state.closedBars.at(-1)?.closeTime)||0,atrHistoryGeneration:T.state.generation,atrMatrixPrepared:false,atrMatrixProvider:'Binance spot fixed 1s',atrBoxFrozen:pass,atrBoxFrozenAt:pass?Date.now():0});
  Object.assign(document.documentElement.dataset,{atrControlStatus:pass?'active':'error',atrControlLength:String(n),atrControlAvailable:String(available),atrControlSymbol:symbol,atrLength:String(n),atrAppliedLength:String(n),atrHistorySatisfied:pass?'true':'false',atrRawBoxPass:pass?'true':'false',renkoAtrStableBox:pass?'true':'false',renkoAtrStableBoxValue:pass?String(raw):''});
  const inp=document.getElementById('atrLength');if(inp){inp.value=String(n);inp.dataset.appliedLength=String(n)}
  const cur=document.getElementById('currentAtr');if(cur)cur.textContent=Number.isFinite(raw)?raw.toLocaleString(undefined,{maximumFractionDigits:10}):'—';
  const src=document.getElementById('sourceBarCount');if(src)src.textContent=available.toLocaleString();
  badge(pass?`ACTIVE · ${n}`:`ERROR · ${n}`);
  load(pass?`LIVE · fixed 1s · ATR ${n.toLocaleString()} · ${available.toLocaleString()} Binance 1s bars · stable box`:`ATR ${n.toLocaleString()} could not produce a valid box`,pass);
  window.dispatchEvent(new CustomEvent('renko:atr-control-applied',{detail:{symbol,length:n,pass,rawAtr:raw,box,available,source,stableBox:pass}}));
  return pass;
}
function fromInput(source){return applyLocal(document.getElementById('atrLength')?.value,source)}
document.addEventListener('click',e=>{
  const b=e.target?.closest?.('[data-apply-method="atr"]');if(!b||!isLocal())return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void fromInput('click');
},true);
const input=document.getElementById('atrLength');
if(input){
  input.addEventListener('keydown',e=>{if(e.key!=='Enter'||!isLocal())return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void fromInput('enter')},true);
  input.addEventListener('change',e=>{if(!isLocal())return;e.stopPropagation();e.stopImmediatePropagation();void fromInput('change')},true);
}
window.RWARenkoATRControl={version:'1.1.0',rule:'xaut-deep-matrix-only-other-pairs-local-fixed1s-atr-stable-box-after-apply',applyLocal,ensureHistory,isLocal};
})();
