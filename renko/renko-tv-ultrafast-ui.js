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
const stats={
  universeRequested:false,universeLoaded:false,totalRows:0,filteredRows:0,renderedRows:0,
  workerParseMs:0,networkMs:0,renderMs:0,searchMs:0,longTasks:0,blockingMs:0,maxLongTaskMs:0,
  manualViewLocks:0,zoomSnapPrevented:0
};
let rows=[],filtered=[],worker=null,universePromise=null,renderRAF=0,manualViewLocked=false,followingValue=true,capturedChart=null;

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

// Base app starts loadMarkets() during boot. Return a tiny result immediately so
// that path never owns a multi-megabyte JSON parse or hundreds of DOM nodes.
window.fetch=function(input,init){
  if(isUniverseUrl(input))return tinyResponse(universeKind(input));
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
  const t0=performance.now(),height=Math.max(300,h.clientHeight||600),start=Math.max(0,Math.floor(h.scrollTop/ROW_H)-OVERSCAN),count=Math.min(filtered.length-start,Math.ceil(height/ROW_H)+OVERSCAN*2),end=start+Math.max(0,count),active=window.RWARenkoTV?.state?.symbol||'';
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
  pairHost.addEventListener('scroll',scheduleRender,{passive:true});
  pairHost.addEventListener('click',e=>{const b=e.target.closest?.('[data-ultra-symbol]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();unlockManualView();document.querySelector('.markets')?.classList.remove('open');void window.RWARenkoTV?.loadSymbol?.(b.dataset.ultraSymbol,{fit:true})},true);
}
const search=searchEl();
if(search)search.addEventListener('input',e=>{e.stopImmediatePropagation();filterRows()},true);

// Capture chart instance before the base app creates it. This is used for the
// zoom regression lock and does not change Lightweight Charts behavior.
if(window.LightweightCharts?.createChart){
  const nativeCreate=window.LightweightCharts.createChart.bind(window.LightweightCharts);
  window.LightweightCharts.createChart=function(...args){capturedChart=nativeCreate(...args);return capturedChart};
}
function installFollowingGuard(){
  const s=window.RWARenkoTV?.state;if(!s||s.__ultraFollowingGuard)return;
  followingValue=!!s.following;
  Object.defineProperty(s,'following',{configurable:true,enumerable:true,get(){return followingValue},set(v){if(v&&manualViewLocked){stats.zoomSnapPrevented++;return}followingValue=!!v}});
  Object.defineProperty(s,'__ultraFollowingGuard',{value:true,enumerable:false});
}
function lockManualView(){manualViewLocked=true;followingValue=false;stats.manualViewLocks++;document.documentElement.dataset.renkoManualView='true'}
function unlockManualView(){manualViewLocked=false;document.documentElement.dataset.renkoManualView='false'}
function manualTarget(e){return e.target?.closest?.('#tvZoomIn,#tvZoomOut,#tvPanOlder,#tvPanNewer,#chartHost,#chartWrap')}
function resetTarget(e){return e.target?.closest?.('#tvLive,#tvReset,[data-quick],[data-apply-method]')}
document.addEventListener('wheel',e=>{if(manualTarget(e))lockManualView()},{capture:true,passive:true});
document.addEventListener('pointerdown',e=>{if(manualTarget(e))lockManualView();else if(resetTarget(e))unlockManualView()},true);
document.addEventListener('touchstart',e=>{if(manualTarget(e))lockManualView()},{capture:true,passive:true});
document.addEventListener('change',e=>{if(e.target?.matches?.('#sourceSelect,#intervalSelect'))unlockManualView()},true);
window.addEventListener('renko:tv-ready',installFollowingGuard);
queueMicrotask(()=>{if(window.RWARenkoTV)installFollowingGuard()});

// Long Task observer: user-requested "0 ms" is enforced as 0 ms blocking above
// the browser Long Task threshold. Normal network/CPU elapsed time cannot be 0.
try{
  const po=new PerformanceObserver(list=>{for(const x of list.getEntries()){stats.longTasks++;stats.maxLongTaskMs=Math.max(stats.maxLongTaskMs,x.duration);stats.blockingMs+=Math.max(0,x.duration-50)}});po.observe({type:'longtask',buffered:true});
}catch{}

window.RWARenkoUltraUI={
  version:'1.0.0',rule:'worker-parsed-virtual-market-list-plus-manual-zoom-lock',stats,
  loadUniverse,filterRows,renderVirtual,lockManualView,unlockManualView,
  get rows(){return rows},get filtered(){return filtered},get chart(){return capturedChart},get manualViewLocked(){return manualViewLocked}
};
})();
