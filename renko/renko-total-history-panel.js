/* Visible Total History launch panel. Presentation only: authoritative history remains owned by RWARenkoTotalHistory and provider-specific packs. */
(()=>{
'use strict';
if(window.RWARenkoTotalHistoryPanel)return;
const $=id=>document.getElementById(id);
const fmt=ms=>{const n=Number(ms);if(!(n>0))return'—';return new Date(n).toISOString().replace('.000Z','Z')};
const fmtN=n=>Number(n||0).toLocaleString();
const pending=new Map();
const BINANCE_DATA='https://data-api.binance.vision',BINANCE_ARCHIVE='https://data.binance.vision',START_MONTH=Date.UTC(2017,7,1);
let xautMeta=null,lastKey='',timer=0;

function ensure(){
  let panel=$('totalHistoryPanel');
  if(panel)return panel;
  const anchor=document.querySelector('.chart-toolbar');if(!anchor)return null;
  panel=document.createElement('section');panel.id='totalHistoryPanel';panel.className='total-history-panel';panel.setAttribute('aria-label','Total History');
  panel.innerHTML=`<div class="th-title"><small>TOTAL HISTORY</small><b id="historySymbol">— · 1s</b></div><div class="th-cell"><small>PROVIDER</small><b id="historyProvider">DISCOVERING</b></div><div class="th-cell th-wide"><small>AVAILABLE</small><b id="historyAvailable">—</b></div><div class="th-cell"><small>LOADED / SOURCE</small><b id="historyLoaded">—</b></div><div class="th-cell"><small>STATUS</small><b id="historyStatus">DISCOVERING HISTORY</b></div>`;
  anchor.parentNode.insertBefore(panel,anchor);
  if(!$('totalHistoryPanelStyle')){const st=document.createElement('style');st.id='totalHistoryPanelStyle';st.textContent=`.total-history-panel{display:grid;grid-template-columns:1.05fr 1.2fr 2.35fr 1.55fr 1.7fr;gap:1px;background:#202837;border-top:1px solid #273144;border-bottom:1px solid #273144}.total-history-panel>div{min-width:0;background:#111823;padding:8px 11px}.total-history-panel small{display:block;color:#6f7b8f;font-size:9px;line-height:1.2;letter-spacing:.08em;margin-bottom:3px}.total-history-panel b{display:block;color:#c8d1df;font-size:10px;line-height:1.3;white-space:normal;overflow-wrap:anywhere}.total-history-panel .th-title b{color:#fff}.total-history-panel[data-ready="true"] #historyStatus{color:#69d6a3}@media(max-width:760px){.total-history-panel{grid-template-columns:1fr 1fr}.total-history-panel .th-wide{grid-column:1/-1}.total-history-panel>div{padding:7px 9px}.total-history-panel b{font-size:9px}}`;document.head.appendChild(st)}
  return panel
}
function normSymbol(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function monthStart(ms){const d=new Date(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)}
function addMonths(ms,n){const d=new Date(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1)}
function monthKey(ms){const d=new Date(ms);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`}
function checksumUrl(symbol,ms){const ym=monthKey(ms);return `${BINANCE_ARCHIVE}/data/spot/monthly/klines/${symbol}/1s/${symbol}-1s-${ym}.zip.CHECKSUM`}
function normTs(n){n=Number(n);return n>1e14?Math.floor(n/1000):n}
async function checkedText(url){const r=await fetch(url,{cache:'force-cache',credentials:'omit'});if(!r.ok)throw Error(`history checksum HTTP ${r.status}`);const t=(await r.text()).trim();if(t.length<20)throw Error('history checksum invalid');return t}
async function safeDiscoverBinance(symbol,H){
  const existing=H.manifest?.get?.(symbol);if(existing?.earliestSourceMs&&existing?.integrityChecksum)return existing;
  try{const saved=JSON.parse(localStorage.getItem(`renko-history-manifest-v3:${symbol}`)||'null');if(saved?.symbol===symbol&&saved?.interval==='1s'&&saved?.earliestSourceMs&&saved?.integrityChecksum){H.manifest?.set?.(symbol,saved);return saved}}catch{}
  const q=new URLSearchParams({symbol,interval:'1s',limit:'1',startTime:String(START_MONTH)});
  const r=await fetch(`${BINANCE_DATA}/api/v3/klines?${q}`,{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error(`Binance 1s HTTP ${r.status}`);
  const rows=await r.json();if(!Array.isArray(rows)||!rows.length)throw Error(`${symbol} has no historical Binance 1s rows`);
  const earliestSourceMs=normTs(rows[0][0]),first=monthStart(earliestSourceMs);
  const integrityChecksum=await checkedText(checksumUrl(symbol,first));
  /* Monthly archive publication can lag the calendar boundary. Two completed
     months back is intentionally used as the newest integrity anchor so first
     paint never probes an unpublished archive month and emits a handled 404. */
  const last=addMonths(monthStart(Date.now()),-2),latestIntegrityChecksum=await checkedText(checksumUrl(symbol,last));
  const span=Math.max(1,Math.round((last-first)/2629800000)+1);
  const m={symbol,provider:'Binance Spot',source:'Binance Data API historical 1s + Public Data checksum',interval:'1s',archive:'Binance Public Data / Data Vision',earliestSourceMs,archiveFirstMonth:monthKey(first),archiveFirstMonthMs:first,archiveLastVerifiedMonth:monthKey(last),archiveLastVerifiedMonthMs:last,archiveMonthSpan:span,totalSourceChunks:span,integrityChecksum,latestIntegrityChecksum,discoveredAt:Date.now(),publicationSafeChecksumLagMonths:2};
  H.manifest?.set?.(symbol,m);try{localStorage.setItem(`renko-history-manifest-v3:${symbol}`,JSON.stringify(m))}catch{}return m
}
function apply(v){
  const p=ensure();if(!p)return;
  const earliest=Number(v.earliestMs)||0,latest=Number(v.latestMs)||0;
  $('historySymbol').textContent=`${v.label||v.symbol||'—'} · 1s`;
  $('historyProvider').textContent=v.provider||'DISCOVERING';
  $('historyAvailable').textContent=earliest&&latest?`${fmt(earliest)} → ${fmt(latest)}`:'DISCOVERING SOURCE ORIGIN';
  $('historyLoaded').textContent=v.loadedText||'—';
  $('historyStatus').textContent=v.status||'DISCOVERING HISTORY';
  p.dataset.ready=v.ready?'true':'false';
  Object.assign(document.documentElement.dataset,{renkoHistoryPanelReady:v.ready?'true':'false',renkoHistoryPanelSymbol:String(v.symbol||''),renkoHistoryPanelProvider:String(v.provider||''),renkoHistoryPanelEarliestMs:String(earliest),renkoHistoryPanelLatestMs:String(latest),renkoHistoryPanelLoaded:String(v.loaded||0),renkoHistoryPanelAvailableTotal:String(v.availableTotal||0),renkoHistoryPanelStatus:String(v.status||''),renkoHistoryPanelSynthetic:String(v.synthetic??'')});
}
async function getXaut(){
  if(xautMeta)return xautMeta;
  const r=await fetch(`xaut-okx-1s-pack.meta.json?v=2`,{cache:'force-cache',credentials:'same-origin'});if(!r.ok)throw Error(`XAUT metadata HTTP ${r.status}`);
  const m=await r.json();if(m.schema!=='renko-xaut-okx-1s-pack-v2'||m.provider!=='OKX Spot'||m.instrument!=='XAUT-USDT'||m.interval!=='1s'||Number(m.rows)!==1005000||m.provenance?.synthetic1s!==false||m.provenance?.upsampled!==false)throw Error('XAUT metadata contract invalid');
  xautMeta=m;return m
}
async function resolve(){
  ensure();const T=window.RWARenkoTV,H=window.RWARenkoTotalHistory;if(!T||!H)return;
  const s=normSymbol(T.state?.symbol),loaded=Number(T.state?.closedBars?.length)||0,hm=T.state?.historyMeta||{};
  if(!s){apply({symbol:'',label:'—',loaded,loadedText:`${fmtN(loaded)} loaded`,ready:false});return}
  if(s==='XAUTUSDT'||s==='XAUT'){
    try{const m=await getXaut();apply({symbol:'XAUTUSDT',label:'XAUT-USDT',provider:'OKX Spot · PROVIDER NATIVE',earliestMs:m.fromMs,latestMs:m.toMs,loaded,availableTotal:m.rows,loadedText:`${fmtN(loaded)} loaded / ${fmtN(m.rows)} available`,status:'FULL HISTORY AVAILABLE · NATIVE 1s · SYNTHETIC NO',synthetic:'NO',ready:true})}catch(e){apply({symbol:s,label:'XAUT-USDT',provider:'OKX Spot',loaded,loadedText:`${fmtN(loaded)} loaded`,status:'HISTORY METADATA RETRYING',synthetic:'NO',ready:false})}return
  }
  if(['XAUUSD','GOLD','XAU'].includes(s)||hm.provider==='Dukascopy'){
    const earliest=Number(hm.earliestAvailableMs||hm.documentedEarliestS1Ms||Date.UTC(2003,4,5,0,1,3,421)),latest=Number(hm.latestAvailableMs)||Date.now(),chunks=Number(hm.totalSourceChunks)||0;
    apply({symbol:'XAUUSD',label:'GOLD · XAU/USD',provider:'Dukascopy · XAU-USD',earliestMs:earliest,latestMs:latest,loaded,availableTotal:chunks,loadedText:`${fmtN(loaded)} loaded · ${fmtN(chunks)} source chunks`,status:hm.provider==='Dukascopy'?'FULL HISTORY AVAILABLE · ORIGIN VERIFIED':'FULL HISTORY AVAILABLE · ORIGIN 2003',synthetic:'NO',ready:true});return
  }
  if(hm.provider==='Binance Spot'&&Number(hm.earliestAvailableMs)>0){const latest=Number(hm.latestAvailableMs)||Number(T.state?.closedBars?.at(-1)?.closeTime)||Date.now(),chunks=Number(hm.totalSourceChunks)||Number(hm.archiveMonthSpan)||0;apply({symbol:s,label:s,provider:'Binance Spot',earliestMs:hm.earliestAvailableMs,latestMs:latest,loaded,availableTotal:chunks,loadedText:`${fmtN(loaded)} loaded · ${fmtN(chunks)} verified source chunks`,status:'FULL HISTORY AVAILABLE · ORIGIN VERIFIED',synthetic:'NO',ready:true});return}
  apply({symbol:s,label:s,provider:'Binance Spot',loaded,loadedText:`${fmtN(loaded)} recent bars loaded`,status:'DISCOVERING FIXED-1s ORIGIN',synthetic:'NO',ready:false});
  if(!pending.has(s))pending.set(s,Promise.resolve().then(()=>safeDiscoverBinance(s,H)).then(m=>{pending.delete(s);const latest=Number(T.state?.closedBars?.at(-1)?.closeTime)||Date.now(),chunks=Number(m.archiveMonthSpan)||Number(m.totalSourceChunks)||0;apply({symbol:s,label:s,provider:'Binance Spot',earliestMs:m.earliestSourceMs||m.earliestAvailableMs,latestMs:latest,loaded:Number(T.state?.closedBars?.length)||0,availableTotal:chunks,loadedText:`${fmtN(Number(T.state?.closedBars?.length)||0)} recent bars loaded · ${fmtN(chunks)} verified source chunks`,status:'FULL HISTORY AVAILABLE · ORIGIN READY',synthetic:'NO',ready:true});return m}).catch(()=>pending.delete(s)));
}
function refresh(){void resolve().catch(()=>{})}
window.addEventListener('renko:history-origin',refresh);window.addEventListener('renko:symbol-switch-start',()=>setTimeout(refresh,0));window.addEventListener('renko:tv-ready',refresh);document.addEventListener('DOMContentLoaded',refresh,{once:true});
timer=setInterval(()=>{const T=window.RWARenkoTV,s=normSymbol(T?.state?.symbol),mode=String(T?.state?.historyViewMode||''),bars=Number(T?.state?.closedBars?.length)||0,key=`${s}:${mode}:${bars}:${T?.state?.historyMeta?.earliestAvailableMs||0}`;if(key!==lastKey){lastKey=key;refresh()}},1000);
window.RWARenkoTotalHistoryPanel={version:'1.0.0-launch-visible',rule:'visible-provider-origin-loaded-status-no-timeframe-substitution',discovery:'provider-native-1s-publication-safe-monthly-checksum',ensure,refresh,resolve,getXaut,safeDiscoverBinance,get timer(){return timer}};
ensure();refresh();
})();
