(()=>{
'use strict';
if(window.__RWA_BROWSER_RECOVERY__)return;window.__RWA_BROWSER_RECOVERY__=true;
const nativeTV=window.loadTradingView;
let queued=false,lastKey='',bootTimer=0;
function host(){return document.getElementById('tvHost')}
function fallbackOn(){const h=host();if(!h)return;h.style.opacity='0';h.style.pointerEvents='none';const c=document.getElementById('fallbackChart');if(c){c.style.opacity='1';c.style.visibility='visible';c.style.zIndex='3'}}
function promoteTV(){const h=host();if(!h)return;const f=h.querySelector('iframe');if(!f)return false;const show=()=>{h.style.opacity='1';h.style.pointerEvents='auto';h.style.zIndex='4';const c=document.getElementById('fallbackChart');if(c)c.style.zIndex='3'};if(f.dataset.rwaReady==='1'){show();return true}f.addEventListener('load',()=>{f.dataset.rwaReady='1';setTimeout(show,250)},{once:true});return true}
function startTV(force=false){if(typeof nativeTV!=='function')return;const key=(window.S?`${S.selected}:${S.interval}`:'BTCUSDT:15');if(!force&&lastKey===key&&host()?.querySelector('iframe'))return;lastKey=key;fallbackOn();try{nativeTV()}catch(e){console.warn('TradingView deferred boot failed',e);return}clearTimeout(bootTimer);let checks=0;const check=()=>{checks++;if(promoteTV())return;if(checks<24)bootTimer=setTimeout(check,125);else{const h=host();if(h){h.innerHTML='';h.style.opacity='0';h.style.pointerEvents='none'}console.warn('TradingView unavailable; instant canvas remains active')}};bootTimer=setTimeout(check,100)}
window.loadTradingView=function(force=false){if(document.readyState!=='complete'){
  fallbackOn();
  if(!queued){queued=true;window.addEventListener('load',()=>{queued=false;setTimeout(()=>startTV(force),0)},{once:true})}
  return;
 }
 startTV(force)
};
fallbackOn();
window.addEventListener('error',e=>{const src=e?.target?.src||'';if(src.includes('tradingview.com'))fallbackOn()},true);
})();
