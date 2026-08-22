import {readFile,writeFile} from 'node:fs/promises';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const text=async p=>readFile(p,'utf8');
const addr=x=>/^0x[a-fA-F0-9]{40}$/.test(String(x||''));
const okAsset=a=>a&&a.name&&Number(a.nav)>0&&a.issuer&&a.ownership&&a.appraisal&&a.legal;
async function workerHealth(cfg){
  if(!cfg.enabled||!/^https:\/\//i.test(String(cfg.base_url||'')))return{ok:false,detail:'public worker URL not activated'};
  try{const r=await fetch(String(cfg.base_url).replace(/\/$/,'')+'/healthz',{cache:'no-store',signal:AbortSignal.timeout(8000)});const j=await r.json();return{ok:r.ok&&j.ok===true&&!j.kill_switch,detail:r.ok?JSON.stringify({service:j.service,kill_switch:j.kill_switch,users:j.users}):`HTTP ${r.status}`}}catch(e){return{ok:false,detail:String(e.message||e)}}
}

const [execution,core,workerExec,workerLoop,reviewers,assets,e2e,workerCfg,control,revenue]=await Promise.all([
  text('execution-api.js'),text('exchange-core.js'),text('agent-worker/execution.mjs'),text('agent-worker/worker.mjs'),read('rwa-reviewers.json'),read('rwa-assets.json'),read('launch/e2e-registry.json'),read('agent-worker/public-config.json'),read('agent-worker/control.json'),read('rwa-execution-config.json')
]);
const health=await workerHealth(workerCfg);
const checks={
  browser_single_write:{ok:execution.includes("hardening:'single-write-path-v1'")&&execution.includes("riskGate:'mandatory-internal-v1'")&&execution.includes("bracket:'atomic-normal-tpsl-v1'")&&core.includes("protection:'atomic-normal-tpsl-v1'"),detail:'RWAExecutionAPI + mandatory risk + atomic normalTpsl'},
  worker_single_write:{ok:workerExec.includes("WORKER_SINGLE_WRITE_PATH='RWAWorkerExecutionAPI'")&&!workerLoop.includes('ExchangeClient'),detail:'worker writes only through RWAWorkerExecutionAPI'},
  worker_no_fund_methods:{ok:!/(withdraw3|usdClassTransfer|spotSend|sendAsset)/.test(workerExec+workerLoop),detail:'no withdrawal/transfer API exposed'},
  real_wallet_e2e:{ok:(e2e.wallets||[]).some(x=>addr(x.wallet)&&x.status==='E2E_VERIFIED'&&Number(x.verified_at)>0),detail:`${(e2e.wallets||[]).length} registered wallet proof(s)`},
  reviewer_registry:{ok:(reviewers.reviewers||[]).some(x=>addr(typeof x==='string'?x:x.wallet)),detail:`${(reviewers.reviewers||[]).length} authorized reviewer(s)`},
  verified_rwa_asset:{ok:(assets.verified||[]).some(okAsset),detail:`${(assets.verified||[]).length} verified asset(s)`},
  worker_configured:{ok:!!(workerCfg.enabled&&/^https:\/\//i.test(String(workerCfg.base_url||''))),detail:workerCfg.enabled?String(workerCfg.base_url||'missing URL'):'disabled'},
  worker_live:{ok:health.ok,detail:health.detail},
  worker_control:{ok:control.enabled===true&&control.kill_switch===false&&control.production_ready===true,detail:`enabled=${control.enabled} kill=${control.kill_switch} production_ready=${control.production_ready}`},
  revenue_deferred:{ok:revenue.builder?.enabled===false&&Number(revenue.builder?.feeTenthsBp||0)===0,detail:'builder/platform fee remains OFF until final revenue wallet approval'}
};
const blocking=['browser_single_write','worker_single_write','worker_no_fund_methods','real_wallet_e2e','reviewer_registry','verified_rwa_asset','worker_configured','worker_live','worker_control'];
const blockers=blocking.filter(k=>!checks[k].ok).map(k=>({gate:k,detail:checks[k].detail}));
const beta_ready=blockers.length===0;
const mainnet_ready=beta_ready&&control.mainnet_enabled===true;
const out={schema:1,generated_at:new Date().toISOString(),status:mainnet_ready?'READY_FOR_MAINNET':beta_ready?'READY_FOR_BETA':'BLOCKED',beta_ready,mainnet_ready,checks,blockers,revenue:'DEFERRED',token_tge:'DEFERRED'};
if(process.argv.includes('--write'))await writeFile('launch/readiness.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(process.argv.includes('--require-beta')&&!beta_ready)process.exit(2);
if(process.argv.includes('--require-mainnet')&&!mainnet_ready)process.exit(3);
