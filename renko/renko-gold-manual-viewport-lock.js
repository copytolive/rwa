(()=>{
'use strict';
let gold=false;try{gold=new URLSearchParams(location.search).get('gold')==='1'}catch(_){ }
if(!gold||window.RWARenkoGoldManualViewport)return;

const stats={locks:0,unlocks:0,rangeChanges:0,rebuilds:0,restores:0,historyRestoreSkips:0,historyRangeSkips:0,settledResyncs:0,zoomOutCommands:0,zoomInCommands:0,panCommands:0,wheelEvents:0,lastReason:'',lastRange:null};
let locked=false,range=null,seq=0,rangeBound=false,rebuildWrapped=false,poll=0;
const T=()=>window.RWARenkoTV||null;
const TS=()=>window.__RWARenkoChart?.timeScale?.()||null;
const finite=r=>!!r&&Number.isFinite(Number(r.from))&&Number.isFinite(Number(r.to));
const clone=r=>finite(r)?{from:Number(r.from),to:Number(r.to)}:null;
const historyBusy=()=>!!window.RWARenkoGoldTotalHistory?.busy;
function followingOff(){const t=T();if(t?.state)t.state.following=false}
function dataset(){
  Object.assign(document.documentElement.dataset,{
    renkoGoldManualViewportLock:locked?'true':'false',
    renkoGoldManualViewportReason:String(stats.lastReason||''),
    renkoGoldManualViewportRestores:String(stats.restores),
    renkoGoldManualViewportHistorySkips:String(stats.historyRestoreSkips+stats.historyRangeSkips),
    renkoGoldManualViewportSeq:String(seq)
  });
  if(range)document.documentElement.dataset.renkoGoldManualViewportRange=`${range.from.toFixed(4)}:${range.to.toFixed(4)}`;
}
function store(r,reason='range'){
  if(!locked||!finite(r))return false;
  if(historyBusy()){stats.historyRangeSkips++;followingOff();dataset();return false}
  range=clone(r);stats.rangeChanges++;stats.lastReason=reason;stats.lastRange=clone(range);followingOff();dataset();return true;
}
function lock(reason='user'){
  locked=true;seq++;stats.locks++;stats.lastReason=reason;followingOff();
  try{window.RWARenkoGoldViewport?.lockViewport?.(`manual-${reason}`)}catch(_){ }
  const r=clone(TS()?.getVisibleLogicalRange?.());if(r&&!historyBusy())range=r;
  dataset();return seq;
}
function unlock(reason='latest'){
  locked=false;range=null;seq++;stats.unlocks++;stats.lastReason=reason;
  try{window.RWARenkoGoldViewport?.unlockViewport?.(`manual-${reason}`)}catch(_){ }
  dataset();return seq;
}
function restore(snapshot=range,token=seq){
  const r=clone(snapshot);if(!locked||token!==seq||!r)return false;
  if(historyBusy()){stats.historyRestoreSkips++;dataset();return false}
  const apply=()=>{
    if(!locked||token!==seq)return;
    if(historyBusy()){stats.historyRestoreSkips++;dataset();return}
    const t=TS();if(!t)return;
    try{t.setVisibleLogicalRange(clone(r));range=clone(r);stats.restores++;stats.lastRange=clone(range);followingOff();dataset()}catch(_){ }
  };
  queueMicrotask(apply);
  requestAnimationFrame(()=>requestAnimationFrame(apply));
  setTimeout(apply,0);setTimeout(apply,80);setTimeout(apply,220);
  return true;
}
function bindRange(){
  const t=TS();if(rangeBound||!t?.subscribeVisibleLogicalRangeChange)return false;
  rangeBound=true;
  // This subscriber is intentionally installed after renko-tv-app.js. The app
  // computes its own following flag first; manual ownership then wins last.
  // During a GOLD history prepend logical indexes are transient, so never store
  // them. The canonical total-history layer restores the exact time range first.
  t.subscribeVisibleLogicalRangeChange(r=>{
    if(!locked||!finite(r))return;
    followingOff();
    if(historyBusy()){stats.historyRangeSkips++;dataset();return}
    store(r,'visible-range');
  });
  document.documentElement.dataset.renkoGoldManualViewportRangeObserver='true';return true;
}
function patchRebuild(){
  const t=T();if(rebuildWrapped||!t?.rebuild)return false;
  const prior=t.rebuild.bind(t);
  t.rebuild=(opts={})=>{
    if(!locked)return prior(opts);
    const token=seq,snapshot=clone(TS()?.getVisibleLogicalRange?.())||clone(range),duringHistory=historyBusy();
    followingOff();stats.rebuilds++;
    const out=prior({...opts,fit:false});
    followingOff();
    // Prepending older bars changes every logical index. Restoring the old
    // logical range here is the zoom/snap bug. The total-history owner restores
    // the pre-prepend *time* range synchronously instead.
    if(snapshot&&!duringHistory)restore(snapshot,token);else if(snapshot&&duringHistory){stats.historyRestoreSkips++;dataset()}
    return out;
  };
  rebuildWrapped=true;document.documentElement.dataset.renkoGoldManualViewportRebuildGuard='true';return true;
}
function ready(){bindRange();patchRebuild();if(locked)followingOff()}
function commandEnd(reason){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(!locked||historyBusy())return;followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,reason);
  }));
  setTimeout(()=>{if(locked&&!historyBusy()){followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,reason)}},120);
}
function resyncAfterHistory(){
  if(!locked)return;
  const attempt=()=>{
    if(!locked)return;
    if(historyBusy()){setTimeout(attempt,40);return}
    followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());if(r){range=r;stats.settledResyncs++;stats.lastReason='gold-total-settled';stats.lastRange=clone(r);dataset()}
  };
  setTimeout(attempt,120);
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
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>{ready();if(locked)followingOff()});
window.addEventListener('renko:gold-total',()=>{ready();if(locked){followingOff();resyncAfterHistory()}});
poll=setInterval(()=>{ready();if(rangeBound&&rebuildWrapped){clearInterval(poll);poll=0}},100);
setTimeout(()=>{if(poll)clearInterval(poll)},15000);
window.RWARenkoGoldManualViewport={version:'3.3.0-history-time-owner',rule:'real-user-visible-range-change-wins-except-transient-history-prepend-logical-indexes-total-history-time-range-owns-prepend-and-manual-range-resyncs-after-settle',stats,get locked(){return locked},get range(){return clone(range)},get sequence(){return seq},lock,unlock,store,restore,ready};
})();