import fs from 'node:fs';
import { chromium } from 'playwright';

const out=process.env.RENKO_5Y_PROBE_OUT||'artifacts/renko-5y-source-probe';
fs.mkdirSync(out,{recursive:true});
const symbol=process.env.RENKO_5Y_SYMBOL||'BTCUSDT';
const now=new Date();
const target=new Date(Date.UTC(now.getUTCFullYear()-5,now.getUTCMonth(),1));
const lastMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
const months=[];
for(let d=new Date(target);d<lastMonth;d=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1))){
  const ym=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  months.push({ym,url:`https://data.binance.vision/data/spot/monthly/klines/${symbol}/1s/${symbol}-1s-${ym}.zip`});
}
async function head(url){
  try{const r=await fetch(url,{method:'HEAD',headers:{Origin:'https://copytolive.github.io'},signal:AbortSignal.timeout(30000)});return{ok:r.ok,status:r.status,len:Number(r.headers.get('content-length')||0),acao:r.headers.get('access-control-allow-origin')||'',ranges:r.headers.get('accept-ranges')||''}}catch(e){return{ok:false,status:0,len:0,acao:'',ranges:'',error:String(e?.message||e)}}
}
let cursor=0;const rows=new Array(months.length);
async function lane(){while(true){const i=cursor++;if(i>=months.length)return;rows[i]={...months[i],...(await head(months[i].url))};console.log('ARCHIVE',i+1,'/',months.length,rows[i].ym,rows[i].status,rows[i].len,rows[i].acao)}}
await Promise.all(Array.from({length:8},()=>lane()));
const targetMs=Date.UTC(now.getUTCFullYear()-5,now.getUTCMonth(),now.getUTCDate(),0,0,0);
let api={};
try{const u=`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=1s&startTime=${targetMs}&limit=5`;const r=await fetch(u,{headers:{Origin:'https://copytolive.github.io'},signal:AbortSignal.timeout(30000)});const body=await r.json();api={url:u,ok:r.ok,status:r.status,acao:r.headers.get('access-control-allow-origin')||'',count:Array.isArray(body)?body.length:0,first:Array.isArray(body)&&body.length?Number(body[0][0]):0,last:Array.isArray(body)&&body.length?Number(body.at(-1)[0]):0}}catch(e){api={ok:false,error:String(e?.message||e)}}
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await browser.newPage();
await page.goto('https://copytolive.github.io/rwa/renko/',{waitUntil:'domcontentloaded',timeout:60000});
const browserProbe=await page.evaluate(async({archive,apiUrl})=>{
  const one=async(url,opt={})=>{try{const r=await fetch(url,{cache:'no-store',...opt});let count=null,first=0;if(!opt.method){const x=await r.json();count=Array.isArray(x)?x.length:null;first=Array.isArray(x)&&x.length?Number(x[0][0]):0}return{ok:r.ok,status:r.status,acao:r.headers.get('access-control-allow-origin')||'',len:Number(r.headers.get('content-length')||0),count,first}}catch(e){return{ok:false,status:0,error:String(e?.message||e)}}};
  return{archive:await one(archive,{method:'HEAD'}),api:await one(apiUrl)};
},{archive:rows.find(r=>r.ok)?.url||months[0].url,apiUrl:api.url});
await browser.close();
const okRows=rows.filter(r=>r.ok),sum=okRows.reduce((a,r)=>a+r.len,0);
const report={schema:'renko-5y-fixed-1s-source-probe-v1',generatedAt:new Date().toISOString(),symbol,targetIso:new Date(targetMs).toISOString(),monthCount:months.length,archiveOk:okRows.length,archiveMissing:rows.filter(r=>!r.ok).length,totalCompressedBytes:sum,totalCompressedGiB:sum/1024/1024/1024,corsAll:okRows.length>0&&okRows.every(r=>r.acao==='*'||r.acao==='https://copytolive.github.io'),rows,api,browserProbe,status:okRows.length>=48&&api.ok&&api.count>0&&browserProbe.api.ok?'PASS':'PARTIAL'};
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
console.log('RENKO_5Y_SOURCE_PROBE '+JSON.stringify({status:report.status,monthCount:report.monthCount,archiveOk:report.archiveOk,missing:report.archiveMissing,totalCompressedGiB:Number(report.totalCompressedGiB.toFixed(3)),api,browserProbe}));
if(report.status!=='PASS')process.exit(2);
