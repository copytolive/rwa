import {readFile,writeFile} from 'node:fs/promises';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const text=async p=>readFile(p,'utf8');
const addr=x=>/^0x[a-fA-F0-9]{40}$/.test(String(x||''));
const okAsset=a=>a&&a.status==='VERIFIED'&&a.name&&Number(a.nav)>0&&a.issuer&&a.ownership&&a.appraisal&&a.legal&&addr(a.reviewer)&&a.approval_signature;
const rank={internal:1,closed:2,public:3};
async function workerHealth(cfg){
  if(!cfg.enabled||!/^https:\/\//i.test(String(cfg.base_url||'')))return{ok:false,ready:false,detail:'public worker URL not activated'};
  const base=String(cfg.base_url).replace(/\/$/,'');
  try{
    const [hr,rr]=await Promise.all([
      fetch(base+'/healthz',{cache:'no-store',signal:AbortSignal.timeout(8000)}),
      fetch(base+'/readyz',{cache:'no-store',signal:AbortSignal.timeout(8000)})
    ]);
    const [h,r]=await Promise.all([hr.json(),rr.json().catch(()=>({}))]);
    const contract=h.single_write_path==='RWAWorkerExecutionAPI'&&h.idempotency==='deterministic-cloid-v1'&&h.origin_bound===true;
    return{ok:hr.ok&&h.ok===true&&!h.kill_switch&&contract,ready:rr.ok&&r.ok===true,detail:JSON.stringify({service:h.service,version:h.version,kill_switch:h.kill_switch,production_ready:h.production_ready,idempotency:h.idempotency,origin_bound:h.origin_bound,users:h.users})};
  }catch(e){return{ok:false,ready:false,detail:String(e.message||e)}}
}

const [execution,core,workerExec,workerLoop,reviewers,assets,e2e,beta,workerCfg,control,revenue]=await Promise.all([
  text('execution-api.js'),text('exchange-core.js'),text('agent-worker/execution.mjs'),text('agent-worker/worker.mjs'),read('rwa-reviewers.json'),read('rwa-assets.json'),read('launch/e2e-registry.json'),read('launch/beta-registry.json'),read('agent-worker/public-config.json'),read('agent-worker/control.json'),read('rwa-execution-config.json')
]);
const health=await workerHealth(workerCfg);
const proofs=(beta.proofs||[]).filter(x=>x?.status==='VERIFIED'&&addr(x.wallet)&&rank[x.phase]);
const uniqueFor=minRank=>new Set(proofs.filter(x=>rank[x.phase]>=minRank).map(x=>String(x.wallet).toLowerCase())).size;
const betaCounts={internal:uniqueFor(1),closed:uniqueFor(2),public:uniqueFor(3)};
const thresholds={internal:Number(beta.thresholds?.internal||3),closed:Number(beta.thresholds?.closed||20),public:Number(beta.thresholds?.public||100)};
const checks={
  browser_single_write:{ok:execution.includes("hardening:'single-write-path-v1'")&&execution.includes("riskGate:'mandatory-internal-v1'")&&execution.includes("bracket:'atomic-normal-tpsl-v1'")&&core.includes("protection:'atomic-normal-tpsl-v1'"),detail:'RWAExecutionAPI + mandatory risk + atomic normalTpsl'},
  browser_global_mainnet_lock:{ok:core.includes("safety:'wallet-and-global-launch-gate-v3'")&&core.includes('localE2EVerified()&&globalMainnetReady()')&&core.includes("status==='READY_FOR_MAINNET'"),detail:'mainnet requires wallet E2E + global READY_FOR_MAINNET'},
  worker_single_write:{ok:workerExec.includes("WORKER_SINGLE_WRITE_PATH='RWAWorkerExecutionAPI'")&&!workerLoop.includes('ExchangeClient'),detail:'worker writes only through RWAWorkerExecutionAPI'},
  worker_idempotency:{ok:workerExec.includes("WORKER_IDEMPOTENCY='deterministic-cloid-v1'")&&workerExec.includes("info('orderStatus'")&&workerLoop.includes('cloidFor')&&workerLoop.includes('sourceFillId'),detail:'deterministic CLOID + venue orderStatus + persisted source-fill ledger'},
  worker_no_fund_methods:{ok:!/(withdraw3|usdClassTransfer|spotSend|sendAsset)/.test(workerExec+workerLoop),detail:'no withdrawal/transfer API exposed'},
  real_wallet_e2e:{ok:(e2e.wallets||[]).some(x=>addr(x.wallet)&&x.status==='E2E_VERIFIED'&&Number(x.verified_at)>0),detail:`${(e2e.wallets||[]).length} registered wallet proof(s)`},
  reviewer_registry:{ok:(reviewers.reviewers||[]).some(x=>addr(typeof x==='string'?x:x.wallet)),detail:`${(reviewers.reviewers||[]).length} authorized reviewer(s)`},
  verified_rwa_asset:{ok:(assets.verified||[]).some(okAsset),detail:`${(assets.verified||[]).length} verified asset(s)`},
  worker_configured:{ok:!!(workerCfg.enabled&&/^https:\/\//i.test(String(workerCfg.base_url||''))),detail:workerCfg.enabled?String(workerCfg.base_url||'missing URL'):'disabled'},
  worker_live:{ok:health.ok,detail:health.detail},
  worker_control:{ok:control.enabled===true&&control.kill_switch===false&&control.production_ready===true&&health.ready,detail:`enabled=${control.enabled} kill=${control.kill_switch} production_ready=${control.production_ready} readyz=${health.ready}`},
  beta_internal:{ok:betaCounts.internal>=thresholds.internal,detail:`${betaCounts.internal}/${thresholds.internal} verified wallet(s)`},
  beta_closed:{ok:betaCounts.closed>=thresholds.closed,detail:`${betaCounts.closed}/${thresholds.closed} verified wallet(s)`},
  beta_public:{ok:betaCounts.public>=thresholds.public,detail:`${betaCounts.public}/${thresholds.public} verified wallet(s)`},
  mainnet_control:{ok:control.mainnet_enabled===true,detail:`mainnet_enabled=${control.mainnet_enabled}`},
  revenue_deferred:{ok:revenue.builder?.enabled===false&&Number(revenue.builder?.feeTenthsBp||0)===0,detail:'builder/platform fee remains OFF until final revenue wallet approval'}
};
const prereqKeys=['browser_single_write','browser_global_mainnet_lock','worker_single_write','worker_idempotency','worker_no_fund_methods','real_wallet_e2e','reviewer_registry','verified_rwa_asset','worker_configured','worker_live','worker_control'];
const betaKeys=['beta_internal','beta_closed','beta_public'];
const prereqBlockers=prereqKeys.filter(k=>!checks[k].ok).map(k=>({gate:k,detail:checks[k].detail}));
const betaBlockers=betaKeys.filter(k=>!checks[k].ok).map(k=>({gate:k,detail:checks[k].detail}));
const beta_ready=prereqBlockers.length===0;
const beta_passed=beta_ready&&betaBlockers.length===0;
const mainnet_ready=beta_passed&&checks.mainnet_control.ok;
const blockers=[...prereqBlockers,...betaBlockers,...(!checks.mainnet_control.ok?[{gate:'mainnet_control',detail:checks.mainnet_control.detail}]:[])];
const status=mainnet_ready?'READY_FOR_MAINNET':beta_passed?'BETA_PASSED_AWAITING_MAINNET':beta_ready?'READY_FOR_BETA':'BLOCKED';
const out={schema:2,generated_at:new Date().toISOString(),status,beta_ready,beta_passed,mainnet_ready,beta:{thresholds,counts:betaCounts,verified_proofs:proofs.length},checks,blockers,revenue:'DEFERRED',token_tge:'DEFERRED'};
if(process.argv.includes('--write'))await writeFile('launch/readiness.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(process.argv.includes('--require-beta')&&!beta_ready)process.exit(2);
if(process.argv.includes('--require-beta-passed')&&!beta_passed)process.exit(4);
if(process.argv.includes('--require-mainnet')&&!mainnet_ready)process.exit(3);
