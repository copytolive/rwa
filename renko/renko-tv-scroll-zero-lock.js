/* RENKO scroll-zero lock. Wheel/trackpad is render-only; history I/O is outside the synchronous gesture. */
(()=>{
'use strict';
if(window.RWARenkoScrollZeroLock)return;
const L=window.LightweightCharts;if(!L?.createChart)return;
const create=L.createChart.bind(L),stats={rangeCallbacks:0,leftEdgeClamps:0,explicitOlderRequests:0,subscriptions:0,goldExactRanges:0,stableTimeSets:0,stableTimeRows:0,stableTimeGroups:0};
let subscriptionSeq=0;

/* The base renderer makes duplicate brick source seconds unique by adding a
 * cumulative +1 second. That makes every later chart timestamp depend on how
 * much history exists before it, so a prepend changes the identity of bricks
 * already on screen. GOLD must use a prefix-independent key instead.
 *
 * Keep every brick inside its real source second and spread same-second bricks
 * fractionally within that second. The ordinal/count are local to that source
 * second, so adding older seconds cannot move any existing timestamp. */
function stableGoldTimes(rows){
  if(window.RENKO_GOLD_ONLY!==true||!Array.isArray(rows)||!rows.length||!rows.some(x=>Number(x?._sourceTime)>0))return rows;
  const counts=new Map();
  for(const x of rows){const ms=Number(x?._sourceTime);if(!(ms>0))continue;const sec=Math.floor(ms/1000);counts.set(sec,(counts.get(sec)||0)+1)}
  const seen=new Map();let groups=0;for(const n of counts.values())if(n>1)groups++;
  const out=rows.map(x=>{
    const ms=Number(x?._sourceTime);if(!(ms>0))return x;
    const sec=Math.floor(ms/1000),count=counts.get(sec)||1,idx=seen.get(sec)||0;seen.set(sec,idx+1);
    const time=count<=1?sec:sec+((idx+1)/(count+1));
    return Number(x.time)===time?x:{...x,time};
  });
  stats.stableTimeSets++;stats.stableTimeRows+=out.length;stats.stableTimeGroups+=groups;
  document.documentElement.dataset.renkoGoldStableTime='true';
  document.documentElement.dataset.renkoGoldStableTimeRows=String(stats.stableTimeRows);
  return out;
}
function wrapSeries(series){
  if(!series)return series;
  return new Proxy(series,{get(t,p,r){
    if(p==='setData')return rows=>t.setData(stableGoldTimes(rows));
    const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v;
  }});
}
function wrapTs(ts){return new Proxy(ts,{get(t,p,r){if(p==='subscribeVisibleLogicalRangeChange')return cb=>{subscriptionSeq++;stats.subscriptions=subscriptionSeq;return t.subscribeVisibleLogicalRangeChange(range=>{stats.rangeCallbacks++;if(!range)return cb(range);const from=Number(range.from),gold=window.RENKO_GOLD_ONLY===true;if(gold){stats.goldExactRanges++;document.documentElement.dataset.renkoScrollEdge=Number.isFinite(from)&&from<8?'true':'false';return cb(range)}if(Number.isFinite(from)&&from<8){stats.leftEdgeClamps++;document.documentElement.dataset.renkoScrollEdge='true';return cb({...range,from:8})}document.documentElement.dataset.renkoScrollEdge='false';return cb(range)})};const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v}})}
function wrapChart(chart){let ts=null;return new Proxy(chart,{get(t,p,r){
  if(p==='timeScale')return()=>ts||(ts=wrapTs(t.timeScale()));
  if(p==='addSeries')return(...a)=>wrapSeries(t.addSeries(...a));
  if(p==='addCandlestickSeries')return(...a)=>wrapSeries(t.addCandlestickSeries(...a));
  const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v;
}})}
try{window.LightweightCharts={...L,createChart:(...a)=>wrapChart(create(...a))};document.documentElement.dataset.renkoScrollZeroLock='true'}catch(e){console.warn('[RENKO scroll-zero lock]',e);document.documentElement.dataset.renkoScrollZeroLock='failed'}
document.addEventListener('click',e=>{if(!e.target?.closest?.('#tvPanOlder'))return;const T=window.RWARenkoTV;if(!T||T.state?.status==='history-origin')return;stats.explicitOlderRequests++;queueMicrotask(()=>{try{void T.loadOlderPage?.()}catch(err){console.warn('[RENKO explicit older history]',err)}})},true);
window.RWARenkoScrollZeroLock={version:'1.4.0-gold-stable-time',rule:'gold-wheel-pan-render-only-exact-visible-range-no-range-clamp-prefix-independent-subsecond-brick-time',stats,stableGoldTimes};
})();