(()=>{
'use strict';
if(window.__RWA_PRODUCT_OS_MOBILE_CONTRACT_V3)return;
window.__RWA_PRODUCT_OS_MOBILE_CONTRACT_V3=true;
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
