/* RENKO total available fixed-1s history origin layer.
 * Binance Spot launch pairs: official /api/v3/klines 1s + Data Vision monthly archive checksum discovery.
 * GOLD witness: Dukascopy public tick feed aggregated to 1-second bars; earliest S1 is 2003-05-05.
 * Lifetime raw rows are never loaded at once. Only bounded origin windows are materialized and persisted.
 */
(()=>{
'use strict';
if(window.RWARenkoTotalHistory)return;
const T=window.RWARenkoTV;if(!T?.loadSymbol)return;
const BINANCE_ARCHIVE='https://data.binance.vision';
const BINANCE_API='https://data-api.binance.vision';
const DUKA='https://jetta.dukascopy.com/v1';
const ORIGIN_BARS=6000, DB='renko-total-history-v1', STORE='originWindows';
const START_MONTH=Date.UTC(2017,7,1);
const manifest=new Map(), mem=new Map();
const stats={coverageRequests:0,originLoads:0,originCacheHits:0,originNetworkLoads:0,probeRequests:0,goldLoads:0,losses:0};
const pad=n=>String(n).padStart(2,'0');
const monthStart=ms=>{const d=new Date(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)};
const addMonths=(ms,n)=>{const d=new Date(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1)};
const monthKey=ms=>{const d=new Date(ms);return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`};
const fmt=ms=>new Date(Number(ms)||0).toISOString().replace('T',' ').replace('.000Z','Z');
const normTs=n=>{n=Number(n);return n>1e14?Math.floor(n/1000):n};
function idb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function dbGet(key){try{const db=await idb();return await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}catch{return null}}
async function dbPut(v){try{const db=await idb();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)});return true}catch{return false}}
async function textOk(url){stats.probeRequests++;try{const r=await fetch(url,{cache:'force-cache',credentials:'omit'});if(!r.ok)return null;return await r.text()}catch{return null}}
function checksumUrl(symbol,ms){const ym=monthKey(ms);return `${BINANCE_ARCHIVE}/data/spot/monthly/klines/${symbol}/1s/${symbol}-1s-${ym}.zip.CHECKSUM`}
async function monthExists(symbol,ms){return !!(await textOk(checksumUrl(symbol,ms)))}
async function discoverBinance(symbol){
  if(manifest.has(symbol))return manifest.get(symbol);stats.coverageRequests++;
  const lastComplete=addMonths(monthStart(Date.now()),-1), months=[];for(let m=START_MONTH;m<=lastComplete;m=addMonths(m,1))months.push(m);
  if(!months.length)throw Error('archive month range unavailable');
  let hi=months.length-1;
  while(hi>=0&&!(await monthExists(symbol,months[hi])))hi--;
  if(hi<0)throw Error(`${symbol} has no official Binance 1s monthly archive`);
  let lo=0,h=hi;while(lo<h){const mid=(lo+h)>>1;if(await monthExists(symbol,months[mid]))h=mid;else lo=mid+1}
  let first=months[lo];
  for(let i=Math.max(0,lo-2);i<lo;i++)if(await monthExists(symbol,months[i])){first=months[i];break}
  const checksum=(await textOk(checksumUrl(symbol,first))||'').trim();
  const m={symbol,provider:'Binance Spot',interval:'1s',archive:'Binance Public Data / Data Vision',archiveFirstMonth:monthKey(first),archiveFirstMonthMs:first,archiveLastVerifiedMonth:monthKey(months[hi]),archiveLastVerifiedMonthMs:months[hi],archiveMonthSpan:Math.round((months[hi]-first)/2629800000)+1,integrityChecksum:checksum,discoveredAt:Date.now()};
  manifest.set(symbol,m);try{localStorage.setItem(`renko-history-manifest:${symbol}`,JSON.stringify(m))}catch{}return m
}
async function fetchKlines(symbol,startTime,limit=1000){const q=new URLSearchParams({symbol,interval:'1s',limit:String(Math.min(1000,limit)),startTime:String(Math.floor(startTime))});const r=await fetch(`${BINANCE_API}/api/v3/klines?${q}`,{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error(`Binance 1s HTTP ${r.status}`);const a=await r.json();return (Array.isArray(a)?a:[]).map(x=>({openTime:normTs(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[5])||0,closeTime:normTs(x[6])})).filter(b=>Number.isFinite(b.openTime)&&Number.isFinite(b.close))}
async function fetchOriginWindow(symbol,m){
  const key=`binance:${symbol}:${m.archiveFirstMonth}:1s:${ORIGIN_BARS}`,cached=mem.get(key)||await dbGet(key);
  if(cached?.bars?.length){mem.set(key,cached);stats.originCacheHits++;return {...cached,cacheHit:true}}
  let bars=[],cursor=m.archiveFirstMonthMs;
  for(let i=0;i<Math.ceil(ORIGIN_BARS/1000);i++){const rows=await fetchKlines(symbol,cursor,1000);if(!rows.length)break;bars.push(...rows);if(bars.length>=ORIGIN_BARS)break;const next=Number(rows.at(-1).closeTime)+1;if(!(next>cursor))break;cursor=next}
  bars=bars.slice(0,ORIGIN_BARS);if(!bars.length)throw Error(`${symbol} origin 1s rows unavailable from ${m.archiveFirstMonth}`);
  const v={key,symbol,provider:'Binance Spot',interval:'1s',bars,earliestAvailableMs:bars[0].openTime,originWindowNewestMs:bars.at(-1).closeTime,archiveFirstMonth:m.archiveFirstMonth,integrityChecksum:m.integrityChecksum,savedAt:Date.now()};
  mem.set(key,v);await dbPut(v);stats.originNetworkLoads++;return {...v,cacheHit:false}
}
function scale(mult){const s=String(mult).toLowerCase().split('e'),dec=(s[0].split('.')[1]||'').length,exp=Number(s[1]||0);return Math.max(0,dec-exp)}
function tickRows(j){
  if(!j||!Array.isArray(j.times)||!Array.isArray(j.bids)||!Number.isFinite(j.timestamp)||!Number.isFinite(j.multiplier)||typeof j.bid!=='number')return[];
  const sc=scale(j.multiplier);let tm=Number(j.timestamp),units=Math.round(Number(j.bid)/j.multiplier);const out=[];
  for(let i=0;i<j.times.length;i++){tm+=Number(j.times[i]);units+=Number(j.bids[i]);out.push([tm,Number((units*j.multiplier).toFixed(sc))])}return out
}
function aggregateS1(ticks){const m=new Map();for(const [tm,p] of ticks){const s=Math.floor(tm/1000)*1000;let b=m.get(s);if(!b){b={openTime:s,closeTime:s+999,open:p,high:p,low:p,close:p,volume:0};m.set(s,b)}else{b.high=Math.max(b.high,p);b.low=Math.min(b.low,p);b.close=p}}return[...m.values()].sort((a,b)=>a.openTime-b.openTime)}
async function goldOrigin(){
  const key='dukascopy:XAUUSD:2003-05-05:s1:origin',cached=mem.get(key)||await dbGet(key);if(cached?.bars?.length){mem.set(key,cached);stats.originCacheHits++;return {...cached,cacheHit:true}}
  const all=[];for(let h=0;h<24&&all.length<ORIGIN_BARS;h++){const u=`${DUKA}/ticks/XAUUSD/2003/5/5/${h}`;const r=await fetch(u,{cache:'force-cache',credentials:'omit'});if(!r.ok)continue;const j=await r.json();all.push(...tickRows(j))}
  const bars=aggregateS1(all).slice(0,ORIGIN_BARS);if(!bars.length)throw Error('Dukascopy XAUUSD origin ticks unavailable');
  const earliest=bars[0].openTime,known=Date.UTC(2003,4,5,0,1,3),v={key,symbol:'XAUUSD',provider:'Dukascopy',source:'public tick feed aggregated to S1',interval:'1s',bars,earliestAvailableMs:earliest,documentedEarliestS1Ms:known,originWindowNewestMs:bars.at(-1).closeTime,savedAt:Date.now()};
  mem.set(key,v);await dbPut(v);stats.goldLoads++;return {...v,cacheHit:false}
}
function coverageText(meta,win){const earliest=win?.earliestAvailableMs||meta.earliestAvailableMs,latest=meta.latestAvailableMs||Date.now(),days=Math.floor((latest-earliest)/86400000);return `${meta.provider} · 1s · TOTAL AVAILABLE ${fmt(earliest)} → ${fmt(latest)} · ${days.toLocaleString()} days · origin cache ${win?.cacheHit?'HIT':'PERSISTED'}`}
function applyOrigin(symbol,meta,win){
  const before={symbol:T.state.symbol,bars:T.state.closedBars?.length||0};T.state.generation++;
  T.state.symbol=symbol;T.state.pendingSymbol='';T.state.currentBar=null;T.state.closedBars=win.bars.map(b=>({...b}));T.state.lastPrice=Number(win.bars.at(-1)?.close);T.state.historyPages=Math.max(6,Number(T.state.historyPages)||1);T.state.historyViewMode='origin';T.state.historyMeta={...meta,earliestAvailableMs:win.earliestAvailableMs,loadedOldestMs:win.bars[0].openTime,loadedNewestMs:win.bars.at(-1).closeTime,loadedChunkCount:1,cacheHit:!!win.cacheHit,cachePersisted:true,losses:0};T.state.status='history-origin';T.rebuild({fit:true});T.state.status='history-origin';
  const c=document.getElementById('tvCoverage');if(c)c.textContent=coverageText(T.state.historyMeta,win);
  document.documentElement.dataset.renkoHistoryAtOrigin='true';document.documentElement.dataset.renkoHistoryProvider=meta.provider;document.documentElement.dataset.renkoHistoryEarliestMs=String(win.earliestAvailableMs);document.documentElement.dataset.renkoHistoryLoadedChunks='1';document.documentElement.dataset.renkoHistoryCacheHit=win.cacheHit?'true':'false';
  window.dispatchEvent(new CustomEvent('renko:history-origin',{detail:{symbol,meta:T.state.historyMeta,before}}));return T.state.historyMeta
}
async function jumpOrigin(symbol=T.state.symbol){
  symbol=String(symbol||'').toUpperCase();stats.originLoads++;
  if(symbol==='XAUUSD'||symbol==='GOLD'){const w=await goldOrigin(),latest=Date.now(),meta={symbol:'XAUUSD',provider:'Dukascopy',interval:'1s',earliestAvailableMs:w.earliestAvailableMs,documentedEarliestS1Ms:w.documentedEarliestS1Ms,latestAvailableMs:latest,coverageDays:Math.floor((latest-w.earliestAvailableMs)/86400000),source:'public tick feed; S1 aggregated from authoritative ticks'};return applyOrigin('XAUUSD',meta,w)}
  const m=await discoverBinance(symbol),w=await fetchOriginWindow(symbol,m),latest=Number(T.state.closedBars?.at(-1)?.closeTime)||Date.now();m.earliestAvailableMs=w.earliestAvailableMs;m.latestAvailableMs=Math.max(latest,w.originWindowNewestMs);m.coverageDays=Math.floor((m.latestAvailableMs-m.earliestAvailableMs)/86400000);return applyOrigin(symbol,m,w)
}
async function goLive(){const s=T.state.symbol==='XAUUSD'?'XAUTUSDT':T.state.symbol;document.documentElement.dataset.renkoHistoryAtOrigin='false';return T.loadSymbol(s,{fit:true})}
function addButton(){const nav=document.querySelector('.chart-nav');if(!nav||document.getElementById('tvOrigin'))return;const b=document.createElement('button');b.id='tvOrigin';b.title='Jump to earliest available fixed-1s history';b.textContent='ORIGIN';b.addEventListener('click',()=>void jumpOrigin().catch(e=>console.error('[RENKO origin]',e)));nav.insertBefore(b,nav.firstChild)}
document.addEventListener('click',e=>{if(e.target?.closest?.('#tvLive')&&T.state.historyViewMode==='origin'){e.preventDefault();e.stopImmediatePropagation();void goLive()}},true);
window.addEventListener('renko:symbol-switch-start',()=>{document.documentElement.dataset.renkoHistoryAtOrigin='false'});
window.addEventListener('renko:tv-ready',addButton,{once:true});addButton();
window.RWARenkoTotalHistory={version:'2.0.0-origin-chunks',rule:'official-fixed-1s-origin-discovery-bounded-persistent-origin-windows-no-timeframe-substitution',stats,manifest,discoverBinance,fetchOriginWindow,jumpOrigin,goldOrigin,goLive,get current(){return T.state.historyMeta||null}};
})();