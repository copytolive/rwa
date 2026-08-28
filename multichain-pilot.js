(()=>{
'use strict';
const ENGINE=()=>window.RWAMultiChainEngine;
const $=id=>document.getElementById(id);
const state={cfg:null,receipts:[],totalUsd:0,busy:false};
const RECEIPTS_KEY='rwa_multichain_real_receipts_v1';
const HLI='https://api.hyperliquid.xyz/info';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evmAddress=x=>/^0x[a-fA-F0-9]{40}$/.test(String(x||''));
const evmHash=x=>/^0x[a-fA-F0-9]{64}$/.test(String(x||''));
const solSig=x=>/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(String(x||''));
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const log=(msg,obj)=>{const host=$('log');const line=document.createElement('pre');line.textContent=`${new Date().toISOString()} ${msg}${obj?`\n${JSON.stringify(obj,null,2)}`:''}`;host.prepend(line)};
const setStatus=(s,t)=>{$('status').textContent=s;$('status').dataset.state=t||'neutral'};
function loadReceipts(){try{state.receipts=JSON.parse(localStorage.getItem(RECEIPTS_KEY)||'[]')}catch{state.receipts=[]}renderReceipts()}
function saveReceipts(){localStorage.setItem(RECEIPTS_KEY,JSON.stringify(state.receipts));renderReceipts()}
function renderReceipts(){const h=$('receipts');h.innerHTML=state.receipts.length?state.receipts.map(r=>`<article><b>${esc(r.kind)}</b><span>${esc(r.status)}</span><code>${esc(r.tx_hash||'')}</code><small>${esc(r.provider_status||'')}</small></article>`).join(''):'<p>No real receipts captured yet.</p>'}
async function getCfg(){if(state.cfg)return state.cfg;const r=await fetch('launch/multichain-pilot.json',{cache:'no-store'});state.cfg=await r.json();if(!state.cfg?.enabled||state.cfg?.unrestricted_mainnet!==false)throw Error('Pilot policy unavailable');return state.cfg}
async function waitEngine(){for(let i=0;i<120;i++){if(ENGINE()?.revision==='3.0.0-tuntas')return ENGINE();await sleep(50)}throw Error('MULTI CHAIN engine unavailable')}
async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const x=await r.json().catch(()=>null);if(!r.ok)throw Error(x?.message||x?.error||`HTTP ${r.status}`);return x}
async function providerStatus(hash,q){
  const e=ENGINE();let last=null;
  for(let i=0;i<120;i++){
    try{
      last=await e.status({hash,fromChain:q.action.fromChainId,toChain:q.action.toChainId,tool:q.tool});
      const s=String(last?.status||'').toUpperCase();
      if(['DONE','FAILED','INVALID'].includes(s)||String(last?.substatus||'').toUpperCase().includes('REFUND'))return last
    }catch{}
    await sleep(5000)
  }
  return last||{status:'PENDING'}
}
async function ensureCap(kind,amount){
  const cfg=await getCfg(),r=cfg.routes[kind];if(!r)throw Error('Route not permitted by pilot policy');
  const n=Number(amount);if(!(n>0)||n>Number(r.max_amount))throw Error(`Pilot amount must be >0 and <= ${r.max_amount}`);
  if(state.totalUsd+n>Number(cfg.max_total_usd_per_session))throw Error('Pilot session cap exceeded');
  return r
}
async function connectAddresses(route){
  const e=ENGINE();
  const from=await e.connect(route.from);
  let to=from;
  if(route.to==='solana')to=await e.connect('solana');
  else if(route.from==='solana')to=await e.connect(route.to);
  if(!from||!to)throw Error('Required wallet(s) not connected');
  return{from,to}
}
async function sendEvmQuote(q){
  const e=ENGINE(),n=q.__rwa.fromNetwork;
  let sim=await e.simulate(q);
  if(!sim.ok)throw Error(`Preflight failed: ${sim.reason}`);
  if(sim.allowance?.required&&!sim.allowance?.sufficient){
    log('ERC20 approval required');
    await e.approve(q,{wait:true});
    sim=await e.simulate(q);
    if(!sim.ok||sim.reason==='approval-required-before-final-simulation')throw Error('Post-approval simulation failed');
  }
  await e.connect(n);
  const p=window.RWAProvider||window.ethereum;if(!p?.request)throw Error('EVM wallet unavailable');
  const tx=q.transactionRequest,from=q.action.fromAddress;
  const params={from,to:tx.to,data:tx.data,value:tx.value||'0x0'};
  if(tx.gasLimit)params.gas=tx.gasLimit;if(tx.gasPrice)params.gasPrice=tx.gasPrice;
  const hash=await p.request({method:'eth_sendTransaction',params:[params]});
  await e.waitEvmReceipt(hash,n);
  return String(hash)
}
async function sendSolanaQuote(q){
  const e=ENGINE(),sim=await e.simulate(q);if(!sim.ok)throw Error(`Solana preflight failed: ${sim.reason}`);
  const p=window.phantom?.solana||window.solflare||window.backpack?.solana||window.solana;
  if(!p)throw Error('Solana wallet unavailable');
  const data=q.transactionRequest?.data;if(!data)throw Error('No serialized Solana transaction');
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  const mod=await import('https://esm.sh/@solana/web3.js@1.98.4');
  let tx;try{tx=mod.VersionedTransaction.deserialize(bytes)}catch{tx=mod.Transaction.from(bytes)}
  let res;
  if(typeof p.signAndSendTransaction==='function')res=await p.signAndSendTransaction(tx,{skipPreflight:false,preflightCommitment:'confirmed'});
  else throw Error('Wallet does not expose signAndSendTransaction');
  const sig=res?.signature||res?.hash||res;if(!solSig(sig))throw Error('Invalid Solana signature returned');
  return String(sig)
}
async function runRoute(kind){
  if(state.busy)return;state.busy=true;setStatus(`Pilot ${kind} running…`,'busy');
  try{
    const amount=Number($(`amt-${kind}`).value),route=await ensureCap(kind,amount),e=await waitEngine(),addr=await connectAddresses(route);
    const q=await e.quote({fromNetwork:route.from,toNetwork:route.to,fromToken:route.from_token,toToken:route.to_token,amount,fromAddress:addr.from,toAddress:addr.to});
    log('Quote accepted',e.quoteSummary(q));
    if(!confirm(`REAL MONEY PILOT\n${kind}\n${amount} ${route.from_token}\n${route.from} → ${route.to}\n\nContinue to wallet signature?`))throw Error('User cancelled');
    const hash=route.from==='solana'?await sendSolanaQuote(q):await sendEvmQuote(q);
    log('Source transaction confirmed',{hash});
    const ps=await providerStatus(hash,q),provider=String(ps?.status||ps?.substatus||'PENDING').toUpperCase();
    const receipt={id:kind.toLowerCase().replaceAll('_','-'),kind,status:provider==='DONE'?'VERIFIED':'PENDING_PROVIDER_FINALITY',source_network:route.from,destination_network:route.to,source_family:route.from==='solana'?'SVM':'EVM',destination_family:route.to==='solana'?'SVM':'EVM',token:route.from_token,amount,tx_hash:hash,provider_status:provider,evidence_url:'',provider_payload:ps,captured_at:new Date().toISOString()};
    state.receipts=state.receipts.filter(x=>x.kind!==kind);state.receipts.push(receipt);state.totalUsd+=amount;saveReceipts();
    setStatus(`${kind}: ${receipt.status}`,'ok');log('Receipt captured',receipt)
  }catch(err){setStatus(String(err?.message||err),'error');log('Pilot failed',{error:String(err?.message||err)})}
  finally{state.busy=false}
}
function transferData(to,amount6){return'0xa9059cbb'+String(to).replace(/^0x/,'').padStart(64,'0')+BigInt(amount6).toString(16).padStart(64,'0')}
async function hyperState(user){return post(HLI,{type:'clearinghouseState',user})}
async function fundHyperliquid(){
  if(state.busy)return;state.busy=true;setStatus('Hyperliquid funding pilot running…','busy');
  try{
    const cfg=await getCfg(),r=cfg.routes.HYPERLIQUID_FUNDING,amount=Number($('amt-HYPERLIQUID_FUNDING').value);
    if(!(amount>=Number(r.min_amount)&&amount<=Number(r.max_amount)))throw Error(`Hyperliquid pilot must be ${r.min_amount}-${r.max_amount} USDC`);
    if(state.totalUsd+amount>Number(cfg.max_total_usd_per_session))throw Error('Pilot session cap exceeded');
    const e=await waitEngine();await e.connect('arbitrum');
    const funding=await e.loadFunding(),f=funding.hyperliquid;
    if(!f?.adapter_verified||String(f.adapter)!=='HYPERLIQUID_BRIDGE2_ARBITRUM_USDC')throw Error('Official Bridge2 adapter is not verified');
    const p=window.RWAProvider||window.ethereum,accounts=await p.request({method:'eth_requestAccounts'}),user=accounts[0];
    if(!evmAddress(user))throw Error('EVM wallet unavailable');
    const before=await hyperState(user).catch(()=>null),beforeValue=Number(before?.marginSummary?.accountValue||0);
    const amount6=BigInt(Math.round(amount*1_000_000)),tx={from:user,to:f.arbitrum_usdc_address,data:transferData(f.bridge_address,amount6),value:'0x0'};
    await p.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xa4b1'}]});
    const gas=await p.request({method:'eth_estimateGas',params:[tx]});tx.gas=gas;
    if(!confirm(`REAL HYPERLIQUID FUNDING\n${amount} USDC on Arbitrum\nOfficial Bridge2: ${f.bridge_address}\n\nThis transfers real USDC. Continue?`))throw Error('User cancelled');
    const hash=await p.request({method:'eth_sendTransaction',params:[tx]});await e.waitEvmReceipt(hash,'arbitrum');
    let after=null,credited=false;
    for(let i=0;i<36;i++){await sleep(5000);after=await hyperState(user).catch(()=>null);const v=Number(after?.marginSummary?.accountValue||0);if(v>beforeValue){credited=true;break}}
    const receipt={id:'hyperliquid-funding',kind:'HYPERLIQUID_FUNDING',status:credited?'VERIFIED':'SOURCE_CONFIRMED_AWAITING_CREDIT',source_network:'arbitrum',destination_network:'hyperliquid',source_family:'EVM',destination_family:'HYPERLIQUID',token:'USDC',amount,tx_hash:String(hash),provider_status:credited?'CREDITED':'PENDING_CREDIT',evidence_url:'',before_account_value:beforeValue,after_account_value:Number(after?.marginSummary?.accountValue||0),captured_at:new Date().toISOString()};
    state.receipts=state.receipts.filter(x=>x.kind!=='HYPERLIQUID_FUNDING');state.receipts.push(receipt);state.totalUsd+=amount;saveReceipts();setStatus(`Hyperliquid funding: ${receipt.status}`,credited?'ok':'busy');log('Hyperliquid funding receipt',receipt)
  }catch(err){setStatus(String(err?.message||err),'error');log('Funding pilot failed',{error:String(err?.message||err)})}
  finally{state.busy=false}
}
async function captureFailure(){
  try{
    const hash=$('failure-hash').value.trim(),family=$('failure-family').value,amount=Number($('failure-amount').value);
    if(!(evmHash(hash)||solSig(hash)))throw Error('Enter a real transaction hash/signature');
    if(!(amount>0&&amount<=2))throw Error('Failure/refund evidence amount must be >0 and <=2');
    const fromChain=$('failure-from-chain').value.trim(),toChain=$('failure-to-chain').value.trim(),bridge=$('failure-bridge').value.trim();
    const params=new URLSearchParams({txHash:hash});if(fromChain)params.set('fromChain',fromChain);if(toChain)params.set('toChain',toChain);if(bridge)params.set('bridge',bridge);
    const r=await fetch(`https://li.quest/v1/status?${params}`,{cache:'no-store'}),x=await r.json();
    const s=String(x?.status||x?.substatus||'').toUpperCase();
    if(!(s.includes('FAIL')||s.includes('REFUND')||s==='INVALID'))throw Error(`Provider status is ${s||'unknown'}, not failed/refunded`);
    const receipt={id:'failure-or-refund',kind:'FAILURE_OR_REFUND',status:'VERIFIED',source_network:'',destination_network:'',source_family:family,destination_family:'',token:'USDC',amount,tx_hash:hash,provider_status:s.includes('REFUND')?'REFUNDED':'FAILED',evidence_url:'',provider_payload:x,captured_at:new Date().toISOString()};
    state.receipts=state.receipts.filter(x=>x.kind!=='FAILURE_OR_REFUND');state.receipts.push(receipt);saveReceipts();setStatus('Failure/refund receipt verified','ok');log('Failure/refund captured',receipt)
  }catch(err){setStatus(String(err?.message||err),'error')}
}
function exportEvidence(){
  const payload={schema:1,version:'1.0.0',status:'PILOT_CAPTURED',evidence_policy:'real-provider-receipt-v1',required:['EVM_TO_EVM','EVM_TO_SOLANA','SOLANA_TO_EVM','SAME_CHAIN','FAILURE_OR_REFUND'],receipts:state.receipts.filter(r=>r.kind!=='HYPERLIQUID_FUNDING').map(({provider_payload,...r})=>r),hyperliquid_funding:state.receipts.find(r=>r.kind==='HYPERLIQUID_FUNDING')||null,exported_at:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='multichain-real-receipts.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)
}
async function init(){
  await getCfg();await waitEngine();loadReceipts();
  for(const k of ['EVM_TO_EVM','EVM_TO_SOLANA','SOLANA_TO_EVM','SAME_CHAIN'])$(`run-${k}`).onclick=()=>runRoute(k);
  $('run-HYPERLIQUID_FUNDING').onclick=fundHyperliquid;$('capture-failure').onclick=captureFailure;$('export').onclick=exportEvidence;
  setStatus('PILOT READY — unrestricted mainnet remains locked','ok')
}
init().catch(e=>setStatus(e.message||String(e),'error'));
})();
