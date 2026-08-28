import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const TARGET_URL=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const OUT=process.env.RWA_PROOF_DIR||'proof/multichain-tuntas-v3';
const EVM='0x1111111111111111111111111111111111111111';
const SOL='11111111111111111111111111111111';
const APPROVAL_HASH='0x'+'aa'.repeat(32);
const ROUTE_HASH='0x'+'bb'.repeat(32);
const chainIds=[1,42161,8453,56,137,43114,143];
const report={contract:'rwa-multichain-tuntas-browser-v3',url:TARGET_URL,ok:false,checks:{},errors:[]};
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1000},serviceWorkers:'block'});
let allowanceCalls=0;
const rpcMethods=[];
const directWrites=[];
const chain=id=>({id,name:`Chain ${id}`,key:String(id),chainType:'EVM',nativeToken:{symbol:id===56?'BNB':'ETH',decimals:18,priceUSD:'2000'},metamask:{chainId:'0x'+id.toString(16),rpcUrls:[`https://mock-rpc.local/${id}`],blockExplorerUrls:[],nativeCurrency:{name:'Native',symbol:id===56?'BNB':'ETH',decimals:18}}});
const usdc=id=>({address:id===1151111081099710?'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':id===8453?'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913':'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',chainId:id,symbol:'USDC',decimals:6,name:'USD Coin',coinKey:'USDC',priceUSD:'1'});
await context.addInitScript(({evm,sol,approvalHash,routeHash})=>{
  window.__mcEvents=[];
  let current='0x2105',approvalReceiptPolls=0;
  window.ethereum={request:async({method,params})=>{
    if(method==='eth_accounts'||method==='eth_requestAccounts')return[evm];
    if(method==='eth_chainId')return current;
    if(method==='wallet_switchEthereumChain'){current=String(params?.[0]?.chainId||current);window.__mcEvents.push(`switch:${current}`);return null}
    if(method==='wallet_addEthereumChain')return null;
    if(method==='eth_estimateGas'){window.__mcEvents.push('estimate');return'0x5208'}
    if(method==='eth_sendTransaction'){
      const tx=params?.[0]||{},approval=String(tx.data||'').startsWith('0x095ea7b3');
      window.__mcEvents.push(approval?'send:approval':'send:route');
      return approval?approvalHash:routeHash;
    }
    if(method==='eth_getTransactionReceipt'){
      const h=String(params?.[0]||'');
      if(h===approvalHash){approvalReceiptPolls++;const ok=approvalReceiptPolls>=2;window.__mcEvents.push(ok?'receipt:approval:confirmed':'receipt:approval:pending');return ok?{transactionHash:h,status:'0x1',blockNumber:'0x10'}:null}
      if(h===routeHash){window.__mcEvents.push('receipt:route:confirmed');return{transactionHash:h,status:'0x1',blockNumber:'0x11'}}
      return null;
    }
    throw Error(`unsupported EVM method ${method}`);
  }};
  const pk={toString:()=>sol};
  window.solana={publicKey:pk,connect:async()=>({publicKey:pk}),request:async({method})=>{if(method==='signAndSendTransaction')return{signature:'5'.repeat(88)};throw Error(`unsupported Solana method ${method}`)}};
},{evm:EVM,sol:SOL,approvalHash:APPROVAL_HASH,routeHash:ROUTE_HASH});
const page=await context.newPage();
page.on('request',r=>{try{const u=new globalThis.URL(r.url());if(/\/exchange(?:$|[/?#])/.test(u.pathname))directWrites.push(r.url())}catch{}});
page.on('pageerror',e=>report.errors.push(String(e?.message||e)));
await page.route('https://li.quest/v1/**',async route=>{
  const u=new globalThis.URL(route.request().url());
  if(u.pathname==='/v1/chains')return route.fulfill({json:{chains:[...chainIds.map(chain),{id:1151111081099710,name:'Solana',key:'sol',chainType:'SVM',nativeToken:{symbol:'SOL',decimals:9,priceUSD:'150'},rpcUrls:['https://mock-rpc.local/solana']}]}});
  if(u.pathname==='/v1/token')return route.fulfill({json:usdc(Number(u.searchParams.get('chain')))});
  if(u.pathname==='/v1/status')return route.fulfill({json:{status:'DONE',substatus:'COMPLETED',receiving:{txHash:'5'.repeat(88)}}});
  if(u.pathname==='/v1/quote'){
    const from=Number(u.searchParams.get('fromChain')),to=Number(u.searchParams.get('toChain')),fromAddress=u.searchParams.get('fromAddress'),toAddress=u.searchParams.get('toAddress'),amount=u.searchParams.get('fromAmount');
    const isSol=from===1151111081099710;
    const transactionRequest=isSol?{data:btoa(String.fromCharCode(...new Uint8Array(80))),chainId:from}:{to:'0x3333333333333333333333333333333333333333',data:'0xabcdef',value:'0x0',gasLimit:'0x5208',chainId:from};
    return route.fulfill({json:{id:`route-${from}-${to}`,type:'lifi',tool:'across',action:{fromChainId:from,toChainId:to,fromToken:usdc(from),toToken:usdc(to),fromAmount:amount,fromAddress,toAddress,slippage:.005},estimate:{fromAmount:amount,toAmount:'9990000',toAmountMin:'9950000',approvalAddress:isSol?null:'0x2222222222222222222222222222222222222222',executionDuration:12,feeCosts:[],gasCosts:[]},transactionRequest}});
  }
  return route.abort();
});
const rpcHandler=async route=>{
  let body={};try{body=JSON.parse(route.request().postData()||'{}')}catch{}
  const method=String(body.method||'');rpcMethods.push(method);
  let result='0x0';
  if(method==='eth_call'){
    allowanceCalls++;
    result=allowanceCalls<=4?'0x0':'0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  }else if(method==='eth_getBalance')result='0xde0b6b3a7640000';
  else if(method==='eth_getTransactionReceipt')result=null;
  else if(method==='getBalance')result={context:{slot:1},value:1000000000};
  else if(method==='getTokenAccountsByOwner')result={context:{slot:1},value:[]};
  else if(method==='simulateTransaction')result={context:{slot:1},value:{err:null,logs:['Program success'],unitsConsumed:12345}};
  return route.fulfill({json:{jsonrpc:'2.0',id:body.id||1,result}});
};
await page.route('https://mock-rpc.local/**',rpcHandler);
await page.route('https://api.mainnet-beta.solana.com/**',rpcHandler);
await page.route('**/launch/readiness.json',r=>r.fulfill({json:{status:'READY_FOR_MAINNET',mainnet_ready:true}}));
await page.route('**/launch/multichain-readiness.json',r=>r.fulfill({json:{status:'READY',ready:true}}));
await page.goto(TARGET_URL,{waitUntil:'domcontentloaded',timeout:45000});
await page.waitForSelector('#rwaMultiChainLaunch',{state:'visible',timeout:15000});
await page.locator('#rwaMultiChainLaunch').click();
await page.waitForFunction(()=>window.RWAMultiChainEngine?.revision==='3.0.0-tuntas',null,{timeout:12000});

try{
  const addressBinding=await page.evaluate(async()=>{
    const e=window.RWAMultiChainEngine;
    const a=await e.quote({fromNetwork:'base',toNetwork:'solana',fromToken:'USDC',toToken:'USDC',amount:'10'});
    const b=await e.quote({fromNetwork:'solana',toNetwork:'base',fromToken:'USDC',toToken:'USDC',amount:'10'});
    return{evmToSol:e.quoteSummary(a),solToEvm:e.quoteSummary(b)};
  });
  if(addressBinding.evmToSol.toAddress!==SOL)throw Error(`EVM→Solana destination mismatch: ${addressBinding.evmToSol.toAddress}`);
  if(addressBinding.solToEvm.toAddress.toLowerCase()!==EVM.toLowerCase())throw Error(`Solana→EVM destination mismatch: ${addressBinding.solToEvm.toAddress}`);
  report.checks.address_family_binding='PASS';

  const solPreflight=await page.evaluate(async()=>{
    const e=window.RWAMultiChainEngine,q=await e.quote({fromNetwork:'solana',toNetwork:'base',amount:'10'});return e.simulate(q);
  });
  if(!solPreflight.ok||solPreflight.preflight!=='simulateTransaction'||!rpcMethods.includes('simulateTransaction'))throw Error('Solana RPC simulateTransaction preflight not observed');
  report.checks.solana_rpc_preflight='PASS';

  allowanceCalls=0;
  const executed=await page.evaluate(async()=>{
    const e=window.RWAMultiChainEngine,q=await e.quote({fromNetwork:'base',toNetwork:'arbitrum',amount:'10'});return e.execute(q,{confirm:true});
  });
  if(executed.hash!==ROUTE_HASH)throw Error('route transaction hash mismatch');
  const events=await page.evaluate(()=>window.__mcEvents.slice());
  const sentApproval=events.indexOf('send:approval'),confirmedApproval=events.indexOf('receipt:approval:confirmed'),sentRoute=events.indexOf('send:route');
  if(sentApproval<0||confirmedApproval<0||sentRoute<0||!(sentApproval<confirmedApproval&&confirmedApproval<sentRoute))throw Error(`approval receipt barrier order invalid: ${events.join(' > ')}`);
  report.checks.approval_receipt_barrier='PASS';

  await page.waitForFunction(()=>window.RWAMultiChainEngine.lifecycleHistory().some(x=>x.sourceHash&&x.status==='DONE'),null,{timeout:10000});
  const lifecycle=await page.evaluate(()=>({rows:window.RWAMultiChainEngine.lifecycleHistory(),stored:JSON.parse(localStorage.getItem('rwa_multichain_lifecycle_v3')||'[]')}));
  if(!lifecycle.rows.length||!lifecycle.stored.length||!lifecycle.rows.some(x=>x.status==='DONE'))throw Error('persistent lifecycle did not reach DONE');
  report.checks.persistent_lifecycle_recovery='PASS';

  const wallets=await page.evaluate(async()=>{
    const e=window.RWAMultiChainEngine;return{evm:await e.walletContext('base'),sol:await e.walletContext('solana')};
  });
  if(wallets.evm.family!=='EVM'||wallets.evm.address.toLowerCase()!==EVM.toLowerCase()||wallets.sol.family!=='SVM'||wallets.sol.address!==SOL)throw Error('unified wallet abstraction mismatch');
  report.checks.wallet_abstraction='PASS';

  const funding=await page.evaluate(async()=>window.RWAMultiChainEngine.prepareHyperliquidFunding({fromNetwork:'base',amount:'10'}));
  if(funding.stagingNetwork!=='arbitrum'||funding.stagingToken!=='USDC'||funding.adapterVerified!==false||funding.next!=='HYPERLIQUID_DEPOSIT_PROVIDER_VALIDATION_REQUIRED')throw Error(`Hyperliquid funding fail-closed mismatch: ${JSON.stringify(funding)}`);
  if(!funding.routeSummary||funding.routeSummary.toNetwork!=='arbitrum')throw Error('Hyperliquid funding did not stage Base→Arbitrum USDC');
  if(directWrites.length)throw Error(`direct Hyperliquid /exchange request observed: ${directWrites.join(',')}`);
  report.checks.hyperliquid_funding_handoff='PASS';
  report.checks.no_second_exchange_write_path='PASS';

  const gate=await page.evaluate(()=>window.RWAMultiChainEngine.executionReadiness());
  if(!gate.ready||!gate.global||!gate.multichain)throw Error('dual mainnet gate did not require both readiness documents');
  report.checks.dual_mainnet_gate='PASS';

  await page.screenshot({path:path.join(OUT,'desktop-tuntas-v3.png'),fullPage:false});
  report.events=events;
  report.rpcMethods=[...new Set(rpcMethods)];
  report.lifecycle=lifecycle.rows.slice(0,3);
  report.ok=true;
}catch(e){report.errors.push(String(e?.stack||e));}
await writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
await browser.close();
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
