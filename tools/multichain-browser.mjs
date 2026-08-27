import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const URL=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const OUT=process.env.RWA_PROOF_DIR||'proof/multichain-v2';
const EVM='0x1111111111111111111111111111111111111111';
const SOL='7YWHMfk9JZe0LMV4kMYV3hJXmbE54VdWckx3Qw7oM3en';
const chainIds=[1,42161,8453,56,137,43114,143];
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={contract:'rwa-multichain-browser-v2',url:URL,ok:true,viewports:[],errors:[]};

function chain(id){
  const symbol=id===56?'BNB':id===137?'POL':id===43114?'AVAX':id===143?'MON':'ETH';
  return {id,name:`Chain ${id}`,chainType:'EVM',nativeToken:{symbol,decimals:18,priceUSD:'2500'},metamask:{chainId:'0x'+id.toString(16),rpcUrls:[`https://mock-rpc.local/${id}`],blockExplorerUrls:[],nativeCurrency:{name:'Native',symbol,decimals:18}}};
}
function usdc(chainId){
  return {address:chainId===1151111081099710?'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':chainId===8453?'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913':'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',chainId,symbol:'USDC',decimals:6,name:'USD Coin',coinKey:'USDC',priceUSD:'1'};
}

async function runViewport(width,height,label){
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(({evm,sol})=>{
    window.__rwaTestSent=[];
    let chain='0x2105';
    window.ethereum={request:async({method,params})=>{
      if(method==='eth_accounts'||method==='eth_requestAccounts')return[evm];
      if(method==='eth_chainId')return chain;
      if(method==='wallet_switchEthereumChain'){chain=String(params?.[0]?.chainId||chain);return null}
      if(method==='wallet_addEthereumChain')return null;
      if(method==='eth_estimateGas')return'0x5208';
      if(method==='eth_sendTransaction'){window.__rwaTestSent.push(params?.[0]);return'0x'+'ab'.repeat(32)}
      throw Error(`mock ethereum unsupported ${method}`);
    }};
    const pk={toString:()=>sol};
    window.solana={publicKey:pk,connect:async()=>({publicKey:pk}),request:async({method})=>{
      if(method==='signAndSendTransaction'){window.__rwaTestSent.push({solana:true});return{signature:'5'.repeat(88)}}
      throw Error(`mock solana unsupported ${method}`);
    }};
  },{evm:EVM,sol:SOL});

  const page=await context.newPage();
  const pageErrors=[];
  const directWrites=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
  page.on('request',r=>{try{const u=new globalThis.URL(r.url());if(/\/exchange(?:$|[/?#])/.test(u.pathname))directWrites.push({method:r.method(),url:r.url()})}catch{}});

  await page.route('https://li.quest/v1/**',async route=>{
    const u=new globalThis.URL(route.request().url());
    if(u.pathname==='/v1/chains'){
      return route.fulfill({json:{chains:[...chainIds.map(chain),{id:1151111081099710,name:'Solana',key:'sol',chainType:'SVM',nativeToken:{symbol:'SOL',decimals:9,priceUSD:'150'},rpcUrls:['https://mock-rpc.local/solana']}]}});
    }
    if(u.pathname==='/v1/token'){
      const id=Number(u.searchParams.get('chain'));
      return route.fulfill({json:usdc(id)});
    }
    if(u.pathname==='/v1/quote'){
      const from=Number(u.searchParams.get('fromChain'));
      const to=Number(u.searchParams.get('toChain'));
      const fromAddress=u.searchParams.get('fromAddress');
      const toAddress=u.searchParams.get('toAddress');
      const amount=u.searchParams.get('fromAmount');
      return route.fulfill({json:{
        id:'test-route',type:'lifi',tool:'across',
        action:{fromChainId:from,toChainId:to,fromToken:usdc(from),toToken:usdc(to),fromAmount:amount,fromAddress,toAddress,slippage:.005},
        estimate:{fromAmount:amount,toAmount:'9990000',toAmountMin:'9950000',approvalAddress:'0x2222222222222222222222222222222222222222',executionDuration:42,feeCosts:[{amountUSD:'0.03'}],gasCosts:[{amountUSD:'0.12'}]},
        transactionRequest:{to:'0x3333333333333333333333333333333333333333',data:'0xabcdef',value:'0x0',gasLimit:'0x5208',chainId:from}
      }});
    }
    return route.abort();
  });
  await page.route('https://mock-rpc.local/**',async route=>{
    let method='';try{method=JSON.parse(route.request().postData()||'{}').method}catch{}
    let result='0x0';
    if(method==='eth_call')result='0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    if(method==='eth_getBalance')result='0xde0b6b3a7640000';
    if(method==='getBalance')result={context:{slot:1},value:1000000000};
    if(method==='getTokenAccountsByOwner')result={context:{slot:1},value:[]};
    return route.fulfill({json:{jsonrpc:'2.0',id:1,result}});
  });
  await page.route('**/launch/readiness.json',r=>r.fulfill({json:{status:'BLOCKED',mainnet_ready:false}}));

  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('#rwaMultiChainLaunch',{state:'visible',timeout:15000});
  const before=await page.evaluate(()=>({runtime:window.RWAMultiChain?.version||null,staticScripts:document.querySelectorAll('body > script[src]').length}));
  if(before.runtime)throw Error(`${label}: runtime must be lazy before first click`);
  if(before.staticScripts!==6)throw Error(`${label}: first-paint external script budget changed: ${before.staticScripts}`);

  const baseHash=await page.evaluate(()=>location.hash);
  const chartToken='mc-'+Date.now()+'-'+label;
  await page.evaluate(token=>{const c=document.querySelector('.chart-wrap');if(c)c.dataset.multichainProof=token},chartToken);
  await page.locator('#rwaMultiChainLaunch').click();
  await page.waitForFunction(()=>window.RWAMultiChain?.version==='2.0.0'&&window.RWAMultiChainEngine?.version==='2.0.0',{timeout:20000});
  await page.waitForSelector('#rwaMultiChainPanel',{state:'visible'});

  const status=await page.evaluate(()=>window.RWAMultiChain.status());
  if(status.policy!=='chain-abstraction-fail-closed-v2')throw Error(`${label}: policy mismatch`);
  if(status.networks.length!==9)throw Error(`${label}: expected 9 networks, got ${status.networks.length}`);
  const cards=await page.locator('[data-rwa-chain]').count();
  if(cards!==9)throw Error(`${label}: expected 9 visible network cards, got ${cards}`);
  const chartSurvived=await page.evaluate(token=>document.querySelector('.chart-wrap')?.dataset.multichainProof===token,chartToken);
  if(!chartSurvived)throw Error(`${label}: chart remounted`);
  const panelBox=await page.locator('#rwaMultiChainPanel').boundingBox();
  if(!panelBox)throw Error(`${label}: missing panel geometry`);
  if(width>900&&Math.abs(panelBox.width-440)>2)throw Error(`${label}: desktop panel ${panelBox.width}`);
  if(width<=680&&Math.abs(panelBox.width-width)>2)throw Error(`${label}: mobile panel ${panelBox.width}`);

  await page.locator('[data-rwa-chain="base"]').click();
  if((await page.locator('.rwa-mc-badge').innerText()).trim()!=='ROUTE READY')throw Error(`${label}: Base not route-ready`);
  await page.locator('[data-rwa-mc-destination]').selectOption('solana');
  await page.locator('[data-rwa-mc-amount]').fill('10');
  await page.locator('[data-rwa-mc-preview]').click();
  await page.waitForFunction(()=>window.RWAMultiChain.status().quote?.tool==='across',{timeout:15000});
  const quoteText=(await page.locator('[data-rwa-mc-quote-output]').innerText()).replace(/\n/g,' ');
  if(!/9\.95 USDC minimum/i.test(quoteText))throw Error(`${label}: route minimum output missing: ${quoteText}`);
  if(!/simulation\s*PASS/i.test(quoteText))throw Error(`${label}: simulation PASS missing: ${quoteText}`);
  const exec=page.locator('[data-rwa-mc-execute]');
  if(!(await exec.isDisabled()))throw Error(`${label}: mainnet execute must remain locked`);
  if(!/MAINNET LOCKED/i.test(await exec.innerText()))throw Error(`${label}: launch lock label missing`);
  const sent=await page.evaluate(()=>window.__rwaTestSent.length);
  if(sent!==0)throw Error(`${label}: preview sent transaction`);

  await page.locator('[data-rwa-chain="solana"]').click();
  if((await page.locator('.rwa-mc-badge').innerText()).trim()!=='ROUTE READY')throw Error(`${label}: Solana not route-ready`);
  if((await page.evaluate(()=>location.hash))!==baseHash)throw Error(`${label}: network selection changed route unexpectedly`);
  if(directWrites.length)throw Error(`${label}: direct /exchange write observed`);

  await page.screenshot({path:path.join(OUT,`${label}-multichain-v2.png`),fullPage:true});
  await page.locator('.rwa-mc-close').click();
  await page.waitForFunction(()=>document.getElementById('rwaMultiChainPanel')?.hidden===true);
  const closedChart=await page.evaluate(token=>document.querySelector('.chart-wrap')?.dataset.multichainProof===token,chartToken);
  if(!closedChart)throw Error(`${label}: chart changed after close`);
  report.viewports.push({label,width,height,cards,panelWidth:panelBox.width,policy:status.policy,engine:status.engine,quote:'Base→Solana USDC',mainnetLocked:true,firstPaintStaticScripts:before.staticScripts,pageErrors,directWrites,chartSurvived:true});
  if(pageErrors.length)report.errors.push(...pageErrors.map(x=>`${label}: ${x}`));
  await context.close();
}

try{
  await runViewport(1600,1000,'desktop-1600x1000');
  await runViewport(390,844,'mobile-390x844');
  if(report.errors.length)throw Error(`browser page errors: ${report.errors.join(' | ')}`);
}catch(e){report.ok=false;report.failure=String(e?.stack||e)}
await writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
await browser.close();
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
