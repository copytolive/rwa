import {readFile} from 'node:fs/promises';
// 2026-08-25 operational re-probe: no contract change; force a fresh public health/ready check.
const cfg=JSON.parse(await readFile('agent-worker/public-config.json','utf8'));
const base=String(cfg.candidate_base_url||'').trim().replace(/\/$/,'');
if(!/^https:\/\//i.test(base))throw new Error('candidate_base_url_https_required');

const get=async path=>{
  const r=await fetch(base+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  const body=await r.json().catch(()=>({}));
  return{status:r.status,ok:r.ok,body};
};

let result;
try{
  const [health,ready]=await Promise.all([get('/healthz'),get('/readyz')]);
  const contract=health.body?.single_write_path==='RWAWorkerExecutionAPI'&&health.body?.idempotency==='deterministic-cloid-v1'&&health.body?.origin_bound===true;
  const safeTestnet=health.body?.mainnet_allowed===false;
  const serviceLive=health.ok&&health.body?.ok===true&&health.body?.service==='rwa-agent-worker'&&contract&&safeTestnet;
  const serviceReady=ready.ok&&ready.body?.ok===true&&ready.body?.encrypted_state===true&&ready.body?.origin_bound===true&&ready.body?.control_enabled===true&&ready.body?.kill_switch===false&&ready.body?.production_ready===true;
  result={
    schema:1,
    candidate_base_url:base,
    service_live:serviceLive,
    service_ready:serviceReady,
    safe_testnet:safeTestnet,
    contract,
    control_enabled:health.body?.control_enabled===true,
    kill_switch:health.body?.kill_switch===true,
    production_ready:health.body?.production_ready===true,
    mainnet_allowed:health.body?.mainnet_allowed===true,
    users:Number(health.body?.users||0),
    http:{health:health.status,ready:ready.status}
  };
}catch(e){
  result={schema:1,candidate_base_url:base,service_live:false,service_ready:false,safe_testnet:false,contract:false,control_enabled:false,kill_switch:true,production_ready:false,mainnet_allowed:false,error:String(e?.message||e)};
}
console.log('RWA_WORKER_CANDIDATE_JSON_START');
console.log(JSON.stringify(result,null,2));
console.log('RWA_WORKER_CANDIDATE_JSON_END');
if(process.argv.includes('--require-live')&&!(result.service_live&&result.service_ready&&result.safe_testnet&&!result.mainnet_allowed))process.exit(2);
