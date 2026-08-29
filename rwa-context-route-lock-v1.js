(()=>{
'use strict';
if(window.RWAContextRouteLock)return;
const VERSION='1.0.0';
let intent='',openingShop=false,bridgePatched=false;
const $=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
function replaceHash(hash=''){
  const href=`${location.pathname}${location.search}${hash}`;
  try{history.replaceState(history.state,'',href)}catch{if(hash)location.hash=hash;else location.hash=''}
}
function normalizeEcommerceNav(){
  const nav=$('.topnav'),canonical=nav?.querySelector('[data-rwa-target-nav="ecommerce"]');
  if(!nav||!canonical)return false;
  canonical.dataset.rwaShop='1';
  canonical.dataset.rwaSeablueprintCommerce='1';
  canonical.setAttribute('aria-label','Open Ecommerce contextual panel');
  canonical.setAttribute('aria-haspopup','dialog');
  if(innerWidth>680)canonical.id='rwaSeablueprintCommerceLaunch';
  else if(canonical.id==='rwaSeablueprintCommerceLaunch')canonical.removeAttribute('id');
  for(const el of [...nav.children]){
    if(el===canonical)continue;
    const duplicate=el.matches?.('[data-rwa-shop],[data-rwa-seablueprint-commerce],#rwaSeablueprintCommerceLaunch')||/^\s*ecommerce\s*$/i.test(el.textContent||'');
    if(duplicate)el.remove();
  }
  return true;
}
function closeMultiChain(){
  try{window.RWAMultiChain?.close?.()}catch{}
  const panel=$('#rwaMultiChainPanel');
  if(panel){panel.hidden=true;panel.setAttribute('aria-hidden','true')}
  document.body.classList.remove('rwa-multichain-open');
  $('#rwaMultiChainLaunch')?.classList.remove('active');
}
function closeCommerceForMultiChain(){
  const screen=$('#rwaShopScreen');
  if(screen?.classList.contains('open')){
    try{window.RWASeablueprintCommerceBridge?.close?.({restore:false})}catch{}
    screen.classList.remove('open');
  }
  document.body.classList.remove('rwa-seablueprint-commerce-open','rwa-shop-open');
  const dock=$('#rwaCommerceDock');if(dock){dock.hidden=true;dock.classList.remove('open');dock.setAttribute('aria-hidden','true')}
  if(location.hash==='#shop')replaceHash('');
}
function patchBridge(){
  const bridge=window.RWASeablueprintCommerceBridge;
  if(!bridge||bridgePatched)return;
  const originalOpen=bridge.open?.bind(bridge);
  if(typeof originalOpen!=='function')return;
  bridge.open=async(...args)=>{
    intent='shop';openingShop=true;closeMultiChain();normalizeEcommerceNav();
    try{
      const out=await originalOpen(...args);
      closeMultiChain();normalizeEcommerceNav();
      if(location.hash!=='#shop')replaceHash('#shop');
      return out;
    }finally{openingShop=false;queueMicrotask(enforce)}
  };
  bridgePatched=true;
}
async function openShopFromRoute(){
  if(openingShop)return;
  const bridge=window.RWASeablueprintCommerceBridge;
  if(!bridge?.open)return;
  openingShop=true;intent='shop';closeMultiChain();
  try{await bridge.open('products');closeMultiChain();normalizeEcommerceNav();if(location.hash!=='#shop')replaceHash('#shop')}finally{openingShop=false}
}
function enforce(){
  patchBridge();normalizeEcommerceNav();
  const shopOpen=$('#rwaShopScreen')?.classList.contains('open')===true;
  const multiOpen=document.body.classList.contains('rwa-multichain-open')||($('#rwaMultiChainPanel')&&!$('#rwaMultiChainPanel').hidden);
  if(intent==='multichain'&&multiOpen){if(shopOpen||location.hash==='#shop')closeCommerceForMultiChain();return}
  if(location.hash==='#shop'||shopOpen){intent='shop';closeMultiChain();if(location.hash==='#shop'&&!shopOpen&&!openingShop)void openShopFromRoute();else if(shopOpen&&location.hash!=='#shop')replaceHash('#shop')}
}
window.addEventListener('click',e=>{
  if(e.target.closest?.('#rwaMultiChainLaunch')){
    intent='multichain';closeCommerceForMultiChain();
    setTimeout(enforce,0);setTimeout(enforce,120);
  }
},true);
window.addEventListener('hashchange',()=>{if(location.hash==='#shop')intent='shop';setTimeout(enforce,0)});
window.addEventListener('popstate',()=>setTimeout(enforce,0));
addEventListener('resize',()=>requestAnimationFrame(normalizeEcommerceNav),{passive:true});
new MutationObserver(()=>queueMicrotask(enforce)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','id','data-rwa-shop','data-rwa-seablueprint-commerce']});
setInterval(enforce,250);
window.RWAContextRouteLock={version:VERSION,enforce,audit:()=>({version:VERSION,intent,hash:location.hash,ecommerceNavCount:document.querySelectorAll('.topnav>[data-rwa-target-nav="ecommerce"]').length,ecommerceVisibleCount:qa('.topnav>button').filter(x=>getComputedStyle(x).display!=='none'&&/^\s*ecommerce\s*$/i.test(x.textContent||'')).length,shopOpen:$('#rwaShopScreen')?.classList.contains('open')===true,multiChainOpen:document.body.classList.contains('rwa-multichain-open')||($('#rwaMultiChainPanel')&&!$('#rwaMultiChainPanel').hidden),exclusive:!(($('#rwaShopScreen')?.classList.contains('open')===true)&&(document.body.classList.contains('rwa-multichain-open')||($('#rwaMultiChainPanel')&&!$('#rwaMultiChainPanel'].hidden))))})};
queueMicrotask(enforce);
})();