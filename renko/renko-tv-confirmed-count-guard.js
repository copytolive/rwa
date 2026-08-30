/* Confirmed-count display owner.
 * The base engine may expose totalBricks > state.confirmed.length because the
 * rendered brick array is intentionally capped for chart performance. The user
 * facing CONFIRMED counter must show the full immutable confirmed total and must
 * never pulse down to the render cap while ordinary fixed-1s closes are handled.
 */
(()=>{
'use strict';
if(window.RWARenkoConfirmedCountGuard)return;
const parse=s=>Number(String(s??'').replace(/[^0-9-]/g,''));
const total=()=>{const T=window.RWARenkoTV,s=T?.state,b=s?.base;const n=Number(b?.totalBricks??s?.confirmedTotal??s?.confirmed?.length??0);return Number.isFinite(n)&&n>=0?n:0};
const fmt=n=>Number(n).toLocaleString();
const stats={writes:0,corrected:0,lastIncoming:'',lastDisplayed:'',lastTotal:0,lastAt:0};
function own(el){
  if(!el||el.dataset.renkoConfirmedCountOwned==='true')return;
  const d=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');if(!d?.get||!d?.set)return;
  Object.defineProperty(el,'textContent',{configurable:true,enumerable:false,get(){return d.get.call(this)},set(v){
    const truth=total(),incoming=String(v??'');let out=incoming;
    if(truth>0){const n=parse(incoming);if(!Number.isFinite(n)||n!==truth){out=fmt(truth);stats.corrected++}}
    d.set.call(this,out);stats.writes++;stats.lastIncoming=incoming;stats.lastDisplayed=out;stats.lastTotal=truth;stats.lastAt=Date.now();
  }});
  el.dataset.renkoConfirmedCountOwned='true';
}
function install(){own(document.getElementById('brickCount'));document.documentElement.dataset.renkoConfirmedCountGuard='true'}
function captureGoldChart(){
  const L=window.LightweightCharts;if(!L||typeof L.createChart!=='function'||L.__RENKO_GOLD_CAPTURE_GUARD__)return;
  const native=L.createChart.bind(L);
  L.createChart=(...args)=>{const c=native(...args);window.__RENKO_GOLD_HISTORY_CHART__=c;return c};
  L.__RENKO_GOLD_CAPTURE_GUARD__=true;
}
function loadGoldHistory(){
  if(window.RWARenkoGoldHistory||document.querySelector('script[data-renko-gold-history]'))return;
  const s=document.createElement('script');s.src='renko-gold-infinite-history.js?v=1';s.async=false;s.dataset.renkoGoldHistory='1';document.head.appendChild(s);
}
captureGoldChart();install();
window.addEventListener('renko:tv-ready',()=>{install();loadGoldHistory()});
window.addEventListener('renko:symbol-switch-end',install);
window.RWARenkoConfirmedCountGuard={version:'1.1.0',rule:'visible-confirmed-count-is-full-engine-total-never-render-cap-plus-gold-chart-capture',total,install,stats,captureGoldChart,loadGoldHistory};
})();
