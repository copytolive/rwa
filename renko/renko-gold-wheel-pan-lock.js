(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldWheelPanLock)return;
const root=document.documentElement;
const stats={applies:0,wheels:0,corrections:0,maxBarSpacingDelta:0,maxLogicalWidthDelta:0,last:null};
const finite=v=>Number.isFinite(Number(v));
const chart=()=>window.__RWARenkoChart||null;
const ts=()=>chart()?.timeScale?.()||null;
const logical=t=>{try{const r=t?.getVisibleLogicalRange?.();return r&&finite(r.from)&&finite(r.to)?{from:Number(r.from),to:Number(r.to)}:null}catch(_){return null}};
const spacing=t=>{try{const v=t?.options?.()?.barSpacing;return finite(v)?Number(v):null}catch(_){return null}};
const width=r=>r&&finite(r.from)&&finite(r.to)?Number(r.to)-Number(r.from):null;
function publish(){Object.assign(root.dataset,{renkoGoldWheelPanOnly:'true',renkoGoldWheelPanApplies:String(stats.applies),renkoGoldWheelPanEvents:String(stats.wheels),renkoGoldWheelScaleCorrections:String(stats.corrections),renkoGoldWheelMaxSpacingDelta:String(stats.maxBarSpacingDelta),renkoGoldWheelMaxWidthDelta:String(stats.maxLogicalWidthDelta)})}
function enforce(){const c=chart();if(!c?.applyOptions)return false;try{c.applyOptions({handleScale:{mouseWheel:false},handleScroll:{mouseWheel:true}});stats.applies++;publish();return true}catch(e){root.dataset.renkoGoldWheelPanOnly='failed';console.warn('[RENKO GOLD wheel pan lock]',e);return false}}
let gesture=null,idle=0;
function correct(){const t=ts(),g=gesture;if(!t||!g)return;const nowRange=logical(t),nowSpacing=spacing(t),nowWidth=width(nowRange),spacingDelta=finite(nowSpacing)&&finite(g.barSpacing)?Math.abs(nowSpacing-g.barSpacing):0,widthDelta=finite(nowWidth)&&finite(g.logicalWidth)?Math.abs(nowWidth-g.logicalWidth):0;stats.maxBarSpacingDelta=Math.max(stats.maxBarSpacingDelta,spacingDelta);stats.maxLogicalWidthDelta=Math.max(stats.maxLogicalWidthDelta,widthDelta);if((spacingDelta>1e-9||widthDelta>1e-7)&&nowRange&&finite(g.logicalWidth)&&g.logicalWidth>0){const center=(Number(nowRange.from)+Number(nowRange.to))/2,desired={from:center-g.logicalWidth/2,to:center+g.logicalWidth/2};try{t.setVisibleLogicalRange(desired);const afterSpacing=spacing(t);if(finite(g.barSpacing)&&finite(afterSpacing)&&Math.abs(afterSpacing-g.barSpacing)>1e-9)t.applyOptions?.({barSpacing:g.barSpacing});stats.corrections++}catch(_){ }}stats.last={barSpacingBefore:g.barSpacing,barSpacingAfter:spacing(t),logicalWidthBefore:g.logicalWidth,logicalWidthAfter:width(logical(t)),spacingDelta,widthDelta};publish()}
function onWheel(e){if(!e.target?.closest?.('#chartWrap,#chartHost'))return;enforce();const t=ts();if(!t)return;const r=logical(t),b=spacing(t);if(!gesture)gesture={barSpacing:b,logicalWidth:width(r),startedAt:performance.now()};stats.wheels++;requestAnimationFrame(correct);clearTimeout(idle);idle=setTimeout(()=>{correct();gesture=null;idle=0},140);publish()}
document.addEventListener('wheel',onWheel,{capture:true,passive:true});
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:gold-total','renko:gold-origin','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>requestAnimationFrame(enforce));
let poll=setInterval(()=>{if(enforce()){clearInterval(poll);poll=0}},50);setTimeout(()=>{if(poll){clearInterval(poll);poll=0}},10000);
enforce();
window.RWARenkoGoldWheelPanLock={version:'1.0.0-pan-only-wheel',rule:'GOLD chart wheel/trackpad pans history but never changes horizontal zoom; explicit zoom controls remain available',stats,enforce,correct};
})();
