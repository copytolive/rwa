/* Traditional box controller.
 * TradingView-observable rule remains unchanged: a user-defined absolute fixed
 * box with 1x continuation and 2x reversal. Operationally, a symbol with no
 * saved manual value gets one pair-aware fixed suggestion calibrated locally
 * against the already-loaded fixed-1s source window. We target roughly 60
 * confirmed bricks (acceptance floor 46) when exchange tick geometry permits;
 * if one minimum tick itself cannot produce 46 bricks, we use that minimum tick
 * and never fabricate sub-tick bricks. The suggestion is frozen for the symbol
 * and never recalculated between 1-second closes. Editing BOX SIZE + Apply saves
 * the user's exact per-symbol preference after minimum-tick normalization.
 *
 * Isolation rule: ATR's ephemeral settings._exactBox and XAUT deep ATR worker
 * can never own a Traditional rebuild.
 */
(()=>{
'use strict';
if(window.RWARenkoTraditionalControl)return;
const PROFILE_STORE='rwa_renko_traditional_symbol_boxes_v1';
const SETTINGS_STORE='rwa_renko_tradingview_settings_v1';
const SUGGESTION_REVISION='2.1.0-first-frame';
const TARGET_MIN=46,TARGET=60,TARGET_MAX=80;
const tv=()=>window.RWARenkoTV||null;
const same=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-12,Math.abs(Number(b))*1e-10);
const parse=v=>{const n=Number(String(v??'').trim().replace(/,/g,'.'));return Number.isFinite(n)?n:NaN};
let profiles={};
try{const p=JSON.parse(localStorage.getItem(PROFILE_STORE)||'{}');if(p&&typeof p==='object')profiles=p}catch{}
const stats={suggested:0,manual:0,switchRestores:0,applies:0,lastSymbol:'',lastBox:NaN,lastSource:'',lastAt:0,lastSuggestionMs:0};
function saveProfiles(){try{localStorage.setItem(PROFILE_STORE,JSON.stringify(profiles))}catch{}}
function saveSettings(T){try{const r=JSON.parse(localStorage.getItem(SETTINGS_STORE)||'{}')||{};delete r._exactBox;r.interval='1s';r.method='traditional';r.boxSize=Number(T.settings.boxSize);localStorage.setItem(SETTINGS_STORE,JSON.stringify(r))}catch{}}
function normalize(v,tick){const T=tv(),E=T?.engine||window.RWARenkoTVEngine;tick=Number(tick);v=Number(v);if(typeof E?.traditionalBox==='function')return E.traditionalBox(v,tick);if(!(v>0)||!Number.isFinite(v))v=tick>0?tick:Number.EPSILON;if(tick>0){const d=String(tick).includes('e-')?Math.min(14,Number(String(tick).split('e-')[1])||0):(String(tick).includes('.')?Math.min(14,String(tick).length-String(tick).indexOf('.')-1):0);const r=Number((Math.round(v/tick)*tick).toFixed(d));return r>0?r:tick}return v}
function countFor(T,bars,box){
  const E=T?.engine||window.RWARenkoTVEngine;if(!E?.build||!(box>0)||!bars?.length)return 0;
  try{return Number(E.build(bars,{method:'traditional',boxSize:box,source:T.settings?.source||'close',wicks:T.settings?.wicks!==false,_unboundedBricks:true},Number(T.state?.tickSize)||0)?.bricks?.length||0)}catch{return 0}
}
function calibratedSuggestion(T=tv()){
  const started=performance.now();if(!T)return{box:NaN,expectedBricks:0,maxAtMinTick:0,targetAttainable:false,limited:true,calibrationMs:0};
  const tick=Number(T.state?.tickSize),bars=(T.state?.closedBars||[]).slice(-1000),minBox=normalize(tick,tick);
  if(!(minBox>0)||!bars.length)return{box:minBox,expectedBricks:0,maxAtMinTick:0,targetAttainable:false,limited:true,calibrationMs:performance.now()-started};
  const cache=new Map();
  const evalMult=m=>{m=Math.max(1,Math.floor(Number(m)||1));if(cache.has(m))return cache.get(m);const box=normalize(m*tick,tick),count=countFor(T,bars,box),v={m,box,count};cache.set(m,v);return v};
  const first=evalMult(1),attainable=first.count>=TARGET_MIN;
  if(!attainable){const out={box:first.box,expectedBricks:first.count,maxAtMinTick:first.count,targetAttainable:false,limited:true,targetMin:TARGET_MIN,target:TARGET,targetMax:TARGET_MAX,calibratedBars:bars.length,calibrationMs:performance.now()-started};stats.lastSuggestionMs=out.calibrationMs;return out}
  let best=first;
  const consider=v=>{if(v.count<TARGET_MIN)return;if(Math.abs(v.count-TARGET)<Math.abs(best.count-TARGET)||(Math.abs(v.count-TARGET)===Math.abs(best.count-TARGET)&&v.box<best.box))best=v};
  let low=1,high=2,h=evalMult(high);consider(h),consider(first);
  for(let i=0;i<22&&h.count>TARGET;i++){low=high;high*=2;h=evalMult(high);consider(h)}
  let lo=1,hi=high;
  for(let i=0;i<14&&lo<=hi;i++){
    const mid=Math.floor((lo+hi)/2),v=evalMult(mid);consider(v);
    if(v.count>TARGET)lo=mid+1;else if(v.count<TARGET)hi=mid-1;else break;
  }
  for(const m of [Math.max(1,lo-2),Math.max(1,lo-1),lo,lo+1,lo+2,Math.max(1,hi-1),Math.max(1,hi),hi+1])consider(evalMult(m));
  const out={box:best.box,expectedBricks:best.count,maxAtMinTick:first.count,targetAttainable:true,limited:false,targetMin:TARGET_MIN,target:TARGET,targetMax:TARGET_MAX,calibratedBars:bars.length,calibrationMs:performance.now()-started};stats.lastSuggestionMs=out.calibrationMs;return out;
}
function suggested(T=tv()){return calibratedSuggestion(T).box}
function resolve(T=tv(),symbol=T?.state?.symbol){
  if(!T||!symbol)return{box:NaN,source:'none',manual:false};
  const tick=Number(T.state?.tickSize),p=profiles[symbol],stored=normalize(Number(p?.box),tick);
  if(Number(p?.box)>0&&stored>0&&p.manual){if(!same(stored,p.box)){profiles[symbol]={...p,box:stored,updatedAt:Date.now()};saveProfiles()}return{box:stored,source:'saved-manual',manual:true,profile:profiles[symbol]}}
  if(Number(p?.box)>0&&stored>0&&!p.manual&&p.suggestionRevision===SUGGESTION_REVISION){if(!same(stored,p.box)){profiles[symbol]={...p,box:stored,updatedAt:Date.now()};saveProfiles()}return{box:stored,source:p.targetAttainable?'saved-auto-first-frame':'saved-auto-min-tick-limited',manual:false,profile:profiles[symbol]}}
  const s=calibratedSuggestion(T);if(s.box>0){profiles[symbol]={...s,box:s.box,manual:false,suggestionRevision:SUGGESTION_REVISION,updatedAt:Date.now()};saveProfiles();stats.suggested++;return{box:s.box,source:s.targetAttainable?'auto-fixed1s-first-frame-target':'auto-min-tick-limited',manual:false,profile:profiles[symbol]}}
  const box=normalize(tick,tick);profiles[symbol]={box,manual:false,suggestionRevision:SUGGESTION_REVISION,expectedBricks:0,maxAtMinTick:0,targetAttainable:false,limited:true,targetMin:TARGET_MIN,target:TARGET,targetMax:TARGET_MAX,updatedAt:Date.now()};saveProfiles();return{box,source:'minimum-tick-fallback',manual:false,profile:profiles[symbol]};
}
function clearAtrOwnership(T=tv(),reason='traditional'){
  if(!T)return;
  try{window.RWARenkoATRControl?.clearStable?.(reason)}catch{}
  delete T.settings._exactBox;delete T.state.atrBoxFrozen;delete T.state.atrBoxFrozenAt;delete T.state.atrMatrixPrepared;delete T.state.atrRaw;delete T.state.atrHistorySatisfied;delete T.state.atrAppliedLength;
  if(T.state?.symbol==='XAUTUSDT'&&window.RWARenkoATRFixed1s?.workerActive)try{window.RWARenkoATRFixed1s.dispose?.(reason)}catch{}
}
function decorate(T,box,source,active=false){
  const p=profiles[T?.state?.symbol]||{},input=document.getElementById('traditionalBox');if(input){input.value=String(box);input.dataset.appliedBox=active?String(box):'';input.dataset.boxSource=source;input.title=p.targetAttainable?'Traditional = fixed absolute box. Default is locally calibrated for a useful first frame; edit and Apply to save your own value for this pair.':'Traditional = fixed absolute box. Exchange minimum tick limits the default brick count for this pair; no fake sub-tick bricks are created.'}
  Object.assign(document.documentElement.dataset,{renkoTraditionalReady:'true',renkoTraditionalSymbol:String(T?.state?.symbol||''),renkoTraditionalBox:String(box),renkoTraditionalBoxSource:String(source),renkoTraditionalFixed:'true',renkoTraditionalAtrExactOwned:Object.prototype.hasOwnProperty.call(T?.settings||{},'_exactBox')?'true':'false',renkoTraditionalTargetAttainable:p.targetAttainable===false?'false':'true',renkoTraditionalExpectedBricks:String(p.expectedBricks??''),renkoTraditionalMaxAtMinTick:String(p.maxAtMinTick??''),renkoTraditionalSuggestionRevision:String(p.suggestionRevision||'')});
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
  if(persist){profiles[T.state.symbol]={...(profiles[T.state.symbol]||{}),box,manual:true,updatedAt:Date.now()};saveProfiles();stats.manual++}
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
window.RWARenkoTraditionalControl={version:'2.1.0-first-frame',suggestionRevision:SUGGESTION_REVISION,rule:'pair-aware-fixed-absolute-box-min-tick-positive-first-frame-target-no-atr-exact-ownership-stable-between-1s-closes',target:{min:TARGET_MIN,ideal:TARGET,max:TARGET_MAX},profileStore:PROFILE_STORE,normalize,countFor,calibratedSuggestion,suggested,resolve,activate,applyFromInput,prepareSymbol,clearAtrOwnership,stats,get profiles(){return profiles}};
})();
