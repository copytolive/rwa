(()=>{
'use strict';
if(window.__RWA_REALTIME_CORE__)return;window.__RWA_REALTIME_CORE__=true;
const CACHE='rwa_market_universe_v2';
const DETAIL=[
  'wss://data-stream.binance.vision/stream?streams=',
  'wss://stream.binance.com:9443/stream?streams=',
  'wss://stream.binance.com:443/stream?streams='
];
const ALL=[
  'wss://data-stream.binance.vision/ws/!miniTicker@arr',
  'wss://stream.binance.com:9443/ws/!miniTicker@arr',
  'wss://stream.binance.com:443/ws/!miniTicker@arr'
];
let detailAttempt=0,allAttempt=0,detailRetry=0,allRetry=0,lastDetailMessage=0;
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
function seed(){
  if(typeof S==='undefined')return;
  let x=S.map?.get('BTCUSDT');
  if(!x){x={symbol:'BTCUSDT',base:'BTC',quote:'USDT',price:null,open:null,change:null,high:null,low:null,vol:null,rwa:false};S.pairs=[x,...(S.pairs||[]).filter(p=>p.symbol!=='BTCUSDT')];S.map=new Map((S.pairs||[]).map(p=>[p.symbol,p]));}
  try{const c=JSON.parse(localStorage.getItem(CACHE)||'null');if(c&&Array.isArray(c.pairs)&&c.pairs.length>10&&Date.now()-Number(c.ts||0)<12*60*60*1000){S.pairs=c.pairs;S.map=new Map(c.pairs.map(p=>[p.symbol,p]));}}
  catch(_){ }
  try{renderPairs();renderMovers();const p=S.map.get(S.selected);if(p)renderHeader(p)}catch(_){ }
}
function ensurePair(sym){
  let x=S.map.get(sym);if(x)return x;
  const base=sym.endsWith('USDT')?sym.slice(0,-4):sym;
  x={symbol:sym,base,quote:'USDT',price:null,open:null,change:null,high:null,low:null,vol:null,rwa:typeof RWA!=='undefined'&&RWA.has(base)};
  S.pairs.unshift(x);S.map.set(sym,x);return x;
}
function live(msg){try{setLive(true,msg||'LIVE · realtime core')}catch(_){}}
function detailMessage(m){
  lastDetailMessage=Date.now();
  try{
    if(m.e==='24hrTicker'){
      const x=ensurePair(m.s||S.selected);x.price=n(m.c);x.change=n(m.P);x.high=n(m.h);x.low=n(m.l);x.vol=n(m.q);renderHeader(x);updatePairDOM(x,null);live('LIVE · '+x.base+'/USDT');
    }else if(m.e==='aggTrade')addTrade(m);
    else if(Array.isArray(m.bids)&&Array.isArray(m.asks))renderBook(m.bids,m.asks);
    else if(m.e==='depthUpdate'&&m.b&&m.a)renderBook(m.b,m.a);
    else if(m.s&&m.b&&m.a){
      const b=n(m.b),a=n(m.a);if(document.getElementById('bestBid'))document.getElementById('bestBid').textContent=price(m.b);if(document.getElementById('bestAsk'))document.getElementById('bestAsk').textContent=price(m.a);if(document.getElementById('spread'))document.getElementById('spread').textContent=b&&a?(((a-b)/((a+b)/2))*100).toFixed(4)+'%':'—';
    }
  }catch(e){console.warn('detail event',e)}
}
window.connectDetail=function(force=false){
  if(typeof S==='undefined')return;
  const old=S.detailWS;if(!force&&old&&old.__rwaSymbol===S.selected&&old.readyState<=1)return;
  if(old){old.__rwaManual=true;try{old.close()}catch(_){}}
  clearTimeout(detailRetry);
  const l=S.selected.toLowerCase(),streams=`${l}@ticker/${l}@bookTicker/${l}@depth10@100ms/${l}@aggTrade`,url=DETAIL[detailAttempt%DETAIL.length]+streams;
  let opened=false,settled=false;
  const ws=new WebSocket(url);ws.__rwaSymbol=S.selected;ws.__rwaEndpoint=detailAttempt%DETAIL.length;S.detailWS=ws;
  const watchdog=setTimeout(()=>{if(!opened&&S.detailWS===ws){try{ws.close()}catch(_){}}},2400);
  ws.onopen=()=>{opened=true;clearTimeout(watchdog);live(`LIVE · feed ${ws.__rwaEndpoint+1}/${DETAIL.length}`)};
  ws.onmessage=e=>{try{const p=JSON.parse(e.data),m=p.data||p;detailMessage(m)}catch(_){}};
  ws.onerror=()=>{try{ws.close()}catch(_){}};
  ws.onclose=()=>{clearTimeout(watchdog);if(ws.__rwaManual||S.detailWS!==ws)return;detailAttempt=(detailAttempt+1)%DETAIL.length;detailRetry=setTimeout(()=>connectDetail(true),350)};
};
window.connectAllTicker=function(force=false){
  if(typeof S==='undefined')return;
  const old=S.marketWS;if(!force&&old&&old.readyState<=1)return;
  if(old){old.__rwaManual=true;try{old.close()}catch(_){}}
  clearTimeout(allRetry);
  const ws=new WebSocket(ALL[allAttempt%ALL.length]);S.marketWS=ws;let opened=false;
  const watchdog=setTimeout(()=>{if(!opened&&S.marketWS===ws){try{ws.close()}catch(_){}}},2600);
  ws.onopen=()=>{opened=true;clearTimeout(watchdog);live(`LIVE · market feed ${allAttempt%ALL.length+1}/${ALL.length}`)};
  ws.onmessage=e=>{try{const arr=JSON.parse(e.data);if(!Array.isArray(arr))return;for(const t of arr){const x=S.map.get(t.s);if(!x)continue;const oldPx=x.price;x.price=n(t.c);x.open=n(t.o);x.high=n(t.h);x.low=n(t.l);x.vol=n(t.q);if(x.open)x.change=(x.price-x.open)/x.open*100;updatePairDOM(x,oldPx);if(t.s===S.selected)renderHeader(x)}if(typeof renderMoversThrottled==='function')renderMoversThrottled()}catch(_){}};
  ws.onerror=()=>{try{ws.close()}catch(_){}};
  ws.onclose=()=>{clearTimeout(watchdog);if(ws.__rwaManual||S.marketWS!==ws)return;allAttempt=(allAttempt+1)%ALL.length;allRetry=setTimeout(()=>connectAllTicker(true),650)};
};
// TradingView can never block the app. Keep the original available only as an explicit opt-in enhancement.
const tv=typeof loadTradingView==='function'?loadTradingView:null;
window.RWAOpenTradingView=()=>{if(tv)tv()};
if(typeof loadTradingView==='function')loadTradingView=function(){return null};
if(typeof reloadChart==='function')reloadChart=function(){try{loadKlines()}catch(_){}};
function persistUniverse(){try{if(S.pairs?.length>10)localStorage.setItem(CACHE,JSON.stringify({ts:Date.now(),pairs:S.pairs.slice(0,1200)}))}catch(_){}}
function prefetchFeatures(){
  const a=['suite.css?v=1','suite-ui.js?v=1','suite.js?v=1','suite-nav.js?v=1','ops.css?v=1','walletconnect.js?v=2','ops-suite.js?v=1','risk-hardening.js?v=1','provider-failover.js?v=2','monitor-client.js?v=2','social-safety-patch.js?v=2','suite-execution-patch.js?v=4','wallet-auth.js?v=2','audit-hooks.js?v=2','rwa-verify-client.js?v=1'];
  for(const href of a){if(document.querySelector(`link[data-rwa-prefetch="${href}"]`))continue;const l=document.createElement('link');l.rel='prefetch';l.href=href;l.as=href.includes('.css')?'style':'script';l.dataset.rwaPrefetch=href;document.head.appendChild(l)}
}
seed();
try{connectDetail(true);loadKlines();}catch(_){ }
setTimeout(()=>{try{connectAllTicker(true)}catch(_){ }},50);
setInterval(persistUniverse,3000);
window.addEventListener('load',()=>setTimeout(prefetchFeatures,700),{once:true});
})();