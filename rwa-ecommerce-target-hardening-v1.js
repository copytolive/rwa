(()=>{
'use strict';
if(window.RWAEcommerceTargetHardening)return;
const VERSION='1.1.0';
let enforcing=false,queued=false;
function ensure(){
  queued=false;
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
window.RWAEcommerceTargetHardening={version:VERSION,ensure,schedule,audit:()=>({version:VERSION,open:document.querySelector('#rwaShopScreen')?.classList.contains('open')||false,targetPresent:!!document.querySelector('[data-rwa-ecom-target="2.3.0"]'),polling:false})};
})();