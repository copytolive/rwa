(()=>{
'use strict';
if(window.RWATargetTopbarCleanup)return;
const VERSION='1.6.0',NAV=['markets','ecommerce','intelligence','portfolio','orders','reports'];
function visible(el){if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>1&&r.height>1}
function style(){
  if(document.getElementById('rwaTargetTopbarCleanupStyle'))return;
  const s=document.createElement('style');
  s.id='rwaTargetTopbarCleanupStyle';
  s.textContent=`body.rwa-target-dashboard-v2 .brandmark{background:#03101f url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cg fill='none' stroke='%235b9cff' stroke-width='2.5' stroke-linejoin='round'%3E%3Cpath d='M16 3 27 9.5 16 16 5 9.5 16 3Z'/%3E%3Cpath d='M5 9.5v12L16 28V16M27 9.5v12L16 28'/%3E%3Cpath d='m9.5 12 6.5-3.8 6.5 3.8-6.5 3.8-6.5-3.8Z'/%3E%3C/g%3E%3C/svg%3E") center/25px 25px no-repeat!important;box-shadow:none!important}html body.rwa-target-dashboard-v2 #rwaMarketplaceLaunch,html body.rwa-target-dashboard-v2 #rwaMultiChainLaunch{display:inline-flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}@media(min-width:1451px){body.rwa-target-dashboard-v2 .topnav>[data-rwa-target-nav]{display:inline-flex!important;align-items:center!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}}body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .topnav [data-rwa-target-nav="markets"]{background:#101a33!important;color:#fff!important;box-shadow:inset 0 -2px 0 #7584ff!important}body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .topnav [data-rwa-target-nav="ecommerce"]{background:transparent!important;color:#a9b4c7!important;box-shadow:none!important}@media(max-width:680px){body.rwa-target-dashboard-v2 .rwa-target-inpage,body.rwa-target-dashboard-v2 .rwa-target-icon-actions{display:none!important}body.rwa-target-dashboard-v2 .top-actions{flex:0 1 auto!important;width:auto!important;min-width:0!important;max-width:145px!important;gap:4px!important;overflow:visible!important}body.rwa-target-dashboard-v2 .top-actions .signin{min-width:0!important;width:auto!important;max-width:145px!important;padding:0 10px!important}}`;
  document.head.appendChild(s);
}
function labels(nav){return [...nav.querySelectorAll(':scope > [data-rwa-target-nav]')].map(x=>x.dataset.rwaTargetNav)}
function canonicalMissing(nav){const a=labels(nav);return innerWidth>1450&&(a.length!==NAV.length||NAV.some((x,i)=>a[i]!==x))}
function clean(){
  style();
  let nav=document.querySelector('.topnav');
  if(!nav)return;
  if(canonicalMissing(nav)&&window.RWATargetDashboardV2?.apply){window.RWATargetDashboardV2.apply();nav=document.querySelector('.topnav')||nav}
  const canonical=nav.querySelector('[data-rwa-target-nav="ecommerce"]');
  if(canonical){
    canonical.dataset.rwaSeablueprintCommerce='1';
    canonical.dataset.rwaShop='1';
    canonical.setAttribute('aria-label','Open Ecommerce contextual panel');
    canonical.setAttribute('aria-haspopup','dialog');
    for(const el of [...nav.children]){
      if(el===canonical)continue;
      const duplicate=el.matches?.('[data-rwa-shop],[data-rwa-seablueprint-commerce],#rwaSeablueprintCommerceLaunch')||/^\s*ecommerce\s*$/i.test(el.textContent||'');
      if(duplicate){el.remove();continue}
      if(el.tagName==='BUTTON'&&!el.dataset.rwaTargetNav&&el.id!=='rwaMarketplaceLaunch'&&el.id!=='rwaMultiChainLaunch')el.remove();
    }
    if(innerWidth>680)canonical.id='rwaSeablueprintCommerceLaunch';
    else if(canonical.id==='rwaSeablueprintCommerceLaunch')canonical.removeAttribute('id');
  }else{
    for(const el of [...nav.children]){
      if(el.tagName==='BUTTON'&&!el.dataset.rwaTargetNav&&el.id!=='rwaMarketplaceLaunch'&&el.id!=='rwaMultiChainLaunch')el.remove();
    }
  }
  const finalLabels=labels(nav);
  document.documentElement.dataset.rwaTargetNavCount=String(finalLabels.length);
  document.documentElement.dataset.rwaEcommerceNavCount=String(nav.querySelectorAll('[data-rwa-target-nav="ecommerce"]').length);
}
clean();
new MutationObserver(()=>queueMicrotask(clean)).observe(document.documentElement,{subtree:true,childList:true});
addEventListener('resize',()=>requestAnimationFrame(clean),{passive:true});
setInterval(clean,250);
window.RWATargetTopbarCleanup={
  version:VERSION,
  apply:clean,
  audit:()=>({
    version:VERSION,
    labels:[...document.querySelectorAll('.topnav > [data-rwa-target-nav]')].map(x=>x.dataset.rwaTargetNav),
    visibleLabels:[...document.querySelectorAll('.topnav > [data-rwa-target-nav]')].filter(visible).map(x=>x.dataset.rwaTargetNav),
    ecommerceNavCount:document.querySelectorAll('.topnav > [data-rwa-target-nav="ecommerce"]').length,
    ecommerceVisibleCount:[...document.querySelectorAll('.topnav > [data-rwa-target-nav="ecommerce"]')].filter(visible).length,
    otherButtons:document.querySelectorAll('.topnav > button:not([data-rwa-target-nav]):not(#rwaMarketplaceLaunch):not(#rwaMultiChainLaunch)').length,
    marketplaceVisible:visible(document.querySelector('#rwaMarketplaceLaunch')),
    multichainVisible:visible(document.querySelector('#rwaMultiChainLaunch')),
    businessConsoleVisible:visible(document.querySelector('#rwaBusinessConsoleLaunch'))
  })
};
})();