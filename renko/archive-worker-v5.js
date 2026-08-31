/* RWA Renko V5 raw-tick lifetime backfill worker.
 * Historical source: Binance Vision SPOT /trades archives only.
 * Live continuation is handled by renko-v3.js @trade.
 * No candle/OHLC/kline/aggTrade source is accepted here.
 */
'use strict';
let cancelled=false;
const MAX_MONTHLY_COMPRESSED=96*1024*1024;
const START_UTC=Date.UTC(2017,6,1);
const pad=n=>String(n).padStart(2,'0');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function post(type,data={}){self.postMessage({type,...data})}
function normMs(t){const n=Number(t);if(!Number.isFinite(n))return 0;return n>1e14?Math.floor(n/1000):n}
function monthKey(d){return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`}
function monthDays(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate()}
function monthlyPath(symbol,y,m){return `/data/spot/monthly/trades/${symbol}/${symbol}-trades-${y}-${pad(m)}.zip`}
function dailyPath(symbol,y,m,d){return `/data/spot/daily/trades/${symbol}/${symbol}-trades-${y}-${pad(m)}-${pad(d)}.zip`}
function totalFromHeaders(r){const cr=r.headers.get('content-range')||'';const m=cr.match(/\/(\d+)$/);if(m)return Number(m[1]);return Number(r.headers.get('content-length')||0)}
async function probeArchive(url){try{const r=await fetch(url,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{Range:'bytes=0-0'},signal:AbortSignal.timeout(20000)});const len=totalFromHeaders(r);try{await r.body?.cancel()}catch{}return {status:r.status,ok:r.ok,len}}catch(e){return {status:0,ok:false,len:0,error:e.message}}}
async function chooseBase(bases){const path=monthlyPath('BTCUSDT',2017,8),candidates=['https://data.binance.vision',...bases.filter(x=>x!=='https://data.binance.vision')];for(const base of candidates){const p=await probeArchive(base+path);if(p.ok)return base}throw Error('No browser-accessible raw tick archive source.')}
async function discover(base,symbol){
  const yesterday=new Date(Date.now()-86400000);yesterday.setUTCHours(0,0,0,0);
  const currentMonth=Date.UTC(yesterday.getUTCFullYear(),yesterday.getUTCMonth(),1);
  const months=[];
  for(let t=START_UTC;t<currentMonth;t=Date.UTC(new Date(t).getUTCFullYear(),new Date(t).getUTCMonth()+1,1)){
    const d=new Date(t);months.push({t,y:d.getUTCFullYear(),m:d.getUTCMonth()+1});
  }
  const probes=new Array(months.length);let cursor=0,doneProbe=0;
  async function lane(){while(true){const i=cursor++;if(i>=months.length)return;if(cancelled)throw Error('cancelled');const x=months[i],path=monthlyPath(symbol,x.y,x.m);probes[i]=await probeArchive(base+path);doneProbe++;if(doneProbe%8===0||doneProbe===months.length)post('discover',{probed:doneProbe,plan:0,month:monthKey(new Date(x.t))})}}
  await Promise.all(Array.from({length:Math.min(10,months.length)},()=>lane()));
  const plan=[];let seen=false;
  for(let i=0;i<months.length;i++){
    const x=months[i],h=probes[i],path=monthlyPath(symbol,x.y,x.m);
    if(h?.ok){seen=true;if(h.len>0&&h.len<=MAX_MONTHLY_COMPRESSED)plan.push({kind:'monthly',key:`M:${x.y}-${pad(x.m)}`,path,size:h.len,required:true});else for(let day=1;day<=monthDays(x.y,x.m);day++)plan.push({kind:'daily',key:`D:${x.y}-${pad(x.m)}-${pad(day)}`,path:dailyPath(symbol,x.y,x.m,day),size:0,required:true})}
    else if(seen){for(let day=1;day<=monthDays(x.y,x.m);day++)plan.push({kind:'daily',key:`D:${x.y}-${pad(x.m)}-${pad(day)}`,path:dailyPath(symbol,x.y,x.m,day),size:0,required:true})}
  }
  const cy=yesterday.getUTCFullYear(),cm=yesterday.getUTCMonth()+1,cd=yesterday.getUTCDate();
  for(let day=1;day<=cd;day++)plan.push({kind:'daily',key:`D:${cy}-${pad(cm)}-${pad(day)}`,path:dailyPath(symbol,cy,cm,day),size:0,required:true});
  return {plan,yesterday:yesterday.getTime(),seen};
}
function findEocd(bytes){for(let i=bytes.length-22,j=Math.max(0,bytes.length-65557);i>=j;i--)if(bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===0x05&&bytes[i+3]===0x06)return i;return -1}
function zipEntry(buffer){const u=new Uint8Array(buffer),v=new DataView(buffer),e=findEocd(u);if(e<0)throw Error('ZIP end record missing');const cd=v.getUint32(e+16,true);if(v.getUint32(cd,true)!==0x02014b50)throw Error('ZIP central directory invalid');const method=v.getUint16(cd+10,true),csize=v.getUint32(cd+20,true),usize=v.getUint32(cd+24,true),local=v.getUint32(cd+42,true);if(csize===0xffffffff||usize===0xffffffff)throw Error('ZIP64 archive too large for browser worker');if(v.getUint32(local,true)!==0x04034b50)throw Error('ZIP local header invalid');const nl=v.getUint16(local+26,true),xl=v.getUint16(local+28,true),start=local+30+nl+xl;return {method,csize,usize,data:u.slice(start,start+csize)}}
async function unzipFirst(buffer){const e=zipEntry(buffer);if(e.method===0)return e.data;if(e.method!==8)throw Error(`Unsupported ZIP compression method ${e.method}`);if(typeof DecompressionStream!=='function')throw Error('Browser lacks DecompressionStream');const stream=new Blob([e.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));const out=new Uint8Array(await new Response(stream).arrayBuffer());if(e.usize&&out.length!==e.usize)throw Error(`ZIP size mismatch ${out.length}/${e.usize}`);return out}
function asciiNum(b,s,e){if(s>=e)return NaN;let i=s,sign=1,n=0,frac=0,div=1;if(b[i]===45){sign=-1;i++}let seen=false;for(;i<e;i++){const c=b[i];if(c===46){frac=1;continue}if(c<48||c>57)return NaN;seen=true;if(!frac)n=n*10+c-48;else{div*=10;n+=(c-48)/div}}return seen?sign*n:NaN}
function engine(box){return {box,lastClose:NaN,direction:0,bricks:[],ticks:0,firstTime:0,lastTime:0,lastId:null}}
function addBrick(e,o,c,d,t,id){e.bricks.push([o,c,d,t,id==null?null:id]);e.lastClose=c;e.direction=d}
function apply(e,price,time,id){const p=Number(price),t=normMs(time);if(!Number.isFinite(p)||!(e.box>0)||!t)return;if(!e.firstTime)e.firstTime=t;e.lastTime=t;e.lastId=id;e.ticks++;if(!Number.isFinite(e.lastClose))e.lastClose=Math.floor(p/e.box)*e.box;let g=0;while(g++<100000){if(e.direction===0){if(p>=e.lastClose+e.box){addBrick(e,e.lastClose,e.lastClose+e.box,1,t,id);continue}if(p<=e.lastClose-e.box){addBrick(e,e.lastClose,e.lastClose-e.box,-1,t,id);continue}break}if(e.direction===1){if(p>=e.lastClose+e.box){addBrick(e,e.lastClose,e.lastClose+e.box,1,t,id);continue}if(p<=e.lastClose-2*e.box){addBrick(e,e.lastClose-e.box,e.lastClose-2*e.box,-1,t,id);continue}break}if(p<=e.lastClose-e.box){addBrick(e,e.lastClose,e.lastClose-e.box,-1,t,id);continue}if(p>=e.lastClose+2*e.box){addBrick(e,e.lastClose+e.box,e.lastClose+2*e.box,1,t,id);continue}break}}
function parseTrades(bytes,e){let col=0,start=0,id=NaN,price=NaN,time=NaN,rows=0;for(let i=0;i<=bytes.length;i++){const c=i<bytes.length?bytes[i]:10;if(c!==44&&c!==10&&c!==13)continue;if(i>start){if(col===0)id=asciiNum(bytes,start,i);else if(col===1)price=asciiNum(bytes,start,i);else if(col===4)time=asciiNum(bytes,start,i)}if(c===44){col++;start=i+1;continue}if(c===13){start=i+1;continue}if(Number.isFinite(price)&&Number.isFinite(time)){apply(e,price,time,Number.isFinite(id)?id:null);rows++}col=0;start=i+1;id=price=time=NaN}return rows}
async function fetchArchive(base,item,e){const r=await fetch(base+item.path,{mode:'cors',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(180000)});if(r.status===404)return {missing:true,rows:0,bytes:0};if(!r.ok)throw Error(`${item.key} HTTP ${r.status}`);const length=Number(r.headers.get('content-length')||0);if(length>160*1024*1024)throw Error(`${item.key} compressed archive too large (${Math.round(length/1048576)} MB)`);const buf=await r.arrayBuffer();const csv=await unzipFirst(buf);const rows=parseTrades(csv,e);return {missing:false,rows,bytes:buf.byteLength,uncompressed:csv.byteLength}}
async function selftest(msg){const e=engine(Number(msg.box)||10),csv=await unzipFirst(msg.zip),rows=parseTrades(csv,e);post('selftest',{ok:rows>0&&e.ticks===rows,rows,ticks:e.ticks,bricks:e.bricks,firstTime:e.firstTime,lastTime:e.lastTime})}
async function archiveUrlTest(msg){const r=await fetch(String(msg.url),{mode:'cors',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`archive URL HTTP ${r.status}`);const buf=await r.arrayBuffer(),csv=await unzipFirst(buf),e=engine(Number(msg.box)||100),rows=parseTrades(csv,e);post('archiveurltest',{ok:rows>0,rows,ticks:e.ticks,bricks:e.bricks.length,firstTime:e.firstTime,lastTime:e.lastTime,bytes:buf.byteLength})}
async function run(msg){cancelled=false;const symbol=String(msg.symbol||'BTCUSDT').toUpperCase(),box=Number(msg.box),bases=Array.isArray(msg.bases)?msg.bases:[];if(!(box>0))throw Error('Fixed brick size required');post('status',{status:'SOURCE'});const base=await chooseBase(bases);post('status',{status:'DISCOVER',base});const {plan,yesterday,seen}=await discover(base,symbol);if(!seen)post('warning',{message:'No completed monthly archive discovered yet; daily raw-trade archives will still be probed.'});if(!plan.length)throw Error('No raw trade archives discovered');post('plan',{base,total:plan.length,end:yesterday});const e=engine(box),gaps=[];let done=0,downloaded=0,started=false,emitted=0;for(const item of plan){if(cancelled)throw Error('cancelled');post('progress',{done,total:plan.length,key:item.key,bricks:e.bricks.length,ticks:e.ticks,downloaded,firstTime:e.firstTime,lastTime:e.lastTime});let result;try{result=await fetchArchive(base,item,e)}catch(err){gaps.push({key:item.key,error:err.message});done++;post('warning',{message:`${item.key}: ${err.message}`,done,total:plan.length});continue}if(result.missing){if(started&&item.required)gaps.push({key:item.key,error:'404'});done++;continue}started=true;downloaded+=result.bytes;done++;const chunk=e.bricks.slice(emitted);emitted=e.bricks.length;if(chunk.length)post('chunk',{key:item.key,bricks:chunk,bricksTotal:e.bricks.length,ticks:e.ticks,firstTime:e.firstTime,lastTime:e.lastTime,done,total:plan.length,downloaded});post('progress',{done,total:plan.length,key:item.key,bricks:e.bricks.length,ticks:e.ticks,downloaded,rows:result.rows,firstTime:e.firstTime,lastTime:e.lastTime});await sleep(0)}const complete=started&&gaps.length===0;post('done',{symbol,box,base,complete,gaps,done,total:plan.length,ticks:e.ticks,bricks:e.bricks,firstTime:e.firstTime,lastTime:e.lastTime,lastId:e.lastId,downloaded})}
self.onmessage=e=>{const m=e.data||{};if(m.type==='cancel'){cancelled=true;return}if(m.type==='selftest')selftest(m).catch(err=>post('error',{message:err.message||String(err)}));if(m.type==='archiveurltest')archiveUrlTest(m).catch(err=>post('error',{message:err.message||String(err)}));if(m.type==='start')run(m).catch(err=>post('error',{message:err.message||String(err)}))};
