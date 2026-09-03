(()=>{
'use strict';
if(window.RWAPersistentMarketRouterV2?.version==='2.0.0')return;
const ROOTS=new Set(['intelligence','assets','research','portfolio','institutional','asset']);
const clean=s=>String(s||'').replace(/^#+/,'').replace(/^\/+/, '').trim()||'markets';
const rootOf=r=>clean(r).split('/')[0].toLowerCase();
const canonical=r=>`markets/${clean(r)}`;
const currentHash=()=>clean(location.hash);
const selected=()=>String(document.getElementById('selName')?.textContent||'BTC / USDT').split(/[\/\s-]/)[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase()||'BTC';
let api=null,originalNavigate=null,booted=false,renderingPop=false,last='';

function keepMarketVisible(){
  document.body.classList.add('rwa-persistent-market','rwa-super-market-open');
  document.body.classList.remove('rwa-home-open','social-open','market-drawer-open');
  const layout=document.querySelector('.layout');
  if(layout){layout.hidden=false;layout.style.setProperty('display','grid','important');layout.style.setProperty('visibility','visible','important');layout.style.setProperty('opacity','1','important')}
}
function normalizeRoute(raw){
  const r=clean(raw),p=r.split('/');
  if(p[0]==='markets'&&p.length>1&&ROOTS.has((p[1]||'').toLowerCase()))return p.slice(1).join('/');
  return r;
}
function writeCanonical(route,{replace=false}={}){
  const h='#'+canonical(route),url=`${location.pathname}${location.search}${h}`;
  if(location.hash===h)return;
  history[replace?'replaceState':'pushState']({rwaRoute:canonical(route),persistentMarket:true},'',url);
}
function activateShell(route){
  keepMarketVisible();
  const root=rootOf(route);
  document.body.classList.toggle('rwa-persistent-suite',root==='portfolio');
  document.body.classList.toggle('rwa-persistent-institutional',root==='institutional');
  document.documentElement.dataset.rwaPersistentWorkspace=root;
  last=route;
  const w=document.getElementById('rwaSuperWorkspace');
  const s=document.getElementById('suite');
  if(root==='portfolio'){
    if(s)s.style.setProperty('display','block','important');
  }else if(w){
    w.hidden=false;w.style.setProperty('display','block','important');
  }
}
function render(route,{fromPop=false}={}){
  const r=normalizeRoute(route),root=rootOf(r);
  if(!ROOTS.has(root))return false;
  keepMarketVisible();
  // Important: core route render is invoked with replace semantics, so it never creates a second history entry.
  originalNavigate(r,{replace:true});
  // Core renderer may toggle market visibility while constructing the workspace. Restore synchronously and once again next frame.
  activateShell(r);
  requestAnimationFrame(()=>activateShell(r));
  if(!fromPop)writeCanonical(r,{replace:true});
  return true;
}
function navigate(route,opts={}){
  const r=normalizeRoute(route),root=rootOf(r);
  if(ROOTS.has(root)){
    if(!opts?.replace)writeCanonical(r,{replace:false});
    else writeCanonical(r,{replace:true});
    return render(r,{fromPop:false});
  }
  last='';
  document.body.classList.remove('rwa-persistent-market','rwa-persistent-suite','rwa-persistent-expanded','rwa-persistent-institutional');
  document.documentElement.removeAttribute('data-rwa-persistent-workspace');
  return originalNavigate(r,opts);
}
function onHistory(){
  if(renderingPop)return;
  const raw=currentHash();
  const r=normalizeRoute(raw),root=rootOf(r);
  if(!ROOTS.has(root))return;
  renderingPop=true;
  try{render(r,{fromPop:true})}finally{setTimeout(()=>{renderingPop=false},0)}
}
function patch(){
  api=window.RWASuperApp;
  if(!api||typeof api.navigate!=='function')return false;
  if(api.__persistentRouterV2)return true;
  originalNavigate=api.navigate.bind(api);
  api.navigate=navigate;
  api.__persistentRouterV2=true;
  api.marketShellPersistent=true;
  api.persistentWorkspace=()=>last;
  api.closeWorkspace=()=>navigate('markets');
  const p=window.RWAProductOS;
  if(p){
    p.navigate=navigate;
    p.openIntelligence=()=>navigate('intelligence');
    p.openAssets=()=>navigate('assets');
    p.openResearch=(tool='')=>navigate(tool?`research/${tool}/${selected()}`:'research');
    p.openPortfolio=()=>navigate('portfolio');
    p.openInstitutional=()=>navigate('institutional');
    p.openAsset=(base)=>navigate(`asset/${String(base||selected()).toUpperCase()}`);
  }
  return true;
}
function intercept(e){
  const r=e.target.closest?.('[data-v5-route]')?.dataset?.v5Route;
  if(r&&ROOTS.has(rootOf(r))){e.preventDefault();e.stopImmediatePropagation();navigate(r);return}
  const pair=e.target.closest?.('.pairrow[data-sym]');
  if(pair){const base=String(pair.dataset.sym||'').replace(/USDT$/i,'');if(base){e.preventDefault();e.stopImmediatePropagation();navigate(`asset/${base}`);return}}
  const asset=e.target.closest?.('[data-open-asset]')?.dataset?.openAsset;
  if(asset){e.preventDefault();e.stopImmediatePropagation();navigate(`asset/${asset}`);return}
}
function boot(){
  if(booted)return;
  if(!patch())return setTimeout(boot,30);
  booted=true;
  // Capture before legacy click handlers.
  window.addEventListener('click',intercept,true);
  window.addEventListener('popstate',()=>setTimeout(onHistory,0));
  window.addEventListener('hashchange',()=>setTimeout(onHistory,0));
  const raw=currentHash();if(ROOTS.has(rootOf(normalizeRoute(raw))))onHistory();
  window.RWAPersistentMarketRouterV2={version:'2.0.0',navigate,current:()=>last,marketShellPersistent:true};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('rwa:product-os-ready',boot,{once:true});
})();
