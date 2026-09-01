/* GOLD prepend zero-refresh guard.
 * Older canonical history may change logical indexes, but it must never change
 * the operator's visible time window or zoom. Restore the pre-prepend time range
 * synchronously in the same JS turn, before the browser can paint a reset frame.
 */
(()=>{
'use strict';
let gold=false;try{gold=new URLSearchParams(location.search).get('gold')==='1'}catch(_){ }
if(!gold||window.RWARenkoGoldPrependZeroRefresh)return;
const stats={rebuilds:0,immediateRestores:0,reinforcedRestores:0,restoreFailures:0,longTasks:0,tbtMs:0,maxBlockingMs:0,lastBefore:null,lastAfter:null,lastLogicalBefore:null,lastLogicalAfter:null,lastApplyMs:0,settleWindows:0};
let wrapped=false,poll=0,windowStart=0,windowEnd=0,settleUntil=0;
const T=()=>window.RWARenkoTV||null;
const TS=()=>window.__RWARenkoChart?.timeScale?.()||null;
const finite=r=>!!r&&Number.isFinite(Number(r.from))&&Number.isFinite(Number(r.to));
const clone=r=>finite(r)?{from:Number(r.from),to:Number(r.to)}:null;
const busy=()=>!!window.RWARenkoGoldTotalHistory?.busy;
const settling=()=>performance.now()<settleUntil;
function sameRange(a,b,tol=1){return finite(a)&&finite(b)&&Math.abs(Number(a.from)-Number(b.from))<=tol&&Math.abs(Number(a.to)-Number(b.to))<=tol}
function publish(){
  Object.assign(document.documentElement.dataset,{
    renkoGoldPrependZeroRefresh:'true',
    renkoGoldPrependImmediateRestores:String(stats.immediateRestores),
    renkoGoldPrependTbtMs:String(stats.tbtMs),
    renkoGoldPrependLastApplyMs:String(stats.lastApplyMs),
    renkoGoldPrependSettling:settling()?'true':'false',
    renkoGoldPrependStable:String(stats.lastBefore&&stats.lastAfter&&sameRange(stats.lastBefore,stats.lastAfter)?'true':'unknown')
  });
}
function setTimeRange(r,reinforced=false){
  if(!finite(r))return false;const ts=TS();if(!ts)return false;
  try{ts.setVisibleRange(clone(r));const t=T();if(t?.state)t.state.following=false;reinforced?stats.reinforcedRestores++:stats.immediateRestores++;return true}catch(_){stats.restoreFailures++;return false}
}
function install(){
  const t=T();if(wrapped||!t?.rebuild)return false;
  const prior=t.rebuild.bind(t);
  t.rebuild=(opts={})=>{
    if(!busy())return prior(opts);
    const ts=TS(),timeBefore=clone(ts?.getVisibleRange?.()),logicalBefore=clone(ts?.getVisibleLogicalRange?.()),started=performance.now();
    windowStart=started;windowEnd=started+250;settleUntil=started+360;stats.settleWindows++;
    const out=prior({...opts,fit:false});
    stats.rebuilds++;stats.lastApplyMs=performance.now()-started;stats.lastBefore=clone(timeBefore);stats.lastLogicalBefore=clone(logicalBefore);
    // Critical path: same-turn restore, before paint.
    if(timeBefore)setTimeRange(timeBefore,false);
    stats.lastAfter=clone(TS()?.getVisibleRange?.());stats.lastLogicalAfter=clone(TS()?.getVisibleLogicalRange?.());
    publish();
    // Reinforce against library-internal deferred scale bookkeeping. During this
    // settle window all other viewport owners must ignore transient callbacks.
    const reinforce=()=>{if(timeBefore){setTimeRange(timeBefore,true);stats.lastAfter=clone(TS()?.getVisibleRange?.());stats.lastLogicalAfter=clone(TS()?.getVisibleLogicalRange?.());publish()}};
    queueMicrotask(reinforce);requestAnimationFrame(reinforce);requestAnimationFrame(()=>requestAnimationFrame(reinforce));setTimeout(reinforce,0);setTimeout(reinforce,80);setTimeout(reinforce,180);setTimeout(publish,370);
    return out;
  };
  wrapped=true;document.documentElement.dataset.renkoGoldPrependRebuildGuard='true';return true;
}
try{
  if(typeof PerformanceObserver==='function'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){
    const po=new PerformanceObserver(list=>{for(const e of list.getEntries()){const a=e.startTime,b=a+e.duration;if(a<=windowEnd&&b>=windowStart){const block=Math.max(0,Number(e.duration)-50);if(block>0){stats.longTasks++;stats.tbtMs+=block;stats.maxBlockingMs=Math.max(stats.maxBlockingMs,block);publish()}}}});po.observe({type:'longtask',buffered:true});
  }
}catch(_){ }
function ready(){install();publish()}
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:gold-total'])window.addEventListener(ev,ready);
poll=setInterval(()=>{if(install()){clearInterval(poll);poll=0}},50);setTimeout(()=>{if(poll)clearInterval(poll)},15000);
window.RWARenkoGoldPrependZeroRefresh={version:'1.1.0-settle-quarantine',rule:'canonical-history-prepend-restores-exact-visible-time-range-synchronously-before-paint-and-quarantines-transient-logical-callbacks-through-settle-window',stats,ready,sameRange,get settling(){return settling()},get settleUntil(){return settleUntil}};
})();