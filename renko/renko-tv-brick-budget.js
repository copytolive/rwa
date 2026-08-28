/* RENKO rendered-brick budget.
 * Keeps the exact ATR/Traditional/Percentage box and exact final Renko state,
 * but only materializes the newest bounded tail for Lightweight Charts.
 * This prevents multi-million synthetic brick arrays from exhausting Chromium
 * when a very small 1-second ATR meets a larger price move.
 */
(()=>{
'use strict';
if(window.RWARenkoBrickBudget)return;
const E=window.RWARenkoTVEngine;if(!E?.build||!E?.project)return;
const originalBuild=E.build.bind(E),originalProject=E.project.bind(E);
const DEFAULT_LIMIT=12000,PROJECTION_LIMIT=2000;
const num=v=>Number(v),finite=v=>Number.isFinite(num(v));
function limitOf(settings,projection=false){const requested=Math.floor(num(settings?._renderBrickLimit));const d=projection?PROJECTION_LIMIT:DEFAULT_LIMIT;return Math.max(200,Math.min(50000,requested>0?requested:d))}
function touch(s,p){if(!finite(s.pendingHigh))s.pendingHigh=p;if(!finite(s.pendingLow))s.pendingLow=p;if(p>s.pendingHigh)s.pendingHigh=p;if(p<s.pendingLow)s.pendingLow=p}
function push(out,b,limit){out.push(b);if(out.length>limit)out.splice(0,out.length-limit)}
function brick(open,close,dir,box,tm,wicks,isReversal,sourceKind,pendingHigh,pendingLow,usePending){let high=Math.max(open,close),low=Math.min(open,close);if(wicks&&usePending){if(dir>0&&finite(pendingLow))low=Math.min(low,pendingLow);if(dir<0&&finite(pendingHigh))high=Math.max(high,pendingHigh)}return{open,high,low,close,direction:dir,box,isReversal:!!isReversal,sourceTime:num(tm)||0,sourceKind:sourceKind||'historical'}}
function processTail(s,p,out,opt={}){
  p=num(p);const box=num(opt.box),tm=num(opt.sourceTime)||0,limit=Math.max(1,Math.floor(num(opt.tailLimit)||DEFAULT_LIMIT));if(!Number.isFinite(p)||!(box>0))return 0;
  touch(s,p);const pendingHigh=s.pendingHigh,pendingLow=s.pendingLow,lc=num(s.lastClose),d=num(s.direction)||0;if(!Number.isFinite(lc))return 0;
  let count=0,dir=0,reversal=false,sign=0;
  if(d===0){if(p>=lc+box){dir=1;sign=1;count=Math.floor((p-lc)/box+1e-12)}else if(p<=lc-box){dir=-1;sign=-1;count=Math.floor((lc-p)/box+1e-12)}}
  else if(d>0){if(p>=lc+box){dir=1;sign=1;count=Math.floor((p-lc)/box+1e-12)}else if(p<=lc-2*box){dir=-1;sign=-1;reversal=true;count=1+Math.floor((lc-2*box-p)/box+1e-12)}}
  else {if(p<=lc-box){dir=-1;sign=-1;count=Math.floor((lc-p)/box+1e-12)}else if(p>=lc+2*box){dir=1;sign=1;reversal=true;count=1+Math.floor((p-(lc+2*box))/box+1e-12)}}
  if(!(count>0))return 0;
  let start=1;if(count>=limit){out.length=0;start=count-limit+1}
  for(let j=start;j<=count;j++){
    let open,close,isRev=false;
    if(reversal){open=lc+sign*j*box;close=lc+sign*(j+1)*box;isRev=j===1}
    else{open=lc+sign*(j-1)*box;close=lc+sign*j*box}
    push(out,brick(open,close,dir,box,tm,opt.wicks!==false,isRev,opt.sourceKind,pendingHigh,pendingLow,j===1),limit);
  }
  s.lastClose=reversal?lc+sign*(count+1)*box:lc+sign*count*box;s.direction=dir;s.lastSourceTime=tm||s.lastSourceTime;s.pendingHigh=s.lastClose;s.pendingLow=s.lastClose;return count;
}
function sourceFirst(src,source){for(const b of src||[]){const a=E.barPrices(b,source);if(a?.length&&Number.isFinite(num(a[0])))return num(a[0])}return NaN}
function buildBudget(bars,settings={},tickSize=0){
  if(settings?._unboundedBricks===true)return originalBuild(bars,settings,tickSize);
  const src=(Array.isArray(bars)?bars:[]).filter(b=>finite(b?.close)).sort((a,b)=>(num(a.openTime||a.time)-num(b.openTime||b.time))),source=String(settings.source||'close').toLowerCase()==='ohlc'?'ohlc':'close',box=E.computeBox(src,settings,tickSize),exact=num(settings?._exactBox),rawAtr=Number.isFinite(exact)&&exact>0?exact:E.latestAtr(src,settings.atrLength||14),limit=limitOf(settings,false);
  if(!src.length||!(box>0))return{bricks:[],box,atr:rawAtr,state:null,anchor:NaN,source,totalBricks:0,renderedBricks:0,truncated:false,renderLimit:limit};
  const first=sourceFirst(src,source),anchor=E.floorGrid(first,box,tickSize),state=E.initState(anchor),bricks=[];let total=0;
  for(const bar of src){const tm=num(bar.closeTime||bar.time||bar.openTime)||0;for(const p of E.barPrices(bar,source))total+=processTail(state,p,bricks,{box,wicks:settings.wicks!==false,sourceTime:tm,sourceKind:'confirmed',tailLimit:limit})}
  return{bricks,box,atr:rawAtr,state:E.cloneState(state),anchor,source,totalBricks:total,renderedBricks:bricks.length,truncated:total>bricks.length,renderLimit:limit};
}
function projectBudget(base,currentBar,settings={},tickSize=0){
  if(settings?._unboundedBricks===true)return originalProject(base,currentBar,settings,tickSize);if(!base?.state||!currentBar)return[];
  const state=E.cloneState(base.state),out=[],source=String(settings.source||base.source||'close').toLowerCase()==='ohlc'?'ohlc':'close',limit=limitOf(settings,true);let total=0;
  for(const p of E.barPrices(currentBar,source))total+=processTail(state,p,out,{box:base.box,wicks:settings.wicks!==false,sourceTime:num(currentBar.closeTime||currentBar.time||Date.now()),sourceKind:'projection',tailLimit:limit});
  const mapped=out.map(b=>({...b,projection:true}));Object.defineProperty(mapped,'totalBricks',{value:total,writable:true,configurable:true});return mapped;
}
E.build=buildBudget;E.project=projectBudget;
function syncUi(){const T=window.RWARenkoTV,b=T?.state?.base;if(!T||!b)return;const total=Number(b.totalBricks??T.state.confirmed?.length??0),rendered=Number(T.state.confirmed?.length||0),projTotal=Number(T.state.projection?.totalBricks??T.state.projection?.length??0);T.state.confirmedTotal=total;T.state.renderedConfirmed=rendered;T.state.projectionTotal=projTotal;const d=document.documentElement.dataset;d.renkoBrickBudget='true';d.renkoConfirmedTotal=String(total);d.renkoRenderedBricks=String(rendered);d.renkoRenderLimit=String(b.renderLimit||DEFAULT_LIMIT);const c=document.getElementById('brickCount');if(c)c.textContent=total.toLocaleString();const m=document.getElementById('tvBrickMeta');if(m)m.textContent=`${total.toLocaleString()} confirmed · ${projTotal.toLocaleString()} projection · ${rendered.toLocaleString()} rendered`;}
window.addEventListener('renko:tv-ready',()=>{syncUi();setInterval(syncUi,500)});
window.addEventListener('renko:symbol-switch-end',syncUi);
window.RWARenkoBrickBudget={version:'1.0.0',rule:'exact-box-exact-final-state-bounded-render-tail',defaultLimit:DEFAULT_LIMIT,projectionLimit:PROJECTION_LIMIT,processTail,buildBudget,projectBudget,originalBuild,originalProject,syncUi};
})();
