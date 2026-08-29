(()=>{
'use strict';
if(window.RWAEcommerceProductionVisualV1)return;
const VERSION='1.1.0',STYLE_ID='rwaEcommerceProductionVisualV1Style';
function install(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
@media(min-width:681px){
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout{
    width:100%!important;max-width:100%!important;min-width:0!important;margin-right:0!important;
    padding-right:440px!important;box-sizing:border-box!important;
    grid-template-columns:286px minmax(0,1fr) 236px!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .left,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .left{
    width:auto!important;min-width:286px!important;max-width:none!important;display:flex!important;visibility:visible!important;opacity:1!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .main,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .main{
    min-width:0!important;width:auto!important;max-width:none!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .right,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .right{
    width:auto!important;min-width:236px!important;max-width:none!important;display:block!important;visibility:visible!important;opacity:1!important;
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
    grid-template-columns:260px minmax(0,1fr) 220px!important;
  }
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .left,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .left{min-width:260px!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .right,
  html[data-rwa-level] body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .right{min-width:220px!important}
}
`;
  document.head.appendChild(s);
}
function visible(el){if(!el)return false;const c=getComputedStyle(el),r=el.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity||1)>0&&r.width>0&&r.height>0}
function rect(sel){const r=document.querySelector(sel)?.getBoundingClientRect();return r?{left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)}:null}
function audit(){
  const expected=new Set(['rwa-target-inpage','rwa-target-icon-actions','signin']);
  const extras=[...document.querySelectorAll('.top-actions > *')].filter(x=>visible(x)&&![...expected].some(c=>x.classList.contains(c))).map(x=>x.id||x.className||x.tagName);
  const layout=rect('.layout'),left=rect('.left'),main=rect('.main'),order=rect('.right'),dock=rect('#rwaCommerceDock');
  return{version:VERSION,open:document.body.classList.contains('rwa-seablueprint-commerce-open'),layout,left,main,order,dock,orderVisible:!!order&&order.width>=210,orderClearOfDock:!!order&&!!dock&&order.right<=dock.left+2,topActionExtras:extras,marketplaceVisible:visible(document.querySelector('#rwaMarketplaceLaunch')),multichainVisible:visible(document.querySelector('#rwaMultiChainLaunch'))};
}
install();
new MutationObserver(install).observe(document.documentElement,{subtree:true,childList:true});
window.RWAEcommerceProductionVisualV1={version:VERSION,apply:install,audit};
})();
