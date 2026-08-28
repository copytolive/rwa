import {readFile} from 'node:fs/promises';
const [root,runtime,engine,registryText,revenueText,fundingText]=await Promise.all([
  readFile('index.html','utf8'),
  readFile('rwa-multichain.js','utf8'),
  readFile('rwa-multichain-engine.js','utf8'),
  readFile('rwa-multichain-registry.json','utf8'),
  readFile('rwa-multichain-revenue.json','utf8'),
  readFile('rwa-multichain-funding.json','utf8')
]);
const fail=[];const ok=(v,m)=>{if(!v)fail.push(m)};
let registry=null,revenue=null,funding=null;
try{registry=JSON.parse(registryText)}catch{fail.push('registry is not valid JSON')}
try{revenue=JSON.parse(revenueText)}catch{fail.push('revenue config is not valid JSON')}
try{funding=JSON.parse(fundingText)}catch{fail.push('funding config is not valid JSON')}
const staticScripts=(root.match(/<script\s+src=/g)||[]).length;
ok(staticScripts===6,`first-paint external script budget changed: ${staticScripts}`);
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
ok(!/x-lifi-api-key/i.test(runtime+engine),'browser runtime must not embed a LI.FI API key');
try{new Function(runtime)}catch(e){fail.push(`runtime syntax invalid: ${e.message}`)}
try{new Function(engine)}catch(e){fail.push(`engine syntax invalid: ${e.message}`)}
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
 ok(revenue.version==='2.0.0','revenue config version must be 2.0.0');
 ok(revenue.lifi?.enabled===false&&revenue.hyperliquid?.enabled===false,'provider fees must remain disabled until approval');
 ok(revenue.policy?.provider_approval_evidence_required===true&&revenue.policy?.fail_closed===true,'provider evidence fail-closed policy missing');
}
if(funding){
 ok(funding.hyperliquid?.enabled===false&&funding.hyperliquid?.adapter_verified===false,'Hyperliquid funding adapter must remain disabled until verified');
 ok(funding.hyperliquid?.legacy_bridge_direct_write===false,'legacy Hyperliquid bridge direct write must remain disabled');
 ok(funding.policy?.final_hyperliquid_handoff_fail_closed===true,'Hyperliquid funding final handoff must fail closed');
}
if(fail.length){console.error(JSON.stringify({ok:false,contract:'rwa-multichain-tuntas-v3',fail},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,contract:'rwa-multichain-tuntas-v3',policy:'chain-abstraction-fail-closed-v2',networks:registry.networks.length,first_paint_scripts:staticScripts,capabilities:['address-family-binding','solana-rpc-preflight','approval-receipt-barrier','persistent-lifecycle','walletconnect-evm-solana-abstraction','hyperliquid-funding-staging','dual-mainnet-gate','visible-fee-disclosure']},null,2));
