/* GOLD-only bounded recent history navigator.
 * Uses deterministic same-origin Dukascopy XAU-USD fixed-1s daily gzip chunks.
 * Each navigation step materializes one verified trading-day window only, so browser RAM stays bounded.
 */
(()=>{
'use strict';
if(window.RWARenkoGoldRecentHistory)return;
const MANIFEST_URL='history/gold/manifest.json';
let manifest=null,index=0,busy=false;
const stats={manifestLoads:0,chunkLoads:0,failures:0,lastError:'',lastDate:'',lastBars:0};
const $=id=>document.getElementById(id);
const fmt=ms=>new Date(Number(ms)||0).toISOString().replace('T',' ').replace('.000Z','Z');
async function decodeJsonGzip(url){
  const r=await fetch(`${url}?v=1`,{cache:'force-cache',credentials:'same-origin'});
  if(!r.ok)throw new Error(`GOLD chunk HTTP ${r.status}`);
  const bytes=new Uint8Array(await r.arrayBuffer());
  if(bytes.length<2)throw new Error('GOLD chunk empty');
  let text;
  if(bytes[0]===0x1f&&bytes[1]===0x8b){
    if(typeof DecompressionStream!=='function')throw new Error('gzip DecompressionStream unavailable');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    text=await new Response(stream).text();
  }else text=new TextDecoder().decode(bytes);
  return JSON.parse(text);
}
async function loadManifest(force=false){
  if(manifest&&!force)return manifest;
  const r=await fetch(`${MANIFEST_URL}?v=1`,{cache:'no-store',credentials:'same-origin'});
  if(!r.ok)throw new Error(`GOLD manifest HTTP ${r.status}`);
  const m=await r.json();
  if(m?.schema!=='renko-gold-s1-manifest-v1'||m?.provider!=='Dukascopy'||m?.instrumentCode!=='XAU-USD'||m?.symbol!=='XAUUSD'||m?.interval!=='1s'||!Array.isArray(m?.chunks)||m.chunks.length<1)throw new Error('GOLD manifest identity invalid');
  manifest=m;stats.manifestLoads++;return m;
}
async function loadChunk(i=0){
  const m=await loadManifest();
  i=Math.max(0,Math.min(m.chunks.length-1,Math.floor(Number(i)||0)));
  const meta=m.chunks[i],p=await decodeJsonGzip(meta.url);
  const bars=Array.isArray(p?.bars)?p.bars:[];
  if(p?.schema!=='renko-gold-s1-chunk-v1'||p?.provider!=='Dukascopy'||p?.instrumentCode!=='XAU-USD'||p?.symbol!=='XAUUSD'||p?.interval!=='1s'||p?.date!==meta.date||p?.payloadSha256!==meta.payloadSha256||bars.length!==Number(meta.barCount)||bars.length<100)throw new Error(`GOLD chunk invalid ${meta.date}`);
  if(!bars.every(b=>[b.openTime,b.closeTime,b.open,b.high,b.low,b.close].every(x=>Number.isFinite(Number(x)))))throw new Error(`GOLD bars invalid ${meta.date}`);
  stats.chunkLoads++;return{index:i,meta,p,bars};
}
function updateUi(T,m,c){
  const bars=c.bars,first=Number(bars[0].openTime),last=Number(bars.at(-1).closeTime);
  if($('pairName'))$('pairName').textContent='XAU / USD';
  if($('pairIcon'))$('pairIcon').textContent='AU';
  if($('sourceText'))$('sourceText').textContent='Dukascopy XAU/USD public tick history · deterministic same-origin fixed 1-second daily pack.';
  if($('sourceBarCount'))$('sourceBarCount').textContent=bars.length.toLocaleString();
  if($('lastPrice'))$('lastPrice').textContent=String(Number(bars.at(-1).close));
  if($('tvCoverage'))$('tvCoverage').textContent=`Dukascopy · XAU-USD · 1s · ${c.meta.date} · ${bars.length.toLocaleString()} bars · ${fmt(first)} → ${fmt(last)} · window ${c.index+1}/${m.chunks.length}`;
  const b=$('tvLoadState');if(b){b.textContent=`GOLD · ${c.meta.date} · verified fixed-1s daily window`;b.classList.add('live')}
  Object.assign(document.documentElement.dataset,{renkoGoldRecent:'true',renkoGoldRecentDate:c.meta.date,renkoGoldRecentIndex:String(c.index),renkoGoldRecentCount:String(m.chunks.length),renkoHistoryProvider:'Dukascopy',renkoHistoryLosses:'0'});
}
async function apply(i=0,{fit=true}={}){
  if(busy)return false;busy=true;
  try{
    const T=window.RWARenkoTV;if(!T?.state||!T?.rebuild)throw new Error('RENKO runtime unavailable');
    const m=await loadManifest(),c=await loadChunk(i),bars=c.bars.map(b=>({openTime:Number(b.openTime),closeTime:Number(b.closeTime),open:Number(b.open),high:Number(b.high),low:Number(b.low),close:Number(b.close),volume:Number(b.volume)||0}));
    T.state.generation++;
    T.state.symbol='XAUUSD';T.state.pendingSymbol='';T.state.currentBar=null;T.state.closedBars=bars;T.state.tickSize=Number(c.p.tickSize)>0?Number(c.p.tickSize):0.001;T.state.lastPrice=Number(bars.at(-1).close);T.state.historyPages=1;T.state.historyViewMode='gold-recent';T.state.historyMeta={symbol:'XAUUSD',instrumentCode:'XAU-USD',provider:'Dukascopy',source:'same-origin deterministic daily gzip pack',interval:'1s',date:c.meta.date,earliestAvailableMs:Number(c.meta.earliestMs),latestAvailableMs:Number(c.meta.latestMs),loadedOldestMs:Number(c.meta.earliestMs),loadedNewestMs:Number(c.meta.latestMs),loadedChunkCount:1,totalSourceChunks:m.chunks.length,chunkUnit:m.chunkUnit||'trading-day',backfillComplete:!!m.backfillComplete,cachePersisted:true,losses:0};T.state.status='history-gold';
    T.rebuild({fit});T.state.status='history-gold';index=c.index;stats.lastDate=c.meta.date;stats.lastBars=bars.length;updateUi(T,m,c);
    try{history.replaceState(null,'',`${location.pathname}?gold=1&goldDay=${c.meta.date}`)}catch{}
    window.dispatchEvent(new CustomEvent('renko:gold-recent',{detail:{index,date:c.meta.date,bars:bars.length,meta:T.state.historyMeta}}));
    return true;
  }catch(e){stats.failures++;stats.lastError=String(e?.message||e);console.error('[RENKO GOLD recent]',e);return false}finally{busy=false}
}
async function older(){const m=await loadManifest();return apply(Math.min(m.chunks.length-1,index+1),{fit:true})}
async function newer(){return apply(Math.max(0,index-1),{fit:true})}
async function newest(){return apply(0,{fit:true})}
function addControls(){
  const nav=document.querySelector('.chart-nav');if(nav&&!$('tvGoldRecent')){
    const g=document.createElement('button');g.id='tvGoldRecent';g.textContent='GOLD';g.title='Load newest verified Dukascopy XAU-USD fixed-1s daily window';g.addEventListener('click',()=>void newest());nav.insertBefore(g,nav.firstChild);
    const o=document.createElement('button');o.id='tvGoldOlder';o.textContent='G←';o.title='Older GOLD trading-day window';o.addEventListener('click',()=>void older());nav.insertBefore(o,g.nextSibling);
    const n=document.createElement('button');n.id='tvGoldNewer';n.textContent='G→';n.title='Newer GOLD trading-day window';n.addEventListener('click',()=>void newer());nav.insertBefore(n,o.nextSibling);
  }
  const quick=document.querySelector('.quick');if(quick&&!quick.querySelector('[data-gold-recent]')){const b=document.createElement('button');b.textContent='GOLD';b.dataset.goldRecent='1';b.addEventListener('click',()=>void newest());quick.appendChild(b)}
}
function auto(){addControls();const q=new URLSearchParams(location.search);if(q.get('gold')==='1')void newest()}
window.RWARenkoGoldRecentHistory={version:'1.0.0',rule:'dukascopy-same-origin-fixed-s1-bounded-daily-window',stats,get manifest(){return manifest},get index(){return index},loadManifest,loadChunk,apply,older,newer,newest,addControls};
window.addEventListener('renko:tv-ready',auto,{once:true});
if(document.readyState!=='loading')setTimeout(auto,0);else document.addEventListener('DOMContentLoaded',addControls,{once:true});
})();
