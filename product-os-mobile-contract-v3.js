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

function commandSymbol(){
  const q=String(document.getElementById('rwaCommandInput')?.value||'').toUpperCase();
  const skip=new Set(['TRADE','BACKTEST','RENKO','ASSET','MARKET','OPEN','SHOW','COPY','PORTFOLIO','SOCIAL','HOME','INTELLIGENCE','RWA','LEADERBOARD','DEFAULT','TERMINAL']);
  return(q.match(/\b[A-Z0-9]{2,12}\b/g)||[]).find(x=>!skip.has(x))||String(document.getElementById('selName')?.textContent||'BTC').split(/[\s\/-]/)[0]||'BTC';
}
function openRootFundamentals(symbol){
  const layer=document.getElementById('rwaCommandLayer');if(layer)layer.hidden=true;
  window.RWAFundamentals?.open?.(String(symbol||commandSymbol()).toUpperCase());
}
function patchProductOS(){if(window.RWAProductOS)window.RWAProductOS.openAsset=s=>openRootFundamentals(s)}
function installMobileFundamentals(){
  const tabs=document.querySelector('.mobile-detail-tabs');
  if(!tabs||tabs.querySelector('.rwa-fundamentals-mobile-trigger'))return;
  const b=document.createElement('button');
  b.type='button';b.className='rwa-fundamentals-mobile-trigger';b.textContent='Fundamentals';b.setAttribute('aria-label','Open RWA income and fundamentals');
  tabs.appendChild(b);
}

lockCanonicalRoot();
patchProductOS();
installMobileFundamentals();
addEventListener('rwa:product-os-ready',()=>{lockCanonicalRoot();patchProductOS();installMobileFundamentals()});
addEventListener('hashchange',lockCanonicalRoot);

document.addEventListener('click',e=>{
  const fund=e.target.closest?.('.rwa-fundamentals-mobile-trigger');
  if(fund&&innerWidth<=680){
    e.preventDefault();e.stopImmediatePropagation();openRootFundamentals();return;
  }
  const nav=e.target.closest?.('[data-mobile-nav="markets"]');
  if(nav&&innerWidth<=680){
    e.preventDefault();
    e.stopImmediatePropagation();
    document.body.classList.remove('rwa-home-open','social-open','suite-open');
    document.body.classList.add('market-drawer-open');
    const suite=document.getElementById('suite');if(suite)suite.style.display='none';
    document.querySelectorAll('[data-mobile-nav]').forEach(a=>a.classList.toggle('active',a.dataset.mobileNav==='markets'));
    setTimeout(()=>document.getElementById('search')?.focus(),80);
    return;
  }
  const cmd=e.target.closest?.('.rwa-command-item');
  const tag=cmd?.lastElementChild?.textContent?.trim?.().toUpperCase();
  if(cmd&&tag==='ASSET'){
    e.preventDefault();
    e.stopImmediatePropagation();
    openRootFundamentals(commandSymbol());
  }
},true);
})();
