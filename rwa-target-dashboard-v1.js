(()=>{
'use strict';
if(window.RWATargetDashboardV1)return;
const $=s=>document.querySelector(s);
function toastSafe(msg){try{if(typeof window.toast==='function')window.toast(msg)}catch{}}
function setBrand(){const strong=$('.brandcopy strong');if(strong)strong.textContent='RWA × Seablueprint';const brand=$('.brand');if(brand)brand.setAttribute('aria-label','RWA × Seablueprint market home')}
function setNav(){const nav=$('.topnav');if(!nav)return;const buttons=[...nav.querySelectorAll('button')];const labels=['Markets','Ecommerce','Intelligence','Portfolio','Orders'];for(let i=0;i<labels.length;i++){let b=buttons[i];if(!b){b=document.createElement('button');nav.appendChild(b);buttons.push(b)}b.textContent=labels[i];b.removeAttribute('onclick');b.dataset.rwaTargetNav=labels[i].toLowerCase()}
  const market=buttons[0];if(market&&!market.dataset.rwaTargetBound){market.dataset.rwaTargetBound='1';market.addEventListener('click',e=>{e.preventDefault();try{window.RWASuperApp?.navigate?.('markets',{replace:true})}catch{}})}
  const ecommerce=buttons[1];if(ecommerce){if(!ecommerce.querySelector('.rwa-target-new')){const badge=document.createElement('span');badge.className='rwa-target-new';badge.textContent='NEW';ecommerce.appendChild(badge)}ecommerce.dataset.rwaShop='1'}
  const intel=buttons[2];if(intel&&!intel.dataset.rwaTargetBound){intel.dataset.rwaTargetBound='1';intel.addEventListener('click',e=>{e.preventDefault();try{window.RWASuperApp?.navigate?.('research',{replace:true})}catch{toastSafe('Intelligence workspace unavailable')}})}
  const portfolio=buttons[3];if(portfolio&&!portfolio.dataset.rwaTargetBound){portfolio.dataset.rwaTargetBound='1';portfolio.addEventListener('click',e=>{e.preventDefault();try{window.RWASuperApp?.navigate?.('portfolio',{replace:true})}catch{toastSafe('Portfolio requires wallet context')}})}
  const orders=buttons[4];if(orders&&!orders.dataset.rwaTargetBound){orders.dataset.rwaTargetBound='1';orders.addEventListener('click',e=>{e.preventDefault();try{window.RWASeablueprintCommerceBridge?.open?.('orders')}catch{toastSafe('Orders are available from Ecommerce')}})}
  let reports=nav.querySelector('[data-rwa-target-nav="reports"]');if(!reports){reports=document.createElement('button');reports.textContent='Reports';reports.dataset.rwaTargetNav='reports';reports.addEventListener('click',e=>{e.preventDefault();toastSafe('Reports remain evidence-gated until verified production activity exists')});nav.appendChild(reports)}
}
function setAside(){const label=$('.aside-label span');if(label)label.textContent='WATCHLIST';const small=$('.aside-label small');if(small)small.textContent='Live instruments'}
function setInPage(){const host=$('.top-actions');if(!host)return;let badge=$('.rwa-target-inpage');if(!badge){badge=document.createElement('span');badge.className='rwa-target-inpage';badge.textContent='IN-PAGE COMMERCE · Single Shell';const launch=$('#rwaSeablueprintCommerceLaunch');host.insertBefore(badge,launch||host.firstChild)}}
function mark(){document.body.classList.add('rwa-target-dashboard-v1');document.documentElement.dataset.rwaTargetDashboard='v1';setBrand();setNav();setAside();setInPage();window.RWAEcommerceProductionLabel?.apply?.()}
function boot(){mark();new MutationObserver(()=>queueMicrotask(mark)).observe(document.documentElement,{subtree:true,childList:true});let n=0;const t=setInterval(()=>{mark();if(++n>80)clearInterval(t)},100)}
window.RWATargetDashboardV1={version:'1.0.0',apply:mark};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
