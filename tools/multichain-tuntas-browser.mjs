import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const TEST_URL=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const OUT=process.env.RWA_PROOF_DIR||'proof/multichain-v4-tuntas';
const EVM='0x1111111111111111111111111111111111111111';
const SOL='11111111111111111111111111111111';
const APPROVAL='0x'+'a'.repeat(64),ROUTE='0x'+'b'.repeat(64);
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1000},serviceWorkers:'block'});
const page=await context.newPage();
const directWrites=[],rpcMethods=[];
const report={contract:'rwa-multichain-tuntas-browser-v4.1-context-lifecycle',url:TEST_URL,ok:false,checks:{},errors:[]};

await page.addInitScript(({EVM,APPROVAL,ROUTE,SOL})=>{
  window.__mcEvents=[];window.__approvalConfirmed=false;
  const p={request:async({method,params})=>{
    if(method==='eth_accounts'||method==='eth_requestAccounts')return[EVM];
    if(method==='eth_chainId')return'0x2105';
    if(method==='wallet_switchEthereumChain'||method==='wallet_addEthereumChain')return null;
    if(method==='eth_estimateGas'){window.__mcEvents.push('estimate');return'0x5208'}
    if(method==='eth_sendTransaction'){
      const approval=String(params?.[0]?.data||'').startsWith('0x095ea7b3');
      if(approval){window.__mcEvents.push('send:approval');return APPROVAL}
      if(!window.__approvalConfirmed)throw Error('route sent before approval receipt confirmation');
      window.__mcEvents.push('send:route');return ROUTE;
    }
    return null;
  }};
  window.ethereum=p;window.RWAProvider=p;
  const sol={publicKey:{toString:()=>SOL},connect:async()=>({publicKey:{toString:()=>SOL}}),request:async()=>({publicKey:{toString:()=>SOL}})};
  window.phantom={solana:sol};
},{EVM,APPROVAL,ROUTE,SOL});

await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.pathname.endsWith('/launch/readiness.json'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'READY_FOR_MAINNET',mainnet_ready:true})});
  if(u.pathname.endsWith('/launch/multichain-readiness.json'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'READY',ready:true})});
  if(u.hostname==='li.quest'){
    if(u.pathname.endsWith('/chains'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({chains:[
      {id:8453,key:'bas',name:'Base',chainType:'EVM',metamask:{chainId:'0x2105',rpcUrls:['https://mock-rpc.local']},nativeToken:{symbol:'ETH',decimals:18,priceUSD:'3000'}},
      {id:42161,key:'arb',name:'Arbitrum',chainType:'EVM',metamask:{chainId:'0xa4b1',rpcUrls:['https://mock-rpc.local']},nativeToken:{symbol:'ETH',decimals:18,priceUSD:'3000'}},
      {id:1151111081099710,key:'sol',name:'Solana',chainType:'SVM',rpcUrls:['https://mock-sol-rpc.local'],nativeToken:{symbol:'SOL',decimals:9,priceUSD:'200'}}
    ]})});
    if(u.pathname.endsWith('/token')){
      const c=Number(u.searchParams.get('chain')),sym=String(u.searchParams.get('token')||'USDC').toUpperCase();
      const a=c===1151111081099710?'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':c===8453?'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913':'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({address:a,chainId:c,symbol:sym,decimals:6,name:'USD Coin',coinKey:sym,priceUSD:'1'})});
    }
    if(u.pathname.endsWith('/quote')){
      const f=Number(u.searchParams.get('fromChain')),t=Number(u.searchParams.get('toChain')),fa=u.searchParams.get('fromAddress'),ta=u.searchParams.get('toAddress'),amount=u.searchParams.get('fromAmount')||'10000000';
      const ft=f===8453?'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913':'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const tt=t===1151111081099710?'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:`q-${f}-${t}`,tool:'across',action:{fromChainId:f,toChainId:t,fromToken:{address:ft,chainId:f,symbol:'USDC',decimals:6,priceUSD:'1'},toToken:{address:tt,chainId:t,symbol:'USDC',decimals:6,priceUSD:'1'},fromAmount:amount,fromAddress:fa,toAddress:ta},estimate:{fromAmount:amount,toAmount:'9990000',toAmountMin:'9950000',approvalAddress:'0x2222222222222222222222222222222222222222',executionDuration:12,feeCosts:[],gasCosts:[]},transactionRequest:{to:'0x3333333333333333333333333333333333333333',data:'0xabcdef',value:'0x0',gasLimit:'0x5208',chainId:f}})});
    }
    if(u.pathname.endsWith('/status'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'DONE',substatus:'COMPLETED'})});
  }
  if(u.hostname==='mock-rpc.local'||u.hostname==='mock-sol-rpc.local'){
    let b={};try{b=req.postDataJSON()||{}}catch{}rpcMethods.push(b.method);
    if(b.method==='simulateTransaction')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:b.id,result:{value:{err:null,logs:['ok'],unitsConsumed:12345}}})});
    if(b.method==='eth_call')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:b.id,result:'0x0'})});
    if(b.method==='eth_getTransactionReceipt'){
      const h=b.params?.[0];
      if(h===APPROVAL)await page.evaluate(()=>{window.__approvalConfirmed=true;window.__mcEvents.push('receipt:approval:confirmed')});
      if(h===ROUTE)await page.evaluate(()=>window.__mcEvents.push('receipt:route:confirmed'));
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:b.id,result:{status:'0x1',transactionHash:h}})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:b.id,result:'0x0'})});
  }
  if(u.pathname==='/exchange')directWrites.push(req.url());
  return route.continue();
});

try{
  await page.goto(TEST_URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.RWASeablueprintCommerceBridge?.version==='1.6.0'||document.querySelector('#rwaMultiChainLaunch'),null,{timeout:15000});
  const commerceRequested=await page.evaluate(()=>location.hash==='#shop'||document.body.classList.contains('rwa-seablueprint-commerce-open')||!!document.querySelector('#rwaShopScreen.open'));
  if(commerceRequested){
    await page.waitForFunction(()=>window.RWASeablueprintCommerceBridge?.version==='1.6.0',null,{timeout:15000});
    await page.waitForSelector('#rwaShopScreen.open',{state:'visible',timeout:15000});
    await page.waitForSelector('#rwaMultiChainLaunch',{state:'attached',timeout:15000});
    await page.evaluate(()=>window.RWASeablueprintCommerceBridge.close({restore:false}));
    await page.waitForFunction(()=>location.hash!=='#shop'&&!document.body.classList.contains('rwa-seablueprint-commerce-open')&&!document.querySelector('#rwaShopScreen')?.classList.contains('open'),null,{timeout:8000});
    report.checks.ecommerce_peer_lifecycle='PASS';
  }
  await page.waitForSelector('#rwaMultiChainLaunch',{state:'visible',timeout:15000});
  await page.click('#rwaMultiChainLaunch');
  await page.waitForFunction(()=>window.RWAMultiChainEngine?.revision==='3.0.0-tuntas',null,{timeout:10000});
  const gate=await page.evaluate(()=>window.RWAMultiChainEngine.executionReadiness());
  if(!gate.ready||!gate.global||!gate.multichain)throw Error(`dual readiness mock failed: ${JSON.stringify(gate)}`);report.checks.dual_mainnet_gate='PASS';

  const bind=await page.evaluate(async({EVM,SOL})=>{const e=window.RWAMultiChainEngine,q=await e.quote({fromNetwork:'base',toNetwork:'solana',fromToken:'USDC',toToken:'USDC',amount:'1',fromAddress:EVM,toAddress:SOL});let bad=false;try{await e.quote({fromNetwork:'base',toNetwork:'solana',fromToken:'USDC',toToken:'USDC',amount:'1',fromAddress:EVM,toAddress:EVM})}catch{bad=true}return{to:q.action.toAddress,bad}},{EVM,SOL});
  if(bind.to!==SOL||!bind.bad)throw Error('address-family binding failed');report.checks.address_family_binding='PASS';

  const sol=await page.evaluate(async({SOL,EVM})=>{const e=window.RWAMultiChainEngine,q={action:{fromChainId:1151111081099710,toChainId:8453,fromAddress:SOL,toAddress:EVM},estimate:{toAmountMin:'1'},transactionRequest:{data:btoa(String.fromCharCode(1,...new Array(64).fill(0),1,2,3))},__rwa:{createdAt:Date.now(),fromNetwork:'solana',toNetwork:'base',fromToken:{decimals:6,symbol:'USDC'},toToken:{decimals:6,symbol:'USDC'}}};return e.simulate(q)},{SOL,EVM});
  if(!sol.ok||sol.preflight!=='simulateTransaction'||!rpcMethods.includes('simulateTransaction'))throw Error('Solana preflight failed');report.checks.solana_rpc_preflight='PASS';

  const exec=await page.evaluate(async({EVM})=>{const e=window.RWAMultiChainEngine,q=await e.quote({fromNetwork:'base',toNetwork:'arbitrum',fromToken:'USDC',toToken:'USDC',amount:'10',fromAddress:EVM,toAddress:EVM});return e.execute(q,{confirm:true})},{EVM});
  if(exec.hash!==ROUTE)throw Error('route hash mismatch');
  const events=await page.evaluate(()=>window.__mcEvents.slice()),a=events.indexOf('send:approval'),b=events.indexOf('receipt:approval:confirmed'),c=events.indexOf('send:route'),d=events.indexOf('receipt:route:confirmed');
  if(!(a>=0&&b>a&&c>b&&d>c))throw Error(`approval/route receipt order invalid: ${events.join(' > ')}`);report.checks.approval_receipt_barrier='PASS';

  await page.waitForFunction(()=>window.RWAMultiChainEngine.lifecycleHistory().some(x=>x.status==='DONE'),null,{timeout:10000});
  const lifecycle=await page.evaluate(()=>window.RWAMultiChainEngine.lifecycleHistory());if(!lifecycle.some(x=>x.status==='DONE'))throw Error('lifecycle recovery missing');report.checks.persistent_lifecycle_recovery='PASS';
  const wallets=await page.evaluate(async()=>({evm:await window.RWAMultiChainEngine.walletContext('base'),sol:await window.RWAMultiChainEngine.walletContext('solana')}));if(wallets.evm.family!=='EVM'||wallets.sol.family!=='SVM')throw Error('wallet abstraction failed');report.checks.wallet_abstraction='PASS';

  const funding=await page.evaluate(()=>window.RWAMultiChainEngine.prepareHyperliquidFunding({fromNetwork:'base',amount:'10'}));
  if(funding.stagingNetwork!=='arbitrum'||funding.stagingToken!=='USDC'||funding.adapterVerified!==true||funding.next!=='HYPERLIQUID_ADAPTER_READY'||funding.mode!=='OFFICIAL_BRIDGE2_VERIFIED_USER_SIGNATURE_REQUIRED')throw Error(`funding adapter mismatch: ${JSON.stringify(funding)}`);
  if(!funding.routeSummary||funding.routeSummary.toNetwork!=='arbitrum'||!/^https:\/\//.test(String(funding.officialDepositUrl||'')))throw Error('funding handoff incomplete');
  if(directWrites.length)throw Error(`direct /exchange observed: ${directWrites.join(',')}`);
  report.checks.hyperliquid_funding_handoff='PASS';report.checks.hyperliquid_official_adapter='PASS';report.checks.no_second_exchange_write_path='PASS';

  await page.screenshot({path:path.join(OUT,'desktop-tuntas-v4.png'),fullPage:false});report.events=events;report.rpcMethods=[...new Set(rpcMethods)];report.lifecycle=lifecycle.slice(0,3);report.ok=true;
}catch(e){report.errors.push(String(e?.stack||e))}
await writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report,null,2));if(!report.ok)process.exit(1);