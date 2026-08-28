import {readFile,mkdir,writeFile} from 'node:fs/promises';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const post=async(url,body)=>{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const x=await r.json().catch(()=>null);if(!r.ok)throw Error(`${url} HTTP ${r.status}`);return x};
const funding=await read('rwa-multichain-funding.json');
const revenue=await read('rwa-multichain-revenue.json');
const e2e=await read('launch/e2e-registry.json').catch(()=>({wallets:[]}));
const hf=funding?.hyperliquid||{};
const rpc='https://arb1.arbitrum.io/rpc';
const rpcCall=async(method,params=[])=>{
  const x=await post(rpc,{jsonrpc:'2.0',id:Date.now(),method,params});
  if(x?.error)throw Error(x.error.message||'RPC error');
  return x?.result;
};
const [bridgeCode,usdcCode]=await Promise.all([
  rpcCall('eth_getCode',[hf.bridge_address,'latest']),
  rpcCall('eth_getCode',[hf.arbitrum_usdc_address,'latest'])
]);
const fundingLive=typeof bridgeCode==='string'&&bridgeCode.length>4&&typeof usdcCode==='string'&&usdcCode.length>4;

const integrator=String(revenue?.integrator||'').trim();
let lifi={ok:false,status:0,integratorId:null,feeBalances:0,error:null};
if(integrator){
  try{
    const r=await fetch(`https://li.quest/v1/integrators/${encodeURIComponent(integrator)}`,{headers:{accept:'application/json'}});
    const x=await r.json().catch(()=>null);
    lifi={ok:r.ok&&String(x?.integratorId||'')===integrator,status:r.status,integratorId:x?.integratorId||null,feeBalances:Array.isArray(x?.feeBalances)?x.feeBalances.length:0,error:r.ok?null:(x?.message||x?.error||`HTTP ${r.status}`)};
  }catch(e){lifi.error=String(e?.message||e)}
}

const candidate=String(revenue?.hyperliquid?.builder_address||e2e?.wallets?.find(x=>x?.status==='E2E_VERIFIED')?.wallet||'');
let builder={candidate,accountValue:null,meetsMinimum:false,error:null};
if(/^0x[a-fA-F0-9]{40}$/.test(candidate)){
  try{
    const x=await post('https://api.hyperliquid.xyz/info',{type:'clearinghouseState',user:candidate});
    const v=Number(x?.marginSummary?.accountValue||0);
    builder.accountValue=Number.isFinite(v)?v:null;
    builder.meetsMinimum=Number.isFinite(v)&&v>=Number(revenue?.hyperliquid?.builder_min_account_value_usdc||100);
  }catch(e){builder.error=String(e?.message||e)}
}

const report={
  schema:1,
  generated_at:new Date().toISOString(),
  funding:{
    adapter:hf.adapter||null,
    bridge_address:hf.bridge_address||null,
    bridge_code_present:typeof bridgeCode==='string'&&bridgeCode.length>4,
    usdc_address:hf.arbitrum_usdc_address||null,
    usdc_code_present:typeof usdcCode==='string'&&usdcCode.length>4,
    live:fundingLive
  },
  lifi,
  hyperliquid_builder:builder
};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--write')){
  await mkdir('proof',{recursive:true});
  await writeFile('proof/multichain-provider-probe.json',JSON.stringify(report,null,2)+'\n');
}
if(!fundingLive)process.exit(2);
