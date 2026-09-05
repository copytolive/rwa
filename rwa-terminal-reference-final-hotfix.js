(()=>{
'use strict';
if(window.RWAReferenceFinalHotfix)return;
const primeRewards=()=>{
 const body=document.querySelector('[data-v5-bottom-body]');
 if(!body)return;
 body.innerHTML='<div class="rwa-v5-lock"><b>Checking verified rewards ledger</b><p>Rewards stay locked until the authoritative ledger confirms the connected wallet and program state.</p><span>LOCKED</span></div>';
};
document.addEventListener('click',e=>{
 const el=e.target instanceof Element?e.target.closest('.topnav [data-v5-global="rewards"],#liveRail [data-v5-nav="rewards"]'):null;
 if(el)primeRewards();
},true);
window.RWAReferenceFinalHotfix={version:'1.0.0',active:true,primeRewards};
})();
