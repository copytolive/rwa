(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldExplicitZoom)return;
const root=document.documentElement;
const stats={wheelZooms:0,pinchZooms:0,verticalZooms:0,buttonIntents:0,applies:0,last:null};
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const chart=()=>window.__RWARenkoChart||null;
const ts=()=>chart()?.timeScale?.()||null;
const logical=t=>{try{const r=t?.getVisibleLogicalRange?.();return r&&finite(r.from)&&finite(r.to)?{from:Number(r.from),to:Number(r.to)}:null}catch(_){return null}};
function publish(){Object.assign(root.dataset,{renkoGoldExplicitZoom:'true',renkoGoldExplicitZoomVersion:'1.0.0-explicit-zoom',renkoGoldExplicitZoomWheel:String(stats.wheelZooms),renkoGoldExplicitZoomPinch:String(stats.pinchZooms),renkoGoldExplicitZoomVertical:String(stats.verticalZooms),renkoGoldExplicitZoomButtons:String(stats.buttonIntents),renkoGoldExplicitZoomApplies:String(stats.applies)})}
function releaseViewport(reason='zoom'){
  try{window.RWARenkoGoldViewportAuthority?.clear?.(reason)}catch(_){ }
  try{window.RWARenkoGoldWheelPanLock?.clearSizeLock?.(reason)}catch(_){ }
  if(window.RWARenkoTV?.state)window.RWARenkoTV.state.following=false;
}
function zoomBy(mult,reason='zoom'){
  const t=ts(),r=logical(t);if(!t||!r||!(Number(mult)>0))return false;
  const beforeWidth=r.to-r.from;if(!(beforeWidth>0))return false;
  const mid=(r.from+r.to)/2,nextWidth=Math.max(15,Math.min(220,beforeWidth*Number(mult)));
  if(Math.abs(nextWidth-beforeWidth)<1e-9)return false;
  releaseViewport(reason);
  try{
    t.setVisibleLogicalRange({from:mid-nextWidth/2,to:mid+nextWidth/2});
    stats.applies++;
    stats.last={reason,mult:Number(mult),beforeWidth,afterWidth:nextWidth,at:performance.now()};
    publish();
    return true;
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
  if(e.cancelable)e.preventDefault();
  e.stopImmediatePropagation();
  stats.wheelZooms++;
  if(e.ctrlKey||e.metaKey)stats.pinchZooms++;else stats.verticalZooms++;
  zoomBy(mult,e.ctrlKey||e.metaKey?'pinch-wheel':'vertical-wheel');
  publish();
}
document.addEventListener('wheel',onWheel,{capture:true,passive:false});
document.addEventListener('click',e=>{
  if(!e.isTrusted)return;
  const id=e.target?.closest?.('button')?.id||'';
  if(id!=='tvZoomIn'&&id!=='tvZoomOut')return;
  stats.buttonIntents++;
  releaseViewport(id);
  const before=logical(ts()),beforeWidth=before?before.to-before.from:null;
  requestAnimationFrame(()=>{const after=logical(ts()),afterWidth=after?after.to-after.from:null;stats.last={reason:id,beforeWidth,afterWidth,at:performance.now()};publish()});
  publish();
},true);
publish();
window.RWARenkoGoldExplicitZoom={version:'1.0.0-explicit-zoom',rule:'horizontal or mixed wheel remains pan-only in the downstream lock; vertical-only wheel and ctrl/meta pinch wheel are explicit bounded zoom; plus/minus buttons remain native app zoom and release history/size locks first',stats,zoomBy,isZoomWheel,releaseViewport};
})();
