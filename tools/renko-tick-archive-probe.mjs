import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const ORIGIN='https://narzulalistiqlal.github.io';
const pad=n=>String(n).padStart(2,'0');
const pathFor=(symbol,y,m)=>`data/spot/monthly/trades/${symbol}/${symbol}-trades-${y}-${pad(m)}.zip`;
const dayPath=(symbol,y,m,d)=>`data/spot/daily/trades/${symbol}/${symbol}-trades-${y}-${pad(m)}-${pad(d)}.zip`;
const HOSTS=[
  'https://data.binance.vision',
  'https://s3-ap-northeast-1.amazonaws.com/data.binance.vision',
  'https://data.binance.vision.s3.ap-northeast-1.amazonaws.com'
];

async function probe(url,method='HEAD'){
  const r=await fetch(url,{method,headers:{Origin:ORIGIN,...(method==='GET'?{Range:'bytes=0-4095'}:{})},signal:AbortSignal.timeout(20000)});
  return {ok:r.ok,status:r.status,acao:r.headers.get('access-control-allow-origin')||'',len:Number(r.headers.get('content-length')||0),acceptRanges:r.headers.get('accept-ranges')||''};
}

const candidatePath=pathFor('BTCUSDT',2017,8);
const variants=[];
for(const host of HOSTS){
  const url=`${host}/${candidatePath}`;
  variants.push({host,url,head:await probe(url,'HEAD'),get:await probe(url,'GET')});
}
const corsVariant=variants.find(v=>['*',ORIGIN].includes(v.get.acao)||['*',ORIGIN].includes(v.head.acao));

const months=[];
for(let y=2017;y<=2026;y++) for(let m=1;m<=12;m++){
  if(y===2017&&m<7) continue;
  if(y===2026&&m>7) continue;
  const url=`https://data.binance.vision/${pathFor('BTCUSDT',y,m)}`;
  const p=await probe(url,'HEAD');
  if(p.ok) months.push({y,m,url,...p});
}
assert.ok(months.length>=90,`BTC monthly raw-trade archive unexpectedly short: ${months.length}`);
assert.equal(months[0].y,2017,'BTC raw archive must reach 2017');
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
  const url=`https://data.binance.vision/${dayPath('BTCUSDT',d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate())}`;
  const p=await probe(url,'HEAD');
  if(p.ok) latestDaily={url,...p};
}
assert.ok(latestDaily,'recent BTC daily raw-trade archive missing');

console.log(JSON.stringify({
  ok:true,
  source:'Binance Vision spot trades = individual raw executions',
  browserCorsAvailable:!!corsVariant,
  corsVariant:corsVariant?.host||null,
  hostVariants:variants,
  monthlyArchives:months.length,
  firstArchive:sample.url,
  lastMonthlyArchive:months.at(-1).url,
  sampleBytes:sample.len,
  csvColumns:cols.length,
  firstTrade:{id:cols[0],price:cols[1],qty:cols[2],quoteQty:cols[3],time:cols[4],buyerMaker:cols[5]},
  recentDailyArchive:latestDaily.url,
  recentDailyBytes:latestDaily.len
},null,2));
if(!corsVariant){
  console.error('NO_BROWSER_CORS_VARIANT: a same-origin or controlled proxy is required for GitHub Pages lifetime archive loading');
  process.exitCode=2;
}
