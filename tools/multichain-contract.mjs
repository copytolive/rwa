import {readFile} from 'node:fs/promises';

const [root,runtime,registryText]=await Promise.all([
  readFile('index.html','utf8'),
  readFile('rwa-multichain.js','utf8'),
  readFile('rwa-multichain-registry.json','utf8')
]);
const fail=[];
const ok=(v,m)=>{if(!v)fail.push(m)};
let registry=null;
try{registry=JSON.parse(registryText)}catch{fail.push('registry is not valid JSON')}

ok(root.includes('rwa-multichain.js?v=1'),'root does not load the multi-chain runtime');
ok(root.indexOf('superapp-v5.js?v=17')>=0&&root.indexOf('superapp-v5.js?v=17')<root.indexOf('rwa-multichain.js?v=1'),'multi-chain runtime must load after the canonical Super App');
ok(runtime.includes("POLICY='chain-abstraction-fail-closed-v1'"),'runtime fail-closed policy missing');
ok(runtime.includes('window.RWAMultiChain'),'public multi-chain API missing');
ok(runtime.includes('MULTI CHAIN'),'visible MULTI CHAIN surface missing');
ok(runtime.includes('No transaction was sent'),'unsupported-network fail-closed user feedback missing');
ok(!runtime.includes('ExchangeClient'),'multi-chain UI must not create an exchange write client');
ok(!/api\.hyperliquid(?:-testnet)?\.xyz\/exchange|['"]\/exchange['"]/.test(runtime),'multi-chain UI contains a direct exchange write route');
if(registry){
  ok(registry.policy==='chain-abstraction-fail-closed-v1','registry policy mismatch');
  ok(Array.isArray(registry.networks)&&registry.networks.length>=8,'multi-chain registry must expose at least 8 network contexts');
  const ids=(registry.networks||[]).map(x=>x.id);
  ok(new Set(ids).size===ids.length,'network ids must be unique');
  for(const id of ['hyperliquid','arbitrum','ethereum','base','solana','bnb'])ok(ids.includes(id),`required network missing: ${id}`);
  const hyper=registry.networks.find(x=>x.id==='hyperliquid');
  const arb=registry.networks.find(x=>x.id==='arbitrum');
  ok(hyper?.status==='EXECUTION_GATED'&&hyper?.capabilities?.execution==='machine-gated','Hyperliquid must stay protected/machine gated');
  ok(arb?.status==='FUNDING_GATED'&&arb?.capabilities?.funding==='machine-gated-usdc','Arbitrum funding must stay machine gated');
  ok(registry.networks.filter(x=>x.status==='ADAPTER_GATED').every(x=>x.capabilities?.execution===false),'unvalidated chain adapters must keep execution disabled');
}

if(fail.length){console.error(JSON.stringify({ok:false,contract:'rwa-multichain-v1',fail},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,contract:'rwa-multichain-v1',policy:'chain-abstraction-fail-closed-v1',networks:registry.networks.length,execution_rails:registry.networks.filter(x=>x.status==='EXECUTION_GATED').length,funding_rails:registry.networks.filter(x=>x.status==='FUNDING_GATED').length},null,2));
