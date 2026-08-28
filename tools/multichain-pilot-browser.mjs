import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const url=new URL('multichain-pilot.html',base).href;
const proof=process.env.RWA_PROOF_DIR||'proof/multichain-v5-pilot';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
for(const vp of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  const ctx=await browser.newContext({viewport:{width:vp.width,height:vp.height}});
  const page=await ctx.newPage();
  await page.addInitScript(()=>{
    window.confirm=()=>false;
    window.ethereum={request:async({method})=>{
      if(method==='eth_accounts'||method==='eth_requestAccounts')return['0x1111111111111111111111111111111111111111'];
      if(method==='eth_chainId')return'0x2105';
      if(method==='wallet_switchEthereumChain')return null;
      if(method==='eth_sendTransaction'){window.__pilotSends=(window.__pilotSends||0)+1;return'0x'+'a'.repeat(64)}
      if(method==='eth_estimateGas')return'0x5208';
      return null;
    }};
  });
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('PILOT READY'),null,{timeout:10000});
  const initial=await page.evaluate(async()=>({
    status:document.querySelector('#status')?.textContent||'',
    unrestricted:document.body.textContent.includes('unrestricted mainnet remains locked'),
    buttons:[...document.querySelectorAll('button')].map(x=>x.id).filter(Boolean),
    sends:window.__pilotSends||0,
    pilot:await fetch('launch/multichain-pilot.json',{cache:'no-store'}).then(r=>r.json())
  }));
  if(!initial.unrestricted)throw Error(`${vp.name}: unrestricted lock disclosure missing`);
  if(initial.sends!==0)throw Error(`${vp.name}: transaction sent during load`);
  if(Number(initial.pilot?.routes?.HYPERLIQUID_FUNDING?.target_account_value_usdc)!==100)throw Error(`${vp.name}: Hyperliquid activation target must be 100 USDC`);
  if(Number(initial.pilot?.routes?.HYPERLIQUID_FUNDING?.max_amount)!==105)throw Error(`${vp.name}: Hyperliquid pilot cap must allow the 100 USDC activation target`);
  if(!String(initial.pilot?.evidence?.evm_explorers?.arbitrum||'').startsWith('https://'))throw Error(`${vp.name}: Arbitrum evidence explorer missing`);
  if(!String(initial.pilot?.evidence?.solana_explorer||'').startsWith('https://'))throw Error(`${vp.name}: Solana evidence explorer missing`);
  await page.fill('#amt-EVM_TO_EVM','3');
  await page.click('#run-EVM_TO_EVM');
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('<= 2'));
  const afterEvm=await page.evaluate(()=>({status:document.querySelector('#status')?.textContent||'',sends:window.__pilotSends||0}));
  if(afterEvm.sends!==0)throw Error(`${vp.name}: over-cap EVM attempt sent a transaction`);
  await page.fill('#amt-HYPERLIQUID_FUNDING','4');
  await page.click('#run-HYPERLIQUID_FUNDING');
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('5-105 USDC'));
  const afterHl=await page.evaluate(()=>({status:document.querySelector('#status')?.textContent||'',sends:window.__pilotSends||0}));
  if(afterHl.sends!==0)throw Error(`${vp.name}: below-min Hyperliquid attempt sent a transaction`);
  const shot=`${proof}/${vp.name}.png`;await page.screenshot({path:shot,fullPage:true});
  results.push({viewport:vp,initial,afterEvm,afterHl,screenshot:shot});
  await ctx.close();
}
await browser.close();
const report={contract:'rwa-multichain-real-receipt-pilot-v2',url,ok:true,results};
await writeFile(`${proof}/report.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
