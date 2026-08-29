(()=>{
'use strict';
if(window.RWATargetDashboardV2Hardening)return;
const $=s=>document.querySelector(s);
const SPEC=[['markets','Markets'],['ecommerce','Ecommerce'],['intelligence','Intelligence'],['portfolio','Portfolio'],['orders','Orders'],['reports','Reports']];
function safeNavigate(route){try{window.RWASuperApp?.navigate?.(route,{replace:true})}catch{}}
function imp(el,p,v){if(!el)return;if(el.style.getPropertyValue(p)===v&&el.style.getPropertyPriority(p)==='important')return;el.style.setProperty(p,v,'important')}
function ownNav(){
  const nav=$('.topnav');if(!nav)return false;
  const current=[...nav.querySelectorAll(':scope > [data-rwa-target-nav]')];
  const dirty=nav.querySelector('[data-v5-route]')||current.length!==SPEC.length||SPEC.some(([key],i)=>current[i]?.dataset.rwaTargetNav!==key);
  if(dirty){nav.replaceChildren();for(const[key,text]of SPEC){const b=document.createElement('button');b.type='button';b.dataset.rwaTargetNav=key;if(key==='ecommerce')b.dataset.rwaSeablueprintCommerce='1';b.textContent=text;if(key==='ecommerce'){const n=document.createElement('span');n.className='rwa-target-new';n.textContent='NEW';b.appendChild(n)}nav.appendChild(b)}}
  for(const b of nav.querySelectorAll(':scope > [data-rwa-target-nav]')){if(b.dataset.rwaHardBound)continue;b.dataset.rwaHardBound='1';const key=b.dataset.rwaTargetNav;b.addEventListener('click',e=>{if(key==='ecommerce')return;e.preventDefault();if(key==='markets')safeNavigate('markets');else if(key==='intelligence')safeNavigate('intelligence');else if(key==='portfolio')safeNavigate('portfolio');else if(key==='orders'){try{window.RWASeablueprintCommerceBridge?.open?.('products')}catch{}}else if(key==='reports'){try{typeof window.toast==='function'&&window.toast('Reports remain evidence-gated until verified production activity exists')}catch{}}})}
  const open=document.body.classList.contains('rwa-seablueprint-commerce-open');
  nav.querySelectorAll(':scope > [data-rwa-target-nav]').forEach(b=>b.classList.toggle('active',open?b.dataset.rwaTargetNav==='ecommerce':b.dataset.rwaTargetNav==='markets'));
  return true;
}
function hideStageRail(){
  const direct=$('#rwaExperienceRail');
  if(direct){direct.dataset.rwaTargetStageRail='1';for(const[p,v]of[['display','none'],['visibility','hidden'],['pointer-events','none'],['height','0px'],['min-height','0px'],['max-height','0px']])imp(direct,p,v)}
  let chosen=null,area=Infinity;
  for(const el of document.querySelectorAll('body *')){
    if(el===direct||el.closest('.layout,#rwaSuperWorkspace,#rwaShopScreen,#rwaCartDrawer'))continue;
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();if(!text.includes('Discovery')||!text.includes('Analysis')||!text.includes('Action'))continue;
    const r=el.getBoundingClientRect();if(r.width<innerWidth*.70||r.height<14||r.height>96||r.top<30||r.top>180)continue;
    const a=r.width*r.height;if(a<area){chosen=el;area=a}
  }
  if(chosen){chosen.dataset.rwaTargetStageRail='1';imp(chosen,'display','none');imp(chosen,'visibility','hidden');imp(chosen,'pointer-events','none')}
  return !!direct||!!chosen;
}
function normalizeChrome(){
  const app=$('.app'),top=$('.topbar'),layout=$('.layout');
  if(innerWidth>1120){
    for(const[p,v]of[['top','0px'],['height','62px'],['min-height','62px'],['max-height','62px']])imp(top,p,v);
    imp(app,'padding-top','62px');
    if(layout){imp(layout,'width','100%');imp(layout,'max-width','none');imp(layout,'min-width','0');imp(layout,'margin-top','0px');imp(layout,'margin-right','0px');imp(layout,'padding-right','0px')}
  }
}
function forceCommerceGeometry(){
  const open=document.body.classList.contains('rwa-seablueprint-commerce-open'),layout=$('.layout'),left=$('.left'),main=$('.main'),right=$('.right'),dock=$('#rwaCommerceDock');
  if(!open||!layout||!dock||innerWidth<1121)return false;
  const cols=innerWidth>=1701?'286px minmax(0,1fr) 240px 440px':innerWidth>=1451?'286px minmax(0,1fr) 236px 410px':'220px minmax(0,1fr) 210px 360px';
  for(const[p,v]of[['display','grid'],['grid-template-columns',cols],['grid-auto-flow','row'],['width','100%'],['max-width','none'],['min-width','0'],['margin','0px'],['padding-right','0px'],['align-items','start']])imp(layout,p,v);
  for(const[el,col]of[[left,'1'],[main,'2'],[right,'3'],[dock,'4']]){if(!el)continue;imp(el,'grid-column',col);imp(el,'grid-row','1');imp(el,'min-width','0')}
  if(left){imp(left,'position','sticky');imp(left,'top','62px')}
  if(main){imp(main,'position','relative');imp(main,'left','auto');imp(main,'right','auto');imp(main,'width','auto');imp(main,'max-width','none');imp(main,'transform','none')}
  if(right){for(const[p,v]of[['display','block'],['position','sticky'],['top','62px'],['left','auto'],['right','auto'],['bottom','auto'],['width','auto'],['min-width','0'],['max-width','none'],['height','calc(100vh - 62px)'],['transform','none'],['translate','none'],['margin','0px'],['visibility','visible'],['pointer-events','auto']])imp(right,p,v)}
  for(const[p,v]of[['display','block'],['position','sticky'],['top','62px'],['left','auto'],['right','auto'],['bottom','auto'],['width','auto'],['min-width','0'],['max-width','none'],['height','calc(100vh - 62px)'],['transform','none'],['translate','none'],['margin','0px'],['align-self','start']])imp(dock,p,v);
  return true;
}
function normalizeMobileLaunchers(){
  if(innerWidth>1120)return;
  const commerce=$('#rwaSeablueprintCommerceLaunch'),multi=$('#rwaMultiChainLaunch'),market=$('#rwaMarketplaceLaunch');
  if(commerce&&!document.body.classList.contains('rwa-seablueprint-commerce-open')){imp(commerce,'display','inline-flex');imp(commerce,'visibility','visible');imp(commerce,'opacity','1');imp(commerce,'pointer-events','auto');imp(commerce,'position','fixed');imp(commerce,'z-index','12060')}
  if(multi&&!document.body.classList.contains('rwa-multichain-open')){imp(multi,'visibility','visible');imp(multi,'opacity','1');imp(multi,'pointer-events','auto');imp(multi,'z-index','12050')}
  if(market){imp(market,'visibility','visible');imp(market,'opacity','1');imp(market,'pointer-events','auto');imp(market,'z-index','12050')}
}
let pending=false;
function reconcile(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;ownNav();hideStageRail();normalizeChrome();normalizeMobileLaunchers();window.RWASeablueprintCommerceBridge?.reconcile?.();forceCommerceGeometry();requestAnimationFrame(()=>{hideStageRail();normalizeChrome();normalizeMobileLaunchers();forceCommerceGeometry()})})}
function boot(){
  reconcile();
  new MutationObserver(reconcile).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
  addEventListener('resize',reconcile,{passive:true});addEventListener('hashchange',reconcile,{passive:true});addEventListener('popstate',reconcile,{passive:true});
  setInterval(reconcile,300);
}
window.RWATargetDashboardV2Hardening={version:'2.0.2',reconcile,audit:()=>{const rail=$('#rwaExperienceRail'),layout=$('.layout'),right=$('.right'),dock=$('#rwaCommerceDock');const lr=layout?.getBoundingClientRect(),rr=right?.getBoundingClientRect(),dr=dock?.getBoundingClientRect();return{version:'2.0.2',railVisible:!!rail&&getComputedStyle(rail).display!=='none',layoutWidth:Math.round(lr?.width||0),viewportWidth:document.documentElement.clientWidth,orderBeforeCommerce:!dr||!rr||rr.right<=dr.left+2,dockTop:Math.round(dr?.top||0),commerceOpen:document.body.classList.contains('rwa-seablueprint-commerce-open')}}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();