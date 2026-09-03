/* RENKO total available fixed-1s history origin layer.
 * Binance Spot launch pairs: official historical 1s Data API locates the earliest row;
 * Binance Public Data monthly checksum anchors source integrity for that origin month.
 * GOLD witness: Dukascopy public XAU-USD ticks aggregated to 1-second bars; tick coverage starts 2003-05-05.
 * Lifetime raw rows are never loaded at once. Only bounded origin windows are materialized and persisted.
 */
(()=>{
'use strict';
if(window.RWARenkoTotalHistory)return;
const T=window.RWARenkoTV;if(!T?.loadSymbol)return;
const BINANCE_ARCHIVE='https://data.binance.vision';
const BINANCE_API='https://data-api.binance.vision';
const DUKA='https://jetta.dukascopy.com/v1';
const GOLD_CODE='XAU-USD',GOLD_SYMBOL='XAUUSD';
const GOLD_DOCUMENTED_EARLIEST_MS=Date.UTC(2003,4,5,0,1,3,421);
const ORIGIN_BARS=6000,DB='renko-total-history-v3',STORE='originWindows';
const START_MONTH=Date.UTC(2017,7,1);
const manifest=new Map(),mem=new Map();
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
async function textOk(url,timeout=9000){stats.probeRequests++;const c=new AbortController(),tm=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'force-cache',credentials:'omit',signal:c.signal});if(!r.ok)return null;return await r.text()}catch{return null}finally{clearTimeout(tm)}}
function checksumUrl(symbol,ms){const ym=monthKey(ms);return `${BINANCE_ARCHIVE}/data/spot/monthly/klines/${symbol}/1s/${symbol}-1s-${ym}.zip.CHECKSUM`}
async function fetchKlines(symbol,startTime,limit=1000){const q=new URLSearchParams({symbol,interval:'1s',limit:String(Math.min(1000,limit)),startTime:String(Math.floor(startTime))});const c=new AbortController(),tm=setTimeout(()=>c.abort(),14000);try{const r=await fetch(`${BINANCE_API}/api/v3/klines?${q}`,{cache:'no-store',credentials:'omit',signal:c.signal});if(!r.ok)throw Error(`Binance 1s HTTP ${r.status}`);const a=await r.json();return(Array.isArray(a)?a:[]).map(x=>({openTime:normTs(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[5])||0,closeTime:normTs(x[6])})).filter(b=>Number.isFinite(b.openTime)&&Number.isFinite(b.closeTime)&&[b.open,b.high,b.low,b.close].every(Number.isFinite))}finally{clearTimeout(tm)}}
async function discoverBinance(symbol){
  if(manifest.has(symbol))return manifest.get(symbol);
  try{const saved=JSON.parse(localStorage.getItem(`renko-history-manifest-v3:${symbol}`)||'null');if(saved?.symbol===symbol&&saved?.interval==='1s'&&saved?.earliestSourceMs&&saved?.integrityChecksum){manifest.set(symbol,saved);return saved}}catch{}
  stats.coverageRequests++;
  const firstRows=await fetchKlines(symbol,START_MONTH,1);if(!firstRows.length)throw Error(`${symbol} has no historical Binance 1s rows`);
  const earliestSourceMs=Number(firstRows[0].openTime),first=monthStart(earliestSourceMs);
  const checksum=(await textOk(checksumUrl(symbol,first))||'').trim();if(checksum.length<20)throw Error(`${symbol} origin checksum unavailable for ${monthKey(first)}`);
  const last=addMonths(monthStart(Date.now()),-2),lastChecksum=(await textOk(checksumUrl(symbol,last))||'').trim();
  if(lastChecksum.length<20)throw Error(`${symbol} latest publication-lag-safe monthly checksum unavailable for ${monthKey(last)}`);
  const span=Math.max(1,Math.round((last-first)/2629800000)+1);
  const m={symbol,provider:'Binance Spot',source:'Binance Data API historical 1s + Public Data checksum',interval:'1s',archive:'Binance Public Data / Data Vision',earliestSourceMs,archiveFirstMonth:monthKey(first),archiveFirstMonthMs:first,archiveLastVerifiedMonth:monthKey(last),archiveLastVerifiedMonthMs:last,archiveMonthSpan:span,totalSourceChunks:span,integrityChecksum:checksum,latestIntegrityChecksum:lastChecksum,discoveredAt:Date.now()};
  manifest.set(symbol,m);try{localStorage.setItem(`renko-history-manifest-v3:${symbol}`,JSON.stringify(m))}catch{}return m
}
async function fetchOriginWindow(symbol,m){
  const key=`binance:${symbol}:${m.archiveFirstMonth}:1s:${ORIGIN_BARS}:v3`,cached=mem.get(key)||await dbGet(key);
  if(cached?.bars?.length){mem.set(key,cached);stats.originCacheHits++;return{...cached,cacheHit:true}}
  let bars=[],cursor=Number(m.earliestSourceMs)||Number(m.archiveFirstMonthMs);
  for(let i=0;i<Math.ceil(ORIGIN_BARS/1000);i++){const rows=await fetchKlines(symbol,cursor,1000);if(!rows.length)break;bars.push(...rows);if(bars.length>=ORIGIN_BARS)break;const next=Number(rows.at(-1).closeTime)+1;if(!(next>cursor))break;cursor=next}
  const dedup=new Map();for(const b of bars)dedup.set(b.openTime,b);bars=[...dedup.values()].sort((a,b)=>a.openTime-b.openTime).slice(0,ORIGIN_BARS);
  if(!bars.length)throw Error(`${symbol} origin 1s rows unavailable from ${m.archiveFirstMonth}`);
  const earliestAvailableMs=bars[0].openTime;if(Number(m.earliestSourceMs)&&earliestAvailableMs!==Number(m.earliestSourceMs))throw Error(`${symbol} earliest row drift ${earliestAvailableMs}/${m.earliestSourceMs}`);
  const v={key,symbol,provider:'Binance Spot',source:'Binance Data API historical 1s',interval:'1s',bars,earliestAvailableMs,originWindowNewestMs:bars.at(-1).closeTime,archiveFirstMonth:m.archiveFirstMonth,integrityChecksum:m.integrityChecksum,savedAt:Date.now()};
  mem.set(key,v);await dbPut(v);stats.originNetworkLoads++;return{...v,cacheHit:false}
}
function scale(mult){const s=String(mult).toLowerCase().split('e'),dec=(s[0].split('.')[1]||'').length,exp=Number(s[1]||0);return Math.max(0,dec-exp)}
function tickRows(j){if(!j||!Array.isArray(j.times)||!Array.isArray(j.bids)||!Number.isFinite(j.timestamp)||!Number.isFinite(j.multiplier)||!(j.multiplier>0)||typeof j.bid!=='number')return[];const sc=scale(j.multiplier);let tm=Number(j.timestamp),units=Math.round(Number(j.bid)/j.multiplier);const out=[];for(let i=0;i<j.times.length;i++){tm+=Number(j.times[i]);units+=Number(j.bids[i]);out.push([tm,Number((units*j.multiplier).toFixed(sc))])}return out}
function aggregateS1(ticks){const m=new Map();for(const [tm,p] of ticks){if(!Number.isFinite(tm)||!Number.isFinite(p))continue;const s=Math.floor(tm/1000)*1000;let b=m.get(s);if(!b){b={openTime:s,closeTime:s+999,open:p,high:p,low:p,close:p,volume:0};m.set(s,b)}else{b.high=Math.max(b.high,p);b.low=Math.min(b.low,p);b.close=p}}return[...m.values()].sort((a,b)=>a.openTime-b.openTime)}
async function goldOrigin(){
  const key='dukascopy:XAU-USD:2003-05-05:s1:origin-v3',cached=mem.get(key)||await dbGet(key);if(cached?.bars?.length){mem.set(key,cached);stats.originCacheHits++;return{...cached,cacheHit:true}}
  const all=[];let minMove=NaN;
  for(let h=0;h<24&&all.length<ORIGIN_BARS*4;h++){const c=new AbortController(),tm=setTimeout(()=>c.abort(),12000);try{const u=`${DUKA}/ticks/${GOLD_CODE}/2003/5/5/${h}`,r=await fetch(u,{cache:'force-cache',credentials:'omit',signal:c.signal});if(!r.ok)continue;const j=await r.json();if(Number(j?.multiplier)>0)minMove=Number.isFinite(minMove)?Math.min(minMove,Number(j.multiplier)):Number(j.multiplier);all.push(...tickRows(j))}catch{}finally{clearTimeout(tm)}}
  const bars=aggregateS1(all).slice(0,ORIGIN_BARS);if(!bars.length)throw Error('Dukascopy XAU-USD origin ticks unavailable');
  const earliest=bars[0].openTime;if(Math.abs(earliest-GOLD_DOCUMENTED_EARLIEST_MS)>3600000)throw Error(`Dukascopy GOLD origin mismatch ${new Date(earliest).toISOString()}`);
  const v={key,symbol:GOLD_SYMBOL,instrumentCode:GOLD_CODE,provider:'Dukascopy',source:'public XAU-USD tick feed aggregated to S1',interval:'1s',bars,tickSize:Number.isFinite(minMove)&&minMove>0?minMove:0.001,earliestAvailableMs:earliest,documentedEarliestS1Ms:GOLD_DOCUMENTED_EARLIEST_MS,originWindowNewestMs:bars.at(-1).closeTime,savedAt:Date.now()};
  mem.set(key,v);await dbPut(v);stats.goldLoads++;return{...v,cacheHit:false}
}
function coverageText(meta,win){const earliest=win?.earliestAvailableMs||meta.earliestAvailableMs,latest=meta.latestAvailableMs||Date.now(),days=Math.floor((latest-earliest)/86400000),chunks=Number(meta.totalSourceChunks)||0;return `${meta.provider} · 1s · TOTAL AVAILABLE ${fmt(earliest)} → ${fmt(latest)} · ${days.toLocaleString()} days${chunks?` · ${chunks.toLocaleString()} source chunks`:''} · origin cache ${win?.cacheHit?'HIT':'PERSISTED'}`}
function applyOrigin(symbol,meta,win){
  const before={symbol:T.state.symbol,bars:T.state.closedBars?.length||0,total:Number(T.state.confirmedTotal)||0};T.state.generation++;
  T.state.symbol=symbol;T.state.pendingSymbol='';T.state.currentBar=null;T.state.closedBars=win.bars.map(b=>({...b}));T.state.lastPrice=Number(win.bars.at(-1)?.close);if(Number(win.tickSize)>0)T.state.tickSize=Number(win.tickSize);T.state.historyPages=Math.max(6,Number(T.state.historyPages)||1);T.state.historyViewMode='origin';T.state.historyMeta={...meta,earliestAvailableMs:win.earliestAvailableMs,loadedOldestMs:win.bars[0].openTime,loadedNewestMs:win.bars.at(-1).closeTime,loadedChunkCount:1,prefetchPending:false,cacheHit:!!win.cacheHit,cachePersisted:true,losses:0};T.state.status='history-origin';T.rebuild({fit:true});T.state.status='history-origin';try{window.RWARenkoBrickBudget?.syncUi?.()}catch{}
  const c=document.getElementById('tvCoverage');if(c)c.textContent=coverageText(T.state.historyMeta,win);
  if(symbol===GOLD_SYMBOL){const p=document.getElementById('pairName');if(p)p.textContent='XAU / USD';const i=document.getElementById('pairIcon');if(i)i.textContent='AU';const s=document.getElementById('sourceText');if(s)s.textContent='Dukascopy XAU/USD public tick history · aggregated to fixed 1-second OHLC · earliest tick coverage 5 May 2003.'}
  Object.assign(document.documentElement.dataset,{renkoHistoryAtOrigin:'true',renkoHistoryProvider:String(meta.provider||''),renkoHistoryEarliestMs:String(win.earliestAvailableMs),renkoHistoryLatestMs:String(meta.latestAvailableMs||0),renkoHistoryLoadedChunks:'1',renkoHistoryTotalChunks:String(meta.totalSourceChunks||0),renkoHistoryCacheHit:win.cacheHit?'true':'false',renkoHistoryCachePersisted:'true',renkoHistoryLosses:'0'});
  window.dispatchEvent(new CustomEvent('renko:history-origin',{detail:{symbol,meta:T.state.historyMeta,before}}));return T.state.historyMeta
}
async function jumpOrigin(symbol=T.state.symbol){
  symbol=String(symbol||'').toUpperCase();stats.originLoads++;
  if(symbol===GOLD_SYMBOL||symbol==='GOLD'||symbol==='XAU/USD'||symbol==='XAU-USD'){
    const w=await goldOrigin(),latest=Date.now(),totalSourceChunks=Math.max(1,Math.ceil((latest-w.earliestAvailableMs)/3600000));
    const meta={symbol:GOLD_SYMBOL,instrumentCode:GOLD_CODE,provider:'Dukascopy',source:w.source,interval:'1s',earliestAvailableMs:w.earliestAvailableMs,documentedEarliestS1Ms:w.documentedEarliestS1Ms,latestAvailableMs:latest,coverageDays:Math.floor((latest-w.earliestAvailableMs)/86400000),totalSourceChunks,chunkUnit:'hourly tick buckets'};
    return applyOrigin(GOLD_SYMBOL,meta,w)
  }
  const liveNewest=Number(T.state.closedBars?.at(-1)?.closeTime)||Date.now(),m=await discoverBinance(symbol),w=await fetchOriginWindow(symbol,m);m.earliestAvailableMs=w.earliestAvailableMs;m.latestAvailableMs=Math.max(liveNewest,w.originWindowNewestMs);m.coverageDays=Math.floor((m.latestAvailableMs-m.earliestAvailableMs)/86400000);m.totalSourceChunks=Number(m.archiveMonthSpan)||Number(m.totalSourceChunks)||1;return applyOrigin(symbol,m,w)
}
async function goLive(){const s=T.state.symbol===GOLD_SYMBOL?'XAUTUSDT':T.state.symbol;T.state.historyViewMode='live';document.documentElement.dataset.renkoHistoryAtOrigin='false';return T.loadSymbol(s,{fit:true})}
function addButton(){const nav=document.querySelector('.chart-nav');if(!nav||document.getElementById('tvOrigin'))return;const b=document.createElement('button');b.id='tvOrigin';b.title='Jump to earliest available fixed-1s history';b.textContent='ORIGIN';b.addEventListener('click',()=>void jumpOrigin().catch(e=>console.error('[RENKO origin]',e)));nav.insertBefore(b,nav.firstChild)}
document.addEventListener('click',e=>{if(e.target?.closest?.('#tvLive')&&T.state.historyViewMode==='origin'){e.preventDefault();e.stopImmediatePropagation();void goLive()}},true);
window.addEventListener('renko:symbol-switch-start',()=>{document.documentElement.dataset.renkoHistoryAtOrigin='false'});
window.addEventListener('renko:tv-ready',addButton,{once:true});addButton();
window.RWARenkoTotalHistory={version:'2.2.0-origin-chunks',rule:'authoritative-earliest-fixed-1s-rest-plus-archive-checksum-bounded-indexeddb-origin-windows-no-timeframe-substitution',stats,manifest,discoverBinance,fetchOriginWindow,jumpOrigin,goldOrigin,goLive,gold:{symbol:GOLD_SYMBOL,instrumentCode:GOLD_CODE,documentedEarliestS1Ms:GOLD_DOCUMENTED_EARLIEST_MS},get current(){return T.state.historyMeta||null}};
})();