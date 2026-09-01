/* RENKO scroll-zero lock. Wheel/trackpad is render-only; history I/O is outside the synchronous gesture. */
(()=>{
'use strict';
if(window.RWARenkoScrollZeroLock)return;
const L=window.LightweightCharts;if(!L?.createChart)return;
const create=L.createChart.bind(L),stats={rangeCallbacks:0,leftEdgeClamps:0,explicitOlderRequests:0,subscriptions:0,goldExactRanges:0};
let subscriptionSeq=0;
function wrapTs(ts){return new Proxy(ts,{get(t,p,r){if(p==='subscribeVisibleLogicalRangeChange')return cb=>{subscriptionSeq++;stats.subscriptions=subscriptionSeq;return t.subscribeVisibleLogicalRangeChange(range=>{stats.rangeCallbacks++;if(!range)return cb(range);const from=Number(range.from),gold=window.RENKO_GOLD_ONLY===true;/* GOLD history needs the exact left-edge range so its canonical lazy-prepend observer can fire and every viewport owner records the user's real position. The legacy clamp remains only for non-GOLD pages. */if(gold){stats.goldExactRanges++;document.documentElement.dataset.renkoScrollEdge=Number.isFinite(from)&&from<8?'true':'false';return cb(range)}if(Number.isFinite(from)&&from<8){stats.leftEdgeClamps++;document.documentElement.dataset.renkoScrollEdge='true';return cb({...range,from:8})}document.documentElement.dataset.renkoScrollEdge='false';return cb(range)})};const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v}})}
function wrapChart(chart){let ts=null;return new Proxy(chart,{get(t,p,r){if(p==='timeScale')return()=>ts||(ts=wrapTs(t.timeScale()));const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v}})}
try{window.LightweightCharts={...L,createChart:(...a)=>wrapChart(create(...a))};document.documentElement.dataset.renkoScrollZeroLock='true'}catch(e){console.warn('[RENKO scroll-zero lock]',e);document.documentElement.dataset.renkoScrollZeroLock='failed'}
document.addEventListener('click',e=>{if(!e.target?.closest?.('#tvPanOlder'))return;const T=window.RWARenkoTV;if(!T||T.state?.status==='history-origin')return;stats.explicitOlderRequests++;queueMicrotask(()=>{try{void T.loadOlderPage?.()}catch(err){console.warn('[RENKO explicit older history]',err)}})},true);
window.RWARenkoScrollZeroLock={version:'1.3.0-gold-exact-range',rule:'gold-wheel-pan-render-only-exact-visible-range-to-all-subscribers-canonical-prepend-observer-owns-history-no-range-clamp-no-reanchor',stats};
})();