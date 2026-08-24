import {readFile} from 'node:fs/promises';

const cfg=JSON.parse(await readFile('rwa-commerce-config.json','utf8'));
const base=String(cfg.candidate_base||'').trim().replace(/\/$/,'');
if(!/^https:\/\//i.test(base))throw new Error('candidate_base_https_required');

const get=async path=>{
  const r=await fetch(base+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  const body=await r.json().catch(()=>({}));
  return{status:r.status,ok:r.ok,body};
};

let result;
try{
  const [health,ready,config]=await Promise.all([get('/healthz'),get('/readyz'),get('/v1/config')]);
  const serviceLive=health.ok&&health.body?.ok===true&&health.body?.service==='rwa-commerce';
  const serviceReady=ready.ok&&ready.body?.ok===true&&ready.body?.service_ready===true;
  const checkoutReady=serviceReady&&ready.body?.checkout_ready===true&&ready.body?.payment_configured===true&&Number(ready.body?.live_verified_stores)>0;
  result={
    schema:1,
    candidate_base:base,
    service_live:serviceLive,
    service_ready:serviceReady,
    checkout_ready:checkoutReady,
    payment_configured:ready.body?.payment_configured===true,
    live_verified_stores:Number(ready.body?.live_verified_stores||0),
    policy:config.body?.policy||null,
    blockers:Array.isArray(ready.body?.blockers)?ready.body.blockers:[],
    http:{health:health.status,ready:ready.status,config:config.status}
  };
}catch(e){
  result={schema:1,candidate_base:base,service_live:false,service_ready:false,checkout_ready:false,payment_configured:false,live_verified_stores:0,blockers:['candidate_unreachable'],error:String(e?.message||e)};
}
console.log('RWA_COMMERCE_CANDIDATE_JSON_START');
console.log(JSON.stringify(result,null,2));
console.log('RWA_COMMERCE_CANDIDATE_JSON_END');
if(process.argv.includes('--require-live')&&!(result.service_live&&result.service_ready))process.exit(2);
if(process.argv.includes('--require-checkout')&&!result.checkout_ready)process.exit(3);
