(()=>{
'use strict';
if(window.RWAEcommerceTargetHardening)return;
const VERSION='1.1.1';
let enforcing=false,queued=false;
function suppressLegacyQuickDock(){
  let style=document.querySelector('#rwaCanonicalQuickDockSuppress');
  if(!style){
    style=document.createElement('style');
    style.id='rwaCanonicalQuickDockSuppress';
    style.textContent='body.rwa-target-dashboard-v2 #rwaQuickDock{display:none!important;visibility:hidden!important;pointer-events:none!important}';
    document.head.appendChild(style);
  }
  const dock=document.querySelector('#rwaQuickDock');
  if(dock){dock.setAttribute('aria-hidden','true');dock.style.setProperty('display','none','important');dock.style.setProperty('visibility','hidden','important');dock.style.setProperty('pointer-events','none','important')}
}
function ensure(){
  queued=false;
  suppressLegacyQuickDock();
  if(enforcing)return false;
  const screen=document.querySelector('#rwaShopScreen');
  if(!screen?.classList.contains('open'))return false;
  const root=document.querySelector('[data-rwa-ecom-target="2.3.0"]');
  if(root)return true;
  enforcing=true;
  try{return !!window.RWAEcommerceTargetController?.render?.()}finally{enforcing=false}
}
function schedule(){if(queued)return;queued=true;queueMicrotask(ensure)}
const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
window.addEventListener('click',schedule,true);
window.addEventListener('hashchange',schedule);
window.addEventListener('popstate',schedule);
schedule();
window.RWAEcommerceTargetHardening={version:VERSION,ensure,schedule,audit:()=>({version:VERSION,open:document.querySelector('#rwaShopScreen')?.classList.contains('open')||false,targetPresent:!!document.querySelector('[data-rwa-ecom-target="2.3.0"]'),quickDockVisible:!!document.querySelector('#rwaQuickDock')&&getComputedStyle(document.querySelector('#rwaQuickDock')).display!=='none',polling:false})};
})();