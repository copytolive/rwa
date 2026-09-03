import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import vm from 'node:vm';

const SYMBOL=(process.env.RENKO_PRELOAD_SYMBOL||'SOLUSDT').toUpperCase();
const DAYS=Math.max(7,Math.min(45,Number(process.env.RENKO_PRELOAD_DAYS||30)));
const MONTHS=Math.max(3,Math.min(24,Number(process.env.RENKO_PRELOAD_MONTHS||12)));
const KEEP=Math.max(80,Number(process.env.RENKO_PRELOAD_KEEP||140));
const OUT=path.resolve(process.env.RENKO_PRELOAD_OUT||`renko/preload/${SYMBOL}.json`);
const BASE='https://data.binance.vision';
const META_ROOTS=['https://data-api.binance.vision','https://api.binance.com'];
const pad=n=>String(n).padStart(2,'0');
const dayStart=ms=>{const d=new Date(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())};
const decimals=x=>{const s=String(x);if(s.includes('e-'))return Math.min(12,Number(s.split('e-')[1])||0);const i=s.indexOf('.');return i<0?0:Math.min(12,s.length-i-1)};
const roundTick=(v,t)=>Number((Math.max(1,Math.round(v/t))*t).toFixed(decimals(t)));

const workerCode=await fs.readFile('renko/renko-v15-worker.js','utf8');
const sandbox={console,postMessage(){}};sandbox.self=sandbox;sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(workerCode,sandbox);
const E=sandbox.RenkoV15Engine;if(!E)throw new Error('RenkoV15Engine missing');

async function jsonPath(p){let last=null;for(const root of META_ROOTS){try{const r=await fetch(root+p,{headers:{accept:'application/json'}});if(!r.ok)throw new Error(`${r.status} ${root+p}`);return r.json()}catch(e){last=e;console.log('META_FALLBACK',String(e?.message||e))}}throw last||new Error('metadata unavailable')}
const info=await jsonPath(`/api/v3/exchangeInfo?symbol=${SYMBOL}`),pf=info?.symbols?.[0]?.filters?.find(f=>f.filterType==='PRICE_FILTER'),tick=Number(pf?.tickSize);if(!(tick>0))throw new Error('tick size missing');
const ticker=await jsonPath(`/api/v3/ticker/price?symbol=${SYMBOL}`),ltp=Number(ticker?.price);if(!(ltp>0))throw new Error('ltp missing');

function niceSeeds(){const min=Math.max(tick,ltp*.0005),max=Math.max(min,ltp*.11),vals=[];for(let p=-8;p<=8;p++)for(const m of [1,2,5]){const v=roundTick(m*10**p,tick);if(v>=min*.75&&v<=max*1.05&&!vals.some(x=>Math.abs(x-v)<tick*.25))vals.push(v)}return vals.sort((a,b)=>a-b)}
const seedBoxes=niceSeeds();if(!seedBoxes.length)throw new Error('no seed boxes');
const shortCut=Math.max(tick,roundTick(ltp*.012,tick));
function makeStreams(boxes){return boxes.map(box=>({box,options:{method:'traditional',traditionalBox:box,percentage:.01,ltpSnapshot:ltp,atrValue:tick,tickSize:tick,wicks:true},state:null,bricks:[],trades:0,first:null}))}
const shortStreams=makeStreams(seedBoxes.filter(x=>x<=shortCut));
const longStreams=makeStreams(seedBoxes.filter(x=>x>shortCut));
function applyTrade(s,id,price,time){const p=Number(price),tm=Number(time);if(!Number.isFinite(p)||!Number.isFinite(tm))return;if(!s.state){const r=E.buildTicks({...s.options,ticks:[{id,price:p,time:tm}]});s.state=r.tailState;s.first={id,price:p,time:tm};s.trades=1;return}s.trades++;E.processTick(s.state,{id,price:p,time:tm},s.bricks,s.options,s.box)}

function findEocd(u){for(let i=u.length-22,j=Math.max(0,u.length-65557);i>=j;i--)if(u[i]===0x50&&u[i+1]===0x4b&&u[i+2]===0x05&&u[i+3]===0x06)return i;return-1}
function unzip(buffer){const u=new Uint8Array(buffer),v=new DataView(buffer),e=findEocd(u);if(e<0)throw new Error('zip EOCD missing');const cd=v.getUint32(e+16,true);if(v.getUint32(cd,true)!==0x02014b50)throw new Error('zip central directory bad');const method=v.getUint16(cd+10,true),csize=v.getUint32(cd+20,true),local=v.getUint32(cd+42,true);const nl=v.getUint16(local+26,true),xl=v.getUint16(local+28,true),start=local+30+nl+xl,data=Buffer.from(u.slice(start,start+csize));if(method===0)return data;if(method===8)return zlib.inflateRawSync(data);throw new Error(`zip method ${method}`)}
function asciiNum(b,s,e){if(s>=e)return NaN;let i=s,n=0,frac=false,div=1,seen=false,neg=false;if(b[i]===45){neg=true;i++}for(;i<e;i++){const c=b[i];if(c===46){if(frac)return NaN;frac=true;continue}if(c<48||c>57)return NaN;seen=true;if(!frac)n=n*10+c-48;else{div*=10;n+=(c-48)/div}}return seen?(neg?-n:n):NaN}
function parseCsv(buf,streams){const b=buf instanceof Uint8Array?buf:new Uint8Array(buf);let col=0,start=0,id=NaN,price=NaN,time=NaN,rows=0;for(let i=0;i<=b.length;i++){const c=i<b.length?b[i]:10;if(c!==44&&c!==10&&c!==13)continue;if(i>start){if(col===0)id=asciiNum(b,start,i);else if(col===1)price=asciiNum(b,start,i);else if(col===5)time=asciiNum(b,start,i)}if(c===44){col++;start=i+1;continue}if(c===13){start=i+1;continue}if(Number.isFinite(price)&&Number.isFinite(time)){for(const s of streams)applyTrade(s,id,price,time);rows++}col=0;start=i+1;id=price=time=NaN}return rows}
async function loadArchive(url,label,streams){const r=await fetch(url);if(r.status===404){console.log('PRELOAD_MISSING',label);return{loaded:0,bytes:0}}if(!r.ok)throw new Error(`${label} HTTP ${r.status}`);const ab=await r.arrayBuffer(),csv=unzip(ab),rows=parseCsv(csv,streams);console.log('PRELOAD_ARCHIVE',label,'zipBytes',ab.byteLength,'csvBytes',csv.byteLength,'rows',rows,'maxBricks',streams.at(-1)?.bricks.length||0);return{loaded:1,bytes:ab.byteLength}}

let loaded=0,bytes=0;
const today=dayStart(Date.now()),recent=[];for(let i=DAYS;i>=1;i--)recent.push(new Date(today-i*86400000));
for(const d of recent){const ds=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`,r=await loadArchive(`${BASE}/data/spot/daily/aggTrades/${SYMBOL}/${SYMBOL}-aggTrades-${ds}.zip`,`daily:${ds}`,shortStreams);loaded+=r.loaded;bytes+=r.bytes}

if(longStreams.length){
  const now=new Date(),monthStart=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1);
  for(let i=MONTHS;i>=1;i--){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1)),ms=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`,r=await loadArchive(`${BASE}/data/spot/monthly/aggTrades/${SYMBOL}/${SYMBOL}-aggTrades-${ms}.zip`,`monthly:${ms}`,longStreams);loaded+=r.loaded;bytes+=r.bytes}
  for(let t=monthStart;t<today;t+=86400000){const d=new Date(t),ds=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`,r=await loadArchive(`${BASE}/data/spot/daily/aggTrades/${SYMBOL}/${SYMBOL}-aggTrades-${ds}.zip`,`current:${ds}`,longStreams);loaded+=r.loaded;bytes+=r.bytes}
}
if(!loaded)throw new Error('no archives loaded');

function hasWick(b){return Number(b.direction)>0?Number(b.low)<Math.min(Number(b.open),Number(b.close)):Number(b.high)>Math.max(Number(b.open),Number(b.close))}
function compactTail(s){const want=Math.min(KEEP,s.bricks.length);if(!want)return null;const original=s.bricks.slice(-want);for(const extra of [8,24,80,240,1000,4000]){const start=Math.max(0,s.bricks.length-want-extra),part=s.bricks.slice(start),first=part[0];if(!first)continue;const compact=[{id:1,price:Number(first.open),time:Math.max(1,Number(first.time)-1),kind:'history-v185-preload'}];let id=2;for(const b of part){const o=Number(b.open),c=Number(b.close),tm=Number(b.time),dir=Number(b.direction);if(dir>0&&Number(b.low)<Math.min(o,c))compact.push({id:id++,price:Number(b.low),time:tm,kind:'history-v185-preload'});if(dir<0&&Number(b.high)>Math.max(o,c))compact.push({id:id++,price:Number(b.high),time:tm,kind:'history-v185-preload'});compact.push({id:id++,price:c,time:tm,kind:'history-v185-preload'})}const replay=E.buildTicks({...s.options,ticks:compact}),tail=replay.bricks.slice(-want),tol=Math.max(1e-9,s.box*1e-9);if(tail.length!==original.length)continue;let ok=true;for(let i=0;i<tail.length;i++){const a=tail[i],b=original[i];if(Number(a.direction)!==Number(b.direction)||Math.abs(Number(a.open)-Number(b.open))>tol||Math.abs(Number(a.close)-Number(b.close))>tol){ok=false;break}}if(ok)return{ticks:compact,bricks:want,from:Number(part[0].time),to:Number(part.at(-1).time),wickCount:part.filter(hasWick).length,audit:replay.audit}}return null}
const outSeeds=[];for(const s of [...shortStreams,...longStreams]){const c=compactTail(s);if(c&&c.bricks>=Math.min(46,KEEP)){outSeeds.push({box:s.box,...c});console.log('PRELOAD_SEED',s.box,c.bricks,c.ticks.length)}else console.log('PRELOAD_SEED_INSUFFICIENT',s.box,s.bricks.length)}
outSeeds.sort((a,b)=>a.box-b.box);if(!outSeeds.length)throw new Error('no usable preload seeds');
const result={version:3,contract:'tick-derived-first-frame-preview-then-exact-background',symbol:SYMBOL,tickSize:tick,ltpAtBuild:ltp,generatedAt:new Date().toISOString(),shortLookbackDays:DAYS,longLookbackMonths:MONTHS,archivesLoaded:loaded,archiveBytes:bytes,targetVisible:46,seeds:outSeeds};
await fs.mkdir(path.dirname(OUT),{recursive:true});await fs.writeFile(OUT,JSON.stringify(result));
console.log('RENKO_FIRST_FRAME_PRELOAD',JSON.stringify({symbol:SYMBOL,tick,ltp,days:DAYS,months:MONTHS,archivesLoaded:loaded,bytes,seeds:outSeeds.map(s=>({box:s.box,bricks:s.bricks,ticks:s.ticks.length})),out:OUT}));
