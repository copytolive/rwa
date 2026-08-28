import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const cfg=JSON.parse(readFileSync('rwa-commerce-config.json','utf8')),base=String(cfg.business_api_base||'').replace(/\/$/,'');
const outDir=resolve(process.env.RWA_BUSINESS_PROBE_OUT||'artifacts/rwa-business-live-probe');mkdirSync(outDir,{recursive:true});
const result={ok:true,mode:base?'LIVE_PROBE':'LOCKED',base,ts:new Date().toISOString(),health:null,ready:null,metrics:null,failures:[]};
async function get(path,accept='application/json'){const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);try{const r=await fetch(`${base}${path}`,{cache:'no-store',signal:c.signal,headers:{accept}}),text=await r.text();return{status:r.status,ok:r.ok,text,json:(()=>{try{return JSON.parse(text)}catch{return null}})()}}finally{clearTimeout(t)}}
if(!base){result.reason='business_api_base_empty_fail_closed'}else{
  try{result.health=await get('/healthz');result.ready=await get('/readyz');result.metrics=await get('/metrics','text/plain');if(!result.health.ok||result.health.json?.ok!==true)result.failures.push('healthz_failed');if(!result.ready.ok||result.ready.json?.service_ready!==true)result.failures.push('readyz_failed');if(!result.metrics.ok||!result.metrics.text.includes('rwa_business_total'))result.failures.push('metrics_failed')}catch(e){result.failures.push(`probe_error:${e.message}`)}result.ok=result.failures.length===0;
}
writeFileSync(resolve(outDir,'probe-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.ok)process.exit(1);
