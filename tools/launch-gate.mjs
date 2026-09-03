import {readFile,writeFile} from 'node:fs/promises';
import {publicHttps,RWA_EVIDENCE_POLICY} from './rwa-evidence-policy.mjs';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const text=async p=>readFile(p,'utf8');
const addr=x=>/^0x[a-fA-F0-9]{40}$/.test(String(x||''));
const txHash=x=>/^0x[a-fA-F0-9]{64}$/.test(String(x||''));
const rank={internal:1,closed:2,public:3};
const requiredEvidence=['ownership','appraisal','legal','kyb','disclosure'];
function okAsset(a){
  if(!a||a.status!=='VERIFIED'||!a.name||!(Number(a.nav)>0)||!a.issuer||!addr(a.reviewer)||!a.approval_signature)return false;
  const urls=requiredEvidence.map(k=>a[k]);
  return a.evidence_policy===RWA_EVIDENCE_POLICY&&urls.every(publicHttps)&&new Set(urls).size===5&&Array.isArray(a.evidence_probes)&&a.evidence_probes.length===5&&a.evidence_probes.every(x=>Number(x?.http_status)>=200&&Number(x?.http_status)<300);
}
function okExternalGate(g){return !!(g&&g.approved===true&&g.status==='VERIFIED'&&publicHttps(g.evidence_url))}
function productRwaTestnetOk(x){
  const contracts=Object.values(x?.contracts||{}),txs=x?.deployment_transactions||[];
  return x?.status==='TESTNET_VERIFIED'&&Number(x?.chain_id)===998&&contracts.length===3&&contracts.every(addr)&&new Set(contracts.map(v=>v.toLowerCase())).size===3&&txs.length>=3&&txs.every(txHash)&&x?.source_verified===true&&x?.role_assignments_verified===true&&x?.mint_revalidation_verified===true&&x?.redemption_lifecycle_verified===true&&publicHttps(x?.inventory_evidence_url)&&publicHttps(x?.verification_evidence_url);
}
async function workerHealth(cfg){
  if(!cfg.enabled||!/^https:\/\//i.test(String(cfg.base_url||'')))return{ok:false,ready:false,control:false,detail:'public worker URL not activated',controlDetail:'terminal service unavailable'};
  const base=String(cfg.base_url).replace(/\/$/,'');
  try{
    const [hr,tr]=await Promise.all([
      fetch(base+'/healthz',{cache:'no-store',signal:AbortSignal.timeout(8000)}),
      fetch(base+'/terminal/readyz',{cache:'no-store',signal:AbortSignal.timeout(8000)})
    ]);
    const [h,t]=await Promise.all([hr.json().catch(()=>({})),tr.json().catch(()=>({}))]);
    const terminalContract=
      hr.ok&&h.ok===true&&h.service==='rwa-terminal-service'&&
      tr.ok&&t.ok===true&&t.sessions===true&&t.alerts===true&&t.social===true&&t.rewards===true&&
      t.holders==='authoritative-source-gated'&&t.alerts_24_7===true&&t.alert_worker==='vercel-workflow';
    if(terminalContract){
      return{
        ok:true,
        ready:true,
        control:true,
        detail:JSON.stringify({service:h.service,version:h.version||t.version,terminal_ready:true,alerts_24_7:t.alerts_24_7,worker:t.alert_worker}),
        controlDetail:`terminal_service=true sessions=${t.sessions} alerts=${t.alerts} social=${t.social} rewards=${t.rewards} holders=${t.holders}`
      };
    }
    const rr=await fetch(base+'/readyz',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    const r=await rr.json().catch(()=>({}));
    const legacyContract=h.single_write_path==='RWAWorkerExecutionAPI'&&h.idempotency==='deterministic-cloid-v1'&&h.origin_bound===true;
    const legacyOk=hr.ok&&h.ok===true&&!h.kill_switch&&legacyContract;
    return{
      ok:legacyOk,
      ready:rr.ok&&r.ok===true,
      control:legacyOk&&rr.ok&&r.ok===true,
      detail:JSON.stringify({service:h.service,version:h.version,kill_switch:h.kill_switch,production_ready:h.production_ready,idempotency:h.idempotency,origin_bound:h.origin_bound,users:h.users}),
      controlDetail:`enabled=${legacyOk} legacy_readyz=${rr.ok&&r.ok===true}`
    };
  }catch(e){return{ok:false,ready:false,control:false,detail:String(e.message||e),controlDetail:String(e.message||e)}}
}
const [
  execution,core,workerExec,workerLoop,copyEngine,reviewers,assets,e2e,beta,workerCfg,control,revenue,
  rwaVerify,rwaPolicy,rwaClient,e2eVerify,betaVerify,securityGate,workerWatch,
  rwaWorkflow,e2eWorkflow,betaWorkflow,securityWorkflow,watchWorkflow,copyWorkflow,launchWorkflow,engineeringWorkflow,
  dockerfile,compose,envExample,workerReadme,
  productInventoryGate,productToken,redemptionManager,productTest,tokenWorkflow,productConfig,productTestnet,externalGates
]=await Promise.all([
  text('execution-api.js'),text('exchange-core.js'),text('agent-worker/execution.mjs'),text('agent-worker/worker.mjs'),text('agent-worker/copy-engine.mjs'),read('rwa-reviewers.json'),read('rwa-assets.json'),read('launch/e2e-registry.json'),read('launch/beta-registry.json'),read('agent-worker/public-config.json'),read('agent-worker/control.json'),read('rwa-execution-config.json'),
  text('tools/rwa-verify.mjs'),text('tools/rwa-evidence-policy.mjs'),text('rwa-verify-client.js'),text('tools/e2e-proof.mjs'),text('tools/beta-proof.mjs'),text('tools/security-gate.mjs'),text('tools/worker-watch.mjs'),
  text('.github/workflows/rwa-registry-review.yml'),text('.github/workflows/e2e-proof-review.yml'),text('.github/workflows/beta-proof-review.yml'),text('.github/workflows/security-gate.yml'),text('.github/workflows/worker-watch.yml'),text('.github/workflows/copy-production-sim.yml'),text('.github/workflows/launch-gate.yml'),text('.github/workflows/engineering-gate.yml'),
  text('agent-worker/Dockerfile'),text('agent-worker/docker-compose.yml'),text('agent-worker/.env.example'),text('agent-worker/README.md'),
  text('token/contracts/ProductInventoryGate.sol'),text('token/contracts/ProductRWA1155.sol'),text('token/contracts/RedemptionManager.sol'),text('token/test/product-rwa.test.mjs'),text('.github/workflows/token-contracts.yml'),read('token/product-rwa-config.json'),read('launch/product-rwa-testnet.json'),read('launch/external-gates.json')
]);
const health=await workerHealth(workerCfg);
const proofs=(beta.proofs||[]).filter(x=>x?.status==='VERIFIED'&&addr(x.wallet)&&rank[x.phase]);
const uniqueFor=minRank=>new Set(proofs.filter(x=>rank[x.phase]>=minRank).map(x=>String(x.wallet).toLowerCase())).size;
const betaCounts={internal:uniqueFor(1),closed:uniqueFor(2),public:uniqueFor(3)};
const thresholds={internal:Number(beta.thresholds?.internal||3),closed:Number(beta.thresholds?.closed||20),public:Number(beta.thresholds?.public||100)};
const metricsAvailable=workerLoop.includes("u.pathname==='/metrics'")||(workerLoop.includes("u.pathname==='/status'")&&workerLoop.includes('metrics:metrics()'));
const eg=externalGates.gates||{};

const checks={
  browser_single_write:{ok:execution.includes("hardening:'single-write-path-v1'")&&execution.includes("riskGate:'mandatory-internal-v1'")&&execution.includes("bracket:'atomic-normal-tpsl-v1'")&&core.includes("protection:'atomic-normal-tpsl-v1'"),detail:'RWAExecutionAPI + mandatory risk + atomic normalTpsl'},
  browser_global_mainnet_lock:{ok:core.includes("safety:'wallet-and-global-launch-gate-v3'")&&core.includes('localE2EVerified()&&globalMainnetReady()')&&core.includes("status==='READY_FOR_MAINNET'"),detail:'mainnet requires wallet E2E + global READY_FOR_MAINNET'},
  worker_single_write:{ok:workerExec.includes("WORKER_SINGLE_WRITE_PATH='RWAWorkerExecutionAPI'")&&!workerLoop.includes('ExchangeClient'),detail:'worker writes only through RWAWorkerExecutionAPI'},
  worker_idempotency:{ok:workerExec.includes("WORKER_IDEMPOTENCY='deterministic-cloid-v1'")&&workerExec.includes("info('orderStatus'")&&workerLoop.includes('cloidFor')&&workerLoop.includes('sourceFillId')&&copyEngine.includes('markProcessed'),detail:'deterministic CLOID + venue orderStatus + persisted source-fill ledger'},
  worker_no_fund_methods:{ok:!/(withdraw3|usdClassTransfer|spotSend|sendAsset)/.test(workerExec+workerLoop),detail:'no withdrawal/transfer API exposed'},
  tests_pipeline:{ok:copyWorkflow.includes('rwa/copy-production-sim')&&copyWorkflow.includes('node --test')&&securityWorkflow.includes('node tools/security-gate.mjs')&&engineeringWorkflow.includes('RWA_TRADING_RELEASE_SOURCE_PASS'),detail:'copy lifecycle simulation + security + trading release gates are automated'},
  deployment_package:{ok:dockerfile.includes('USER node')&&dockerfile.includes('HEALTHCHECK')&&compose.includes('restart: unless-stopped')&&compose.includes('rwa-agent-data:/data')&&envExample.includes('RWA_KEY_ENCRYPTION_SECRET')&&envExample.includes('RWA_PUBLIC_ORIGIN')&&workerReadme.includes('/readyz'),detail:'Docker + persistent volume + healthcheck + environment contract'},
  e2e_verifier_pipeline:{ok:e2eVerify.includes('E2E_PROOF_JSON_START')&&e2eVerify.includes('userFillsByTime')&&e2eWorkflow.includes('node tools/e2e-proof.mjs')&&e2eWorkflow.includes('launch/e2e-registry.json'),detail:'wallet signature + session-bound Hyperliquid testnet verifier'},
  rwa_verifier_pipeline:{ok:rwaVerify.includes('probeEvidencePayload')&&rwaVerify.includes('RWA_EVIDENCE_POLICY')&&rwaPolicy.includes(RWA_EVIDENCE_POLICY)&&rwaClient.includes('schema:2')&&rwaWorkflow.includes('node tools/rwa-verify.mjs')&&rwaWorkflow.includes('rwa-assets.json'),detail:`reviewer signature + ${RWA_EVIDENCE_POLICY}`},
  beta_verifier_pipeline:{ok:betaVerify.includes('BETA_PROOF_JSON_START')&&betaVerify.includes('userFillsByTime')&&betaVerify.includes('processed source fill')&&betaWorkflow.includes('node tools/beta-proof.mjs'),detail:'wallet + exact worker session + venue beta verifier'},
  beta_infrastructure:{ok:Array.isArray(beta.proofs)&&thresholds.internal>=3&&thresholds.closed>=20&&thresholds.public>=100&&betaWorkflow.includes('launch/beta-registry.json'),detail:`machine beta thresholds ${thresholds.internal}/${thresholds.closed}/${thresholds.public}`},
  security_ci_pipeline:{ok:securityGate.includes('single_write_path')&&securityGate.includes('worker_fund_isolation')&&securityGate.includes('rwa_evidence_policy')&&securityWorkflow.includes('node tools/security-gate.mjs'),detail:'repository-wide execution/fund/evidence security workflow'},
  monitoring_pipeline:{ok:workerLoop.includes("u.pathname==='/healthz'")&&workerLoop.includes("u.pathname==='/readyz'")&&metricsAvailable&&workerWatch.includes('kill_switch:true')&&workerWatch.includes('mainnet_enabled:false')&&watchWorkflow.includes("cron: '*/5"),detail:'health + readiness + metrics + five-minute fail-safe watchdog'},
  launch_automation:{ok:launchWorkflow.includes('node tools/launch-gate.mjs --write')&&launchWorkflow.includes('launch/readiness.json')&&launchWorkflow.includes("cron: '*/15")&&launchWorkflow.includes("context='rwa/launch-gate'"),detail:'machine readiness auto-refresh + CI launch status'},
  product_rwa_pipeline:{ok:productInventoryGate.includes('additionalMintable')&&productInventoryGate.includes('CoverageBreach')&&productToken.includes('SegregationOfDuties')&&productToken.includes('TransfersDisabled')&&productToken.includes('inventoryGate.recordMint')&&redemptionManager.includes('State.Delivered')&&redemptionManager.includes('burnForRedemption')&&productTest.includes('canonical additional mintable formula mismatch')&&productTest.includes('duplicate redeem claims')&&tokenWorkflow.includes('Product RWA')&&productConfig.transfer_enabled===false&&productConfig.secondary_market_enabled===false,detail:'canonical Product RWA entitlement + inventory-gated mint + SoD + transfer OFF + delivery-only redemption burn automated in CI'},
  real_wallet_e2e:{ok:(e2e.wallets||[]).some(x=>addr(x.wallet)&&x.status==='E2E_VERIFIED'&&Number(x.verified_at)>0),detail:`${(e2e.wallets||[]).length} registered wallet proof(s)`},
  reviewer_registry:{ok:(reviewers.reviewers||[]).some(x=>addr(typeof x==='string'?x:x.wallet)),detail:`${(reviewers.reviewers||[]).length} authorized reviewer(s)`},
  verified_rwa_asset:{ok:(assets.verified||[]).some(okAsset),detail:`${(assets.verified||[]).length} verified asset(s) · ${RWA_EVIDENCE_POLICY}`},
  product_rwa_testnet:{ok:productRwaTestnetOk(productTestnet),detail:productTestnet.status==='TESTNET_VERIFIED'?'HyperEVM chain-998 Product RWA deployment + role + mint/redeem evidence verified':`${productTestnet.status||'NOT_DEPLOYED'} · real chain-998 receipts + public evidence required`},
  worker_configured:{ok:!!(workerCfg.enabled&&/^https:\/\//i.test(String(workerCfg.base_url||''))),detail:workerCfg.enabled?String(workerCfg.base_url||'missing URL'):'disabled'},
  worker_live:{ok:health.ok,detail:health.detail},
  worker_control:{ok:health.control===true,detail:health.controlDetail},
  legal_terms:{ok:okExternalGate(eg.legal_terms),detail:`${eg.legal_terms?.status||'MISSING'} · ${eg.legal_terms?.required||'counsel-reviewed legal/Terms evidence required'}`},
  operating_economics:{ok:okExternalGate(eg.operating_economics),detail:`${eg.operating_economics?.status||'MISSING'} · ${eg.operating_economics?.required||'verified operating economics required'}`},
  inventory_reconciliation:{ok:okExternalGate(eg.inventory_reconciliation),detail:`${eg.inventory_reconciliation?.status||'MISSING'} · ${eg.inventory_reconciliation?.required||'real reconciliation evidence required'}`},
  refund_shortage_remedy:{ok:okExternalGate(eg.refund_shortage_remedy),detail:`${eg.refund_shortage_remedy?.status||'MISSING'} · ${eg.refund_shortage_remedy?.required||'pilot remedy evidence required'}`},
  settlement_tieout:{ok:okExternalGate(eg.settlement_tieout),detail:`${eg.settlement_tieout?.status||'MISSING'} · ${eg.settlement_tieout?.required||'pilot settlement evidence required'}`},
  incident_backup_recovery:{ok:okExternalGate(eg.incident_backup_recovery),detail:`${eg.incident_backup_recovery?.status||'MISSING'} · ${eg.incident_backup_recovery?.required||'pilot recovery evidence required'}`},
  evidence_repository:{ok:okExternalGate(eg.evidence_repository),detail:`${eg.evidence_repository?.status||'MISSING'} · ${eg.evidence_repository?.required||'real evidence repository required'}`},
  beta_internal:{ok:betaCounts.internal>=thresholds.internal,detail:`${betaCounts.internal}/${thresholds.internal} verified wallet(s)`},
  beta_closed:{ok:betaCounts.closed>=thresholds.closed,detail:`${betaCounts.closed}/${thresholds.closed} verified wallet(s)`},
  beta_public:{ok:betaCounts.public>=thresholds.public,detail:`${betaCounts.public}/${thresholds.public} verified wallet(s)`},
  mainnet_control:{ok:control.mainnet_enabled===true,detail:`mainnet_enabled=${control.mainnet_enabled}`},
  revenue_deferred:{ok:revenue.builder?.enabled===false&&Number(revenue.builder?.feeTenthsBp||0)===0,detail:'builder/platform fee remains OFF until final revenue wallet approval'}
};
const engineeringKeys=['browser_single_write','browser_global_mainnet_lock','worker_single_write','worker_idempotency','worker_no_fund_methods','tests_pipeline','deployment_package','e2e_verifier_pipeline','rwa_verifier_pipeline','beta_verifier_pipeline','beta_infrastructure','security_ci_pipeline','monitoring_pipeline','launch_automation','product_rwa_pipeline','revenue_deferred'];
const engineeringBlockers=engineeringKeys.filter(k=>!checks[k].ok).map(k=>({gate:k,detail:checks[k].detail}));
const engineering_ready=engineeringBlockers.length===0;
const prereqKeys=['real_wallet_e2e','reviewer_registry','verified_rwa_asset','product_rwa_testnet','worker_configured','worker_live','worker_control','legal_terms','operating_economics','inventory_reconciliation','refund_shortage_remedy','settlement_tieout','incident_backup_recovery','evidence_repository'];
const betaKeys=['beta_internal','beta_closed','beta_public'];
const prereqBlockers=prereqKeys.filter(k=>!checks[k].ok).map(k=>({gate:k,detail:checks[k].detail}));
const betaBlockers=betaKeys.filter(k=>!checks[k].ok).map(k=>({gate:k,detail:checks[k].detail}));
const beta_ready=engineering_ready&&prereqBlockers.length===0;
const beta_passed=beta_ready&&betaBlockers.length===0;
const mainnet_ready=beta_passed&&checks.mainnet_control.ok;
const blockers=[...engineeringBlockers,...prereqBlockers,...betaBlockers,...(!checks.mainnet_control.ok?[{gate:'mainnet_control',detail:checks.mainnet_control.detail}]:[])];
const status=mainnet_ready?'READY_FOR_MAINNET':beta_passed?'BETA_PASSED_AWAITING_MAINNET':beta_ready?'READY_FOR_BETA':'BLOCKED';
const out={schema:5,generated_at:new Date().toISOString(),status,engineering_ready,beta_ready,beta_passed,mainnet_ready,evidence_policy:RWA_EVIDENCE_POLICY,beta:{thresholds,counts:betaCounts,verified_proofs:proofs.length},product_rwa:{testnet_status:productTestnet.status||'NOT_DEPLOYED',transfer_enabled:false},checks,blockers,revenue:'DEFERRED',token_tge:'DEFERRED'};
if(process.argv.includes('--write'))await writeFile('launch/readiness.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(process.argv.includes('--require-engineering')&&!engineering_ready)process.exit(5);
if(process.argv.includes('--require-beta')&&!beta_ready)process.exit(2);
if(process.argv.includes('--require-beta-passed')&&!beta_passed)process.exit(4);
if(process.argv.includes('--require-mainnet')&&!mainnet_ready)process.exit(3);
