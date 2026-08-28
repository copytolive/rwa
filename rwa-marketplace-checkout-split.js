(()=>{
'use strict';
const KEY='rwa_marketplace_v2_cart';
const button=()=>document.getElementById('checkoutButton');
const note=()=>document.getElementById('checkoutNote');
function cart(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function sellerKey(x){return String(x?.storeToken||x?.seller||'unknown').trim().toLowerCase()}
function groups(){const out=new Map();for(const x of cart()){const k=sellerKey(x);if(!out.has(k))out.set(k,[]);out.get(k).push(x)}return out}
function sync(){const b=button(),n=note();if(!b)return;const g=groups();if(g.size>1){b.disabled=true;b.dataset.sellerSplitRequired='1';b.textContent=`Split into ${g.size} seller checkouts`;if(n)n.textContent=`This cart contains ${g.size} sellers. For settlement and refund isolation, checkout is seller-scoped: each seller gets an independent authoritative quote, order, payment and refund lifecycle. Combined multi-seller settlement is not enabled.`}else{delete b.dataset.sellerSplitRequired}}
document.addEventListener('click',e=>{const b=e.target.closest?.('#checkoutButton');if(!b)return;const g=groups();if(g.size>1){e.preventDefault();e.stopImmediatePropagation();sync()}},true);
const root=document.getElementById('marketplacePanel');if(root)new MutationObserver(()=>sync()).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
window.addEventListener('storage',e=>{if(e.key===KEY)sync()});
setTimeout(sync,0);setTimeout(sync,500);
window.RWAMarketplaceCheckoutSplit={version:'1.0.0',policy:'SELLER_SCOPED_SPLIT_CHECKOUT_V1',groups:()=>[...groups()].map(([seller,items])=>({seller,items})),sync};
})();
