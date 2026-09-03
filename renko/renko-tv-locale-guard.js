/* RENKO pre-bootstrap guards.
 * - Locale safety for POSIX-like browser locale tags.
 * - XAUT/USDT adapter: OKX Spot XAUT-USDT, fixed 1-second candles only.
 *   Browser bootstrap reads the repository's same-origin provider-native OKX 1s
 *   pack. Official OKX history-candles 1s catch-up is best-effort only because
 *   browser CORS policy can block it; realtime continues on the official OKX
 *   candle1s WebSocket. No synthetic bars, interpolation, timeframe
 *   substitution, or upsampling.
 */
(()=>{
'use strict';
if(!window.RWARenkoLocaleGuard){
  function wrap(proto,key){const native=proto[key];if(typeof native!=='function')return;Object.defineProperty(proto,key,{configurable:true,writable:true,value:function(locales,options){try{return native.call(this,locales,options)}catch(e){if(e instanceof RangeError)return native.call(this,'en-US',options);throw e}}})}
  wrap(Number.prototype,'toLocaleString');wrap(Date.prototype,'toLocaleString');window.RWARenkoLocaleGuard={version:'1.2.0',fallbackLocale:'en-US'};
}
if(window.RWARenkoXAUTProvider)return;
const NF=window.fetch.bind(window),NWS=window.WebSocket;
const SYMBOL='XAUTUSDT',INST='XAUT-USDT',WS='wss://ws.okx.com:8443/ws/v5/public',REST='https://www.okx.com/api/v5/market/history-candles',STEP=1000,TAIL=6000;
const PACK='xaut-okx-1s-pack.csv.gz?v=2',META='xaut-okx-1s-pack.meta.json?v=2';
const stats={restRequests:0,restErrors:0,wsConnections:0,wsMessages:0,lastRestAt:0,lastWsAt:0,lastError:'',provider:'okx-spot',instrument:INST,interval:'1s',bootstrap:'same-origin-provider-native-pack+best-effort-official-okx-rest-catchup',packRows:0,packFrom:0,packTo:0,bootstrapRows:0,catchupRequests:0,catchupRows:0,catchupFrom:0,catchupTo:0,catchupStatus:'idle'};
let packPromise=null,atrWarmWrapped=false;
function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
function isX(u){return !!u&&(/(^|\.)binance\.vision$/i.test(u.hostname)||/(^|\.)binance\.com$/i.test(u.hostname))&&String(u.searchParams.get('symbol')||'').toUpperCase()===SYMBOL}
function jr(v,status=200){return new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-renko-provider':'okx-spot-fixed-1s-pack'}})}
function validateMeta(m){const p=m?.provenance||{};if(m?.schema!=='renko-xaut-okx-1s-pack-v2'||m?.provider!=='OKX Spot'||m?.instrument!==INST||m?.interval!=='1s'||Number(m?.intervalMs)!==STEP||Number(m?.rows)!==1005000||p?.sourceBar!=='1s'||Number(p?.sourceIntervalMs)!==STEP||p?.upsampled!==false||p?.synthetic1s!==false||p?.continuity!=='provider-native OKX 1s candles')throw new Error('invalid XAUT provider-native fixed-1s pack metadata');return m}
function parseLine(line){const p=String(line||'').trim().split(',');if(p.length<6)return null;const t=Number(p[0]);if(!Number.isFinite(t))return null;return[t,String(p[1]),String(p[2]),String(p[3]),String(p[4]),String(p[5]??0),t+STEP-1,String(p[7]??0),0,'0','0','0']}
function okxRow(x){if(!Array.isArray(x)||x.length<5)return null;const t=Number(x[0]);if(!Number.isFinite(t))return null;return[t,String(x[1]),String(x[2]),String(x[3]),String(x[4]),String(x[5]??0),t+STEP-1,String(x[7]??0),0,'0','0','0']}
function barOf(x){return{openTime:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[5])||0,closeTime:Number(x[6])}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function gcd(a,b){a=Math.abs(Math.trunc(a));b=Math.abs(Math.trunc(b));while(b){const t=a%b;a=b;b=t}return a}
function tickFrom(rows){const vals=[];let dec=0;for(const r of rows){for(let i=1;i<=4;i++){const s=String(r[i]??'');const m=s.match(/^(-?)(\d+)(?:\.(\d+))?$/);if(!m)continue;const f=(m[3]||'').replace(/0+$/,'');dec=Math.max(dec,f.length);vals.push(s)}}dec=Math.min(dec,8);const scale=10**dec,toInt=s=>{const neg=String(s).startsWith('-'),q=String(s).replace(/^-/,'').split('.'),whole=Number(q[0]||0),frac=String(q[1]||'').padEnd(dec,'0').slice(0,dec),n=whole*scale+Number(frac||0);return neg?-n:n};const uniq=[...new Set(vals.map(toInt).filter(Number.isSafeInteger))].sort((a,b)=>a-b);let g=0;for(let i=1;i<uniq.length;i++){const d=uniq[i]-uniq[i-1];if(d>0)g=g?gcd(g,d):d;if(g===1)break}const tick=g>0?g/scale:1/scale;if(!(tick>0)&&Number.isFinite(tick))throw new Error('XAUT minimum tick unavailable from provider-native pack');return tick}
async function fetchCatchup(packTo){
  const byTime=new Map(),target=Number(packTo),now=Math.floor(Date.now()/STEP)*STEP;
  if(!(target>0)||now-target<=STEP*2)return[];
  let cursor=now+STEP,pages=0,done=false;
  while(cursor>target+STEP&&!done){
    const u=new URL(REST);u.searchParams.set('instId',INST);u.searchParams.set('bar','1s');u.searchParams.set('after',String(cursor));u.searchParams.set('limit','300');
    let r=null;
    for(let attempt=0;attempt<4;attempt++){
      stats.restRequests++;stats.catchupRequests++;stats.lastRestAt=Date.now();
      r=await NF(u.href,{cache:'no-store',credentials:'omit'});
      if(r.status!==429)break;
      await sleep(2200*(attempt+1));
    }
    if(!r?.ok)throw new Error(`XAUT OKX 1s catch-up HTTP ${r?.status||0}`);
    const j=await r.json();if(String(j?.code)!=='0'||!Array.isArray(j?.data))throw new Error(`XAUT OKX 1s catch-up API ${j?.code??'invalid'} ${j?.msg||''}`.trim());
    const page=j.data.map(okxRow).filter(Boolean).filter(x=>Number(x[0])>target&&Number(x[0])<cursor).sort((a,b)=>Number(a[0])-Number(b[0]));
    if(!page.length)break;
    for(const row of page)byTime.set(Number(row[0]),row);
    const oldest=Number(page[0][0]);
    if(oldest<=target+STEP){done=true;break}
    if(!(oldest<cursor))throw new Error('XAUT OKX 1s catch-up pagination stalled');
    cursor=oldest;pages++;
    if(pages>5000)throw new Error('XAUT OKX 1s catch-up exceeded safety page limit');
    if(pages%18===0)await sleep(2100);
  }
  const rows=[...byTime.values()].sort((a,b)=>Number(a[0])-Number(b[0]));
  if(!rows.length)throw new Error(`XAUT OKX 1s catch-up unavailable after ${target}`);
  if(Number(rows[0][0])!==target+STEP)throw new Error(`XAUT OKX 1s catch-up gap ${target} -> ${rows[0][0]}`);
  for(let i=1;i<rows.length;i++)if(Number(rows[i][0])-Number(rows[i-1][0])!==STEP)throw new Error(`XAUT OKX provider-native 1s catch-up discontinuity at ${rows[i][0]}`);
  stats.catchupRows=rows.length;stats.catchupFrom=Number(rows[0][0]);stats.catchupTo=Number(rows.at(-1)[0]);stats.catchupStatus='ok';
  return rows;
}
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
    lines=lines.slice(-TAIL);const staticRows=lines.map(parseLine).filter(Boolean).sort((a,b)=>Number(a[0])-Number(b[0]));if(staticRows.length<TAIL)throw new Error(`XAUT bootstrap history incomplete ${staticRows.length}/${TAIL}`);
    for(let i=1;i<staticRows.length;i++)if(Number(staticRows[i][0])-Number(staticRows[i-1][0])!==STEP)throw new Error(`XAUT provider-native 1s discontinuity at ${staticRows[i][0]}`);
    let catchup=[];
    try{stats.catchupStatus='attempting';catchup=await fetchCatchup(Number(meta.toMs));if(!catchup.length)stats.catchupStatus='not-needed'}catch(e){stats.restErrors++;stats.lastError=String(e?.message||e);stats.catchupStatus='unavailable-cors-or-network';catchup=[];console.warn('[RENKO XAUT OKX catch-up unavailable; using verified native pack]',e)}
    const merged=new Map(staticRows.map(r=>[Number(r[0]),r]));for(const r of catchup)merged.set(Number(r[0]),r);
    const rows=[...merged.values()].sort((a,b)=>Number(a[0])-Number(b[0]));
    for(let i=1;i<rows.length;i++)if(Number(rows[i][0])-Number(rows[i-1][0])!==STEP)throw new Error(`XAUT provider-native bootstrap discontinuity at ${rows[i][0]}`);
    const tick=tickFrom(rows);stats.packRows=Number(meta.rows);stats.packFrom=Number(meta.fromMs);stats.packTo=Number(meta.toMs);stats.bootstrapRows=rows.length;
    return{meta,rows,tick,catchup,catchupBars:catchup.map(barOf)};
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
window.RWARenkoXAUTProvider={version:'2.2.1-cors-safe',symbol:SYMBOL,instrument:INST,provider:'OKX Spot',bootstrap:'same-origin provider-native OKX 1s pack; official OKX 1s REST catch-up best-effort; live candle1s WebSocket',rest:REST,ws:WS,stats,intervals:['1s'],fixedInterval:'1s',synthetic1s:false,upsampled:false,catchupBars:async()=>{const p=await readPack();return p.catchupBars.slice()}};
function wrapATRWarm(){
  if(atrWarmWrapped)return;const A=window.RWARenkoATRFixed1s;if(!A||typeof A.warm!=='function')return;const native=A.warm.bind(A);
  A.warm=async function(T=window.RWARenkoTV){
    if(!T||T.state?.symbol!==SYMBOL)return native(T);
    const p=await readPack();if(!p.catchupBars.length)return native(T);
    const original=T.state.closedBars;let pending;
    try{T.state.closedBars=p.catchupBars;pending=native(T)}finally{T.state.closedBars=original}
    return pending;
  };
  atrWarmWrapped=true;
}
function mark(){const T=window.RWARenkoTV;if(!T||T.state?.symbol!==SYMBOL)return;document.documentElement.dataset.marketProvider='okx-spot';document.documentElement.dataset.fixedInterval='1s';document.documentElement.dataset.xautBootstrap=stats.catchupRows>0?'provider-native-pack-rest-catchup':'provider-native-pack';const s=document.querySelector('.pair-title span');if(s)s.textContent='OKX SPOT';const x=document.getElementById('sourceText');if(x&&!x.textContent.includes('OKX XAUT/USDT'))x.textContent=`OKX XAUT/USDT Spot · provider-native 1s pack + live candle1s${stats.catchupRows>0?' · REST catch-up verified':''} · ${x.textContent}`}
window.addEventListener('renko:tv-ready',()=>{wrapATRWarm();mark()});setInterval(()=>{wrapATRWarm();mark()},1000);
})();
