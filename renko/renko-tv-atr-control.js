/* ATR control router.
 * XAUT keeps the deep OKX 1s matrix runtime. Every other pair uses its own
 * Binance fixed-1s bars and must never be intercepted by the XAUT-only matrix.
 *
 * Stability contract: local ATR is sampled on symbol-ready / explicit Apply,
 * then held as settings._exactBox between 1s closes. The lock is runtime-only
 * and is cleared before Traditional/Percentage so it can never override another
 * box-size method.
 *
 * Positive Wilder ATR remains the exact Renko box. A mathematically zero Wilder
 * ATR cannot be a usable box, so after same-source deepening (where it can help)
 * the only legal fallback is the exchange minimum tick. ATR length 1 is special:
 * adding older bars cannot change the latest one-bar true range, so a zero latest
 * TR immediately uses the explicit minimum-tick fallback instead of pretending
 * that older history can make the current ATR positive.
 *
 * Visible ATR ownership: renko-tv-app.js updateMeta() is the single writer for
 * #currentAtr. Explicit Apply must not overwrite it with a second formatter.
 */
(()=>{
'use strict';
if(window.RWARenkoATRControl)return;
const XAUT='XAUTUSDT';
const STORE='rwa_renko_tradingview_settings_v1';
const tv=()=>window.RWARenkoTV||null;
const stats={autoLocks:0,explicitLocks:0,clears:0,deepHistoryRetries:0,zeroFallbacks:0,lastSymbol:'',lastLength:0,lastBox:NaN,lastAt:0};
const parse=v=>{const n=Math.floor(Number(v));return Number.isFinite(n)&&n>=1?n:14};
const same=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-12,Math.abs(Number(b))*1e-10);
function isLocal(){const T=tv();return !!T&&!!T.state?.symbol&&T.state.symbol!==XAUT}
function badge(s){const e=document.querySelector('.method[data-method="atr"] .method-title span');if(e)e.textContent=s}
function load(s,live=false){const e=document.getElementById('tvLoadState');if(e){e.textContent=s;e.className=`load-state ${live?'live':''}`}}
function clearStable(reason='clear'){
  const T=tv();if(!T)return false;
  const had=Object.prototype.hasOwnProperty.call(T.settings,'_exactBox');delete T.settings._exactBox;
  delete T.state.atrBoxFrozen;delete T.state.atrBoxFrozenAt;delete T.state.atrZeroFallback;delete T.state.atrRawPositive;
  Object.assign(document.documentElement.dataset,{renkoAtrStableBox:'false',renkoAtrStableBoxValue:'',renkoAtrStableReason:String(reason),atrZeroFallback:'false'});
  if(had)stats.clears++;return had;
}
function save(T,n){try{const r=JSON.parse(localStorage.getItem(STORE)||'{}')||{};delete r._exactBox;r.interval='1s';r.atrLength=n;r.method='atr';localStorage.setItem(STORE,JSON.stringify(r))}catch{};T.settings.atrLength=n;T.settings.method='atr'}
function markStable(T,box,reason='auto',rawValue=box,zeroFallback=false){
  box=Number(box);rawValue=Number(rawValue);if(!T||T.state?.symbol===XAUT||T.settings?.method!=='atr'||!(box>0)||!Number.isFinite(box))return false;
  T.settings._exactBox=box;T.state.atrRaw=Number.isFinite(rawValue)?rawValue:box;T.state.atrRawPositive=Number.isFinite(rawValue)&&rawValue>0;T.state.atrZeroFallback=!!zeroFallback;T.state.atrBoxFrozen=true;T.state.atrBoxFrozenAt=Date.now();T.state.atrAppliedLength=Math.max(1,Math.floor(Number(T.settings.atrLength)||14));
  Object.assign(document.documentElement.dataset,{renkoAtrStableBox:'true',renkoAtrStableBoxValue:String(box),renkoAtrStableReason:String(reason),atrZeroFallback:zeroFallback?'true':'false',atrRawPositive:T.state.atrRawPositive?'true':'false'});
  stats.lastSymbol=T.state.symbol;stats.lastLength=T.state.atrAppliedLength;stats.lastBox=box;stats.lastAt=Date.now();if(zeroFallback)stats.zeroFallbacks++;if(reason==='explicit-apply')stats.explicitLocks++;else stats.autoLocks++;return true;
}
function autoLock(reason='symbol-ready'){
  const T=tv();if(!T||T.state?.status!=='live'||T.settings?.method!=='atr'||T.state?.symbol===XAUT)return false;
  const existing=Number(T.settings._exactBox);if(Number.isFinite(existing)&&existing>0)return true;
  const box=Number(T.state?.box),atr=Number(T.state?.atr),tick=Number(T.state?.tickSize);
  if(Number.isFinite(atr)&&atr>0)return markStable(T,atr,reason,atr,false);
  if(atr===0&&box>0&&tick>0&&same(box,tick))return markStable(T,box,reason,0,true);
  return Number.isFinite(box)&&box>0?markStable(T,box,reason,box,false):false;
}
async function ensureHistory(T,n){
  if((T.state?.closedBars?.length||0)>=n)return true;
  let guard=0;
  while((T.state?.closedBars?.length||0)<n&&Number(T.state?.historyPages||0)<5&&guard++<5){const before=T.state.closedBars.length,ok=await T.loadOlderPage?.();if(!ok||T.state.closedBars.length<=before)break}
  return (T.state?.closedBars?.length||0)>=n;
}
function sample(T){
  T.rebuild({fit:false});
  const raw=Number(T.state.atr),box=Number(T.state.box),tick=Number(T.state.tickSize),available=Number(T.state.closedBars.length||0);
  const positivePass=Number.isFinite(raw)&&raw>0&&Number.isFinite(box)&&box>0&&same(raw,box);
  const zeroFallback=raw===0&&Number.isFinite(box)&&box>0&&tick>0&&same(box,tick);
  return{raw,box,tick,available,positivePass,zeroFallback,pass:positivePass||zeroFallback};
}
async function applyLocal(value,source='control'){
  const T=tv();if(!T||T.state?.symbol===XAUT)return false;
  const n=parse(value),symbol=T.state.symbol;badge(`APPLYING · ${n}`);document.documentElement.dataset.atrControlStatus='applying';
  if(!await ensureHistory(T,n)){
    const available=Number(T.state?.closedBars?.length||0);badge(`NEEDS HISTORY · ${n}`);load(`ATR ${n.toLocaleString()} needs ${n.toLocaleString()} fixed-1s bars · ${available.toLocaleString()} available`);
    Object.assign(document.documentElement.dataset,{atrControlStatus:'needs-history',atrControlLength:String(n),atrControlAvailable:String(available),atrControlSymbol:symbol});window.dispatchEvent(new CustomEvent('renko:atr-control-applied',{detail:{symbol,length:n,pass:false,reason:'needs-history',available,source}}));return false;
  }
  window.dispatchEvent(new CustomEvent('renko:atr-control-before-apply',{detail:{symbol,length:n,source}}));clearStable('explicit-apply-refresh');
  delete T.state.atrMatrixPrepared;delete T.state.atrRaw;delete T.state.atrHistorySatisfied;delete T.state.atrAppliedLength;
  save(T,n);
  let sampled=sample(T),deepenedPages=0;
  // For length > 1, a flat recent window can still gain a positive Wilder seed
  // by extending the SAME fixed-1s source backward. For length 1, older bars do
  // not alter the current one-bar TR, so deepening would only waste time.
  while(!sampled.positivePass&&n>1&&Number(T.state?.historyPages||0)<5){
    const before=Number(T.state?.closedBars?.length||0),ok=await T.loadOlderPage?.();
    if(!ok||Number(T.state?.closedBars?.length||0)<=before)break;
    deepenedPages++;stats.deepHistoryRetries++;sampled=sample(T);
  }
  const raw=sampled.raw,box=sampled.box,available=sampled.available,zeroFallback=sampled.zeroFallback,positivePass=sampled.positivePass,pass=positivePass||zeroFallback;
  if(pass)markStable(T,box,'explicit-apply',raw,zeroFallback);
  Object.assign(T.state,{atrRaw:raw,atrRawPositive:positivePass,atrZeroFallback:zeroFallback,atrRequestedLength:n,atrAppliedLength:n,atrHistorySatisfied:pass,atrHistorySourceCount:available,atrHistoryFrom:Number(T.state.closedBars[0]?.openTime)||0,atrHistoryTo:Number(T.state.closedBars.at(-1)?.closeTime)||0,atrHistoryGeneration:T.state.generation,atrMatrixPrepared:false,atrMatrixProvider:'Binance spot fixed 1s',atrHistoryDeepenedPages:deepenedPages,atrBoxFrozen:pass,atrBoxFrozenAt:pass?Date.now():0});
  Object.assign(document.documentElement.dataset,{atrControlStatus:pass?'active':'error',atrControlLength:String(n),atrControlAvailable:String(available),atrControlSymbol:symbol,atrLength:String(n),atrAppliedLength:String(n),atrHistorySatisfied:pass?'true':'false',atrRawBoxPass:positivePass?'true':'false',atrZeroFallback:zeroFallback?'true':'false',atrRawPositive:positivePass?'true':'false',atrDeepenedPages:String(deepenedPages),atrDisplayOwner:'app-updateMeta'});
  const inp=document.getElementById('atrLength');if(inp){inp.value=String(n);inp.dataset.appliedLength=String(n)}const src=document.getElementById('sourceBarCount');if(src)src.textContent=available.toLocaleString();
  badge(pass?`ACTIVE · ${n}`:`ERROR · ${n}`);
  if(pass&&zeroFallback)load(`LIVE · fixed 1s · ATR ${n.toLocaleString()} · raw 0 · min-tick fallback ${box} · ${available.toLocaleString()} Binance 1s bars`,true);
  else load(pass?`LIVE · fixed 1s · ATR ${n.toLocaleString()} · ${available.toLocaleString()} Binance 1s bars · stable box`:`ATR ${n.toLocaleString()} could not produce a legal Wilder/min-tick box from ${available.toLocaleString()} fixed-1s bars`,pass);
  window.dispatchEvent(new CustomEvent('renko:atr-control-applied',{detail:{symbol,length:n,pass,rawAtr:raw,box,available,deepenedPages,source,stableBox:pass,rawPositive:positivePass,zeroFallback}}));return pass;
}
function fromInput(source){return applyLocal(document.getElementById('atrLength')?.value,source)}
// The exact ATR box is ephemeral. Discard any value restored from localStorage
// before the initial network load can use it for a different symbol/session.
const boot=tv();if(boot&&!boot.state?.symbol)clearStable('bootstrap');
// Capture phase runs before the base method handler. Traditional/Percentage must
// never inherit the ATR snapshot, including on XAUT.
document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-apply-method]');if(b&&b.dataset.applyMethod!=='atr')clearStable(`method-${b.dataset.applyMethod}`)},true);
document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-apply-method="atr"]');if(!b||!isLocal())return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void fromInput('click')},true);
const input=document.getElementById('atrLength');if(input){input.addEventListener('keydown',e=>{if(e.key!=='Enter'||!isLocal())return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void fromInput('enter')},true);input.addEventListener('change',e=>{if(!isLocal())return;e.stopPropagation();e.stopImmediatePropagation();void fromInput('change')},true)}
window.addEventListener('renko:tv-ready',()=>queueMicrotask(()=>autoLock('tv-ready')));window.addEventListener('renko:symbol-switch-end',e=>{if(e.detail?.ok!==false)queueMicrotask(()=>autoLock('symbol-ready'))});
window.RWARenkoATRControl={version:'1.4.0-zero-safe',rule:'xaut-deep-matrix-other-pairs-local-fixed1s-positive-wilder-exact-box-zero-wilder-min-tick-fallback-deepen-same-source-atr-snapshot-stable-runtime-only-single-owner-display',applyLocal,ensureHistory,isLocal,autoLock,markStable,clearStable,stats};
})();