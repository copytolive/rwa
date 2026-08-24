import {readFile,readdir} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {publicHttps,RWA_EVIDENCE_POLICY} from './rwa-evidence-policy.mjs';

const ROOT=process.cwd();
const allowExchangeClient=new Set(['execution-api.js','agent-worker/execution.mjs']);
const skipPrefix=['.git/','node_modules/','agent-worker/node_modules/','token/node_modules/'];
const runtimeExt=/\.(?:js|mjs)$/;
const findings=[];
const pass=[];
const fail=(gate,detail)=>findings.push({gate,detail});
const ok=(gate,detail)=>pass.push({gate,detail});

async function walk(dir=ROOT){
  const out=[];
  for(const e of await readdir(dir,{withFileTypes:true})){
    const abs=join(dir,e.name),rel=relative(ROOT,abs).replaceAll('\\','/');
    if(skipPrefix.some(x=>(rel+'/').startsWith(x)))continue;
    if(e.isDirectory())out.push(...await walk(abs));else out.push(rel);
  }
  return out;
}
const files=await walk();
const runtime=files.filter(f=>runtimeExt.test(f)&&!f.startsWith('tools/')&&!f.includes('/test/')&&!f.startsWith('.github/'));
const cache=new Map();
async function txt(f){if(!cache.has(f))cache.set(f,await readFile(f,'utf8'));return cache.get(f)}

for(const f of runtime){
  const s=await txt(f);
  if(s.includes('ExchangeClient')&&!allowExchangeClient.has(f))fail('single_write_path',`${f} references ExchangeClient`);
  if(/api\.hyperliquid(?:-testnet)?\.xyz\/exchange|['"]\/exchange['"]/.test(s)&&!allowExchangeClient.has(f))fail('direct_exchange_http',`${f} contains a direct Hyperliquid exchange route`);
}
if(!findings.some(x=>x.gate==='single_write_path'))ok('single_write_path','ExchangeClient limited to browser/worker execution owners');
if(!findings.some(x=>x.gate==='direct_exchange_http'))ok('direct_exchange_http','No secondary direct Hyperliquid exchange HTTP write path found');

const execution=await txt('execution-api.js'),core=await txt('exchange-core.js'),worker=await txt('agent-worker/worker.mjs'),workerExec=await txt('agent-worker/execution.mjs'),suiteNav=await txt('suite-nav.js'),rwaVerify=await txt('tools/rwa-verify.mjs'),rwaPolicy=await txt('tools/rwa-evidence-policy.mjs'),rwaClient=await txt('rwa-verify-client.js'),fund=await txt('trade/fund-modal.js'),tradeClient=await txt('trade/hyperliquid.js'),release=await txt('trade/release-runtime.js'),socialDefaults=await txt('social-notification-defaults.js'),socialPro=await txt('social-trading-pro.js'),rootHtml=await txt('index.html');
const execChecks=[
  ['browser_risk',execution.includes("riskGate:'mandatory-internal-v1'")&&execution.includes('dailyLoss')&&execution.includes('maxLeverage')&&execution.includes('maxExposure')&&execution.includes('perAsset')&&execution.includes('kill')],
  ['atomic_tpsl',execution.includes("bracket:'atomic-normal-tpsl-v1'")&&execution.includes("grouping:'normalTpsl'")],
  ['agent_verification',execution.includes("info('extraAgents'")&&execution.includes('removeAgent')],
  ['global_mainnet_lock',core.includes("safety:'wallet-and-global-launch-gate-v3'")&&core.includes('localE2EVerified()&&globalMainnetReady()')&&core.includes("status==='READY_FOR_MAINNET'")],
  ['execution_owner_mainnet_lock',execution.includes("productionGate:'machine-wallet-gate-v1'")&&execution.includes("status==='READY_FOR_MAINNET'")&&execution.includes("x?.status==='E2E_VERIFIED'")&&execution.includes('if(!testnet&&!reduceOnly)await requireProductionGate()')],
  ['master_funds_gate',execution.includes('async function depositMainnet')&&execution.includes('async function withdrawMainnet')&&execution.includes("confirmText).trim()!=='DEPOSIT'")&&execution.includes("confirmText).trim()!=='WITHDRAW'")&&execution.includes('await mainExchange(false)')&&execution.includes('withdraw3')&&execution.includes('wallet_switchEthereumChain')&&execution.includes('usdc.transfer(f.bridgeAddress')],
  ['trade_funds_ui_gate',fund.includes("type:'claimDrip'")&&fund.includes('api.funds.depositMainnet')&&tradeClient.includes('api.funds.withdrawMainnet')&&release.includes('mainnetDepositBtn')&&release.includes('Withdraw · mainnet only')],
  ['worker_risk',workerExec.includes('async riskCheck')&&workerExec.includes('dailyLoss')&&workerExec.includes('maxLeverage')&&workerExec.includes('maxExposure')&&workerExec.includes('perAsset')&&workerExec.includes('copyRemaining')],
  ['worker_idempotency',workerExec.includes("WORKER_IDEMPOTENCY='deterministic-cloid-v1'")&&workerExec.includes("info('orderStatus'")&&worker.includes('sourceFillId')&&worker.includes('cloidFor')&&worker.includes('copy.retry_pending')],
  ['worker_replay_auth',worker.includes('consumeNonce')&&worker.includes('RWA_PUBLIC_ORIGIN')&&worker.includes('RWA_ALLOWED_ORIGINS')],
  ['worker_agent_revoke',worker.includes('api.verifyAgent()')&&worker.includes("reason:'agent-not-authorized'")&&worker.includes('delete rec.agent.secret')],
  ['single_auth_owner',suiteNav.includes('wallet-core.js v3 is the only auth owner')&&!suiteNav.includes("load('wallet-auth.js")&&!suiteNav.includes("load('walletconnect-auth-patch.js")],
  ['social_notification_opt_in',socialDefaults.includes("policy:'explicit-opt-in-v1'")&&socialDefaults.includes('friends:false')&&socialDefaults.includes('top:false')&&socialDefaults.includes('trending:false')&&socialDefaults.includes('newFollowers:false')&&rootHtml.indexOf('social-notification-defaults.js?v=1')<rootHtml.indexOf('social-trading-pro.js?v=1')],
  ['social_read_only',socialPro.includes("runtime:'venue-backed-social-feed-v1'")&&socialPro.includes('userFillsByTime')&&!socialPro.includes('ExchangeClient')&&!/api\.hyperliquid(?:-testnet)?\.xyz\/exchange|['"]\/exchange['"]/.test(socialPro)],
  ['rwa_evidence_policy',rwaVerify.includes('probeEvidencePayload')&&rwaVerify.includes('RWA_EVIDENCE_POLICY')&&rwaPolicy.includes("public-https-distinct-probed-v1")&&rwaClient.includes('schema:2')&&rwaClient.includes('kyb:v.kyb')&&rwaClient.includes('disclosure:v.disclosure')&&suiteNav.includes('rwa-verification-evidence.js?v=1')]
];
for(const [gate,value] of execChecks)value?ok(gate,'PASS'):fail(gate,'required safety marker missing');

if(/withdraw3|usdClassTransfer|spotSend|sendAsset/.test(worker+workerExec))fail('worker_fund_isolation','worker exposes or references a prohibited fund movement method');else ok('worker_fund_isolation','No worker withdrawal/transfer/send method');

const revenue=JSON.parse(await readFile('rwa-execution-config.json','utf8'));
if(revenue.builder?.enabled===false&&Number(revenue.builder?.feeTenthsBp||0)===0&&!String(revenue.builder?.address||''))ok('revenue_off','Builder revenue remains OFF');else fail('revenue_off','Builder revenue must remain OFF before final launch decision');
if(revenue.funding?.mainnetEnabledByMachineGateOnly===true&&revenue.funding?.routePolicy==='machine-gated-master-wallet-only'&&Number(revenue.funding?.minimumDepositUsdc)>=5)ok('funding_route_policy','Mainnet funding route is machine-gated, master-wallet-only and enforces minimum deposit');else fail('funding_route_policy','Mainnet funding route policy is incomplete');
const token=JSON.parse(await readFile('token/config.json','utf8'));
if(token.tgeEnabled===false&&token.mainnetDeploymentEnabled===false)ok('token_deferred','TGE and token mainnet deployment remain disabled');else fail('token_deferred','Token/TGE mainnet controls are not deferred');
const reviewers=JSON.parse(await readFile('rwa-reviewers.json','utf8')),assets=JSON.parse(await readFile('rwa-assets.json','utf8'));
if(Array.isArray(reviewers.reviewers)&&Array.isArray(assets.verified))ok('rwa_registry_contract','Reviewer and verified-asset registries are explicit');else fail('rwa_registry_contract','RWA registries malformed');
for(const a of assets.verified||[]){
  const urls=['ownership','appraisal','legal','kyb','disclosure'].map(k=>a?.[k]);
  if(a.status!=='VERIFIED'||Number(a.nav)<=0||a.evidence_policy!==RWA_EVIDENCE_POLICY||urls.some(x=>!publicHttps(x))||new Set(urls).size!==5||!Array.isArray(a.evidence_probes)||a.evidence_probes.length!==5)fail('rwa_verified_asset_integrity',`${a?.id||a?.name||'asset'} does not meet the current evidence policy`);
}
if(!findings.some(x=>x.gate==='rwa_verified_asset_integrity'))ok('rwa_verified_asset_integrity','All registry VERIFIED assets satisfy the current evidence policy');

const report={schema:4,generated_at:new Date().toISOString(),status:findings.length?'FAIL':'PASS',checked_runtime_files:runtime.length,evidence_policy:RWA_EVIDENCE_POLICY,passes:pass,findings};
console.log(JSON.stringify(report,null,2));
if(findings.length)process.exit(2);
