(()=>{
'use strict';
if(window.RWAEcommerceTargetHardening)return;
const VERSION='1.0.0';
let enforcing=false;
function ensure(){
  if(enforcing)return false;
  const screen=document.querySelector('#rwaShopScreen');
  if(!screen?.classList.contains('open'))return false;
  const root=document.querySelector('[data-rwa-ecom-target="2.3.0"]');
  if(root)return true;
  enforcing=true;
  try{return !!window.RWAEcommerceTargetController?.render?.()}finally{enforcing=false}
}
new MutationObserver(ensure).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
window.addEventListener('click',()=>queueMicrotask(ensure),true);
window.addEventListener('hashchange',ensure);
setInterval(ensure,25);
ensure();
window.RWAEcommerceTargetHardening={version:VERSION,ensure,audit:()=>({version:VERSION,open:document.querySelector('#rwaShopScreen')?.classList.contains('open')||false,targetPresent:!!document.querySelector('[data-rwa-ecom-target="2.3.0"]')})};
})();
