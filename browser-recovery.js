(()=>{
'use strict';
if(window.__RWA_BROWSER_RECOVERY__)return;window.__RWA_BROWSER_RECOVERY__=true;
const BUILD='browser-recovery-v2';
const nativeTV=window.loadTradingView;
let queued=false,lastKey='',bootTimer=0;
function host(){return document.getElementById('tvHost')}
function fallbackOn(){const h=host();if(h){h.style.opacity='0';h.style.pointerEvents='none'}const c=document.getElementById('fallbackChart');if(c){c.style.opacity='1';c.style.visibility='visible';c.style.zIndex='3'}}
function recoverBrowserCache(){try{if(sessionStorage.getItem(BUILD))return;sessionStorage.setItem(BUILD,'1')}catch(_){return}
  if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.filter(r=>(r.scope||'').includes('/rwa/')).map(r=>r.unregister()))).catch(()=>{});
  if(window.caches)caches.keys().then(keys=>Promise.all(keys.filter(k=>/^rwa[-_:]/i.test(k)).map(k=>caches.delete(k)))).catch(()=>{});
}
function promoteTV(){const h=host();if(!h)return false;const f=h.querySelector('iframe');if(!f)return false;const show=()=>{h.style.opacity='1';h.style.pointerEvents='auto';h.style.zIndex='4'};if(f.dataset.rwaReady==='1'){show();return true}f.addEventListener('load',()=>{f.dataset.rwaReady='1';setTimeout(show,200)},{once:true});return true}
function abandonTV(reason){const h=host();if(h){h.innerHTML='';h.style.opacity='0';h.style.pointerEvents='none'}fallbackOn();console.warn(reason||'TradingView unavailable; instant canvas remains active')}
function startTV(force=false){if(typeof nativeTV!=='function')return;const key=(window.S?`${S.selected}:${S.interval}`:'BTCUSDT:15');if(!force&&lastKey===key&&host()?.querySelector('iframe'))return;lastKey=key;fallbackOn();try{nativeTV()}catch(e){abandonTV('TradingView deferred boot failed');return}clearTimeout(bootTimer);let checks=0;const check=()=>{checks++;if(promoteTV())return;if(checks<20)bootTimer=setTimeout(check,125);else abandonTV('TradingView timeout; canvas chart remains active')};bootTimer=setTimeout(check,80)}
window.loadTradingView=function(force=false){fallbackOn();if(document.readyState!=='complete'){
  if(!queued){queued=true;window.addEventListener('load',()=>{queued=false;setTimeout(()=>startTV(force),0)},{once:true})}
  return;
 }
 startTV(force)
};
recoverBrowserCache();fallbackOn();
window.addEventListener('error',e=>{const src=e?.target?.src||'';if(src.includes('tradingview.com'))abandonTV('TradingView resource error; canvas chart remains active')},true);
})();
