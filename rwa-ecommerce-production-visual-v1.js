(()=>{
'use strict';
if(window.RWAEcommerceProductionVisualV1)return;
const VERSION='1.5.0',STYLE_ID='rwaEcommerceProductionVisualV1Style';
function install(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
@media(min-width:681px){
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
    right:0!important;width:440px!important;min-width:440px!important;max-width:440px!important;
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
`;
  document.head.appendChild(s);
}
function visible(el){if(!el)return false;const c=getComputedStyle(el),r=el.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity||1)>0&&r.width>0&&r.height>0}
function rect(sel){const r=document.querySelector(sel)?.getBoundingClientRect();return r?{left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)}:null}
function audit(){
  const expected=new Set(['rwa-target-inpage','rwa-target-icon-actions','signin']);
  const extras=[...document.querySelectorAll('.top-actions > *')].filter(x=>visible(x)&&![...expected].some(c=>x.classList.contains(c))).map(x=>x.id||x.className||x.tagName);
  const layout=rect('.layout'),left=rect('.layout>.left'),main=rect('.layout>.main'),order=rect('.layout>.right'),dock=rect('#rwaCommerceDock');
  const orderEl=document.querySelector('.layout>.right'),orderStyle=orderEl?getComputedStyle(orderEl):null;
  const contextNodes=['#rwaSuperWorkspace','#suite'].map(sel=>document.querySelector(sel)).filter(Boolean);
  const contextVisible=contextNodes.filter(visible).map(x=>x.id||x.className||x.tagName);
  const orderDockGap=order&&dock?Math.round((dock.left-order.right)*100)/100:null;
  const reservedDockWidth=layout&&order?Math.round((layout.right-order.right)*100)/100:null;
  return{version:VERSION,open:document.body.classList.contains('rwa-seablueprint-commerce-open'),layout,left,main,order,dock,orderPosition:orderStyle?.position||'',orderGridColumn:orderStyle?.gridColumn||'',orderDockGap,reservedDockWidth,orderVisible:!!order&&order.width>=210,orderClearOfDock:!!order&&!!dock&&order.right<=dock.left+2,contextVisible,contextSuppressed:contextVisible.length===0,topActionExtras:extras,marketplaceVisible:visible(document.querySelector('#rwaMarketplaceLaunch')),multichainVisible:visible(document.querySelector('#rwaMultiChainLaunch'))};
}
install();
new MutationObserver(install).observe(document.documentElement,{subtree:true,childList:true});
window.RWAEcommerceProductionVisualV1={version:VERSION,apply:install,audit};
})();
