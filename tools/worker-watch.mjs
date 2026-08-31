import {readFile,writeFile} from 'node:fs/promises';

const cfg=JSON.parse(await readFile('agent-worker/public-config.json','utf8'));
const control=JSON.parse(await readFile('agent-worker/control.json','utf8'));
const out={schema:1,checked_at:new Date().toISOString(),configured:!!cfg.enabled,base_url:String(cfg.base_url||''),healthy:false,ready:false,tripped:false,detail:''};

async function get(path){const base=String(cfg.base_url||'').replace(/\/$/,'');const r=await fetch(base+path,{cache:'no-store',signal:AbortSignal.timeout(10000)});let body={};try{body=await r.json()}catch{}return{ok:r.ok,body,status:r.status}}
function contract(h){return h?.ok===true&&h?.single_write_path==='RWAWorkerExecutionAPI'&&h?.idempotency==='deterministic-cloid-v1'&&h?.origin_bound===true&&h?.kill_switch===false&&h?.control_enabled===true&&h?.production_ready===true}
async function trip(reason){if(!process.argv.includes('--trip'))return;const next={...control,enabled:false,kill_switch:true,production_ready:false,mainnet_enabled:false,last_trip:{at:new Date().toISOString(),reason:String(reason).slice(0,500),source:'worker-watch'}};await writeFile('agent-worker/control.json',JSON.stringify(next,null,2)+'\n');out.tripped=true}

if(!cfg.enabled){out.detail='worker public config disabled';console.log(JSON.stringify(out,null,2));process.exit(0)}
if(!/^https:\/\//i.test(String(cfg.base_url||''))){out.detail='worker URL is not HTTPS';await trip(out.detail);console.log(JSON.stringify(out,null,2));process.exit(2)}
try{
  const [h,r]=await Promise.all([get('/healthz'),get('/readyz')]);
  out.healthy=h.ok&&contract(h.body);
  out.ready=r.ok&&r.body?.ok===true;
  out.detail=JSON.stringify({health_status:h.status,ready_status:r.status,service:h.body?.service,version:h.body?.version,kill:h.body?.kill_switch,control:h.body?.control_enabled,production:h.body?.production_ready,idempotency:h.body?.idempotency,origin_bound:h.body?.origin_bound});
  if(!out.healthy||!out.ready){await trip(out.detail);console.log(JSON.stringify(out,null,2));process.exit(2)}
  console.log(JSON.stringify(out,null,2));
}catch(e){out.detail=String(e?.message||e);await trip(out.detail);console.log(JSON.stringify(out,null,2));process.exit(2)}
