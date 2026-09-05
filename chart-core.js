(()=>{
'use strict';
if(window.RWAChartCore)return;
const $=id=>document.getElementById(id);
let tvToken=0,drawQueued=false;
function intervalMs(){const v=typeof S!=='undefined'?String(S.interval):'15';return ({'1':60000,'5':300000,'15':900000,'60':3600000,'240':14400000,'D':86400000,'W':604800000})[v]||900000}
function queueDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;try{drawFallback()}catch{}})}
function liveCandle(px,ts=Date.now(),vol=0){if(typeof S==='undefined'||!Number.isFinite(Number(px)))return;const p=Number(px),bucket=Math.floor(Number(ts)/intervalMs())*intervalMs();if(!Array.isArray(S.klines))S.klines=[];const last=S.klines.at(-1);if(last&&Number(last.t)===bucket){last.h=Math.max(Number(last.h),p);last.l=Math.min(Number(last.l),p);last.c=p;last.v=Number(last.v||0)+Number(vol||0)}else{const open=last?Number(last.c):p;S.klines.push({t:bucket,o:open,h:p,l:p,c:p,v:Number(vol||0)});if(S.klines.length>180)S.klines=S.klines.slice(-180)}queueDraw()}
const baseAdd=typeof addTrade==='function'?addTrade:null;if(baseAdd){window.addTrade=function(t){baseAdd(t);liveCandle(Number(t?.p),Number(t?.T||Date.now()),Number(t?.q||0))}}
const tvOpen=window.RWAOpenTradingView;
function openTradingView(force=false){const host=$('tvHost');if(!host||typeof tvOpen!=='function')return false;const token=++tvToken;host.style.opacity='0';host.style.pointerEvents='none';try{tvOpen(force)}catch(e){console.warn('TradingView start failed',e);return false}const start=performance.now();const poll=()=>{if(token!==tvToken)return;const iframe=host.querySelector('iframe');if(iframe){host.style.opacity='1';host.style.pointerEvents='auto';host.dataset.ready='1';return}if(performance.now()-start>5000){host.innerHTML='';host.style.opacity='0';host.style.pointerEvents='none';host.dataset.ready='0';return}setTimeout(poll,80)};poll();return true}
window.loadTradingView=openTradingView;window.reloadChart=function(){try{loadKlines()}catch{};openTradingView(true);if(typeof toast==='function')toast('Chart refreshed')};
function boot(){const host=$('tvHost');if(host){host.style.transition='opacity .15s ease';host.style.opacity='0'}try{if(!Array.isArray(S.klines)||!S.klines.length)loadKlines();else queueDraw()}catch{}requestAnimationFrame(()=>setTimeout(()=>openTradingView(false),80))}
window.addEventListener('resize',queueDraw,{passive:true});window.addEventListener('visibilitychange',()=>{if(!document.hidden){queueDraw();const h=$('tvHost');if(h&&!h.querySelector('iframe'))openTradingView(false)}});window.RWAChartCore={openTradingView,liveCandle,redraw:queueDraw};boot();
})();
/* RWA_UI_LAYOUT_INTEGRITY_V16_2_BOOTSTRAP */
/* RWA_TARGET_DASHBOARD_V2_TRADING_ONLY */
(async()=>{try{
  for(const[key,href]of[['v2','rwa-target-dashboard-v2.css?v=2.0.0']]){
    if(document.querySelector(`link[data-rwa-target-${key}]`))continue;
    const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset[`rwaTarget${key[0].toUpperCase()+key.slice(1)}`]='1';document.head.appendChild(l)
  }
  if(!document.querySelector('link[data-rwa-target-livehome]')){const l=document.createElement('link');l.rel='stylesheet';l.href='rwa-live-home-v1.css?v=5.0.0';l.dataset.rwaTargetLivehome='1';document.head.appendChild(l)}
  if(!window.RWALiveHome)await import('./rwa-live-home-v1.js?v=5.0.2');
  if(!window.RWATerminalService)await import('./rwa-terminal-service.js?v=1.0.0');
  document.querySelectorAll('link[data-rwa-terminal-v5]').forEach(x=>x.remove());
  {const l=document.createElement('link');l.rel='stylesheet';l.href='rwa-terminal-v5.css?v=1.0.17';l.dataset.rwaTerminalV5='1';document.head.appendChild(l)}
  if(!window.RWATerminalV5)await import('./rwa-terminal-v5.js?v=1.0.26');
  if(!document.querySelector('link[data-rwa-reference-v20]')){const l=document.createElement('link');l.rel='stylesheet';l.href='rwa-terminal-reference-v20.css?v=2.0.1';l.dataset.rwaReferenceV20='1';document.head.appendChild(l);await new Promise((res,rej)=>{l.onload=res;l.onerror=rej})}
  if(!document.querySelector('link[data-rwa-reference-v20-fix]')){const l=document.createElement('link');l.rel='stylesheet';l.href='rwa-terminal-reference-v20-fix.css?v=2.0.5';l.dataset.rwaReferenceV20Fix='1';document.head.appendChild(l);await new Promise((res,rej)=>{l.onload=res;l.onerror=rej})}
  if(!window.RWAReferenceParity)await import('./rwa-terminal-reference-v20.js?v=2.0.1');
  if(!window.RWAReferenceParityFix)await import('./rwa-terminal-reference-v20-fix.js?v=2.0.2');
  if(!document.querySelector('link[data-rwa-reference-final]')){const l=document.createElement('link');l.rel='stylesheet';l.href='rwa-terminal-reference-final.css?v=1.0.4';l.dataset.rwaReferenceFinal='1';document.head.appendChild(l);await new Promise((res,rej)=>{l.onload=res;l.onerror=rej})}
  if(!window.RWAReferenceFinal)await import('./rwa-terminal-reference-final.js?v=1.0.1');
  if(!window.RWAReferenceFinalHotfix)await import('./rwa-terminal-reference-final-hotfix.js?v=1.0.0');
  if(!document.querySelector('link[data-rwa-reference-v21]')){const l=document.createElement('link');l.rel='stylesheet';l.href='rwa-terminal-reference-v21.css?v=2.1.0';l.dataset.rwaReferenceV21='1';document.head.appendChild(l);await new Promise((res,rej)=>{l.onload=res;l.onerror=rej})}
  if(!window.RWAReferenceParityV21)await import('./rwa-terminal-reference-v21.js?v=2.1.0');
  if(!window.RWAReferenceParityV21Visual)await import('./rwa-terminal-reference-v21-visual.js?v=1.0.1');
  if(!window.RWAReferenceParityV21Seal)await import('./rwa-terminal-reference-v21-seal.js?v=1.0.0');
  if(!document.querySelector('link[data-rwa-reference-v22]')){const l=document.createElement('link');l.rel='stylesheet';l.href='rwa-terminal-reference-v22.css?v=2.2.0';l.dataset.rwaReferenceV22='1';document.head.appendChild(l);await new Promise((res,rej)=>{l.onload=res;l.onerror=rej})}
  if(!document.querySelector('link[data-rwa-reference-v22-exact]')){const l=document.createElement('link');l.rel='stylesheet';l.href='rwa-terminal-reference-v22-exact.css?v=2.2.1';l.dataset.rwaReferenceV22Exact='1';document.head.appendChild(l);await new Promise((res,rej)=>{l.onload=res;l.onerror=rej})}
  await import('./rwa-terminal-reference-v22.js?v=2.2.1');
  document.documentElement.classList.add('rwa-target-runtime-ready')
}catch(e){console.error('RWA live HOME failed to load',e)}})();
/* RWA_REAL_BUSINESS_VALIDATION_CONSOLE_V1_BOOTSTRAP */
(()=>{if(window.RWABusinessConsole)return;import('./rwa-business-console.js?v=1.0.0').catch(()=>console.error('RWA business validation console failed to load'))})();
/* RWA_TERMINAL_V5_POST_HOTFIX_ACCEPTANCE_2026_09_03 */
/* RWA_TERMINAL_V5_BACKEND_INTEGRATED_FINAL_ACCEPTANCE_2026_09_03 */
/* RWA_TERMINAL_R18_APPROVED_REFERENCE_PUBLIC_RECERT_2026_09_04 */
/* RWA_TERMINAL_R20_STRICT_REFERENCE_PARITY_2026_09_04 */
/* RWA_TERMINAL_R20_INTERACTION_HARDENING_2026_09_04 */
/* RWA_TERMINAL_R20_FIXCSS_2_0_2_RECERT_2026_09_04 */
/* RWA_TERMINAL_R20_FIXCSS_2_0_3_RECERT_2026_09_04 */
/* RWA_TERMINAL_R20_FIXCSS_2_0_4_RECERT_2026_09_04 */
/* RWA_TERMINAL_REFERENCE_FINAL_1_0_0_RECERT_2026_09_04 */
/* RWA_TERMINAL_REFERENCE_FINAL_1_0_1_TOOLBAR_OVERLAY_2026_09_04 */
/* RWA_TERMINAL_REFERENCE_FINAL_1_0_2_SINGLE_TOOLBAR_2026_09_04 */
/* RWA_TERMINAL_REFERENCE_FINAL_1_0_3_MOBILE_CONTROLS_2026_09_04 */
/* RWA_TERMINAL_REFERENCE_FINAL_1_0_4_HITTEST_REWARDS_2026_09_05 */
/* RWA_TERMINAL_REFERENCE_V21_REALDATA_PARITY_2026_09_05 */
/* RWA_TERMINAL_REFERENCE_V21_VISUAL_DEFAULTS_2026_09_05 */
/* RWA_TERMINAL_REFERENCE_V21_VISUAL_DEFAULTS_1_0_1_2026_09_05 */
/* RWA_TERMINAL_REFERENCE_V21_CLEAN_CANDLE_SEAL_1_0_0_2026_09_05 */
/* RWA_TERMINAL_REFERENCE_V21_FINAL_RECERT_TRIGGER_2026_09_05 */
/* RWA_TERMINAL_REFERENCE_V22_REAL_DOM_PARITY_2026_09_05 */
/* RWA_TERMINAL_REFERENCE_V22_1_EXACT_ADAPTER_PARITY_2026_09_05 */