(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldWheelPanLock)return;
const root=document.documentElement;
const stats={applies:0,wheels:0,syntheticPans:0,prependRequests:0,prependSuccesses:0,corrections:0,lockStarts:0,lockClears:0,maxBarSpacingDelta:0,last:null};
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const chart=()=>window.__RWARenkoChart||null;
const ts=()=>chart()?.timeScale?.()||null;
const spacing=t=>{try{const v=t?.options?.()?.barSpacing;return finite(v)?Number(v):null}catch(_){return null}};
const logical=t=>{try{const r=t?.getVisibleLogicalRange?.();return r&&finite(r.from)&&finite(r.to)?{from:Number(r.from),to:Number(r.to)}:null}catch(_){return null}};
function publish(){Object.assign(root.dataset,{renkoGoldWheelPanOnly:'true',renkoGoldWheelPanApplies:String(stats.applies),renkoGoldWheelPanEvents:String(stats.wheels),renkoGoldWheelSyntheticPans:String(stats.syntheticPans),renkoGoldWheelPrependRequests:String(stats.prependRequests),renkoGoldWheelPrependSuccesses:String(stats.prependSuccesses),renkoGoldWheelScaleCorrections:String(stats.corrections),renkoGoldWheelSizeLock:finite(sizeLockSpacing)?'true':'false',renkoGoldWheelSizeLockSpacing:finite(sizeLockSpacing)?String(sizeLockSpacing):'',renkoGoldWheelMaxSpacingDelta:String(stats.maxBarSpacingDelta)})}
function enforce(){const c=chart();if(!c?.applyOptions)return false;try{c.applyOptions({handleScale:{mouseWheel:false},handleScroll:{mouseWheel:true}});stats.applies++;publish();return true}catch(e){root.dataset.renkoGoldWheelPanOnly='failed';console.warn('[RENKO GOLD wheel pan lock]',e);return false}}
let sizeLockToken=0,sizeLockUntil=0,sizeLockSpacing=null;
function clearSizeLock(reason='explicit'){sizeLockToken++;sizeLockUntil=0;sizeLockSpacing=null;stats.lockClears++;stats.last={...(stats.last||{}),clearReason:String(reason),clearedAt:performance.now()};publish()}
function holdSize(expected,ms=2600){if(!finite(expected))return;const first=!finite(sizeLockSpacing);if(first){sizeLockSpacing=Number(expected);stats.lockStarts++}sizeLockUntil=Math.max(sizeLockUntil,performance.now()+ms);const token=++sizeLockToken;const run=()=>{if(token!==sizeLockToken||!finite(sizeLockSpacing))return;const t=ts();if(!t){if(performance.now()<sizeLockUntil)requestAnimationFrame(run);return}const now=spacing(t),d=finite(now)?Math.abs(now-sizeLockSpacing):Infinity;stats.maxBarSpacingDelta=Math.max(stats.maxBarSpacingDelta,Number.isFinite(d)?d:0);if(!finite(now)||d>1e-9){try{t.applyOptions?.({barSpacing:sizeLockSpacing});stats.corrections++}catch(_){ }}publish();const H=window.RWARenkoGoldTotalHistory;if(performance.now()<sizeLockUntil||H?.busy){if(H?.busy)sizeLockUntil=Math.max(sizeLockUntil,performance.now()+900);requestAnimationFrame(run)}else{stats.last={...(stats.last||{}),barSpacingAfter:spacing(t),sizeLockSettledAt:performance.now()};clearSizeLock('gesture-settled')}};requestAnimationFrame(run)}
function horizontalDelta(e){const x=Number(e.deltaX)||0,y=Number(e.deltaY)||0;if(Math.abs(x)>.01)return x;if(Math.abs(y)>.01)return-y;return 0}
function dispatchHorizontal(e,dx){const target=e.target;if(!target?.dispatchEvent||!finite(dx)||dx===0)return false;const ev=new WheelEvent('wheel',{bubbles:true,cancelable:true,composed:true,deltaX:Number(dx),deltaY:0,deltaZ:0,deltaMode:Number(e.deltaMode)||0,clientX:Number(e.clientX)||0,clientY:Number(e.clientY)||0,screenX:Number(e.screenX)||0,screenY:Number(e.screenY)||0,ctrlKey:false,shiftKey:false,altKey:false,metaKey:false});target.dispatchEvent(ev);stats.syntheticPans++;return true}
let requestedOldest=0;
async function maybePrependOlder(dx){
  if(!(Number(dx)<0))return false;
  const H=window.RWARenkoGoldTotalHistory,T=window.RWARenkoTV,t=ts(),r=logical(t),edge=finite(H?.autoEdgeBars)?Number(H.autoEdgeBars):6;
  if(!H?.prependOlder||H.busy||T?.state?.symbol!=='XAUUSD'||!r||Number(r.from)>edge)return false;
  const oldest=Math.floor(Number(T.state?.closedBars?.[0]?.openTime||0)/1000);if(!oldest||oldest===requestedOldest)return false;
  requestedOldest=oldest;stats.prependRequests++;publish();
  try{const ok=await H.prependOlder({panOlder:false});if(ok)stats.prependSuccesses++;else requestedOldest=0;publish();return !!ok}catch(e){requestedOldest=0;publish();console.warn('[RENKO GOLD wheel prepend]',e);return false}
}
function onWheel(e){if(!e.isTrusted)return;if(!e.target?.closest?.('#chartWrap,#chartHost'))return;enforce();const t=ts(),beforeSpacing=finite(sizeLockSpacing)?Number(sizeLockSpacing):spacing(t),dx=horizontalDelta(e);stats.wheels++;if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();holdSize(beforeSpacing);dispatchHorizontal(e,dx);if(window.RWARenkoTV?.state)window.RWARenkoTV.state.following=false;requestAnimationFrame(()=>{const afterSpacing=spacing(t),d=finite(beforeSpacing)&&finite(afterSpacing)?Math.abs(afterSpacing-beforeSpacing):0;stats.maxBarSpacingDelta=Math.max(stats.maxBarSpacingDelta,d);stats.last={inputDeltaX:Number(e.deltaX)||0,inputDeltaY:Number(e.deltaY)||0,sanitizedDeltaX:dx,barSpacingBefore:beforeSpacing,barSpacingAfter:afterSpacing,spacingDelta:d,logicalAfter:logical(t)};publish();void maybePrependOlder(dx)});publish()}
document.addEventListener('wheel',onWheel,{capture:true,passive:false});
document.addEventListener('click',e=>{if(!e.isTrusted)return;const id=e.target?.closest?.('button')?.id||'';if(['tvLive','tvReset','tvZoomIn','tvZoomOut','tvGoldMaxZoom','tvGoldOrigin'].includes(id)||e.target?.closest?.('[data-apply-method]'))clearSizeLock(id||'method')},true);
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:gold-total','renko:gold-origin','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>requestAnimationFrame(enforce));
let poll=setInterval(()=>{if(enforce()){clearInterval(poll);poll=0}},50);setTimeout(()=>{if(poll){clearInterval(poll);poll=0}},10000);
enforce();
window.RWARenkoGoldWheelPanLock={version:'1.3.0-full-prepend-size-lock',implementation:'1.5.0-trusted-wheel-edge-prepend',legacyRemoved:'scrollToPosition',rule:'Trusted mixed trackpad wheel is intercepted before Lightweight Charts and re-dispatched at the original chart target as horizontal-only deltaY=0; null/undefined are never accepted as numeric spacing; native mouse-wheel scale remains disabled; the actual pre-gesture barSpacing is held through prepend settle; and only a trusted older-directed wheel at the real left edge may request total-history prepend',stats,enforce,horizontalDelta,dispatchHorizontal,maybePrependOlder,holdSize,clearSizeLock,get sizeLockSpacing(){return sizeLockSpacing}};
})();
