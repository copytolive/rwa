(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldWheelPanLock)return;
const root=document.documentElement,TRUSTED_PREPEND_EDGE_BARS=24;
const stats={applies:0,wheels:0,syntheticPans:0,prependRequests:0,prependSuccesses:0,prePanPrepends:0,postPrependScaleWrites:0,corrections:0,lockStarts:0,lockClears:0,maxBarSpacingDelta:0,last:null};
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const chart=()=>window.__RWARenkoChart||null;
const ts=()=>chart()?.timeScale?.()||null;
const spacing=t=>{try{const v=t?.options?.()?.barSpacing;return finite(v)?Number(v):null}catch(_){return null}};
const logical=t=>{try{const r=t?.getVisibleLogicalRange?.();return r&&finite(r.from)&&finite(r.to)?{from:Number(r.from),to:Number(r.to)}:null}catch(_){return null}};
function publish(){Object.assign(root.dataset,{renkoGoldWheelPanOnly:'true',renkoGoldWheelPanApplies:String(stats.applies),renkoGoldWheelPanEvents:String(stats.wheels),renkoGoldWheelSyntheticPans:String(stats.syntheticPans),renkoGoldWheelPrependRequests:String(stats.prependRequests),renkoGoldWheelPrependSuccesses:String(stats.prependSuccesses),renkoGoldWheelPrePanPrepends:String(stats.prePanPrepends),renkoGoldWheelTrustedPrependEdge:String(TRUSTED_PREPEND_EDGE_BARS),renkoGoldWheelPostPrependScaleWrites:String(stats.postPrependScaleWrites),renkoGoldWheelScaleCorrections:String(stats.corrections),renkoGoldWheelSizeLock:finite(sizeLockSpacing)?'true':'false',renkoGoldWheelSizeLockSpacing:finite(sizeLockSpacing)?String(sizeLockSpacing):'',renkoGoldWheelMaxSpacingDelta:String(stats.maxBarSpacingDelta)})}
function enforce(){const c=chart();if(!c?.applyOptions)return false;try{c.applyOptions({handleScale:{mouseWheel:false},handleScroll:{mouseWheel:true}});stats.applies++;publish();return true}catch(e){root.dataset.renkoGoldWheelPanOnly='failed';console.warn('[RENKO GOLD wheel pan lock]',e);return false}}
let sizeLockToken=0,sizeLockUntil=0,sizeLockSpacing=null;
function clearSizeLock(reason='explicit'){sizeLockToken++;sizeLockUntil=0;sizeLockSpacing=null;stats.lockClears++;stats.last={...(stats.last||{}),clearReason:String(reason),clearedAt:performance.now()};publish()}
function holdSize(expected,ms=2600){if(!finite(expected))return;const first=!finite(sizeLockSpacing);if(first){sizeLockSpacing=Number(expected);stats.lockStarts++}sizeLockUntil=Math.max(sizeLockUntil,performance.now()+ms);const token=++sizeLockToken;const run=()=>{if(token!==sizeLockToken||!finite(sizeLockSpacing))return;const t=ts();if(!t){if(performance.now()<sizeLockUntil)requestAnimationFrame(run);return}const now=spacing(t),d=finite(now)?Math.abs(now-sizeLockSpacing):Infinity;stats.maxBarSpacingDelta=Math.max(stats.maxBarSpacingDelta,Number.isFinite(d)?d:0);if(!finite(now)||d>1e-9){try{t.applyOptions?.({barSpacing:sizeLockSpacing});stats.corrections++}catch(_){ }}publish();const H=window.RWARenkoGoldTotalHistory;if(performance.now()<sizeLockUntil||H?.busy){if(H?.busy)sizeLockUntil=Math.max(sizeLockUntil,performance.now()+900);requestAnimationFrame(run)}else{stats.last={...(stats.last||{}),barSpacingAfter:spacing(t),sizeLockSettledAt:performance.now()};clearSizeLock('gesture-settled')}};requestAnimationFrame(run)}
function horizontalDelta(e){const x=Number(e.deltaX)||0,y=Number(e.deltaY)||0;if(Math.abs(x)>.01)return x;if(Math.abs(y)>.01)return-y;return 0}
function dispatchHorizontal(e,dx){const target=e.target;if(!target?.dispatchEvent||!finite(dx)||dx===0)return false;const safeDx=Math.max(-240,Math.min(240,Number(dx)));const ev=new WheelEvent('wheel',{bubbles:true,cancelable:true,composed:true,deltaX:safeDx,deltaY:0,deltaZ:0,deltaMode:Number(e.deltaMode)||0,clientX:Number(e.clientX)||0,clientY:Number(e.clientY)||0,screenX:Number(e.screenX)||0,screenY:Number(e.screenY)||0,ctrlKey:false,shiftKey:false,altKey:false,metaKey:false});target.dispatchEvent(ev);stats.syntheticPans++;return true}
let requestedOldest=0;
function forceSpacing(expected){if(!finite(expected))return false;const t=ts();if(!t?.applyOptions)return false;try{const now=spacing(t),d=finite(now)?Math.abs(now-Number(expected)):Infinity;stats.maxBarSpacingDelta=Math.max(stats.maxBarSpacingDelta,Number.isFinite(d)?d:0);if(!finite(now)||d>1e-9){t.applyOptions({barSpacing:Number(expected)});stats.postPrependScaleWrites++}return true}catch(_){return false}}
function prependContext(dx,rangeHint=null){
  const H=window.RWARenkoGoldTotalHistory,T=window.RWARenkoTV,r=rangeHint||logical(ts()),oldest=Math.floor(Number(T?.state?.closedBars?.[0]?.openTime||0)/1000);
  const eligible=Number(dx)<0&&!!H?.prependOlder&&!H.busy&&T?.state?.symbol==='XAUUSD'&&!!r&&Number(r.from)<=TRUSTED_PREPEND_EDGE_BARS&&!!oldest&&oldest!==requestedOldest;
  return{eligible,H,T,r,oldest};
}
function shouldPrependOlder(dx,rangeHint=null){return prependContext(dx,rangeHint).eligible}
async function maybePrependOlder(dx,expectedSpacing,rangeHint=null){
  const ctx=prependContext(dx,rangeHint);if(!ctx.eligible)return false;const{H,oldest}=ctx;
  requestedOldest=oldest;stats.prependRequests++;if(finite(expectedSpacing))holdSize(Number(expectedSpacing),5200);publish();
  try{
    const ok=await H.prependOlder({panOlder:false});
    if(ok){
      stats.prependSuccesses++;
      if(finite(expectedSpacing)){
        const exact=Number(expectedSpacing);forceSpacing(exact);holdSize(exact,2600);
        for(const ms of [0,16,60,120,240,420,700,1000,1400,1900])setTimeout(()=>forceSpacing(exact),ms);
      }
    }else requestedOldest=0;
    publish();return!!ok;
  }catch(e){requestedOldest=0;publish();console.warn('[RENKO GOLD wheel prepend]',e);return false}
}
function onWheel(e){
  if(!e.isTrusted||!e.target?.closest?.('#chartWrap,#chartHost'))return;
  enforce();
  const t=ts(),beforeSpacing=finite(sizeLockSpacing)?Number(sizeLockSpacing):spacing(t),beforeLogical=logical(t),dx=horizontalDelta(e);
  stats.wheels++;if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();holdSize(beforeSpacing);
  if(window.RWARenkoTV?.state)window.RWARenkoTV.state.following=false;
  // Critical ordering: when the viewport is already at the trusted older edge, start the bounded history prepend
  // from the untouched viewport and consume this wheel impulse. Panning first can expose blank logical space and
  // make Lightweight Charts recompute barSpacing before the history/viewport owners have armed their locks.
  if(shouldPrependOlder(dx,beforeLogical)){
    stats.prePanPrepends++;
    stats.last={inputDeltaX:Number(e.deltaX)||0,inputDeltaY:Number(e.deltaY)||0,sanitizedDeltaX:dx,barSpacingBefore:beforeSpacing,barSpacingAfter:beforeSpacing,spacingDelta:0,logicalAfter:beforeLogical,prePanPrepend:true};
    publish();void maybePrependOlder(dx,beforeSpacing,beforeLogical);return;
  }
  dispatchHorizontal(e,dx);
  requestAnimationFrame(()=>{const afterSpacing=spacing(t),afterLogical=logical(t),d=finite(beforeSpacing)&&finite(afterSpacing)?Math.abs(afterSpacing-beforeSpacing):0;stats.maxBarSpacingDelta=Math.max(stats.maxBarSpacingDelta,d);stats.last={inputDeltaX:Number(e.deltaX)||0,inputDeltaY:Number(e.deltaY)||0,sanitizedDeltaX:dx,barSpacingBefore:beforeSpacing,barSpacingAfter:afterSpacing,spacingDelta:d,logicalAfter:afterLogical,prePanPrepend:false};publish();void maybePrependOlder(dx,beforeSpacing,afterLogical)});publish()
}
document.addEventListener('wheel',onWheel,{capture:true,passive:false});
document.addEventListener('click',e=>{if(!e.isTrusted)return;const id=e.target?.closest?.('button')?.id||'';if(['tvLive','tvReset','tvZoomIn','tvZoomOut','tvGoldMaxZoom','tvGoldOrigin'].includes(id)||e.target?.closest?.('[data-apply-method]'))clearSizeLock(id||'method')},true);
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:gold-total','renko:gold-origin','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>requestAnimationFrame(enforce));
let poll=setInterval(()=>{if(enforce()){clearInterval(poll);poll=0}},50);setTimeout(()=>{if(poll){clearInterval(poll);poll=0}},10000);
enforce();
window.RWARenkoGoldWheelPanLock={version:'1.3.0-full-prepend-size-lock',implementation:'1.8.0-prepend-before-pan',legacyRemoved:'scrollToPosition',rule:'Trusted horizontal/mixed trackpad wheel is pan-only. At the trusted older edge, history prepend is armed from the untouched viewport before any synthetic pan, preventing blank-edge rescale. Elsewhere the gesture is re-dispatched as bounded horizontal-only deltaY=0. Native wheel scale stays disabled for pan input; explicit vertical/pinch zoom is owned by the earlier explicit-zoom layer.',stats,enforce,horizontalDelta,dispatchHorizontal,shouldPrependOlder,maybePrependOlder,forceSpacing,holdSize,clearSizeLock,trustedPrependEdgeBars:TRUSTED_PREPEND_EDGE_BARS,get sizeLockSpacing(){return sizeLockSpacing}};
})();
