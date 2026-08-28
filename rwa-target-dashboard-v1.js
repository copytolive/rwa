(()=>{
'use strict';
if(window.RWATargetDashboardV1)return;
const $=s=>document.querySelector(s);
function toastSafe(msg){try{if(typeof window.toast==='function')window.toast(msg)}catch{}}
function setBrand(){const strong=$('.brandcopy strong');if(strong&&strong.textContent!=='RWA × Seablueprint')strong.textContent='RWA × Seablueprint';const brand=$('.brand');if(brand&&brand.getAttribute('aria-label')!=='RWA × Seablueprint market home')brand.setAttribute('aria-label','RWA × Seablueprint market home')}
function setButtonLabel(button,label,badge=false){if(!button)return;if(button.dataset.rwaTargetConfigured!==label){button.replaceChildren(document.createTextNode(label));if(badge){const mark=document.createElement('span');mark.className='rwa-target-new';mark.textContent='NEW';button.appendChild(mark)}button.dataset.rwaTargetConfigured=label}}
function setNav(){const nav=$('.topnav');if(!nav)return;const buttons=[...nav.querySelectorAll('button')];while(buttons.length<5){const b=document.createElement('button');nav.appendChild(b);buttons.push(b)}
  setButtonLabel(buttons[0],'Markets');setButtonLabel(buttons[1],'Ecommerce',true);setButtonLabel(buttons[2],'Intelligence');setButtonLabel(buttons[3],'Portfolio');setButtonLabel(buttons[4],'Orders');
  const market=buttons[0];market.dataset.rwaTargetNav='markets';market.removeAttribute('onclick');if(!market.dataset.rwaTargetBound){market.dataset.rwaTargetBound='1';market.addEventListener('click',e=>{e.preventDefault();try{window.RWASuperApp?.navigate?.('markets',{replace:true})}catch{}})}
  const ecommerce=buttons[1];ecommerce.dataset.rwaTargetNav='ecommerce';ecommerce.dataset.rwaSeablueprintCommerce='1';ecommerce.removeAttribute('data-rwa-shop');ecommerce.removeAttribute('onclick');
  const intel=buttons[2];intel.dataset.rwaTargetNav='intelligence';intel.removeAttribute('onclick');if(!intel.dataset.rwaTargetBound){intel.dataset.rwaTargetBound='1';intel.addEventListener('click',e=>{e.preventDefault();try{window.RWASuperApp?.navigate?.('research',{replace:true})}catch{toastSafe('Intelligence workspace unavailable')}})}
  const portfolio=buttons[3];portfolio.dataset.rwaTargetNav='portfolio';portfolio.removeAttribute('onclick');if(!portfolio.dataset.rwaTargetBound){portfolio.dataset.rwaTargetBound='1';portfolio.addEventListener('click',e=>{e.preventDefault();try{window.RWASuperApp?.navigate?.('portfolio',{replace:true})}catch{toastSafe('Portfolio requires wallet context')}})}
  const orders=buttons[4];orders.dataset.rwaTargetNav='orders';orders.removeAttribute('onclick');if(!orders.dataset.rwaTargetBound){orders.dataset.rwaTargetBound='1';orders.addEventListener('click',e=>{e.preventDefault();try{window.RWASeablueprintCommerceBridge?.open?.('orders')}catch{toastSafe('Orders are available from Ecommerce')}})}
  let reports=nav.querySelector('[data-rwa-target-nav="reports"]');if(!reports){reports=document.createElement('button');reports.dataset.rwaTargetNav='reports';reports.addEventListener('click',e=>{e.preventDefault();toastSafe('Reports remain evidence-gated until verified production activity exists')});nav.appendChild(reports)}setButtonLabel(reports,'Reports')
}
function setAside(){const label=$('.aside-label span');if(label&&label.textContent!=='WATCHLIST')label.textContent='WATCHLIST';const small=$('.aside-label small');if(small&&small.textContent!=='Live instruments')small.textContent='Live instruments'}
function setInPage(){const host=$('.top-actions');if(!host)return;let badge=$('.rwa-target-inpage');if(!badge){badge=document.createElement('span');badge.className='rwa-target-inpage';badge.textContent='IN-PAGE COMMERCE · Single Shell';const launch=$('#rwaSeablueprintCommerceLaunch');host.insertBefore(badge,launch||host.firstChild)}}
function mark(){document.body.classList.add('rwa-target-dashboard-v1');document.documentElement.dataset.rwaTargetDashboard='v1';setBrand();setNav();setAside();setInPage();window.RWAEcommerceProductionLabel?.apply?.()}
function boot(){mark();let n=0;const t=setInterval(()=>{mark();if(++n>=80)clearInterval(t)},100);addEventListener('hashchange',()=>setTimeout(mark,0),{passive:true});addEventListener('resize',()=>requestAnimationFrame(mark),{passive:true})}
window.RWATargetDashboardV1={version:'1.0.1',apply:mark};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
