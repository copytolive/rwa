(()=>{
'use strict';
let gold=false;try{gold=new URLSearchParams(location.search).get('gold')==='1'}catch(_){ }
if(!gold||window.RWARenkoGoldManualViewport)return;

const stats={locks:0,unlocks:0,rangeChanges:0,rebuilds:0,restores:0,historyRestoreSkips:0,historyRangeSkips:0,settledResyncs:0,zoomOutCommands:0,zoomInCommands:0,panCommands:0,wheelEvents:0,lastReason:'',lastRange:null};
let locked=false,range=null,seq=0,rangeBound=false,rebuildWrapped=false,poll=0,commandTimer=0;
const T=()=>window.RWARenkoTV||null;
const TS=()=>window.__RWARenkoChart?.timeScale?.()||null;
const finite=r=>!!r&&Number.isFinite(Number(r.from))&&Number.isFinite(Number(r.to));
const clone=r=>finite(r)?{from:Number(r.from),to:Number(r.to)}:null;
const historyBusy=()=>!!window.RWARenkoGoldTotalHistory?.busy||!!window.RWARenkoGoldPrependZeroRefresh?.settling;
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
  // A trackpad emits many WheelEvents for one physical gesture. Once manual
  // ownership is active, do not create a new sequence token for every packet.
  if(locked&&reason==='wheel'){stats.lastReason=reason;followingOff();dataset();return seq}
  locked=true;seq++;stats.locks++;stats.lastReason=reason;followingOff();
  try{window.RWARenkoGoldViewport?.lockViewport?.(`manual-${reason}`)}catch(_){ }
  const r=clone(TS()?.getVisibleLogicalRange?.());if(r&&!historyBusy())range=r;
  dataset();return seq;
}
function unlock(reason='latest'){
  locked=false;range=null;seq++;stats.unlocks++;stats.lastReason=reason;if(commandTimer){clearTimeout(commandTimer);commandTimer=0}
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
  queueMicrotask(apply);requestAnimationFrame(()=>requestAnimationFrame(apply));setTimeout(apply,0);setTimeout(apply,80);setTimeout(apply,220);
  return true;
}
function bindRange(){
  const t=TS();if(rangeBound||!t?.subscribeVisibleLogicalRangeChange)return false;
  rangeBound=true;
  t.subscribeVisibleLogicalRangeChange(r=>{
    if(!locked||!finite(r))return;
    followingOff();
    // Logical indexes emitted during rebuild/settle are not user intent.
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
    const out=prior({...opts,fit:false});followingOff();
    if(snapshot&&!duringHistory)restore(snapshot,token);else if(snapshot&&duringHistory){stats.historyRestoreSkips++;dataset()}
    return out;
  };
  rebuildWrapped=true;document.documentElement.dataset.renkoGoldManualViewportRebuildGuard='true';return true;
}
function ready(){bindRange();patchRebuild();if(locked)followingOff()}
function commitCurrentRange(reason){
  if(!locked||historyBusy())return false;followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());return r?store(r,reason):false;
}
function commandEnd(reason){
  // Debounce the entire physical gesture. Old timers from early wheel packets
  // must never store a transient post-prepend logical range.
  if(commandTimer)clearTimeout(commandTimer);
  commandTimer=setTimeout(()=>{
    commandTimer=0;
    if(historyBusy()){commandEnd(reason);return}
    requestAnimationFrame(()=>requestAnimationFrame(()=>commitCurrentRange(reason)));
  },190);
}
function resyncAfterHistory(){
  if(!locked)return;
  const attempt=()=>{
    if(!locked)return;
    if(historyBusy()){setTimeout(attempt,40);return}
    followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());if(r){range=r;stats.settledResyncs++;stats.lastReason='gold-total-settled';stats.lastRange=clone(r);dataset()}
  };
  setTimeout(attempt,380);
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
  const zoomOut=id==='tvZoomOut'||id==='tvGoldMaxZoom',zoomIn=id==='tvZoomIn',pan=['tvPanOlder','tvPanNewer','tvGoldOlder','tvGoldNewer'].includes(id);
  if(!(zoomOut||zoomIn||pan))return;
  lock(id);if(zoomOut)stats.zoomOutCommands++;if(zoomIn)stats.zoomInCommands++;if(pan)stats.panCommands++;commandEnd(id+'-end');
},true);
window.addEventListener('renko:gold-origin',()=>setTimeout(()=>{lock('origin-ready');const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,'origin-range')},80));
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>{ready();if(locked)followingOff()});
window.addEventListener('renko:gold-total',()=>{ready();if(locked){followingOff();resyncAfterHistory()}});
poll=setInterval(()=>{ready();if(rangeBound&&rebuildWrapped){clearInterval(poll);poll=0}},100);setTimeout(()=>{if(poll)clearInterval(poll)},15000);
window.RWARenkoGoldManualViewport={version:'3.4.0-settle-debounce',rule:'one-manual-owner-per-wheel-gesture-transient-history-and-settle-logical-ranges-never-become-user-viewport-debounced-wheel-end-commit',stats,get locked(){return locked},get range(){return clone(range)},get sequence(){return seq},lock,unlock,store,restore,ready};
})();