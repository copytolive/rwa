(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldExplicitZoom)return;
const root=document.documentElement,MIN_WIDTH=12,MAX_WIDTH=2500,ZOOM_OUT_MIN_SPACING=.05,HISTORY_EDGE_BARS=32,MAX_HISTORY_BURST=4;
const stats={wheelZooms:0,pinchZooms:0,verticalZooms:0,buttonIntents:0,applies:0,manualUnlocks:0,deepZoomOuts:0,historyRequests:0,historySuccesses:0,historyPumpRuns:0,lastTargetWidth:null,last:null};
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const chart=()=>window.__RWARenkoChart||null;
const ts=()=>chart()?.timeScale?.()||null;
const logical=t=>{try{const r=t?.getVisibleLogicalRange?.();return r&&finite(r.from)&&finite(r.to)?{from:Number(r.from),to:Number(r.to)}:null}catch(_){return null}};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function totalBricks(){const T=window.RWARenkoTV;return Math.max(0,Number(T?.state?.confirmedData?.length||0)+Number(T?.state?.projectionData?.length||0))}
function publish(){Object.assign(root.dataset,{renkoGoldExplicitZoom:'true',renkoGoldExplicitZoomVersion:'1.0.0-explicit-zoom',renkoGoldExplicitZoomImplementation:'1.2.0-deep-zoom-history-demand',renkoGoldExplicitZoomWheel:String(stats.wheelZooms),renkoGoldExplicitZoomPinch:String(stats.pinchZooms),renkoGoldExplicitZoomVertical:String(stats.verticalZooms),renkoGoldExplicitZoomButtons:String(stats.buttonIntents),renkoGoldExplicitZoomApplies:String(stats.applies),renkoGoldExplicitZoomHistoryRequests:String(stats.historyRequests),renkoGoldExplicitZoomHistorySuccesses:String(stats.historySuccesses),renkoGoldExplicitZoomMaxWidth:String(MAX_WIDTH),renkoGoldInteractionOwner:'zoom'})}
function releaseViewport(reason='zoom'){
  try{window.RWARenkoGoldViewportAuthority?.clear?.(reason)}catch(_){ }
  try{window.RWARenkoGoldWheelPanLock?.clearSizeLock?.(reason)}catch(_){ }
  try{if(window.RWARenkoGoldManualViewport?.locked){window.RWARenkoGoldManualViewport.unlock?.(`explicit-${reason}`);stats.manualUnlocks++}}catch(_){ }
  if(window.RWARenkoTV?.state)window.RWARenkoTV.state.following=false;
}
let desiredHistoryWidth=0,historyPump=false;
function historyNeeded(targetWidth){const r=logical(ts()),total=totalBricks();if(!r)return false;return Number(r.from)<=HISTORY_EDGE_BARS||total+8<Math.min(MAX_WIDTH,Number(targetWidth)||0)}
async function pumpHistory(){
  if(historyPump)return;historyPump=true;stats.historyPumpRuns++;publish();
  try{
    let cycles=0;
    while(cycles<MAX_HISTORY_BURST&&desiredHistoryWidth>0){
      const H=window.RWARenkoGoldTotalHistory,T=window.RWARenkoTV;if(!H?.prependOlder||T?.state?.symbol!=='XAUUSD')break;
      let waits=0;while(H.busy&&waits++<160)await delay(50);if(H.busy||!historyNeeded(desiredHistoryWidth))break;
      stats.historyRequests++;publish();const ok=await H.prependOlder({panOlder:false});if(!ok)break;stats.historySuccesses++;cycles++;publish();
    }
  }catch(e){console.warn('[RENKO GOLD zoom history]',e)}finally{desiredHistoryWidth=0;historyPump=false;publish()}
}
function requestOlderHistory(targetWidth){desiredHistoryWidth=Math.max(desiredHistoryWidth,Number(targetWidth)||0);if(!historyPump)setTimeout(()=>void pumpHistory(),0)}
function zoomBy(mult,reason='zoom'){
  const t=ts(),r=logical(t);if(!t||!r||!(Number(mult)>0))return false;
  const beforeWidth=r.to-r.from;if(!(beforeWidth>0))return false;
  const mid=(r.from+r.to)/2,nextWidth=Math.max(MIN_WIDTH,Math.min(MAX_WIDTH,beforeWidth*Number(mult)));
  if(Math.abs(nextWidth-beforeWidth)<1e-9)return false;
  releaseViewport(reason);
  try{
    if(nextWidth>beforeWidth){try{t.applyOptions?.({minBarSpacing:ZOOM_OUT_MIN_SPACING})}catch(_){ }stats.deepZoomOuts++}
    t.setVisibleLogicalRange({from:mid-nextWidth/2,to:mid+nextWidth/2});
    stats.applies++;stats.lastTargetWidth=nextWidth;
    stats.last={reason,mult:Number(mult),beforeWidth,afterWidth:nextWidth,at:performance.now()};
    if(nextWidth>beforeWidth)requestOlderHistory(nextWidth);
    publish();return true;
  }catch(e){console.warn('[RENKO GOLD explicit zoom]',e);return false}
}
function isChartTarget(e){return !!e.target?.closest?.('#chartWrap,#chartHost')}
function isZoomWheel(e){
  if(!e.isTrusted||!isChartTarget(e))return false;
  const x=Number(e.deltaX)||0,y=Number(e.deltaY)||0;
  if(Math.abs(y)<=.01)return false;
  if(e.ctrlKey||e.metaKey)return true;
  return Math.abs(x)<=.01;
}
function onWheel(e){
  if(!isZoomWheel(e))return;
  const y=Number(e.deltaY)||0,clamped=Math.max(-240,Math.min(240,y));
  const mult=Math.exp(clamped*.0025);
  if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();
  stats.wheelZooms++;if(e.ctrlKey||e.metaKey)stats.pinchZooms++;else stats.verticalZooms++;
  zoomBy(mult,e.ctrlKey||e.metaKey?'pinch-wheel':'vertical-wheel');publish();
}
document.addEventListener('wheel',onWheel,{capture:true,passive:false});
document.addEventListener('click',e=>{
  if(!e.isTrusted)return;const id=e.target?.closest?.('button')?.id||'';if(id!=='tvZoomIn'&&id!=='tvZoomOut')return;
  if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();stats.buttonIntents++;
  zoomBy(id==='tvZoomOut'?1.6:.72,id);publish();
},true);
publish();
window.RWARenkoGoldExplicitZoom={version:'1.0.0-explicit-zoom',implementation:'1.2.0-deep-zoom-history-demand',rule:'Zoom is the sole logical-width owner. Intentional +, -, vertical-wheel, and Ctrl/Meta pinch can zoom from 12 to 2500 logical bricks. Zoom-out lowers only the minimum spacing constraint and demand-loads older canonical history when the requested viewport exceeds current coverage. Horizontal or mixed wheel remains pan-only in the downstream fixed-width controller.',stats,zoomBy,isZoomWheel,releaseViewport,requestOlderHistory,get maxWidth(){return MAX_WIDTH},get historyPumpActive(){return historyPump}};
})();