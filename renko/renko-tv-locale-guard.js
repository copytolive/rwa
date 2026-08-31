/* RENKO pre-bootstrap guards.
 * - Locale safety for POSIX-like browser locale tags.
 * - XAUT/USDT adapter: OKX Spot XAUT-USDT, fixed 1-second candles only.
 *   Browser bootstrap reads the repository's same-origin provider-native OKX 1s
 *   pack; realtime continuation stays on the official OKX candle1s WebSocket.
 *   No synthetic bars, interpolation, timeframe substitution, or upsampling.
 */
(()=>{
'use strict';
if(!window.RWARenkoLocaleGuard){
  function wrap(proto,key){const native=proto[key];if(typeof native!=='function')return;Object.defineProperty(proto,key,{configurable:true,writable:true,value:function(locales,options){try{return native.call(this,locales,options)}catch(e){if(e instanceof RangeError)return native.call(this,'en-US',options);throw e}}})}
  wrap(Number.prototype,'toLocaleString');wrap(Date.prototype,'toLocaleString');window.RWARenkoLocaleGuard={version:'1.2.0',fallbackLocale:'en-US'};
}
if(window.RWARenkoXAUTProvider)return;
const NF=window.fetch.bind(window),NWS=window.WebSocket;
const SYMBOL='XAUTUSDT',INST='XAUT-USDT',WS='wss://ws.okx.com:8443/ws/v5/public',STEP=1000,TAIL=6000;
const PACK='xaut-okx-1s-pack.csv.gz?v=2',META='xaut-okx-1s-pack.meta.json?v=2';
const stats={restRequests:0,restErrors:0,wsConnections:0,wsMessages:0,lastRestAt:0,lastWsAt:0,lastError:'',provider:'okx-spot',instrument:INST,interval:'1s',bootstrap:'same-origin-provider-native-pack',packRows:0,packFrom:0,packTo:0,bootstrapRows:0};
let packPromise=null;
function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
function isX(u){return !!u&&(/(^|\.)binance\.vision$/i.test(u.hostname)||/(^|\.)binance\.com$/i.test(u.hostname))&&String(u.searchParams.get('symbol')||'').toUpperCase()===SYMBOL}
function jr(v,status=200){return new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-renko-provider':'okx-spot-fixed-1s-pack'}})}
function validateMeta(m){const p=m?.provenance||{};if(m?.schema!=='renko-xaut-okx-1s-pack-v2'||m?.provider!=='OKX Spot'||m?.instrument!==INST||m?.interval!=='1s'||Number(m?.intervalMs)!==STEP||Number(m?.rows)!==1005000||p?.sourceBar!=='1s'||Number(p?.sourceIntervalMs)!==STEP||p?.upsampled!==false||p?.synthetic1s!==false||p?.continuity!=='provider-native OKX 1s candles')throw new Error('invalid XAUT provider-native fixed-1s pack metadata');return m}
function parseLine(line){const p=String(line||'').trim().split(',');if(p.length<6)return null;const t=Number(p[0]);if(!Number.isFinite(t))return null;return[t,String(p[1]),String(p[2]),String(p[3]),String(p[4]),String(p[5]??0),t+STEP-1,String(p[7]??0),0,'0','0','0']}
function gcd(a,b){a=Math.abs(Math.trunc(a));b=Math.abs(Math.trunc(b));while(b){const t=a%b;a=b;b=t}return a}
function tickFrom(rows){const vals=[];let dec=0;for(const r of rows){for(let i=1;i<=4;i++){const s=String(r[i]??'');const m=s.match(/^(-?)(\d+)(?:\.(\d+))?$/);if(!m)continue;const f=(m[3]||'').replace(/0+$/,'');dec=Math.max(dec,f.length);vals.push(s)}}dec=Math.min(dec,8);const scale=10**dec,toInt=s=>{const neg=String(s).startsWith('-'),q=String(s).replace(/^-/,'').split('.'),whole=Number(q[0]||0),frac=String(q[1]||'').padEnd(dec,'0').slice(0,dec),n=whole*scale+Number(frac||0);return neg?-n:n};const uniq=[...new Set(vals.map(toInt).filter(Number.isSafeInteger))].sort((a,b)=>a-b);let g=0;for(let i=1;i<uniq.length;i++){const d=uniq[i]-uniq[i-1];if(d>0)g=g?gcd(g,d):d;if(g===1)break}const tick=g>0?g/scale:1/scale;if(!(tick>0)&&Number.isFinite(tick))throw new Error('XAUT minimum tick unavailable from provider-native pack');return tick}
async function readPack(){
  if(packPromise)return packPromise;
  packPromise=(async()=>{try{
    stats.restRequests+=2;stats.lastRestAt=Date.now();
    const metaUrl=new URL(META,location.href).href,packUrl=new URL(PACK,location.href).href;
    const [mr,pr]=await Promise.all([NF(metaUrl,{cache:'no-store',credentials:'same-origin'}),NF(packUrl,{cache:'force-cache',credentials:'same-origin'})]);
    if(!mr.ok)throw new Error(`XAUT pack metadata HTTP ${mr.status}`);if(!pr.ok)throw new Error(`XAUT pack HTTP ${pr.status}`);
    const meta=validateMeta(await mr.json());if(typeof DecompressionStream!=='function')throw new Error('DecompressionStream gzip unavailable');
    const reader=pr.body.pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream()).getReader();
    let carry='',lines=[],count=0;const take=line=>{if(!line)return;count++;lines.push(line);if(lines.length>TAIL*2)lines=lines.slice(-TAIL)};
    for(;;){const {value,done}=await reader.read();if(value)carry+=value;let at;while((at=carry.indexOf('\n'))>=0){take(carry.slice(0,at).replace(/\r$/,''));carry=carry.slice(at+1)}if(done)break}take(carry.replace(/\r$/,''));
    if(count!==Number(meta.rows))throw new Error(`XAUT pack row mismatch ${count} != ${meta.rows}`);
    lines=lines.slice(-TAIL);const rows=lines.map(parseLine).filter(Boolean).sort((a,b)=>Number(a[0])-Number(b[0]));if(rows.length<TAIL)throw new Error(`XAUT bootstrap history incomplete ${rows.length}/${TAIL}`);
    for(let i=1;i<rows.length;i++)if(Number(rows[i][0])-Number(rows[i-1][0])!==STEP)throw new Error(`XAUT provider-native 1s discontinuity at ${rows[i][0]}`);
    const tick=tickFrom(rows);stats.packRows=Number(meta.rows);stats.packFrom=Number(meta.fromMs);stats.packTo=Number(meta.toMs);stats.bootstrapRows=rows.length;
    return{meta,rows,tick};
  }catch(e){stats.restErrors++;stats.lastError=String(e?.message||e);packPromise=null;throw e}})();
  return packPromise;
}
async function candles(limit,endMs){const p=await readPack(),rows=p.rows;limit=Math.max(1,Math.min(1000,Math.floor(Number(limit)||1000)));let hi=rows.length;if(Number.isFinite(Number(endMs))){const end=Number(endMs);let lo=0,r=rows.length;while(lo<r){const m=(lo+r)>>1;if(Number(rows[m][0])<=end)lo=m+1;else r=m}hi=lo}return rows.slice(Math.max(0,hi-limit),hi)}
window.fetch=async function(input,init={}){const u=urlOf(input);if(!isX(u))return NF(input,init);try{
  if(u.pathname.endsWith('/api/v3/exchangeInfo')){const p=await readPack();return jr({timezone:'UTC',serverTime:Date.now(),symbols:[{symbol:SYMBOL,status:'TRADING',baseAsset:'XAUT',quoteAsset:'USDT',isSpotTradingAllowed:true,filters:[{filterType:'PRICE_FILTER',tickSize:String(p.tick)}]}]})}
  if(u.pathname.endsWith('/api/v3/ticker/price')){const p=await readPack(),last=p.rows.at(-1);return jr({symbol:SYMBOL,price:String(last?.[4]??'')})}
  if(u.pathname.endsWith('/api/v3/klines')){const interval=String(u.searchParams.get('interval')||'1s');if(interval!=='1s')return jr({code:-1120,msg:'RENKO production source interval is fixed to 1s'},400);const n=Number(u.searchParams.get('limit')||1000),end=u.searchParams.has('endTime')?Number(u.searchParams.get('endTime')):NaN;return jr(await candles(n,end))}
  return NF(input,init)
}catch(e){stats.lastError=String(e?.message||e);console.error('[RENKO XAUT OKX provider-native pack]',e);return jr({code:-1,msg:String(e?.message||e)},502)}};
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
window.RWARenkoXAUTProvider={version:'2.1.0',symbol:SYMBOL,instrument:INST,provider:'OKX Spot',bootstrap:'same-origin provider-native OKX 1s pack',ws:WS,stats,intervals:['1s'],fixedInterval:'1s',synthetic1s:false,upsampled:false};
function mark(){const T=window.RWARenkoTV;if(!T||T.state?.symbol!==SYMBOL)return;document.documentElement.dataset.marketProvider='okx-spot';document.documentElement.dataset.fixedInterval='1s';document.documentElement.dataset.xautBootstrap='provider-native-pack';const s=document.querySelector('.pair-title span');if(s)s.textContent='OKX SPOT';const x=document.getElementById('sourceText');if(x&&!x.textContent.includes('OKX XAUT/USDT'))x.textContent=`OKX XAUT/USDT Spot · provider-native 1s pack + live candle1s · ${x.textContent}`}
window.addEventListener('renko:tv-ready',mark);setInterval(mark,3000);
})();