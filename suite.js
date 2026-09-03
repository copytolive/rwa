(()=>{
'use strict';
function css(href,key){if(document.querySelector(`link[data-rwa-${key}]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset[`rwa${key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())}`]='1';document.head.appendChild(l)}
function script(src,key){return new Promise((resolve,reject)=>{const old=[...document.scripts].find(s=>(s.getAttribute('src')||'').split('?')[0]===src.split('?')[0]);if(old){if(old.dataset.rwaReady==='1'||old.readyState==='complete')return resolve();old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src=src;s.async=false;s.dataset.rwaKey=key;s.onload=()=>{s.dataset.rwaReady='1';resolve()};s.onerror=reject;document.body.appendChild(s)})}
css('suite-v2.css?v=1','suite-v2-css');
css('ops.css?v=1','ops-css');
if(!window.RWASuite){window.RWASuite={version:'loading-v2',open:(tab='profile')=>{try{localStorage.setItem('rwa_suite_tab_v2',JSON.stringify(tab))}catch{};const el=document.getElementById('suite');if(el)el.style.display='block';if(innerWidth<=680)document.body.classList.add('suite-open')}}}
if(window.__RWA_SUITE_EXTENSIONS_LOADING)return;
window.__RWA_SUITE_EXTENSIONS_LOADING=true;
(async()=>{
  try{
    if(window.RWASuite?.version!=='2.0.0')await script('suite-v2.js?v=2','suite-v2');
    for(const [src,key] of [
      ['ops-suite.js?v=2','ops'],
      ['risk-hardening.js?v=1','risk'],
      ['rwa-verification-evidence.js?v=1','rwa-evidence'],
      ['rwa-verify-client.js?v=2','rwa-verify'],
      ['launch-status.js?v=2','launch-status'],
      ['copy-24x7-client.js?v=2','copy-24x7'],
      ['beta-proof-client.js?v=1','beta-proof'],
      ['provider-failover.js?v=1','provider-failover'],
      ['social-safety-patch.js?v=1','social-safety'],
      ['social-trade-monitor.js?v=1','social-trade-monitor'],
      ['monitor-client.js?v=1','monitor'],
      ['monitor-config-client.js?v=1','monitor-config'],
      ['audit-hooks.js?v=1','audit-hooks']
    ])await script(src,key);
    window.dispatchEvent(new CustomEvent('rwa:suite-extensions-ready'));
  }catch(e){console.error('RWA suite extension load failed',e)}
})();
})();
