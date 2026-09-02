(()=>{
'use strict';
if(window.RWATargetTopbarCleanup?.version==='2.0.0')return;
const VERSION='2.0.0',NAV=['markets','intelligence','portfolio','orders','reports'];
function style(){
 if(document.getElementById('rwaTargetTopbarCleanupStyle'))return;
 const s=document.createElement('style');s.id='rwaTargetTopbarCleanupStyle';
 s.textContent=`body.rwa-target-dashboard-v2 .brandmark{background:#03101f url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cg fill='none' stroke='%235b9cff' stroke-width='2.5' stroke-linejoin='round'%3E%3Cpath d='M16 3 27 9.5 16 16 5 9.5 16 3Z'/%3E%3Cpath d='M5 9.5v12L16 28V16M27 9.5v12L16 28'/%3E%3Cpath d='m9.5 12 6.5-3.8 6.5 3.8-6.5 3.8-6.5-3.8Z'/%3E%3C/g%3E%3C/svg%3E") center/25px 25px no-repeat!important;box-shadow:none!important}body.rwa-target-dashboard-v2 .brandmark>b{display:none!important}body.rwa-target-dashboard-v2 .topnav>[data-rwa-target-nav]{display:inline-flex!important;align-items:center!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}`;
 document.head.appendChild(s)
}
function clean(){
 style();const nav=document.querySelector('.topnav');if(!nav)return;
 const seen=new Set();
 for(const el of [...nav.children]){
   const key=el.dataset?.rwaTargetNav;
   if(!key||!NAV.includes(key)||seen.has(key)){el.remove();continue}
   seen.add(key)
 }
 if([...seen].join('|')!==NAV.join('|')){
   nav.innerHTML=NAV.map((k,i)=>`<button type="button" class="${i===0?'active':''}" data-rwa-target-nav="${k}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')
 }
 document.documentElement.dataset.rwaTargetNavCount=String(NAV.length)
}
clean();new MutationObserver(()=>queueMicrotask(clean)).observe(document.documentElement,{subtree:true,childList:true});addEventListener('resize',()=>requestAnimationFrame(clean),{passive:true});setInterval(clean,600);
window.RWATargetTopbarCleanup={version:VERSION,apply:clean,audit:()=>({version:VERSION,labels:[...document.querySelectorAll('.topnav>[data-rwa-target-nav]')].map(x=>x.dataset.rwaTargetNav)})};
})();