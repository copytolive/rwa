(()=>{
'use strict';
if(window.RWAEcommerceProductionLabel)return;
const LABEL='Ecommerce production';
function apply(){
  const launch=document.querySelector('#rwaSeablueprintCommerceLaunch');
  if(launch){
    const label=launch.querySelector('.rwa-seablueprint-commerce-label');
    if(label&&label.textContent!==LABEL)label.textContent=LABEL;
    if(launch.getAttribute('aria-label')!=='Open Ecommerce production beside live market')launch.setAttribute('aria-label','Open Ecommerce production beside live market');
    launch.dataset.rwaEcommerceProduction='1';
  }
  document.querySelectorAll('[data-rwa-shop],[data-rwa-seablueprint-commerce]').forEach(el=>{
    if(el.closest('.topnav')||el.id==='rwaSeablueprintCommerceLaunch')el.dataset.rwaEcommerceProduction='1';
  });
  const screen=document.querySelector('#rwaShopScreen');
  if(screen)screen.dataset.rwaEcommerceProduction='1';
}
function boot(){apply();let n=0;const t=setInterval(()=>{apply();if(++n>=80)clearInterval(t)},100)}
window.RWAEcommerceProductionLabel={label:LABEL,apply};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
