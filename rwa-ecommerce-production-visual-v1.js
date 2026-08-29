(()=>{
'use strict';
if(window.RWAEcommerceProductionVisualV1)return;
const VERSION='1.7.0',STYLE_ID='rwaEcommerceProductionVisualV1Style',HIDDEN='rwa-ecom-hide-preorder-context';
function install(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
@media(min-width:681px){
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .topbar,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .topbar{
    top:0!important;height:62px!important;min-height:62px!important;max-height:62px!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .app,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .app{
    padding-top:62px!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout{
    width:100%!important;max-width:100%!important;min-width:0!important;margin-right:0!important;
    padding-right:0!important;box-sizing:border-box!important;justify-content:start!important;
    grid-template-columns:286px minmax(0,calc(100% - 962px)) 236px!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.left,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.left{
    width:auto!important;min-width:286px!important;max-width:none!important;display:flex!important;visibility:visible!important;opacity:1!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.main,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.main{
    min-width:0!important;width:auto!important;max-width:none!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.right,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.right{
    position:sticky!important;grid-column:3!important;grid-row:auto!important;
    left:auto!important;right:auto!important;bottom:auto!important;top:62px!important;inset-inline:auto!important;
    width:auto!important;min-width:236px!important;max-width:none!important;height:calc(100vh - 62px)!important;
    margin:0!important;transform:none!important;translate:none!important;
    display:block!important;visibility:visible!important;opacity:1!important;overflow:auto!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.right>.${HIDDEN},
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.right>.${HIDDEN},
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.right>.aside-label,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.right>.aside-label{
    display:none!important;visibility:hidden!important;pointer-events:none!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaSuperWorkspace,
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #suite,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaSuperWorkspace,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #suite{
    display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaMarketplaceLaunch,
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaMultiChainLaunch,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaMarketplaceLaunch,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaMultiChainLaunch{
    display:none!important;visibility:hidden!important;pointer-events:none!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .top-actions> :not(.rwa-target-inpage):not(.rwa-target-icon-actions):not(.signin),
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .top-actions> :not(.rwa-target-inpage):not(.rwa-target-icon-actions):not(.signin){
    display:none!important;visibility:hidden!important;pointer-events:none!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .top-actions,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .top-actions{gap:8px!important;overflow:visible!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaCommerceDock,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaCommerceDock{
    top:62px!important;bottom:34px!important;right:0!important;width:440px!important;min-width:440px!important;max-width:440px!important;
  }
}
@media(max-width:1400px) and (min-width:681px){
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout{
    grid-template-columns:260px minmax(0,calc(100% - 920px)) 220px!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.left,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.left{min-width:260px!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.right,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.right{min-width:220px!important}
}
@media(max-width:680px){
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaCommerceDock .rwa-ecom-cart-preview,
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaCommerceDock .rwa-target-cart-summary{
    position:static!important;inset:auto!important;bottom:auto!important;top:auto!important;left:auto!important;right:auto!important;
    transform:none!important;translate:none!important;margin-top:9px!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaCommerceDock .rwa-ecom-content{padding-bottom:24px!important}
}
`;
  document.head.appendChild(s);
}
function norm(v){return String(v||'').replace(/\s+/g,' ').trim().toUpperCase()}
function suppressPreOrderContext(){
  const right=document.querySelector('.layout>.right');if(!right)return{tagged:0,visible:0};
  const kids=[...right.children];
  let orderIndex=kids.findIndex(x=>/ORDER BOOK/.test(norm(x.textContent)));
  if(orderIndex<0)orderIndex=kids.findIndex(x=>/MARKET DEPTH/.test(norm(x.textContent)));
  let tagged=0;
  if(orderIndex>0){for(let i=0;i<orderIndex;i++){const x=kids[i],t=norm(x.textContent);if(t.includes('CONTEXT')||t.includes('AI INSIGHT')||x.matches?.('[data-rwa-context],[data-context-insight]')){if(!x.classList.contains(HIDDEN))x.classList.add(HIDDEN);tagged++}}}
  for(const x of kids){const t=norm(x.textContent);if((t.includes('CONTEXT')&&t.includes('AI INSIGHT'))&&!t.includes('ORDER BOOK')){if(!x.classList.contains(HIDDEN))x.classList.add(HIDDEN);tagged++}}
  const visibleCount=[...right.querySelectorAll(`:scope>.${HIDDEN}`)].filter(visible).length;
  return{tagged:new Set([...right.querySelectorAll(`:scope>.${HIDDEN}`)]).size||tagged,visible:visibleCount};
}
function visible(el){if(!el)return false;const c=getComputedStyle(el),r=el.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity||1)>0&&r.width>0&&r.height>0}
function rect(sel){const r=document.querySelector(sel)?.getBoundingClientRect();return r?{left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)}:null}
function intersection(a,b){if(!a||!b)return 0;return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))}
function reconcile(){install();suppressPreOrderContext()}
function audit(){
  reconcile();
  const expected=new Set(['rwa-target-inpage','rwa-target-icon-actions','signin']);
  const extras=[...document.querySelectorAll('.top-actions > *')].filter(x=>visible(x)&&![...expected].some(c=>x.classList.contains(c))).map(x=>x.id||x.className||x.tagName);
  const layout=rect('.layout'),left=rect('.layout>.left'),main=rect('.layout>.main'),order=rect('.layout>.right'),dock=rect('#rwaCommerceDock'),topbar=rect('.topbar');
  const orderEl=document.querySelector('.layout>.right'),orderStyle=orderEl?getComputedStyle(orderEl):null;
  const cart=rect('#rwaCommerceDock .rwa-ecom-cart-preview'),products=[...document.querySelectorAll('#rwaCommerceDock .rwa-ecom-product')].map(x=>{const r=x.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom}}),lastProduct=products.at(-1)||null;
  const contextNodes=['#rwaSuperWorkspace','#suite'].map(sel=>document.querySelector(sel)).filter(Boolean),contextVisible=contextNodes.filter(visible).map(x=>x.id||x.className||x.tagName),prep=suppressPreOrderContext();
  const marketDepthLabel=[...document.querySelectorAll('.layout>.right>.aside-label')].find(x=>/MARKET DEPTH/.test(norm(x.textContent))),orderDockGap=order&&dock?Math.round((dock.left-order.right)*100)/100:null,reservedDockWidth=layout&&order?Math.round((layout.right-order.right)*100)/100:null;
  return{version:VERSION,open:document.body.classList.contains('rwa-seablueprint-commerce-open'),layout,left,main,order,dock,topbar,orderPosition:orderStyle?.position||'',orderGridColumn:orderStyle?.gridColumn||'',orderDockGap,reservedDockWidth,orderVisible:!!order&&order.width>=210,orderClearOfDock:!!order&&!!dock&&order.right<=dock.left+2,preOrderContextTagged:prep.tagged,preOrderContextVisible:prep.visible>0,marketDepthLabelVisible:visible(marketDepthLabel),mobileCartOverlapPx:Math.round(intersection(cart,lastProduct)),contextVisible,contextSuppressed:contextVisible.length===0,topActionExtras:extras,marketplaceVisible:visible(document.querySelector('#rwaMarketplaceLaunch')),multichainVisible:visible(document.querySelector('#rwaMultiChainLaunch'))};
}
install();suppressPreOrderContext();new MutationObserver(()=>queueMicrotask(reconcile)).observe(document.documentElement,{subtree:true,childList:true});window.RWAEcommerceProductionVisualV1={version:VERSION,apply:reconcile,audit};
})();
