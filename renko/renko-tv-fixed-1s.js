/* Production timeframe hard lock. Must run before renko-tv-app.js and the XAUT provider. */
(()=>{
'use strict';
const STORE='rwa_renko_tradingview_settings_v1';
try{const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{};raw.interval='1s';localStorage.setItem(STORE,JSON.stringify(raw))}catch{}
document.documentElement.dataset.fixedInterval='1s';
window.RENKO_FIXED_INTERVAL='1s';
const NativeWS=window.WebSocket;
if(typeof NativeWS==='function'&&!window.__RENKO_OKX_WS_BUSINESS_GUARD__){
  function GuardedWS(url,protocols){let target=String(url||'');if(target==='wss://ws.okx.com:8443/ws/v5/public')target='wss://ws.okx.com:8443/ws/v5/business';return protocols===undefined?new NativeWS(target):new NativeWS(target,protocols)}
  for(const k of ['CONNECTING','OPEN','CLOSING','CLOSED'])Object.defineProperty(GuardedWS,k,{value:NativeWS[k]});
  GuardedWS.prototype=NativeWS.prototype;window.WebSocket=GuardedWS;window.__RENKO_OKX_WS_BUSINESS_GUARD__={from:'wss://ws.okx.com:8443/ws/v5/public',to:'wss://ws.okx.com:8443/ws/v5/business'};
}
window.RWARenkoFixed1s={version:'1.5.1',interval:'1s',selectorAllowed:false,okxCandleWebSocket:'business'};
})();

/* Exact Renko state + bounded render geometry.
 * Important performance rule: the mathematical state transition is O(1) per
 * source price. We record compact run descriptors, then materialize only the
 * newest rendered tail once after all source bars are processed. A move that
 * mathematically produces millions/billions/trillions of bricks therefore never
 * allocates that many JS objects and never loops on an unsafe huge brick index.
 */
(()=>{
'use strict';
if(window.RWARenkoBrickBudget)return;
const E=window.RWARenkoTVEngine;if(!E?.build||!E?.project)return;
const originalBuild=E.build.bind(E),originalProject=E.project.bind(E);
const DEFAULT_LIMIT=2000,PROJECTION_LIMIT=500;
const num=v=>Number(v),finite=v=>Number.isFinite(num(v));
function limitOf(settings,projection=false){const requested=Math.floor(num(settings?._renderBrickLimit));const d=projection?PROJECTION_LIMIT:DEFAULT_LIMIT;return Math.max(200,Math.min(10000,requested>0?requested:d))}
function touch(s,p){if(!finite(s.pendingHigh))s.pendingHigh=p;if(!finite(s.pendingLow))s.pendingLow=p;if(p>s.pendingHigh)s.pendingHigh=p;if(p<s.pendingLow)s.pendingLow=p}
function brick(open,close,dir,box,tm,wicks,isReversal,sourceKind,pendingHigh,pendingLow,usePending,projection=false){let high=Math.max(open,close),low=Math.min(open,close);if(wicks&&usePending){if(dir>0&&finite(pendingLow))low=Math.min(low,pendingLow);if(dir<0&&finite(pendingHigh))high=Math.max(high,pendingHigh)}const b={open,high,low,close,direction:dir,box,isReversal:!!isReversal,sourceTime:num(tm)||0,sourceKind:sourceKind||'historical'};if(projection)b.projection=true;return b}
function transition(s,p,opt={}){
  p=num(p);const box=num(opt.box),tm=num(opt.sourceTime)||0;if(!Number.isFinite(p)||!(box>0))return null;
  touch(s,p);const pendingHigh=s.pendingHigh,pendingLow=s.pendingLow,lc=num(s.lastClose),d=num(s.direction)||0;if(!Number.isFinite(lc))return null;
  let count=0,dir=0,reversal=false,sign=0;
  if(d===0){if(p>=lc+box){dir=1;sign=1;count=Math.floor((p-lc)/box+1e-12)}else if(p<=lc-box){dir=-1;sign=-1;count=Math.floor((lc-p)/box+1e-12)}}
  else if(d>0){if(p>=lc+box){dir=1;sign=1;count=Math.floor((p-lc)/box+1e-12)}else if(p<=lc-2*box){dir=-1;sign=-1;reversal=true;count=1+Math.floor((lc-2*box-p)/box+1e-12)}}
  else{if(p<=lc-box){dir=-1;sign=-1;count=Math.floor((lc-p)/box+1e-12)}else if(p>=lc+2*box){dir=1;sign=1;reversal=true;count=1+Math.floor((p-(lc+2*box))/box+1e-12)}}
  if(!(count>0)||!Number.isFinite(count))return null;
  const finalClose=reversal?lc+sign*(count+1)*box:lc+sign*count*box;
  const desc={lc,count,dir,sign,reversal,box,tm,wicks:opt.wicks!==false,sourceKind:opt.sourceKind||'historical',pendingHigh,pendingLow,finalClose};
  s.lastClose=finalClose;s.direction=dir;s.lastSourceTime=tm||s.lastSourceTime;s.pendingHigh=finalClose;s.pendingLow=finalClose;
  return desc;
}
function materialize(descriptors,limit,projection=false){
  limit=Math.max(1,Math.floor(num(limit)||DEFAULT_LIMIT));let remaining=limit;const chosen=[];
  for(let i=descriptors.length-1;i>=0&&remaining>0;i--){const d=descriptors[i],take=Math.min(d.count,remaining);if(take>0){chosen.push({d,take,full:take===d.count});remaining-=take}}
  chosen.reverse();const out=[];
  for(const {d,take,full} of chosen){
    if(full){
      // Full descriptors are necessarily <= render limit, therefore j is small
      // and integer stepping is always safe.
      for(let j=1;j<=take;j++){let open,close,isRev=false;if(d.reversal){open=d.lc+d.sign*j*d.box;close=d.lc+d.sign*(j+1)*d.box;isRev=j===1}else{open=d.lc+d.sign*(j-1)*d.box;close=d.lc+d.sign*j*d.box}out.push(brick(open,close,d.dir,d.box,d.tm,d.wicks,isRev,d.sourceKind,d.pendingHigh,d.pendingLow,j===1,projection))}
    }else{
      // Partial selection means we only need the last `take` bricks from a huge
      // run. Derive them backwards from exact finalClose. This never increments
      // a potentially >MAX_SAFE_INTEGER brick index and always terminates.
      for(let k=0;k<take;k++){const back=take-1-k,close=d.finalClose-d.sign*back*d.box,open=close-d.sign*d.box;out.push(brick(open,close,d.dir,d.box,d.tm,d.wicks,false,d.sourceKind,d.pendingHigh,d.pendingLow,false,projection))}
    }
  }
  return out;
}
/* Compatibility helper for diagnostics. Main build/project use the same finite
 * descriptor materializer, so the production hot path is bounded. */
function processTail(s,p,out,opt={}){const d=transition(s,p,opt);if(!d)return 0;const limit=Math.max(1,Math.floor(num(opt.tailLimit)||DEFAULT_LIMIT)),fresh=materialize([d],limit,!!opt.projection);if(d.count>=limit)out.length=0;for(const b of fresh)out.push(b);if(out.length>limit)out.splice(0,out.length-limit);return d.count}
function sourceFirst(src,source){for(const b of src||[]){const a=E.barPrices(b,source);if(a?.length&&Number.isFinite(num(a[0])))return num(a[0])}return NaN}
function scheduleSync(){queueMicrotask(()=>window.RWARenkoBrickBudget?.syncUi?.())}
function buildBudget(bars,settings={},tickSize=0){
  if(settings?._unboundedBricks===true)return originalBuild(bars,settings,tickSize);
  const src=(Array.isArray(bars)?bars:[]).filter(b=>finite(b?.close)).sort((a,b)=>(num(a.openTime||a.time)-num(b.openTime||b.time))),source=String(settings.source||'close').toLowerCase()==='ohlc'?'ohlc':'close',box=E.computeBox(src,settings,tickSize),exact=num(settings?._exactBox),rawAtr=Number.isFinite(exact)&&exact>0?exact:E.latestAtr(src,settings.atrLength||14),limit=limitOf(settings,false);
  if(!src.length||!(box>0)){const r={bricks:[],box,atr:rawAtr,state:null,anchor:NaN,source,totalBricks:0,renderedBricks:0,truncated:false,renderLimit:limit};scheduleSync();return r}
  const first=sourceFirst(src,source),anchor=E.floorGrid(first,box,tickSize),state=E.initState(anchor),descriptors=[];let total=0;
  for(const bar of src){const tm=num(bar.closeTime||bar.time||bar.openTime)||0;for(const p of E.barPrices(bar,source)){const d=transition(state,p,{box,wicks:settings.wicks!==false,sourceTime:tm,sourceKind:'confirmed'});if(d){descriptors.push(d);total+=d.count}}}
  const bricks=materialize(descriptors,limit,false),r={bricks,box,atr:rawAtr,state:E.cloneState(state),anchor,source,totalBricks:total,renderedBricks:bricks.length,truncated:total>bricks.length,renderLimit:limit,runCount:descriptors.length};scheduleSync();return r;
}
function projectBudget(base,currentBar,settings={},tickSize=0){
  if(settings?._unboundedBricks===true)return originalProject(base,currentBar,settings,tickSize);if(!base?.state||!currentBar)return[];
  const state=E.cloneState(base.state),source=String(settings.source||base.source||'close').toLowerCase()==='ohlc'?'ohlc':'close',limit=limitOf(settings,true),descriptors=[];let total=0;
  for(const p of E.barPrices(currentBar,source)){const d=transition(state,p,{box:base.box,wicks:settings.wicks!==false,sourceTime:num(currentBar.closeTime||currentBar.time||Date.now()),sourceKind:'projection'});if(d){descriptors.push(d);total+=d.count}}
  const mapped=materialize(descriptors,limit,true);Object.defineProperty(mapped,'totalBricks',{value:total,writable:true,configurable:true});scheduleSync();return mapped;
}
E.build=buildBudget;E.project=projectBudget;
function syncUi(){const T=window.RWARenkoTV,b=T?.state?.base;if(!T||!b)return;const total=Number(b.totalBricks??T.state.confirmed?.length??0),rendered=Number(T.state.confirmed?.length||0),projTotal=Number(T.state.projection?.totalBricks??T.state.projection?.length??0);T.state.confirmedTotal=total;T.state.renderedConfirmed=rendered;T.state.projectionTotal=projTotal;const d=document.documentElement.dataset;d.renkoBrickBudget='true';d.renkoConfirmedTotal=String(total);d.renkoRenderedBricks=String(rendered);d.renkoRenderLimit=String(b.renderLimit||DEFAULT_LIMIT);d.renkoBrickBudgetAlgorithm='o1-state-safe-tail-materialize';const c=document.getElementById('brickCount');if(c)c.textContent=total.toLocaleString();const m=document.getElementById('tvBrickMeta');if(m)m.textContent=`${total.toLocaleString()} confirmed · ${projTotal.toLocaleString()} projection · ${rendered.toLocaleString()} rendered`}
window.addEventListener('renko:tv-ready',()=>{syncUi();setInterval(syncUi,500)});window.addEventListener('renko:symbol-switch-end',syncUi);
window.RWARenkoBrickBudget={version:'1.3.1',rule:'exact-box-exact-final-state-o1-source-transition-safe-bounded-tail-materialization',defaultLimit:DEFAULT_LIMIT,projectionLimit:PROJECTION_LIMIT,transition,materialize,processTail,buildBudget,projectBudget,originalBuild,originalProject,syncUi};
})();
