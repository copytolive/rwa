import {readFile} from 'node:fs/promises';
const [root,runtime,engine,registryText]=await Promise.all([readFile('index.html','utf8'),readFile('rwa-multichain.js','utf8'),readFile('rwa-multichain-engine.js','utf8'),readFile('rwa-multichain-registry.json','utf8')]);
const fail=[];const ok=(v,m)=>{if(!v)fail.push(m)};let registry=null;try{registry=JSON.parse(registryText)}catch{fail.push('registry is not valid JSON')}
const staticScripts=(root.match(/<script\s+src=/g)||[]).length;
ok(staticScripts===6,`first-paint external script budget changed: ${staticScripts}`);
ok(/SRC='rwa-multichain\.js\?v=\d+'/.test(root),'root lazy MULTI CHAIN bootstrap missing');
ok(root.includes('rwaMultiChainLazyBootstrap'),'root MULTI CHAIN lazy bootstrap marker missing');
ok(!/<script\s+src=["']rwa-multichain\.js/i.test(root),'MULTI CHAIN must not become a first-paint external script');
ok(runtime.includes("POLICY='chain-abstraction-fail-closed-v2'"),'runtime V2 fail-closed policy missing');
ok(runtime.includes("ENGINE_SRC='rwa-multichain-engine.js?v=2'"),'route engine is not lazy-loaded by runtime');
ok(runtime.includes('One balance. Many networks.'),'unified multi-chain user surface missing');
ok(runtime.includes('UNIFIED ROUTE PREVIEW'),'route preview surface missing');
ok(runtime.includes('UNIFIED BALANCE'),'unified balance surface missing');
ok(runtime.includes('MAINNET LOCKED'),'runtime must communicate the global execution readiness boundary');
ok(runtime.includes('window.RWAMultiChain'),'public multi-chain API missing');
ok(engine.includes("const VERSION='2.0.0'"),'engine V2 marker missing');
ok(engine.includes("const LIFI='https://li.quest/v1'"),'LI.FI route provider missing');
ok(engine.includes('async function discover('),'cross-chain token discovery missing');
ok(engine.includes('async function portfolio('),'unified portfolio aggregation missing');
ok(engine.includes('async function quote(')&&engine.includes('/quote?'),'same/cross-chain quote engine missing');
ok(engine.includes('async function simulate(')&&engine.includes('eth_estimateGas'),'pre-execution simulation missing');
ok(engine.includes('async function allowance(')&&engine.includes('0xdd62ed3e'),'ERC20 allowance verification missing');
ok(engine.includes('async function approve(')&&engine.includes('0x095ea7b3'),'ERC20 approval flow missing');
ok(engine.includes("r?.mainnet_ready===true&&r?.status==='READY_FOR_MAINNET'"),'machine launch lock missing from route execution');
ok(engine.includes("method:'signAndSendTransaction'"),'Solana injected-wallet signing adapter missing');
ok(engine.includes('solanaMessageFromTransaction'),'Solana serialized transaction decoder missing');
ok(engine.includes('async function status(')&&engine.includes('/status?'),'cross-chain status tracking missing');
ok(engine.includes('fromAmountForGas'),'destination gas/refuel hook missing');
ok(!runtime.includes('ExchangeClient')&&!engine.includes('ExchangeClient'),'MULTI CHAIN must not create a second exchange write client');
ok(!/api\.hyperliquid(?:-testnet)?\.xyz\/exchange|['"]\/exchange['"]/.test(runtime+engine),'MULTI CHAIN contains a direct Hyperliquid exchange write path');
ok(!/x-lifi-api-key/i.test(runtime+engine),'browser runtime must not embed a LI.FI API key');
try{new Function(engine)}catch(e){fail.push(`engine syntax invalid: ${e.message}`)}
if(registry){
 ok(registry.schema===2&&registry.version==='2.0.0','registry V2 schema/version mismatch');
 ok(registry.policy==='chain-abstraction-fail-closed-v2','registry V2 policy mismatch');
 ok(registry.principles?.unified_balance===true&&registry.principles?.unified_route_preview===true,'unified balance/route principles missing');
 ok(Array.isArray(registry.networks)&&registry.networks.length===9,'registry must expose exactly 9 canonical network contexts');
 const ids=(registry.networks||[]).map(x=>x.id);ok(new Set(ids).size===ids.length,'network ids must be unique');
 for(const id of ['hyperliquid','arbitrum','ethereum','base','solana','bnb','polygon','avalanche','monad'])ok(ids.includes(id),`required network missing: ${id}`);
 const hyper=registry.networks.find(x=>x.id==='hyperliquid');ok(hyper?.status==='EXECUTION_GATED'&&hyper?.capabilities?.execution==='machine-gated','Hyperliquid must stay protected/machine gated');
 const routed=registry.networks.filter(x=>x.status==='ROUTE_READY');ok(routed.length===8,'eight non-Hyperliquid networks must be route-ready');
 ok(routed.every(x=>x.capabilities?.route_quote===true&&x.capabilities?.simulation===true&&x.capabilities?.execution==='machine-gated-router'),'route-ready networks must expose quote/simulation while keeping execution machine-gated');
 const sol=registry.networks.find(x=>x.id==='solana');ok(sol?.lifi_chain_id===1151111081099710&&sol?.wallet_adapter==='phantom-request-v1','Solana route/wallet adapter contract mismatch');
 const monad=registry.networks.find(x=>x.id==='monad');ok(monad?.lifi_chain_id===143&&monad?.chain_id==='0x8f','Monad mainnet chain contract mismatch');
 const arb=registry.networks.find(x=>x.id==='arbitrum');ok(arb?.capabilities?.funding==='machine-gated-usdc','Arbitrum protected USDC funding contract missing');
}
if(fail.length){console.error(JSON.stringify({ok:false,contract:'rwa-multichain-v2',fail},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,contract:'rwa-multichain-v2',policy:'chain-abstraction-fail-closed-v2',networks:registry.networks.length,route_ready:registry.networks.filter(x=>x.status==='ROUTE_READY').length,protected_execution:registry.networks.filter(x=>x.status==='EXECUTION_GATED').length,first_paint_scripts:staticScripts,capabilities:['unified-balance','token-discovery','quote','simulation','evm-approval','evm-sign','solana-sign','status-tracking','gas-refuel-hook','machine-mainnet-lock']},null,2));
