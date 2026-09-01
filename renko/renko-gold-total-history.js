/* Canonical GOLD total-history runtime.
 *
 * Recent GOLD remains the instant first paint. This module only activates after
 * a GOLD recent window is already visible, then lazily addresses immutable
 * monthly Dukascopy XAU-USD fixed-1s packs from full-manifest.json.
 *
 * Large compressed packs live in IndexedDB. One/two decoded months are compact
 * Int32 columns in an LRU; only a bounded source-bar window becomes JS objects
 * for the existing RENKO engine. Fetches are SHA256 checked and de-duplicated.
 */
(()=>{
'use strict';
if(window.RWARenkoGoldTotalHistory)return;
const MANIFEST_URL='history/gold/full-manifest.json';
const DB_NAME='rwa-renko-gold-canonical-v1',STORE='assets',DB_VERSION=1;
/* 4k prepend + 68k sliding window keeps the synchronous Renko rebuild under
 * Chrome's 50ms long-task boundary on the proof runner. Monthly download,
 * SHA256 and gzip decode remain asynchronous/off-main-thread. */
const BLOCK_BARS=4000,MAX_SOURCE_BARS=68000,MAX_DECODED_MONTHS=2,RETRIES=4,GESTURE_IDLE_MS=220;
const inflight=new Map(),decoded=new Map();
let manifest=null,dbPromise=null,busy=false,observerBound=false,lastAutoOldest=0,decodeSeq=0,gestureId=0,lastTriggeredGesture=-1,lastWheelAt=-Infinity;
const stats={manifestLoads:0,networkFetches:0,idbHits:0,idbWrites:0,shaChecks:0,retries:0,workerDecodes:0,prepends:0,prefetches:0,duplicateFetchAvoided:0,failures:0,lastError:'',oldestSecond:null,newestSecond:null,memorySourceBars:0,decodedMonths:0,blockBars:BLOCK_BARS,maxSourceBars:MAX_SOURCE_BARS,gestureId:0,autoGestureTriggers:0,autoSuppressedSameGesture:0};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const monthKey=m=>`${m.year}-${String(m.month).padStart(2,'0')}`;
const cacheKey=m=>`${manifest.dataVersion}:${monthKey(m)}`;
function dispatch(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch(_){}}
function setDataset(extra={}){Object.assign(document.documentElement.dataset,{renkoGoldTotal:'true',renkoGoldTotalProvider:'Dukascopy',renkoGoldTotalInterval:'1s',renkoGoldTotalBlockBars:String(BLOCK_BARS),renkoGoldTotalMaxSourceBars:String(MAX_SOURCE_BARS),renkoGoldTotalGesture:String(gestureId),...extra})}
async function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const q=indexedDB.open(DB_NAME,DB_VERSION);
    q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'})};
    q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error||new Error('IndexedDB open failed'));
  });
  return dbPromise;
}
async function idbGet(key){const db=await openDb();return new Promise((resolve,reject)=>{const q=db.transaction(STORE,'readonly').objectStore(STORE).get(key);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error)})}
async function idbPut(value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function idbDelete(key){const db=await openDb();return new Promise((resolve,reject)=>{const q=db.transaction(STORE,'readwrite').objectStore(STORE).delete(key);q.onsuccess=()=>resolve();q.onerror=()=>reject(q.error)})}
async function digest(buffer){stats.shaChecks++;return hex(await crypto.subtle.digest('SHA-256',buffer))}
function validateManifest(m){
  if(m?.schema!=='renko-gold-s1-full-manifest-v1'||m?.provider!=='Dukascopy'||m?.instrumentCode!=='XAU-USD'||m?.symbol!=='XAUUSD'||m?.interval!=='1s'||m?.priceSide!=='bid'||Number(m?.tickSize)!==0.001||!Array.isArray(m?.months)||!m.months.length)throw new Error('GOLD total manifest identity invalid');
  let prev=-1;
  for(const x of m.months){
    if(!x.assetUrl||!/^https:\/\/media\.githubusercontent\.com\/media\/copytolive\/rwa\/[0-9a-f]{40}\//.test(x.assetUrl))throw new Error(`GOLD immutable asset URL invalid ${x.asset||''}`);
    if(!/^[0-9a-f]{64}$/.test(x.assetSha256||''))throw new Error(`GOLD asset SHA invalid ${x.asset||''}`);
    if(x.priceSide!=='bid'||Number(x.tickSize)!==0.001)throw new Error(`GOLD month contract invalid ${x.asset||''}`);
    if(Number(x.earliestSecond)<=prev)throw new Error(`GOLD month overlap ${x.asset||''}`);prev=Number(x.latestSecond);
  }
  return m;
}
async function loadManifest(force=false){
  if(manifest&&!force)return manifest;
  const r=await fetch(`${MANIFEST_URL}?v=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
  if(!r.ok)throw new Error(`GOLD total manifest HTTP ${r.status}`);
  manifest=validateManifest(await r.json());stats.manifestLoads++;
  setDataset({renkoGoldTotalVersion:String(manifest.dataVersion||''),renkoGoldTotalComplete:String(!!manifest.backfillComplete),renkoGoldTotalMonths:String(manifest.months.length)});
  return manifest;
}
async function remoteBytes(meta){
  let last;
  for(let n=0;n<RETRIES;n++)try{
    const r=await fetch(meta.assetUrl,{cache:'force-cache',redirect:'follow'});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const b=await r.arrayBuffer();if(Number(meta.bytes)>0&&b.byteLength!==Number(meta.bytes))throw new Error(`byte mismatch ${b.byteLength}/${meta.bytes}`);
    const sha=await digest(b);if(sha!==meta.assetSha256)throw new Error(`SHA256 mismatch ${sha}`);stats.networkFetches++;return b;
  }catch(e){last=e;if(n+1<RETRIES){stats.retries++;await sleep(350*(2**n)+Math.random()*150)}}
  throw last||new Error('GOLD asset fetch failed');
}
async function getBytes(meta){
  const key=cacheKey(meta);if(inflight.has(key)){stats.duplicateFetchAvoided++;return inflight.get(key)}
  const p=(async()=>{
    const cached=await idbGet(key);
    if(cached?.sha===meta.assetSha256&&cached?.bytes instanceof ArrayBuffer){const sha=await digest(cached.bytes);if(sha===meta.assetSha256){stats.idbHits++;return cached.bytes}await idbDelete(key)}
    const bytes=await remoteBytes(meta);await idbPut({key,sha:meta.assetSha256,bytes,bytesLength:bytes.byteLength,verifiedAt:Date.now(),provider:'Dukascopy',instrumentCode:'XAU-USD',interval:'1s',dataVersion:manifest.dataVersion,month:monthKey(meta)});stats.idbWrites++;return bytes;
  })();
  inflight.set(key,p);try{return await p}finally{inflight.delete(key)}
}
function touchDecoded(key,value){decoded.delete(key);decoded.set(key,value);while(decoded.size>MAX_DECODED_MONTHS){const oldest=decoded.keys().next().value;decoded.delete(oldest)}stats.decodedMonths=decoded.size}
async function decodeMonth(meta){
  const key=cacheKey(meta);if(decoded.has(key)){const v=decoded.get(key);touchDecoded(key,v);return v}
  let bytes=await getBytes(meta);const id=++decodeSeq;
  const out=await new Promise((resolve,reject)=>{
    const w=new Worker('renko-gold-total-history-worker.js?v=1');const timer=setTimeout(()=>{w.terminate();reject(new Error(`GOLD worker timeout ${meta.asset}`))},120000);
    w.onmessage=e=>{if(e.data?.id!==id)return;clearTimeout(timer);w.terminate();e.data.ok?resolve(e.data):reject(new Error(e.data.error||'GOLD worker decode failed'))};
    w.onerror=e=>{clearTimeout(timer);w.terminate();reject(new Error(e.message||'GOLD worker error'))};w.postMessage({id,bytes,barCount:Number(meta.barCount),header:'unix_second,open_tick,high_tick,low_tick,close_tick'},[bytes]);
  });
  if(Number(out.row)!==Number(meta.barCount)||Number(out.first)!==Number(meta.earliestSecond)||Number(out.last)!==Number(meta.latestSecond))throw new Error(`GOLD decoded metadata mismatch ${meta.asset}`);
  const v={meta,sec:new Int32Array(out.sec),open:new Int32Array(out.open),high:new Int32Array(out.high),low:new Int32Array(out.low),close:new Int32Array(out.close)};stats.workerDecodes++;touchDecoded(key,v);return v;
}
function upperBound(a,x){let lo=0,hi=a.length;while(lo<hi){const mid=(lo+hi)>>>1;if(a[mid]<=x)lo=mid+1;else hi=mid}return lo}
function lowerBound(a,x){let lo=0,hi=a.length;while(lo<hi){const mid=(lo+hi)>>>1;if(a[mid]<x)lo=mid+1;else hi=mid}return lo}
function barsFromCompact(c,start,end){const tick=Number(c.meta.tickSize)||0.001,lo=lowerBound(c.sec,start),hi=upperBound(c.sec,end),out=new Array(Math.max(0,hi-lo));for(let i=lo,j=0;i<hi;i++,j++){const s=c.sec[i];out[j]={openTime:s*1000,closeTime:s*1000+999,open:c.open[i]*tick,high:c.high[i]*tick,low:c.low[i]*tick,close:c.close[i]*tick,volume:0}}return out}
function findMonthForSecond(sec){const a=manifest.months;let lo=0,hi=a.length-1,ans=-1;while(lo<=hi){const mid=(lo+hi)>>1,m=a[mid];if(Number(m.earliestSecond)<=sec){ans=mid;lo=mid+1}else hi=mid-1}if(ans<0)return -1;if(sec<=Number(a[ans].latestSecond))return ans;return ans}
async function materializeBefore(beforeSec,want=BLOCK_BARS){await loadManifest();let idx=findMonthForSecond(beforeSec-1);if(idx<0)return[];let remain=want,parts=[];while(idx>=0&&remain>0){const meta=manifest.months[idx],c=await decodeMonth(meta),end=Math.min(beforeSec-1,Number(meta.latestSecond)),hi=upperBound(c.sec,end),lo=Math.max(0,hi-remain);if(hi>lo){parts.unshift(barsFromCompact(c,c.sec[lo],c.sec[hi-1]));remain-=hi-lo;beforeSec=c.sec[lo]}idx--}return parts.flat()}
function mergeUnique(left,right){const out=[];let i=0,j=0;while(i<left.length||j<right.length){const a=i<left.length?Number(left[i].openTime):Infinity,b=j<right.length?Number(right[j].openTime):Infinity;if(a<b)out.push(left[i++]);else if(b<a)out.push(right[j++]);else{out.push(left[i++]);j++}}return out}
function timeScale(){return window.__RWARenkoChart?.timeScale?.()||null}
function preserveRange(fn,{panOlder=false}={}){
  const ts=timeScale(),range=ts?.getVisibleRange?.()||null;fn();
  const apply=()=>{const t=timeScale();if(!t||!range||!Number.isFinite(Number(range.from))||!Number.isFinite(Number(range.to)))return;try{if(panOlder){const span=Math.max(60,Number(range.to)-Number(range.from));t.setVisibleRange({from:Number(range.from)-span*.75,to:Number(range.to)-span*.75})}else t.setVisibleRange(range);const T=window.RWARenkoTV;if(T?.state)T.state.following=false}catch(_){ }};
  apply();queueMicrotask(apply);requestAnimationFrame(apply);requestAnimationFrame(()=>requestAnimationFrame(apply));setTimeout(apply,0);setTimeout(apply,80);setTimeout(apply,180);
}
function updateUi(T){
  const bars=T.state.closedBars||[],first=bars[0],last=bars.at(-1);if(!first||!last)return;stats.oldestSecond=Math.floor(Number(first.openTime)/1000);stats.newestSecond=Math.floor(Number(last.closeTime)/1000);stats.memorySourceBars=bars.length;
  const c=document.getElementById('tvCoverage');if(c)c.textContent=`Dukascopy · XAU-USD · canonical 1s · bounded ${bars.length.toLocaleString()} source bars · ${new Date(first.openTime).toISOString()} → ${new Date(last.closeTime).toISOString()} · disk cache ${stats.idbHits?'active':'warming'} · ${manifest?.months?.length||0} monthly assets`;
  const l=document.getElementById('tvLoadState');if(l){l.textContent=`GOLD TOTAL · canonical fixed-1s · ${manifest?.backfillComplete?'origin→cutoff audited':'coverage audit in progress'}`;l.classList.add('live')}
  setDataset({renkoGoldTotalOldest:String(stats.oldestSecond),renkoGoldTotalNewest:String(stats.newestSecond),renkoGoldTotalMemoryBars:String(bars.length)});
}
async function prependOlder({panOlder=false}={}){
  if(busy)return false;const T=window.RWARenkoTV;if(T?.state?.symbol!=='XAUUSD'||!Array.isArray(T.state.closedBars)||!T.state.closedBars.length)return false;busy=true;
  try{
    await loadManifest();const before=Math.floor(Number(T.state.closedBars[0].openTime)/1000);if(before<=Number(manifest.months[0].earliestSecond))return false;
    const older=await materializeBefore(before,BLOCK_BARS);if(!older.length)return false;let merged=mergeUnique(older,T.state.closedBars);if(merged.length>MAX_SOURCE_BARS)merged=merged.slice(0,MAX_SOURCE_BARS);
    if(merged.some((b,i)=>i&&Number(b.openTime)<=Number(merged[i-1].openTime)))throw new Error('GOLD source duplicate after prepend');
    T.state.generation++;T.state.closedBars=merged;T.state.currentBar=null;T.state.lastPrice=Number(merged.at(-1).close);T.state.status='history-gold-total';T.state.historyViewMode='gold-total';T.state.historyPages=(Number(T.state.historyPages)||1)+1;T.state.historyMeta={...(T.state.historyMeta||{}),provider:'Dukascopy',instrumentCode:'XAU-USD',source:'immutable Git LFS canonical monthly gzip',interval:'1s',dataVersion:manifest.dataVersion,priceSide:manifest.priceSide,tickSize:manifest.tickSize,loadedOldestMs:Number(merged[0].openTime),loadedNewestMs:Number(merged.at(-1).closeTime),totalSourceChunks:manifest.months.length,chunkUnit:'calendar-month',backfillComplete:!!manifest.backfillComplete,cachePersisted:true,losses:0};
    preserveRange(()=>T.rebuild({fit:false}),{panOlder});T.state.status='history-gold-total';stats.prepends++;updateUi(T);dispatch('renko:gold-total',{oldestSecond:stats.oldestSecond,newestSecond:stats.newestSecond,bars:merged.length,dataVersion:manifest.dataVersion,backfillComplete:!!manifest.backfillComplete});void prefetchPreviousFor(stats.oldestSecond);return true;
  }catch(e){stats.failures++;stats.lastError=String(e?.message||e);console.warn('[RENKO GOLD total]',e);return false}finally{busy=false}
}
async function prefetchPreviousFor(sec){try{await loadManifest();let idx=findMonthForSecond(sec-1);if(idx<0)return false;const meta=manifest.months[idx];await getBytes(meta);stats.prefetches++;dispatch('renko:gold-total-prefetch',{month:monthKey(meta)});return true}catch(e){stats.lastError=String(e?.message||e);return false}}
async function onRecent(){try{const T=window.RWARenkoTV;if(T?.state?.symbol!=='XAUUSD')return;await loadManifest();updateUi(T);const oldest=Math.floor(Number(T.state.closedBars?.[0]?.openTime||0)/1000);if(oldest)void prefetchPreviousFor(oldest)}catch(e){stats.lastError=String(e?.message||e)}}
const chartTarget=e=>e.target?.closest?.('#chartWrap,#chartHost');
function noteWheelGesture(e){if(!chartTarget(e))return;const now=performance.now();if(now-lastWheelAt>GESTURE_IDLE_MS){gestureId++;stats.gestureId=gestureId;setDataset()}lastWheelAt=now}
function notePointerGesture(e){if(!chartTarget(e))return;gestureId++;stats.gestureId=gestureId;lastWheelAt=-Infinity;setDataset()}
document.addEventListener('wheel',noteWheelGesture,{capture:true,passive:true});document.addEventListener('pointerdown',notePointerGesture,{capture:true,passive:true});document.addEventListener('touchstart',notePointerGesture,{capture:true,passive:true});
function bindScrollObserver(){
  if(observerBound)return;const ts=timeScale();if(!ts?.subscribeVisibleLogicalRangeChange)return;observerBound=true;
  ts.subscribeVisibleLogicalRangeChange(range=>{
    const T=window.RWARenkoTV,Z=window.RWARenkoGoldPrependZeroRefresh;if(T?.state?.symbol!=='XAUUSD'||busy||Z?.settling||!range)return;
    const oldest=Math.floor(Number(T.state.closedBars?.[0]?.openTime||0)/1000);if(Number(range.from)>=35||!oldest)return;
    if(gestureId<=0||lastTriggeredGesture===gestureId){stats.autoSuppressedSameGesture++;return}
    if(oldest===lastAutoOldest){stats.autoSuppressedSameGesture++;return}
    lastTriggeredGesture=gestureId;lastAutoOldest=oldest;stats.autoGestureTriggers++;void prependOlder({panOlder:false});
  });
}
function interceptOlderButtons(){document.addEventListener('click',e=>{const id=e.target?.id;if(id!=='tvGoldOlder'&&id!=='tvPanOlder')return;const T=window.RWARenkoTV;if(T?.state?.symbol!=='XAUUSD')return;const recent=window.RWARenkoGoldRecentHistory,m=recent?.manifest,atOldestRecent=id==='tvGoldOlder'&&m&&Number(recent.index)>=m.chunks.length-1,totalMode=T.state.status==='history-gold-total'||T.state.historyViewMode==='gold-total';if(atOldestRecent||totalMode){e.preventDefault();e.stopImmediatePropagation();void prependOlder({panOlder:true})}},true)}
async function clearPersistentCache(){if(dbPromise){try{(await dbPromise).close()}catch(_){}}dbPromise=null;await new Promise((resolve,reject)=>{const q=indexedDB.deleteDatabase(DB_NAME);q.onsuccess=()=>resolve();q.onerror=()=>reject(q.error);q.onblocked=()=>resolve()});decoded.clear();stats.decodedMonths=0}
function init(){interceptOlderButtons();bindScrollObserver();window.addEventListener('renko:chart-ready',bindScrollObserver);window.addEventListener('renko:gold-recent',onRecent);const T=window.RWARenkoTV;if(T?.state?.symbol==='XAUUSD')void onRecent()}
window.RWARenkoGoldTotalHistory={version:'1.2.0-one-prepend-per-gesture',rule:'dukascopy-xauusd-fixed1s-immutable-monthly-idb-4k-prepend-68k-sliding-bound-same-turn-range-restore-one-auto-prepend-per-physical-wheel-gesture',stats,get manifest(){return manifest},get busy(){return busy},get gestureId(){return gestureId},loadManifest,getBytes,decodeMonth,materializeBefore,prependOlder,prefetchPreviousFor,clearPersistentCache,init};
if(document.readyState!=='loading')setTimeout(init,0);else document.addEventListener('DOMContentLoaded',init,{once:true});
})();