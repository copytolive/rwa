(()=>{
'use strict';
if(window.RWAUILayoutIntegrity?.version==='16.2.0')return;
const $=s=>document.querySelector(s);
let patchedSuper=false,patchedFund=false,reconciling=false,suppressRestore=false,returnRoute='',fundOpening=0;
function selected(){const t=$('#selName')?.textContent||'BTC / USDT';return String(t).split(/[\/\s-]/)[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase()||'BTC'}
function route(){return String(window.RWASuperApp?.route?.()||location.hash||'markets').replace(/^#/,'')||'markets'}
function targetChrome(){return !!document.body?.classList.contains('rwa-target-dashboard-v2')}
function isWorkspaceRoute(r=route()){return /^(asset(?:\/|$)|assets$|intelligence$|research(?:\/|$)|institutional$)/i.test(String(r))}
function isWorkspaceOpen(){const w=$('#rwaSuperWorkspace'),s=w?getComputedStyle(w):null;return !!(document.body.classList.contains('rwa-super-workspace-open')&&w&&!w.hidden&&s?.display!=='none'&&s?.visibility!=='hidden')}
function isFundOpen(){const f=$('#rwaFundamentals');return !!(document.body.classList.contains('rwa-fundamentals-open')&&f?.classList.contains('open'))}
function pxVar(name){const n=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));return Number.isFinite(n)?n:0}
function fixedViewportRight(){const b=document.body?.clientWidth||0,d=document.documentElement?.clientWidth||0;return b>0&&b<=d?b:d||innerWidth}
function dockWidth(){return innerWidth>=1200?(pxVar('--rwa-context-panel')||440):(pxVar('--rwa-context-w')||Math.min(420,Math.max(390,innerWidth*.31)))}
function mountMarketplace(){
  if(targetChrome()){const old=$('#rwaMarketplaceLaunch');if(old)old.remove();return true}
  const host=$('.top-actions');if(!host)return false;
  let b=$('#rwaMarketplaceLaunch');
  if(!b){b=document.createElement('button');b.id='rwaMarketplaceLaunch';b.type='button';b.className='rwa-marketplace-launch';b.setAttribute('aria-label','Open RWA Asset Marketplace');b.innerHTML='<span class="rwa-marketplace-mark">◇</span><span class="rwa-marketplace-label">MARKETPLACE</span>';const anchor=$('#rwaMultiChainLaunch')||host.querySelector('.signin');host.insertBefore(b,anchor||null);b.addEventListener('click',()=>{try{suppressRestore=true;window.RWAFundamentals?.close?.()}catch{}finally{suppressRestore=false;returnRoute=''};try{window.RWAMultiChain?.close?.()}catch{};window.RWASuperApp?.navigate?.('assets')})}
  const r=route();b.classList.toggle('active',/(^|\/)assets(?:\/|$)/i.test(r));return true
}
function suspendWorkspace(){const w=$('#rwaSuperWorkspace');if(!w)return;w.hidden=true;w.style.setProperty('display','none','important');w.style.setProperty('visibility','hidden','important');w.style.setProperty('pointer-events','none','important');document.body.classList.remove('rwa-super-workspace-open','rwa-super-asset-workspace')}
function releaseWorkspaceStyles(){const w=$('#rwaSuperWorkspace');if(!w)return;w.style.removeProperty('display');w.style.removeProperty('visibility');w.style.removeProperty('pointer-events')}
function clearFundGeometry(f){for(const p of ['position','left','right','top','bottom','width','min-width','max-width','height','margin','transform','translate'])f.style.removeProperty(p)}
function pinFundToCanonicalRail(f){
  if(innerWidth<=680){clearFundGeometry(f);return}
  const width=innerWidth>=1200?dockWidth():Math.min(dockWidth(),Math.max(0,fixedViewportRight()-(innerWidth<=900?210:0)));
  const rightEdge=fixedViewportRight();
  const left=Math.max(0,rightEdge-width);
  const top=94,bottom=34,height=Math.max(0,innerHeight-top-bottom);
  f.style.setProperty('position','fixed','important');
  f.style.setProperty('left',`${left}px`,'important');
  f.style.setProperty('right','auto','important');
  f.style.setProperty('top',`${top}px`,'important');
  f.style.setProperty('bottom','auto','important');
  f.style.setProperty('width',`${width}px`,'important');
  f.style.setProperty('min-width',`${width}px`,'important');
  f.style.setProperty('max-width',`${width}px`,'important');
  f.style.setProperty('height',`${height}px`,'important');
  f.style.setProperty('margin','0','important');
  f.style.setProperty('transform','none','important');
  f.style.setProperty('translate','none','important');
}
function syncFundVisual(){const f=$('#rwaFundamentals');if(!f)return;const open=isFundOpen();if(open){suspendWorkspace();pinFundToCanonicalRail(f);f.style.setProperty('visibility','visible','important');f.style.setProperty('pointer-events','auto','important')}else{clearFundGeometry(f);f.style.setProperty('visibility','hidden','important');f.style.setProperty('pointer-events','none','important')}}
function syncLegacyRight(){const r=$('.right');if(!r)return;if(isFundOpen())r.style.setProperty('display','none','important');else r.style.removeProperty('display')}
function prepareFundamentals(){if(!returnRoute)returnRoute=route();suspendWorkspace()}
function restoreContext(){const r=returnRoute;returnRoute='';releaseWorkspaceStyles();if(!suppressRestore&&isWorkspaceRoute(r)){queueMicrotask(()=>{try{window.RWASuperApp?.navigate?.(r,{replace:true})}catch{}})}}
function closeForNavigation(){if(!isFundOpen())return;const prev=suppressRestore;suppressRestore=true;returnRoute='';try{window.RWAFundamentals?.close?.()}catch{}finally{suppressRestore=prev}releaseWorkspaceStyles()}
function patchSuper(){
  const api=window.RWASuperApp;if(!api||patchedSuper)return false;const nav=api.navigate?.bind(api);if(typeof nav!=='function')return false;
  api.navigate=(next,...rest)=>{closeForNavigation();const out=nav(next,...rest);queueMicrotask(()=>{mountMarketplace();syncFundVisual();syncLegacyRight()});return out};patchedSuper=true;mountMarketplace();return true
}
function wrapFundOpen(fn){return async(...args)=>{fundOpening++;try{prepareFundamentals();const out=await fn(...args);suspendWorkspace();syncFundVisual();syncLegacyRight();return out}finally{fundOpening=Math.max(0,fundOpening-1);queueMicrotask(reconcile)}}}
function patchFundamentals(){
  const api=window.RWAFundamentals;if(!api||patchedFund)return false;const open=api.open?.bind(api),openAsset=api.openAsset?.bind(api),close=api.close?.bind(api);if(typeof open!=='function')return false;
  api.open=wrapFundOpen(open);
  if(typeof openAsset==='function')api.openAsset=wrapFundOpen(openAsset);
  if(typeof close==='function')api.close=(...args)=>{const out=close(...args);queueMicrotask(()=>{syncFundVisual();syncLegacyRight();if(!suppressRestore&&fundOpening===0)restoreContext();else releaseWorkspaceStyles()});return out};
  patchedFund=true;return true
}
function reconcile(){
  if(reconciling)return;reconciling=true;try{mountMarketplace();patchSuper();patchFundamentals();const fundOpen=isFundOpen();if(fundOpen)suspendWorkspace();syncFundVisual();syncLegacyRight();if(!fundOpen&&returnRoute&&!suppressRestore&&fundOpening===0)restoreContext()}finally{reconciling=false}
}
function visible(el){if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>1&&r.height>1}
function intersection(a,b){if(!a||!b)return 0;const x=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),y=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));return x*y}
function audit(){
  const market=$('#rwaMarketplaceLaunch'),workspace=$('#rwaSuperWorkspace'),fund=$('#rwaFundamentals'),workspaceOpen=isWorkspaceOpen(),fundOpen=isFundOpen(),wr=visible(workspace)?workspace.getBoundingClientRect():null,fr=visible(fund)&&fund.classList.contains('open')?fund.getBoundingClientRect():null,root=document.documentElement,activeRect=fundOpen?fr:workspaceOpen?wr:null,isTarget=targetChrome();
  const expected=innerWidth>=1200?(pxVar('--rwa-context-panel')||440):(pxVar('--rwa-context-w')||0),viewportRight=fixedViewportRight(),stale=[...document.querySelectorAll('[data-v5-action="legacy-fundamentals"]')].some(visible),findings=[];
  if(isTarget&&visible(market))findings.push('LEGACY_MARKETPLACE_VISIBLE');if(!isTarget&&!visible(market)&&!workspaceOpen&&!fundOpen)findings.push('MARKETPLACE_NOT_VISIBLE');if(workspaceOpen&&fundOpen)findings.push('MULTIPLE_CONTEXT_SURFACES');if(intersection(wr,fr)>4)findings.push('CONTEXT_OVERLAP');if(root.scrollWidth-root.clientWidth>4)findings.push('ROOT_HORIZONTAL_OVERFLOW');if(fundOpen&&stale)findings.push('STALE_FUNDAMENTALS_LAUNCHER');if(activeRect&&expected&&Math.abs(activeRect.width-expected)>2)findings.push('CONTEXT_WIDTH_MISMATCH');if(activeRect&&Math.abs(activeRect.right-viewportRight)>2)findings.push('CONTEXT_RIGHT_EDGE_MISMATCH');const top=$('.topbar')?.getBoundingClientRect();if(top&&(top.right>Math.max(root.clientWidth,viewportRight)+2||top.left<-2))findings.push('TOPBAR_OUT_OF_VIEWPORT');
  return{ok:findings.length===0,version:'16.2.0',route:route(),marketplaceVisible:visible(market),workspaceOpen,fundamentalsOpen:fundOpen,contextWidthPx:activeRect?Math.round(activeRect.width*100)/100:0,expectedContextWidthPx:expected,contextRightPx:activeRect?Math.round(activeRect.right*100)/100:0,viewportRightPx:viewportRight,staleFundamentalsLauncherVisible:stale,contextOverlapPx:Math.round(intersection(wr,fr)),horizontalOverflowPx:Math.max(0,root.scrollWidth-root.clientWidth),fundOpening,findings};
}
function boot(){
  let l=$('#rwaUILayoutIntegrityStyle');if(!l){l=document.createElement('link');l.id='rwaUILayoutIntegrityStyle';l.rel='stylesheet';document.head.appendChild(l)}l.href='ui-layout-integrity-v15.css?v=16.2';
  reconcile();const mo=new MutationObserver(()=>queueMicrotask(reconcile));mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
  addEventListener('hashchange',()=>setTimeout(reconcile,0));addEventListener('resize',()=>setTimeout(reconcile,0),{passive:true});addEventListener('rwa:product-os-ready',reconcile);let tries=0;const t=setInterval(()=>{tries++;reconcile();if(patchedSuper&&patchedFund&&tries>40)clearInterval(t)},100);
}
window.RWAUILayoutIntegrity={version:'16.2.0',audit,reconcile,openMarketplace:()=>window.RWASuperApp?.navigate?.('assets'),selected};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
