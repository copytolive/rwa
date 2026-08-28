(()=>{
'use strict';
if(window.RWAEcommerceProductionLabel)return;
const LABEL='Ecommerce production';
function apply(){
  const launch=document.querySelector('#rwaSeablueprintCommerceLaunch');
  if(launch){
    const label=launch.querySelector('.rwa-seablueprint-commerce-label');
    if(label&&label.textContent!==LABEL)label.textContent=LABEL;
    launch.setAttribute('aria-label','Open Ecommerce production beside live market');
    launch.dataset.rwaEcommerceProduction='1';
  }
  document.querySelectorAll('[data-rwa-shop]').forEach(el=>{
    if(el.closest('.topnav')||el.id==='rwaSeablueprintCommerceLaunch')el.setAttribute('data-rwa-ecommerce-production','1');
  });
  const screen=document.querySelector('#rwaShopScreen');
  if(screen){
    screen.dataset.rwaEcommerceProduction='1';
    const brand=screen.querySelector('.rwa-shop-brand b');
    if(brand&&/Seablueprint Ecommerce/i.test(brand.textContent||''))brand.textContent='Seablueprint Ecommerce Production';
  }
}
function boot(){apply();new MutationObserver(()=>queueMicrotask(apply)).observe(document.documentElement,{subtree:true,childList:true});let n=0;const t=setInterval(()=>{apply();if(++n>60)clearInterval(t)},100)}
window.RWAEcommerceProductionLabel={label:LABEL,apply};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
