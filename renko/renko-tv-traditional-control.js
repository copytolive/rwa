/* Traditional box controller.
 * Operational hardening only: the TradingView contract remains a user-defined
 * absolute fixed box with 1x continuation and 2x reversal. For a symbol that
 * has no saved Traditional value, we prepare one pair-aware fixed suggestion
 * from recent fixed-1s Close range so the control opens with a usable positive
 * box. The suggestion is frozen for that symbol and never recalculated between
 * 1-second closes. Editing BOX SIZE + Apply stores the user's exact per-symbol
 * preference after minimum-tick normalization.
 *
 * Isolation rule: ATR's ephemeral settings._exactBox and XAUT deep ATR worker
 * can never own a Traditional rebuild.
 */
(()=>{
'use strict';
if(window.RWARenkoTraditionalControl)return;
const PROFILE_STORE='rwa_renko_traditional_symbol_boxes_v1';
const SETTINGS_STORE='rwa_renko_tradingview_settings_v1';
const tv=()=>window.RWARenkoTV||null;
const same=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-12,Math.abs(Number(b))*1e-10);
const parse=v=>{const n=Number(String(v??'').trim().replace(/,/g,'.'));return Number.isFinite(n)?n:NaN};
let profiles={};
try{const p=JSON.parse(localStorage.getItem(PROFILE_STORE)||'{}');if(p&&typeof p==='object')profiles=p}catch{}
const stats={suggested:0,manual:0,switchRestores:0,applies:0,lastSymbol:'',lastBox:NaN,lastSource:'',lastAt:0};
function saveProfiles(){try{localStorage.setItem(PROFILE_STORE,JSON.stringify(profiles))}catch{}}
function saveSettings(T){try{const r=JSON.parse(localStorage.getItem(SETTINGS_STORE)||'{}')||{};delete r._exactBox;r.interval='1s';r.method='traditional';r.boxSize=Number(T.settings.boxSize);localStorage.setItem(SETTINGS_STORE,JSON.stringify(r))}catch{}}
function normalize(v,tick){const T=tv(),E=T?.engine||window.RWARenkoTVEngine;tick=Number(tick);v=Number(v);if(typeof E?.traditionalBox==='function')return E.traditionalBox(v,tick);if(!(v>0)||!Number.isFinite(v))v=tick>0?tick:Number.EPSILON;if(tick>0){const d=String(tick).includes('e-')?Math.min(14,Number(String(tick).split('e-')[1])||0):(String(tick).includes('.')?Math.min(14,String(tick).length-String(tick).indexOf('.')-1):0);const r=Number((Math.round(v/tick)*tick).toFixed(d));return r>0?r:tick}return v}
function roundSig1(v){v=Number(v);if(!(v>0))return v;const mag=10**Math.floor(Math.log10(v));return Math.max(mag,Math.round(v/mag)*mag)}
function suggested(T=tv()){
  if(!T)return NaN;
  const tick=Number(T.state?.tickSize),price=Math.abs(Number(T.state?.lastPrice));
  const closes=(T.state?.closedBars||[]).slice(-600).map(b=>Number(b?.close)).filter(Number.isFinite);
  let raw=NaN;
  if(closes.length>1){const lo=Math.min(...closes),hi=Math.max(...closes),range=hi-lo;if(range>0)raw=range/24}
  if(price>0){const lo=price*.00002,hi=price*.002;raw=Number.isFinite(raw)&&raw>0?Math.min(hi,Math.max(lo,raw)):price*.0005}
  return normalize(roundSig1(raw),tick);
}
function resolve(T=tv(),symbol=T?.state?.symbol){
  if(!T||!symbol)return{box:NaN,source:'none',manual:false};
  const tick=Number(T.state?.tickSize),p=profiles[symbol],stored=normalize(Number(p?.box),tick);
  if(Number(p?.box)>0&&stored>0){if(!same(stored,p.box)){profiles[symbol]={...p,box:stored,updatedAt:Date.now()};saveProfiles()}return{box:stored,source:p.manual?'saved-manual':'saved-auto',manual:!!p.manual}}
  const box=suggested(T);if(box>0){profiles[symbol]={box,manual:false,updatedAt:Date.now()};saveProfiles();stats.suggested++;return{box,source:'auto-fixed1s-range-suggestion',manual:false}}
  return{box:normalize(tick,tick),source:'minimum-tick-fallback',manual:false};
}
function clearAtrOwnership(T=tv(),reason='traditional'){
  if(!T)return;
  try{window.RWARenkoATRControl?.clearStable?.(reason)}catch{}
  delete T.settings._exactBox;delete T.state.atrBoxFrozen;delete T.state.atrBoxFrozenAt;delete T.state.atrMatrixPrepared;delete T.state.atrRaw;delete T.state.atrHistorySatisfied;delete T.state.atrAppliedLength;
  if(T.state?.symbol==='XAUTUSDT'&&window.RWARenkoATRFixed1s?.workerActive)try{window.RWARenkoATRFixed1s.dispose?.(reason)}catch{}
}
function decorate(T,box,source,active=false){
  const input=document.getElementById('traditionalBox');if(input){input.value=String(box);input.dataset.appliedBox=active?String(box):'';input.dataset.boxSource=source;input.title='Traditional = fixed absolute box. A pair-aware suggestion is prepared once; edit and Apply to save your own value for this pair.'}
  Object.assign(document.documentElement.dataset,{renkoTraditionalReady:'true',renkoTraditionalSymbol:String(T?.state?.symbol||''),renkoTraditionalBox:String(box),renkoTraditionalBoxSource:String(source),renkoTraditionalFixed:'true',renkoTraditionalAtrExactOwned:Object.prototype.hasOwnProperty.call(T?.settings||{},'_exactBox')?'true':'false'});
  if(active){const badge=document.querySelector('.method[data-method="traditional"] .method-title span');if(badge)badge.textContent=`ACTIVE · ${box}`}
}
function mark(T,box,source,pass){
  stats.lastSymbol=T.state.symbol;stats.lastBox=box;stats.lastSource=source;stats.lastAt=Date.now();
  Object.assign(document.documentElement.dataset,{renkoTraditionalStatus:pass?'active':'error',renkoTraditionalBox:String(box),renkoTraditionalBoxSource:String(source),renkoTraditionalFixed:'true',renkoTraditionalNoAtrExact:Object.prototype.hasOwnProperty.call(T.settings,'_exactBox')?'false':'true',renkoTraditionalWorkerDormant:window.RWARenkoATRFixed1s?.workerActive?'false':'true'});
  window.dispatchEvent(new CustomEvent('renko:traditional-applied',{detail:{symbol:T.state.symbol,box,source,pass,interval:T.settings.interval,at:Date.now()}}));
}
function activate(box,source='manual',persist=true,fit=false){
  const T=tv();if(!T||!T.state?.symbol||!(Number(T.state.tickSize)>0))return false;
  box=normalize(box,T.state.tickSize);if(!(box>0)||!Number.isFinite(box))return false;
  clearAtrOwnership(T,'traditional-apply');
  T.settings.boxSize=box;T.settings.method='traditional';
  if(persist){profiles[T.state.symbol]={box,manual:true,updatedAt:Date.now()};saveProfiles();stats.manual++}
  saveSettings(T);T.rebuild({fit});
  const pass=T.settings.method==='traditional'&&T.settings.interval==='1s'&&Number(T.state.box)>0&&same(T.state.box,box)&&!Object.prototype.hasOwnProperty.call(T.settings,'_exactBox');
  decorate(T,box,source,true);mark(T,box,source,pass);stats.applies++;return pass;
}
function applyFromInput(source='click'){
  const T=tv();if(!T)return false;const input=document.getElementById('traditionalBox'),fallback=resolve(T).box;let raw=parse(input?.value);if(!(raw>0))raw=fallback;const box=normalize(raw,T.state.tickSize);return activate(box,`manual-${source}`,true,true)
}
function prepareSymbol(reason='ready'){
  const T=tv();if(!T||T.state?.status!=='live'||!T.state?.symbol||!(Number(T.state.tickSize)>0))return false;
  const r=resolve(T);decorate(T,r.box,r.source,T.settings.method==='traditional');
  if(T.settings.method!=='traditional')return true;
  clearAtrOwnership(T,`traditional-${reason}`);T.settings.boxSize=r.box;saveSettings(T);T.rebuild({fit:false});decorate(T,r.box,r.source,true);const pass=Number(T.state.box)>0&&same(T.state.box,r.box)&&!Object.prototype.hasOwnProperty.call(T.settings,'_exactBox');mark(T,r.box,r.source,pass);stats.switchRestores++;return pass;
}
document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-apply-method="traditional"]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();applyFromInput('click')},true);
const input=document.getElementById('traditionalBox');if(input)input.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();applyFromInput('enter')},true);
window.addEventListener('renko:tv-ready',()=>queueMicrotask(()=>prepareSymbol('tv-ready')));
window.addEventListener('renko:symbol-switch-end',e=>{if(e.detail?.ok!==false)queueMicrotask(()=>prepareSymbol('symbol-ready'))});
window.RWARenkoTraditionalControl={version:'2.0.0-pair-safe',rule:'pair-aware-fixed-absolute-box-min-tick-positive-no-atr-exact-ownership-stable-between-1s-closes',profileStore:PROFILE_STORE,normalize,suggested,resolve,activate,applyFromInput,prepareSymbol,clearAtrOwnership,stats,get profiles(){return profiles}};
})();
