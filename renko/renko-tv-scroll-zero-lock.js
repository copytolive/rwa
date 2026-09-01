/* RENKO scroll-zero lock. Wheel/trackpad is render-only; history I/O is outside the synchronous gesture. */
(()=>{
'use strict';
if(window.RWARenkoScrollZeroLock)return;
const L=window.LightweightCharts;if(!L?.createChart)return;
const create=L.createChart.bind(L),stats={rangeCallbacks:0,leftEdgeClamps:0,explicitOlderRequests:0,subscriptions:0};
let subscriptionSeq=0;
function wrapTs(ts){return new Proxy(ts,{get(t,p,r){if(p==='subscribeVisibleLogicalRangeChange')return cb=>{const slot=++subscriptionSeq;stats.subscriptions=subscriptionSeq;return t.subscribeVisibleLogicalRangeChange(range=>{stats.rangeCallbacks++;if(!range)return cb(range);const from=Number(range.from);/* Only the app's first internal subscriber is edge-clamped so its legacy Binance auto-loader stays dormant. Every later subscriber (GOLD total-history + viewport locks) must receive the exact user range. */if(slot===1&&Number.isFinite(from)&&from<8){stats.leftEdgeClamps++;document.documentElement.dataset.renkoScrollEdge='true';return cb({...range,from:8})}document.documentElement.dataset.renkoScrollEdge=Number.isFinite(from)&&from<8?'true':'false';return cb(range)})};const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v}})}
function wrapChart(chart){let ts=null;return new Proxy(chart,{get(t,p,r){if(p==='timeScale')return()=>ts||(ts=wrapTs(t.timeScale()));const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v}})}
try{window.LightweightCharts={...L,createChart:(...a)=>wrapChart(create(...a))};document.documentElement.dataset.renkoScrollZeroLock='true'}catch(e){console.warn('[RENKO scroll-zero lock]',e);document.documentElement.dataset.renkoScrollZeroLock='failed'}
document.addEventListener('click',e=>{if(!e.target?.closest?.('#tvPanOlder'))return;const T=window.RWARenkoTV;if(!T||T.state?.status==='history-origin')return;stats.explicitOlderRequests++;queueMicrotask(()=>{try{void T.loadOlderPage?.()}catch(err){console.warn('[RENKO explicit older history]',err)}})},true);
window.RWARenkoScrollZeroLock={version:'1.2.0-true-range-subscribers',rule:'wheel-pan-render-only-no-auto-history-fetch-reanchor-explicit-io-outside-wheel-first-app-subscriber-clamped-only-all-viewport-subscribers-see-true-range',stats};
})();