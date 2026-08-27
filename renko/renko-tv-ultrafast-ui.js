/* RENKO ultra-fast UI layer.
 * - Keeps the full Binance spot universe out of the main-thread render path.
 * - Parses the large market payload in a Web Worker.
 * - Virtualizes the pair list so only visible rows exist in the DOM.
 * - Locks manual chart zoom/pan until LIVE/reset so realtime renders never snap back.
 *
 * "0 ms" here means a regression target of 0 ms main-thread blocking time
 * (no Long Task >50 ms), not physically zero network/CPU latency.
 */
(()=>{
'use strict';
if(window.RWARenkoUltraUI)return;

const guardFetch=window.fetch.bind(window);
const DATA_ROOT='https://data-api.binance.vision';
const ROW_H=47;
const OVERSCAN=7;
const MAX_LIST_VIEWPORT=820;
const stats={
  universeRequested:false,universeLoaded:false,totalRows:0,filteredRows:0,renderedRows:0,
  workerParseMs:0,networkMs:0,renderMs:0,searchMs:0,longTasks:0,blockingMs:0,maxLongTaskMs:0,
  manualViewLocks:0,zoomSnapPrevented:0,bootUniverseIntercepts:0,scrollRenders:0,viewportHeight:0
};
let rows=[],filtered=[],worker=null,universePromise=null,renderRAF=0,manualViewLocked=false,followingValue=true;

function isUniverseUrl(raw){
  try{
    const u=new URL(typeof raw==='string'?raw:raw?.url||'',location.href);
    return (u.hostname==='data-api.binance.vision'||u.hostname==='api.binance.com')&&
      ((u.pathname==='/api/v3/exchangeInfo'&&!u.searchParams.has('symbol'))||u.pathname==='/api/v3/ticker/24hr');
  }catch{return false}
}
function universeKind(raw){
  try{return new URL(typeof raw==='string'?raw:raw?.url||'',location.href).pathname.endsWith('/exchangeInfo')?'info':'tickers'}catch{return''}
}
function tinyResponse(kind){
  const body=kind==='info'?'{"symbols":[]}':'[]';
  return Promise.resolve(new Response(body,{status:200,headers:{'content-type':'application/json'}}));
}

// The legacy app calls its universe loader during startup. Short-circuit that
// call so startup never parses a multi-megabyte payload or creates hundreds of
// pair rows. The real universe is fetched only after explicit pair interaction.
window.fetch=function(input,init){
  if(isUniverseUrl(input)){
    stats.bootUniverseIntercepts++;
    const G=window.RWARenkoFetchGuard;
    if(G?.stats&&!G.marketsWanted)G.stats.lazyUniverseWaits=(Number(G.stats.lazyUniverseWaits)||0)+1;
    return tinyResponse(universeKind(input));
  }
  return guardFetch(input,init);
};

function makeWorker(){
  if(worker)return worker;
  const source=`self.onmessage=e=>{const t=performance.now();try{const d=new TextDecoder(),info=JSON.parse(d.decode(e.data.info)),tickers=JSON.parse(d.decode(e.data.tickers)),tm=new Map((Array.isArray(tickers)?tickers:[]).map(x=>[x.symbol,x])),rows=(info&&Array.isArray(info.symbols)?info.symbols:[]).filter(s=>s.status==='TRADING'&&s.isSpotTradingAllowed!==false).map(s=>{const x=tm.get(s.symbol)||{};return{symbol:s.symbol,base:s.baseAsset,quote:s.quoteAsset,price:Number(x.lastPrice),pct:Number(x.priceChangePercent),vol:Number(x.quoteVolume)||0}}).filter(x=>Number.isFinite(x.price)&&x.price>0).sort((a,b)=>b.vol-a.vol);self.postMessage({ok:true,rows,parseMs:performance.now()-t})}catch(err){self.postMessage({ok:false,error:String(err&&err.message||err)})}}`;
  const url=URL.createObjectURL(new Blob([source],{type:'application/javascript'}));
  worker=new Worker(url);URL.revokeObjectURL(url);return worker;
}
function fmt(n){n=Number(n);if(!Number.isFinite(n))return'—';const a=Math.abs(n),d=a>=1000?2:a>=100?3:a>=1?4:a>=.01?6:8;return n.toLocaleString(undefined,{maximumFractionDigits:d})}
function setText(id,text){const el=document.getElementById(id);if(el)el.textContent=text}
function host(){return document.getElementById('pairList')}
function searchEl(){return document.getElementById('pairSearch')}

// A spacer-based virtual list is only safe when its host is a bounded scroll
// viewport. The previous layout could allow the desktop sidebar to grow to the
// spacer's full height; on the next scroll that made the renderer believe every
// row was visible. Clamp the viewport independently from CSS/layout changes.
function ensureListViewport(){
  const h=host();if(!h)return 600;
  const top=Math.max(0,h.getBoundingClientRect().top||0);
  const available=Math.max(260,window.innerHeight-top-12);
  const height=Math.max(260,Math.min(MAX_LIST_VIEWPORT,available));
  h.style.height=`${height}px`;
  h.style.maxHeight=`${height}px`;
  h.style.minHeight='0';
  h.style.overflowY='auto';
  h.style.overflowX='hidden';
  h.style.overscrollBehavior='contain';
  h.style.contain='layout paint style';
  stats.viewportHeight=height;
  return height;
}

function filterRows(){
  const t0=performance.now(),term=String(searchEl()?.value||'').trim().toUpperCase();
  filtered=term?rows.filter(x=>`${x.base}${x.quote}${x.symbol}`.includes(term)):rows;
  stats.filteredRows=filtered.length;stats.searchMs=performance.now()-t0;
  setText('pairShown',term?`${filtered.length.toLocaleString()} matches`:`${filtered.length.toLocaleString()} markets`);
  setText('universeNote',rows.length?`Virtual list · all ${rows.length.toLocaleString()} spot markets`:'Loading universe…');
  const h=host();if(h)h.scrollTop=0;scheduleRender();
}
function rowHTML(r,active){
  const pct=Number(r.pct)||0;
  return `<button type="button" class="pair-row${active?' active':''}" data-ultra-symbol="${r.symbol}"><span class="pair-icon">${String(r.base||'').slice(0,2)}</span><span class="pair-main"><b>${r.base} / ${r.quote}</b><small>${fmt(r.vol)} 24h quote</small></span><span class="pair-price"><b>${fmt(r.price)}</b><small class="${pct>=0?'up':'down'}">${pct>=0?'+':''}${fmt(pct)}%</small></span></button>`;
}
function renderVirtual(){
  renderRAF=0;const h=host();if(!h)return;
  const t0=performance.now(),height=ensureListViewport(),start=Math.max(0,Math.floor(h.scrollTop/ROW_H)-OVERSCAN),count=Math.min(filtered.length-start,Math.ceil(height/ROW_H)+OVERSCAN*2),end=start+Math.max(0,count),active=window.RWARenkoTV?.state?.symbol||'';
  if(!filtered.length){h.innerHTML='<div class="empty">No matching pair.</div>';stats.renderedRows=0;return}
  let html=`<div aria-hidden="true" style="height:${start*ROW_H}px"></div>`;
  for(let i=start;i<end;i++)html+=rowHTML(filtered[i],filtered[i].symbol===active);
  html+=`<div aria-hidden="true" style="height:${Math.max(0,(filtered.length-end)*ROW_H)}px"></div>`;
  h.innerHTML=html;stats.renderedRows=end-start;stats.renderMs=performance.now()-t0;
  document.documentElement.dataset.renkoVirtualRows=String(stats.renderedRows);
}
function scheduleRender(){if(renderRAF)return;renderRAF=requestAnimationFrame(renderVirtual)}

async function fetchBuffer(url){
  const r=await guardFetch(url,{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.arrayBuffer();
}
async function loadUniverse(){
  if(universePromise)return universePromise;
  stats.universeRequested=true;
  universePromise=(async()=>{
    const t0=performance.now();
    const [info,tickers]=await Promise.all([fetchBuffer(`${DATA_ROOT}/api/v3/exchangeInfo`),fetchBuffer(`${DATA_ROOT}/api/v3/ticker/24hr`)]);
    stats.networkMs=performance.now()-t0;
    const w=makeWorker();
    const result=await new Promise((resolve,reject)=>{const on=e=>{w.removeEventListener('message',on);e.data?.ok?resolve(e.data):reject(new Error(e.data?.error||'worker parse failed'))};w.addEventListener('message',on);w.postMessage({info,tickers},[info,tickers])});
    rows=result.rows||[];stats.workerParseMs=result.parseMs||0;stats.totalRows=rows.length;stats.universeLoaded=true;
    setText('pairTotal',`${rows.length.toLocaleString()} markets`);filterRows();return rows.length;
  })().catch(err=>{console.warn('[RENKO ultra market]',err);const h=host();if(h)h.innerHTML='<div class="empty">Market universe unavailable. Quick pairs still work.</div>';throw err});
  return universePromise;
}
function requestUniverseFromInteraction(e){
  if(e?.target?.closest?.('#openPairs,#pairSearch,.markets'))void loadUniverse();
}
document.addEventListener('click',requestUniverseFromInteraction,true);
document.addEventListener('focusin',requestUniverseFromInteraction,true);
document.addEventListener('pointerenter',requestUniverseFromInteraction,true);

const pairHost=host();
if(pairHost){
  ensureListViewport();
  pairHost.addEventListener('scroll',()=>{stats.scrollRenders++;scheduleRender()},{passive:true});
  pairHost.addEventListener('click',e=>{const b=e.target.closest?.('[data-ultra-symbol]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();unlockManualView();document.querySelector('.markets')?.classList.remove('open');void window.RWARenkoTV?.loadSymbol?.(b.dataset.ultraSymbol,{fit:true})},true);
}
window.addEventListener('resize',scheduleRender,{passive:true});
const search=searchEl();
if(search)search.addEventListener('input',e=>{e.stopImmediatePropagation();filterRows()},true);

// The production LightweightCharts namespace is frozen/read-only. Do not patch
// createChart. Zoom persistence is enforced at the app's own `state.following`
// switch: any manual chart interaction turns auto-follow off until LIVE/reset.
function installFollowingGuard(){
  const s=window.RWARenkoTV?.state;if(!s||s.__ultraFollowingGuard)return;
  followingValue=!!s.following;
  Object.defineProperty(s,'following',{configurable:true,enumerable:true,get(){return followingValue},set(v){if(v&&manualViewLocked){stats.zoomSnapPrevented++;return}followingValue=!!v}});
  Object.defineProperty(s,'__ultraFollowingGuard',{value:true,enumerable:false});
}
function lockManualView(){manualViewLocked=true;followingValue=false;stats.manualViewLocks++;document.documentElement.dataset.renkoManualView='true'}
function unlockManualView(){manualViewLocked=false;document.documentElement.dataset.renkoManualView='false'}
function manualTarget(e){return e.target?.closest?.('#tvZoomIn,#tvZoomOut,#tvPanOlder,#tvPanNewer,#chartHost,#chartWrap')}
// Applying ATR/Traditional/Percentage changes chart geometry but must not cancel
// a user's manual viewport lock. Only explicit LIVE/reset or a symbol shortcut
// intentionally returns control to auto-follow.
function resetTarget(e){return e.target?.closest?.('#tvLive,#tvReset,[data-quick]')}
function handleManualPointer(e){if(resetTarget(e))unlockManualView();else if(manualTarget(e))lockManualView()}
document.addEventListener('wheel',e=>{if(manualTarget(e))lockManualView()},{capture:true,passive:true});
document.addEventListener('pointerdown',handleManualPointer,true);
document.addEventListener('click',handleManualPointer,true);
document.addEventListener('touchstart',e=>{if(manualTarget(e))lockManualView()},{capture:true,passive:true});
document.addEventListener('change',e=>{if(e.target?.matches?.('#sourceSelect,#intervalSelect'))unlockManualView()},true);
window.addEventListener('renko:tv-ready',installFollowingGuard);
queueMicrotask(()=>{if(window.RWARenkoTV)installFollowingGuard()});

// Long Task observer: "0 ms" is measured as 0 ms of blocking time above the
// browser Long Task threshold. Network and CPU elapsed time are necessarily >0.
try{
  const po=new PerformanceObserver(list=>{for(const x of list.getEntries()){stats.longTasks++;stats.maxLongTaskMs=Math.max(stats.maxLongTaskMs,x.duration);stats.blockingMs+=Math.max(0,x.duration-50)}});po.observe({type:'longtask',buffered:true});
}catch{}

window.RWARenkoUltraUI={
  version:'1.0.3',rule:'worker-parsed-scroll-safe-virtual-market-list-plus-manual-zoom-lock-settings-safe',stats,
  loadUniverse,filterRows,renderVirtual,ensureListViewport,lockManualView,unlockManualView,
  get rows(){return rows},get filtered(){return filtered},get manualViewLocked(){return manualViewLocked}
};
})();
