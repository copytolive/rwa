(()=>{
'use strict';
if(window.RWAChartCore)return;
const $=id=>document.getElementById(id);
let tvToken=0,drawQueued=false;
function intervalMs(){const v=typeof S!=='undefined'?String(S.interval):'15';return ({'1':60000,'5':300000,'15':900000,'60':3600000,'240':14400000,'D':86400000})[v]||900000}
function queueDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;try{drawFallback()}catch{}})}
function liveCandle(px,ts=Date.now(),vol=0){
  if(typeof S==='undefined'||!Number.isFinite(Number(px)))return;
  const p=Number(px),bucket=Math.floor(Number(ts)/intervalMs())*intervalMs();
  if(!Array.isArray(S.klines))S.klines=[];
  const last=S.klines.at(-1);
  if(last&&Number(last.t)===bucket){last.h=Math.max(Number(last.h),p);last.l=Math.min(Number(last.l),p);last.c=p;last.v=Number(last.v||0)+Number(vol||0)}
  else{const open=last?Number(last.c):p;S.klines.push({t:bucket,o:open,h:p,l:p,c:p,v:Number(vol||0)});if(S.klines.length>180)S.klines=S.klines.slice(-180)}
  queueDraw();
}
const baseAdd=typeof addTrade==='function'?addTrade:null;
if(baseAdd){window.addTrade=function(t){baseAdd(t);liveCandle(Number(t?.p),Number(t?.T||Date.now()),Number(t?.q||0))}}
const tvOpen=window.RWAOpenTradingView;
function openTradingView(force=false){
  const host=$('tvHost');if(!host||typeof tvOpen!=='function')return false;
  const token=++tvToken;host.style.opacity='0';host.style.pointerEvents='none';
  try{tvOpen(force)}catch(e){console.warn('TradingView start failed',e);return false}
  const start=performance.now();
  const poll=()=>{
    if(token!==tvToken)return;
    const iframe=host.querySelector('iframe');
    if(iframe){host.style.opacity='1';host.style.pointerEvents='auto';host.dataset.ready='1';return}
    if(performance.now()-start>5000){host.innerHTML='';host.style.opacity='0';host.style.pointerEvents='none';host.dataset.ready='0';return}
    setTimeout(poll,80)
  };poll();return true
}
window.loadTradingView=openTradingView;
window.reloadChart=function(){try{loadKlines()}catch{};openTradingView(true);if(typeof toast==='function')toast('Chart refreshed')};
function boot(){
  const host=$('tvHost');if(host){host.style.transition='opacity .15s ease';host.style.opacity='0'}
  try{if(!Array.isArray(S.klines)||!S.klines.length)loadKlines();else queueDraw()}catch{}
  requestAnimationFrame(()=>setTimeout(()=>openTradingView(false),80));
}
window.addEventListener('resize',queueDraw,{passive:true});
window.addEventListener('visibilitychange',()=>{if(!document.hidden){queueDraw();const h=$('tvHost');if(h&&!h.querySelector('iframe'))openTradingView(false)}});
window.RWAChartCore={openTradingView,liveCandle,redraw:queueDraw};
boot();
})();
/* RWA_UI_LAYOUT_INTEGRITY_V16_2_BOOTSTRAP */
(()=>{if(document.querySelector('script[data-rwa-ui-layout-v15]'))return;const s=document.createElement('script');s.src='ui-layout-integrity-v15.js?v=16.2';s.async=false;s.dataset.rwaUiLayoutV15='1';s.onerror=()=>console.error('RWA UI Layout Integrity V16.2 failed to load');document.head.appendChild(s)})();
/* RWA_SEABLUEPRINT_COMMERCE_SINGLE_SHELL_V1_BOOTSTRAP */
(()=>{if(document.querySelector('script[data-rwa-seablueprint-commerce]'))return;const s=document.createElement('script');s.src='rwa-seablueprint-commerce-bridge.js?v=1.2.1';s.async=false;s.dataset.rwaSeablueprintCommerce='1';s.onerror=()=>console.error('Seablueprint single-shell commerce bridge failed to load');document.head.appendChild(s)})();
