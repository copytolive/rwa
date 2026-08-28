import fs from 'node:fs';

const revenue=JSON.parse(fs.readFileSync('rwa-multichain-revenue.json','utf8'));
const engine=fs.readFileSync('rwa-multichain-engine.js','utf8');
const execution=fs.readFileSync('execution-api.js','utf8');
const execConfig=JSON.parse(fs.readFileSync('rwa-execution-config.json','utf8'));

const ok=(v,m)=>{if(!v){console.error('FAIL',m);process.exitCode=1}else console.log('PASS',m)};

ok(revenue.version==='1.0.0','revenue config schema');
ok(revenue.integrator==='copytolive-rwa','canonical LI.FI integrator');
ok(Number(revenue.lifi?.fee_bps)>=0&&Number(revenue.lifi?.fee_bps)<=1000,'LI.FI fee bounded to 0-10%');
ok(Number(revenue.lifi?.fee_decimal)===Number(revenue.lifi?.fee_bps)/10000,'LI.FI decimal matches bps');
ok(revenue.policy?.never_charge_without_provider_confirmation===true,'provider-confirmation fee gate');
ok(revenue.policy?.never_bypass_ready_for_mainnet===true,'mainnet lock preserved');
ok(revenue.policy?.no_hidden_fee===true&&revenue.policy?.fee_must_be_visible_in_quote===true,'fee disclosure contract');

if(revenue.lifi?.enabled){
  ok(revenue.lifi?.partner_configured===true,'LI.FI cannot enable before portal verification');
  ok(revenue.lifi?.payout_wallet_configured_externally===true,'LI.FI payout wallet must be externally configured');
}else{
  ok(revenue.mode!=='LIVE','disabled LI.FI revenue cannot claim LIVE');
}

ok(engine.includes("integrator:INTEGRATOR"),'LI.FI quote keeps canonical integrator');
ok(engine.includes("READY_FOR_MAINNET"),'multichain execution remains machine-gated');
ok(!engine.includes("'/exchange'")&&!engine.includes('"/exchange"'),'multichain engine has no direct exchange writer');

ok(execution.includes('async function builderParam()'),'Hyperliquid builder parameter exists');
ok(execution.includes('async function approveBuilderFee('),'Hyperliquid builder approval exists');
ok(execution.includes("info('maxBuilderFee'"),'Hyperliquid builder approval is remotely queryable');
ok(execution.includes('...(builder?{builder}:{})'),'Hyperliquid orders can carry builder code');
ok(execConfig.builder?.enabled===false||(/^0x[a-fA-F0-9]{40}$/.test(execConfig.builder?.address||'')&&Number(execConfig.builder?.feeTenthsBp||0)>0),'builder fee config is valid or disabled');

if(process.exitCode)process.exit(process.exitCode);
console.log('MULTICHAIN_REVENUE_CONTRACT=PASS');
