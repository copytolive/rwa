(()=>{
'use strict';
let gold=false;try{gold=new URLSearchParams(location.search).get('gold')==='1'}catch(_){ }
if(!gold||window.RWARenkoGoldManualViewport)return;

const stats={locks:0,unlocks:0,rangeChanges:0,rebuilds:0,restores:0,blockedRecenters:0,allowedCommandWrites:0,zoomOutCommands:0,zoomInCommands:0,panCommands:0,lastReason:'',lastRange:null};
let locked=false,range=null,seq=0,internalWrite=false,allowedWrites=0,rangeBound=false,rebuildWrapped=false,timeScalePatched=false,poll=0;
const T=()=>window.RWARenkoTV||null;
const TS=()=>window.__RWARenkoChart?.timeScale?.()||null;
const finite=r=>!!r&&Number.isFinite(Number(r.from))&&Number.isFinite(Number(r.to));
const clone=r=>finite(r)?{from:Number(r.from),to:Number(r.to)}:null;
function followingOff(){const t=T();if(t?.state)t.state.following=false}
function dataset(){
  Object.assign(document.documentElement.dataset,{
    renkoGoldManualViewportLock:locked?'true':'false',
    renkoGoldManualViewportReason:String(stats.lastReason||''),
    renkoGoldManualViewportBlockedRecenters:String(stats.blockedRecenters),
    renkoGoldManualViewportAllowedWrites:String(stats.allowedCommandWrites),
    renkoGoldManualViewportRestores:String(stats.restores),
    renkoGoldManualViewportSeq:String(seq)
  });
  if(range)document.documentElement.dataset.renkoGoldManualViewportRange=`${range.from.toFixed(4)}:${range.to.toFixed(4)}`;
}
function store(r,reason='range'){
  if(!locked||!finite(r))return false;
  range=clone(r);stats.rangeChanges++;stats.lastReason=reason;stats.lastRange=clone(range);followingOff();dataset();return true;
}
function lock(reason='user'){
  locked=true;seq++;stats.locks++;stats.lastReason=reason;followingOff();
  try{window.RWARenkoGoldViewport?.lockViewport?.(`manual-${reason}`)}catch(_){ }
  const r=clone(TS()?.getVisibleLogicalRange?.());if(r)range=r;
  dataset();return seq;
}
function unlock(reason='latest'){
  locked=false;range=null;allowedWrites=0;seq++;stats.unlocks++;stats.lastReason=reason;
  try{window.RWARenkoGoldViewport?.unlockViewport?.(`manual-${reason}`)}catch(_){ }
  dataset();return seq;
}
function permitWrites(n=1){allowedWrites=Math.max(allowedWrites,Math.max(0,Math.floor(Number(n)||0)))}
function rawSet(r){
  const t=TS();if(!t||!finite(r))return false;
  internalWrite=true;
  try{t.setVisibleLogicalRange({from:Number(r.from),to:Number(r.to)});return true}catch(_){return false}finally{internalWrite=false}
}
function restore(snapshot=range,token=seq){
  const r=clone(snapshot);if(!locked||token!==seq||!r)return false;
  const apply=()=>{
    if(!locked||token!==seq)return;
    if(rawSet(r)){range=clone(r);stats.restores++;stats.lastRange=clone(range);followingOff();dataset()}
  };
  queueMicrotask(apply);
  requestAnimationFrame(()=>requestAnimationFrame(apply));
  setTimeout(apply,0);setTimeout(apply,80);setTimeout(apply,220);
  return true;
}
function shouldBlock(){return locked&&!internalWrite&&allowedWrites<=0}
function consumeAllowed(){if(locked&&!internalWrite&&allowedWrites>0){allowedWrites--;stats.allowedCommandWrites++;dataset();return true}return false}
function patchTimeScale(){
  const t=TS();if(timeScalePatched||!t)return false;
  const nativeSet=t.setVisibleLogicalRange?.bind(t);
  if(nativeSet){
    t.setVisibleLogicalRange=r=>{
      if(consumeAllowed())return nativeSet(r);
      if(shouldBlock()){
        stats.blockedRecenters++;followingOff();dataset();
        if(range){internalWrite=true;try{return nativeSet(clone(range))}finally{internalWrite=false}}
        return;
      }
      return nativeSet(r);
    };
  }
  for(const name of ['fitContent','scrollToRealTime','resetTimeScale']){
    const native=typeof t[name]==='function'?t[name].bind(t):null;if(!native)continue;
    t[name]=(...args)=>{
      if(consumeAllowed())return native(...args);
      if(shouldBlock()){
        stats.blockedRecenters++;followingOff();dataset();if(range)restore(range,seq);return;
      }
      return native(...args);
    };
  }
  const nativeScroll=typeof t.scrollToPosition==='function'?t.scrollToPosition.bind(t):null;
  if(nativeScroll)t.scrollToPosition=(...args)=>{
    if(consumeAllowed())return nativeScroll(...args);
    if(shouldBlock()){
      stats.blockedRecenters++;followingOff();dataset();if(range)restore(range,seq);return;
    }
    return nativeScroll(...args);
  };
  timeScalePatched=true;document.documentElement.dataset.renkoGoldManualViewportTimeScaleGuard='true';return true;
}
function bindRange(){
  const t=TS();if(rangeBound||!t?.subscribeVisibleLogicalRangeChange)return false;
  rangeBound=true;
  t.subscribeVisibleLogicalRangeChange(r=>{
    if(!locked||!finite(r))return;
    followingOff();store(r,'visible-range');
  });
  document.documentElement.dataset.renkoGoldManualViewportRangeObserver='true';return true;
}
function patchRebuild(){
  const t=T();if(rebuildWrapped||!t?.rebuild)return false;
  const prior=t.rebuild.bind(t);
  t.rebuild=(opts={})=>{
    if(!locked)return prior(opts);
    const token=seq,snapshot=clone(TS()?.getVisibleLogicalRange?.())||clone(range);
    followingOff();stats.rebuilds++;
    const out=prior({...opts,fit:false});
    followingOff();if(snapshot)restore(snapshot,token);return out;
  };
  rebuildWrapped=true;document.documentElement.dataset.renkoGoldManualViewportRebuildGuard='true';return true;
}
function ready(){patchTimeScale();bindRange();patchRebuild();if(locked)followingOff()}
function commandEnd(reason){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(!locked)return;followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,reason);
  }));
  setTimeout(()=>{if(locked){followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,reason)}},120);
}
const chartTarget=e=>e.target?.closest?.('#chartWrap,#chartHost');
document.addEventListener('wheel',e=>{if(chartTarget(e)){lock('wheel');commandEnd('wheel-end')}},{capture:true,passive:true});
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
  lock(id);permitWrites(1);
  if(zoomOut)stats.zoomOutCommands++;if(zoomIn)stats.zoomInCommands++;if(pan)stats.panCommands++;
  commandEnd(id+'-end');
},true);
window.addEventListener('renko:gold-origin',()=>setTimeout(()=>{lock('origin-ready');const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,'origin-range')},80));
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:gold-total','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>{ready();if(locked)followingOff()});
poll=setInterval(()=>{ready();if(rangeBound&&rebuildWrapped&&timeScalePatched){clearInterval(poll);poll=0}},100);
setTimeout(()=>{if(poll)clearInterval(poll)},15000);
window.RWARenkoGoldManualViewport={version:'3.1.0-bidirectional-hard-lock',rule:'manual-zoom-pan-owns-visible-logical-range-both-directions-one-command-write-only-block-all-later-programmatic-recenter-until-explicit-live-reset',stats,get locked(){return locked},get range(){return clone(range)},get sequence(){return seq},lock,unlock,permitWrites,store,restore,ready};
})();
