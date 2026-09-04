import {readFile} from 'node:fs/promises';

const cfg=JSON.parse(await readFile('agent-worker/public-config.json','utf8'));
const base=String(cfg.candidate_base_url||cfg.base_url||'').trim().replace(/\/$/,'');
if(!/^https:\/\//i.test(base))throw new Error('candidate_base_url_https_required');

const get=async path=>{
  const r=await fetch(base+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  const body=await r.json().catch(()=>({}));
  return{status:r.status,ok:r.ok,body};
};

const legacyWorker=async()=>{
  const [health,ready]=await Promise.all([get('/healthz'),get('/readyz')]);
  const contract=health.body?.single_write_path==='RWAWorkerExecutionAPI'&&health.body?.idempotency==='deterministic-cloid-v1'&&health.body?.origin_bound===true;
  const safeTestnet=health.body?.mainnet_allowed===false;
  const serviceLive=health.ok&&health.body?.ok===true&&health.body?.service==='rwa-agent-worker'&&contract&&safeTestnet;
  const serviceReady=ready.ok&&ready.body?.ok===true&&ready.body?.encrypted_state===true&&ready.body?.origin_bound===true&&ready.body?.control_enabled===true&&ready.body?.kill_switch===false&&ready.body?.production_ready===true;
  return{
    schema:2,mode:'legacy-agent-worker',candidate_base_url:base,
    service_live:serviceLive,service_ready:serviceReady,safe_testnet:safeTestnet,contract,
    control_enabled:health.body?.control_enabled===true,kill_switch:health.body?.kill_switch===true,
    production_ready:health.body?.production_ready===true,mainnet_allowed:health.body?.mainnet_allowed===true,
    users:Number(health.body?.users||0),http:{health:health.status,ready:ready.status}
  };
};

const terminalService=async()=>{
  const [health,ready]=await Promise.all([get('/healthz'),get('/terminal/readyz')]);
  const terminalContract=health.ok&&health.body?.ok===true&&health.body?.service==='rwa-terminal-service';
  const capabilities=ready.ok&&ready.body?.ok===true&&ready.body?.sessions===true&&ready.body?.alerts===true&&ready.body?.social===true&&ready.body?.rewards===true&&ready.body?.holders==='authoritative-source-gated'&&ready.body?.alerts_24_7===true&&ready.body?.worker?.ok===true&&ready.body?.worker?.mode==='vercel-workflow';
  return{
    schema:2,mode:'terminal+delegated-agent',candidate_base_url:base,
    service_live:terminalContract,service_ready:capabilities,contract:terminalContract&&capabilities,
    safe_testnet:null,mainnet_allowed:null,
    mainnet_note:'Mainnet authorization is intentionally not inferred from the public terminal health probe; the separate launch/readiness gate remains authoritative.',
    version:String(health.body?.version||''),host:String(health.body?.host||''),
    alerts_24_7:ready.body?.alerts_24_7===true,worker_mode:String(ready.body?.worker?.mode||''),
    holders:String(ready.body?.holders||''),http:{health:health.status,ready:ready.status}
  };
};

let result;
try{
  result=cfg.mode==='terminal+delegated-agent'?await terminalService():await legacyWorker();
}catch(e){
  result={schema:2,mode:String(cfg.mode||'unknown'),candidate_base_url:base,service_live:false,service_ready:false,contract:false,safe_testnet:null,mainnet_allowed:null,error:String(e?.message||e)};
}
console.log('RWA_WORKER_CANDIDATE_JSON_START');
console.log(JSON.stringify(result,null,2));
console.log('RWA_WORKER_CANDIDATE_JSON_END');
if(process.argv.includes('--require-live')){
  const terminalMode=result.mode==='terminal+delegated-agent';
  const pass=terminalMode
    ? result.service_live&&result.service_ready&&result.contract
    : result.service_live&&result.service_ready&&result.safe_testnet&&!result.mainnet_allowed;
  if(!pass)process.exit(2);
}
