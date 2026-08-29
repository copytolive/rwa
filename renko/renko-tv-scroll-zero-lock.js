/* RENKO scroll-zero lock.
 * Wheel/trackpad chart navigation must remain render-only: reaching the left
 * edge must not silently fetch another history page and re-anchor the Renko
 * calculation during the gesture. Older data remains available explicitly via
 * the existing Older History arrow, where a user action may request one page.
 */
(()=>{
'use strict';
if(window.RWARenkoScrollZeroLock)return;
const L=window.LightweightCharts;if(!L?.createChart)return;
const create=L.createChart.bind(L);
const stats={rangeCallbacks:0,leftEdgeClamps:0,explicitOlderRequests:0};
function wrapTs(ts){return new Proxy(ts,{get(t,p,r){
  if(p==='subscribeVisibleLogicalRangeChange')return cb=>t.subscribeVisibleLogicalRangeChange(range=>{
    stats.rangeCallbacks++;if(!range)return cb(range);
    const from=Number(range.from);if(Number.isFinite(from)&&from<8){stats.leftEdgeClamps++;document.documentElement.dataset.renkoScrollEdge='true';return cb({...range,from:8})}
    document.documentElement.dataset.renkoScrollEdge='false';return cb(range)
  });
  const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v
}})}
function wrapChart(chart){let ts=null;return new Proxy(chart,{get(t,p,r){if(p==='timeScale')return()=>ts||(ts=wrapTs(t.timeScale()));const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v}})}
try{window.LightweightCharts={...L,createChart:(...a)=>wrapChart(create(...a))};document.documentElement.dataset.renkoScrollZeroLock='true'}catch(e){console.warn('[RENKO scroll-zero lock]',e);document.documentElement.dataset.renkoScrollZeroLock='failed'}
document.addEventListener('click',e=>{if(!e.target?.closest?.('#tvPanOlder'))return;const T=window.RWARenkoTV;if(!T||T.state?.status!=='live'||Number(T.state?.historyPages)>=5)return;stats.explicitOlderRequests++;queueMicrotask(()=>{try{void T.loadOlderPage?.()}catch(err){console.warn('[RENKO explicit older history]',err)}})},true);
window.RWARenkoScrollZeroLock={version:'1.0.0',rule:'wheel-pan-render-only-no-auto-history-fetch-reanchor-explicit-older-button-load',stats};
})();
