(()=>{
'use strict';
let gold=false;try{gold=new URLSearchParams(location.search).get('gold')==='1'}catch(_){ }
if(!gold||window.RWARenkoGoldManualViewport)return;

const stats={locks:0,unlocks:0,rangeChanges:0,rebuilds:0,restores:0,zoomOutCommands:0,zoomInCommands:0,panCommands:0,wheelEvents:0,atomicBegins:0,atomicEnds:0,atomicRestoreSkips:0,lastReason:'',lastRange:null,lastTimeRange:null};
let locked=false,range=null,timeRange=null,seq=0,rangeBound=false,rebuildWrapped=false,poll=0,atomicDepth=0;
const T=()=>window.RWARenkoTV||null;
const TS=()=>window.__RWARenkoChart?.timeScale?.()||null;
const finite=r=>!!r&&Number.isFinite(Number(r.from))&&Number.isFinite(Number(r.to));
const clone=r=>finite(r)?{from:Number(r.from),to:Number(r.to)}:null;
function followingOff(){const t=T();if(t?.state)t.state.following=false}
function readTime(){try{return clone(TS()?.getVisibleRange?.())}catch(_){return null}}
function dataset(){
  Object.assign(document.documentElement.dataset,{
    renkoGoldManualViewportLock:locked?'true':'false',
    renkoGoldManualViewportReason:String(stats.lastReason||''),
    renkoGoldManualViewportRestores:String(stats.restores),
    renkoGoldManualViewportSeq:String(seq),
    renkoGoldManualViewportAtomic:String(atomicDepth>0)
  });
  if(range)document.documentElement.dataset.renkoGoldManualViewportRange=`${range.from.toFixed(4)}:${range.to.toFixed(4)}`;
  if(timeRange)document.documentElement.dataset.renkoGoldManualViewportTimeRange=`${timeRange.from}:${timeRange.to}`;
}
function store(r,reason='range'){
  if(!locked||!finite(r)||atomicDepth>0)return false;
  range=clone(r);timeRange=readTime()||timeRange;stats.rangeChanges++;stats.lastReason=reason;stats.lastRange=clone(range);stats.lastTimeRange=clone(timeRange);followingOff();dataset();return true;
}
function lock(reason='user'){
  locked=true;seq++;stats.locks++;stats.lastReason=reason;followingOff();
  try{window.RWARenkoGoldViewport?.lockViewport?.(`manual-${reason}`)}catch(_){ }
  const r=clone(TS()?.getVisibleLogicalRange?.());if(r)range=r;timeRange=readTime()||timeRange;
  dataset();return seq;
}
function unlock(reason='latest'){
  locked=false;range=null;timeRange=null;seq++;stats.unlocks++;stats.lastReason=reason;
  try{window.RWARenkoGoldViewport?.unlockViewport?.(`manual-${reason}`)}catch(_){ }
  dataset();return seq;
}
function beginAtomic(reason='history-mutation'){
  const snapshot={logical:clone(TS()?.getVisibleLogicalRange?.())||clone(range),time:readTime()||clone(timeRange),locked};
  atomicDepth++;seq++;stats.atomicBegins++;stats.lastReason=reason;followingOff();dataset();return{token:seq,snapshot};
}
function endAtomic(ctx=null,reason='history-mutation-end'){
  if(atomicDepth>0)atomicDepth--;seq++;stats.atomicEnds++;stats.lastReason=reason;
  if(locked){const r=clone(TS()?.getVisibleLogicalRange?.());const tm=readTime();if(r)range=r;if(tm)timeRange=tm;stats.lastRange=clone(range);stats.lastTimeRange=clone(timeRange);followingOff()}
  dataset();return{token:seq,range:clone(range),timeRange:clone(timeRange),ctx};
}
function restore(snapshot=range,token=seq){
  const r=clone(snapshot);if(!locked||token!==seq||!r)return false;
  if(atomicDepth>0||window.RWARenkoGoldTotalHistory?.busy||document.documentElement.dataset.renkoGoldHistoryAtomic==='true'){stats.atomicRestoreSkips++;return false}
  const apply=()=>{
    if(!locked||token!==seq||atomicDepth>0||window.RWARenkoGoldTotalHistory?.busy)return;
    const t=TS();if(!t)return;
    try{t.setVisibleLogicalRange(clone(r));range=clone(r);timeRange=readTime()||timeRange;stats.restores++;stats.lastRange=clone(range);stats.lastTimeRange=clone(timeRange);followingOff();dataset()}catch(_){ }
  };
  queueMicrotask(apply);
  requestAnimationFrame(()=>requestAnimationFrame(apply));
  setTimeout(apply,0);setTimeout(apply,80);setTimeout(apply,220);
  return true;
}
function bindRange(){
  const t=TS();if(rangeBound||!t?.subscribeVisibleLogicalRangeChange)return false;
  rangeBound=true;
  t.subscribeVisibleLogicalRangeChange(r=>{
    if(!locked||!finite(r)||atomicDepth>0||window.RWARenkoGoldTotalHistory?.busy)return;
    followingOff();store(r,'visible-range');
  });
  document.documentElement.dataset.renkoGoldManualViewportRangeObserver='true';return true;
}
function patchRebuild(){
  const t=T();if(rebuildWrapped||!t?.rebuild)return false;
  const prior=t.rebuild.bind(t);
  t.rebuild=(opts={})=>{
    if(!locked)return prior(opts);
    const historyAtomic=atomicDepth>0||window.RWARenkoGoldTotalHistory?.busy||document.documentElement.dataset.renkoGoldHistoryAtomic==='true';
    const token=seq,snapshot=clone(TS()?.getVisibleLogicalRange?.())||clone(range);
    followingOff();stats.rebuilds++;
    const out=prior({...opts,fit:false});
    followingOff();
    if(historyAtomic){stats.atomicRestoreSkips++;return out}
    if(snapshot)restore(snapshot,token);return out;
  };
  rebuildWrapped=true;document.documentElement.dataset.renkoGoldManualViewportRebuildGuard='true';return true;
}
function ready(){bindRange();patchRebuild();if(locked)followingOff()}
function commandEnd(reason){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(!locked||atomicDepth>0)return;followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,reason);
  }));
  setTimeout(()=>{if(locked&&atomicDepth===0){followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,reason)}},120);
}
const chartTarget=e=>e.target?.closest?.('#chartWrap,#chartHost');
document.addEventListener('wheel',e=>{if(chartTarget(e)){stats.wheelEvents++;lock('wheel');commandEnd('wheel-end')}},{capture:true,passive:true});
document.addEventListener('pointerdown',e=>{if(chartTarget(e))lock('pointerdown')},{capture:true,passive:true});
document.addEventListener('touchstart',e=>{if(chartTarget(e))lock('touchstart')},{capture:true,passive:true});
document.addEventListener('pointerup',e=>{if(chartTarget(e)&&locked)commandEnd('pointerup')},{capture:true,passive:true});
document.addEventListener('touchend',e=>{if(chartTarget(e)&&locked)commandEnd('touchend')},{capture:true,passive:true});
document.addEventListener('click',e=>{
  const id=e.target?.closest?.('button')?.id||'';
  if(id==='tvLive'||id==='tvReset'){unlock(id);return}
  if(id==='tvGoldOrigin'){unlock('origin-command');return}
  const zoomOut=id==='tvZoomOut'||id==='tvGoldMaxZoom';
  const zoomIn=id==='tvZoomIn';
  const pan=['tvPanOlder','tvPanNewer','tvGoldOlder','tvGoldNewer'].includes(id);
  if(!(zoomOut||zoomIn||pan))return;
  lock(id);
  if(zoomOut)stats.zoomOutCommands++;if(zoomIn)stats.zoomInCommands++;if(pan)stats.panCommands++;
  commandEnd(id+'-end');
},true);
window.addEventListener('renko:gold-origin',()=>setTimeout(()=>{lock('origin-ready');const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,'origin-range')},80));
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:gold-total','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>{ready();if(locked)followingOff()});
poll=setInterval(()=>{ready();if(rangeBound&&rebuildWrapped){clearInterval(poll);poll=0}},100);
setTimeout(()=>{if(poll)clearInterval(poll)},15000);
window.RWARenkoGoldManualViewport={version:'4.0.0-atomic-history-time-aware',rule:'user-visible-range-owns-viewport; canonical history mutations invalidate stale logical restores and total-history restores by visible time before observers re-arm',stats,get locked(){return locked},get range(){return clone(range)},get timeRange(){return clone(timeRange)},get sequence(){return seq},get atomic(){return atomicDepth>0},lock,unlock,store,restore,beginAtomic,endAtomic,ready};
})();
