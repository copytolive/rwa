(()=>{
'use strict';
if(window.RWAUILayoutIntegrity?.version==='15.0.0')return;
const $=s=>document.querySelector(s);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let patchedSuper=false,patchedFund=false,reconciling=false;
function selected(){const t=$('#selName')?.textContent||'BTC / USDT';return String(t).split(/[\/\s-]/)[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase()||'BTC'}
function isWorkspaceOpen(){const w=$('#rwaSuperWorkspace');return !!(document.body.classList.contains('rwa-super-workspace-open')&&w&&!w.hidden)}
function isFundOpen(){const f=$('#rwaFundamentals');return !!(document.body.classList.contains('rwa-fundamentals-open')&&f?.classList.contains('open'))}
function mountMarketplace(){
  const host=$('.top-actions');if(!host)return false;
  let b=$('#rwaMarketplaceLaunch');
  if(!b){b=document.createElement('button');b.id='rwaMarketplaceLaunch';b.type='button';b.className='rwa-marketplace-launch';b.setAttribute('aria-label','Open RWA Asset Marketplace');b.innerHTML='<span class="rwa-marketplace-mark">◇</span><span class="rwa-marketplace-label">MARKETPLACE</span>';const anchor=$('#rwaMultiChainLaunch')||host.querySelector('.signin');host.insertBefore(b,anchor||null);b.addEventListener('click',()=>{try{window.RWAFundamentals?.close?.()}catch{};try{window.RWAMultiChain?.close?.()}catch{};window.RWASuperApp?.navigate?.('assets')})}
  const r=String(window.RWASuperApp?.route?.()||location.hash||'');b.classList.toggle('active',/(^|#|\/)assets(?:\/|$)/i.test(r));return true
}
async function prepareFundamentals(){
  if(!isWorkspaceOpen())return;
  try{window.RWASuperApp?.navigate?.('markets')}catch{}
  for(let i=0;i<20&&isWorkspaceOpen();i++)await wait(20);
  if(isWorkspaceOpen()){const w=$('#rwaSuperWorkspace');if(w)w.hidden=true;document.body.classList.remove('rwa-super-workspace-open','rwa-super-asset-workspace')}
}
function patchSuper(){
  const api=window.RWASuperApp;if(!api||patchedSuper)return false;const nav=api.navigate?.bind(api);if(typeof nav!=='function')return false;
  api.navigate=(route,...rest)=>{try{window.RWAFundamentals?.close?.()}catch{};const out=nav(route,...rest);queueMicrotask(mountMarketplace);return out};patchedSuper=true;mountMarketplace();return true
}
function patchFundamentals(){
  const api=window.RWAFundamentals;if(!api||patchedFund)return false;const open=api.open?.bind(api),openAsset=api.openAsset?.bind(api);if(typeof open!=='function')return false;
  api.open=async(...args)=>{await prepareFundamentals();return open(...args)};
  if(typeof openAsset==='function')api.openAsset=async(...args)=>{await prepareFundamentals();return openAsset(...args)};
  patchedFund=true;return true
}
function reconcile(){
  if(reconciling)return;reconciling=true;try{mountMarketplace();patchSuper();patchFundamentals();if(isWorkspaceOpen()&&isFundOpen()){try{window.RWAFundamentals?.close?.()}catch{const f=$('#rwaFundamentals');f?.classList.remove('open');document.body.classList.remove('rwa-fundamentals-open')}}}finally{reconciling=false}
}
function visible(el){if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>1&&r.height>1}
function intersection(a,b){if(!a||!b)return 0;const x=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),y=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));return x*y}
function audit(){
  const market=$('#rwaMarketplaceLaunch'),workspace=$('#rwaSuperWorkspace'),fund=$('#rwaFundamentals'),wr=visible(workspace)?workspace.getBoundingClientRect():null,fr=visible(fund)&&fund.classList.contains('open')?fund.getBoundingClientRect():null,root=document.documentElement;
  const findings=[];if(!visible(market))findings.push('MARKETPLACE_NOT_VISIBLE');if(isWorkspaceOpen()&&isFundOpen())findings.push('MULTIPLE_CONTEXT_SURFACES');if(intersection(wr,fr)>4)findings.push('CONTEXT_OVERLAP');if(root.scrollWidth-root.clientWidth>4)findings.push('ROOT_HORIZONTAL_OVERFLOW');const top=$('.topbar')?.getBoundingClientRect();if(top&&(top.right>innerWidth+2||top.left<-2))findings.push('TOPBAR_OUT_OF_VIEWPORT');
  return{ok:findings.length===0,version:'15.0.0',route:window.RWASuperApp?.route?.()||location.hash,marketplaceVisible:visible(market),workspaceOpen:isWorkspaceOpen(),fundamentalsOpen:isFundOpen(),contextOverlapPx:Math.round(intersection(wr,fr)),horizontalOverflowPx:Math.max(0,root.scrollWidth-root.clientWidth),findings};
}
function boot(){
  if(!$('#rwaUILayoutIntegrityStyle')){const l=document.createElement('link');l.id='rwaUILayoutIntegrityStyle';l.rel='stylesheet';l.href='ui-layout-integrity-v15.css?v=15';document.head.appendChild(l)}
  reconcile();const mo=new MutationObserver(()=>queueMicrotask(reconcile));mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
  addEventListener('hashchange',()=>setTimeout(reconcile,0));addEventListener('resize',()=>setTimeout(reconcile,0),{passive:true});addEventListener('rwa:product-os-ready',reconcile);let tries=0;const t=setInterval(()=>{tries++;reconcile();if(patchedSuper&&tries>40)clearInterval(t)},100);
}
window.RWAUILayoutIntegrity={version:'15.0.0',audit,reconcile,openMarketplace:()=>window.RWASuperApp?.navigate?.('assets'),selected};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
