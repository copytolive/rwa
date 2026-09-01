(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldHistoryGeometryStitch)return;
const MAX_RENDER_BRICKS=2500,RENDER_LEFT=600,CACHE_LEFT=48000,CACHE_RIGHT=8000,CACHE_MAX=CACHE_LEFT+CACHE_RIGHT,VIEW_BUFFER=160;
const stats={wraps:0,stitches:0,misses:0,buildErrors:0,boxMismatches:0,last:null,maxRendered:0,maxCached:0,cacheResets:0};
let wrapped=false,poll=0,geometryCache=[];
const T=()=>window.RWARenkoTV||null;
const H=()=>window.RWARenkoGoldTotalHistory||null;
const TS=()=>window.__RWARenkoChart?.timeScale?.()||null;
const num=v=>Number(v);
const finite=v=>Number.isFinite(num(v));
const canonicalTime=b=>num(b?._canonicalSourceTime??b?.sourceTime??0);
const displayTime=b=>Math.floor(num(b?.sourceTime)/1000);
const tickKey=(v,tick)=>Math.round(num(v)/(tick>0?tick:1e-9));
function brickKey(b,tick){return `${canonicalTime(b)}|${tickKey(b?.open,tick)}|${tickKey(b?.close,tick)}|${num(b?.direction)||0}|${b?.isReversal?1:0}`}
function lowerBoundTime(rows,time,getter){let lo=0,hi=rows.length;while(lo<hi){const m=(lo+hi)>>1;if(num(getter(rows[m]))<time)lo=m+1;else hi=m}return Math.max(0,Math.min(rows.length-1,lo))}
function visibleRange(){const r=TS()?.getVisibleRange?.();return r&&finite(r.from)&&finite(r.to)?{from:num(r.from),to:num(r.to)}:null}
function visibleOldIndex(oldData){const r=visibleRange();if(!r||!oldData?.length)return 0;return lowerBoundTime(oldData,r.from,b=>b?.time)}
function seedCache(oldBricks,oldData){
  const n=Math.min(oldBricks.length,oldData.length),out=[];for(let i=0;i<n;i++){const b=oldBricks[i],t=num(oldData[i]?.time);if(!finite(t))continue;out.push({...b,_canonicalSourceTime:canonicalTime(b),sourceTime:Math.floor(t)*1000})}
  geometryCache=out;stats.cacheResets++;stats.maxCached=Math.max(stats.maxCached,geometryCache.length);return geometryCache;
}
function decoratePrefix(rows,suffixStartTime){
  const out=rows.map(b=>({...b,_canonicalSourceTime:canonicalTime(b)}));let last=0;for(const b of out){let t=Math.max(1,Math.floor(canonicalTime(b)/1000));if(t<=last)t=last+1;last=t;b.sourceTime=t*1000}
  if(out.length&&finite(suffixStartTime)&&last>=suffixStartTime){const shift=last-suffixStartTime+1;for(const b of out)b.sourceTime=(Math.floor(num(b.sourceTime)/1000)-shift)*1000}
  return out;
}
function cacheVisibleIndex(cache,oldData){const r=visibleRange(),fallback=oldData?.length?num(oldData[Math.min(oldData.length-1,visibleOldIndex(oldData))]?.time):null;if(!cache.length)return 0;const target=r?num(r.from):fallback;return finite(target)?lowerBoundTime(cache,target,displayTime):Math.max(0,cache.length-1)}
function exactDisplayIndex(rows,time){if(!rows?.length||!finite(time))return-1;const i=lowerBoundTime(rows,num(time),displayTime);if(i>=0&&i<rows.length&&displayTime(rows[i])===Math.floor(num(time)))return i;for(let j=Math.max(0,i-2);j<Math.min(rows.length,i+3);j++)if(displayTime(rows[j])===Math.floor(num(time)))return j;return-1}
function boundCache(rows,visibleTime){if(rows.length<=CACHE_MAX)return rows;let vi=finite(visibleTime)?lowerBoundTime(rows,num(visibleTime),displayTime):Math.max(0,rows.length-CACHE_RIGHT);let start=Math.max(0,vi-CACHE_LEFT),end=Math.min(rows.length,start+CACHE_MAX);if(end-start<CACHE_MAX)start=Math.max(0,end-CACHE_MAX);return rows.slice(start,end)}
function renderWindow(cache,visibleTime){if(cache.length<=MAX_RENDER_BRICKS)return cache.slice();let vi=finite(visibleTime)?lowerBoundTime(cache,num(visibleTime),displayTime):Math.max(0,cache.length-1);let start=Math.max(0,vi-RENDER_LEFT),end=Math.min(cache.length,start+MAX_RENDER_BRICKS);if(end-start<MAX_RENDER_BRICKS)start=Math.max(0,end-MAX_RENDER_BRICKS);return cache.slice(start,end)}
function stitch(prepared,oldBricks,oldData,oldBase,tick){
  const wb=Array.isArray(prepared?.bricks)?prepared.bricks:[];if(!wb.length||!oldBricks.length||!oldData.length)return null;
  const oldBox=num(oldBase?.box),newBox=num(prepared?.box),tol=Math.max(1e-12,Math.abs(oldBox||newBox||1)*1e-10);if(finite(oldBox)&&finite(newBox)&&Math.abs(oldBox-newBox)>tol){stats.boxMismatches++;geometryCache=[];return null}
  if(!geometryCache.length)seedCache(oldBricks,oldData);
  const cache=geometryCache,workerMap=new Map();for(let i=0;i<wb.length;i++)workerMap.set(brickKey(wb[i],tick),i);
  const cVisible=cacheVisibleIndex(cache,oldData),limit=Math.min(cache.length-1,Math.max(0,cVisible-VIEW_BUFFER));let ci=-1,wi=-1;
  for(let i=limit;i>=0;i--){const hit=workerMap.get(brickKey(cache[i],tick));if(Number.isInteger(hit)){ci=i;wi=hit;break}}
  if(ci<0){for(let i=Math.min(cVisible,cache.length-1);i>=0;i--){const hit=workerMap.get(brickKey(cache[i],tick));if(Number.isInteger(hit)){ci=i;wi=hit;break}}}
  if(ci<0||wi<0)return null;
  const seamTime=displayTime(cache[ci]),prefixRaw=wb.slice(Math.max(0,wi-CACHE_LEFT),wi),prefix=decoratePrefix(prefixRaw,seamTime),suffix=cache.slice(ci).map(b=>({...b,_canonicalSourceTime:canonicalTime(b),sourceTime:num(b.sourceTime)}));
  let joined=[...prefix,...suffix];const r=visibleRange(),oldVisible=visibleOldIndex(oldData),anchorTime=num(oldData[oldVisible]?.time),wantedTime=r?num(r.from):anchorTime;
  joined=boundCache(joined,wantedTime);geometryCache=joined;stats.maxCached=Math.max(stats.maxCached,joined.length);
  const bricks=renderWindow(joined,wantedTime),newAnchor=exactDisplayIndex(bricks,anchorTime),logicalDelta=newAnchor>=0?newAnchor-oldVisible:null;
  if(newAnchor<0)return null;
  const base={...prepared,box:finite(oldBox)?oldBox:prepared.box,atr:finite(oldBase?.atr)?num(oldBase.atr):prepared.atr,bricks};
  return{base,ci,wi,oldVisible,newAnchor,logicalDelta,prefix:prefix.length,cache:joined.length,rendered:bricks.length,workerBricks:wb.length,seamTime,anchorTime,wantedTime};
}
function fallbackWithPrepared(t,prior,outerBuild,prepared,opts){t.engine.build=()=>prepared;try{return prior({...opts,fit:false})}finally{t.engine.build=outerBuild}}
function install(){
  const t=T();if(wrapped||!t?.rebuild||!t?.engine?.build)return false;const prior=t.rebuild.bind(t);
  t.rebuild=(opts={})=>{
    const h=H(),active=!!h?.busy&&t.state?.symbol==='XAUUSD'&&Array.isArray(t.state?.confirmed)&&t.state.confirmed.length&&Array.isArray(t.state?.confirmedData)&&t.state.confirmedData.length;if(!active)return prior(opts);
    const outerBuild=t.engine.build,oldBricks=t.state.confirmed.slice(),oldData=t.state.confirmedData.slice(),oldBase=t.state.base,tick=num(t.state.tickSize)||0.001;let prepared;
    try{prepared=outerBuild(t.state.closedBars,t.settings,t.state.tickSize)}catch(err){stats.buildErrors++;stats.last={ok:false,reason:'prepared-build-error',message:String(err?.message||err)};throw err}
    const result=stitch(prepared,oldBricks,oldData,oldBase,tick);if(!result){stats.misses++;stats.last={ok:false,reason:'seam-miss',oldBricks:oldBricks.length,cached:geometryCache.length,workerBricks:prepared?.bricks?.length||0};return fallbackWithPrepared(t,prior,outerBuild,prepared,opts)}
    stats.stitches++;stats.maxRendered=Math.max(stats.maxRendered,result.rendered);stats.last={ok:true,ci:result.ci,wi:result.wi,oldVisible:result.oldVisible,newAnchor:result.newAnchor,logicalDelta:result.logicalDelta,prefix:result.prefix,cached:result.cache,rendered:result.rendered,workerBricks:result.workerBricks,seamTime:result.seamTime,anchorTime:result.anchorTime,wantedTime:result.wantedTime};
    t.engine.build=()=>result.base;try{return prior({...opts,fit:false})}finally{t.engine.build=outerBuild}
  };
  wrapped=true;stats.wraps++;document.documentElement.dataset.renkoGoldGeometryStitch='true';return true;
}
poll=setInterval(()=>{if(install()){clearInterval(poll);poll=0}},25);setTimeout(()=>{if(poll)clearInterval(poll)},10000);for(const ev of ['renko:tv-ready','renko:chart-ready','renko:gold-recent'])window.addEventListener(ev,install);
window.RWARenkoGoldHistoryGeometryStitch={version:'2.0.0-bounded-hidden-seam-cache',rule:'GOLD prepend renders at most 2500 bricks while retaining a separately bounded 56000-brick immutable display-time geometry seam cache; each history rebuild consumes exactly one prepared engine build',stats,install,get cacheSize(){return geometryCache.length}};
})();
