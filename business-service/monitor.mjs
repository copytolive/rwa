const base=String(process.env.RWA_BUSINESS_PUBLIC_URL||'http://127.0.0.1:8790').replace(/\/$/,'');
const timeout=Number(process.env.RWA_BUSINESS_MONITOR_TIMEOUT_MS||8000);
async function get(path){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(`${base}${path}`,{cache:'no-store',signal:c.signal,headers:{accept:path==='/metrics'?'text/plain':'application/json'}});const text=await r.text();return{ok:r.ok,status:r.status,text,json:()=>{try{return JSON.parse(text)}catch{return null}}}}finally{clearTimeout(t)}}
const health=await get('/healthz'),ready=await get('/readyz'),metrics=await get('/metrics');const h=health.json(),r=ready.json(),failures=[];
if(!health.ok||!h?.ok)failures.push('healthz_failed');if(!ready.ok||!r?.service_ready)failures.push('readyz_failed');if(!metrics.ok||!metrics.text.includes('rwa_business_total'))failures.push('metrics_failed');
const out={ok:failures.length===0,base,health:h,ready:r,metrics:metrics.text.trim().split('\n'),failures};console.log(JSON.stringify(out,null,2));if(failures.length)process.exit(1);
