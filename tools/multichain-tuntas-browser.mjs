import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const URL=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const OUT=process.env.RWA_PROOF_DIR||'proof/multichain-v3-tuntas';
const EVM='0x1111111111111111111111111111111111111111';
const SOL='11111111111111111111111111111111';
const APPROVAL_HASH='0x'+'a'.repeat(64);
const ROUTE_HASH='0x'+'b'.repeat(64);
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1000}});
const page=await context.newPage();
const directWrites=[];
const rpcMethods=[];
const report={contract:'rwa-multichain-tuntas-browser-v4',url:URL,ok:false,checks:{},errors:[]};

await page.addInitScript(({EVM,SOL,APPROVAL_HASH,ROUTE_HASH})=>{
  window.__mcEvents=[];
  window.__approvalConfirmed=false;
  window.__routeConfirmed=false;
  window.__approvalSent=false;
  window.__routeSent=false;
  const provider={
    request:async({method,params})=>{
      if(method==='eth_accounts'||method==='eth_requestAccounts')return[EVM];
      if(method==='eth_chainId')return'0x2105';
      if(method==='wallet_switchEthereumChain'||method==='wallet_addEthereumChain')return null;
      if(method==='eth_estimateGas'){window.__mcEvents.push('estimate');return'0x5208'}
      if(method==='eth_sendTransaction'){
        const tx=params?.[0]||{},isApproval=String(tx.data||'').startsWith('0x095ea7b3');
        if(isApproval){window.__approvalSent=true;window.__mcEvents.push('send:approval');return APPROVAL_HASH}
        if(!window.__approvalConfirmed)throw Error('route sent before approval receipt confirmation');
        window.__routeSent=true;window.__mcEvents.push('send:route');return ROUTE_HASH;
      }
      return null;
    }
  };
  window.ethereum=provider;
  window.RWAProvider=provider;
  const sol={publicKey:{toString:()=>SOL},connect:async()=>({publicKey:{toString:()=>SOL}}),request:async()=>({publicKey:{toString:()=>SOL}})};
  window.phantom={solana:sol};
}, {EVM,SOL,APPROVAL_HASH,ROUTE_HASH});

await page.route('**/*',async route=>{
  const req=route.request(),u=new globalThis.URL(req.url());
  if(u.hostname==='li.quest'){
    if(u.pathname.endsWith('/chains'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({chains:[
      {id:8453,key:'bas',name:'Base',chainType:'EVM',metamask:{chainId:'0x2105',rpcUrls:['https://mock-rpc.local']},nativeToken:{symbol:'ETH',decimals:18,priceUSD:'3000'}},
      {id:42161,key:'arb',name:'Arbitrum',chainType:'EVM',metamask:{chainId:'0xa4b1',rpcUrls:['https://mock-rpc.local']},nativeToken:{symbol:'ETH',decimals:18,priceUSD:'3000'}},
      {id:1151111081099710,key:'sol',name:'Solana',chainType:'SVM',rpcUrls:['https://mock-sol-rpc.local'],nativeToken:{symbol:'SOL',decimals:9,priceUSD:'200'}}
    ]})});
    if(u.pathname.endsWith('/token')){
      const chain=Number(u.searchParams.get('chain'));
      const symbol=String(u.searchParams.get('token')||'USDC').toUpperCase();
      const address=chain===1151111081099710?'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':chain===8453?'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913':'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({address,chainId:chain,symbol,decimals:6,name:'USD Coin',coinKey:symbol,priceUSD:'1'})});
    }
    if(u.pathname.endsWith('/quote')){
      const fromChain=Number(u.searchParams.get('fromChain')),toChain=Number(u.searchParams.get('toChain'));
      const fromAddress=u.searchParams.get('fromAddress'),toAddress=u.searchParams.get('toAddress');
      const fromAmount=u.searchParams.get('fromAmount')||'10000000';
      const fromToken=fromChain===8453?'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913':'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const toToken=toChain===1151111081099710?'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        id:`route-${fromChain}-${toChain}`,type:'lifi',tool:'across',
        action:{fromChainId:fromChain,toChainId:toChain,fromToken:{address:fromToken,chainId:fromChain,symbol:'USDC',decimals:6,name:'USD Coin',coinKey:'USDC',priceUSD:'1'},toToken:{address:toToken,chainId:toChain,symbol:'USDC',decimals:6,name:'USD Coin',coinKey:'USDC',priceUSD:'1'},fromAmount,fromAddress,toAddress,slippage:0.005},
        estimate:{fromAmount,toAmount:'9990000',toAmountMin:'9950000',approvalAddress:'0x2222222222222222222222222222222222222222',executionDuration:12,feeCosts:[],gasCosts:[]},
        transactionRequest:{to:'0x3333333333333333333333333333333333333333',data:'0xabcdef',value:'0x0',gasLimit:'0x5208',chainId:fromChain}
      })});
    }
    if(u.pathname.endsWith('/status'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'DONE',substatus:'COMPLETED'})});
  }
  if(u.hostname==='mock-rpc.local'||u.hostname==='mock-sol-rpc.local'){
    let body={};try{body=req.postDataJSON()||{}}catch{}
    rpcMethods.push(body.method);
    if(body.method==='simulateTransaction')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:body.id,result:{value:{err:null,logs:['ok'],unitsConsumed:12345}}})});
    if(body.method==='eth_call')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:body.id,result:'0x0'})});
    if(body.method==='eth_getTransactionReceipt'){
      const h=body.params?.[0];
      if(h===APPROVAL_HASH){
        if(!window.__approvalReceiptPolls)window.__approvalReceiptPolls=0;
        window.__approvalReceiptPolls++;
      }
      const result=h===APPROVAL_HASH?{status:'0x1',transactionHash:h}:h===ROUTE_HASH?{status:'0x1',transactionHash:h}:null;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:body.id,result})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:body.id,result:'0x0'})});
  }
  if(u.pathname.endsWith('/launch/readiness.json'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'READY_FOR_MAINNET',mainnet_ready:true})});
  if(u.pathname.endsWith('/launch/multichain-readiness.json'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'READY',ready:true})});
  if(u.pathname.includes('/exchange'))directWrites.push(req.url());
  return route.continue();
});

try{
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#rwaMultiChainLaunch',{timeout:10000});
  await page.click('#rwaMultiChainLaunch');
  await page.waitForFunction(()=>window.RWAMultiChainEngine?.revision==='3.0.0-tuntas',null,{timeout:10000});

  const addressBinding=await page.evaluate(async({EVM,SOL})=>{
    const e=window.RWAMultiChainEngine;
    const evmToSol=await e.quote({fromNetwork:'base',toNetwork:'solana',fromToken:'USDC',toToken:'USDC',amount:'1',fromAddress:EVM,toAddress:SOL});
    let bad=false;try{await e.quote({fromNetwork:'base',toNetwork:'solana',fromToken:'USDC',toToken:'USDC',amount:'1',fromAddress:EVM,toAddress:EVM})}catch{bad=true}
    return{to:evmToSol.action.toAddress,bad};
  },{EVM,SOL});
  if(addressBinding.to!==SOL||!addressBinding.bad)throw Error('EVM/Solana address family binding failed');
  report.checks.address_family_binding='PASS';

  const solPreflight=await page.evaluate(async({SOL})=>{
    const e=window.RWAMultiChainEngine,q={action:{fromChainId:1151111081099710,toChainId:8453,fromAddress:SOL,toAddress:'0x1111111111111111111111111111111111111111'},estimate:{toAmountMin:'1'},transactionRequest:{data:btoa(String.fromCharCode(1,...new Array(64).fill(0),1,2,3))},__rwa:{createdAt:Date.now(),fromNetwork:'solana',toNetwork:'base',fromToken:{decimals:6,symbol:'USDC'},toToken:{decimals:6,symbol:'USDC'}}};return e.simulate(q);
  },{SOL});
  if(!solPreflight.ok||solPreflight.preflight!=='simulateTransaction'||!rpcMethods.includes('simulateTransaction'))throw Error(`real Solana preflight failed: ${JSON.stringify(solPreflight)}`);
  report.checks.solana_rpc_preflight='PASS';

  const executed=await page.evaluate(async({EVM})=>{
    const e=window.RWAMultiChainEngine,q=await e.quote({fromNetwork:'base',toNetwork:'arbitrum',fromToken:'USDC',toToken:'USDC',amount:'10',fromAddress:EVM,toAddress:EVM});
    const oldWait=e.waitEvmReceipt;
    e.waitEvmReceipt=async(hash,n)=>{
      window.__mcEvents.push(`receipt:${hash===('0x'+'a'.repeat(64))?'approval':'route'}:pending`);
      await new Promise(r=>setTimeout(r,30));
      if(hash===('0x'+'a'.repeat(64))){window.__approvalConfirmed=true;window.__mcEvents.push('receipt:approval:confirmed')}
      else {window.__routeConfirmed=true;window.__mcEvents.push('receipt:route:confirmed')}
      return{status:'0x1',transactionHash:hash};
    };
    try{return await e.execute(q,{confirm:true})}finally{e.waitEvmReceipt=oldWait}
  },{EVM});
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
  if(funding.stagingNetwork!=='arbitrum'||funding.stagingToken!=='USDC'||funding.adapterVerified!==true||funding.next!=='HYPERLIQUID_ADAPTER_READY')throw Error(`Hyperliquid official-adapter readiness mismatch: ${JSON.stringify(funding)}`);
  if(funding.mode!=='OFFICIAL_BRIDGE2_VERIFIED_USER_SIGNATURE_REQUIRED')throw Error(`Hyperliquid funding mode mismatch: ${funding.mode}`);
  if(!funding.routeSummary||funding.routeSummary.toNetwork!=='arbitrum')throw Error('Hyperliquid funding did not stage Base→Arbitrum USDC');
  if(!/^https:\/\//.test(String(funding.officialDepositUrl||'')))throw Error('Hyperliquid official deposit URL missing');
  if(directWrites.length)throw Error(`direct Hyperliquid /exchange request observed: ${directWrites.join(',')}`);
  report.checks.hyperliquid_funding_handoff='PASS';
  report.checks.hyperliquid_official_adapter='PASS';
  report.checks.no_second_exchange_write_path='PASS';

  const gate=await page.evaluate(()=>window.RWAMultiChainEngine.executionReadiness());
  if(!gate.ready||!gate.global||!gate.multichain)throw Error('dual mainnet gate did not require both readiness documents');
  report.checks.dual_mainnet_gate='PASS';

  await page.screenshot({path:path.join(OUT,'desktop-tuntas-v4.png'),fullPage:false});
  report.events=events;
  report.rpcMethods=[...new Set(rpcMethods)];
  report.lifecycle=lifecycle.rows.slice(0,3);
  report.ok=true;
}catch(e){report.errors.push(String(e?.stack||e));}
await writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
await browser.close();
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
