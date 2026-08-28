/* RENKO pre-bootstrap guards.
 * - Locale safety for POSIX-like browser locale tags.
 * - XAUT/USDT adapter: OKX Spot XAUT-USDT, fixed 1-second candles only.
 *   The base app speaks Binance-shaped REST/WS messages; this adapter translates
 *   only XAUTUSDT. Every other symbol remains on the base Binance transport.
 */
(()=>{
'use strict';
if(!window.RWARenkoLocaleGuard){
  function wrap(proto,key){const native=proto[key];if(typeof native!=='function')return;Object.defineProperty(proto,key,{configurable:true,writable:true,value:function(locales,options){try{return native.call(this,locales,options)}catch(e){if(e instanceof RangeError)return native.call(this,'en-US',options);throw e}}})}
  wrap(Number.prototype,'toLocaleString');wrap(Date.prototype,'toLocaleString');window.RWARenkoLocaleGuard={version:'1.2.0',fallbackLocale:'en-US'};
}
if(window.RWARenkoXAUTProvider)return;
const NF=window.fetch.bind(window),NWS=window.WebSocket;
const SYMBOL='XAUTUSDT',INST='XAUT-USDT',HTTP='https://www.okx.com/api/v5',WS='wss://ws.okx.com:8443/ws/v5/public',STEP=1000;
const stats={restRequests:0,restErrors:0,wsConnections:0,wsMessages:0,lastRestAt:0,lastWsAt:0,lastError:'',provider:'okx-spot',instrument:INST,interval:'1s'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
function isX(u){return !!u&&(/(^|\.)binance\.vision$/i.test(u.hostname)||/(^|\.)binance\.com$/i.test(u.hostname))&&String(u.searchParams.get('symbol')||'').toUpperCase()===SYMBOL}
function jr(v,status=200){return new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-renko-provider':'okx-spot-fixed-1s'}})}
async function oj(path,tries=6){let last;for(let i=0;i<tries;i++){try{stats.restRequests++;stats.lastRestAt=Date.now();const r=await NF(HTTP+path,{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error(`OKX HTTP ${r.status}`);const j=await r.json();if(String(j?.code)!=='0')throw new Error(`OKX ${j?.code}: ${j?.msg||'request failed'}`);return j}catch(e){last=e;stats.restErrors++;stats.lastError=String(e?.message||e);if(i+1<tries)await sleep(140*(i+1))}}throw last||new Error('OKX XAUT market data unavailable')}
function br(x){const t=Number(x?.[0]);return[t,String(x?.[1]),String(x?.[2]),String(x?.[3]),String(x?.[4]),String(x?.[5]??0),t+STEP-1,String(x?.[7]??0),0,'0','0','0']}
async function candles(limit,endMs){limit=Math.max(1,Math.min(1000,Math.floor(Number(limit)||1000)));let cursor=Number.isFinite(Number(endMs))?Math.floor(Number(endMs))+1:Date.now()+2000;const out=new Map();let guard=0;while(out.size<limit&&guard++<8){const n=Math.min(300,limit-out.size);const j=await oj(`/market/history-candles?instId=${encodeURIComponent(INST)}&bar=1s&after=${Math.floor(cursor)}&limit=${n}`);const a=Array.isArray(j?.data)?j.data:[];if(!a.length)break;let oldest=Infinity;for(const x of a){if(String(x?.[8])!=='1')continue;const t=Number(x?.[0]);if(!Number.isFinite(t)||t>=cursor)continue;out.set(t,br(x));oldest=Math.min(oldest,t)}if(!Number.isFinite(oldest))break;cursor=oldest;if(a.length<n)break}return[...out.values()].sort((a,b)=>Number(a[0])-Number(b[0])).slice(-limit)}
window.fetch=async function(input,init={}){const u=urlOf(input);if(!isX(u))return NF(input,init);try{
  if(u.pathname.endsWith('/api/v3/exchangeInfo')){const j=await oj(`/public/instruments?instType=SPOT&instId=${encodeURIComponent(INST)}`),p=j?.data?.[0],tick=Number(p?.tickSz);if(!(tick>0))throw new Error('OKX XAUT tick unavailable');return jr({timezone:'UTC',serverTime:Date.now(),symbols:[{symbol:SYMBOL,status:p?.state==='live'?'TRADING':String(p?.state||''),baseAsset:'XAUT',quoteAsset:'USDT',isSpotTradingAllowed:p?.state==='live',filters:[{filterType:'PRICE_FILTER',tickSize:String(p?.tickSz)}]}]})}
  if(u.pathname.endsWith('/api/v3/ticker/price')){const j=await oj(`/market/ticker?instId=${encodeURIComponent(INST)}`),p=j?.data?.[0];return jr({symbol:SYMBOL,price:String(p?.last??'')})}
  if(u.pathname.endsWith('/api/v3/klines')){const interval=String(u.searchParams.get('interval')||'1s');if(interval!=='1s')return jr({code:-1120,msg:'RENKO production source interval is fixed to 1s'},400);const n=Number(u.searchParams.get('limit')||1000),end=u.searchParams.has('endTime')?Number(u.searchParams.get('endTime')):NaN;return jr(await candles(n,end))}
  return NF(input,init)
}catch(e){stats.lastError=String(e?.message||e);console.error('[RENKO XAUT OKX provider]',e);return jr({code:-1,msg:String(e?.message||e)},502)}};
function emit(t,n,e){try{const f=t[`on${n}`];if(typeof f==='function')f.call(t,e);for(const cb of t._ls?.get(n)||[])try{cb.call(t,e)}catch{}}catch{}}
function bp(x){const t=Number(x?.[0]);return{e:'kline',E:Date.now(),s:SYMBOL,k:{t,T:t+STEP-1,s:SYMBOL,i:'1s',o:String(x?.[1]),h:String(x?.[2]),l:String(x?.[3]),c:String(x?.[4]),v:String(x?.[5]??0),x:String(x?.[8])==='1'}}}
class OWS{
  constructor(url){this.url=String(url);this.readyState=NWS.CONNECTING;this.bufferedAmount=0;this.extensions='';this.protocol='';this.binaryType='blob';this._ls=new Map();this._inner=null;this._closed=false;this._ping=0;this._open()}
  addEventListener(n,cb){if(typeof cb!=='function')return;const s=this._ls.get(n)||new Set();s.add(cb);this._ls.set(n,s)} removeEventListener(n,cb){this._ls.get(n)?.delete(cb)}
  send(d){try{return this._inner?.send(d)}catch{}} close(code,reason){this._closed=true;clearInterval(this._ping);this.readyState=NWS.CLOSING;try{this._inner?.close(code,reason)}catch{}this.readyState=NWS.CLOSED}
  _msg(o){stats.wsMessages++;stats.lastWsAt=Date.now();emit(this,'message',new MessageEvent('message',{data:JSON.stringify(o)}))}
  _open(){stats.wsConnections++;const w=new NWS(WS);this._inner=w;w.onopen=()=>{if(this._closed)return;this.readyState=NWS.OPEN;w.send(JSON.stringify({op:'subscribe',args:[{channel:'candle1s',instId:INST}]}));this._ping=setInterval(()=>{try{if(w.readyState===NWS.OPEN)w.send('ping')}catch{}},20000);emit(this,'open',new Event('open'))};w.onerror=e=>emit(this,'error',e instanceof Event?e:new Event('error'));w.onclose=e=>{clearInterval(this._ping);this.readyState=NWS.CLOSED;emit(this,'close',e)};w.onmessage=e=>{if(e.data==='pong')return;let m;try{m=JSON.parse(e.data)}catch{return}if(m?.event)return;if(m?.arg?.channel!=='candle1s'||m?.arg?.instId!==INST||!Array.isArray(m?.data))return;for(const x of m.data)this._msg(bp(x))}}
}
function WSP(url,protocols){const s=String(url||'');if(/xautusdt@kline_/i.test(s)&&/binance\.(vision|com)/i.test(s)){if(!/kline_1s/i.test(s))throw new Error('RENKO XAUT production timeframe is fixed to 1s');return new OWS(s)}return protocols===undefined?new NWS(url):new NWS(url,protocols)}
for(const k of ['CONNECTING','OPEN','CLOSING','CLOSED'])Object.defineProperty(WSP,k,{value:NWS[k]});WSP.prototype=NWS.prototype;window.WebSocket=WSP;
window.RWARenkoXAUTProvider={version:'2.0.0',symbol:SYMBOL,instrument:INST,provider:'OKX Spot',http:HTTP,ws:WS,stats,intervals:['1s'],fixedInterval:'1s'};
function mark(){const T=window.RWARenkoTV;if(!T||T.state?.symbol!==SYMBOL)return;document.documentElement.dataset.marketProvider='okx-spot';document.documentElement.dataset.fixedInterval='1s';const s=document.querySelector('.pair-title span');if(s)s.textContent='OKX SPOT';const x=document.getElementById('sourceText');if(x&&!x.textContent.includes('OKX XAUT/USDT'))x.textContent=`OKX XAUT/USDT Spot · ${x.textContent}`}
window.addEventListener('renko:tv-ready',mark);setInterval(mark,3000);
})();
