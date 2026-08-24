import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const ROOT='https://data.binance.vision';
const ORIGIN='https://narzulalistiqlal.github.io';

async function get(url, opts={}){
  const r=await fetch(url,{...opts,headers:{Origin:ORIGIN,Accept:'*/*',...(opts.headers||{})},signal:AbortSignal.timeout(30000)});
  assert.ok(r.ok,`${url} HTTP ${r.status}`);
  return r;
}
function xmlKeys(xml){return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m=>m[1].replaceAll('&amp;','&'))}

const prefix='data/spot/monthly/trades/BTCUSDT/';
const listing=await get(`${ROOT}/?prefix=${encodeURIComponent(prefix)}&max-keys=1000`);
const xml=await listing.text();
const keys=xmlKeys(xml).filter(k=>k.endsWith('.zip')).sort();
assert.ok(keys.length>=60,`BTC monthly raw-trade archive unexpectedly short: ${keys.length}`);
assert.ok(keys[0].includes('BTCUSDT-trades-2017-'),`unexpected BTC archive start ${keys[0]}`);
const sample=keys[0];
const head=await get(`${ROOT}/${sample}`,{method:'HEAD'});
const acao=head.headers.get('access-control-allow-origin')||'';
assert.ok(acao==='*'||acao===ORIGIN,`archive CORS missing: ${acao}`);
const len=Number(head.headers.get('content-length')||0);
assert.ok(len>0,'archive content-length missing');

const file='/tmp/renko-raw.zip';
execFileSync('curl',['-fsSL','--max-time','90',`${ROOT}/${sample}`,'-o',file],{stdio:'inherit'});
const first=execFileSync('unzip',['-p',file],{encoding:'utf8',maxBuffer:1024*1024}).split(/\r?\n/).find(Boolean);
assert.ok(first,'empty raw trade csv');
const cols=first.split(',');
assert.ok(cols.length>=6,`unexpected raw trade columns: ${cols.length}`);
assert.ok(Number.isFinite(Number(cols[0])),'trade id missing');
assert.ok(Number.isFinite(Number(cols[1])),'trade price missing');
assert.ok(Number.isFinite(Number(cols[4])),'trade timestamp missing');

const dailyPrefix='data/spot/daily/trades/BTCUSDT/';
const dres=await get(`${ROOT}/?prefix=${encodeURIComponent(dailyPrefix)}&max-keys=5`);
const dxml=await dres.text();
const daily=xmlKeys(dxml).filter(k=>k.endsWith('.zip'));
assert.ok(daily.length>0,'daily raw trade archives missing');

console.log(JSON.stringify({
  ok:true,
  source:'Binance Vision spot raw trades',
  prefix,
  monthlyArchives:keys.length,
  firstArchive:keys[0],
  lastArchive:keys.at(-1),
  sampleBytes:len,
  cors:acao,
  csvColumns:cols.length,
  firstTrade:{id:cols[0],price:cols[1],qty:cols[2],quoteQty:cols[3],time:cols[4],buyerMaker:cols[5]},
  dailyArchiveExample:daily[0]
},null,2));
