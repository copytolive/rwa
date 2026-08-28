(()=>{
'use strict';
if(window.RWASeablueprintCommerceBridge)return;
const VERSION='1.0.0';
const CONFIG='rwa-commerce-config.json';
const state={rootPath:location.pathname,config:null,opening:false,storefrontLoaded:false,liveLoaded:false};
const $=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
function toast(msg){try{if(typeof window.toast==='function')window.toast(msg);else console.info(msg)}catch{}}
function samePath(){return location.pathname===state.rootPath}
function loadStyle(src,key){if(document.querySelector(`link[data-rwa-seablueprint-style="${key}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=src;l.dataset.rwaSeablueprintStyle=key;document.head.appendChild(l)}
function loadScript(src,key){
  const found=document.querySelector(`script[data-rwa-seablueprint-script="${key}"]`);if(found)return found.dataset.loaded==='1'?Promise.resolve():new Promise((res,rej)=>{found.addEventListener('load',res,{once:true});found.addEventListener('error',rej,{once:true})});
  return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.async=false;s.dataset.rwaSeablueprintScript=key;s.onload=()=>{s.dataset.loaded='1';res()};s.onerror=()=>rej(Error(`Unable to load ${key}`));document.head.appendChild(s)});
}
async function config(){
  if(state.config)return state.config;
  try{const r=await fetch(`${CONFIG}?v=${Date.now()}`,{cache:'no-store'});state.config=r.ok?await r.json():{}}catch{state.config={}}
  return state.config;
}
function mountLauncher(){
  const host=$('.top-actions');if(!host)return false;
  let b=$('#rwaSeablueprintCommerceLaunch');
  if(!b){b=document.createElement('button');b.id='rwaSeablueprintCommerceLaunch';b.type='button';b.className='rwa-seablueprint-commerce-launch';b.dataset.rwaSeablueprintCommerce='1';b.setAttribute('aria-label','Open Seablueprint ecommerce inside RWA');b.setAttribute('aria-haspopup','dialog');b.innerHTML='<span class="rwa-seablueprint-commerce-mark">S</span><span class="rwa-seablueprint-commerce-label">ECOMMERCE</span>';const anchor=$('#rwaMarketplaceLaunch')||$('#rwaMultiChainLaunch')||host.querySelector('.signin');host.insertBefore(b,anchor||null)}
  return true;
}
function restoreSingleShell(){
  if(samePath())return;
  try{history.replaceState(history.state,'',`${state.rootPath}${location.search}${location.hash||''}`)}catch{}
}
function decorate(){
  const screen=$('#rwaShopScreen');if(!screen)return;
  screen.dataset.seablueprintSingleShell='1';
  const brand=screen.querySelector('.rwa-shop-brand b');if(brand)brand.textContent='Seablueprint Ecommerce';
  const small=screen.querySelector('.rwa-shop-brand small');if(small)small.textContent='RWA × SEABLUEPRINT · SINGLE SHELL';
  const body=$('#rwaShopBody');
  if(body&&!body.querySelector('[data-seablueprint-source]')){const strip=document.createElement('div');strip.className='rwa-seablueprint-source';strip.dataset.seablueprintSource='1';const live=!!String(state.config?.api_base||'').trim();strip.innerHTML=`<div><b>SEABLUEPRINT COMMERCE</b><span>Runs inside this RWA page — no ecommerce page navigation.</span></div><span class="${live?'live':'locked'}">${live?'LIVE BACKEND':'BACKEND LOCKED'}</span>`;body.prepend(strip)}
  qa('[data-rwa-shop]').forEach(x=>{x.dataset.seablueprintManaged='1';if(x.closest('.topnav'))x.textContent='Ecommerce';if(x.closest('.product-nav'))x.textContent='Physical Ecommerce'});
  qa('[data-rwa-command]').forEach(x=>{x.hidden=true;x.setAttribute('aria-hidden','true')});
  const cmd=$('#rwaCommandOpen');if(cmd){cmd.hidden=true;cmd.setAttribute('aria-hidden','true')}
  qa('#rwaShopScreen a[href]').forEach(a=>{a.removeAttribute('target');a.removeAttribute('rel')});
  restoreSingleShell();
}
async function ensureRuntime(){
  loadStyle('rwa-seablueprint-commerce-bridge.css?v=1','bridge');
  if(!window.RWAStorefront){await loadScript('rwa-storefront.js?v=2','storefront')}
  state.storefrontLoaded=!!window.RWAStorefront;
  const cfg=await config();
  if(String(cfg?.api_base||'').trim()){
    if(!window.RWACommerceAPI)await loadScript('rwa-commerce-api.js?v=2','api');
    if(!window.RWACommerceLive)await loadScript('rwa-commerce-live.js?v=2','live');
    state.liveLoaded=!!window.RWACommerceLive;
  }
  decorate();
}
async function open(tab='stores'){
  if(state.opening)return;state.opening=true;
  const before=location.pathname;
  try{await ensureRuntime();window.RWAStorefront?.open?.(tab);decorate();if(location.pathname!==before)restoreSingleShell();document.body.classList.add('rwa-seablueprint-commerce-open')}
  catch(e){toast(e?.message||'Seablueprint ecommerce unavailable')}
  finally{state.opening=false}
}
function close(){try{window.RWAStorefront?.close?.()}catch{}document.body.classList.remove('rwa-seablueprint-commerce-open');restoreSingleShell()}
function internalTrade(anchor){
  const raw=anchor.getAttribute('href')||'';if(!/^trade\//i.test(raw))return false;
  const m=raw.match(/[?&]coin=([^&#]+)/i),coin=decodeURIComponent(m?.[1]||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  if(!coin)return false;
  close();if(window.RWASuperApp?.navigate)window.RWASuperApp.navigate(`trade/${coin}`);else location.hash=`#trade/${coin}`;return true;
}
function externalCommerce(anchor){
  try{const u=new URL(anchor.href,location.href);return u.origin!==location.origin}catch{return false}
}
function audit(){
  const launch=$('#rwaSeablueprintCommerceLaunch'),screen=$('#rwaShopScreen'),openNow=!!screen?.classList.contains('open'),external=openNow?qa('#rwaShopScreen a[href]').filter(externalCommerce).length:0;
  const findings=[];if(!launch)findings.push('ECOMMERCE_LAUNCHER_MISSING');if(!samePath())findings.push('TOP_LEVEL_PATH_CHANGED');if(openNow&&!screen?.dataset.seablueprintSingleShell)findings.push('SHOP_NOT_SINGLE_SHELL');if(external)findings.push('EXTERNAL_COMMERCE_LINK_PRESENT');
  return{ok:findings.length===0,version:VERSION,rootPath:state.rootPath,currentPath:location.pathname,launcherVisible:!!launch&&getComputedStyle(launch).display!=='none',shopOpen:openNow,storefrontLoaded:state.storefrontLoaded,liveLoaded:state.liveLoaded,candidateBase:state.config?.candidate_base||'',apiBaseConfigured:!!String(state.config?.api_base||'').trim(),externalCommerceLinks:external,findings};
}
function reconcile(){mountLauncher();decorate()}
document.addEventListener('click',e=>{
  const launch=e.target.closest?.('[data-rwa-seablueprint-commerce]');if(launch){e.preventDefault();e.stopImmediatePropagation();open('stores');return}
  const a=e.target.closest?.('#rwaShopScreen a[href]');if(!a)return;
  if(internalTrade(a)){e.preventDefault();e.stopImmediatePropagation();return}
  if(externalCommerce(a)){e.preventDefault();e.stopImmediatePropagation();toast('External ecommerce navigation is disabled in single-shell mode.')}
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#rwaShopScreen')?.classList.contains('open'))setTimeout(()=>{document.body.classList.remove('rwa-seablueprint-commerce-open');restoreSingleShell()},0)});
addEventListener('popstate',()=>setTimeout(restoreSingleShell,0));
addEventListener('hashchange',()=>setTimeout(()=>{if(location.hash!=='#shop'&&$('#rwaShopScreen')?.classList.contains('open'))close()},0));
function boot(){loadStyle('rwa-seablueprint-commerce-bridge.css?v=1','bridge');config().finally(reconcile);reconcile();new MutationObserver(()=>queueMicrotask(reconcile)).observe(document.documentElement,{subtree:true,childList:true});let n=0;const t=setInterval(()=>{reconcile();if(++n>40)clearInterval(t)},100)}
window.RWASeablueprintCommerceBridge={version:VERSION,mode:'SINGLE_MAIN_DOCUMENT',source:'SEABLUEPRINT_COMMERCE_CONTRACT',open,close,audit,reconcile,config};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
