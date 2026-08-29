(()=>{
'use strict';
if(window.RWAEcommercePublicReference)return;
const VERSION='1.0.0';
let timer=0;
function open(){return document.body.classList.contains('rwa-seablueprint-commerce-open')}
function clean(){
  if(!open())return;
  for(const el of document.querySelectorAll('#rwaMarketplaceLaunch,#rwaMultiChainLaunch,.rwa-command-button,[data-rwa-command-open]')){
    el.style.setProperty('display','none','important');
    el.style.setProperty('visibility','hidden','important');
    el.style.setProperty('pointer-events','none','important');
  }
  const host=document.querySelector('.top-actions');
  if(host)for(const el of [...host.children]){
    if(el.matches('.rwa-target-inpage,.rwa-target-icon-actions,.signin'))continue;
    el.style.setProperty('display','none','important');
    el.style.setProperty('visibility','hidden','important');
  }
  const nav=document.querySelector('.topnav');
  if(nav){
    const ecommerce=[...nav.querySelectorAll('[data-rwa-target-nav="ecommerce"]')];
    ecommerce.slice(1).forEach(x=>x.remove());
  }
  document.documentElement.dataset.rwaEcommerceReference='1';
}
function restore(){
  if(open())return;
  for(const el of document.querySelectorAll('#rwaMarketplaceLaunch,#rwaMultiChainLaunch,.rwa-command-button,[data-rwa-command-open],.top-actions>*')){
    if(el.style?.getPropertyPriority('display')==='important')el.style.removeProperty('display');
    if(el.style?.getPropertyPriority('visibility')==='important')el.style.removeProperty('visibility');
    if(el.style?.getPropertyPriority('pointer-events')==='important')el.style.removeProperty('pointer-events');
  }
  delete document.documentElement.dataset.rwaEcommerceReference;
}
function sync(){open()?clean():restore()}
new MutationObserver(()=>queueMicrotask(sync)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
addEventListener('hashchange',sync);addEventListener('resize',sync,{passive:true});
timer=setInterval(sync,120);sync();
window.RWAEcommercePublicReference={version:VERSION,apply:sync,audit:()=>({version:VERSION,open:open(),reference:document.documentElement.dataset.rwaEcommerceReference==='1',multichainVisible:[...document.querySelectorAll('#rwaMultiChainLaunch')].some(x=>getComputedStyle(x).display!=='none'),commandVisible:[...document.querySelectorAll('.rwa-command-button,[data-rwa-command-open]')].some(x=>getComputedStyle(x).display!=='none')})};
})();
