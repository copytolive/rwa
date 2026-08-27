(()=>{
'use strict';
if(window.RWAPersistentMarketWorkspaces?.version==='1.0.0')return;
const ROOT='/rwa/';
const persistentRoots=new Set(['intelligence','assets','research','portfolio','institutional','asset']);
const $=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
const clean=s=>String(s||'').replace(/^#+/,'').replace(/^\/+/, '').trim()||'markets';
const rootOf=r=>clean(r).split('/')[0].toLowerCase();
const selected=()=>String(document.getElementById('selName')?.textContent||'BTC / USDT').split(/[\/\s-]/)[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase()||'BTC';
let originalNavigate=null,ready=false,opening=false,lastPersistent='';

function canonicalFor(route){return `markets/${clean(route)}`}
function hashRoute(){return clean(location.hash)}
function routeFromCanonical(raw=hashRoute()){
  const r=clean(raw),parts=r.split('/');
  if(parts[0]==='markets'&&parts.length>1&&persistentRoots.has((parts[1]||'').toLowerCase()))return parts.slice(1).join('/');
  if(persistentRoots.has((parts[0]||'').toLowerCase()))return r;
  return'';
}
function setHashCanonical(route,{replace=false}={}){
  const h='#'+canonicalFor(route),url=`${location.pathname}${location.search}${h}`;
  try{history[replace?'replaceState':'pushState']({rwaRoute:canonicalFor(route),persistentMarket:true},'',url)}catch{location.hash=h}
}
function labelFor(route){
  const r=rootOf(route),map={intelligence:'Intelligence',assets:'Assets',research:'Research',portfolio:'Portfolio',institutional:'Institutional',asset:`${selected()} Asset`};return map[r]||'Workspace';
}
function setActive(route){
  const r=rootOf(route);
  qa('[data-v5-route]').forEach(el=>el.classList.toggle('active',el.dataset.v5Route===r));
  qa('[data-v5-mobile]').forEach(el=>el.classList.toggle('active',r==='portfolio'&&el.dataset.v5Mobile==='portfolio'));
  document.documentElement.dataset.rwaPersistentWorkspace=r;
}
function restoreMarketGeometry(){
  document.body.classList.add('rwa-persistent-market');
  document.body.classList.remove('rwa-super-market-open');
  const layout=$('.layout');if(layout){layout.style.removeProperty('display');layout.hidden=false}
}
function controlsHost(){
  if(document.body.classList.contains('rwa-persistent-suite'))return $('#suite');
  return $('#rwaSuperWorkspace');
}
function installControls(route){
  const host=controlsHost();if(!host)return;
  let bar=host.querySelector(':scope > .rwa-pm-controls');
  if(!bar){
    bar=document.createElement('div');bar.className='rwa-pm-controls';
    bar.innerHTML='<div><small>MARKET CONTEXT</small><b data-rwa-pm-title>Workspace</b></div><span><button type="button" data-rwa-pm-expand aria-label="Expand workspace">Expand</button><button type="button" data-rwa-pm-close>Markets</button></span>';
    host.insertBefore(bar,host.firstChild);
    bar.querySelector('[data-rwa-pm-close]').addEventListener('click',()=>window.RWASuperApp?.navigate?.('markets'));
    bar.querySelector('[data-rwa-pm-expand]').addEventListener('click',()=>{document.body.classList.toggle('rwa-persistent-expanded');const b=bar.querySelector('[data-rwa-pm-expand]');if(b)b.textContent=document.body.classList.contains('rwa-persistent-expanded')?'Compact':'Expand'});
  }
  const title=bar.querySelector('[data-rwa-pm-title]');if(title)title.textContent=labelFor(route);
}
function activate(route){
  const r=rootOf(route),suite=r==='portfolio';
  restoreMarketGeometry();
  document.body.classList.toggle('rwa-persistent-suite',suite);
  document.body.classList.toggle('rwa-persistent-institutional',r==='institutional');
  document.body.classList.add('rwa-super-market-open');
  if(!suite){
    const w=$('#rwaSuperWorkspace');if(w){w.hidden=false;w.style.removeProperty('display')}
  }else{
    const s=$('#suite');if(s)s.style.display='block';
  }
  setActive(route);installControls(route);lastPersistent=route;
  const label=document.getElementById('rwaWorkspaceLabel');if(label)label.textContent=labelFor(route);
  window.dispatchEvent(new CustomEvent('rwa:persistent-workspace',{detail:{route,root:r,symbol:selected()}}));
}
function deactivate(){
  document.body.classList.remove('rwa-persistent-market','rwa-persistent-suite','rwa-persistent-expanded','rwa-persistent-institutional');
  document.documentElement.removeAttribute('data-rwa-persistent-workspace');
  lastPersistent='';
}
function renderPersistent(route,{replace=false}={}){
  if(!originalNavigate||opening)return;
  const cleanRoute=clean(route),r=rootOf(cleanRoute);if(!persistentRoots.has(r))return;
  opening=true;
  const y=window.scrollY;
  try{
    setHashCanonical(cleanRoute,{replace});
    originalNavigate(cleanRoute,{replace:true});
    history.replaceState({rwaRoute:canonicalFor(cleanRoute),persistentMarket:true},'',`${location.pathname}${location.search}#${canonicalFor(cleanRoute)}`);
    setTimeout(()=>{activate(cleanRoute);window.scrollTo({top:y,behavior:'auto'});opening=false},r==='portfolio'?120:20);
  }catch(e){opening=false;console.error('Persistent market workspace failed',e)}
}
function wrappedNavigate(route,opts={}){
  const r=clean(route),root=rootOf(r);
  if(persistentRoots.has(root)){renderPersistent(r,{replace:!!opts?.replace});return}
  deactivate();return originalNavigate(r,opts);
}
function remapPublicAPI(){
  const api=window.RWASuperApp;if(!api||typeof api.navigate!=='function')return false;
  if(!originalNavigate)originalNavigate=api.navigate.bind(api);
  api.navigate=wrappedNavigate;
  api.marketShellPersistent=true;
  api.persistentWorkspace=()=>lastPersistent;
  api.closeWorkspace=()=>wrappedNavigate('markets');
  if(api.openAsset)api.openAsset=(base)=>wrappedNavigate(`asset/${String(base||selected()).toUpperCase()}`);
  if(api.openResearch)api.openResearch=(tool='')=>wrappedNavigate(tool?`research/${tool}/${selected()}`:'research');
  const p=window.RWAProductOS;if(p){p.navigate=wrappedNavigate;p.openIntelligence=()=>wrappedNavigate('intelligence');p.openAssets=()=>wrappedNavigate('assets');p.openResearch=(tool='')=>wrappedNavigate(tool?`research/${tool}/${selected()}`:'research');p.openPortfolio=()=>wrappedNavigate('portfolio');p.openInstitutional=()=>wrappedNavigate('institutional');p.openAsset=(base)=>wrappedNavigate(`asset/${String(base||selected()).toUpperCase()}`)}
  return true;
}
function interceptPersistentClicks(e){
  const routeEl=e.target.closest?.('[data-v5-route]');
  if(routeEl&&persistentRoots.has(rootOf(routeEl.dataset.v5Route))){e.preventDefault();e.stopImmediatePropagation();wrappedNavigate(routeEl.dataset.v5Route);return}
  const pair=e.target.closest?.('.pairrow[data-sym]');
  if(pair){const base=String(pair.dataset.sym||'').replace(/USDT$/i,'');if(base){e.preventDefault();e.stopImmediatePropagation();wrappedNavigate(`asset/${base}`);return}}
  const openAsset=e.target.closest?.('[data-open-asset]');
  if(openAsset){const base=openAsset.dataset.openAsset;if(base){e.preventDefault();e.stopImmediatePropagation();wrappedNavigate(`asset/${base}`);return}}
  const market=e.target.closest?.('[data-open-market]');
  if(market){const base=String(market.dataset.openMarket||'').toUpperCase();if(base){e.preventDefault();e.stopImmediatePropagation();try{window.selectPair?.(`${base}USDT`,false)}catch{};const r=lastPersistent||'assets';setTimeout(()=>activate(r),0);return}}
  const action=e.target.closest?.('[data-v5-action="research"],[data-p20-action="research"]');
  if(action){e.preventDefault();e.stopImmediatePropagation();wrappedNavigate(`research/compare/${selected()}`);return}
  const command=e.target.closest?.('[data-command-index]');
  if(command){const text=(command.textContent||'').trim().toLowerCase();const map=[['intelligence','intelligence'],['assets','assets'],['research','research'],['portfolio','portfolio'],['institutional','institutional']];const hit=map.find(([label])=>text.startsWith(label));if(hit){e.preventDefault();e.stopImmediatePropagation();document.getElementById('rwaSuperCommand')?.setAttribute('hidden','');wrappedNavigate(hit[1]);return}}
  const issuer=e.target.closest?.('button');
  if(issuer&&/start issuer workspace/i.test(issuer.textContent||'')){setTimeout(()=>{restoreMarketGeometry();document.body.classList.add('rwa-persistent-suite','rwa-persistent-expanded');installControls('institutional');},120)}
}
function syncLocation(){
  if(opening)return;
  const raw=hashRoute(),persist=routeFromCanonical(raw);
  if(persist){renderPersistent(persist,{replace:true});return}
  if(rootOf(raw)==='markets')deactivate();
}
function patchNavSemantics(){
  qa('[data-v5-route]').forEach(el=>{const r=clean(el.dataset.v5Route);if(persistentRoots.has(rootOf(r)))el.setAttribute('aria-controls','rwaSuperWorkspace')});
}
function boot(){
  if(ready)return;
  if(!remapPublicAPI())return;
  ready=true;patchNavSemantics();
  window.addEventListener('click',interceptPersistentClicks,true);
  window.addEventListener('hashchange',()=>setTimeout(syncLocation,0));
  window.addEventListener('popstate',()=>setTimeout(syncLocation,0));
  new MutationObserver(()=>{patchNavSemantics();if(lastPersistent)installControls(lastPersistent)}).observe(document.body,{childList:true,subtree:true});
  window.RWAPersistentMarketWorkspaces={version:'1.0.0',ready:true,canonicalPrefix:'#markets/',open:wrappedNavigate,close:()=>wrappedNavigate('markets'),current:()=>lastPersistent,marketShellPersistent:true};
  syncLocation();
}
function wait(){if(window.RWASuperApp?.version==='5.0.0')boot();else setTimeout(wait,35)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wait,{once:true});else wait();
window.addEventListener('rwa:product-os-ready',wait,{once:true});
})();
