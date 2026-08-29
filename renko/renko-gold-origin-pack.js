/* Same-origin GOLD origin transport for browsers that cannot read Dukascopy cross-origin.
 * The gzip payload is generated in GitHub Actions from Dukascopy XAU-USD public ticks,
 * carries per-source-bucket SHA256 digests, and contains only fixed 1-second OHLC bars.
 */
(()=>{
'use strict';
if(window.RWARenkoGoldOriginPack)return;
const T=window.RWARenkoTV;
if(!T)return;
const URL='history/renko-gold-xauusd-origin.json.gz';
const EXPECTED=Date.UTC(2003,4,5,0,1,3,421);
let cached=null,fallbackJump=null,fallbackGold=null,attachedApi=null;
const stats={loads:0,cacheHits:0,failures:0,attachments:0,compressedLoads:0,predecodedLoads:0,lastError:'',lastAttachReason:''};
async function decodePayload(res){
  const bytes=new Uint8Array(await res.arrayBuffer());
  if(bytes.length<2)throw new Error('GOLD origin pack empty');
  if(bytes[0]===0x1f&&bytes[1]===0x8b){
    if(typeof DecompressionStream!=='function')throw new Error('gzip DecompressionStream unavailable');
    stats.compressedLoads++;
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  stats.predecodedLoads++;
  return new TextDecoder().decode(bytes);
}
async function loadPack(){
  if(cached){stats.cacheHits++;return cached}
  const res=await fetch(`${URL}?v=2`,{cache:'force-cache',credentials:'same-origin'});
  if(!res.ok)throw new Error(`GOLD origin pack HTTP ${res.status}`);
  const p=JSON.parse(await decodePayload(res));
  const bars=Array.isArray(p?.bars)?p.bars:[],buckets=Array.isArray(p?.sourceBuckets)?p.sourceBuckets:[];
  if(p?.schema!=='renko-gold-origin-v1'||p?.provider!=='Dukascopy'||p?.instrumentCode!=='XAU-USD'||p?.symbol!=='XAUUSD'||p?.interval!=='1s')throw new Error('GOLD origin pack identity invalid');
  if(Number(p.documentedEarliestS1Ms)!==EXPECTED||Math.abs(Number(p.earliestAvailableMs)-EXPECTED)>3600000)throw new Error('GOLD origin pack earliest timestamp invalid');
  if(bars.length<100||!bars.every(b=>[b.openTime,b.closeTime,b.open,b.high,b.low,b.close].every(x=>Number.isFinite(Number(x)))))throw new Error('GOLD origin pack bars invalid');
  if(buckets.length<1||!buckets.every(x=>/^https:\/\/jetta\.dukascopy\.com\/v1\/ticks\/XAU-USD\//.test(String(x.url||''))&&/^[0-9a-f]{64}$/i.test(String(x.sha256||''))))throw new Error('GOLD origin source digests invalid');
  if(!/^[0-9a-f]{64}$/i.test(String(p.payloadSha256||'')))throw new Error('GOLD origin payload digest invalid');
  cached=p;stats.loads++;return p
}
function apply(p){
  const bars=p.bars.map(b=>({openTime:Number(b.openTime),closeTime:Number(b.closeTime),open:Number(b.open),high:Number(b.high),low:Number(b.low),close:Number(b.close),volume:Number(b.volume)||0}));
  T.state.generation++;
  T.state.symbol='XAUUSD';T.state.pendingSymbol='';T.state.currentBar=null;T.state.closedBars=bars;
  T.state.tickSize=Number(p.tickSize)>0?Number(p.tickSize):0.001;T.state.lastPrice=Number(bars.at(-1).close);
  T.state.historyPages=Math.max(6,Number(T.state.historyPages)||1);T.state.historyViewMode='origin';
  const latest=Date.now(),totalSourceChunks=Math.max(1,Math.ceil((latest-Number(p.earliestAvailableMs))/3600000));
  const meta={symbol:'XAUUSD',instrumentCode:'XAU-USD',provider:'Dukascopy',source:p.source,interval:'1s',earliestAvailableMs:Number(p.earliestAvailableMs),documentedEarliestS1Ms:EXPECTED,latestAvailableMs:latest,coverageDays:Math.floor((latest-Number(p.earliestAvailableMs))/86400000),totalSourceChunks,chunkUnit:'hourly tick buckets',loadedOldestMs:Number(bars[0].openTime),loadedNewestMs:Number(bars.at(-1).closeTime),loadedChunkCount:1,prefetchPending:false,cacheHit:true,cachePersisted:true,losses:0,transport:'same-origin-gzip-pack',payloadSha256:p.payloadSha256,sourceBucketCount:p.sourceBuckets.length};
  T.state.historyMeta=meta;T.state.status='history-origin';T.rebuild({fit:true});T.state.status='history-origin';
  try{window.RWARenkoBrickBudget?.syncUi?.()}catch{}
  const cov=document.getElementById('tvCoverage');if(cov)cov.textContent=`Dukascopy · 1s · TOTAL AVAILABLE ${new Date(meta.earliestAvailableMs).toISOString()} → ${new Date(meta.latestAvailableMs).toISOString()} · ${meta.coverageDays.toLocaleString()} days · origin pack verified`;
  const pair=document.getElementById('pairName');if(pair)pair.textContent='XAU / USD';
  const icon=document.getElementById('pairIcon');if(icon)icon.textContent='AU';
  const source=document.getElementById('sourceText');if(source)source.textContent='Dukascopy XAU/USD public tick history · GitHub-verified same-origin pack · fixed 1-second OHLC · earliest tick coverage 5 May 2003.';
  Object.assign(document.documentElement.dataset,{renkoHistoryAtOrigin:'true',renkoHistoryProvider:'Dukascopy',renkoHistoryEarliestMs:String(meta.earliestAvailableMs),renkoHistoryLatestMs:String(meta.latestAvailableMs),renkoHistoryLoadedChunks:'1',renkoHistoryTotalChunks:String(meta.totalSourceChunks),renkoHistoryCacheHit:'true',renkoHistoryCachePersisted:'true',renkoHistoryLosses:'0',renkoGoldOriginTransport:'same-origin-gzip-pack'});
  window.dispatchEvent(new CustomEvent('renko:history-origin',{detail:{symbol:'XAUUSD',meta}}));
  return meta
}
function api(){return window.RWARenkoTotalHistory||null}
async function jump(symbol=T.state?.symbol){
  const s=String(symbol||'').toUpperCase();
  if(!['XAUUSD','GOLD','XAU/USD','XAU-USD'].includes(s)){
    if(typeof fallbackJump==='function')return fallbackJump(symbol);
    const a=api();if(a?.jumpOrigin&&a.jumpOrigin!==jump)return a.jumpOrigin(symbol);
    throw new Error('RENKO total-history jumpOrigin unavailable');
  }
  try{return apply(await loadPack())}catch(e){
    stats.failures++;stats.lastError=String(e?.message||e);console.warn('[RENKO GOLD origin pack]',e);
    if(typeof fallbackJump==='function')return fallbackJump('XAUUSD');
    const a=api();if(a?.jumpOrigin&&a.jumpOrigin!==jump)return a.jumpOrigin('XAUUSD');
    throw e
  }
}
async function goldOrigin(){
  try{return await loadPack()}catch(e){
    stats.failures++;stats.lastError=String(e?.message||e);
    if(typeof fallbackGold==='function')return fallbackGold();
    throw e
  }
}
function attach(reason='attach'){
  const a=api();if(!a?.jumpOrigin)return false;
  if(a.jumpOrigin!==jump){fallbackJump=a.jumpOrigin.bind(a);fallbackGold=typeof a.goldOrigin==='function'?a.goldOrigin.bind(a):null;a.jumpOrigin=jump;a.goldOrigin=goldOrigin;stats.attachments++}
  attachedApi=a;stats.lastAttachReason=String(reason);
  Object.assign(document.documentElement.dataset,{renkoGoldOriginWrapper:'attached',renkoGoldOriginWrapperVersion:'1.1.0'});
  return true
}
window.RWARenkoGoldOriginPack={version:'1.1.0',rule:'dukascopy-verified-fixed-s1-same-origin-gzip-transport',url:URL,expectedEarliestMs:EXPECTED,stats,loadPack,jump,attach,get attached(){return api()?.jumpOrigin===jump},get attachedApi(){return attachedApi}};
attach('initial');
queueMicrotask(()=>attach('microtask'));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>attach('domcontentloaded'),{once:true});else attach('dom-ready');
window.addEventListener('load',()=>attach('window-load'),{once:true});
let settle=0;const timer=setInterval(()=>{attach(`settle-${++settle}`);if(settle>=20)clearInterval(timer)},100);
})();
