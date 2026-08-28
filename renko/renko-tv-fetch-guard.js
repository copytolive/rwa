/* RENKO fast-path network guard.
 * Goals:
 * 1) Never fan out the same Binance request to both public roots at once.
 * 2) Avoid the api.binance.com CORS failure path on GitHub Pages.
 * 3) Keep the heavy full-market universe off the critical render path; it is
 *    fetched only when the user opens/focuses the pair selector.
 * 4) Preserve the null endTime fix for kline history.
 * 5) Keep the latest fixed-1s source window at Binance's full 1000-bar page.
 *    Rendered Renko geometry is independently virtualized, so this restores
 *    enough source movement for quiet pairs without reintroducing Chrome OOM.
 */
(()=>{
'use strict';
if(window.RWARenkoFetchGuard)return;

const nativeFetch=window.fetch.bind(window);
const DATA_ROOT='https://data-api.binance.vision';
const INITIAL_KLINE_LIMIT=1000;
const inflight=new Map();
const cache=new Map();
const stats={nativeCalls:0,deduped:0,cacheHits:0,lazyUniverseWaits:0,canonicalized:0,initialKlineLimited:0};
let marketsWanted=false;
const marketWaiters=[];

function wakeMarkets(){
  if(marketsWanted)return;
  marketsWanted=true;
  while(marketWaiters.length){try{marketWaiters.shift()()}catch{}}
}
function wantsMarketUniverseTarget(target){
  return !!target?.closest?.('#openPairs,#pairSearch,.markets');
}
document.addEventListener('click',e=>{if(wantsMarketUniverseTarget(e.target))wakeMarkets()},true);
document.addEventListener('focusin',e=>{if(wantsMarketUniverseTarget(e.target))wakeMarkets()},true);
document.addEventListener('pointerenter',e=>{if(wantsMarketUniverseTarget(e.target))wakeMarkets()},true);

function requestUrl(input){
  if(typeof input==='string')return input;
  if(input instanceof URL)return input.toString();
  return input?.url||'';
}
function isBinanceRest(u){
  return (u.hostname==='data-api.binance.vision'||u.hostname==='api.binance.com')&&u.pathname.startsWith('/api/v3/');
}
function isUniverse(u){
  return (u.pathname==='/api/v3/exchangeInfo'&&!u.searchParams.has('symbol'))||u.pathname==='/api/v3/ticker/24hr';
}
function ttlFor(u){
  if(u.pathname==='/api/v3/exchangeInfo')return u.searchParams.has('symbol')?60000:30000;
  if(u.pathname==='/api/v3/ticker/24hr')return 15000;
  if(u.pathname==='/api/v3/ticker/price')return 1000;
  if(u.pathname==='/api/v3/klines')return 1500;
  return 0;
}
function responseFrom(rec){
  return new Response(rec.body.slice(0),{status:rec.status,statusText:rec.statusText,headers:new Headers(rec.headers)});
}
async function loadOnce(url,init,ttl){
  const now=Date.now(),hit=cache.get(url);
  if(hit&&now-hit.time<=hit.ttl){stats.cacheHits++;return responseFrom(hit)}
  if(inflight.has(url)){
    stats.deduped++;
    return responseFrom(await inflight.get(url));
  }
  const task=(async()=>{
    stats.nativeCalls++;
    const r=await nativeFetch(url,init);
    const body=await r.arrayBuffer();
    const rec={status:r.status,statusText:r.statusText,headers:[...r.headers.entries()],body,time:Date.now(),ttl};
    if(ttl>0&&r.ok)cache.set(url,rec);
    return rec;
  })();
  inflight.set(url,task);
  try{return responseFrom(await task)}finally{inflight.delete(url)}
}

window.fetch=async function(input,init={}){
  const raw=requestUrl(input);
  let u;
  try{u=new URL(raw,location.href)}catch{return nativeFetch(input,init)}
  if(!isBinanceRest(u))return nativeFetch(input,init);

  if(u.pathname==='/api/v3/klines'){
    if(u.searchParams.get('endTime')==='0')u.searchParams.delete('endTime');
    const latest=!u.searchParams.has('endTime');
    const interval=String(u.searchParams.get('interval')||'');
    const requested=Math.max(1,Number(u.searchParams.get('limit')||1000));
    if(latest&&interval==='1s'&&requested>INITIAL_KLINE_LIMIT){
      u.searchParams.set('limit',String(INITIAL_KLINE_LIMIT));
      stats.initialKlineLimited++;
    }
  }

  // GitHub Pages can reach data-api.binance.vision with CORS. The fallback root
  // is intentionally canonicalized here so one logical request produces one
  // physical request instead of competing cross-origin requests.
  if(u.origin!==DATA_ROOT){stats.canonicalized++;u=new URL(DATA_ROOT+u.pathname+u.search)}

  if(isUniverse(u)&&!marketsWanted){
    stats.lazyUniverseWaits++;
    await new Promise(resolve=>marketWaiters.push(resolve));
    init={...init};delete init.signal;
  }
  return loadOnce(u.toString(),init,ttlFor(u));
};

window.RWARenkoFetchGuard={
  version:'2.2.0',
  rule:'single-cors-safe-binance-rest-plus-lazy-market-universe-plus-full-1000bar-latest-1s-window',
  initialKlineLimit:INITIAL_KLINE_LIMIT,
  stats,
  wakeMarkets,
  get marketsWanted(){return marketsWanted}
};
})();
