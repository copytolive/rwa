(()=>{
'use strict';
if(window.__RWA_PRODUCT_OS_MOBILE_CONTRACT_V3)return;
window.__RWA_PRODUCT_OS_MOBILE_CONTRACT_V3=true;

// Canonical root contract: /rwa/ always opens the integrated market terminal.
// Home and other workspaces remain explicit destinations only (#home, #social, etc.).
function lockCanonicalRoot(){
  const hash=location.hash.replace('#','').toLowerCase();
  if(hash&&hash!=='markets')return;
  try{localStorage.setItem('rwa_default_landing_v3','markets')}catch{}
  document.body.classList.remove('rwa-home-open','social-open','suite-open','market-drawer-open');
  const suite=document.getElementById('suite');
  if(suite&&innerWidth<=680)suite.style.display='none';
  if(window.RWAProductOS?.openMarkets)window.RWAProductOS.openMarkets();
  else document.getElementById('terminal')?.scrollIntoView({behavior:'auto',block:'start'});
}

lockCanonicalRoot();
addEventListener('rwa:product-os-ready',lockCanonicalRoot);
addEventListener('hashchange',lockCanonicalRoot);

document.addEventListener('click',e=>{
  const nav=e.target.closest?.('[data-mobile-nav="markets"]');
  if(!nav||innerWidth>680)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  document.body.classList.remove('rwa-home-open','social-open','suite-open');
  document.body.classList.add('market-drawer-open');
  const suite=document.getElementById('suite');if(suite)suite.style.display='none';
  document.querySelectorAll('[data-mobile-nav]').forEach(a=>a.classList.toggle('active',a.dataset.mobileNav==='markets'));
  setTimeout(()=>document.getElementById('search')?.focus(),80);
},true);
})();
