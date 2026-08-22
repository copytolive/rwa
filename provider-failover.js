(()=>{
'use strict';
if(window.RWAFailover)return;
let lastPrimary=Date.now(),backup=null,backupActive=false,lastSymbol='';
const $=id=>document.getElementById(id);
const fmt=v=>{const n=Number(v);if(!Number.isFinite(n))return'—';const d=n>=1000?2:n>=1?4:7;return'$'+n.toLocaleString(undefined,{maximumFractionDigits:d})};
const obs=$('statPrice')?new MutationObserver(()=>{if(!backupActive)lastPrimary=Date.now()}):null;obs?.observe($('statPrice'),{childList:true,subtree:true,characterData:true});
function selected(){try{return typeof S!=='undefined'&&S.map?S.map.get(S.selected):null}catch{return null}}
function stop(){try{backup?.close()}catch{}backup=null;backupActive=false;lastPrimary=Date.now()}
function updateTicker(m){const x=selected();if(!x)return;if(m.c){x.price=Number(m.c);x.change=Number(m.P);x.high=Number(m.h);x.low=Number(m.l);x.vol=Number(m.q);if($('statPrice'))$('statPrice').textContent=fmt(x.price);if($('statChange')){$('statChange').textContent=(x.change>=0?'+':'')+x.change.toFixed(2)+'%';$('statChange').className=x.change>=0?'up':'down'}if($('statHigh'))$('statHigh').textContent=fmt(x.high);if($('statLow'))$('statLow').textContent=fmt(x.low)}if(m.b&&m.a){if($('bestBid'))$('bestBid').textContent=fmt(m.b);if($('bestAsk'))$('bestAsk').textContent=fmt(m.a);if($('spread'))$('spread').textContent=fmt(Number(m.a)-Number(m.b))}if(m.p&&$('lastTick'))$('lastTick').textContent=new Date().toLocaleTimeString()}
function start(){const x=selected();if(!x?.symbol)return;if(backup&&lastSymbol===x.symbol)return;stop();lastSymbol=x.symbol;backupActive=true;const s=x.symbol.toLowerCase();backup=new WebSocket(`wss://stream.binance.com:9443/stream?streams=${s}@ticker/${s}@bookTicker/${s}@aggTrade`);backup.onmessage=e=>{try{updateTicker(JSON.parse(e.data).data||{})}catch{}};backup.onerror=()=>{};backup.onclose=()=>{backup=null};window.RWAAudit?.log?.('provider.failover',{symbol:x.symbol,provider:'binance-primary'})}
async function poll(){const x=selected();if(!x)return;const stale=Date.now()-lastPrimary>12000;if(stale&&!backupActive)start();if(backupActive){try{const r=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(x.symbol)}`);if(r.ok){const j=await r.json();updateTicker({c:j.lastPrice,P:j.priceChangePercent,h:j.highPrice,l:j.lowPrice,q:j.quoteVolume})}}catch{}}
 const iframe=document.querySelector('#tvHost iframe');const canvas=$('fallbackChart');document.body.dataset.chartProvider=iframe?'tradingview':canvas?'fallback':'none'}
setInterval(poll,4000);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.RWAFailover={status:()=>({backupActive,lastPrimary,lastSymbol}),force:start,reset:stop};
})();