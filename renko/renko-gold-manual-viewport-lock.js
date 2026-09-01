(()=>{
'use strict';
let gold=false;try{gold=new URLSearchParams(location.search).get('gold')==='1'}catch(_){ }
if(!gold||window.RWARenkoGoldManualViewport)return;

const stats={locks:0,unlocks:0,rangeChanges:0,rebuilds:0,restores:0,zoomOutCommands:0,zoomInCommands:0,panCommands:0,wheelEvents:0,lastReason:'',lastRange:null,historyMutations:0,historyRestores:0,historyCorrections:0,historySettlePasses:0,suppressedRangeChanges:0,lastHistory:null};
let locked=false,range=null,seq=0,rangeBound=false,rebuildWrapped=false,poll=0,historyDepth=0,suppressRangeChanges=0,historySeq=0;
const T=()=>window.RWARenkoTV||null;
const TS=()=>window.__RWARenkoChart?.timeScale?.()||null;
const finite=r=>!!r&&Number.isFinite(Number(r.from))&&Number.isFinite(Number(r.to));
const clone=r=>finite(r)?{from:Number(r.from),to:Number(r.to)}:null;
const finiteNumber=v=>Number.isFinite(Number(v));
const cloneTime=clone;
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function followingOff(){const t=T();if(t?.state)t.state.following=false}
function scaleOptions(ts=TS()){try{const o=ts?.options?.()||{};return{barSpacing:finiteNumber(o.barSpacing)?Number(o.barSpacing):null,rightOffset:finiteNumber(o.rightOffset)?Number(o.rightOffset):null}}catch(_){return{barSpacing:null,rightOffset:null}}}
function scrollPosition(ts=TS()){try{const v=ts?.scrollPosition?.();return finiteNumber(v)?Number(v):null}catch(_){return null}}
function viewportSnapshot(reason='history'){
  const ts=TS(),time=cloneTime(ts?.getVisibleRange?.()),logical=clone(ts?.getVisibleLogicalRange?.()),opts=scaleOptions(ts),scroll=scrollPosition(ts);
  const span=time?Number(time.to)-Number(time.from):null,anchor=time?(Number(time.from)+Number(time.to))/2:null;
  return{reason,time,logical,barSpacing:opts.barSpacing,rightOffset:opts.rightOffset,scrollPosition:scroll,timeSpan:span,anchorTime:anchor,takenAt:performance.now()};
}
function dataset(){Object.assign(document.documentElement.dataset,{renkoGoldManualViewportLock:locked?'true':'false',renkoGoldManualViewportReason:String(stats.lastReason||''),renkoGoldManualViewportRestores:String(stats.restores),renkoGoldManualViewportSeq:String(seq),renkoGoldHistoryMutationDepth:String(historyDepth),renkoGoldHistoryMutationSuppress:String(suppressRangeChanges)});if(range)document.documentElement.dataset.renkoGoldManualViewportRange=`${range.from.toFixed(4)}:${range.to.toFixed(4)}`}
function store(r,reason='range'){if(!locked||suppressRangeChanges>0||!finite(r)){if(suppressRangeChanges>0)stats.suppressedRangeChanges++;return false}range=clone(r);stats.rangeChanges++;stats.lastReason=reason;stats.lastRange=clone(range);followingOff();dataset();return true}
function lock(reason='user'){locked=true;seq++;stats.locks++;stats.lastReason=reason;followingOff();try{window.RWARenkoGoldViewport?.lockViewport?.(`manual-${reason}`)}catch(_){ }const r=clone(TS()?.getVisibleLogicalRange?.());if(r)range=r;dataset();return seq}
function unlock(reason='latest'){locked=false;range=null;seq++;stats.unlocks++;stats.lastReason=reason;try{window.RWARenkoGoldViewport?.unlockViewport?.(`manual-${reason}`)}catch(_){ }dataset();return seq}
function restore(snapshot=range,token=seq){
  const r=clone(snapshot);if(!locked||token!==seq||!r||historyDepth>0)return false;
  const apply=()=>{if(!locked||token!==seq||historyDepth>0)return;const t=TS();if(!t)return;try{t.setVisibleLogicalRange(clone(r));range=clone(r);stats.restores++;stats.lastRange=clone(range);followingOff();dataset()}catch(_){ }};
  queueMicrotask(apply);requestAnimationFrame(()=>requestAnimationFrame(apply));setTimeout(apply,0);setTimeout(apply,80);setTimeout(apply,220);return true;
}
function targetTimeRange(snapshot,panOlder=false){const time=cloneTime(snapshot?.time);if(!time)return null;if(!panOlder)return time;const span=Math.max(60,Number(time.to)-Number(time.from));return{from:Number(time.from)-span*.75,to:Number(time.to)-span*.75}}
function viewportMetrics(snapshot,target=null){
  const ts=TS(),afterTime=cloneTime(ts?.getVisibleRange?.()),afterLogical=clone(ts?.getVisibleLogicalRange?.()),afterOpts=scaleOptions(ts),afterScroll=scrollPosition(ts),wanted=target||cloneTime(snapshot?.time);
  const beforeSpan=finiteNumber(snapshot?.timeSpan)?Number(snapshot.timeSpan):(snapshot?.time?Number(snapshot.time.to)-Number(snapshot.time.from):null),afterSpan=afterTime?Number(afterTime.to)-Number(afterTime.from):null,anchorBefore=wanted?(Number(wanted.from)+Number(wanted.to))/2:null,anchorAfter=afterTime?(Number(afterTime.from)+Number(afterTime.to))/2:null;
  return{beforeTime:cloneTime(snapshot?.time),targetTime:cloneTime(wanted),afterTime,beforeLogical:clone(snapshot?.logical),afterLogical,barSpacingBefore:snapshot?.barSpacing??null,barSpacingAfter:afterOpts.barSpacing,rightOffsetBefore:snapshot?.rightOffset??null,rightOffsetAfter:afterOpts.rightOffset,scrollPositionBefore:snapshot?.scrollPosition??null,scrollPositionAfter:afterScroll,timeSpanBefore:beforeSpan,timeSpanAfter:afterSpan,timeSpanDeltaPct:finiteNumber(beforeSpan)&&beforeSpan!==0&&finiteNumber(afterSpan)?Math.abs(afterSpan-beforeSpan)/Math.abs(beforeSpan)*100:null,fromDelta:wanted&&afterTime?Math.abs(Number(afterTime.from)-Number(wanted.from)):null,toDelta:wanted&&afterTime?Math.abs(Number(afterTime.to)-Number(wanted.to)):null,anchorTimeBefore:anchorBefore,anchorTimeAfter:anchorAfter,anchorDelta:finiteNumber(anchorBefore)&&finiteNumber(anchorAfter)?Math.abs(anchorAfter-anchorBefore):null,barSpacingDelta:finiteNumber(snapshot?.barSpacing)&&finiteNumber(afterOpts.barSpacing)?Math.abs(afterOpts.barSpacing-snapshot.barSpacing):null,rightOffsetDelta:finiteNumber(snapshot?.rightOffset)&&finiteNumber(afterOpts.rightOffset)?Math.abs(afterOpts.rightOffset-snapshot.rightOffset):null};
}
function hasDrift(m){return(finiteNumber(m?.barSpacingDelta)&&m.barSpacingDelta>1e-9)||(finiteNumber(m?.rightOffsetDelta)&&m.rightOffsetDelta>1e-9)||(finiteNumber(m?.timeSpanDeltaPct)&&m.timeSpanDeltaPct>0.01)||(finiteNumber(m?.fromDelta)&&m.fromDelta>1)||(finiteNumber(m?.toDelta)&&m.toDelta>1)||(finiteNumber(m?.anchorDelta)&&m.anchorDelta>1)}
function applyHistorySnapshot(snapshot,{panOlder=false}={}){
  const ts=TS(),target=targetTimeRange(snapshot,panOlder);if(!ts)return false;
  try{
    const options={};if(finiteNumber(snapshot?.barSpacing))options.barSpacing=Number(snapshot.barSpacing);if(finiteNumber(snapshot?.rightOffset))options.rightOffset=Number(snapshot.rightOffset);if(Object.keys(options).length)ts.applyOptions?.(options);
    if(target)ts.setVisibleRange(target);
    const now=scaleOptions(ts),fix={};if(finiteNumber(snapshot?.barSpacing)&&Math.abs(Number(now.barSpacing)-Number(snapshot.barSpacing))>1e-9)fix.barSpacing=Number(snapshot.barSpacing);if(finiteNumber(snapshot?.rightOffset)&&Math.abs(Number(now.rightOffset)-Number(snapshot.rightOffset))>1e-9)fix.rightOffset=Number(snapshot.rightOffset);if(Object.keys(fix).length)ts.applyOptions?.(fix);
    followingOff();stats.historyRestores++;return true;
  }catch(_){return false}
}
function beginHistoryMutation(reason='history-prepend'){
  if(!locked)lock(reason);else followingOff();seq++;historyDepth++;suppressRangeChanges++;stats.historyMutations++;stats.lastReason=reason;
  const token={id:++historySeq,manualSeq:seq,reason,snapshot:viewportSnapshot(reason),startedAt:performance.now(),closed:false};dataset();return token;
}
async function endHistoryMutation(token,{panOlder=false}={}){
  if(!token||token.closed)return stats.lastHistory;token.closed=true;
  const snapshot=token.snapshot||viewportSnapshot(token.reason),target=targetTimeRange(snapshot,panOlder),settle=[0,16,32,64,96,128,180,240,320];
  let metrics=null,lastWait=0;
  for(const at of settle){const wait=Math.max(0,at-lastWait);if(wait)await delay(wait);applyHistorySnapshot(snapshot,{panOlder});await nextFrame();metrics=viewportMetrics(snapshot,target);stats.historySettlePasses++;if(hasDrift(metrics))stats.historyCorrections++;followingOff();lastWait=at}
  // One final double-frame proof while mutation ownership is still exclusive.
  await nextFrame();applyHistorySnapshot(snapshot,{panOlder});await nextFrame();metrics=viewportMetrics(snapshot,target);
  historyDepth=Math.max(0,historyDepth-1);suppressRangeChanges=Math.max(0,suppressRangeChanges-1);
  const current=clone(TS()?.getVisibleLogicalRange?.());if(locked&&current){range=current;stats.lastRange=clone(current)}followingOff();
  stats.lastHistory={id:token.id,reason:token.reason,panOlder:!!panOlder,durationMs:performance.now()-token.startedAt,settlePasses:settle.length+1,...metrics};stats.lastReason=`${token.reason}-settled`;dataset();return stats.lastHistory;
}
function bindRange(){const t=TS();if(rangeBound||!t?.subscribeVisibleLogicalRangeChange)return false;rangeBound=true;t.subscribeVisibleLogicalRangeChange(r=>{if(!locked||!finite(r))return;if(suppressRangeChanges>0){stats.suppressedRangeChanges++;followingOff();return}followingOff();store(r,'visible-range')});document.documentElement.dataset.renkoGoldManualViewportRangeObserver='true';return true}
function patchRebuild(){const t=T();if(rebuildWrapped||!t?.rebuild)return false;const prior=t.rebuild.bind(t);t.rebuild=(opts={})=>{if(!locked)return prior(opts);followingOff();stats.rebuilds++;if(historyDepth>0)return prior({...opts,fit:false});const token=seq,snapshot=clone(TS()?.getVisibleLogicalRange?.())||clone(range),out=prior({...opts,fit:false});followingOff();if(snapshot)restore(snapshot,token);return out};rebuildWrapped=true;document.documentElement.dataset.renkoGoldManualViewportRebuildGuard='true';return true}
function ready(){bindRange();patchRebuild();if(locked)followingOff()}
function commandEnd(reason){requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!locked||suppressRangeChanges>0)return;followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,reason)}));setTimeout(()=>{if(locked&&suppressRangeChanges===0){followingOff();const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,reason)}},120)}
const chartTarget=e=>e.target?.closest?.('#chartWrap,#chartHost');
document.addEventListener('wheel',e=>{if(chartTarget(e)){stats.wheelEvents++;lock('wheel');commandEnd('wheel-end')}},{capture:true,passive:true});
document.addEventListener('pointerdown',e=>{if(chartTarget(e))lock('pointerdown')},{capture:true,passive:true});
document.addEventListener('touchstart',e=>{if(chartTarget(e))lock('touchstart')},{capture:true,passive:true});
document.addEventListener('pointerup',e=>{if(chartTarget(e)&&locked)commandEnd('pointerup')},{capture:true,passive:true});
document.addEventListener('touchend',e=>{if(chartTarget(e)&&locked)commandEnd('touchend')},{capture:true,passive:true});
document.addEventListener('click',e=>{const id=e.target?.closest?.('button')?.id||'';if(id==='tvLive'||id==='tvReset'){unlock(id);return}if(id==='tvGoldOrigin'){unlock('origin-command');return}const zoomOut=id==='tvZoomOut'||id==='tvGoldMaxZoom',zoomIn=id==='tvZoomIn',pan=['tvPanOlder','tvPanNewer','tvGoldOlder','tvGoldNewer'].includes(id);if(!(zoomOut||zoomIn||pan))return;lock(id);if(zoomOut)stats.zoomOutCommands++;if(zoomIn)stats.zoomInCommands++;if(pan)stats.panCommands++;commandEnd(id+'-end')},true);
window.addEventListener('renko:gold-origin',()=>setTimeout(()=>{lock('origin-ready');const r=clone(TS()?.getVisibleLogicalRange?.());if(r)store(r,'origin-range')},80));
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:gold-total','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>{ready();if(locked)followingOff()});
poll=setInterval(()=>{ready();if(rangeBound&&rebuildWrapped){clearInterval(poll);poll=0}},100);setTimeout(()=>{if(poll)clearInterval(poll)},15000);
window.RWARenkoGoldManualViewport={version:'4.1.0-history-settle-owner',rule:'single timestamp viewport owner remains exclusive through delayed chart settle; stale logical restores suppressed until stable',stats,get locked(){return locked},get range(){return clone(range)},get sequence(){return seq},get inHistoryMutation(){return historyDepth>0},get suppressingRangeChanges(){return suppressRangeChanges>0},lock,unlock,store,restore,ready,viewportSnapshot,beginHistoryMutation,endHistoryMutation};
})();