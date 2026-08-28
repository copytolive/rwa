import fs from 'node:fs';

const revenue=JSON.parse(fs.readFileSync('rwa-multichain-revenue.json','utf8'));
const engine=fs.readFileSync('rwa-multichain-engine.js','utf8');
const execution=fs.readFileSync('execution-api.js','utf8');
const execConfig=JSON.parse(fs.readFileSync('rwa-execution-config.json','utf8'));

const ok=(v,m)=>{if(!v){console.error('FAIL',m);process.exitCode=1}else console.log('PASS',m)};
const publicHttps=x=>/^https:\/\/[^\s]+$/i.test(String(x||''));

ok(revenue.version==='2.0.0','revenue config schema');
ok(revenue.integrator==='copytolive-rwa','canonical LI.FI integrator');
ok(Number(revenue.lifi?.fee_bps)>=0&&Number(revenue.lifi?.fee_bps)<=1000,'LI.FI fee bounded to 0-10%');
ok(Number(revenue.lifi?.fee_decimal)===Number(revenue.lifi?.fee_bps)/10000,'LI.FI decimal matches bps');
ok(revenue.policy?.never_charge_without_provider_confirmation===true,'provider-confirmation fee gate');
ok(revenue.policy?.never_bypass_ready_for_mainnet===true,'mainnet lock preserved');
ok(revenue.policy?.no_hidden_fee===true&&revenue.policy?.fee_must_be_visible_in_quote===true,'fee disclosure contract');
ok(revenue.policy?.provider_approval_evidence_required===true,'provider approval evidence contract');

if(revenue.lifi?.enabled){
  ok(revenue.lifi?.partner_configured===true,'LI.FI cannot enable before portal verification');
  ok(revenue.lifi?.payout_wallet_configured_externally===true,'LI.FI payout wallet must be externally configured');
  ok(publicHttps(revenue.lifi?.evidence_url),'LI.FI enabled state requires public HTTPS provider evidence');
}else{
  ok(revenue.mode!=='LIVE','disabled LI.FI revenue cannot claim LIVE');
}

if(revenue.hyperliquid?.enabled){
  ok(revenue.hyperliquid?.builder_wallet_configured===true,'Hyperliquid builder cannot enable before wallet configuration');
  ok(/^0x[a-fA-F0-9]{40}$/.test(revenue.hyperliquid?.builder_address||''),'Hyperliquid builder enabled state requires a valid address');
  ok(publicHttps(revenue.hyperliquid?.evidence_url),'Hyperliquid builder enabled state requires public HTTPS provider evidence');
}

ok(engine.includes("const REVENUE_URL='rwa-multichain-revenue.json'"),'engine loads canonical revenue config');
ok(engine.includes('function lifiRevenueEnabled('),'engine has explicit revenue activation predicate');
ok(engine.includes("x.enabled===true&&x.partner_configured===true&&x.payout_wallet_configured_externally===true"),'fee requires local enable + provider + payout verification');
ok(engine.includes("if(feeEnabled)p.set('fee'"),'LI.FI fee is appended only behind revenue predicate');
ok(engine.includes('appFeeEnabled:'),'quote summary exposes application-fee state');
ok(engine.includes('appFeeBps'),'quote summary exposes application-fee bps');
ok(engine.includes("const REVISION='3.0.0-tuntas'")&&engine.includes('revision:REVISION'),'engine exposes tuntas revenue-capable revision');
ok(engine.includes("integrator:INTEGRATOR"),'LI.FI quote keeps canonical integrator');
ok(engine.includes("READY_FOR_MAINNET")&&engine.includes('MULTICHAIN_READINESS_URL'),'multichain execution remains dual-machine-gated');
ok(!engine.includes("'/exchange'")&&!engine.includes('"/exchange"'),'multichain engine has no direct exchange writer');

ok(execution.includes('async function builderParam()'),'Hyperliquid builder parameter exists');
ok(execution.includes('async function approveBuilderFee('),'Hyperliquid builder approval exists');
ok(execution.includes("info('maxBuilderFee'"),'Hyperliquid builder approval is remotely queryable');
ok(execution.includes('...(builder?{builder}:{})'),'Hyperliquid orders can carry builder code');
ok(execConfig.builder?.enabled===false||(/^0x[a-fA-F0-9]{40}$/.test(execConfig.builder?.address||'')&&Number(execConfig.builder?.feeTenthsBp||0)>0),'builder fee config is valid or disabled');

if(process.exitCode)process.exit(process.exitCode);
console.log('MULTICHAIN_REVENUE_CONTRACT=PASS');
