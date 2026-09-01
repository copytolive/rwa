import {readFile} from 'node:fs/promises';
const [root,runtime,engine,registryText,revenueText,fundingText,pilotText,pilotJs]=await Promise.all([
  readFile('index.html','utf8'),
  readFile('rwa-multichain.js','utf8'),
  readFile('rwa-multichain-engine.js','utf8'),
  readFile('rwa-multichain-registry.json','utf8'),
  readFile('rwa-multichain-revenue.json','utf8'),
  readFile('rwa-multichain-funding.json','utf8'),
  readFile('launch/multichain-pilot.json','utf8'),
  readFile('multichain-pilot.js','utf8')
]);
const fail=[];const ok=(v,m)=>{if(!v)fail.push(m)};
let registry=null,revenue=null,funding=null,pilot=null;
try{registry=JSON.parse(registryText)}catch{fail.push('registry is not valid JSON')}
try{revenue=JSON.parse(revenueText)}catch{fail.push('revenue config is not valid JSON')}
try{funding=JSON.parse(fundingText)}catch{fail.push('funding config is not valid JSON')}
try{pilot=JSON.parse(pilotText)}catch{fail.push('pilot config is not valid JSON')}
const staticScripts=(root.match(/<script\s+src=/g)||[]).length;
ok(staticScripts===14,`legacy root first-paint script budget changed: ${staticScripts}`);
ok(/SRC='rwa-multichain\.js\?v=\d+'/.test(root),'root lazy MULTI CHAIN bootstrap missing');
ok(root.includes('rwaMultiChainLazyBootstrap'),'root MULTI CHAIN lazy bootstrap marker missing');
ok(!/<script\s+src=["']rwa-multichain\.js/i.test(root),'MULTI CHAIN must not become a first-paint external script');
ok(runtime.includes("POLICY='chain-abstraction-fail-closed-v2'"),'runtime fail-closed policy missing');
ok(runtime.includes("REVISION='3.0.0-tuntas'"),'runtime tuntas revision missing');
ok(runtime.includes("ENGINE_SRC='rwa-multichain-engine.js?v=2'"),'route engine lazy source missing');
ok(runtime.includes('One balance. Many networks.'),'unified user surface missing');
ok(runtime.includes('UNIFIED ROUTE PREVIEW'),'route preview surface missing');
ok(runtime.includes('UNIFIED BALANCE'),'unified balance surface missing');
ok(runtime.includes('PERSISTENT TRANSACTION LIFECYCLE'),'persistent lifecycle UI missing');
ok(runtime.includes('HYPERLIQUID FUNDING HANDOFF'),'Hyperliquid funding handoff UI missing');
ok(runtime.includes('MAINNET LOCKED'),'global execution lock label missing');
ok(runtime.includes('window.RWAMultiChain'),'public multi-chain API missing');
ok(engine.includes("const REVISION='3.0.0-tuntas'"),'engine tuntas revision missing');
ok(engine.includes("const LIFI='https://li.quest/v1'"),'LI.FI route provider missing');
ok(engine.includes('async function discover('),'cross-chain token discovery missing');
ok(engine.includes('async function portfolio('),'unified portfolio aggregation missing');
ok(engine.includes('async function quote(')&&engine.includes('/quote?'),'same/cross-chain quote engine missing');
ok(engine.includes('assertAddressFamily')&&engine.includes('resolveDestinationAddress'),'EVM/Solana destination family binding missing');
ok(engine.includes("'simulateTransaction'")&&engine.includes("replaceRecentBlockhash:true"),'real Solana RPC preflight missing');
ok(engine.includes('async function waitEvmReceipt('),'EVM receipt barrier missing');
ok(engine.includes("status:'APPROVAL_CONFIRMED'")&&engine.includes('Post-approval simulation'),'post-approval receipt/simulation barrier missing');
ok(engine.includes("LIFECYCLE_KEY='rwa_multichain_lifecycle_v3'")&&engine.includes('recoverLifecycle'),'persistent lifecycle recovery missing');
ok(engine.includes('async function walletContext(')&&engine.includes('window.RWAProvider||window.ethereum')&&engine.includes('window.solflare')&&engine.includes('window.backpack'),'unified EVM/WalletConnect/Solana provider abstraction missing');
ok(engine.includes("MULTICHAIN_READINESS_URL='launch/multichain-readiness.json'"),'dedicated multichain mainnet gate missing');
ok(engine.includes('global&&multi'),'execution must require global plus MULTI CHAIN readiness');
ok(engine.includes('async function prepareHyperliquidFunding('),'Hyperliquid funding staging handoff missing');
ok(engine.includes('legacy_bridge_direct_write')===false,'engine must not use legacy bridge direct-write field as executable code');
ok(engine.includes('async function status(')&&engine.includes('/status?'),'cross-chain status tracking missing');
ok(engine.includes('fromAmountForGas'),'destination gas/refuel hook missing');
ok(!runtime.includes('ExchangeClient')&&!engine.includes('ExchangeClient'),'MULTI CHAIN must not create a second exchange write client');
ok(!/api\.hyperliquid(?:-testnet)?\.xyz\/exchange|['"]\/exchange['"]/.test(runtime+engine),'MULTI CHAIN contains a direct Hyperliquid exchange write path');
ok(!/x-lifi-api-key/i.test(runtime+engine+pilotJs),'browser runtime must not embed a LI.FI API key');
try{new Function(runtime)}catch(e){fail.push(`runtime syntax invalid: ${e.message}`)}
try{new Function(engine)}catch(e){fail.push(`engine syntax invalid: ${e.message}`)}
try{new Function(pilotJs)}catch(e){fail.push(`pilot syntax invalid: ${e.message}`)}
if(registry){
  ok(registry.schema===2&&registry.version==='2.0.0','registry V2 schema/version mismatch');
  ok(registry.policy==='chain-abstraction-fail-closed-v2','registry policy mismatch');
  ok(Array.isArray(registry.networks)&&registry.networks.length===9,'registry must expose exactly 9 canonical network contexts');
  const ids=registry.networks.map(x=>x.id);ok(new Set(ids).size===ids.length,'network ids must be unique');
  for(const id of ['hyperliquid','arbitrum','ethereum','base','solana','bnb','polygon','avalanche','monad'])ok(ids.includes(id),`required network missing: ${id}`);
  const hyper=registry.networks.find(x=>x.id==='hyperliquid');ok(hyper?.status==='EXECUTION_GATED'&&hyper?.capabilities?.execution==='machine-gated','Hyperliquid must stay protected/machine gated');
  const routed=registry.networks.filter(x=>x.status==='ROUTE_READY');ok(routed.length===8,'eight non-Hyperliquid networks must be route-ready');
  ok(routed.every(x=>x.capabilities?.route_quote===true&&x.capabilities?.simulation===true&&x.capabilities?.execution==='machine-gated-router'),'routed networks must be quote/simulation ready but execution gated');
}
if(revenue){
  ok(revenue.version==='3.0.0','revenue config version must be 3.0.0');
  ok(revenue.lifi?.enabled===false&&revenue.hyperliquid?.enabled===false,'fees must remain disabled until real fee-wallet/builder setup is verified');
  ok(revenue.lifi?.fee_bps>0&&revenue.lifi?.integrator_verified===false,'LI.FI fee intent must be configured but gated');
  ok(revenue.hyperliquid?.user_approval_required===true&&Number(revenue.hyperliquid?.builder_min_account_value_usdc)>=100,'Hyperliquid builder user-approval/equity rule missing');
  ok(revenue.policy?.provider_setup_evidence_required===true&&revenue.policy?.user_builder_approval_required===true&&revenue.policy?.fail_closed===true,'provider setup/user approval fail-closed policy missing');
}
if(funding){
  const h=funding.hyperliquid||{};
  ok(funding.version==='2.0.0','funding config version must be 2.0.0');
  ok(h.enabled===true&&h.adapter_verified===true&&h.adapter==='HYPERLIQUID_BRIDGE2_ARBITRUM_USDC','official Hyperliquid Bridge2 adapter must be enabled and verified');
  ok(String(h.bridge_address||'').toLowerCase()==='0x2df1c51e09aecf9cacb7bc98cb1742757f163df7','official Bridge2 address mismatch');
  ok(String(h.arbitrum_usdc_address||'').toLowerCase()==='0xaf88d065e77c8cc2239327c5edb3a432268e5831','native Arbitrum USDC address mismatch');
  ok(Number(h.minimum_deposit_usdc)>=5,'Hyperliquid minimum deposit protection missing');
  ok(h.legacy_bridge_direct_write===false,'legacy Hyperliquid bridge direct write must remain disabled');
  ok(funding.policy?.official_bridge2_only===true&&funding.policy?.no_unverified_bridge_write===true&&funding.policy?.final_hyperliquid_handoff_fail_closed===true,'Hyperliquid funding safety policy missing');
}
if(pilot){
  const routes=pilot.routes||{},fund=routes.HYPERLIQUID_FUNDING||{},ordinary=Object.entries(routes).filter(([k])=>k!=='HYPERLIQUID_FUNDING').map(([,v])=>v);
  ok(pilot.schema===2&&pilot.status==='PILOT_ONLY'&&pilot.enabled===true,'pilot V2 policy missing');
  ok(pilot.unrestricted_mainnet===false,'pilot must never unlock unrestricted mainnet');
  ok(Number(pilot.max_total_usd_per_session)<=125,'pilot total-value cap too high');
  ok(ordinary.every(x=>Number(x.max_amount)<=2),'ordinary real-receipt route cap must stay <=2 USDC');
  ok(Number(fund.min_amount)>=5&&Number(fund.max_amount)<=105&&Number(fund.target_account_value_usdc)>=100,'Hyperliquid builder activation funding must stay 5-105 USDC with >=100 USDC target');
  ok(pilot.failure_or_refund?.intentional_failure_forbidden===true,'pilot must forbid intentional failure');
  ok(pilot.policy?.never_store_private_keys===true&&pilot.policy?.never_request_seed_phrase===true&&pilot.policy?.no_background_signing===true&&pilot.policy?.builder_activation_requires_user_signature===true,'pilot wallet-safety policy missing');
  ok(/^https:\/\//.test(String(pilot.evidence?.evm_explorers?.arbitrum||''))&&/^https:\/\//.test(String(pilot.evidence?.solana_explorer||''))&&/^https:\/\//.test(String(pilot.evidence?.lifi_status_api||'')),'pilot machine-verifiable HTTPS evidence endpoints missing');
  ok(pilotJs.includes('REAL MONEY PILOT')&&pilotJs.includes('REAL HYPERLIQUID FUNDING'),'explicit real-value confirmation copy missing');
  ok(pilotJs.includes('evidenceUrl(')&&pilotJs.includes('lifiStatusUrl('),'pilot must emit machine-verifiable receipt evidence URLs');
  ok(!/privateKey|seed phrase.*prompt|mnemonic.*prompt/i.test(pilotJs),'pilot must not request wallet secrets');
}
if(fail.length){console.error(JSON.stringify({ok:false,contract:'rwa-multichain-mainnet-go-v5',fail},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,contract:'rwa-multichain-mainnet-go-v5',policy:'chain-abstraction-fail-closed-v2',networks:registry.networks.length,first_paint_scripts:staticScripts,capabilities:['address-family-binding','solana-rpc-preflight','approval-receipt-barrier','persistent-lifecycle','walletconnect-evm-solana-abstraction','official-hyperliquid-bridge2','machine-verifiable-real-receipt-pilot','builder-activation-target','dual-mainnet-gate','visible-fee-disclosure']},null,2));
