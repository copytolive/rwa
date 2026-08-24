import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const ROOT='https://data.binance.vision';
const ORIGIN='https://narzulalistiqlal.github.io';
const pad=n=>String(n).padStart(2,'0');
const monthUrl=(symbol,y,m)=>`${ROOT}/data/spot/monthly/trades/${symbol}/${symbol}-trades-${y}-${pad(m)}.zip`;
const dayUrl=(symbol,y,m,d)=>`${ROOT}/data/spot/daily/trades/${symbol}/${symbol}-trades-${y}-${pad(m)}-${pad(d)}.zip`;

async function head(url){
  const r=await fetch(url,{method:'HEAD',headers:{Origin:ORIGIN},signal:AbortSignal.timeout(20000)});
  return r;
}

const months=[];
for(let y=2017;y<=2026;y++) for(let m=1;m<=12;m++){
  if(y===2017&&m<7) continue;
  if(y===2026&&m>7) continue; // completed monthly archives only; current month is daily
  const url=monthUrl('BTCUSDT',y,m);
  const r=await head(url);
  if(r.ok) months.push({y,m,url,len:Number(r.headers.get('content-length')||0),acao:r.headers.get('access-control-allow-origin')||''});
}
assert.ok(months.length>=90,`BTC monthly raw-trade archive unexpectedly short: ${months.length}`);
assert.equal(months[0].y,2017,'BTC raw archive must reach 2017');
assert.ok(months[0].acao==='*'||months[0].acao===ORIGIN,`archive CORS missing: ${months[0].acao}`);
assert.ok(months[0].len>0,'archive content-length missing');

const sample=months[0];
const file='/tmp/renko-raw.zip';
execFileSync('curl',['-fsSL','--max-time','120',sample.url,'-o',file],{stdio:'inherit'});
const first=execFileSync('bash',['-lc',`unzip -p ${file} | head -n 1`],{encoding:'utf8',maxBuffer:1024*1024}).trim();
assert.ok(first,'empty raw trade csv');
const cols=first.split(',');
assert.ok(cols.length>=6,`unexpected raw trade columns: ${cols.length}`);
assert.ok(Number.isFinite(Number(cols[0])),'trade id missing');
assert.ok(Number.isFinite(Number(cols[1])),'trade price missing');
assert.ok(Number.isFinite(Number(cols[4])),'trade timestamp missing');

const now=new Date('2026-08-24T00:00:00Z');
let latestDaily=null;
for(let back=1;back<=10&&!latestDaily;back++){
  const d=new Date(now.getTime()-back*86400000);
  const url=dayUrl('BTCUSDT',d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate());
  const r=await head(url);
  if(r.ok) latestDaily={url,len:Number(r.headers.get('content-length')||0),acao:r.headers.get('access-control-allow-origin')||''};
}
assert.ok(latestDaily,'recent BTC daily raw-trade archive missing');
assert.ok(latestDaily.acao==='*'||latestDaily.acao===ORIGIN,`daily archive CORS missing: ${latestDaily.acao}`);

console.log(JSON.stringify({
  ok:true,
  source:'Binance Vision spot trades = individual raw executions',
  monthlyArchives:months.length,
  firstArchive:sample.url,
  lastMonthlyArchive:months.at(-1).url,
  sampleBytes:sample.len,
  cors:sample.acao,
  csvColumns:cols.length,
  firstTrade:{id:cols[0],price:cols[1],qty:cols[2],quoteQty:cols[3],time:cols[4],buyerMaker:cols[5]},
  recentDailyArchive:latestDaily.url,
  recentDailyBytes:latestDaily.len
},null,2));
