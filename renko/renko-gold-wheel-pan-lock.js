(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldWheelPanLock)return;
const root=document.documentElement;
const stats={applies:0,wheels:0,manualPans:0,prependRequests:0,corrections:0,maxBarSpacingDelta:0,last:null};
const finite=v=>Number.isFinite(Number(v));
const chart=()=>window.__RWARenkoChart||null;
const ts=()=>chart()?.timeScale?.()||null;
const logical=t=>{try{const r=t?.getVisibleLogicalRange?.();return r&&finite(r.from)&&finite(r.to)?{from:Number(r.from),to:Number(r.to)}:null}catch(_){return null}};
const spacing=t=>{try{const v=t?.options?.()?.barSpacing;return finite(v)?Number(v):null}catch(_){return null}};
const scroll=t=>{try{const v=t?.scrollPosition?.();return finite(v)?Number(v):null}catch(_){return null}};
function publish(){Object.assign(root.dataset,{renkoGoldWheelPanOnly:'true',renkoGoldWheelPanApplies:String(stats.applies),renkoGoldWheelPanEvents:String(stats.wheels),renkoGoldWheelManualPans:String(stats.manualPans),renkoGoldWheelScaleCorrections:String(stats.corrections),renkoGoldWheelMaxSpacingDelta:String(stats.maxBarSpacingDelta)})}
function enforce(){const c=chart();if(!c?.applyOptions)return false;try{c.applyOptions({handleScale:{mouseWheel:false},handleScroll:{mouseWheel:false}});stats.applies++;publish();return true}catch(e){root.dataset.renkoGoldWheelPanOnly='failed';console.warn('[RENKO GOLD wheel pan lock]',e);return false}}
let requestedOldest=0;
function requestOlder(range){if(!range||Number(range.from)>=35)return;const H=window.RWARenkoGoldTotalHistory,T=window.RWARenkoTV;if(!H?.prependOlder||H.busy||T?.state?.symbol!=='XAUUSD')return;const oldest=Math.floor(Number(T.state?.closedBars?.[0]?.openTime||0)/1000);if(!oldest||oldest===requestedOldest)return;requestedOldest=oldest;stats.prependRequests++;setTimeout(()=>{Promise.resolve(H.prependOlder({panOlder:false})).then(ok=>{if(!ok)requestedOldest=0}).catch(()=>{requestedOldest=0})},0)}
let stabilizeToken=0,stabilizeUntil=0,stabilizeSpacing=null;
function stabilize(expected,ms=520){if(!finite(expected))return;stabilizeSpacing=Number(expected);stabilizeUntil=Math.max(stabilizeUntil,performance.now()+ms);const token=++stabilizeToken;const run=()=>{if(token!==stabilizeToken)return;const t=ts();if(!t)return;const now=spacing(t),d=finite(now)?Math.abs(now-stabilizeSpacing):0;stats.maxBarSpacingDelta=Math.max(stats.maxBarSpacingDelta,d);if(finite(now)&&d>1e-9){try{t.applyOptions?.({barSpacing:stabilizeSpacing});stats.corrections++}catch(_){ }}publish();if(performance.now()<stabilizeUntil)requestAnimationFrame(run);else{stats.last={...(stats.last||{}),barSpacingAfter:spacing(t),stabilizedAt:performance.now()}}};requestAnimationFrame(run)}
function panWheel(e,baselineSpacing){const t=ts();if(!t||typeof t.scrollToPosition!=='function')return false;const current=scroll(t);if(!finite(current))return false;let raw=Math.abs(Number(e.deltaX)||0)>.01?Number(e.deltaX):Number(e.deltaY)||0;if(!finite(raw)||raw===0)return false;if(Number(e.deltaMode)===1)raw*=16;else if(Number(e.deltaMode)===2)raw*=Math.max(240,Number(document.getElementById('chartHost')?.clientWidth)||0);const pxPerBar=Math.max(.25,finite(baselineSpacing)?Number(baselineSpacing):4);let bars=raw/pxPerBar;if(bars>80)bars=80;if(bars<-80)bars=-80;try{t.scrollToPosition(current+bars,false);if(window.RWARenkoTV?.state)window.RWARenkoTV.state.following=false;stats.manualPans++;requestAnimationFrame(()=>requestOlder(logical(t)));return true}catch(_){return false}}
function onWheel(e){if(!e.target?.closest?.('#chartWrap,#chartHost'))return;enforce();const t=ts(),beforeSpacing=spacing(t),beforeScroll=scroll(t);stats.wheels++;if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();panWheel(e,beforeSpacing);stabilize(beforeSpacing);requestAnimationFrame(()=>{const afterSpacing=spacing(t),d=finite(beforeSpacing)&&finite(afterSpacing)?Math.abs(afterSpacing-beforeSpacing):0;stats.maxBarSpacingDelta=Math.max(stats.maxBarSpacingDelta,d);stats.last={deltaX:Number(e.deltaX)||0,deltaY:Number(e.deltaY)||0,barSpacingBefore:beforeSpacing,barSpacingAfter:afterSpacing,scrollBefore:beforeScroll,scrollAfter:scroll(t),spacingDelta:d};publish()});publish()}
document.addEventListener('wheel',onWheel,{capture:true,passive:false});
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:gold-total','renko:gold-origin','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>requestAnimationFrame(enforce));
let poll=setInterval(()=>{if(enforce()){clearInterval(poll);poll=0}},50);setTimeout(()=>{if(poll){clearInterval(poll);poll=0}},10000);
enforce();
window.RWARenkoGoldWheelPanLock={version:'1.2.0-scroll-position-spacing-lock',rule:'GOLD owns chart wheel/trackpad at capture phase, blocks native wheel behavior, pans only through scrollToPosition, and holds barSpacing constant through delayed renderer settle',stats,enforce,panWheel,requestOlder,stabilize};
})();
